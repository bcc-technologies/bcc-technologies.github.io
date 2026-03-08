window.BCC_PRODUCTS_CONTENT = {
  "es": {
    "hero": {
      "copy": {
        "eyebrow": "Tecnologia BCC",
        "title": "Empieza por lo que necesitas lograr",
        "signalsAriaLabel": "Indicadores rapidos del portafolio",
        "signals": [
          {
            "value": "3",
            "label": "rutas de adopcion"
          },
          {
            "value": "8",
            "label": "ofertas activas"
          },
          {
            "value": "Lab / Web / Equipo",
            "label": "formatos de despliegue"
          }
        ],
        "actions": [
          {
            "label": "Ver tecnologia",
            "href": "#catalogo",
            "variant": "dark"
          },
          {
            "label": "Comparar",
            "href": "#comparador",
            "variant": "plain"
          }
        ]
      },
      "visual": {
        "badge": "Elige tu ruta",
        "tablistLabel": "Rutas principales de decision tecnologica",
        "panes": [
          {
            "id": "software",
            "tabLabel": "Quiero automatizar",
            "kicker": "Quiero automatizar",
            "title": "Software para convertir analisis en operacion",
            "text": "Ideal si ya tienes imagenes, datos o reportes manuales y quieres volverlos repetibles y auditables.",
            "actions": [
              {
                "label": "Diagnosticar mi flujo",
                "href": "/contactUs.html",
                "variant": "dark"
              },
              {
                "label": "Ver software abierto",
                "href": "/science.html",
                "variant": "ghost"
              }
            ],
            "showcase": [
              {
                "href": "/product_maps_nano.html",
                "media": "ui",
                "image": "/static/defect.png",
                "alt": "MAP-Nano",
                "title": "MAP-Nano",
                "meta": "Rugosidad, porosidad y morfología"
              },
              {
                "href": "/product_maps.html#map-bio",
                "media": "ui",
                "image": "/static/gyrosigma.png",
                "alt": "MAP-Bio",
                "title": "MAP-Bio",
                "meta": "Conteo y análisis morfológico"
              }
            ],
            "outcomes": [
              "Analisis reproducible",
              "Reportes y dashboards",
              "Integraciones con laboratorio"
            ]
          },
          {
            "id": "instrumentacion",
            "tabLabel": "Quiero medir",
            "kicker": "Quiero medir",
            "title": "Instrumentacion cuando necesitas senal propia",
            "text": "Pensado para equipos que necesitan medir en campo, validar hipotesis o acercar instrumentos a la operacion.",
            "actions": [
              {
                "label": "Patrocinar desarrollo",
                "href": "/contactUs.html",
                "variant": "dark"
              },
              {
                "label": "Solicitar prueba adelantada",
                "href": "/signup.html",
                "variant": "ghost"
              }
            ],
            "showcase": [
              {
                "href": "#catalogo",
                "scrollTarget": "eis",
                "media": "chart",
                "image": "/static/generated_eis.png",
                "alt": "EIS",
                "title": "EIS",
                "meta": "Opciones para líquidos, metales, recubrimientos y baterías"
              },
              {
                "href": "#catalogo",
                "scrollTarget": "dls",
                "media": "illustration",
                "image": "/static/DLS.svg",
                "alt": "DLS-Pro",
                "title": "DLS-Pro",
                "meta": "Caracterización de partículas suspendidas en líquido"
              }
            ],
            "outcomes": [
              "Medicion asistida",
              "Integracion experimental",
              "Prototipos y pilotos"
            ]
          },
          {
            "id": "bundles",
            "tabLabel": "Quiero desplegar",
            "kicker": "Quiero desplegar",
            "title": "Bundles listos para una implementacion mas rapida",
            "text": "Combinamos hardware, software y acompanamiento cuando la prioridad es acortar el tiempo a resultado.",
            "actions": [
              {
                "label": "Disenar mi bundle",
                "href": "/contactUs.html",
                "variant": "dark"
              },
              {
                "label": "Solicitar demo integrada",
                "href": "/contactUs.html",
                "variant": "ghost"
              }
            ],
            "showcase": [
              {
                "href": "#catalogo",
                "scrollTarget": "bundles",
                "media": "photo",
                "image": "/static/cultivo_celular.png",
                "alt": "EIS + MAP-Bio",
                "title": "EIS + MAP-Bio",
                "meta": "Análisis y monitoreo de cultivos"
              },
              {
                "href": "#catalogo",
                "scrollTarget": "bundles",
                "media": "chart",
                "image": "/static/diagrama_de_bode.gif",
                "alt": "EIS + EIS-Toolkit",
                "title": "EIS + EIS-Toolkit",
                "meta": "Medición + fitting reproducible"
              }
            ],
            "outcomes": [
              "Bundle guiado",
              "Implementacion mas rapida",
              "Menos friccion operativa"
            ]
          }
        ]
      }
    },
    "filters": {
      "searchLabel": "Buscar",
      "searchPlaceholder": "Buscar por nombre, método o etiqueta...",
      "familyLabel": "Familia:",
      "familySrLabel": "Familia",
      "methodLabel": "Método:",
      "useLabel": "Uso:",
      "clearFilters": "Limpiar filtros",
      "selectedLabel": "seleccionados",
      "familyOptions": [
        {
          "value": "all",
          "label": "Todo"
        },
        {
          "value": "software",
          "label": "Software"
        },
        {
          "value": "instrumentacion",
          "label": "Instrumentación"
        },
        {
          "value": "bundles",
          "label": "Bundles"
        }
      ],
      "methodOptions": [
        {
          "value": "EIS",
          "label": "EIS"
        },
        {
          "value": "DLS",
          "label": "DLS"
        },
        {
          "value": "Imaging",
          "label": "Imaging"
        },
        {
          "value": "Data",
          "label": "Datos"
        }
      ],
      "useOptions": [
        {
          "value": "ID",
          "label": "I+D"
        },
        {
          "value": "QA",
          "label": "QA/QC"
        },
        {
          "value": "Teaching",
          "label": "Docencia"
        }
      ]
    },
    "catalogTitle": "Tecnologia disponible",
    "products": [
      {
        "id": "aqua-specter",
        "anchorId": "eis",
        "family": "instrumentacion",
        "methods": [
          "EIS"
        ],
        "uses": [
          "ID",
          "QA"
        ],
        "image": "/static/render_as.jpg",
        "alt": "AquaSpecter",
        "title": "AquaSpecter",
        "description": "EIS de bolsillo para análisis simples y frecuentes",
        "tags": [
          "EIS",
          "Instrumento"
        ],
        "actions": [
          {
            "label": "Cotizar",
            "href": "/contactUs.html?demo=1",
            "variant": "dark"
          },
          {
            "label": "Ficha rapida",
            "href": "/contactUs.html?demo=1",
            "variant": "ghost",
            "detailId": "aqua-specter"
          }
        ],
        "status": {
          "label": "Piloto asistido",
          "tone": "pilot"
        },
        "bestFor": "Validaciones rapidas y screening.",
        "outputs": "Curvas Bode y Nyquist listas para reporte.",
        "deployment": "Equipo compacto con acompanamiento inicial.",
        "readiness": "Piloto segun muestra."
      },
      {
        "id": "aqua-specter-inline",
        "family": "instrumentacion",
        "methods": [
          "EIS"
        ],
        "uses": [
          "ID",
          "QA"
        ],
        "image": "/static/render_ast.jpg",
        "alt": "AquaSpecter de tubería",
        "title": "AquaSpecter de tubería",
        "description": "EIS incorporado para análisis constante de muestras líquidas",
        "tags": [
          "EIS",
          "Instrumento"
        ],
        "actions": [
          {
            "label": "Hablar con BCC",
            "href": "/contactUs.html?demo=1",
            "variant": "dark"
          },
          {
            "label": "Ficha rapida",
            "href": "/contactUs.html?demo=1",
            "variant": "ghost",
            "detailId": "aqua-specter-inline"
          }
        ],
        "status": {
          "label": "Desarrollo a medida",
          "tone": "custom"
        },
        "bestFor": "Monitoreo recurrente e integracion en proceso.",
        "outputs": "Lectura continua y tendencias.",
        "deployment": "Integracion especifica para entorno y muestra.",
        "readiness": "Proyecto de integracion."
      },
      {
        "id": "dls-mini",
        "anchorId": "dls",
        "family": "instrumentacion",
        "methods": [
          "DLS"
        ],
        "uses": [
          "Teaching"
        ],
        "image": "/static/render_dls_mini.jpg",
        "alt": "DLS-Mini",
        "title": "DLS-Mini",
        "description": "Compacto, para muestras pequeñas y PSD básico",
        "tags": [
          "DLS",
          "Instrumento"
        ],
        "actions": [
          {
            "label": "Solicitar demo",
            "href": "/contactUs.html?demo=1",
            "variant": "dark"
          },
          {
            "label": "Ficha rapida",
            "href": "/contactUs.html?demo=1",
            "variant": "ghost",
            "detailId": "dls-mini"
          }
        ],
        "status": {
          "label": "Piloto academico",
          "tone": "pilot"
        },
        "bestFor": "Docencia y validacion rapida de dispersion.",
        "outputs": "PSD basico y lectura guiada.",
        "deployment": "Equipo de mesa facil de mover.",
        "readiness": "Piloto academico."
      },
      {
        "id": "science-smartboard",
        "family": "software",
        "methods": [
          "Data"
        ],
        "uses": [
          "ID",
          "QA",
          "Teaching"
        ],
        "featured": true,
        "image": "/static/captura_smartboard_radar.png",
        "alt": "Smartboard científico abierto",
        "title": "Smartboard científico",
        "description": "Herramienta abierta para conectar widgets y explorar datos científicos desde la página de Ciencia.",
        "tags": [
          "Herramienta abierta",
          "Inteligencia de datos",
          "Gratis"
        ],
        "actions": [
          {
            "label": "Abrir Smartboard",
            "href": "/science.html",
            "variant": "dark"
          },
          {
            "label": "Ficha rapida",
            "href": "/science.html",
            "variant": "ghost",
            "detailId": "science-smartboard"
          }
        ],
        "status": {
          "label": "Herramienta abierta",
          "tone": "open"
        },
        "bestFor": "Exploracion, docencia y prototipado rapido.",
        "outputs": "Widgets enlazados y exportacion visual.",
        "deployment": "Web abierta desde Ciencia.",
        "readiness": "Disponible hoy."
      },
      {
        "id": "map-nano",
        "family": "software",
        "methods": [
          "Imaging"
        ],
        "uses": [
          "ID",
          "QA"
        ],
        "image": "/static/mapnano.png",
        "alt": "MAP-Nano",
        "title": "MAP-Nano",
        "description": "Rugosidad, porosidad y morfología para Web/Desktop",
        "tags": [
          "Imaging",
          "Software"
        ],
        "actions": [
          {
            "label": "Ver producto",
            "href": "/product_maps_nano.html",
            "variant": "dark"
          },
          {
            "label": "Ficha rapida",
            "href": "/product_maps_nano.html",
            "variant": "ghost",
            "detailId": "map-nano"
          }
        ],
        "status": {
          "label": "Piloto aplicado",
          "tone": "ready"
        },
        "bestFor": "Materiales y microestructuras con reporte repetible.",
        "outputs": "Metricas, mascaras, CSV y PDF.",
        "deployment": "Web o desktop segun entorno.",
        "readiness": "Piloto aplicado."
      },
      {
        "id": "map-bio",
        "family": "software",
        "methods": [
          "Imaging"
        ],
        "uses": [
          "ID"
        ],
        "image": "/static/gyrosigma.png",
        "alt": "MAP-Bio",
        "title": "MAP-Bio",
        "description": "Conteo, clasificación y morfología para Web/Desktop",
        "tags": [
          "Imaging",
          "Software"
        ],
        "actions": [
          {
            "label": "Ver producto",
            "href": "/product_maps.html",
            "variant": "dark"
          },
          {
            "label": "Ficha rapida",
            "href": "/product_maps.html",
            "variant": "ghost",
            "detailId": "map-bio"
          }
        ],
        "status": {
          "label": "Piloto aplicado",
          "tone": "ready"
        },
        "bestFor": "Conteo, clasificacion y morfologia sobre imagen.",
        "outputs": "Conteo, mascaras y exportables.",
        "deployment": "Web o desktop segun laboratorio.",
        "readiness": "Piloto aplicado."
      },
      {
        "id": "bundle-culture",
        "anchorId": "bundles",
        "family": "bundles",
        "methods": [
          "EIS",
          "Imaging"
        ],
        "uses": [
          "QA",
          "ID"
        ],
        "image": "/static/cultivo_celular_dibujo.png",
        "alt": "EIS + MAP-Bio",
        "title": "EIS + MAP-Bio",
        "description": "Monitoreo de impedancia, conteo y caracterización de cultivos celulares",
        "tags": [
          "Bundle",
          "EIS + Imaging"
        ],
        "actions": [
          {
            "label": "Disenar bundle",
            "href": "/contactUs.html?demo=1",
            "variant": "dark"
          },
          {
            "label": "Ficha rapida",
            "href": "/contactUs.html?demo=1",
            "variant": "ghost",
            "detailId": "bundle-culture"
          }
        ],
        "status": {
          "label": "Bundle guiado",
          "tone": "bundle"
        },
        "bestFor": "Cruzar impedancia e imagen en un mismo flujo.",
        "outputs": "Salida conjunta para lectura experimental.",
        "deployment": "Bundle con integracion de flujo.",
        "readiness": "Piloto orientado a resultado."
      },
      {
        "id": "bundle-toolkit",
        "family": "bundles",
        "methods": [
          "EIS"
        ],
        "uses": [
          "ID",
          "QA"
        ],
        "image": "/static/diagrama_de_bode.gif",
        "alt": "EIS + EIS-Toolkit",
        "title": "EIS + EIS-Toolkit",
        "description": "Medición y fitting reproducible",
        "tags": [
          "Bundle",
          "EIS"
        ],
        "actions": [
          {
            "label": "Cotizar bundle",
            "href": "/contactUs.html?demo=1",
            "variant": "dark"
          },
          {
            "label": "Ficha rapida",
            "href": "/contactUs.html?demo=1",
            "variant": "ghost",
            "detailId": "bundle-toolkit"
          }
        ],
        "status": {
          "label": "Bundle guiado",
          "tone": "bundle"
        },
        "bestFor": "Estandarizar interpretacion y fitting.",
        "outputs": "Curvas, fitting y criterio reproducible.",
        "deployment": "Medicion mas software de lectura.",
        "readiness": "Piloto de repetibilidad."
      }
    ],
    "compare": {
      "title": "Comparador rápido",
      "lead": "Usalo para alinear expectativas antes de pasar a demo, piloto o cotizacion.",
      "columns": [
        "Producto",
        "Metodo",
        "Salida principal",
        "Despliegue",
        "Estado"
      ],
      "rows": [
        [
          "AquaSpecter",
          "EIS",
          "Bode / Nyquist / reportes",
          "Equipo compacto",
          "Piloto asistido"
        ],
        [
          "DLS-Mini",
          "DLS",
          "PSD basico y lectura guiada",
          "Mesa / docencia",
          "Piloto academico"
        ],
        [
          "MAP-Nano",
          "Imaging",
          "CSV / PDF / metricas",
          "Web / Desktop",
          "Piloto aplicado"
        ]
      ]
    },
    "cardLabels": {
      "bestFor": "Ideal para",
      "outputs": "Entrega",
      "deployment": "Despliegue",
      "readiness": "Estado"
    },
    "detailPanel": {
      "badge": "Ficha rapida",
      "close": "Cerrar ficha"
    }
  },
  "en": {
    "hero": {
      "copy": {
        "eyebrow": "BCC Technology",
        "title": "Start from what you need to achieve",
        "signalsAriaLabel": "Quick portfolio indicators",
        "signals": [
          {
            "value": "3",
            "label": "adoption paths"
          },
          {
            "value": "8",
            "label": "active offers"
          },
          {
            "value": "Lab / Web / Device",
            "label": "deployment formats"
          }
        ],
        "actions": [
          {
            "label": "View technology",
            "href": "#catalogo",
            "variant": "dark"
          },
          {
            "label": "Compare",
            "href": "#comparador",
            "variant": "plain"
          }
        ]
      },
      "visual": {
        "badge": "Choose your path",
        "tablistLabel": "Primary technology decision paths",
        "panes": [
          {
            "id": "software",
            "tabLabel": "I want to automate",
            "kicker": "I want to automate",
            "title": "Software that turns analysis into operations",
            "text": "Best when you already have images, datasets, or manual reports and need them to become repeatable and auditable.",
            "actions": [
              {
                "label": "Audit my workflow",
                "href": "/en/contactUs.html",
                "variant": "dark"
              },
              {
                "label": "See open software",
                "href": "/en/science.html",
                "variant": "ghost"
              }
            ],
            "showcase": [
              {
                "href": "/en/product_maps_nano.html",
                "media": "ui",
                "image": "/static/defect.png",
                "alt": "MAP-Nano",
                "title": "MAP-Nano",
                "meta": "Roughness, porosity and morphology"
              },
              {
                "href": "/en/product_maps.html#map-bio",
                "media": "ui",
                "image": "/static/gyrosigma.png",
                "alt": "MAP-Bio",
                "title": "MAP-Bio",
                "meta": "Counting and morphological analysis"
              }
            ],
            "outcomes": [
              "Reproducible analysis",
              "Reports and dashboards",
              "Lab integrations"
            ]
          },
          {
            "id": "instrumentacion",
            "tabLabel": "I want to measure",
            "kicker": "I want to measure",
            "title": "Instrumentation when you need your own signal",
            "text": "Built for teams that need field measurements, validation, or instruments closer to the operation.",
            "actions": [
              {
                "label": "Sponsor development",
                "href": "/en/contactUs.html",
                "variant": "dark"
              },
              {
                "label": "Request early trial",
                "href": "/en/signup.html",
                "variant": "ghost"
              }
            ],
            "showcase": [
              {
                "href": "#catalogo",
                "scrollTarget": "eis",
                "media": "chart",
                "image": "/static/generated_eis.png",
                "alt": "EIS",
                "title": "EIS",
                "meta": "Options for liquids, metals, coatings and batteries"
              },
              {
                "href": "#catalogo",
                "scrollTarget": "dls",
                "media": "illustration",
                "image": "/static/DLS.svg",
                "alt": "DLS-Pro",
                "title": "DLS-Pro",
                "meta": "Characterization of particles suspended in liquids"
              }
            ],
            "outcomes": [
              "Assisted measurement",
              "Experimental integration",
              "Prototypes and pilots"
            ]
          },
          {
            "id": "bundles",
            "tabLabel": "I want to deploy",
            "kicker": "I want to deploy",
            "title": "Bundles designed for faster implementation",
            "text": "We combine hardware, software, and guidance when the priority is shortening time to result.",
            "actions": [
              {
                "label": "Design my bundle",
                "href": "/en/contactUs.html",
                "variant": "dark"
              },
              {
                "label": "Request integrated demo",
                "href": "/en/contactUs.html",
                "variant": "ghost"
              }
            ],
            "showcase": [
              {
                "href": "#catalogo",
                "scrollTarget": "bundles",
                "media": "photo",
                "image": "/static/cultivo_celular.png",
                "alt": "EIS + MAP-Bio",
                "title": "EIS + MAP-Bio",
                "meta": "Analysis and monitoring of cultures"
              },
              {
                "href": "#catalogo",
                "scrollTarget": "bundles",
                "media": "chart",
                "image": "/static/diagrama_de_bode.gif",
                "alt": "EIS + EIS-Toolkit",
                "title": "EIS + EIS-Toolkit",
                "meta": "Measurement + reproducible fitting"
              }
            ],
            "outcomes": [
              "Guided bundle",
              "Faster rollout",
              "Lower operational friction"
            ]
          }
        ]
      }
    },
    "filters": {
      "searchLabel": "Search",
      "searchPlaceholder": "Search by name, method, or tag...",
      "familyLabel": "Family:",
      "familySrLabel": "Family",
      "methodLabel": "Method:",
      "useLabel": "Use:",
      "clearFilters": "Clear filters",
      "selectedLabel": "selected",
      "familyOptions": [
        {
          "value": "all",
          "label": "All"
        },
        {
          "value": "software",
          "label": "Software"
        },
        {
          "value": "instrumentacion",
          "label": "Instrumentation"
        },
        {
          "value": "bundles",
          "label": "Bundles"
        }
      ],
      "methodOptions": [
        {
          "value": "EIS",
          "label": "EIS"
        },
        {
          "value": "DLS",
          "label": "DLS"
        },
        {
          "value": "Imaging",
          "label": "Imaging"
        },
        {
          "value": "Data",
          "label": "Data"
        }
      ],
      "useOptions": [
        {
          "value": "ID",
          "label": "R&D"
        },
        {
          "value": "QA",
          "label": "QA/QC"
        },
        {
          "value": "Teaching",
          "label": "Teaching"
        }
      ]
    },
    "catalogTitle": "Available technology",
    "products": [
      {
        "id": "aqua-specter",
        "anchorId": "eis",
        "family": "instrumentacion",
        "methods": [
          "EIS"
        ],
        "uses": [
          "ID",
          "QA"
        ],
        "image": "/static/render_as.jpg",
        "alt": "AquaSpecter",
        "title": "AquaSpecter",
        "description": "Pocket EIS for simple, frequent analysis",
        "tags": [
          "EIS",
          "Instrument"
        ],
        "actions": [
          {
            "label": "Get quote",
            "href": "/en/contactUs.html?demo=1",
            "variant": "dark"
          },
          {
            "label": "Quick view",
            "href": "/en/contactUs.html?demo=1",
            "variant": "ghost",
            "detailId": "aqua-specter"
          }
        ],
        "status": {
          "label": "Assisted pilot",
          "tone": "pilot"
        },
        "bestFor": "Fast validation and screening.",
        "outputs": "Bode and Nyquist curves ready for reporting.",
        "deployment": "Compact device with guided setup.",
        "readiness": "Pilot by sample."
      },
      {
        "id": "aqua-specter-inline",
        "family": "instrumentacion",
        "methods": [
          "EIS"
        ],
        "uses": [
          "ID",
          "QA"
        ],
        "image": "/static/render_ast.jpg",
        "alt": "Inline AquaSpecter",
        "title": "Inline AquaSpecter",
        "description": "Embedded EIS for continuous liquid-sample analysis",
        "tags": [
          "EIS",
          "Instrument"
        ],
        "actions": [
          {
            "label": "Talk to BCC",
            "href": "/en/contactUs.html?demo=1",
            "variant": "dark"
          },
          {
            "label": "Quick view",
            "href": "/en/contactUs.html?demo=1",
            "variant": "ghost",
            "detailId": "aqua-specter-inline"
          }
        ],
        "status": {
          "label": "Custom build",
          "tone": "custom"
        },
        "bestFor": "Recurring monitoring and process integration.",
        "outputs": "Continuous readout and trends.",
        "deployment": "Case-specific integration for process and sample.",
        "readiness": "Integration project."
      },
      {
        "id": "dls-mini",
        "anchorId": "dls",
        "family": "instrumentacion",
        "methods": [
          "DLS"
        ],
        "uses": [
          "Teaching"
        ],
        "image": "/static/render_dls_mini.jpg",
        "alt": "DLS-Mini",
        "title": "DLS-Mini",
        "description": "Compact for small samples and basic PSD",
        "tags": [
          "DLS",
          "Instrument"
        ],
        "actions": [
          {
            "label": "Request demo",
            "href": "/en/contactUs.html?demo=1",
            "variant": "dark"
          },
          {
            "label": "Quick view",
            "href": "/en/contactUs.html?demo=1",
            "variant": "ghost",
            "detailId": "dls-mini"
          }
        ],
        "status": {
          "label": "Academic pilot",
          "tone": "pilot"
        },
        "bestFor": "Teaching and quick dispersion validation.",
        "outputs": "Basic PSD and guided readout.",
        "deployment": "Benchtop device, easy to move.",
        "readiness": "Academic pilot."
      },
      {
        "id": "science-smartboard",
        "family": "software",
        "methods": [
          "Data"
        ],
        "uses": [
          "ID",
          "QA",
          "Teaching"
        ],
        "featured": true,
        "image": "/static/captura_smartboard_radar.png",
        "alt": "Open science smartboard",
        "title": "Science Smartboard",
        "description": "Open tool to connect widgets and explore scientific data from the Science page.",
        "tags": [
          "Open Tool",
          "Data Intelligence",
          "Free"
        ],
        "actions": [
          {
            "label": "Open Smartboard",
            "href": "/en/science.html",
            "variant": "dark"
          },
          {
            "label": "Quick view",
            "href": "/en/science.html",
            "variant": "ghost",
            "detailId": "science-smartboard"
          }
        ],
        "status": {
          "label": "Open tool",
          "tone": "open"
        },
        "bestFor": "Exploration, teaching, and rapid prototyping.",
        "outputs": "Linked widgets and visual export.",
        "deployment": "Open web experience from Science.",
        "readiness": "Available today."
      },
      {
        "id": "map-nano",
        "family": "software",
        "methods": [
          "Imaging"
        ],
        "uses": [
          "ID",
          "QA"
        ],
        "image": "/static/mapnano.png",
        "alt": "MAP-Nano",
        "title": "MAP-Nano",
        "description": "Roughness, porosity and morphology for Web/Desktop",
        "tags": [
          "Imaging",
          "Software"
        ],
        "actions": [
          {
            "label": "View product",
            "href": "/en/product_maps_nano.html",
            "variant": "dark"
          },
          {
            "label": "Quick view",
            "href": "/en/product_maps_nano.html",
            "variant": "ghost",
            "detailId": "map-nano"
          }
        ],
        "status": {
          "label": "Applied pilot",
          "tone": "ready"
        },
        "bestFor": "Materials and microstructures with repeatable reporting.",
        "outputs": "Metrics, masks, CSV, and PDF.",
        "deployment": "Web or desktop depending on environment.",
        "readiness": "Applied pilot."
      },
      {
        "id": "map-bio",
        "family": "software",
        "methods": [
          "Imaging"
        ],
        "uses": [
          "ID"
        ],
        "image": "/static/gyrosigma.png",
        "alt": "MAP-Bio",
        "title": "MAP-Bio",
        "description": "Counting, classification and morphology for Web/Desktop",
        "tags": [
          "Imaging",
          "Software"
        ],
        "actions": [
          {
            "label": "View product",
            "href": "/en/product_maps.html",
            "variant": "dark"
          },
          {
            "label": "Quick view",
            "href": "/en/product_maps.html",
            "variant": "ghost",
            "detailId": "map-bio"
          }
        ],
        "status": {
          "label": "Applied pilot",
          "tone": "ready"
        },
        "bestFor": "Counting, classification, and morphology on image.",
        "outputs": "Counting, masks, and exports.",
        "deployment": "Web or desktop depending on lab.",
        "readiness": "Applied pilot."
      },
      {
        "id": "bundle-culture",
        "anchorId": "bundles",
        "family": "bundles",
        "methods": [
          "EIS",
          "Imaging"
        ],
        "uses": [
          "QA",
          "ID"
        ],
        "image": "/static/cultivo_celular_dibujo.png",
        "alt": "EIS + MAP-Bio",
        "title": "EIS + MAP-Bio",
        "description": "Impedance monitoring, counting and characterization of cell cultures",
        "tags": [
          "Bundle",
          "EIS + Imaging"
        ],
        "actions": [
          {
            "label": "Design bundle",
            "href": "/en/contactUs.html?demo=1",
            "variant": "dark"
          },
          {
            "label": "Quick view",
            "href": "/en/contactUs.html?demo=1",
            "variant": "ghost",
            "detailId": "bundle-culture"
          }
        ],
        "status": {
          "label": "Guided bundle",
          "tone": "bundle"
        },
        "bestFor": "Cross impedance and imaging in one flow.",
        "outputs": "Combined output for experimental readout.",
        "deployment": "Bundle with workflow integration.",
        "readiness": "Outcome-focused pilot."
      },
      {
        "id": "bundle-toolkit",
        "family": "bundles",
        "methods": [
          "EIS"
        ],
        "uses": [
          "ID",
          "QA"
        ],
        "image": "/static/diagrama_de_bode.gif",
        "alt": "EIS + EIS-Toolkit",
        "title": "EIS + EIS-Toolkit",
        "description": "Measurement and reproducible fitting",
        "tags": [
          "Bundle",
          "EIS"
        ],
        "actions": [
          {
            "label": "Quote bundle",
            "href": "/en/contactUs.html?demo=1",
            "variant": "dark"
          },
          {
            "label": "Quick view",
            "href": "/en/contactUs.html?demo=1",
            "variant": "ghost",
            "detailId": "bundle-toolkit"
          }
        ],
        "status": {
          "label": "Guided bundle",
          "tone": "bundle"
        },
        "bestFor": "Standardize interpretation and fitting.",
        "outputs": "Curves, fitting, and reproducible criteria.",
        "deployment": "Measurement plus readout software.",
        "readiness": "Repeatability pilot."
      }
    ],
    "compare": {
      "title": "Quick comparison",
      "lead": "Use it to align expectations before moving into demo, pilot, or quote.",
      "columns": [
        "Product",
        "Method",
        "Primary output",
        "Deployment",
        "Status"
      ],
      "rows": [
        [
          "AquaSpecter",
          "EIS",
          "Bode / Nyquist / reports",
          "Compact device",
          "Assisted pilot"
        ],
        [
          "DLS-Mini",
          "DLS",
          "Basic PSD and guided readout",
          "Benchtop / teaching",
          "Academic pilot"
        ],
        [
          "MAP-Nano",
          "Imaging",
          "CSV / PDF / metrics",
          "Web / Desktop",
          "Applied pilot"
        ]
      ]
    },
    "cardLabels": {
      "bestFor": "Best for",
      "outputs": "Delivers",
      "deployment": "Deployment",
      "readiness": "Status"
    },
    "detailPanel": {
      "badge": "Quick view",
      "close": "Close quick view"
    }
  }
};
