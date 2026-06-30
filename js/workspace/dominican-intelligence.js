(() => {
  const PANELS = ["overview", "sources", "institutions", "market", "economy", "demographics", "territory", "policy", "radar"];
  const CATEGORY_LABELS = {
    open_data: "Open data", government_api: "Government API", procurement: "Procurement", economy: "Economy", finance: "Finance", trade: "Trade", statistics: "Statistics", demographics: "Demographics", geospatial: "Geospatial", environment: "Environment", satellite: "Satellite", regulation: "Regulation", policy: "Policy", science: "Science", institutional: "Institutional", opportunity: "Opportunity", dataset: "Dataset", economic: "Economic", environmental: "Environmental", regulation_policy: "Regulation / policy", anomaly: "Anomaly", source_health: "Source health"
  };
  const SOURCE_TYPE_LABELS = { api: "API", ckan: "CKAN", csv: "CSV", xlsx: "XLSX", ods: "ODS", wms: "WMS", wmts: "WMTS", wfs: "WFS", csw: "CSW", web_portal: "Web portal", document: "Document", manual: "Manual", satellite_api: "Satellite API" };
  const STATUS_LABELS = { active: "Active", partial: "Partial", unknown: "Unknown", planned: "Planned", failed: "Failed" };
  const VALUE_LABELS = { high: "High", medium: "Medium", low: "Low" };
  const KIND_LABELS = { ministry: "Ministry", agency: "Agency", superintendency: "Superintendency", municipality: "Municipality", university: "University", public_company: "Public company", international: "International" };
  const SECTION_LABELS = { data_sources: "Data Sources", institutions: "Institutions", public_market: "Public Market", economy_finance: "Economy & Finance", demographics_statistics: "Demographics & Statistics", territory_environment: "Territory & Environment", regulation_policy: "Regulation & Policy", science_academia: "Science & Academia", radar: "Radar" };

  let root = null;
  let currentPanel = "overview";
  let dashboard = emptyDashboard();
  let loading = false;
  let sourceFilters = { query: "", section: "", category: "", sourceType: "", status: "", strategicValue: "" };
  let institutionFilters = { kind: "", relevance: "" };
  let radarFilters = { section: "", category: "", urgency: "", sourceId: "", minScore: 0 };

  function init() {
    root = document.querySelector("[data-dominican-intelligence-workspace]");
    if (!root || root.dataset.ready === "true") return;
    root.dataset.ready = "true";
    renderShell();
    bindControls();
    void loadDashboard();
  }

  function emptyDashboard() {
    return {
      sources: [], resources: [], datasets: [], institutions: [], procurementRecords: [], economicIndicators: [], geoLayers: [], policyDocuments: [], signals: [], syncRuns: []
    };
  }

  async function loadDashboard() {
    setMessage("Loading Dominican Intelligence...");
    try {
      const data = await window.BCCAuth.api("/api/admin/dominican-intelligence/dashboard");
      dashboard = normalizeDashboard(data.dashboard || {});
      setMessage("Source registry loaded. Values are synced snapshots, not live claims.");
      renderAll();
    } catch (error) {
      setMessage(`Could not load persisted Dominican Intelligence. Showing local fallback. ${error.message || error}`, "error");
      dashboard = normalizeDashboard(emptyDashboard());
      renderAll();
    }
  }

  async function runSync(target) {
    if (loading) return;
    loading = true;
    setMessage(`Running Dominican Intelligence sync: ${target}...`);
    renderShellControls();
    try {
      const data = await window.BCCAuth.api("/api/admin/dominican-intelligence/sync", { method: "POST", body: JSON.stringify({ target }) });
      dashboard = normalizeDashboard(data.dashboard || dashboard);
      const summary = data.summary || {};
      const errorText = Array.isArray(data.errors) && data.errors.length ? ` · ${data.errors.length} connector issue(s) stored in sync history.` : "";
      const fallbackText = data.snapshotOnly ? "Persisted snapshot refreshed" : "Sync finished";
      setMessage(`${fallbackText}: ${summary.datasets || 0} datasets, ${summary.resources || 0} resources, ${summary.geoLayers || 0} geo layers, ${summary.signals || 0} signals.${errorText}`, data.ok ? "ok" : "error");
      renderAll();
    } catch (error) {
      setMessage(error.message || "Sync failed.", "error");
    } finally {
      loading = false;
      renderShellControls();
    }
  }

  function normalizeDashboard(payload) {
    return {
      sources: Array.isArray(payload.sources) ? payload.sources : [],
      resources: Array.isArray(payload.resources) ? payload.resources : [],
      datasets: Array.isArray(payload.datasets) ? payload.datasets : [],
      institutions: Array.isArray(payload.institutions) ? payload.institutions : [],
      procurementRecords: Array.isArray(payload.procurementRecords) ? payload.procurementRecords : [],
      economicIndicators: Array.isArray(payload.economicIndicators) ? payload.economicIndicators : [],
      geoLayers: Array.isArray(payload.geoLayers) ? payload.geoLayers : [],
      policyDocuments: Array.isArray(payload.policyDocuments) ? payload.policyDocuments : [],
      signals: Array.isArray(payload.signals) ? payload.signals : [],
      syncRuns: Array.isArray(payload.syncRuns) ? payload.syncRuns : []
    };
  }

  function renderShell() {
    root.innerHTML = `
      <section class="users-surface intelligence-surface dominican-intelligence-surface">
        <div class="surface-toolbar intelligence-toolbar">
          <div>
            <h2>Dominican Intelligence</h2>
            <p class="muted-text" data-dominican-message>External intelligence hub for Dominican data sources, institutions, public market signals, territory, economy, environment, and BCC opportunities.</p>
          </div>
          <div class="intelligence-controls" data-dominican-sync-controls></div>
        </div>
        <nav class="intelligence-nav" aria-label="Dominican Intelligence tabs">
          ${PANELS.map(panel => `<button class="intelligence-nav-chip${panel === currentPanel ? " is-active" : ""}" type="button" data-dominican-panel-target="${escapeHtml(panel)}">${escapeHtml(panelLabel(panel))}</button>`).join("")}
        </nav>
        <section class="intelligence-panels">${PANELS.map(panel => `<section class="intelligence-panel${panel === currentPanel ? "" : " is-hidden"}" data-dominican-panel="${escapeHtml(panel)}"></section>`).join("")}</section>
      </section>`;
    renderShellControls();
    refreshIcons();
  }

  function renderShellControls() {
    const target = root?.querySelector("[data-dominican-sync-controls]");
    if (!target) return;
    target.innerHTML = `
      <label class="intelligence-inline-field"><span>Manual sync</span><select data-dominican-sync-target aria-label="Dominican Intelligence sync target"><option value="all">All active sources</option><option value="datos">datos.gob.do</option><option value="dgcp">DGCP discovery</option><option value="iderd">IDERD metadata</option><option value="bcrd">BCRD skeleton</option><option value="sib">SIB skeleton</option></select></label>
      <button class="btn btn-primary" type="button" data-dominican-sync ${loading ? "disabled" : ""}><i data-lucide="refresh-cw"></i>${loading ? "Syncing..." : "Sync Dominican Intelligence"}</button>`;
    refreshIcons(target);
  }

  function bindControls() {
    root.addEventListener("click", event => {
      const tab = event.target.closest("[data-dominican-panel-target]");
      if (tab) { currentPanel = tab.dataset.dominicanPanelTarget || "overview"; syncPanels(); return; }
      const sync = event.target.closest("[data-dominican-sync]");
      if (sync) runSync(root.querySelector("[data-dominican-sync-target]")?.value || "all");
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
    if (sourceKey) { sourceFilters[sourceKey] = target.value || ""; renderSourcesPanel(); restoreFilterFocus(`data-dominican-source-filter`, sourceKey); }
    if (institutionKey) { institutionFilters[institutionKey] = target.value || ""; renderInstitutionsPanel(); restoreFilterFocus(`data-dominican-institution-filter`, institutionKey); }
    if (radarKey) { radarFilters[radarKey] = radarKey === "minScore" ? Number(target.value || 0) : (target.value || ""); renderRadarPanel(); restoreFilterFocus(`data-dominican-radar-filter`, radarKey); }
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
    root.querySelectorAll("[data-dominican-panel-target]").forEach(button => button.classList.toggle("is-active", button.dataset.dominicanPanelTarget === currentPanel));
    root.querySelectorAll("[data-dominican-panel]").forEach(panel => panel.classList.toggle("is-hidden", panel.dataset.dominicanPanel !== currentPanel));
    renderPanel(currentPanel);
    refreshIcons();
  }

  function renderAll() { PANELS.forEach(renderPanel); refreshIcons(); }
  function renderPanel(panel) {
    if (panel === "overview") renderOverviewPanel();
    if (panel === "sources") renderSourcesPanel();
    if (panel === "institutions") renderInstitutionsPanel();
    if (panel === "market") renderMarketPanel();
    if (panel === "economy") renderEconomyPanel();
    if (panel === "demographics") renderDemographicsPanel();
    if (panel === "territory") renderTerritoryPanel();
    if (panel === "policy") renderPolicyPanel();
    if (panel === "radar") renderRadarPanel();
  }

  function renderOverviewPanel() {
    const latestRun = dashboard.syncRuns[0];
    const highSignals = dashboard.signals.filter(item => Number(item.relevanceScore || 0) >= 70);
    const failedSources = dashboard.sources.filter(item => item.status === "failed");
    const activeSources = dashboard.sources.filter(item => item.status === "active" || item.status === "partial");
    panel("overview").innerHTML = `
      <section class="workspace-metrics intelligence-metrics" aria-label="Dominican Intelligence summary">
        ${metric("Sources registered", dashboard.sources.length, "Source-first registry")}${metric("Active/partial sources", activeSources.length, "Connected or usable")}${metric("Failed sources", failedSources.length, "Needs attention")}${metric("Datasets indexed", dashboard.datasets.length, "Persisted records")}${metric("Resources indexed", dashboard.resources.length, "Files/APIs/services")}${metric("Institutions indexed", dashboard.institutions.length, "Curated + extracted")}${metric("Geo layers indexed", dashboard.geoLayers.length, "Metadata-level")}${metric("Signals detected", dashboard.signals.length, "Generated from sources")}${metric("High-relevance signals", highSignals.length, "Score >= 70")}${metric("Last sync status", latestRun?.status || "No runs", latestRun?.startedAt ? formatDateTime(latestRun.startedAt) : "Run manual sync")}
      </section>
      <section class="analytics-grid">
        <article class="activity-surface analytics-card analytics-card-wide"><div class="activity-head"><h3>Latest high-value signals</h3><span>${highSignals.length}</span></div>${signalTable(highSignals.slice(0, 6), { compact: true })}</article>
        <article class="activity-surface analytics-card"><div class="activity-head"><h3>Source health</h3><span>${dashboard.sources.length}</span></div>${sourceHealthList()}</article>
        <article class="activity-surface analytics-card"><div class="activity-head"><h3>What BCC should look at next</h3><span>Action</span></div><div class="intelligence-focus-list">${dashboard.signals.slice(0, 3).map(actionCard).join("") || emptyBlock("Run sync to generate source-driven recommendations.")}</div></article>
      </section>`;
  }

  function renderSourcesPanel() {
    const sources = filteredSources();
    panel("sources").innerHTML = `<section class="users-surface"><div class="surface-toolbar"><div><h2>Data Sources</h2><p class="muted-text">${sources.length} source(s) matching filters. Sync status comes from persisted runs.</p></div>${sourceFiltersMarkup()}</div>${sourceTable(sources)}</section>`;
  }

  function renderInstitutionsPanel() {
    const institutions = filteredInstitutions();
    panel("institutions").innerHTML = `<section class="users-surface"><div class="surface-toolbar"><div><h2>Institutions</h2><p class="muted-text">Curated registry plus organizations extracted from datasets.</p></div>${institutionFiltersMarkup()}</div><div class="table-scroll"><table class="account-table"><thead><tr><th>Name</th><th>Type</th><th>Sector</th><th>Source</th><th>Relevance</th><th>Notes</th></tr></thead><tbody>${institutions.length ? institutions.map(institutionRow).join("") : `<tr><td class="table-empty" colspan="6">No institutions match filters.</td></tr>`}</tbody></table></div></section>`;
  }

  function renderMarketPanel() {
    const sources = dashboard.sources.filter(item => item.section === "public_market");
    const datasets = dashboard.datasets.filter(item => item.section === "public_market" || item.category === "procurement");
    const signals = dashboard.signals.filter(item => item.section === "public_market" || ["procurement", "opportunity"].includes(item.category));
    panel("market").innerHTML = `<section class="workspace-metrics intelligence-metrics">${metric("DGCP datasets", datasets.length, "Dataset/resource intelligence")}${metric("Resources discovered", dashboard.resources.filter(resource => datasets.some(dataset => dataset.id === resource.metadataJson?.datasetId)).length, "Process-level parsing pending")}${metric("Procurement signals", signals.length, "Generated by scoring")}${metric("Procurement records", dashboard.procurementRecords.length || "Pending", "Only when parseable")}</section><section class="analytics-grid"><article class="activity-surface analytics-card analytics-card-wide"><div class="activity-head"><h3>BCC opportunity matching</h3><span>DGCP</span></div><p class="muted-text">Process-level ingestion is pending unless CSV/resources are reliably parseable. Current sync stores real dataset/resource intelligence and scores BCC relevance.</p>${signalTable(signals)}</article><article class="activity-surface analytics-card analytics-card-wide"><div class="activity-head"><h3>Public market sources</h3><span>${sources.length}</span></div>${sourceTable(sources, { compact: true })}</article></section>`;
  }

  function renderEconomyPanel() {
    const sources = dashboard.sources.filter(item => item.section === "economy_finance");
    panel("economy").innerHTML = `<section class="workspace-metrics intelligence-metrics">${["Inflation", "Exchange rates", "Labor market", "Tourism", "Banking system", "Trade intelligence", "Imports / exports"].map(label => metric(label, "Not live", "Connector planned/partial")).join("")}</section><section class="activity-surface analytics-card analytics-card-wide"><div class="activity-head"><h3>Economy & Finance source registry</h3><span>${sources.length}</span></div><p class="muted-text">No fake live values are displayed. Indicators appear here only after validated server-side sync.</p>${sourceTable(sources, { compact: true })}</section>`;
  }

  function renderDemographicsPanel() {
    const datasets = dashboard.datasets.filter(item => item.section === "demographics_statistics" || ["statistics", "demographics"].includes(item.category));
    const sources = dashboard.sources.filter(item => item.section === "demographics_statistics");
    panel("demographics").innerHTML = `<section class="analytics-grid"><article class="activity-surface analytics-card analytics-card-wide"><div class="activity-head"><h3>Demographics & Statistics datasets</h3><span>${datasets.length}</span></div>${datasetTable(datasets)}</article><article class="activity-surface analytics-card analytics-card-wide"><div class="activity-head"><h3>Source mapping</h3><span>${sources.length}</span></div>${sourceTable(sources, { compact: true })}</article></section>`;
  }

  function renderTerritoryPanel() {
    const sources = dashboard.sources.filter(item => item.section === "territory_environment");
    const datasets = dashboard.datasets.filter(item => item.section === "territory_environment");
    const signals = dashboard.signals.filter(item => item.section === "territory_environment" || ["geospatial", "environmental"].includes(item.category));
    panel("territory").innerHTML = `<section class="workspace-metrics intelligence-metrics">${metric("Geo layers", dashboard.geoLayers.length, "IDERD metadata-level")}${metric("Territory datasets", datasets.length, "CKAN/geosources")}${metric("Satellite sources", sources.filter(item => item.category === "satellite").length, "Planned")}${metric("Territory signals", signals.length, "Generated")}</section><section class="analytics-grid"><article class="activity-surface analytics-card analytics-card-wide"><div class="activity-head"><h3>Geo layers and services</h3><span>${dashboard.geoLayers.length}</span></div>${geoLayerTable(dashboard.geoLayers)}</article><article class="activity-surface analytics-card analytics-card-wide"><div class="activity-head"><h3>Territory & Environment sources</h3><span>${sources.length}</span></div>${sourceTable(sources, { compact: true })}</article><article class="activity-surface analytics-card analytics-card-wide"><div class="intelligence-focus-item"><span>Satellite intelligence areas</span><strong>Sentinel-2 optical, Sentinel-1 radar, fire, vegetation, water, urban change and disaster/climate signals.</strong><p>Deep satellite processing is not implemented in this MVP.</p></div></article></section>`;
  }

  function renderPolicyPanel() {
    const sources = dashboard.sources.filter(item => item.section === "regulation_policy");
    panel("policy").innerHTML = `<section class="analytics-grid"><article class="activity-surface analytics-card analytics-card-wide"><div class="activity-head"><h3>Regulation & Policy</h3><span>Planned</span></div><div class="intelligence-focus-list">${["Laws", "Decrees", "Public consultations", "Standards", "Institutional plans"].map(label => `<div class="intelligence-focus-item"><span>${escapeHtml(label)}</span><strong>Connector planned</strong><p>No policy alerts are being faked. This section is ready for document/source registry support.</p></div>`).join("")}</div></article><article class="activity-surface analytics-card analytics-card-wide"><div class="activity-head"><h3>Policy source registry</h3><span>${sources.length}</span></div>${sourceTable(sources, { compact: true })}</article></section>`;
  }

  function renderRadarPanel() {
    const signals = filteredSignals();
    panel("radar").innerHTML = `<section class="users-surface"><div class="surface-toolbar"><div><h2>Dominican Radar</h2><p class="muted-text">Signal-detection layer consuming all connected Dominican Intelligence sources.</p></div>${radarFiltersMarkup()}</div>${signalTable(signals)}</section><section class="activity-surface analytics-card analytics-card-wide"><div class="activity-head"><h3>Scoring explanation</h3><span>0-100</span></div><p class="muted-text">BCC relevance score considers keyword match, institution relevance, sector relevance, procurement value, scientific/technical proximity, source strategic value, useful formats, recency and actionability.</p></section><section class="activity-surface analytics-card analytics-card-wide"><div class="activity-head"><h3>Last sync runs</h3><span>${dashboard.syncRuns.length}</span></div>${runTable(dashboard.syncRuns.slice(0, 12))}</section>`;
  }

  function sourceFiltersMarkup() { return `<div class="surface-filters" aria-label="Filter data sources"><label class="surface-mobile-search"><i data-lucide="search"></i><input type="search" value="${escapeAttr(sourceFilters.query)}" data-dominican-source-filter="query" placeholder="Search sources..." /></label>${selectFilter("Section", "section", sourceFilters.section, uniqueOptions(dashboard.sources, "section", SECTION_LABELS), "dominican-source")}${selectFilter("Category", "category", sourceFilters.category, uniqueOptions(dashboard.sources, "category", CATEGORY_LABELS), "dominican-source")}${selectFilter("Type", "sourceType", sourceFilters.sourceType, uniqueOptions(dashboard.sources, "sourceType", SOURCE_TYPE_LABELS), "dominican-source")}${selectFilter("Status", "status", sourceFilters.status, uniqueOptions(dashboard.sources, "status", STATUS_LABELS), "dominican-source")}${selectFilter("Value", "strategicValue", sourceFilters.strategicValue, uniqueOptions(dashboard.sources, "strategicValue", VALUE_LABELS), "dominican-source")}</div>`; }
  function institutionFiltersMarkup() { return `<div class="surface-filters" aria-label="Filter institutions">${selectFilter("Type", "kind", institutionFilters.kind, uniqueOptions(dashboard.institutions, "kind", KIND_LABELS), "dominican-institution")}${selectFilter("Relevance", "relevance", institutionFilters.relevance, uniqueOptions(dashboard.institutions, "relevanceToBCC", VALUE_LABELS), "dominican-institution")}</div>`; }
  function radarFiltersMarkup() { return `<div class="surface-filters" aria-label="Filter radar signals">${selectFilter("Section", "section", radarFilters.section, uniqueOptions(dashboard.signals, "section", SECTION_LABELS), "dominican-radar")}${selectFilter("Category", "category", radarFilters.category, uniqueOptions(dashboard.signals, "category", CATEGORY_LABELS), "dominican-radar")}${selectFilter("Urgency", "urgency", radarFilters.urgency, uniqueOptions(dashboard.signals, "urgency", VALUE_LABELS), "dominican-radar")}${selectFilter("Source", "sourceId", radarFilters.sourceId, dashboard.sources.map(source => ({ value: source.id, label: source.name })), "dominican-radar")}<label class="analytics-range-field"><span>Min score</span><input type="number" min="0" max="100" value="${escapeAttr(radarFilters.minScore)}" data-dominican-radar-filter="minScore" /></label></div>`; }
  function selectFilter(label, key, value, options, prefix) { return `<label class="analytics-range-field"><span>${escapeHtml(label)}</span><select data-${prefix}-filter="${escapeAttr(key)}"><option value="">All</option>${options.map(option => `<option value="${escapeAttr(option.value)}" ${option.value === value ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}</select></label>`; }

  function sourceTable(sources, options = {}) { const compact = Boolean(options.compact); return `<div class="table-scroll analytics-table-wrap"><table class="account-table analytics-table"><thead><tr><th>Source</th><th>Section</th><th>Category</th><th>Type</th><th>Status</th><th>Value</th><th>Connector</th>${compact ? "" : "<th>Last checked</th>"}</tr></thead><tbody>${sources.length ? sources.map(source => sourceRow(source, compact)).join("") : `<tr><td class="table-empty" colspan="${compact ? 7 : 8}">No sources match filters.</td></tr>`}</tbody></table></div>`; }
  function sourceRow(source, compact = false) { return `<tr><td data-label="Source"><strong>${escapeHtml(source.name)}</strong><small>${escapeHtml(source.institution || source.url)}</small></td><td>${escapeHtml(labelFor(source.section, SECTION_LABELS))}</td><td>${escapeHtml(labelFor(source.category, CATEGORY_LABELS))}</td><td>${escapeHtml(labelFor(source.sourceType, SOURCE_TYPE_LABELS))}</td><td>${escapeHtml(labelFor(source.status, STATUS_LABELS))}</td><td>${escapeHtml(labelFor(source.strategicValue, VALUE_LABELS))}</td><td>${escapeHtml(source.connectorKey || "Not connected yet")}</td>${compact ? "" : `<td>${escapeHtml(formatDateTime(source.lastCheckedAt) || "-")}</td>`}</tr>`; }
  function datasetTable(datasets) { return `<div class="table-scroll analytics-table-wrap"><table class="account-table analytics-table"><thead><tr><th>Dataset</th><th>Organization</th><th>Section</th><th>Category</th><th>Score</th><th>Resources</th></tr></thead><tbody>${datasets.length ? datasets.map(dataset => `<tr><td><strong>${escapeHtml(dataset.title)}</strong><small>${escapeHtml(dataset.name || dataset.externalId || "")}</small></td><td>${escapeHtml(dataset.organization || "-")}</td><td>${escapeHtml(labelFor(dataset.section, SECTION_LABELS))}</td><td>${escapeHtml(labelFor(dataset.category, CATEGORY_LABELS))}</td><td>${escapeHtml(dataset.relevanceScore || 0)}</td><td>${escapeHtml((dataset.resources || []).length)}</td></tr>`).join("") : `<tr><td class="table-empty" colspan="6">No datasets indexed yet.</td></tr>`}</tbody></table></div>`; }
  function signalTable(signals, options = {}) { const compact = Boolean(options.compact); return `<div class="table-scroll analytics-table-wrap"><table class="account-table analytics-table"><thead><tr><th>Title</th><th>Source</th><th>Section</th><th>Category</th><th>Score</th><th>Urgency</th><th>Why flagged</th>${compact ? "" : "<th>Suggested action</th><th>Detected</th>"}</tr></thead><tbody>${signals.length ? signals.map(signal => signalRow(signal, compact)).join("") : `<tr><td class="table-empty" colspan="${compact ? 7 : 9}">No signals match filters.</td></tr>`}</tbody></table></div>`; }
  function signalRow(signal, compact = false) { const source = dashboard.sources.find(item => item.id === signal.sourceId); return `<tr><td><strong>${escapeHtml(signal.title)}</strong><small>${escapeHtml(signal.summary || "")}</small></td><td>${escapeHtml(source?.name || signal.sourceId || "-")}</td><td>${escapeHtml(labelFor(signal.section, SECTION_LABELS))}</td><td>${escapeHtml(labelFor(signal.category, CATEGORY_LABELS))}</td><td>${escapeHtml(signal.relevanceScore || 0)}</td><td>${escapeHtml(labelFor(signal.urgency, VALUE_LABELS))}</td><td>${escapeHtml(signal.whyFlagged || "-")}</td>${compact ? "" : `<td>${escapeHtml(signal.suggestedAction || "-")}</td><td>${escapeHtml(formatDateTime(signal.detectedAt))}</td>`}</tr>`; }
  function institutionRow(institution) { const source = dashboard.sources.find(item => item.id === institution.sourceId); return `<tr><td><strong>${escapeHtml(institution.name)}</strong></td><td>${escapeHtml(labelFor(institution.kind, KIND_LABELS))}</td><td>${escapeHtml(institution.sector || "-")}</td><td>${escapeHtml(source?.name || institution.sourceId || "Curated")}</td><td>${escapeHtml(labelFor(institution.relevanceToBCC, VALUE_LABELS))}</td><td>${escapeHtml(institution.notes || "")}</td></tr>`; }
  function geoLayerTable(layers) { return `<div class="table-scroll analytics-table-wrap"><table class="account-table analytics-table"><thead><tr><th>Layer/service</th><th>Service</th><th>Type</th><th>Category</th><th>Description</th></tr></thead><tbody>${layers.length ? layers.map(layer => `<tr><td><strong>${escapeHtml(layer.name)}</strong><small>${escapeHtml(layer.serviceUrl || "")}</small></td><td>${escapeHtml(String(layer.serviceType || "").toUpperCase())}</td><td>${escapeHtml(layer.layerType || "-")}</td><td>${escapeHtml(layer.category || "-")}</td><td>${escapeHtml(layer.description || "")}</td></tr>`).join("") : `<tr><td class="table-empty" colspan="5">No geoservices indexed yet.</td></tr>`}</tbody></table></div>`; }
  function runTable(runs) { return `<div class="table-scroll analytics-table-wrap"><table class="account-table analytics-table"><thead><tr><th>Status</th><th>Connector</th><th>Records</th><th>Error</th><th>Started</th></tr></thead><tbody>${runs.length ? runs.map(run => `<tr><td>${escapeHtml(run.status)}</td><td>${escapeHtml(run.connectorKey || "-")}</td><td>${escapeHtml(run.recordsFound || 0)} found · ${escapeHtml(run.recordsCreated || 0)} created · ${escapeHtml(run.recordsUpdated || 0)} updated</td><td>${escapeHtml(run.errorMessage || "-")}</td><td>${escapeHtml(formatDateTime(run.startedAt))}</td></tr>`).join("") : `<tr><td class="table-empty" colspan="5">No sync runs yet.</td></tr>`}</tbody></table></div>`; }

  function sourceHealthList() { return `<div class="intelligence-focus-list">${dashboard.sources.slice(0, 8).map(source => `<div class="intelligence-focus-item"><span>${escapeHtml(labelFor(source.status, STATUS_LABELS))}</span><strong>${escapeHtml(source.name)}</strong><p>${escapeHtml(source.connectorKey ? `Connector: ${source.connectorKey}` : "Not connected yet")}. ${escapeHtml(source.notes || "")}</p></div>`).join("")}</div>`; }
  function actionCard(signal) { return `<div class="intelligence-focus-item"><span>${escapeHtml(labelFor(signal.urgency, VALUE_LABELS))} · ${escapeHtml(signal.relevanceScore || 0)}</span><strong>${escapeHtml(signal.title)}</strong><p>${escapeHtml(signal.suggestedAction || signal.summary || "Review signal.")}</p></div>`; }
  function emptyBlock(text) { return `<div class="intelligence-focus-item"><span>Empty</span><strong>${escapeHtml(text)}</strong></div>`; }

  function filteredSources() { const query = sourceFilters.query.trim().toLowerCase(); return dashboard.sources.filter(source => { const searchable = [source.name, source.institution, source.notes, ...(source.bccRelevance || [])].join(" ").toLowerCase(); if (query && !searchable.includes(query)) return false; if (sourceFilters.section && source.section !== sourceFilters.section) return false; if (sourceFilters.category && source.category !== sourceFilters.category) return false; if (sourceFilters.sourceType && source.sourceType !== sourceFilters.sourceType) return false; if (sourceFilters.status && source.status !== sourceFilters.status) return false; if (sourceFilters.strategicValue && source.strategicValue !== sourceFilters.strategicValue) return false; return true; }); }
  function filteredInstitutions() { return dashboard.institutions.filter(institution => { if (institutionFilters.kind && institution.kind !== institutionFilters.kind) return false; if (institutionFilters.relevance && institution.relevanceToBCC !== institutionFilters.relevance) return false; return true; }); }
  function filteredSignals() { return dashboard.signals.filter(signal => { if (radarFilters.section && signal.section !== radarFilters.section) return false; if (radarFilters.category && signal.category !== radarFilters.category) return false; if (radarFilters.urgency && signal.urgency !== radarFilters.urgency) return false; if (radarFilters.sourceId && signal.sourceId !== radarFilters.sourceId) return false; if (Number(signal.relevanceScore || 0) < Number(radarFilters.minScore || 0)) return false; return true; }).sort((a, b) => Number(b.relevanceScore || 0) - Number(a.relevanceScore || 0)); }
  function uniqueOptions(items, key, labels) { return [...new Set(items.map(item => item[key]).filter(Boolean))].sort().map(value => ({ value, label: labelFor(value, labels) })); }
  function metric(label, value, note) { return `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></div>`; }
  function panel(name) { return root.querySelector(`[data-dominican-panel="${name}"]`); }
  function panelLabel(panel) { return { overview: "Overview", sources: "Data Sources", institutions: "Institutions", market: "Public Market", economy: "Economy & Finance", demographics: "Demographics & Statistics", territory: "Territory & Environment", policy: "Regulation & Policy", radar: "Dominican Radar" }[panel] || panel; }
  function labelFor(value, labels) { return labels[value] || String(value || "").replaceAll("_", " "); }
  function formatDateTime(value) { return window.BCCWorkspaceUtils.formatDateTime(value, { empty: "-" }); }
  function setMessage(text, tone = "neutral") { window.BCCWorkspaceUtils.setMessage(root?.querySelector("[data-dominican-message]"), text, tone); }
  function escapeHtml(value) { return window.BCCWorkspaceUtils.escapeHtml(value); }
  function escapeAttr(value) { return window.BCCWorkspaceUtils.escapeAttr(value); }
  function refreshIcons(target = root) { window.BCCWorkspaceUtils.refreshIcons(target); }

  window.BCCWorkspaceDominicanIntelligence = { init };
})();
