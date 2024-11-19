console.log('Loading configurator...');

let seriesData = {};

async function parseMarkdownData(markdownText) {
  console.log('Starting to parse markdown data');
  const sections = markdownText.split('\n## ');
  const data = {
    shaftEndCovers: [],
    gearHousings: [],
    pecCovers: [],
    motorShaftEndCovers: [],
    motorGearHousings: [],
    motorPecCovers: [],
    driveGearSets: {},
    idlerGearSets: [],
    shaftStyles: [],
    rotationOptions: [
      { code: '1', description: 'CW' },
      { code: '2', description: 'CCW' },
      { code: '3', description: 'Bi rotational' },
      { code: '4', description: 'CW with bearing' },
      { code: '5', description: 'CCW with bearing' },
      { code: '6', description: 'Bi rotational with bearing' },
      { code: '8', description: 'Birotational motor with 1-1/4" NPT case drain with bearing' },
      { code: '9', description: 'Birotational motor with 1-1/4" NPT case drain without bearing' }
    ]
  };

  sections.forEach(section => {
    console.log('Processing section:', section.split('\n')[0]);

    if (section.includes('### Shaft End Cover (SEC)')) {
      const lines = section.split('\n').filter(line => line.includes('|'));
      const parsedData = lines.slice(2).map(line => {
        const [code, partNumber, description] = line.split('|').slice(1, -1).map(s => s.trim());
        return { code, partNumber, description };
      });

      if (section.toLowerCase().includes('motor')) {
        data.motorShaftEndCovers = parsedData;
        console.log('Added motor shaft end covers:', parsedData);
      } else {
        data.shaftEndCovers = parsedData;
        console.log('Added pump shaft end covers:', parsedData);
      }
    }
    else if (section.includes('### P.E.C Cover')) {
      const lines = section.split('\n').filter(line => line.includes('|'));
      const parsedData = lines.slice(2).map(line => {
        const [description, partNumber] = line.split('|').slice(1, -1).map(s => s.trim());
        return { description, partNumber };
      });

      if (section.toLowerCase().includes('motor')) {
        data.motorPecCovers = parsedData;
        console.log('Added motor PEC covers:', parsedData);
      } else {
        data.pecCovers = parsedData;
        console.log('Added pump PEC covers:', parsedData);
      }
    }
    else if (section.includes('### Gear Housing')) {
      const lines = section.split('\n').filter(line => line.includes('|'));
      const parsedData = lines.slice(2).map(line => {
        const [code, partNumber, description] = line.split('|').slice(1, -1).map(s => s.trim());
        return { code, partNumber, description: description || 'Same as pump' };
      });

      if (section.toLowerCase().includes('motor')) {
        data.motorGearHousings = parsedData;
        console.log('Added motor gear housings:', parsedData);
      } else {
        data.gearHousings = parsedData;
        console.log('Added pump gear housings:', parsedData);
      }
    }
    else if (section.includes('### Drive Gear Sets') && !section.includes('Idler')) {
      const headerMatch = section.match(/Code (\d+)/);
      if (headerMatch) {
        const styleCode = headerMatch[1];
        if (!data.driveGearSets[styleCode]) {
          data.driveGearSets[styleCode] = {};
        }
        const lines = section.split('\n').filter(line => line.includes('|'));
        lines.slice(2).forEach(line => {
          const [code, partNumber] = line.split('|').slice(1, -1).map(s => s.trim());
          data.driveGearSets[styleCode][code] = partNumber;
        });
        const styleDesc = section.match(/\((.*?)\)/)[1];
        if (!data.shaftStyles.find(style => style.code === styleCode)) {
          data.shaftStyles.push({ code: styleCode, description: styleDesc });
        }
        console.log(`Added drive gear set for style ${styleCode}`);
      }
    }
    else if (section.includes('### Idler Gear Sets')) {
      const lines = section.split('\n').filter(line => line.includes('|'));
      data.idlerGearSets = lines.slice(2).map(line => {
        const [code, partNumber, description] = line.split('|').slice(1, -1).map(s => s.trim());
        return { code, partNumber, description };
      });
      console.log('Added idler gear sets:', data.idlerGearSets);
    }
  });

  console.log('Parsed data summary:', {
    shaftEndCovers: data.shaftEndCovers.length,
    motorShaftEndCovers: data.motorShaftEndCovers.length,
    gearHousings: data.gearHousings.length,
    motorGearHousings: data.motorGearHousings.length,
    shaftStyles: data.shaftStyles.length
  });

  return data;
}

async function loadSeriesData() {
  try {
    console.log('Starting to load series data...');
    
    const responses = await Promise.all([
      fetch('120-series.md'),
      fetch('131-series.md'),
      fetch('p151-tables.md'),
      fetch('fgp230-tables.md'),
      fetch('fgp250-tables.md'),
      fetch('fgp265-tables.md')
    ]);

    // Check all responses
    responses.forEach((response, index) => {
      const files = ['120-series.md', '131-series.md', 'p151-tables.md', 'fgp230-tables.md', 'fgp250-tables.md', 'fgp265-tables.md'];
      console.log(`${files[index]} fetch response:`, response.status, response.ok);
    });

    const contents = await Promise.all(responses.map(r => r.text()));

    seriesData = {
      '120': await parseMarkdownData(contents[0]),
      '131': await parseMarkdownData(contents[1]),
      '151': await parseMarkdownData(contents[2]),
      '230': await parseMarkdownData(contents[3]),
      '250': await parseMarkdownData(contents[4]),
      '265': await parseMarkdownData(contents[5])
    };

    console.log('Loaded all series data');
    initializeConfigurator();
  } catch (error) {
    console.error('Error in loadSeriesData:', error);
    document.getElementById('root').innerHTML = `Error loading configurator data: ${error.message}. 
      Make sure all series files are in the same folder.`;
  }
}
function generateBOM(config) {
  if (!config.type || !config.series || !config.secCode || !config.gearSize || !config.shaftStyle) return [];
  
  const currentSeriesData = seriesData[config.series];
  if (!currentSeriesData) {
    console.error('No data found for series:', config.series);
    return [];
  }

  console.log('Generating BOM for config:', config);
  const bom = [];
  const is200Series = ['230', '250', '265'].includes(config.series);

  // Add shaft end cover based on type and series
  const secArray = is200Series && config.type === 'M' ? 
    currentSeriesData.motorShaftEndCovers : 
    currentSeriesData.shaftEndCovers;
  
  const sec = secArray.find(s => s.code === config.secCode);
  if (sec) {
    bom.push({
      partNumber: sec.partNumber,
      quantity: 1,
      description: `Shaft End Cover - ${sec.description}`
    });
  } else {
    console.warn('Shaft end cover not found for code:', config.secCode);
  }

  // Add gear housings
  const gearSizes = [config.gearSize];
  if (config.pumpType !== 'single' && config.additionalGearSizes) {
    gearSizes.push(...config.additionalGearSizes.filter(size => size));
  }
  
  gearSizes.forEach((size, index) => {
    const gearArray = is200Series && config.type === 'M' ? 
      currentSeriesData.motorGearHousings : 
      currentSeriesData.gearHousings;
    
    const housing = gearArray.find(h => h.code === size);
    if (housing) {
      bom.push({
        partNumber: housing.partNumber,
        quantity: 1,
        description: `Gear Housing ${index === 0 ? '(Primary)' : `(Section ${index + 2})`} - ${housing.description}`
      });
    } else {
      console.warn('Gear housing not found for code:', size);
    }
  });

  // Add drive gear set
  if (currentSeriesData.driveGearSets && config.shaftStyle) {
    const driveGearKey = `${config.gearSize}-${config.shaftStyle}`;
    const driveGearPartNumber = currentSeriesData.driveGearSets[config.shaftStyle]?.[driveGearKey];
    if (driveGearPartNumber && driveGearPartNumber !== 'N/A') {
      const shaftStyle = currentSeriesData.shaftStyles.find(s => s.code === config.shaftStyle);
      bom.push({
        partNumber: driveGearPartNumber,
        quantity: 1,
        description: `Drive Gear Set - ${config.gearSize}" with ${shaftStyle?.description || ''}`
      });
    } else {
      console.warn('Drive gear set not found or N/A for:', driveGearKey);
    }
  }

  // Add idler gear sets for additional sections
  if (config.pumpType !== 'single' && config.additionalGearSizes) {
    config.additionalGearSizes.forEach((size, index) => {
      if (size) {
        const idlerSet = currentSeriesData.idlerGearSets?.find(set => set.code === size);
        if (idlerSet) {
          bom.push({
            partNumber: idlerSet.partNumber,
            quantity: 1,
            description: `Idler Gear Set (Section ${index + 2}) - ${idlerSet.description}`
          });
        } else {
          console.warn('Idler gear set not found for code:', size);
        }
      }
    });
  }

  // Add PEC Cover
  if (config.pecSelection) {
    const pecArray = is200Series && config.type === 'M' ? 
      currentSeriesData.motorPecCovers : 
      currentSeriesData.pecCovers;
    
    const pecCover = pecArray?.find(pec => pec.partNumber === config.pecSelection);
    if (pecCover) {
      bom.push({
        partNumber: pecCover.partNumber,
        quantity: 1,
        description: `PEC Cover - ${pecCover.description}`
      });
    } else {
      console.warn('PEC cover not found for:', config.pecSelection);
    }
  }

  // Add small parts kit
  if (config.type && config.pumpType) {
    const pumpTypeNumber = 
      config.pumpType === 'single' ? '1' :
      config.pumpType === 'tandem' ? '2' :
      config.pumpType === 'triple' ? '3' : '4';
    
    bom.push({
      partNumber: `${config.type}${config.series}-${pumpTypeNumber}`,
      quantity: 1,
      description: 'Small Parts Kit'
    });
  }

  console.log('Generated BOM:', bom);
  return bom;
}

function generateModelCode(config) {
  if (!config.type || !config.series || !config.rotation || !config.secCode || 
      !config.gearSize || !config.shaftStyle) {
    console.warn('Missing required fields for model code generation');
    return '';
  }
  
  let code = `${config.type}${config.series}A${config.rotation}${config.secCode}`;
  code += config.portingCodes[0] || 'XXXX';
  code += `${config.gearSize}-${config.shaftStyle}`;
  
  if (config.pumpType !== 'single' && config.additionalGearSizes.length > 0) {
    config.additionalGearSizes.forEach((size, index) => {
      if (size) {
        code += (config.additionalPortingCodes[index] || 'XXXX');
        code += `${size}-${index + 1}`;
      }
    });
  }
  
  console.log('Generated model code:', code);
  return code;
}
const PumpConfigurator = () => {
  const [config, setConfig] = React.useState({
    type: '',
    series: '',
    pumpType: '',
    rotation: '',
    secCode: '',
    gearSize: '',
    shaftStyle: '',
    additionalGearSizes: [],
    portingCodes: [''],
    additionalPortingCodes: [],
    pecSelection: ''
  });

  const [bom, setBom] = React.useState([]);

  React.useEffect(() => {
    setBom(generateBOM(config));
  }, [config]);

  const createEmptyOption = () => React.createElement('option', { value: '', key: 'empty' }, '-- Select --');

  const createSelectField = (label, value, options, onChange, isPecSelect = false) => {
    if (!Array.isArray(options)) {
      console.warn(`No options provided for ${label}`);
      options = [];
    }

    console.log(`Creating select field for ${label}:`, options);

    return React.createElement('div', { className: 'mb-4' },
      React.createElement('label', { className: 'block text-sm font-medium mb-2' }, label),
      React.createElement('select', {
        className: 'w-full p-2 border rounded',
        value: value || '',
        onChange: (e) => onChange(e.target.value)
      }, [
        createEmptyOption(),
        ...options.map(option => {
          const optionValue = isPecSelect ? option.partNumber : (option.value || option.code);
          const optionLabel = isPecSelect ? 
            option.description :
            option.label || (option.code ? `${option.code} - ${option.description}` : option.description);
          
          return React.createElement('option', { 
            value: optionValue || '',
            key: optionValue || Math.random().toString(36)
          }, optionLabel || '');
        })
      ])
    );
  };

  const createAdditionalSectionFields = (index) => {
    const components = getComponents();
    return React.createElement('div', { 
      key: `section-${index}`,
      className: 'border-t pt-4 mt-4'
    },
      React.createElement('h4', { 
        className: 'font-medium mb-4'
      }, `Section ${index + 2}`),
      createSelectField(`Gear Size - Section ${index + 2}`, 
        config.additionalGearSizes[index] || '',
        components.gearHousings,
        (value) => {
          const newSizes = [...config.additionalGearSizes];
          newSizes[index] = value;
          setConfig({ ...config, additionalGearSizes: newSizes });
        }
      )
    );
  };

  const currentSeriesData = seriesData[config.series] || {};
  const is200Series = ['230', '250', '265'].includes(config.series);

  const getComponents = () => {
    if (!currentSeriesData) {
      console.warn('No data available for series:', config.series);
      return { shaftEndCovers: [], gearHousings: [], pecCovers: [] };
    }

    if (is200Series && config.type === 'M') {
      return {
        shaftEndCovers: currentSeriesData.motorShaftEndCovers || [],
        gearHousings: currentSeriesData.motorGearHousings || [],
        pecCovers: currentSeriesData.motorPecCovers || []
      };
    }

    return {
      shaftEndCovers: currentSeriesData.shaftEndCovers || [],
      gearHousings: currentSeriesData.gearHousings || [],
      pecCovers: currentSeriesData.pecCovers || []
    };
  };

  const components = getComponents();
  console.log('Current components:', { 
    series: config.series, 
    type: config.type, 
    components, 
    currentSeriesData 
  });

  return React.createElement('div', { className: 'bg-white shadow rounded-lg max-w-4xl mx-auto' },
    React.createElement('div', { className: 'px-4 py-5 border-b border-gray-200' },
      React.createElement('h3', { className: 'text-2xl font-bold' }, 'Hydraulic Pump Configurator')
    ),
    React.createElement('div', { className: 'p-4 space-y-6' },
      createSelectField('Series', config.series,
        [
          { value: '120', label: '120 Series' },
          { value: '131', label: '131 Series' },
          { value: '151', label: '151 Series' },
          { value: '230', label: '230 Series' },
          { value: '250', label: '250 Series' },
          { value: '265', label: '265 Series' }
        ],
        (value) => {
          setConfig({
            ...config,
            series: value,
            type: '',
            pumpType: '',
            rotation: '',
            secCode: '',
            gearSize: '',
            shaftStyle: '',
            additionalGearSizes: [],
            portingCodes: [''],
            additionalPortingCodes: [],
            pecSelection: ''
          });
        }
      ),

      config.series && React.createElement('div', { className: 'space-y-4' },
        createSelectField('Type', config.type, 
          [{ value: 'P', label: 'Pump (P)' }, { value: 'M', label: 'Motor (M)' }],
          (value) => setConfig({
            ...config,
            type: value,
            secCode: '',
            gearSize: '',
            shaftStyle: '',
            pecSelection: ''
          })
        ),

        config.type && React.createElement('div', { className: 'space-y-4' },
          createSelectField('Pump Type', config.pumpType,
            [
              { value: 'single', label: 'Single' },
              { value: 'tandem', label: 'Tandem' },
              { value: 'triple', label: 'Triple' },
              { value: 'quad', label: 'Quad' }
            ],
            (value) => {
              const newConfig = { ...config, pumpType: value };
              if (value === 'single') {
                newConfig.additionalGearSizes = [];
                newConfig.additionalPortingCodes = [];
              } else {
                const count = value === 'tandem' ? 1 : value === 'triple' ? 2 : 3;
                newConfig.additionalGearSizes = Array(count).fill('');
                newConfig.additionalPortingCodes = Array(count).fill('');
              }
              setConfig(newConfig);
            }
          ),

          createSelectField('Rotation', config.rotation, currentSeriesData.rotationOptions || [],
            (value) => setConfig({ ...config, rotation: value })
          ),

          createSelectField('Shaft End Cover', config.secCode, components.shaftEndCovers,
            (value) => setConfig({ ...config, secCode: value })
          ),

          createSelectField('Gear Size', config.gearSize, components.gearHousings,
            (value) => setConfig({ ...config, gearSize: value })
          ),

          createSelectField('Shaft Style', config.shaftStyle, currentSeriesData.shaftStyles || [],
            (value) => setConfig({ ...config, shaftStyle: value })
          ),

          config.pumpType && config.pumpType !== 'single' && React.createElement('div', 
            { className: 'border-t pt-4 mt-4' },
            React.createElement('h4', { 
              className: 'font-medium mb-4 text-lg'
            }, 'Additional Sections'),
            Array.from({ length: config.pumpType === 'tandem' ? 1 : config.pumpType === 'triple' ? 2 : 3 })
              .map((_, index) => createAdditionalSectionFields(index))
          ),

          createSelectField('Port End Cover', config.pecSelection, components.pecCovers,
            (value) => setConfig({ ...config, pecSelection: value }), true
          ),

          config.type && React.createElement('div', { className: 'mt-8 p-4 bg-gray-100 rounded' },
            React.createElement('label', { className: 'block text-sm font-medium mb-2' }, 'Model Code:'),
            React.createElement('div', { className: 'font-mono text-lg' }, generateModelCode(config))
          ),

          bom.length > 0 && React.createElement('div', { className: 'mt-8 p-4' },
            React.createElement('h3', { className: 'text-lg font-medium mb-4' }, 'Bill of Materials'),
            React.createElement('div', { className: 'table-container' },
              React.createElement('table', { className: 'bom-table' },
                React.createElement('thead', null,
                  React.createElement('tr', null,
                    React.createElement('th', null, 'Part Number'),
                    React.createElement('th', null, 'Qty'),
                    React.createElement('th', null, 'Description')
                  )
                ),
                React.createElement('tbody', null,
                  bom.map((item, index) =>
                    React.createElement('tr', { key: `bom-${index}` },
                      React.createElement('td', { className: 'selectable-cell', tabIndex: 0 }, item.partNumber),
                      React.createElement('td', { className: 'selectable-cell', tabIndex: 0 }, item.quantity),
                      React.createElement('td', { className: 'selectable-cell', tabIndex: 0 }, item.description)
                    )
                  )
                )
              )
            ),
            React.createElement('div', { className: 'mt-4' },
              React.createElement('button', {
                className: 'px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600',
                onClick: () => {
                  const rows = bom.map(item => `${item.partNumber}\t${item.quantity}`).join('\n');
                  navigator.clipboard.writeText(rows);
                }
              }, 'Copy Part Numbers and Quantity')
            )
          )
        )
      )
    )
  );
};

function initializeConfigurator() {
  ReactDOM.render(React.createElement(PumpConfigurator), document.getElementById('root'));
}

window.onload = loadSeriesData;