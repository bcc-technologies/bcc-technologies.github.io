/* Domain constants for the Science Radar (Intelligence) workspace feature. */
(() => {
  const PANELS = ["overview", "signals", "papers", "grants", "patents", "trials", "institutions", "topics", "sources", "settings"];
  // Enable only after the dossier migration has been applied and verified.
  const OPPORTUNITIES_ENABLED = window.BCC_SCIENCE_RADAR_PILOT_ENABLED === true;
  if (OPPORTUNITIES_ENABLED) PANELS.splice(2, 0, "opportunities");
  const NAV_GROUPS = [
    { label: "Revisar", panels: ["overview", "signals", "opportunities"] },
    { label: "Explorar", panels: ["papers", "grants", "patents", "trials", "institutions"] },
    { label: "Configurar", panels: ["topics", "sources", "settings"] }
  ].map(group => ({ ...group, panels: group.panels.filter(panel => PANELS.includes(panel)) }));

  const RUN_ACTIONS = [
    { id: "sync_papers", label: "Sincronizar Intelligence" },
    { id: "fetch_papers", label: "Obtener papers recientes" },
    { id: "fetch_grants", label: "Obtener grants" },
    { id: "fetch_patents", label: "Obtener patentes" },
    { id: "fetch_trials", label: "Obtener ensayos" },
    { id: "generate_signals", label: "Generar señales" }
  ];

  const SIGNAL_STATUS_ACTIONS = [
    { id: "accepted", label: "Aceptar", tone: "primary" },
    { id: "rejected", label: "Rechazar", tone: "ghost" },
    { id: "archived", label: "Archivar", tone: "ghost" },
    { id: "reviewing", label: "Marcar en revisión", tone: "ghost" }
  ];

  const SIGNAL_STATUS_LABELS = {
    new: "Nueva",
    reviewing: "En revisión",
    accepted: "Aceptada",
    rejected: "Rechazada",
    archived: "Archivada"
  };

  const SIGNAL_TYPE_LABELS = {
    product_opportunity: "Oportunidad de producto",
    market_trend: "Tendencia de mercado",
    research_trend: "Tendencia de investigación",
    partnership: "Alianza",
    content_idea: "Idea de contenido",
    competitive_risk: "Riesgo competitivo",
    grant_opportunity: "Oportunidad de grant"
  };

  const TOPIC_CATEGORY_LABELS = {
    nano: "Nano",
    bio: "Bio",
    med: "Med",
    ing: "Ing",
    general: "General"
  };

  const SETTINGS_FREQUENCY_LABELS = {
    daily: "Diaria",
    weekly: "Semanal",
    biweekly: "Quincenal",
    monthly: "Mensual"
  };

  const DEFAULT_LINES = ["MAP-Nano", "MAP-Bio", "MAP-Med", "MAP-Ing", "MAPs", "General"];

  const DATE_RANGE_OPTIONS = [
    { value: "30", label: "30d" },
    { value: "90", label: "90d" },
    { value: "180", label: "180d" },
    { value: "365", label: "1y" },
    { value: "all", label: "Todo" }
  ];

  // Papers/grants/patents/trials render every filtered match with no cap --
  // fine when the dashboard fetch was capped at 200 rows, but raising that
  // limit (to stop hiding data from topic analytics) means clearing filters
  // can now paint hundreds of full cards/rows in one DOM update. Panels
  // render only visibleCounts[panel] items and reveal more via "Cargar más".
  const RESEARCH_PAGE_SIZE = { papers: 20, grants: 50, patents: 50, trials: 50, signals: 18 };

  const SIGNAL_SORT_OPTIONS = [
    { value: "priority", label: "Prioridad de revisión" },
    { value: "opportunity", label: "Mayor oportunidad" },
    { value: "recent", label: "Más recientes" }
  ];

  window.BCCWorkspaceIntelligenceConstants = Object.freeze({
    PANELS,
    NAV_GROUPS,
    OPPORTUNITIES_ENABLED,
    RUN_ACTIONS,
    SIGNAL_STATUS_ACTIONS,
    SIGNAL_STATUS_LABELS,
    SIGNAL_TYPE_LABELS,
    SIGNAL_SORT_OPTIONS,
    TOPIC_CATEGORY_LABELS,
    SETTINGS_FREQUENCY_LABELS,
    DEFAULT_LINES,
    DATE_RANGE_OPTIONS,
    RESEARCH_PAGE_SIZE
  });
})();
