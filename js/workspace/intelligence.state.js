/* Mutable dashboard state and pure data-derivation logic for the Science Radar (Intelligence) feature. */
(() => {
  const {
    RUN_ACTIONS,
    SIGNAL_STATUS_LABELS,
    SIGNAL_TYPE_LABELS,
    TOPIC_CATEGORY_LABELS,
    DEFAULT_LINES,
    RESEARCH_PAGE_SIZE
  } = window.BCCWorkspaceIntelligenceConstants;
  const INTELLIGENCE_CACHE_VERSION = 1;
  const INTELLIGENCE_CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;

  let currentUser = null;
  let currentPanel = "overview";
  let currentAction = "sync_papers";
  let syncDryRun = false;
  let selectedSignalId = "";
  let selectedTopicId = "";
  let selectedSourceId = "";
  let filters = {};
  let visibleCounts = { ...RESEARCH_PAGE_SIZE };
  let dashboard = emptyDashboard();
  let topicHitsIndex = null;
  let selectedBulkSignalIds = new Set();

  function emptyDashboard() {
    return {
      overview: {
        papersTracked: 0,
        totalGrants: 0,
        totalPatents: 0,
        totalTrials: 0,
        priorityTopics: 0,
        newSignals: 0
      },
      sources: [],
      papers: [],
      grants: [],
      patents: [],
      trials: [],
      institutions: [],
      topics: [],
      signals: [],
      runs: [],
      settings: defaultSettings()
    };
  }

  function defaultSettings() {
    return {
      id: "",
      maxResultsPerSource: 20,
      defaultDateRangeDays: 90,
      suggestedFrequency: "daily",
      defaultDryRun: false,
      scoringThresholds: { opportunity: 60, actionability: 50, confidence: 50 },
      monitoredLines: [...DEFAULT_LINES]
    };
  }

  function defaultFilters(dateRange = "90") {
    return {
      papers: { topic: "", source: "", line: "", dateRange, keyword: "", sort: "latest", openAccessOnly: false, withAbstractOnly: false, duplicatesOnly: false },
      grants: { topic: "", line: "", dateRange, keyword: "", duplicatesOnly: false },
      patents: { topic: "", line: "", dateRange, keyword: "", duplicatesOnly: false },
      trials: { topic: "", line: "", dateRange, keyword: "", duplicatesOnly: false }
    };
  }

  function normalizeDashboard(data) {
    const payload = data && typeof data === "object" ? data : {};
    return {
      overview: payload.overview || emptyDashboard().overview,
      sources: Array.isArray(payload.sources) ? payload.sources : [],
      papers: Array.isArray(payload.papers) ? payload.papers : [],
      grants: Array.isArray(payload.grants) ? payload.grants : [],
      patents: Array.isArray(payload.patents) ? payload.patents : [],
      trials: Array.isArray(payload.trials) ? payload.trials : [],
      institutions: Array.isArray(payload.institutions) ? payload.institutions : [],
      topics: Array.isArray(payload.topics) ? payload.topics : [],
      signals: Array.isArray(payload.signals) ? payload.signals : [],
      runs: Array.isArray(payload.runs) ? payload.runs : [],
      settings: { ...defaultSettings(), ...(payload.settings || {}) }
    };
  }

  function applyDashboardState(nextDashboard, options = {}) {
    dashboard = normalizeDashboard(nextDashboard);
    topicHitsIndex = null;
    visibleCounts = { ...RESEARCH_PAGE_SIZE };
    selectedBulkSignalIds.clear();
    syncDryRun = dashboard.settings.defaultDryRun;
    filters = normalizeFiltersState(filters, String(pickDateRange(dashboard.settings.defaultDateRangeDays)));
    currentAction = RUN_ACTIONS.some(action => action.id === currentAction) ? currentAction : "sync_papers";
    selectedSignalId = existingOrFirst(selectedSignalId, dashboard.signals);
    selectedTopicId = existingOrFirst(selectedTopicId, dashboard.topics);
    selectedSourceId = existingOrFirst(selectedSourceId, dashboard.sources);
    if (options.persist !== false) writeDashboardCache(dashboard);
  }

  function normalizeFiltersState(nextFilters, dateRange = "90") {
    const defaults = defaultFilters(dateRange);
    const incoming = nextFilters && typeof nextFilters === "object" ? nextFilters : {};
    return {
      papers: {
        ...defaults.papers,
        ...(incoming.papers || {}),
        openAccessOnly: Boolean(incoming?.papers?.openAccessOnly),
        withAbstractOnly: Boolean(incoming?.papers?.withAbstractOnly),
        duplicatesOnly: Boolean(incoming?.papers?.duplicatesOnly)
      },
      grants: { ...defaults.grants, ...(incoming.grants || {}), duplicatesOnly: Boolean(incoming?.grants?.duplicatesOnly) },
      patents: { ...defaults.patents, ...(incoming.patents || {}), duplicatesOnly: Boolean(incoming?.patents?.duplicatesOnly) },
      trials: { ...defaults.trials, ...(incoming.trials || {}), duplicatesOnly: Boolean(incoming?.trials?.duplicatesOnly) }
    };
  }

  function cacheStorageKey() {
    const actor = String(currentUser?.id || currentUser?.email || currentUser?.username || "admin").trim().toLowerCase();
    return `bcc.intelligence.dashboard.v${INTELLIGENCE_CACHE_VERSION}.${actor || "admin"}`;
  }

  function readDashboardCache() {
    try {
      const raw = window.localStorage.getItem(cacheStorageKey());
      if (!raw) return null;
      const payload = JSON.parse(raw);
      if (!payload || typeof payload !== "object" || !payload.dashboard) return null;
      const savedAt = Number(payload.savedAt || 0);
      if (!savedAt || (Date.now() - savedAt) > INTELLIGENCE_CACHE_MAX_AGE_MS) return null;
      return {
        savedAt,
        dashboard: normalizeDashboard(payload.dashboard)
      };
    } catch {
      return null;
    }
  }

  function writeDashboardCache(nextDashboard) {
    try {
      window.localStorage.setItem(cacheStorageKey(), JSON.stringify({
        savedAt: Date.now(),
        dashboard: normalizeDashboard(nextDashboard)
      }));
    } catch {
      // Ignore storage or privacy-mode failures; live state still works.
    }
  }

  function hasDashboardContent(state) {
    return Boolean(
      state?.papers?.length
      || state?.signals?.length
      || state?.topics?.length
      || state?.sources?.length
      || state?.runs?.length
      || state?.grants?.length
      || state?.patents?.length
      || state?.trials?.length
      || state?.institutions?.length
    );
  }

  function snapshotAgeLabel(savedAt) {
    const elapsed = Math.max(0, Date.now() - Number(savedAt || 0));
    const minutes = Math.round(elapsed / 60000);
    if (minutes < 1) return "ahora mismo";
    if (minutes < 60) return `hace ${minutes} min`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `hace ${hours} h`;
    const days = Math.round(hours / 24);
    return `hace ${days} d`;
  }

  function filteredPapers() {
    const items = applyResearchFilters(dashboard.papers, filters.papers, {
      dateField: "publicationDate",
      sourceField: "sourceName",
      sourceResolver: item => String(item.sourceName || sourceHost(item.sourceUrl) || "").trim(),
      searchFields: ["title", "abstract", "authors", "institutions", "topics", "keywords"]
    });
    return sortPapers(
      filters.papers.openAccessOnly ? items.filter(item => item.openAccessUrl) : items,
      filters.papers.sort
    );
  }

  function filteredGrants() {
    return applyResearchFilters(dashboard.grants, filters.grants, {
      dateField: "startDate",
      searchFields: ["title", "abstract", "agency", "program", "principalInvestigators", "institutions", "topics"]
    });
  }

  function filteredPatents() {
    return applyResearchFilters(dashboard.patents, filters.patents, {
      dateField: "publicationDate",
      searchFields: ["title", "abstract", "inventors", "assignees", "topics", "jurisdiction", "status"]
    });
  }

  function filteredTrials() {
    return applyResearchFilters(dashboard.trials, filters.trials, {
      dateField: "startDate",
      searchFields: ["title", "summary", "conditions", "interventions", "phase", "status", "studyType", "sponsor", "collaborators", "locations", "countries", "topics", "keywords"]
    });
  }

  function applyResearchFilters(items, state, config) {
    const normalizedKeyword = String(state.keyword || "").trim().toLowerCase();
    const cutoff = cutoffDate(state.dateRange);
    return [...items].filter(item => {
      if (state.topic && !itemMatchesTopic(item, state.topic, config.searchFields)) return false;
      if (state.source) {
        const sourceValue = typeof config.sourceResolver === "function"
          ? config.sourceResolver(item)
          : String(item[config.sourceField] || "");
        if (sourceValue !== state.source) return false;
      }
      if (state.line && deriveLine(item) !== state.line) return false;
      if (cutoff) {
        const dateValue = item[config.dateField] ? new Date(item[config.dateField]) : null;
        if (!dateValue || Number.isNaN(dateValue.getTime()) || dateValue < cutoff) return false;
      }
      if (normalizedKeyword) {
        const searchable = config.searchFields.map(field => normalizeSearchValue(item[field])).join(" ").toLowerCase();
        if (!searchable.includes(normalizedKeyword)) return false;
      }
      if (state.withAbstractOnly && !String(item.abstract || item.summary || "").trim()) return false;
      if (state.duplicatesOnly && !item.possibleDuplicate) return false;
      return true;
    });
  }

  function sortPapers(items, mode = "latest") {
    const list = [...items];
    if (mode === "citations") {
      return list.sort((left, right) => (right.citationsCount || 0) - (left.citationsCount || 0) || Date.parse(right.publicationDate || 0) - Date.parse(left.publicationDate || 0));
    }
    if (mode === "updated") {
      return list.sort((left, right) => Date.parse(right.updatedAt || right.createdAt || 0) - Date.parse(left.updatedAt || left.createdAt || 0));
    }
    if (mode === "source") {
      return list.sort((left, right) => String(left.sourceName || sourceHost(left.sourceUrl)).localeCompare(String(right.sourceName || sourceHost(right.sourceUrl))) || Date.parse(right.publicationDate || 0) - Date.parse(left.publicationDate || 0));
    }
    return list.sort((left, right) => Date.parse(right.publicationDate || right.updatedAt || 0) - Date.parse(left.publicationDate || left.updatedAt || 0));
  }

  function selectedSignal() {
    return dashboard.signals.find(item => item.id === selectedSignalId) || sortedSignals()[0] || null;
  }

  function selectedTopic() {
    return dashboard.topics.find(item => item.id === selectedTopicId) || null;
  }

  function selectedSource() {
    return dashboard.sources.find(item => item.id === selectedSourceId) || null;
  }

  function sortedSignals() {
    return [...dashboard.signals].sort((left, right) => Date.parse(right.updatedAt || right.createdAt || 0) - Date.parse(left.updatedAt || left.createdAt || 0));
  }

  function failedRuns() {
    return [...dashboard.runs].filter(item => item.status === "failed" && item.errorMessage).sort((left, right) => Date.parse(right.createdAt || 0) - Date.parse(left.createdAt || 0));
  }

  function lastRun() {
    return [...dashboard.runs].sort((left, right) => Date.parse(right.createdAt || 0) - Date.parse(left.createdAt || 0))[0] || null;
  }

  function computeTopLine() {
    const counts = new Map(monitoredLines().map(line => [line, 0]));
    dashboard.signals.forEach(signal => {
      const line = signal.relatedLine || "General";
      counts.set(line, (counts.get(line) || 0) + 1);
    });
    if (![...counts.values()].some(Boolean)) {
      dashboard.papers.forEach(item => counts.set(deriveLine(item), (counts.get(deriveLine(item)) || 0) + 1));
      dashboard.grants.forEach(item => counts.set(deriveLine(item), (counts.get(deriveLine(item)) || 0) + 1));
      dashboard.patents.forEach(item => counts.set(deriveLine(item), (counts.get(deriveLine(item)) || 0) + 1));
      dashboard.trials.forEach(item => counts.set(deriveLine(item), (counts.get(deriveLine(item)) || 0) + 1));
    }
    return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] || "General";
  }

  function deriveLine(item) {
    const topics = Array.isArray(item?.topics) ? item.topics : [];
    for (const topicName of topics) {
      const direct = directTopicLine(topicName);
      if (direct) return direct;
    }
    const categories = {};
    topics.forEach(topicName => {
      const topic = dashboard.topics.find(entry => entry.name === topicName);
      if (topic?.category) categories[topic.category] = (categories[topic.category] || 0) + 1;
    });
    if (!Object.keys(categories).length) {
      dashboard.topics.forEach(topic => {
        if (itemMatchesTopic(item, topic, ["title", "abstract", "summary", "topics", "keywords", "authors", "institutions", "program", "agency", "inventors", "assignees", "jurisdiction", "status", "conditions", "interventions", "studyType", "sponsor", "collaborators", "locations", "countries"])) {
          categories[topic.category] = (categories[topic.category] || 0) + 1;
        }
      });
    }
    const topCategory = Object.entries(categories).sort((left, right) => right[1] - left[1])[0]?.[0] || "";
    return lineFromCategory(topCategory);
  }

  function directTopicLine(topicName) {
    const value = String(topicName || "").trim().toLowerCase();
    if (value === "map-nano") return "MAP-Nano";
    if (value === "map-bio") return "MAP-Bio";
    if (value === "map-med") return "MAP-Med";
    if (value === "map-ing") return "MAP-Ing";
    if (value === "maps") return "MAPs";
    if (value === "general") return "General";
    return "";
  }

  function lineFromCategory(category) {
    return {
      nano: "MAP-Nano",
      bio: "MAP-Bio",
      med: "MAP-Med",
      ing: "MAP-Ing",
      general: "General"
    }[String(category || "").toLowerCase()] || "General";
  }

  function uniqueSourcesFromPapers() {
    return [...new Set(dashboard.papers.map(item => String(item.sourceName || sourceHost(item.sourceUrl) || "").trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right));
  }

  function paperInsights(items) {
    const list = Array.isArray(items) ? items : [];
    const openAccessCount = list.filter(item => item.openAccessUrl).length;
    const duplicateCount = list.filter(item => item.possibleDuplicate).length;
    const sourceCounts = new Map();
    let citations = 0;
    list.forEach(item => {
      const source = String(item.sourceName || sourceHost(item.sourceUrl) || "").trim();
      if (source) sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
      citations += Number(item.citationsCount || 0);
    });
    const topSource = [...sourceCounts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] || "";
    return {
      openAccessCount,
      duplicateCount,
      avgCitations: list.length ? Math.round(citations / list.length) : 0,
      openAccessRatio: list.length ? Math.round((openAccessCount / list.length) * 100) : 0,
      topSource
    };
  }

  function paperTopSources(limit = 6) {
    const counts = new Map();
    dashboard.papers.forEach(item => {
      const source = String(item.sourceName || sourceHost(item.sourceUrl) || "").trim();
      if (source) counts.set(source, (counts.get(source) || 0) + 1);
    });
    return [...counts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, limit)
      .map(entry => entry[0]);
  }

  function topicOptions() {
    return [...dashboard.topics].sort((left, right) => left.name.localeCompare(right.name));
  }

  function monitoredLines() {
    return dashboard.settings?.monitoredLines?.length ? dashboard.settings.monitoredLines : [...DEFAULT_LINES];
  }

  function panelLabel(panel) {
    return {
      overview: "Resumen",
      signals: "Señales",
      papers: "Papers",
      grants: "Grants",
      patents: "Patentes",
      trials: "Ensayos",
      institutions: "Instituciones",
      topics: "Temas",
      sources: "Fuentes",
      settings: "Configuración"
    }[panel] || panel;
  }

  function actionLabel(action) {
    return RUN_ACTIONS.find(item => item.id === action)?.label || action || "Ejecutar";
  }

  function signalTypeLabel(type) {
    return SIGNAL_TYPE_LABELS[type] || type || "Señal";
  }

  function signalStatusLabel(status) {
    return SIGNAL_STATUS_LABELS[status] || status || "Nueva";
  }

  function topicCategoryLabel(category) {
    return TOPIC_CATEGORY_LABELS[category] || category || "General";
  }

  function runStatusLabel(status) {
    return {
      pending: "Pendiente",
      running: "En curso",
      completed: "Completado",
      failed: "Fallido",
      idle: "Inactivo"
    }[status] || status || "Inactivo";
  }

  function signalStatusTone(status) {
    if (status === "new") return "new";
    if (status === "reviewing") return "reviewing";
    if (status === "accepted") return "accepted";
    return "archived";
  }

  function shortLineLabel(value) {
    const line = String(value || "General");
    if (line === "MAP-Nano") return "N";
    if (line === "MAP-Bio") return "B";
    if (line === "MAP-Med") return "M";
    if (line === "MAP-Ing") return "I";
    if (line === "MAPs") return "S";
    return "G";
  }

  function sourceStatus(source) {
    return sourceInsight(source).status;
  }

  function topicPortfolio() {
    const insights = dashboard.topics.map(topicInsight);
    return {
      activeCount: insights.filter(item => item.enabled).length,
      disabledCount: insights.filter(item => !item.enabled).length,
      hotCount: insights.filter(item => item.health === "hot").length,
      coldCount: insights.filter(item => item.health === "cold").length,
      coveredCount: insights.filter(item => item.totalHits > 0).length,
      uncoveredCount: insights.filter(item => item.totalHits === 0).length,
      averageKeywords: insights.length
        ? Math.round(insights.reduce((sum, item) => sum + item.keywordCount, 0) / insights.length)
        : 0,
      focus: insights
        .filter(item => item.enabled)
        .sort((left, right) => right.totalHits - left.totalHits)
        .slice(0, 3)
    };
  }

  function topicInsight(topic) {
    const hits = getTopicHits(topic);
    const keywordCount = Array.isArray(topic?.keywords) ? topic.keywords.length : 0;
    const health = !topic.enabled ? "paused" : hits.totalHits >= 12 ? "hot" : hits.totalHits >= 4 ? "active" : "cold";
    const healthLabel = {
      paused: "En pausa",
      hot: "En tendencia",
      active: "Activo",
      cold: "Frío"
    }[health] || "Frío";
    return {
      id: topic.id,
      name: topic.name,
      enabled: Boolean(topic.enabled),
      line: hits.line,
      paperHits: hits.paperHits,
      grantHits: hits.grantHits,
      patentHits: hits.patentHits,
      trialHits: hits.trialHits,
      signalHits: hits.signalHits,
      totalHits: hits.totalHits,
      keywordCount,
      health,
      healthLabel,
      note: `${hits.paperHits} papers · ${hits.trialHits} ensayos · ${hits.signalHits} señales · ${keywordCount} keywords`
    };
  }

  function sourcePortfolio() {
    const insights = dashboard.sources.map(sourceInsight);
    return {
      enabledCount: insights.filter(item => item.enabled).length,
      pausedCount: insights.filter(item => !item.enabled).length,
      protectedCount: insights.filter(item => item.requiresApiKey).length,
      neverSyncedCount: insights.filter(item => item.health === "cold").length,
      stableCount: insights.filter(item => item.health === "active").length,
      watchCount: insights.filter(item => item.health !== "active").length,
      watch: insights
        .filter(item => item.health !== "active")
        .slice(0, 4)
        .map(item => ({
          label: item.healthLabel,
          title: item.name,
          note: item.note
        }))
    };
  }

  function sourceInsight(source) {
    const lastSyncDate = source?.lastSyncAt ? new Date(source.lastSyncAt) : null;
    const hasLastSync = Boolean(lastSyncDate && !Number.isNaN(lastSyncDate.getTime()));
    const daysSinceSync = hasLastSync ? Math.floor((Date.now() - lastSyncDate.getTime()) / 86400000) : null;
    let health = "active";
    if (!source.enabled) {
      health = "paused";
    } else if (!hasLastSync) {
      health = "cold";
    } else if (daysSinceSync > 14) {
      health = "watch";
    }
    const status = !source.enabled
      ? "En pausa"
      : !hasLastSync
        ? source.requiresApiKey ? "Esperando primer sync" : "Nunca sincronizada"
        : daysSinceSync > 14
          ? "Desactualizada"
          : source.requiresApiKey
            ? "Protegida"
            : "Activa";
    const note = !source.enabled
      ? source.rateLimitNotes || "Desactivada del radar."
      : !hasLastSync
        ? source.rateLimitNotes || "Todavía esperando el primer sync exitoso."
        : daysSinceSync > 14
          ? `El último sync fue hace ${daysSinceSync} días.`
          : source.rateLimitNotes || "Configuración de fuente saludable.";
    const watchReasons = [];
    if (!source.enabled) {
      watchReasons.push({
        label: "En pausa",
        note: "Esta fuente no participará en el próximo sync hasta volver a activarla."
      });
    }
    if (!hasLastSync) {
      watchReasons.push({
        label: "Primer sync pendiente",
        note: source.requiresApiKey
          ? "Conviene validar credenciales y lanzar un sync específico antes de confiar en esta fuente."
          : "Todavía no hay evidencia de una primera sincronización exitosa."
      });
    }
    if (source.requiresApiKey) {
      watchReasons.push({
        label: "Sensible a cuota",
        note: source.rateLimitNotes || "Mantén queries compactas y límites moderados para no gastar cuota sin señal útil."
      });
    }
    if (hasLastSync && daysSinceSync > 14) {
      watchReasons.push({
        label: "Fuente desactualizada",
        note: `Pasaron ${daysSinceSync} días desde el último sync. Puede haber cobertura desactualizada.`
      });
    }
    if (!watchReasons.length) {
      watchReasons.push({
        label: "Saludable",
        note: "La fuente está utilizable para el próximo ciclo y no muestra alertas básicas."
      });
    }
    return {
      id: source.id,
      name: source.name,
      enabled: Boolean(source.enabled),
      requiresApiKey: Boolean(source.requiresApiKey),
      health,
      healthLabel: {
        paused: "En pausa",
        cold: "Necesita primer sync",
        watch: "En observación",
        active: "Estable"
      }[health] || "Estable",
      status,
      note,
      lastSyncLabel: window.BCCWorkspaceUtils.formatDateTime(source.lastSyncAt, { empty: "-" }),
      syncAgeLabel: !hasLastSync ? "Nunca" : daysSinceSync <= 0 ? "Hoy" : `${daysSinceSync}d`,
      watchReasons
    };
  }

  // computeTopicHits() is the single source of truth for how a topic matches
  // papers/grants/patents/trials/signals. topicHeatmap() and topicInsight() used
  // to each run their own copy of this same scan (5 full-array filters per
  // topic) on every render, and saveTopic() alone re-renders 6 panels per
  // edit, so a single topic edit could trigger dozens of redundant array scans.
  // getTopicHits() memoizes the result per topic until the underlying data
  // changes (see invalidateTopicHits() calls from the controller), so each
  // render after the first is an O(1) lookup.
  function computeTopicHits(topic) {
    const line = mapTopicLine(topic);
    const paperHits = dashboard.papers.filter(item => itemMatchesTopic(item, topic, ["title", "abstract", "topics", "keywords", "authors", "institutions"])).length;
    const grantHits = dashboard.grants.filter(item => itemMatchesTopic(item, topic, ["title", "abstract", "topics", "program", "agency", "institutions"])).length;
    const patentHits = dashboard.patents.filter(item => itemMatchesTopic(item, topic, ["title", "abstract", "topics", "inventors", "assignees", "jurisdiction"])).length;
    const trialHits = dashboard.trials.filter(item => itemMatchesTopic(item, topic, ["title", "summary", "topics", "keywords", "conditions", "interventions", "sponsor", "collaborators", "locations", "countries"])).length;
    const signalHits = dashboard.signals.filter(item => (item.relatedLine || "General") === line).length;
    return {
      line,
      paperHits,
      grantHits,
      patentHits,
      trialHits,
      signalHits,
      totalHits: paperHits + grantHits + patentHits + trialHits + signalHits
    };
  }

  function getTopicHits(topic) {
    if (!topicHitsIndex) {
      topicHitsIndex = new Map(dashboard.topics.map(item => [item.id, computeTopicHits(item)]));
    }
    if (!topicHitsIndex.has(topic.id)) {
      topicHitsIndex.set(topic.id, computeTopicHits(topic));
    }
    return topicHitsIndex.get(topic.id);
  }

  function topicHeatmap() {
    const entries = dashboard.topics
      .filter(item => item.enabled)
      .map(topic => {
        const hits = getTopicHits(topic);
        const scoreValue = hits.paperHits * 3 + hits.grantHits * 2 + hits.patentHits * 2 + hits.trialHits * 3 + hits.signalHits * 4;
        return {
          name: topic.name,
          line: hits.line,
          score: scoreValue,
          note: `${hits.paperHits} papers · ${hits.grantHits} grants · ${hits.patentHits} patentes · ${hits.trialHits} ensayos · ${hits.signalHits} señales`
        };
      })
      .filter(item => item.score > 0)
      .sort((left, right) => right.score - left.score);
    return entries;
  }

  function mapTopicLine(topic) {
    const category = String(topic?.category || "general");
    if (category === "nano") return "MAP-Nano";
    if (category === "bio") return "MAP-Bio";
    if (category === "med") return "MAP-Med";
    if (category === "ing") return "MAP-Ing";
    return "General";
  }

  function recentRunTrend() {
    return [...dashboard.runs]
      .sort((left, right) => Date.parse(left.createdAt || 0) - Date.parse(right.createdAt || 0))
      .slice(-6)
      .map(run => ({
        id: run.id,
        label: window.BCCWorkspaceUtils.formatDate(run.finishedAt || run.startedAt || run.createdAt, { empty: "-", dateOptions: { month: "short", day: "2-digit" } }),
        fetched: Number(run.itemsFetched || 0),
        saved: Number(run.itemsCreated || 0) + Number(run.itemsUpdated || 0),
        signals: Number(run.signalsGenerated || 0),
        status: run.status || "pending"
      }));
  }

  function overviewStats() {
    const latestRun = lastRun();
    return {
      totalPapers: dashboard.overview.papersTracked || dashboard.papers.length,
      totalGrants: dashboard.overview.totalGrants || dashboard.grants.length,
      totalPatents: dashboard.overview.totalPatents || dashboard.patents.length,
      totalTrials: dashboard.overview.totalTrials || dashboard.trials.length,
      activeTopics: dashboard.topics.filter(item => item.enabled).length || dashboard.overview.priorityTopics || 0,
      newSignals: dashboard.signals.filter(item => ["new", "reviewing"].includes(item.status)).length || dashboard.overview.newSignals || 0,
      lastSyncLabel: latestRun ? window.BCCWorkspaceUtils.formatDateTime(latestRun.finishedAt || latestRun.startedAt || latestRun.createdAt, { empty: "-" }) : "Sin runs",
      lastSyncState: latestRun ? runStatusLabel(latestRun.status) : "Pendiente",
      topLine: computeTopLine()
    };
  }

  function signalsNeedingReview() {
    return sortedSignals().filter(item => ["new", "reviewing"].includes(item.status));
  }

  function signalReviewQueue() {
    return sortedSignals().sort((left, right) => prioritySignalScore(right) - prioritySignalScore(left));
  }

  function prioritySignalScore(signal) {
    const reviewBoost = signal.status === "new" ? 18 : signal.status === "reviewing" ? 10 : 0;
    return (
      Number(signal.opportunityScore || 0) * 0.45
      + Number(signal.actionabilityScore || 0) * 0.3
      + Number(signal.confidenceScore || 0) * 0.25
      + reviewBoost
    );
  }

  function averageScore(items, field) {
    if (!items.length) return "0%";
    const total = items.reduce((sum, item) => sum + (Number(item?.[field]) || 0), 0);
    return `${Math.round(total / items.length)}%`;
  }

  function overviewBriefing({ latestRun, reviewSignals, recentErrors, sourceWatch, hotTopics }) {
    const items = [];
    if (reviewSignals.length) {
      const lead = reviewSignals[0];
      items.push({
        label: "Revisar ahora",
        title: lead.title || "Señal pendiente",
        note: `${signalTypeLabel(lead.signalType)} · ${lead.relatedLine || "General"} · ${Math.round(Number(lead.opportunityScore || 0))} de oportunidad`
      });
    }
    if (recentErrors.length) {
      const errorRun = recentErrors[0];
      items.push({
        label: "Fallos a vigilar",
        title: actionLabel(errorRun.actionType),
        note: `Último fallo ${window.BCCWorkspaceUtils.formatDateTime(errorRun.finishedAt || errorRun.createdAt, { empty: "-" })}`
      });
    }
    if (sourceWatch.length) {
      const source = sourceWatch[0];
      items.push({
        label: source.label,
        title: source.title,
        note: source.note
      });
    }
    if (!items.length && hotTopics.length) {
      const topic = hotTopics[0];
      items.push({
        label: "Tema en tendencia",
        title: topic.name,
        note: topic.note
      });
    }
    if (!items.length) {
      items.push({
        label: "Listo",
        title: "Radar estable",
        note: "No hay señales nuevas ni fallos recientes. El siguiente paso es correr sync o revisar Topics."
      });
    }
    return {
      title: reviewSignals.length
        ? `${reviewSignals.length} señal(es) requieren criterio humano`
        : latestRun?.status === "failed"
          ? "El radar necesita atención operativa"
          : "El radar está listo para el próximo ciclo",
      summary: recentErrors.length
        ? "Hay fallos recientes o fuentes que merecen revisión antes de confiar en el siguiente sync."
        : reviewSignals.length
          ? "La cola actual ya tiene señales con suficiente densidad como para decidir si se aceptan, archivan o rechazan."
          : "El panel está en estado limpio. Puedes correr sync, revisar señales aceptadas o ajustar topics y sources.",
      items: items.slice(0, 3)
    };
  }

  function sourceWatchItems() {
    const failed = failedRuns();
    const enabledSources = dashboard.sources.filter(item => item.enabled);
    const items = [];
    if (failed.length) {
      items.push({
        label: "Fallo de run",
        title: actionLabel(failed[0].actionType),
        state: runStatusLabel(failed[0].status),
        note: failed[0].errorMessage || "Run fallido sin detalle adicional."
      });
    }
    enabledSources
      .filter(item => !item.lastSyncAt)
      .slice(0, 2)
      .forEach(item => {
        items.push({
          label: "Sin sync todavía",
          title: item.name,
          state: item.requiresApiKey ? "Revisar credenciales" : "Pendiente de primer éxito",
          note: item.rateLimitNotes || "La fuente sigue habilitada pero todavía no registra un sync exitoso."
        });
      });
    enabledSources
      .filter(item => item.requiresApiKey)
      .slice(0, 2)
      .forEach(item => {
        items.push({
          label: "Sensible a cuota",
          title: item.name,
          state: "Vigilar límites",
          note: item.rateLimitNotes || "Conviene mantener límites bajos y runs específicos para esta fuente."
        });
      });
    return dedupeWatchItems(items).slice(0, 4);
  }

  function dedupeWatchItems(items) {
    const seen = new Set();
    return items.filter(item => {
      const key = `${item.label}|${item.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function cutoffDate(range) {
    if (!range || range === "all") return null;
    const days = Number(range);
    if (!Number.isFinite(days) || days <= 0) return null;
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date;
  }

  function sourceHost(url) {
    try {
      return new URL(String(url || ""), window.location.origin).hostname.replace(/^www\./, "") || "-";
    } catch {
      return "-";
    }
  }

  function pickDateRange(days) {
    if (days <= 30) return 30;
    if (days <= 90) return 90;
    if (days <= 180) return 180;
    if (days <= 365) return 365;
    return 365;
  }

  function existingOrFirst(id, items) {
    return items.some(item => item.id === id) ? id : items[0]?.id || "";
  }

  function upsertById(collection, item) {
    const index = collection.findIndex(entry => entry.id === item.id);
    if (index >= 0) collection.splice(index, 1, item);
    else collection.unshift(item);
  }

  function normalizeSearchValue(value) {
    if (Array.isArray(value)) return value.join(" ");
    return String(value || "");
  }

  function normalizeTopicMatchValue(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function topicMatchTerms(topicOrName) {
    if (typeof topicOrName === "string") {
      const topic = dashboard.topics.find(item => item.name === topicOrName);
      if (!topic) return [normalizeTopicMatchValue(topicOrName)].filter(Boolean);
      topicOrName = topic;
    }
    const values = [
      topicOrName?.name,
      ...(Array.isArray(topicOrName?.keywords) ? topicOrName.keywords : [])
    ];
    return [...new Set(values.map(normalizeTopicMatchValue).filter(Boolean))];
  }

  function itemTopicHaystack(item, fields = []) {
    return fields
      .map(field => normalizeSearchValue(item?.[field]))
      .join(" ")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function itemMatchesTopic(item, topicOrName, fields = []) {
    const explicitTopics = Array.isArray(item?.topics) ? item.topics.map(normalizeTopicMatchValue) : [];
    const terms = topicMatchTerms(topicOrName);
    if (!terms.length) return false;
    if (terms.some(term => explicitTopics.includes(term))) return true;
    const haystack = itemTopicHaystack(item, fields);
    return terms.some(term => term && haystack.includes(term));
  }

  function fieldValue(form, name) {
    return String(form?.elements?.namedItem(name)?.value || "");
  }

  function fieldChecked(form, name) {
    return Boolean(form?.elements?.namedItem(name)?.checked);
  }

  function fieldValues(form, name) {
    return [...form.querySelectorAll(`[name="${name}"]:checked`)].map(input => String(input.value || ""));
  }

  function readTopicForm(form) {
    return {
      id: fieldValue(form, "id"),
      name: fieldValue(form, "name"),
      description: fieldValue(form, "description"),
      category: fieldValue(form, "category"),
      keywords: splitCsv(fieldValue(form, "keywords")),
      enabled: fieldChecked(form, "enabled")
    };
  }

  function readSettingsForm(form) {
    return {
      maxResultsPerSource: Number(fieldValue(form, "maxResultsPerSource") || 20),
      defaultDateRangeDays: Number(fieldValue(form, "defaultDateRangeDays") || 90),
      suggestedFrequency: fieldValue(form, "suggestedFrequency") || "daily",
      defaultDryRun: fieldChecked(form, "defaultDryRun"),
      scoringThresholds: {
        opportunity: Number(fieldValue(form, "thresholdOpportunity") || 60),
        actionability: Number(fieldValue(form, "thresholdActionability") || 50),
        confidence: Number(fieldValue(form, "thresholdConfidence") || 50)
      },
      monitoredLines: fieldValues(form, "monitoredLines")
    };
  }

  function splitCsv(value) {
    return [...new Set(String(value || "").split(",").map(item => item.trim()).filter(Boolean))];
  }

  window.BCCWorkspaceIntelligenceState = {
    get currentUser() { return currentUser; },
    set currentUser(value) { currentUser = value; },
    get currentPanel() { return currentPanel; },
    set currentPanel(value) { currentPanel = value; },
    get currentAction() { return currentAction; },
    set currentAction(value) { currentAction = value; },
    get syncDryRun() { return syncDryRun; },
    set syncDryRun(value) { syncDryRun = value; },
    get selectedSignalId() { return selectedSignalId; },
    set selectedSignalId(value) { selectedSignalId = value; },
    get selectedTopicId() { return selectedTopicId; },
    set selectedTopicId(value) { selectedTopicId = value; },
    get selectedSourceId() { return selectedSourceId; },
    set selectedSourceId(value) { selectedSourceId = value; },
    get filters() { return filters; },
    set filters(value) { filters = value; },
    get visibleCounts() { return visibleCounts; },
    set visibleCounts(value) { visibleCounts = value; },
    get dashboard() { return dashboard; },
    set dashboard(value) { dashboard = value; },
    get selectedBulkSignalIds() { return selectedBulkSignalIds; },
    invalidateTopicHits() { topicHitsIndex = null; },

    emptyDashboard,
    defaultSettings,
    defaultFilters,
    normalizeDashboard,
    applyDashboardState,
    normalizeFiltersState,
    cacheStorageKey,
    readDashboardCache,
    writeDashboardCache,
    hasDashboardContent,
    snapshotAgeLabel,

    filteredPapers,
    filteredGrants,
    filteredPatents,
    filteredTrials,
    applyResearchFilters,
    sortPapers,
    selectedSignal,
    selectedTopic,
    selectedSource,
    sortedSignals,
    failedRuns,
    lastRun,
    computeTopLine,
    deriveLine,
    directTopicLine,
    lineFromCategory,
    uniqueSourcesFromPapers,
    paperInsights,
    paperTopSources,
    topicOptions,
    monitoredLines,
    panelLabel,
    actionLabel,
    signalTypeLabel,
    signalStatusLabel,
    topicCategoryLabel,
    runStatusLabel,
    signalStatusTone,
    shortLineLabel,
    sourceStatus,
    topicPortfolio,
    topicInsight,
    sourcePortfolio,
    sourceInsight,
    getTopicHits,
    topicHeatmap,
    mapTopicLine,
    recentRunTrend,
    overviewStats,
    signalsNeedingReview,
    signalReviewQueue,
    prioritySignalScore,
    averageScore,
    overviewBriefing,
    sourceWatchItems,
    dedupeWatchItems,
    cutoffDate,
    sourceHost,
    pickDateRange,
    existingOrFirst,
    upsertById,
    normalizeSearchValue,
    normalizeTopicMatchValue,
    topicMatchTerms,
    itemTopicHaystack,
    itemMatchesTopic,
    fieldValue,
    fieldChecked,
    fieldValues,
    readTopicForm,
    readSettingsForm,
    splitCsv
  };
})();
