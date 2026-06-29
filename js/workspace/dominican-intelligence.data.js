(() => {
  /**
   * @typedef {Object} DominicanDataSource
   * @property {string} id
   * @property {string} name
   * @property {string} institution
   * @property {"open_data"|"procurement"|"economy"|"geospatial"|"environment"|"science"|"institutional"} category
   * @property {"api"|"ckan"|"csv"|"xlsx"|"ods"|"wms"|"wmts"|"wfs"|"csw"|"web_portal"|"manual"} sourceType
   * @property {string} url
   * @property {"active"|"partial"|"unknown"|"planned"} status
   * @property {"high"|"medium"|"low"} strategicValue
   * @property {string[]} bccRelevance
   * @property {string} notes
   * @property {string=} lastChecked
   */

  /**
   * @typedef {Object} DominicanSignal
   * @property {string} id
   * @property {string} title
   * @property {string} sourceId
   * @property {"opportunity"|"dataset"|"procurement"|"policy"|"economic"|"geospatial"|"environmental"|"institutional"} category
   * @property {number} relevanceScore
   * @property {"low"|"medium"|"high"} urgency
   * @property {string} summary
   * @property {string=} suggestedAction
   * @property {string} detectedAt
   */

  /**
   * @typedef {Object} DominicanInstitution
   * @property {string} id
   * @property {string} name
   * @property {"ministry"|"agency"|"superintendency"|"municipality"|"university"|"public_company"|"international"} kind
   * @property {string} sector
   * @property {"high"|"medium"|"low"} relevanceToBCC
   * @property {string} notes
   */

  /** @type {DominicanDataSource[]} */
  const dataSources = [
    {
      id: "datos-gob-do",
      name: "Portal Nacional de Datos Abiertos / datos.gob.do",
      institution: "Gobierno de la República Dominicana",
      category: "open_data",
      sourceType: "ckan",
      url: "https://datos.gob.do/",
      status: "active",
      strategicValue: "high",
      bccRelevance: ["dataset discovery", "public sector mapping", "automation opportunities"],
      notes: "National open data catalog; useful as a dataset discovery layer.",
      lastChecked: "2026-06-20"
    },
    {
      id: "dgcp-datacompras",
      name: "DGCP / DataCompras RD",
      institution: "Dirección General de Contrataciones Públicas",
      category: "procurement",
      sourceType: "web_portal",
      url: "https://www.dgcp.gob.do/",
      status: "partial",
      strategicValue: "high",
      bccRelevance: ["public procurement", "B2B opportunities", "supplier intelligence"],
      notes: "Public procurement, tenders, contracts, suppliers, buying units; very relevant for B2B opportunity detection.",
      lastChecked: "2026-06-20"
    },
    {
      id: "bcrd",
      name: "Banco Central de la República Dominicana",
      institution: "Banco Central de la República Dominicana",
      category: "economy",
      sourceType: "web_portal",
      url: "https://www.bancentral.gov.do/",
      status: "partial",
      strategicValue: "medium",
      bccRelevance: ["macro context", "tourism signals", "inflation monitoring"],
      notes: "Macroeconomic indicators, monetary, external sector, tourism, labor and inflation data.",
      lastChecked: "2026-06-18"
    },
    {
      id: "iderd-geoportal",
      name: "IDERD / Geoportal",
      institution: "Infraestructura de Datos Espaciales de la República Dominicana",
      category: "geospatial",
      sourceType: "wms",
      url: "https://www.iderd.gob.do/",
      status: "unknown",
      strategicValue: "medium",
      bccRelevance: ["geospatial layers", "territorial analysis", "infrastructure context"],
      notes: "Official geospatial layers and OGC services.",
      lastChecked: "2026-06-17"
    },
    {
      id: "one",
      name: "Oficina Nacional de Estadística / ONE",
      institution: "Oficina Nacional de Estadística",
      category: "economy",
      sourceType: "xlsx",
      url: "https://www.one.gob.do/",
      status: "partial",
      strategicValue: "medium",
      bccRelevance: ["population", "education", "poverty", "geostatistics"],
      notes: "Population, education, poverty, services and geostatistics.",
      lastChecked: "2026-06-17"
    },
    {
      id: "aduanas",
      name: "Dirección General de Aduanas",
      institution: "Dirección General de Aduanas",
      category: "economy",
      sourceType: "xlsx",
      url: "https://www.aduanas.gob.do/",
      status: "unknown",
      strategicValue: "medium",
      bccRelevance: ["imports", "exports", "equipment signals", "industrial demand"],
      notes: "Import/export and trade data; useful to detect industrial and equipment signals.",
      lastChecked: "2026-06-16"
    },
    {
      id: "sib",
      name: "Superintendencia de Bancos",
      institution: "Superintendencia de Bancos",
      category: "economy",
      sourceType: "api",
      url: "https://sb.gob.do/",
      status: "planned",
      strategicValue: "medium",
      bccRelevance: ["financial system statistics", "sector health", "credit context"],
      notes: "Financial system statistics.",
      lastChecked: "2026-06-15"
    },
    {
      id: "nasa-earthdata",
      name: "NASA Earthdata",
      institution: "NASA",
      category: "environment",
      sourceType: "api",
      url: "https://www.earthdata.nasa.gov/",
      status: "planned",
      strategicValue: "medium",
      bccRelevance: ["satellite data", "environmental monitoring", "territorial analysis"],
      notes: "Satellite and Earth observation data for environmental and territorial analysis.",
      lastChecked: "2026-06-14"
    },
    {
      id: "copernicus",
      name: "Copernicus Data Space",
      institution: "European Space Agency / European Union",
      category: "environment",
      sourceType: "api",
      url: "https://dataspace.copernicus.eu/",
      status: "planned",
      strategicValue: "medium",
      bccRelevance: ["Sentinel data", "geospatial analysis", "environmental overlays"],
      notes: "Sentinel satellite data and geospatial analysis potential.",
      lastChecked: "2026-06-14"
    }
  ];

  /** @type {DominicanInstitution[]} */
  const institutions = [
    { id: "micm", name: "Ministerio de Industria, Comercio y Mipymes", kind: "ministry", sector: "Industry and commerce", relevanceToBCC: "high", notes: "Potential signals for innovation, manufacturing, SMEs and industrial programs." },
    { id: "mescyt", name: "Ministerio de Educación Superior, Ciencia y Tecnología", kind: "ministry", sector: "Science and higher education", relevanceToBCC: "high", notes: "Relevant for research, grants, universities and scientific capacity." },
    { id: "dgcp", name: "Dirección General de Contrataciones Públicas", kind: "agency", sector: "Procurement", relevanceToBCC: "high", notes: "Core source for public tenders, contracts and institutional demand." },
    { id: "one-inst", name: "Oficina Nacional de Estadística", kind: "agency", sector: "Statistics", relevanceToBCC: "medium", notes: "Population, social and economic datasets for market context." },
    { id: "sib-inst", name: "Superintendencia de Bancos", kind: "superintendency", sector: "Financial system", relevanceToBCC: "medium", notes: "Financial sector statistics and systemic context." },
    { id: "uasd", name: "Universidad Autónoma de Santo Domingo", kind: "university", sector: "Higher education", relevanceToBCC: "medium", notes: "Potential research, training and institutional partnership channel." },
    { id: "santiago", name: "Ayuntamiento de Santiago", kind: "municipality", sector: "Municipal government", relevanceToBCC: "medium", notes: "Municipal modernization, territorial signals and smart city opportunities." },
    { id: "edesur", name: "Edesur Dominicana", kind: "public_company", sector: "Electricity distribution", relevanceToBCC: "medium", notes: "Infrastructure, grid modernization and public company procurement context." },
    { id: "iadb", name: "Banco Interamericano de Desarrollo", kind: "international", sector: "Development finance", relevanceToBCC: "medium", notes: "Regional projects, public modernization and funding signals." }
  ];

  /** @type {DominicanSignal[]} */
  const signals = [
    {
      id: "sig-procurement-lab-equipment",
      title: "Potential public demand for laboratory and technical equipment",
      sourceId: "dgcp-datacompras",
      category: "procurement",
      relevanceScore: 88,
      urgency: "high",
      summary: "Procurement monitoring should prioritize tenders mentioning laboratory, microscopy, metrology, scientific equipment and technical training.",
      suggestedAction: "Prepare DGCP keyword monitor and supplier/competitor watchlist for BCC-relevant categories.",
      detectedAt: "2026-06-25"
    },
    {
      id: "sig-open-data-discovery",
      title: "Open data catalog can seed a national source registry",
      sourceId: "datos-gob-do",
      category: "dataset",
      relevanceScore: 76,
      urgency: "medium",
      summary: "datos.gob.do can act as the first discovery layer for datasets before specialized connectors are added.",
      suggestedAction: "Create CKAN connector and classify datasets by institution, update date, format and BCC relevance.",
      detectedAt: "2026-06-22"
    },
    {
      id: "sig-trade-equipment",
      title: "Trade data may reveal industrial equipment cycles",
      sourceId: "aduanas",
      category: "economic",
      relevanceScore: 68,
      urgency: "medium",
      summary: "Import/export statistics can help detect demand for scientific instruments, industrial inputs and equipment categories.",
      suggestedAction: "Map customs categories related to microscopy, lab supplies, sensors and production equipment.",
      detectedAt: "2026-06-21"
    },
    {
      id: "sig-geospatial-stack",
      title: "Geospatial services could support territorial intelligence products",
      sourceId: "iderd-geoportal",
      category: "geospatial",
      relevanceScore: 63,
      urgency: "medium",
      summary: "IDERD and satellite sources can support overlays for infrastructure, protected areas, land use and site context.",
      suggestedAction: "Inventory available OGC layers and define minimum viable map component requirements.",
      detectedAt: "2026-06-20"
    },
    {
      id: "sig-environment-monitoring",
      title: "Satellite environmental monitoring is structurally relevant",
      sourceId: "nasa-earthdata",
      category: "environmental",
      relevanceScore: 58,
      urgency: "low",
      summary: "Earth observation sources can become future signals for water, vegetation, air quality proxies, fires and climate context.",
      suggestedAction: "Start with source catalog and avoid live claims until connector validation is complete.",
      detectedAt: "2026-06-19"
    },
    {
      id: "sig-policy-science",
      title: "Science and higher education institutions matter for BCC partnerships",
      sourceId: "one",
      category: "institutional",
      relevanceScore: 54,
      urgency: "low",
      summary: "Institutional tracking should include ministries, universities and development organizations, not only ministries.",
      suggestedAction: "Build an institution relevance taxonomy and link it to signal scoring.",
      detectedAt: "2026-06-18"
    }
  ];

  const economyPlaceholders = [
    { label: "Inflation / prices", value: "Placeholder", note: "Future BCRD/ONE connector" },
    { label: "Exchange rate", value: "Placeholder", note: "Future BCRD connector" },
    { label: "Tourism", value: "Placeholder", note: "Future BCRD sector series" },
    { label: "Imports / exports", value: "Placeholder", note: "Future Aduanas mapping" },
    { label: "Financial system", value: "Placeholder", note: "Future SIB statistics" }
  ];

  const territoryCards = [
    { label: "IDERD layers", value: "Planned", note: "OGC service inventory" },
    { label: "Administrative boundaries", value: "Planned", note: "ONE / geoportal mapping" },
    { label: "Infrastructure layers", value: "Planned", note: "Roads, ports, energy, facilities" },
    { label: "Satellite sources", value: "Planned", note: "NASA and Copernicus" },
    { label: "Environmental overlays", value: "Planned", note: "Protected areas, water, fire, climate" }
  ];

  const environmentCards = [
    { label: "Air quality", value: "Planned", note: "Future sensor/satellite proxies" },
    { label: "Water", value: "Planned", note: "Watersheds, flood and quality context" },
    { label: "Protected areas", value: "Planned", note: "Territorial overlays and restrictions" },
    { label: "Forest fires", value: "Planned", note: "NASA FIRMS-style connector candidate" },
    { label: "Climate/satellite indicators", value: "Planned", note: "Earth observation pipeline" }
  ];

  window.BCCWorkspaceDominicanData = {
    dataSources,
    institutions,
    signals,
    economyPlaceholders,
    territoryCards,
    environmentCards
  };
})();
