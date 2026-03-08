window.BCC_PRODUCTS_CONTENT = {
  es: {
    hero: {
      copy: {
        eyebrow: 'Portafolio',
        title: 'Tecnología BCC',
        signalsAriaLabel: 'Indicadores rápidos del portafolio',
        signals: [
          { value: '3', label: 'familias' },
          { value: '10+', label: 'flujos de análisis' },
          { value: 'Lab + Industria', label: 'implementación' }
        ],
        actions: [
          { label: 'Ver productos', href: '#catalogo', variant: 'dark' },
          { label: 'Comparar', href: '#comparador', variant: 'plain' }
        ]
      },
      visual: {
        badge: 'Selección principal',
        tablistLabel: 'Selección principal de tecnología',
        panes: [
          {
            id: 'software',
            tabLabel: 'Software',
            kicker: 'Tu Software',
            title: 'Automiza tu operación con software a medida',
            text: 'Desde análisis de datos hasta reportes e integraciones de laboratorio.',
            actions: [
              { label: 'Software personalizado', href: '/contactUs.html', variant: 'dark' },
              { label: 'Unirme al beta', href: '/signup.html', variant: 'ghost' },
              { label: 'Diagnosticar flujo', href: '/contactUs.html', variant: 'ghost' }
            ],
            showcase: [
              {
                href: '/product_maps_nano.html',
                media: 'ui',
                image: '/static/defect.png',
                alt: 'MAP-Nano',
                title: 'MAP-Nano',
                meta: 'Rugosidad, porosidad y morfología'
              },
              {
                href: '/product_maps.html#map-bio',
                media: 'ui',
                image: '/static/gyrosigma.png',
                alt: 'MAP-Bio',
                title: 'MAP-Bio',
                meta: 'Conteo y análisis morfológico'
              }
            ]
          },
          {
            id: 'instrumentacion',
            tabLabel: 'Instrumentación',
            kicker: 'Tu Instrumentación',
            title: 'Desarrolla instrumentación con BCC',
            text: 'Patrocina innovaciones, pide desarrollo especial o prueba prototipos.',
            actions: [
              { label: 'Patrocinar desarrollo', href: '/contactUs.html', variant: 'dark' },
              { label: 'Desarrollo personalizado', href: '/contactUs.html', variant: 'ghost' },
              { label: 'Prueba adelantada', href: '/signup.html', variant: 'ghost' }
            ],
            showcase: [
              {
                href: '#catalogo',
                scrollTarget: 'eis',
                media: 'chart',
                image: '/static/generated_eis.png',
                alt: 'EIS',
                title: 'EIS',
                meta: 'Opciones para líquidos, metales, recubrimientos y baterías'
              },
              {
                href: '#catalogo',
                scrollTarget: 'dls',
                media: 'illustration',
                image: '/static/DLS.svg',
                alt: 'DLS-Pro',
                title: 'DLS-Pro',
                meta: 'Caracterización de partículas suspendidas en líquido'
              }
            ]
          },
          {
            id: 'bundles',
            tabLabel: 'Bundles',
            kicker: 'Tus Bundles',
            title: 'Activa un bundle listo para resultados',
            text: 'Combinamos hardware, software y acompañamiento para desplegar más rápido.',
            actions: [
              { label: 'Diseñar mi bundle', href: '/contactUs.html', variant: 'dark' },
              { label: 'Solicitar demo integrada', href: '/contactUs.html', variant: 'ghost' },
              { label: 'Iniciar piloto', href: '/signup.html', variant: 'ghost' }
            ],
            showcase: [
              {
                href: '#catalogo',
                scrollTarget: 'bundles',
                media: 'photo',
                image: '/static/cultivo_celular.png',
                alt: 'EIS + MAP-Bio',
                title: 'EIS + MAP-Bio',
                meta: 'Análisis y monitoreo de cultivos'
              },
              {
                href: '#catalogo',
                scrollTarget: 'bundles',
                media: 'chart',
                image: '/static/diagrama_de_bode.gif',
                alt: 'EIS + EIS-Toolkit',
                title: 'EIS + EIS-Toolkit',
                meta: 'Medición + fitting reproducible'
              }
            ]
          }
        ]
      }
    },
    filters: {
      searchLabel: 'Buscar',
      searchPlaceholder: 'Buscar por nombre, método o etiqueta...',
      familyLabel: 'Familia:',
      familySrLabel: 'Familia',
      methodLabel: 'Método:',
      useLabel: 'Uso:',
      clearFilters: 'Limpiar filtros',
      selectedLabel: 'seleccionados',
      familyOptions: [
        { value: 'all', label: 'Todo' },
        { value: 'software', label: 'Software' },
        { value: 'instrumentacion', label: 'Instrumentación' },
        { value: 'bundles', label: 'Bundles' }
      ],
      methodOptions: [
        { value: 'EIS', label: 'EIS' },
        { value: 'DLS', label: 'DLS' },
        { value: 'Imaging', label: 'Imaging' },
        { value: 'Data', label: 'Datos' }
      ],
      useOptions: [
        { value: 'ID', label: 'I+D' },
        { value: 'QA', label: 'QA/QC' },
        { value: 'Teaching', label: 'Docencia' }
      ]
    },
    catalogTitle: 'Catálogo',
    products: [
      {
        id: 'aqua-specter',
        anchorId: 'eis',
        family: 'instrumentacion',
        methods: ['EIS'],
        uses: ['ID', 'QA'],
        image: '/static/render_as.jpg',
        alt: 'AquaSpecter',
        title: 'AquaSpecter',
        description: 'EIS de bolsillo para análisis simples y frecuentes',
        tags: ['EIS', 'Instrumento'],
        actions: [
          { label: 'Cotizar', href: '/contactUs.html?demo=1', variant: 'dark' },
          { label: 'Ficha técnica', href: '#', variant: 'ghost' }
        ]
      },
      {
        id: 'aqua-specter-inline',
        family: 'instrumentacion',
        methods: ['EIS'],
        uses: ['ID', 'QA'],
        image: '/static/render_ast.jpg',
        alt: 'AquaSpecter de tubería',
        title: 'AquaSpecter de tubería',
        description: 'EIS incorporado para análisis constante de muestras líquidas',
        tags: ['EIS', 'Instrumento'],
        actions: [
          { label: 'Cotizar', href: '/contactUs.html?demo=1', variant: 'dark' },
          { label: 'Ficha técnica', href: '#', variant: 'ghost' }
        ]
      },
      {
        id: 'dls-mini',
        anchorId: 'dls',
        family: 'instrumentacion',
        methods: ['DLS'],
        uses: ['Teaching'],
        image: '/static/render_dls_mini.jpg',
        alt: 'DLS-Mini',
        title: 'DLS-Mini',
        description: 'Compacto, para muestras pequeñas y PSD básico',
        tags: ['DLS', 'Instrumento'],
        actions: [
          { label: 'Cotizar', href: '/contactUs.html?demo=1', variant: 'dark' },
          { label: 'Ficha técnica', href: '#', variant: 'ghost' }
        ]
      },
      {
        id: 'science-smartboard',
        family: 'software',
        methods: ['Data'],
        uses: ['ID', 'QA', 'Teaching'],
        featured: true,
        image: '/static/captura_smartboard_radar.png',
        alt: 'Smartboard científico abierto',
        title: 'Smartboard científico',
        description: 'Herramienta abierta para conectar widgets y explorar datos científicos desde la página de Ciencia.',
        tags: ['Herramienta abierta', 'Inteligencia de datos', 'Gratis'],
        actions: [
          { label: 'Abrir Smartboard', href: '/science.html', variant: 'dark' },
          { label: 'Ver en Ciencia', href: '/science.html', variant: 'ghost' }
        ]
      },
      {
        id: 'map-nano',
        family: 'software',
        methods: ['Imaging'],
        uses: ['ID', 'QA'],
        image: '/static/mapnano.png',
        alt: 'MAP-Nano',
        title: 'MAP-Nano',
        description: 'Rugosidad, porosidad y morfología para Web/Desktop',
        tags: ['Imaging', 'Software'],
        actions: [
          { label: 'Ver más', href: '/product_maps_nano.html', variant: 'dark' },
          { label: 'Demo', href: '/contactUs.html?demo=1', variant: 'ghost' }
        ]
      },
      {
        id: 'map-bio',
        family: 'software',
        methods: ['Imaging'],
        uses: ['ID'],
        image: '/static/gyrosigma.png',
        alt: 'MAP-Bio',
        title: 'MAP-Bio',
        description: 'Conteo, clasificación y morfología para Web/Desktop',
        tags: ['Imaging', 'Software'],
        actions: [
          { label: 'Ver más', href: '/product_maps.html', variant: 'dark' },
          { label: 'Demo', href: '/contactUs.html?demo=1', variant: 'ghost' }
        ]
      },
      {
        id: 'bundle-culture',
        anchorId: 'bundles',
        family: 'bundles',
        methods: ['EIS', 'Imaging'],
        uses: ['QA', 'ID'],
        image: '/static/cultivo_celular_dibujo.png',
        alt: 'EIS + MAP-Bio',
        title: 'EIS + MAP-Bio',
        description: 'Monitoreo de impedancia, conteo y caracterización de cultivos celulares',
        tags: ['Bundle', 'EIS + Imaging'],
        actions: [
          { label: 'Cotizar', href: '/contactUs.html?demo=1', variant: 'dark' },
          { label: 'Ficha', href: '#', variant: 'ghost' }
        ]
      },
      {
        id: 'bundle-toolkit',
        family: 'bundles',
        methods: ['EIS'],
        uses: ['ID', 'QA'],
        image: '/static/diagrama_de_bode.gif',
        alt: 'EIS + EIS-Toolkit',
        title: 'EIS + EIS-Toolkit',
        description: 'Medición y fitting reproducible',
        tags: ['Bundle', 'EIS'],
        actions: [
          { label: 'Cotizar', href: '/contactUs.html?demo=1', variant: 'dark' },
          { label: 'Ficha', href: '#', variant: 'ghost' }
        ]
      }
    ],
    compare: {
      title: 'Comparador rápido',
      lead: 'Especificaciones clave por familia. Ajusta estos valores a tus modelos reales.',
      columns: ['Producto', 'Método', 'Rango clave', 'Salidas', 'Formato'],
      rows: [
        ['EIS-2000', 'EIS', '10 µHz-1 MHz; 10 µV-5 V', 'Bode, Nyquist, parámetros', 'Rack'],
        ['DLS-Pro', 'DLS', '1-5,000 nm; 15-90 °C', 'PSD, ζ', 'Benchtop'],
        ['MAP-Nano', 'Imaging', 'Rugosidad, porosidad, morfología', 'CSV, PDF, API', 'Web/Desktop']
      ]
    }
  },
  en: {
    hero: {
      copy: {
        eyebrow: 'Portfolio',
        title: 'BCC Technology',
        signalsAriaLabel: 'Quick portfolio indicators',
        signals: [
          { value: '3', label: 'families' },
          { value: '10+', label: 'analysis workflows' },
          { value: 'Lab + Industry', label: 'deployment' }
        ],
        actions: [
          { label: 'View products', href: '#catalogo', variant: 'dark' },
          { label: 'Compare', href: '#comparador', variant: 'plain' }
        ]
      },
      visual: {
        badge: 'Primary selection',
        tablistLabel: 'Primary technology selection',
        panes: [
          {
            id: 'software',
            tabLabel: 'Software',
            kicker: 'Your Software',
            title: 'Automate your workflow with tailored software',
            text: 'From data analysis to reporting and lab integrations.',
            actions: [
              { label: 'Request custom software', href: '/en/contactUs.html', variant: 'dark' },
              { label: 'Join beta program', href: '/en/signup.html', variant: 'ghost' },
              { label: 'Audit my workflow', href: '/en/contactUs.html', variant: 'ghost' }
            ],
            showcase: [
              {
                href: '/en/product_maps_nano.html',
                media: 'ui',
                image: '/static/defect.png',
                alt: 'MAP-Nano',
                title: 'MAP-Nano',
                meta: 'Roughness, porosity and morphology'
              },
              {
                href: '/en/product_maps.html#map-bio',
                media: 'ui',
                image: '/static/gyrosigma.png',
                alt: 'MAP-Bio',
                title: 'MAP-Bio',
                meta: 'Counting and morphological analysis'
              }
            ]
          },
          {
            id: 'instrumentacion',
            tabLabel: 'Instrumentation',
            kicker: 'Your Instrumentation',
            title: 'Develop new instrumentation with BCC',
            text: 'Sponsor innovations, request custom builds, or test prototypes early.',
            actions: [
              { label: 'Sponsor an instrument', href: '/en/contactUs.html', variant: 'dark' },
              { label: 'Request custom build', href: '/en/contactUs.html', variant: 'ghost' },
              { label: 'Request early trial', href: '/en/signup.html', variant: 'ghost' }
            ],
            showcase: [
              {
                href: '#catalogo',
                scrollTarget: 'eis',
                media: 'chart',
                image: '/static/generated_eis.png',
                alt: 'EIS',
                title: 'EIS',
                meta: 'Options for liquids, metals, coatings and batteries'
              },
              {
                href: '#catalogo',
                scrollTarget: 'dls',
                media: 'illustration',
                image: '/static/DLS.svg',
                alt: 'DLS-Pro',
                title: 'DLS-Pro',
                meta: 'Characterization of particles suspended in liquids'
              }
            ]
          },
          {
            id: 'bundles',
            tabLabel: 'Bundles',
            kicker: 'Your Bundles',
            title: 'Launch with a bundle designed for outcomes',
            text: 'We combine hardware, software and guidance for faster deployment.',
            actions: [
              { label: 'Design my bundle', href: '/en/contactUs.html', variant: 'dark' },
              { label: 'Request integrated demo', href: '/en/contactUs.html', variant: 'ghost' },
              { label: 'Start pilot', href: '/en/signup.html', variant: 'ghost' }
            ],
            showcase: [
              {
                href: '#catalogo',
                scrollTarget: 'bundles',
                media: 'photo',
                image: '/static/cultivo_celular.png',
                alt: 'EIS + MAP-Bio',
                title: 'EIS + MAP-Bio',
                meta: 'Analysis and monitoring of cultures'
              },
              {
                href: '#catalogo',
                scrollTarget: 'bundles',
                media: 'chart',
                image: '/static/diagrama_de_bode.gif',
                alt: 'EIS + EIS-Toolkit',
                title: 'EIS + EIS-Toolkit',
                meta: 'Measurement + reproducible fitting'
              }
            ]
          }
        ]
      }
    },
    filters: {
      searchLabel: 'Search',
      searchPlaceholder: 'Search by name, method, or tag...',
      familyLabel: 'Family:',
      familySrLabel: 'Family',
      methodLabel: 'Method:',
      useLabel: 'Use:',
      clearFilters: 'Clear filters',
      selectedLabel: 'selected',
      familyOptions: [
        { value: 'all', label: 'All' },
        { value: 'software', label: 'Software' },
        { value: 'instrumentacion', label: 'Instrumentation' },
        { value: 'bundles', label: 'Bundles' }
      ],
      methodOptions: [
        { value: 'EIS', label: 'EIS' },
        { value: 'DLS', label: 'DLS' },
        { value: 'Imaging', label: 'Imaging' },
        { value: 'Data', label: 'Data' }
      ],
      useOptions: [
        { value: 'ID', label: 'R&D' },
        { value: 'QA', label: 'QA/QC' },
        { value: 'Teaching', label: 'Teaching' }
      ]
    },
    catalogTitle: 'Catalog',
    products: [
      {
        id: 'aqua-specter',
        anchorId: 'eis',
        family: 'instrumentacion',
        methods: ['EIS'],
        uses: ['ID', 'QA'],
        image: '/static/render_as.jpg',
        alt: 'AquaSpecter',
        title: 'AquaSpecter',
        description: 'Pocket EIS for simple, frequent analysis',
        tags: ['EIS', 'Instrument'],
        actions: [
          { label: 'Get quote', href: '/en/contactUs.html?demo=1', variant: 'dark' },
          { label: 'Spec sheet', href: '#', variant: 'ghost' }
        ]
      },
      {
        id: 'aqua-specter-inline',
        family: 'instrumentacion',
        methods: ['EIS'],
        uses: ['ID', 'QA'],
        image: '/static/render_ast.jpg',
        alt: 'Inline AquaSpecter',
        title: 'Inline AquaSpecter',
        description: 'Embedded EIS for continuous liquid-sample analysis',
        tags: ['EIS', 'Instrument'],
        actions: [
          { label: 'Get quote', href: '/en/contactUs.html?demo=1', variant: 'dark' },
          { label: 'Spec sheet', href: '#', variant: 'ghost' }
        ]
      },
      {
        id: 'dls-mini',
        anchorId: 'dls',
        family: 'instrumentacion',
        methods: ['DLS'],
        uses: ['Teaching'],
        image: '/static/render_dls_mini.jpg',
        alt: 'DLS-Mini',
        title: 'DLS-Mini',
        description: 'Compact for small samples and basic PSD',
        tags: ['DLS', 'Instrument'],
        actions: [
          { label: 'Get quote', href: '/en/contactUs.html?demo=1', variant: 'dark' },
          { label: 'Spec sheet', href: '#', variant: 'ghost' }
        ]
      },
      {
        id: 'science-smartboard',
        family: 'software',
        methods: ['Data'],
        uses: ['ID', 'QA', 'Teaching'],
        featured: true,
        image: '/static/captura_smartboard_radar.png',
        alt: 'Open science smartboard',
        title: 'Science Smartboard',
        description: 'Open tool to connect widgets and explore scientific data from the Science page.',
        tags: ['Open Tool', 'Data Intelligence', 'Free'],
        actions: [
          { label: 'Open Smartboard', href: '/en/science.html', variant: 'dark' },
          { label: 'View in Science', href: '/en/science.html', variant: 'ghost' }
        ]
      },
      {
        id: 'map-nano',
        family: 'software',
        methods: ['Imaging'],
        uses: ['ID', 'QA'],
        image: '/static/mapnano.png',
        alt: 'MAP-Nano',
        title: 'MAP-Nano',
        description: 'Roughness, porosity and morphology for Web/Desktop',
        tags: ['Imaging', 'Software'],
        actions: [
          { label: 'Learn more', href: '/en/product_maps_nano.html', variant: 'dark' },
          { label: 'Demo', href: '/en/contactUs.html?demo=1', variant: 'ghost' }
        ]
      },
      {
        id: 'map-bio',
        family: 'software',
        methods: ['Imaging'],
        uses: ['ID'],
        image: '/static/gyrosigma.png',
        alt: 'MAP-Bio',
        title: 'MAP-Bio',
        description: 'Counting, classification and morphology for Web/Desktop',
        tags: ['Imaging', 'Software'],
        actions: [
          { label: 'Learn more', href: '/en/product_maps.html', variant: 'dark' },
          { label: 'Demo', href: '/en/contactUs.html?demo=1', variant: 'ghost' }
        ]
      },
      {
        id: 'bundle-culture',
        anchorId: 'bundles',
        family: 'bundles',
        methods: ['EIS', 'Imaging'],
        uses: ['QA', 'ID'],
        image: '/static/cultivo_celular_dibujo.png',
        alt: 'EIS + MAP-Bio',
        title: 'EIS + MAP-Bio',
        description: 'Impedance monitoring, counting and characterization of cell cultures',
        tags: ['Bundle', 'EIS + Imaging'],
        actions: [
          { label: 'Get quote', href: '/en/contactUs.html?demo=1', variant: 'dark' },
          { label: 'Spec sheet', href: '#', variant: 'ghost' }
        ]
      },
      {
        id: 'bundle-toolkit',
        family: 'bundles',
        methods: ['EIS'],
        uses: ['ID', 'QA'],
        image: '/static/diagrama_de_bode.gif',
        alt: 'EIS + EIS-Toolkit',
        title: 'EIS + EIS-Toolkit',
        description: 'Measurement and reproducible fitting',
        tags: ['Bundle', 'EIS'],
        actions: [
          { label: 'Get quote', href: '/en/contactUs.html?demo=1', variant: 'dark' },
          { label: 'Spec sheet', href: '#', variant: 'ghost' }
        ]
      }
    ],
    compare: {
      title: 'Quick comparison',
      lead: 'Key specs by family. Adjust these example values to your real models.',
      columns: ['Product', 'Method', 'Key range', 'Outputs', 'Form factor'],
      rows: [
        ['EIS-2000', 'EIS', '10 µHz-1 MHz; 10 µV-5 V', 'Bode, Nyquist, parameters', 'Rack'],
        ['DLS-Pro', 'DLS', '1-5,000 nm; 15-90 °C', 'PSD, zeta', 'Benchtop'],
        ['MAP-Nano', 'Imaging', 'Roughness, porosity, morphology', 'CSV, PDF, API', 'Web/Desktop']
      ]
    }
  }
};