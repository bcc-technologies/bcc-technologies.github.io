(() => {
  const PANELS = ["overview", "sources", "market", "economy", "territory", "institutions", "environment", "radar"];
  const CATEGORY_LABELS = {
    open_data: "Open data",
    procurement: "Procurement",
    economy: "Economy",
    geospatial: "Geospatial",
    environment: "Environment",
    science: "Science",
    institutional: "Institutional",
    opportunity: "Opportunity",
    dataset: "Dataset",
    policy: "Policy",
    economic: "Economic",
    environmental: "Environmental"
  };
  const SOURCE_TYPE_LABELS = {
    api: "API",
    ckan: "CKAN",
    csv: "CSV",
    xlsx: "XLSX",
    ods: "ODS",
    wms: "WMS",
    wmts: "WMTS",
    wfs: "WFS",
    csw: "CSW",
    web_portal: "Web portal",
    manual: "Manual"
  };
  const STATUS_LABELS = {
    active: "Active",
    partial: "Partial",
    unknown: "Unknown",
    planned: "Planned"
  };
  const VALUE_LABELS = {
    high: "High",
    medium: "Medium",
    low: "Low"
  };
  const KIND_LABELS = {
    ministry: "Ministry",
    agency: "Agency",
    superintendency: "Superintendency",
    municipality: "Municipality",
    university: "University",
    public_company: "Public company",
    international: "International"
  };

  let root = null;
  let currentPanel = "overview";
  let sourceFilters = { query: "", category: "", sourceType: "", status: "", strategicValue: "" };
  let institutionFilters = { kind: "", relevance: "" };
  let radarFilters = { category: "", urgency: "", minScore: 0 };

  function init() {
    root = document.querySelector("[data-dominican-intelligence-workspace]");
    if (!root || root.dataset.ready === "true") return;
    root.dataset.ready = "true";
    renderShell();
    bindControls();
    renderAll();
  }

  function data() {
    return window.BCCWorkspaceDominicanData || {
      dataSources: [],
      institutions: [],
      signals: [],
      economyPlaceholders: [],
      territoryCards: [],
      environmentCards: []
    };
  }

  function renderShell() {
    root.innerHTML = `
      <section class="users-surface intelligence-surface dominican-intelligence-surface">
        <div class="surface-toolbar intelligence-toolbar">
          <div>
            <h2>Dominican Intelligence</h2>
            <p class="muted-text">External intelligence hub for Dominican data sources, institutions, public market signals, territory, economy, environment, and BCC opportunities.</p>
          </div>
          <div class="intelligence-toolbar-copy">
            <span class="intelligence-kicker">Mock v1</span>
            <small class="muted-text">Prepared for future connectors.</small>
          </div>
        </div>
        <nav class="intelligence-nav" aria-label="Dominican Intelligence tabs">
          ${PANELS.map(panel => `
            <button class="intelligence-nav-chip${panel === currentPanel ? " is-active" : ""}" type="button" data-dominican-panel-target="${escapeHtml(panel)}">
              ${escapeHtml(panelLabel(panel))}
            </button>
          `).join("")}
        </nav>
        <section class="intelligence-panels">
          ${PANELS.map(panel => `<section class="intelligence-panel${panel === currentPanel ? "" : " is-hidden"}" data-dominican-panel="${escapeHtml(panel)}"></section>`).join("")}
        </section>
      </section>
    `;
    refreshIcons();
  }

  function bindControls() {
    root.addEventListener("click", event => {
      const tab = event.target.closest("[data-dominican-panel-target]");
      if (!tab) return;
      currentPanel = tab.dataset.dominicanPanelTarget || "overview";
      syncPanels();
    });

    root.addEventListener("input", handleFilterInput);
    root.addEventListener("change", handleFilterInput);
  }

  function handleFilterInput(event) {
    const target = event.target;
    if (!target?.dataset) return;
    const sourceKey = target.dataset.dominicanSourceFilter;
    const institutionKey = target.dataset.dominicanInstitutionFilter;
    const radarKey = target.dataset.dominicanRadarFilter;

    if (sourceKey) {
      sourceFilters[sourceKey] = target.value || "";
      renderSourcesPanel();
      restoreFilterFocus(`data-dominican-source-filter`, sourceKey);
    }
    if (institutionKey) {
      institutionFilters[institutionKey] = target.value || "";
      renderInstitutionsPanel();
      restoreFilterFocus(`data-dominican-institution-filter`, institutionKey);
    }
    if (radarKey) {
      radarFilters[radarKey] = radarKey === "minScore" ? Number(target.value || 0) : (target.value || "");
      renderRadarPanel();
      restoreFilterFocus(`data-dominican-radar-filter`, radarKey);
    }
  }

  function restoreFilterFocus(attribute, key) {
    const control = root.querySelector(`[${attribute}="${key}"]`);
    if (!control) return;
    control.focus();
    if (typeof control.setSelectionRange === "function") {
      const length = String(control.value || "").length;
      control.setSelectionRange(length, length);
    }
  }

  function syncPanels() {
    root.querySelectorAll("[data-dominican-panel-target]").forEach(button => {
      button.classList.toggle("is-active", button.dataset.dominicanPanelTarget === currentPanel);
    });
    root.querySelectorAll("[data-dominican-panel]").forEach(panel => {
      panel.classList.toggle("is-hidden", panel.dataset.dominicanPanel !== currentPanel);
    });
    renderPanel(currentPanel);
    refreshIcons();
  }

  function renderAll() {
    PANELS.forEach(renderPanel);
    refreshIcons();
  }

  function renderPanel(panel) {
    if (panel === "overview") renderOverviewPanel();
    if (panel === "sources") renderSourcesPanel();
    if (panel === "market") renderMarketPanel();
    if (panel === "economy") renderEconomyPanel();
    if (panel === "territory") renderTerritoryPanel();
    if (panel === "institutions") renderInstitutionsPanel();
    if (panel === "environment") renderEnvironmentPanel();
    if (panel === "radar") renderRadarPanel();
  }

  function renderOverviewPanel() {
    const target = panel("overview");
    const { dataSources, signals } = data();
    const activeSources = dataSources.filter(item => item.status === "active").length;
    const highValue = dataSources.filter(item => item.strategicValue === "high").length;
    const procurementSignals = signals.filter(item => item.category === "procurement" || item.category === "opportunity").length;
    const geospatialLayers = dataSources.filter(item => ["geospatial", "environment"].includes(item.category)).length;
    const datasets = dataSources.filter(item => ["ckan", "csv", "xlsx", "ods"].includes(item.sourceType)).length;
    const topSignals = signals.slice().sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 5);
    const highSources = dataSources.filter(item => item.strategicValue === "high");

    target.innerHTML = `
      <section class="workspace-metrics intelligence-metrics" aria-label="Dominican Intelligence summary">
        ${metric("Active sources", activeSources, "Validated or usable")}
        ${metric("High-value sources", highValue, "Strategic registry")}
        ${metric("Signals detected", signals.length, "Mock signal set")}
        ${metric("Public market opportunities", procurementSignals, "Procurement/B2B")}
        ${metric("Geospatial layers", geospatialLayers, "Territory and environment")}
        ${metric("Datasets monitored", datasets, "Catalog/file sources")}
      </section>
      <section class="analytics-grid">
        <article class="activity-surface analytics-card analytics-card-wide">
          <div class="activity-head"><h3>Top Signals</h3><span>${topSignals.length}</span></div>
          ${signalTable(topSignals, { compact: true })}
        </article>
        <article class="activity-surface analytics-card">
          <div class="activity-head"><h3>High-value Sources</h3><span>${highSources.length}</span></div>
          ${sourceTable(highSources, { compact: true })}
        </article>
        <article class="activity-surface analytics-card">
          <div class="activity-head"><h3>Executive note</h3><span>v1</span></div>
          <div class="intelligence-focus-list">
            <div class="intelligence-focus-item">
              <span>Purpose</span>
              <strong>Dominican Intelligence converts public, economic, territorial, institutional and environmental data about the Dominican Republic into actionable signals for BCC.</strong>
              <p>This v1 uses centralized mock data and connector-ready structure. No live API claims are made yet.</p>
            </div>
          </div>
        </article>
      </section>
    `;
  }

  function renderSourcesPanel() {
    const target = panel("sources");
    const sources = filteredSources();
    target.innerHTML = `
      <section class="users-surface">
        <div class="surface-toolbar">
          <div>
            <h2>Data Sources</h2>
            <p class="muted-text">${sources.length} source(s) matching the current filters.</p>
          </div>
          ${sourceFiltersMarkup()}
        </div>
        ${sourceTable(sources)}
      </section>
      <section class="analytics-domain-grid dominican-source-cards">
        ${sources.map(sourceDetailCard).join("")}
      </section>
    `;
  }

  function renderMarketPanel() {
    const target = panel("market");
    const { signals, institutions } = data();
    const procurementSignals = signals.filter(item => ["procurement", "opportunity"].includes(item.category));
    target.innerHTML = `
      <section class="workspace-metrics intelligence-metrics" aria-label="Public market metrics">
        ${metric("Tenders monitored", "Placeholder", "Future DGCP connector")}
        ${metric("Relevant institutions", institutions.filter(item => item.relevanceToBCC === "high").length, "High relevance")}
        ${metric("Potential opportunities", procurementSignals.length, "Mock signals")}
        ${metric("Supplier/competitor signals", "Planned", "Future watchlist")}
      </section>
      <section class="analytics-grid">
        <article class="activity-surface analytics-card analytics-card-wide">
          <div class="activity-head"><h3>Procurement-related signals</h3><span>${procurementSignals.length}</span></div>
          ${signalTable(procurementSignals)}
        </article>
        <article class="activity-surface analytics-card analytics-card-wide">
          <div class="intelligence-focus-item">
            <span>Future connector</span>
            <strong>DGCP / DataCompras RD opportunity scoring</strong>
            <p>This tab will eventually connect to DGCP/DataCompras RD and score opportunities for BCC based on keywords, sector, institution, recency and actionability.</p>
          </div>
        </article>
      </section>
    `;
  }

  function renderEconomyPanel() {
    const target = panel("economy");
    const { economyPlaceholders } = data();
    const sources = data().dataSources.filter(item => ["bcrd", "aduanas", "one", "sib"].includes(item.id));
    target.innerHTML = `
      <section class="workspace-metrics intelligence-metrics" aria-label="Economy placeholders">
        ${economyPlaceholders.map(item => metric(item.label, item.value, item.note)).join("")}
      </section>
      <section class="analytics-grid">
        <article class="activity-surface analytics-card analytics-card-wide">
          <div class="activity-head"><h3>Source mapping</h3><span>Placeholder values</span></div>
          <p class="muted-text">Values shown here are placeholders only. No live economic data is being fetched in v1.</p>
          ${sourceTable(sources, { compact: true })}
        </article>
      </section>
    `;
  }

  function renderTerritoryPanel() {
    const target = panel("territory");
    const { territoryCards } = data();
    const sources = data().dataSources.filter(item => ["iderd-geoportal", "one", "nasa-earthdata", "copernicus"].includes(item.id));
    target.innerHTML = `
      <section class="workspace-metrics intelligence-metrics" aria-label="Territory readiness">
        ${territoryCards.map(item => metric(item.label, item.value, item.note)).join("")}
      </section>
      <section class="analytics-grid">
        <article class="activity-surface analytics-card analytics-card-wide">
          <div class="activity-head"><h3>Future map component</h3><span>Prepared</span></div>
          <div class="intelligence-focus-item">
            <span>Map placeholder</span>
            <strong>Geospatial intelligence stage</strong>
            <p>Future version can connect OGC services, administrative boundaries, infrastructure layers and satellite overlays. No complex map is implemented in v1.</p>
          </div>
        </article>
        <article class="activity-surface analytics-card analytics-card-wide">
          <div class="activity-head"><h3>Source mapping</h3><span>${sources.length}</span></div>
          ${sourceTable(sources, { compact: true })}
        </article>
      </section>
    `;
  }

  function renderInstitutionsPanel() {
    const target = panel("institutions");
    const institutions = filteredInstitutions();
    target.innerHTML = `
      <section class="users-surface">
        <div class="surface-toolbar">
          <div>
            <h2>Institutions</h2>
            <p class="muted-text">${institutions.length} institution(s) matching the current filters.</p>
          </div>
          ${institutionFiltersMarkup()}
        </div>
        <div class="table-scroll">
          <table class="account-table">
            <thead><tr><th>Name</th><th>Type</th><th>Sector</th><th>Relevance</th><th>Notes</th></tr></thead>
            <tbody>
              ${institutions.length ? institutions.map(institutionRow).join("") : `<tr><td class="table-empty" colspan="5">No institutions match the filters.</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function renderEnvironmentPanel() {
    const target = panel("environment");
    const { environmentCards, signals } = data();
    const environmentalSignals = signals.filter(item => item.category === "environmental" || item.category === "geospatial");
    target.innerHTML = `
      <section class="workspace-metrics intelligence-metrics" aria-label="Environment placeholders">
        ${environmentCards.map(item => metric(item.label, item.value, item.note)).join("")}
      </section>
      <section class="analytics-grid">
        <article class="activity-surface analytics-card analytics-card-wide">
          <div class="activity-head"><h3>Environment signals</h3><span>${environmentalSignals.length}</span></div>
          ${signalTable(environmentalSignals)}
        </article>
        <article class="activity-surface analytics-card analytics-card-wide">
          <div class="intelligence-focus-item">
            <span>Future connectors</span>
            <strong>Environmental, climate, water, air, fire and satellite intelligence</strong>
            <p>v1 prepares the structure for source validation. Future connectors may include Earth observation APIs, official environmental datasets and geospatial overlays.</p>
          </div>
        </article>
      </section>
    `;
  }

  function renderRadarPanel() {
    const target = panel("radar");
    const signals = filteredSignals();
    target.innerHTML = `
      <section class="users-surface">
        <div class="surface-toolbar">
          <div>
            <h2>Radar</h2>
            <p class="muted-text">${signals.length} signal(s) matching the current filters.</p>
          </div>
          ${radarFiltersMarkup()}
        </div>
        ${signalTable(signals)}
      </section>
      <section class="activity-surface analytics-card analytics-card-wide">
        <div class="activity-head"><h3>Scoring explanation</h3><span>Mock v1</span></div>
        <p class="muted-text">BCC relevance score considers keyword match, institution relevance, sector relevance, procurement value, scientific/technical proximity, recency and actionability.</p>
      </section>
    `;
  }

  function sourceFiltersMarkup() {
    return `
      <div class="surface-filters" aria-label="Filter data sources">
        <label class="surface-mobile-search"><i data-lucide="search"></i><input type="search" value="${escapeAttr(sourceFilters.query)}" data-dominican-source-filter="query" placeholder="Search sources..." /></label>
        ${selectFilter("Category", "category", sourceFilters.category, uniqueOptions(data().dataSources, "category", CATEGORY_LABELS), "dominican-source")}
        ${selectFilter("Type", "sourceType", sourceFilters.sourceType, uniqueOptions(data().dataSources, "sourceType", SOURCE_TYPE_LABELS), "dominican-source")}
        ${selectFilter("Status", "status", sourceFilters.status, uniqueOptions(data().dataSources, "status", STATUS_LABELS), "dominican-source")}
        ${selectFilter("Value", "strategicValue", sourceFilters.strategicValue, uniqueOptions(data().dataSources, "strategicValue", VALUE_LABELS), "dominican-source")}
      </div>
    `;
  }

  function institutionFiltersMarkup() {
    return `
      <div class="surface-filters" aria-label="Filter institutions">
        ${selectFilter("Type", "kind", institutionFilters.kind, uniqueOptions(data().institutions, "kind", KIND_LABELS), "dominican-institution")}
        ${selectFilter("Relevance", "relevance", institutionFilters.relevance, uniqueOptions(data().institutions, "relevanceToBCC", VALUE_LABELS), "dominican-institution")}
      </div>
    `;
  }

  function radarFiltersMarkup() {
    return `
      <div class="surface-filters" aria-label="Filter radar signals">
        ${selectFilter("Category", "category", radarFilters.category, uniqueOptions(data().signals, "category", CATEGORY_LABELS), "dominican-radar")}
        ${selectFilter("Urgency", "urgency", radarFilters.urgency, uniqueOptions(data().signals, "urgency", VALUE_LABELS), "dominican-radar")}
        <label class="analytics-range-field"><span>Min score</span><input type="number" min="0" max="100" value="${escapeAttr(radarFilters.minScore)}" data-dominican-radar-filter="minScore" /></label>
      </div>
    `;
  }

  function selectFilter(label, key, value, options, prefix) {
    return `
      <label class="analytics-range-field">
        <span>${escapeHtml(label)}</span>
        <select data-${prefix}-filter="${escapeAttr(key)}">
          <option value="">All</option>
          ${options.map(option => `<option value="${escapeAttr(option.value)}" ${option.value === value ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
        </select>
      </label>
    `;
  }

  function sourceTable(sources, options = {}) {
    const compact = Boolean(options.compact);
    return `
      <div class="table-scroll analytics-table-wrap">
        <table class="account-table analytics-table">
          <thead>
            <tr>
              <th>Source</th><th>Institution</th><th>Category</th><th>Type</th><th>Status</th><th>Strategic value</th>${compact ? "" : "<th>BCC relevance</th><th>Last checked</th>"}
            </tr>
          </thead>
          <tbody>
            ${sources.length ? sources.map(source => sourceRow(source, compact)).join("") : `<tr><td class="table-empty" colspan="${compact ? 6 : 8}">No sources match the filters.</td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  }

  function sourceRow(source, compact = false) {
    return `
      <tr>
        <td data-label="Source"><strong>${escapeHtml(source.name)}</strong><small>${escapeHtml(source.url)}</small></td>
        <td data-label="Institution">${escapeHtml(source.institution)}</td>
        <td data-label="Category">${escapeHtml(labelFor(source.category, CATEGORY_LABELS))}</td>
        <td data-label="Type">${escapeHtml(labelFor(source.sourceType, SOURCE_TYPE_LABELS))}</td>
        <td data-label="Status">${escapeHtml(labelFor(source.status, STATUS_LABELS))}</td>
        <td data-label="Strategic value">${escapeHtml(labelFor(source.strategicValue, VALUE_LABELS))}</td>
        ${compact ? "" : `<td data-label="BCC relevance">${escapeHtml(source.bccRelevance.join(", "))}</td><td data-label="Last checked">${escapeHtml(formatDate(source.lastChecked))}</td>`}
      </tr>
    `;
  }

  function sourceDetailCard(source) {
    return `
      <article class="activity-surface analytics-card">
        <div class="activity-head"><h3>${escapeHtml(source.name)}</h3><span>${escapeHtml(labelFor(source.status, STATUS_LABELS))}</span></div>
        <p class="muted-text">${escapeHtml(source.notes)}</p>
        <div class="analytics-domain-metrics">
          <div class="analytics-domain-metric"><span>Type</span><strong>${escapeHtml(labelFor(source.sourceType, SOURCE_TYPE_LABELS))}</strong></div>
          <div class="analytics-domain-metric"><span>Value</span><strong>${escapeHtml(labelFor(source.strategicValue, VALUE_LABELS))}</strong></div>
        </div>
      </article>
    `;
  }

  function signalTable(signals, options = {}) {
    const compact = Boolean(options.compact);
    return `
      <div class="table-scroll analytics-table-wrap">
        <table class="account-table analytics-table">
          <thead>
            <tr><th>Title</th><th>Category</th><th>Source</th><th>Score</th><th>Urgency</th><th>Summary</th>${compact ? "" : "<th>Suggested action</th><th>Detected</th>"}</tr>
          </thead>
          <tbody>
            ${signals.length ? signals.map(signal => signalRow(signal, compact)).join("") : `<tr><td class="table-empty" colspan="${compact ? 6 : 8}">No signals match the filters.</td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  }

  function signalRow(signal, compact = false) {
    const source = data().dataSources.find(item => item.id === signal.sourceId);
    return `
      <tr>
        <td data-label="Title"><strong>${escapeHtml(signal.title)}</strong></td>
        <td data-label="Category">${escapeHtml(labelFor(signal.category, CATEGORY_LABELS))}</td>
        <td data-label="Source">${escapeHtml(source?.name || signal.sourceId)}</td>
        <td data-label="Score">${escapeHtml(signal.relevanceScore)}</td>
        <td data-label="Urgency">${escapeHtml(labelFor(signal.urgency, VALUE_LABELS))}</td>
        <td data-label="Summary">${escapeHtml(signal.summary)}</td>
        ${compact ? "" : `<td data-label="Suggested action">${escapeHtml(signal.suggestedAction || "-")}</td><td data-label="Detected">${escapeHtml(formatDate(signal.detectedAt))}</td>`}
      </tr>
    `;
  }

  function institutionRow(institution) {
    return `
      <tr>
        <td data-label="Name"><strong>${escapeHtml(institution.name)}</strong></td>
        <td data-label="Type">${escapeHtml(labelFor(institution.kind, KIND_LABELS))}</td>
        <td data-label="Sector">${escapeHtml(institution.sector)}</td>
        <td data-label="Relevance">${escapeHtml(labelFor(institution.relevanceToBCC, VALUE_LABELS))}</td>
        <td data-label="Notes">${escapeHtml(institution.notes)}</td>
      </tr>
    `;
  }

  function filteredSources() {
    const query = sourceFilters.query.trim().toLowerCase();
    return data().dataSources.filter(source => {
      const searchable = [source.name, source.institution, source.notes, ...source.bccRelevance].join(" ").toLowerCase();
      if (query && !searchable.includes(query)) return false;
      if (sourceFilters.category && source.category !== sourceFilters.category) return false;
      if (sourceFilters.sourceType && source.sourceType !== sourceFilters.sourceType) return false;
      if (sourceFilters.status && source.status !== sourceFilters.status) return false;
      if (sourceFilters.strategicValue && source.strategicValue !== sourceFilters.strategicValue) return false;
      return true;
    });
  }

  function filteredInstitutions() {
    return data().institutions.filter(institution => {
      if (institutionFilters.kind && institution.kind !== institutionFilters.kind) return false;
      if (institutionFilters.relevance && institution.relevanceToBCC !== institutionFilters.relevance) return false;
      return true;
    });
  }

  function filteredSignals() {
    return data().signals.filter(signal => {
      if (radarFilters.category && signal.category !== radarFilters.category) return false;
      if (radarFilters.urgency && signal.urgency !== radarFilters.urgency) return false;
      if (Number(signal.relevanceScore) < Number(radarFilters.minScore || 0)) return false;
      return true;
    }).sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  function uniqueOptions(items, key, labels) {
    return [...new Set(items.map(item => item[key]).filter(Boolean))]
      .sort()
      .map(value => ({ value, label: labelFor(value, labels) }));
  }

  function metric(label, value, note) {
    return `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></div>`;
  }

  function panel(name) {
    return root.querySelector(`[data-dominican-panel="${name}"]`);
  }

  function panelLabel(panel) {
    return {
      overview: "Overview",
      sources: "Data Sources",
      market: "Public Market",
      economy: "Economy",
      territory: "Territory",
      institutions: "Institutions",
      environment: "Environment",
      radar: "Radar"
    }[panel] || panel;
  }

  function labelFor(value, labels) {
    return labels[value] || String(value || "").replaceAll("_", " ");
  }

  function formatDate(value) {
    return window.BCCWorkspaceUtils.formatDate(value, { empty: "-" });
  }

  function escapeHtml(value) {
    return window.BCCWorkspaceUtils.escapeHtml(value);
  }

  function escapeAttr(value) {
    return window.BCCWorkspaceUtils.escapeAttr(value);
  }

  function refreshIcons() {
    window.BCCWorkspaceUtils.refreshIcons(root);
  }

  window.BCCWorkspaceDominicanIntelligence = { init };
})();
