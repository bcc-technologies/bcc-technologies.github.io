(() => {
  const INTELLIGENCE_TIMEOUT_MS = 12000;
  const INTELLIGENCE_CACHE_VERSION = 1;
  const INTELLIGENCE_CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;
  const PANELS = ["overview", "signals", "papers", "grants", "patents", "institutions", "topics", "sources", "settings"];
  const RUN_ACTIONS = [
    { id: "sync_papers", label: "Run Intelligence Sync" },
    { id: "fetch_papers", label: "Fetch latest papers" },
    { id: "fetch_grants", label: "Fetch grants" },
    { id: "fetch_patents", label: "Fetch patents" },
    { id: "generate_signals", label: "Generate signals" }
  ];
  const SIGNAL_STATUS_ACTIONS = [
    { id: "accepted", label: "Accept", tone: "primary" },
    { id: "rejected", label: "Reject", tone: "ghost" },
    { id: "archived", label: "Archive", tone: "ghost" },
    { id: "reviewing", label: "Mark reviewing", tone: "ghost" }
  ];
  const SIGNAL_STATUS_LABELS = {
    new: "New",
    reviewing: "Reviewing",
    accepted: "Accepted",
    rejected: "Rejected",
    archived: "Archived"
  };
  const SIGNAL_TYPE_LABELS = {
    product_opportunity: "Product opportunity",
    market_trend: "Market trend",
    research_trend: "Research trend",
    partnership: "Partnership",
    content_idea: "Content idea",
    competitive_risk: "Competitive risk",
    grant_opportunity: "Grant opportunity"
  };
  const TOPIC_CATEGORY_LABELS = {
    nano: "Nano",
    bio: "Bio",
    med: "Med",
    ing: "Ing",
    general: "General"
  };
  const SETTINGS_FREQUENCY_LABELS = {
    daily: "Daily",
    weekly: "Weekly",
    biweekly: "Biweekly",
    monthly: "Monthly"
  };
  const DEFAULT_LINES = ["MAP-Nano", "MAP-Bio", "MAP-Med", "MAP-Ing", "MAPs", "General"];
  const DATE_RANGE_OPTIONS = [
    { value: "30", label: "30d" },
    { value: "90", label: "90d" },
    { value: "180", label: "180d" },
    { value: "365", label: "1y" },
    { value: "all", label: "Todo" }
  ];

  let root = null;
  let currentUser = null;
  let currentPanel = "overview";
  let currentAction = "sync_papers";
  let syncDryRun = false;
  let runningSync = false;
  let selectedSignalId = "";
  let selectedTopicId = "";
  let selectedSourceId = "";
  let filters = {};
  let dashboard = emptyDashboard();

  function init(account) {
    root = document.querySelector("[data-intelligence-workspace]");
    if (!root || root.dataset.ready === "true") return;
    root.dataset.ready = "true";
    currentUser = account;
    renderShell();
    bindControls();
    void loadDashboard();
  }

  function emptyDashboard() {
    return {
      overview: {
        papersTracked: 0,
        totalGrants: 0,
        totalPatents: 0,
        priorityTopics: 0,
        newSignals: 0
      },
      sources: [],
      papers: [],
      grants: [],
      patents: [],
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
      papers: { topic: "", source: "", line: "", dateRange, keyword: "" },
      grants: { topic: "", line: "", dateRange, keyword: "" },
      patents: { topic: "", line: "", dateRange, keyword: "" }
    };
  }

  function renderShell() {
    root.innerHTML = `
      <section class="users-surface intelligence-surface">
        <div class="surface-toolbar intelligence-toolbar">
          <div>
            <h2>Intelligence</h2>
            <p class="muted-text" data-intelligence-message>Cargando intelligence...</p>
          </div>
          <div class="intelligence-controls">
            <label class="intelligence-inline-field">
              <span>Action</span>
              <select data-intelligence-action aria-label="Seleccionar acción de sync">
                ${RUN_ACTIONS.map(action => `<option value="${escapeHtml(action.id)}">${escapeHtml(action.label)}</option>`).join("")}
              </select>
            </label>
            <label class="intelligence-toggle intelligence-toggle-compact">
              <input type="checkbox" data-intelligence-dry-run />
              <span>Dry-run</span>
            </label>
            <button class="btn btn-primary" type="button" data-intelligence-run>
              <i data-lucide="radar"></i>Run sync
            </button>
            <button class="btn btn-ghost btn-compact" type="button" data-intelligence-refresh>Actualizar</button>
          </div>
        </div>
        <nav class="intelligence-nav" aria-label="Secciones de intelligence">
          ${PANELS.map(panel => `
            <button class="intelligence-nav-chip${panel === currentPanel ? " is-active" : ""}" type="button" data-panel-target="${escapeHtml(panel)}">
              ${escapeHtml(panelLabel(panel))}
            </button>
          `).join("")}
        </nav>
        <section class="intelligence-panels">
          <section class="intelligence-panel" data-intelligence-panel="overview"></section>
          <section class="intelligence-panel is-hidden" data-intelligence-panel="signals"></section>
          <section class="intelligence-panel is-hidden" data-intelligence-panel="papers"></section>
          <section class="intelligence-panel is-hidden" data-intelligence-panel="grants"></section>
          <section class="intelligence-panel is-hidden" data-intelligence-panel="patents"></section>
          <section class="intelligence-panel is-hidden" data-intelligence-panel="institutions"></section>
          <section class="intelligence-panel is-hidden" data-intelligence-panel="topics"></section>
          <section class="intelligence-panel is-hidden" data-intelligence-panel="sources"></section>
          <section class="intelligence-panel is-hidden" data-intelligence-panel="settings"></section>
        </section>
      </section>
    `;
    refreshIcons();
  }

  function bindControls() {
    root.addEventListener("click", handleClick);
    root.addEventListener("change", handleChange);
    root.addEventListener("submit", handleSubmit);
  }

  async function loadDashboard() {
    const cached = readDashboardCache();
    const hadSnapshot = hasDashboardContent(dashboard);
    if (cached) {
      applyDashboardState(cached.dashboard, { persist: false });
      setMessage(`Mostrando snapshot guardado (${snapshotAgeLabel(cached.savedAt)}) mientras se actualiza...`, "neutral");
      renderAll();
    } else if (hadSnapshot) {
      setMessage("Actualizando intelligence...", "neutral");
      renderAll();
    } else {
      setMessage("Cargando intelligence...", "neutral");
    }
    try {
      const data = await withTimeout(
        window.BCCAuth.api("/api/admin/intelligence/dashboard"),
        INTELLIGENCE_TIMEOUT_MS,
        "Supabase no respondio a tiempo al cargar intelligence."
      );
      applyDashboardState(data.dashboard);
      setMessage(cached ? "Intelligence actualizado. Snapshot refrescado correctamente." : "");
      renderAll();
    } catch (error) {
      if (cached || hadSnapshot || hasDashboardContent(dashboard)) {
        setMessage(`${intelligenceError(error)} Mostrando snapshot guardado para mantener la vista estable.`, "error");
        renderAll();
        return;
      }
      dashboard = emptyDashboard();
      filters = Object.keys(filters).length ? filters : defaultFilters("90");
      setMessage(intelligenceError(error), "error");
      renderAll();
    }
  }

  function normalizeDashboard(data) {
    const payload = data && typeof data === "object" ? data : {};
    return {
      overview: payload.overview || emptyDashboard().overview,
      sources: Array.isArray(payload.sources) ? payload.sources : [],
      papers: Array.isArray(payload.papers) ? payload.papers : [],
      grants: Array.isArray(payload.grants) ? payload.grants : [],
      patents: Array.isArray(payload.patents) ? payload.patents : [],
      institutions: Array.isArray(payload.institutions) ? payload.institutions : [],
      topics: Array.isArray(payload.topics) ? payload.topics : [],
      signals: Array.isArray(payload.signals) ? payload.signals : [],
      runs: Array.isArray(payload.runs) ? payload.runs : [],
      settings: { ...defaultSettings(), ...(payload.settings || {}) }
    };
  }

  function applyDashboardState(nextDashboard, options = {}) {
    dashboard = normalizeDashboard(nextDashboard);
    syncDryRun = dashboard.settings.defaultDryRun;
    filters = Object.keys(filters).length ? filters : defaultFilters(String(pickDateRange(dashboard.settings.defaultDateRangeDays)));
    currentAction = RUN_ACTIONS.some(action => action.id === currentAction) ? currentAction : "sync_papers";
    selectedSignalId = existingOrFirst(selectedSignalId, dashboard.signals);
    selectedTopicId = existingOrFirst(selectedTopicId, dashboard.topics);
    selectedSourceId = existingOrFirst(selectedSourceId, dashboard.sources);
    if (options.persist !== false) writeDashboardCache(dashboard);
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

  function renderAll() {
    syncActionField().value = currentAction;
    dryRunField().checked = syncDryRun;
    renderPanels();
    refreshIcons();
  }

  function renderPanels() {
    PANELS.forEach(panel => {
      const target = panelRoot(panel);
      if (!target) return;
      target.classList.toggle("is-hidden", panel !== currentPanel);
    });
    navChips().forEach(button => {
      button.classList.toggle("is-active", button.dataset.panelTarget === currentPanel);
    });
    renderOverview();
    renderSignals();
    renderPapers();
    renderGrants();
    renderPatents();
    renderInstitutions();
    renderTopics();
    renderSources();
    renderSettings();
  }

  function renderOverview() {
    const target = panelRoot("overview");
    if (!target) return;
    const latestRun = lastRun();
    const prioritizedSignals = signalReviewQueue();
    const recentSignals = prioritizedSignals.slice(0, 5);
    const recentErrors = failedRuns().slice(0, 5);
    const reviewSignals = signalsNeedingReview();
    const sourceWatch = sourceWatchItems().slice(0, 4);
    const hotTopics = topicHeatmap();
    const heatTopicsPreview = hotTopics.slice(0, 4);
    const runTrend = recentRunTrend();
    const stats = overviewStats();
    const briefing = overviewBriefing({ latestRun, reviewSignals, recentErrors, sourceWatch, hotTopics: heatTopicsPreview });

    target.innerHTML = `
      <section class="workspace-metrics intelligence-metrics" aria-label="Resumen de intelligence">
        <div><span>Total papers</span><strong>${number(stats.totalPapers)}</strong><small>Repositorio actual</small></div>
        <div><span>Total grants</span><strong>${number(stats.totalGrants)}</strong><small>Oportunidades y awards</small></div>
        <div><span>Total patents</span><strong>${number(stats.totalPatents)}</strong><small>Patentes y solicitudes</small></div>
        <div><span>Active topics</span><strong>${number(stats.activeTopics)}</strong><small>Radar habilitado</small></div>
        <div><span>New signals</span><strong>${number(stats.newSignals)}</strong><small>New + reviewing</small></div>
        <div><span>Last sync</span><strong>${escapeHtml(stats.lastSyncLabel)}</strong><small>${escapeHtml(stats.lastSyncState)}</small></div>
        <div><span>Top related line</span><strong>${escapeHtml(stats.topLine)}</strong><small>Mayor densidad actual</small></div>
      </section>
      <section class="intelligence-grid intelligence-grid-overview">
        <article class="activity-surface intelligence-card intelligence-card-hero intelligence-briefing-card">
          <div class="intelligence-briefing-head">
            <div>
              <span class="intelligence-kicker">Radar briefing</span>
              <h3>${escapeHtml(briefing.title)}</h3>
              <p>${escapeHtml(briefing.summary)}</p>
            </div>
            <span class="intelligence-status-pill">${escapeHtml(runStatusLabel(latestRun?.status || "idle"))}</span>
          </div>
          <div class="intelligence-briefing-metrics">
            <div><span>Needs review</span><strong>${number(reviewSignals.length)}</strong><small>New + reviewing</small></div>
            <div><span>Source watch</span><strong>${number(sourceWatch.length)}</strong><small>Fuentes con atención</small></div>
            <div><span>Recent failures</span><strong>${number(recentErrors.length)}</strong><small>Runs fallidos recientes</small></div>
            <div><span>Hot topics</span><strong>${number(hotTopics.length)}</strong><small>Temas con mayor tracción</small></div>
          </div>
          <ol class="intelligence-priority-list">
            ${briefing.items.map(item => `
              <li class="intelligence-priority-item">
                <span>${escapeHtml(item.label)}</span>
                <strong>${escapeHtml(item.title)}</strong>
                <p>${escapeHtml(item.note)}</p>
              </li>
            `).join("")}
          </ol>
        </article>
        <article class="activity-surface intelligence-card intelligence-card-wide">
          <div class="activity-head">
            <h3>Signal map</h3>
            <span>${number(prioritizedSignals.length)}</span>
          </div>
          ${signalsMatrixMarkup(prioritizedSignals)}
        </article>
        <article class="activity-surface intelligence-card">
          <div class="activity-head">
            <h3>Sync state</h3>
            <span>${escapeHtml(latestRun ? runStatusLabel(latestRun.status) : "Sin runs")}</span>
          </div>
          <div class="intelligence-mini-metrics intelligence-mini-metrics-tight">
            <div><span>Action</span><strong>${escapeHtml(actionLabel(latestRun?.actionType || currentAction))}</strong></div>
            <div><span>Items found</span><strong>${number(latestRun?.itemsFetched || 0)}</strong></div>
            <div><span>Items saved</span><strong>${number((latestRun?.itemsCreated || 0) + (latestRun?.itemsUpdated || 0))}</strong></div>
            <div><span>Signals generated</span><strong>${number(latestRun?.signalsGenerated || 0)}</strong></div>
          </div>
          ${latestRun ? `
            <div class="intelligence-focus-list">
              <div class="intelligence-focus-item">
                <span>${escapeHtml(latestRun.dryRun ? "Dry-run" : "Run")}</span>
                <strong>${escapeHtml(formatDateTime(latestRun.finishedAt || latestRun.startedAt || latestRun.createdAt))}</strong>
                <p>${escapeHtml(latestRun.errorMessage ? "La última ejecución terminó con error." : "La última ejecución ya quedó registrada en el radar.")}</p>
              </div>
            </div>
          ` : emptyMarkup("Todavía no hay runs", "Usa Run sync para lanzar el radar y empezar a llenar el log.")}
        </article>
        <article class="activity-surface intelligence-card">
          <div class="activity-head">
            <h3>Runs trend</h3>
            <span>${number(runTrend.length)}</span>
          </div>
          ${runsTrendMarkup(runTrend)}
        </article>
        <article class="activity-surface intelligence-card">
          <div class="activity-head">
            <h3>Review queue</h3>
            <span>${number(reviewSignals.length)}</span>
          </div>
          ${reviewSignals.length ? `
            <div class="intelligence-queue-list">
              ${reviewSignals.slice(0, 4).map(signal => `
                <article class="intelligence-queue-item" data-signal-select="${escapeAttr(signal.id)}">
                  <div class="intelligence-stack-meta">
                    <span>${escapeHtml(signalTypeLabel(signal.signalType))}</span>
                    <strong>${escapeHtml(signal.relatedLine || "General")}</strong>
                  </div>
                  <h4>${escapeHtml(signal.title)}</h4>
                  <p>${escapeHtml(signal.summary || signal.recommendedAction || "Sin resumen todavía.")}</p>
                  <div class="intelligence-queue-meters">
                    ${metricBar("Opportunity", signal.opportunityScore)}
                    ${metricBar("Actionability", signal.actionabilityScore)}
                    ${metricBar("Confidence", signal.confidenceScore)}
                  </div>
                </article>
              `).join("")}
            </div>
          ` : emptyMarkup("No signals waiting for review", "Cuando haya señales nuevas o en revisión, aparecerán aquí como cola de trabajo.")}
        </article>
        <article class="activity-surface intelligence-card">
          <div class="activity-head">
            <h3>Source watch</h3>
            <span>${number(sourceWatch.length)}</span>
          </div>
          ${sourceWatch.length ? `
            <div class="intelligence-stack-list">
              ${sourceWatch.map(item => `
                <article class="intelligence-stack-card">
                  <div class="intelligence-stack-meta">
                    <span>${escapeHtml(item.label)}</span>
                    <strong>${escapeHtml(item.state)}</strong>
                  </div>
                  <h4>${escapeHtml(item.title)}</h4>
                  <p>${escapeHtml(item.note)}</p>
                </article>
              `).join("")}
            </div>
          ` : emptyMarkup("Fuentes estables", "No hay fuentes deshabilitadas o sin sync visible en este momento.")}
        </article>
        <article class="activity-surface intelligence-card">
          <div class="activity-head">
            <h3>Hot topics</h3>
            <span>${number(heatTopicsPreview.length)}</span>
          </div>
          ${hotTopics.length ? `
            ${topicHeatmapMarkup(hotTopics.slice(0, 8))}
            <div class="intelligence-stack-list">
              ${heatTopicsPreview.map(topic => `
                <article class="intelligence-stack-card">
                  <div class="intelligence-stack-meta">
                    <span>${escapeHtml(topic.line)}</span>
                    <strong>${number(topic.score)}</strong>
                  </div>
                  <h4>${escapeHtml(topic.name)}</h4>
                  <p>${escapeHtml(topic.note)}</p>
                </article>
              `).join("")}
            </div>
          ` : emptyMarkup("No topics heating up yet", "Cuando papers y señales empiecen a concentrarse, aparecerán aquí para orientar prioridad.")}
        </article>
        <article class="activity-surface intelligence-card intelligence-card-wide">
          <div class="activity-head">
            <h3>Recent strategic signals</h3>
            <span>${number(recentSignals.length)}</span>
          </div>
          ${recentSignals.length ? `
            <div class="intelligence-signal-showcase">
              ${recentSignals.map(signal => `
                <article class="intelligence-signal-showcase-item" data-signal-select="${escapeAttr(signal.id)}">
                  <div class="intelligence-stack-meta">
                    <span>${escapeHtml(signalTypeLabel(signal.signalType))}</span>
                    <strong>${escapeHtml(signal.relatedLine || "General")}</strong>
                  </div>
                  <h4>${escapeHtml(signal.title)}</h4>
                  <p>${escapeHtml(signal.summary || signal.recommendedAction || "Sin resumen todavía.")}</p>
                  <div class="intelligence-mini-metrics intelligence-mini-metrics-tight">
                    <div><span>Opp.</span><strong>${score(signal.opportunityScore)}</strong></div>
                    <div><span>Act.</span><strong>${score(signal.actionabilityScore)}</strong></div>
                    <div><span>Conf.</span><strong>${score(signal.confidenceScore)}</strong></div>
                    <div><span>Status</span><strong>${escapeHtml(signalStatusLabel(signal.status))}</strong></div>
                  </div>
                </article>
              `).join("")}
            </div>
          ` : emptyMarkup("No strategic signals generated yet.", "Run the first sync or execute Generate signals to produce strategic opportunities.", [
            { label: "Run first sync", cta: "run-sync" }
          ])}
        </article>
      </section>
    `;
  }

  function renderSignals() {
    const target = panelRoot("signals");
    if (!target) return;
    const signals = sortedSignals();
    const selected = selectedSignal();
    target.innerHTML = `
      <section class="intelligence-signal-stage">
        <article class="activity-surface intelligence-card intelligence-signal-rail">
          <div class="activity-head">
            <h3>Signal queue</h3>
            <span>${number(signals.length)}</span>
          </div>
          <div class="intelligence-signal-summary">
            <div><span>Need review</span><strong>${number(signalsNeedingReview().length)}</strong></div>
            <div><span>Accepted</span><strong>${number(signals.filter(item => item.status === "accepted").length)}</strong></div>
            <div><span>Avg opp.</span><strong>${averageScore(signals, "opportunityScore")}</strong></div>
          </div>
          ${signals.length ? `
            <div class="intelligence-signal-rail-note">
              <p>La cola está ordenada para revisión humana. Empieza por señales con mejor combinación de oportunidad, actionability y confidence.</p>
            </div>
          ` : ""}
          ${signals.length ? `
            <div class="intelligence-signal-queue">
              ${signals.map(signal => `
                <article class="intelligence-signal-card${signal.id === selectedSignalId ? " is-selected" : ""}" data-signal-select="${escapeAttr(signal.id)}">
                  <div class="intelligence-stack-meta">
                    <span>${escapeHtml(signalTypeLabel(signal.signalType))}</span>
                    <strong>${escapeHtml(signal.relatedLine || "General")}</strong>
                  </div>
                  <h4>${escapeHtml(signal.title)}</h4>
                  <p>${escapeHtml(signal.summary || "Sin resumen todavía.")}</p>
                  <div class="intelligence-signal-card-meta">
                    <span class="intelligence-status-pill">${escapeHtml(signalStatusLabel(signal.status))}</span>
                    <small>${escapeHtml(formatDateTime(signal.updatedAt || signal.createdAt))}</small>
                  </div>
                  <div class="intelligence-queue-meters">
                    ${metricBar("Opportunity", signal.opportunityScore)}
                    ${metricBar("Actionability", signal.actionabilityScore)}
                    ${metricBar("Confidence", signal.confidenceScore)}
                  </div>
                </article>
              `).join("")}
            </div>
          ` : emptyMarkup("No strategic signals generated yet.", "Run the first sync or execute Generate signals to produce strategic opportunities.")}
        </article>
        <article class="activity-surface intelligence-card intelligence-signal-detail">
          <div class="activity-head intelligence-detail-head">
            <h3>Signal detail</h3>
            <span>${escapeHtml(selected ? signalStatusLabel(selected.status) : "Sin selección")}</span>
          </div>
          ${selected ? signalDetailMarkup(selected) : emptyMarkup("Selecciona una señal", "Elige una fila para revisar evidencia, scores y acciones sugeridas.")}
        </article>
      </section>
    `;
  }

  function renderPapers() {
    renderResearchTable("papers", {
      title: "Papers",
      items: filteredPapers(),
      filters: filters.papers,
      sourceOptions: uniqueSourcesFromPapers(),
      rows: item => `
        <tr>
          <td><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.abstract || "Sin abstract")}</small></td>
          <td>${escapeHtml(formatDate(item.publicationDate))}</td>
          <td>${escapeHtml(item.sourceName || sourceHost(item.sourceUrl))}</td>
          <td>${escapeHtml(joinList(item.authors, 3))}</td>
          <td>${escapeHtml(joinList(item.institutions, 2))}</td>
          <td>${topicPills(item.topics)}</td>
          <td>${number(item.citationsCount || 0)}</td>
          <td><a href="${escapeAttr(safeExternalUrl(item.sourceUrl || item.openAccessUrl || "#"))}" target="_blank" rel="noopener noreferrer">Abrir</a></td>
        </tr>
      `
    });
  }

  function renderGrants() {
    renderResearchTable("grants", {
      title: "Grants",
      items: filteredGrants(),
      filters: filters.grants,
      rows: item => `
        <tr>
          <td><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.abstract || "Sin abstract")}</small></td>
          <td>${escapeHtml(formatDate(item.startDate || item.endDate))}</td>
          <td>${escapeHtml(item.agency || sourceHost(item.sourceUrl))}</td>
          <td>${escapeHtml(joinList(item.principalInvestigators, 3))}</td>
          <td>${escapeHtml(joinList(item.institutions, 2))}</td>
          <td>${topicPills(item.topics)}</td>
          <td>${escapeHtml(item.amount ? `${number(item.amount)} ${item.currency || ""}`.trim() : "-")}</td>
          <td><a href="${escapeAttr(safeExternalUrl(item.sourceUrl || "#"))}" target="_blank" rel="noopener noreferrer">Abrir</a></td>
        </tr>
      `
    });
  }

  function renderPatents() {
    renderResearchTable("patents", {
      title: "Patents",
      items: filteredPatents(),
      filters: filters.patents,
      rows: item => `
        <tr>
          <td><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.abstract || "Sin abstract")}</small></td>
          <td>${escapeHtml(formatDate(item.publicationDate || item.filingDate))}</td>
          <td>${escapeHtml(item.jurisdiction || sourceHost(item.sourceUrl))}</td>
          <td>${escapeHtml(joinList(item.inventors, 3))}</td>
          <td>${escapeHtml(joinList(item.assignees, 2))}</td>
          <td>${topicPills(item.topics)}</td>
          <td>${escapeHtml(item.status || "-")}</td>
          <td><a href="${escapeAttr(safeExternalUrl(item.sourceUrl || "#"))}" target="_blank" rel="noopener noreferrer">Abrir</a></td>
        </tr>
      `
    });
  }

  function renderResearchTable(panelName, config) {
    const target = panelRoot(panelName);
    if (!target) return;
    const filterState = config.filters;
    target.innerHTML = `
      <article class="activity-surface intelligence-card intelligence-card-wide">
        <div class="activity-head">
          <h3>${escapeHtml(config.title)}</h3>
          <span>${number(config.items.length)}</span>
        </div>
        <div class="intelligence-filter-grid">
          <label class="intelligence-field">
            <span>Topic</span>
            <select data-intelligence-filter-panel="${escapeAttr(panelName)}" data-filter-field="topic">
              <option value="">Todos</option>
              ${topicOptions().map(topic => `<option value="${escapeHtml(topic.name)}"${topic.name === filterState.topic ? " selected" : ""}>${escapeHtml(topic.name)}</option>`).join("")}
            </select>
          </label>
          ${panelName === "papers" ? `
            <label class="intelligence-field">
              <span>Source</span>
              <select data-intelligence-filter-panel="${escapeAttr(panelName)}" data-filter-field="source">
                <option value="">Todas</option>
                ${config.sourceOptions.map(source => `<option value="${escapeHtml(source)}"${source === filterState.source ? " selected" : ""}>${escapeHtml(source)}</option>`).join("")}
              </select>
            </label>
          ` : ""}
          <label class="intelligence-field">
            <span>Line</span>
            <select data-intelligence-filter-panel="${escapeAttr(panelName)}" data-filter-field="line">
              <option value="">Todas</option>
              ${monitoredLines().map(line => `<option value="${escapeHtml(line)}"${line === filterState.line ? " selected" : ""}>${escapeHtml(line)}</option>`).join("")}
            </select>
          </label>
          <label class="intelligence-field">
            <span>Date range</span>
            <select data-intelligence-filter-panel="${escapeAttr(panelName)}" data-filter-field="dateRange">
              ${DATE_RANGE_OPTIONS.map(option => `<option value="${escapeHtml(option.value)}"${option.value === filterState.dateRange ? " selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
            </select>
          </label>
          <label class="intelligence-field intelligence-field-wide">
            <span>Keyword</span>
            <input type="search" data-intelligence-filter-panel="${escapeAttr(panelName)}" data-filter-field="keyword" value="${escapeAttr(filterState.keyword)}" placeholder="Buscar por título, abstract, autores, instituciones..." />
          </label>
        </div>
        <div class="table-scroll intelligence-table-wrap">
          <table class="account-table intelligence-table">
            <thead>
              <tr>
                <th>Título</th>
                <th>Fecha</th>
                <th>${panelName === "grants" ? "Agency" : panelName === "patents" ? "Jurisdiction" : "Fuente"}</th>
                <th>${panelName === "grants" ? "Investigadores" : panelName === "patents" ? "Inventores" : "Autores"}</th>
                <th>${panelName === "patents" ? "Assignees" : "Instituciones"}</th>
                <th>Topics</th>
                <th>${panelName === "grants" ? "Monto" : panelName === "patents" ? "Status" : "Citas"}</th>
                <th>Link</th>
              </tr>
            </thead>
            <tbody>
              ${config.items.length ? config.items.map(config.rows).join("") : `<tr><td colspan="8">${emptyCell(researchEmptyMessage(panelName, filterState))}</td></tr>`}
            </tbody>
          </table>
        </div>
        ${config.items.length ? "" : researchEmptyStateMarkup(panelName, filterState)}
      </article>
    `;
  }

  function renderInstitutions() {
    const target = panelRoot("institutions");
    if (!target) return;
    const institutions = [...dashboard.institutions].sort((left, right) => (right.relatedPapersCount || 0) - (left.relatedPapersCount || 0));
    target.innerHTML = `
      <article class="activity-surface intelligence-card intelligence-card-wide">
        <div class="activity-head">
          <h3>Institutions</h3>
          <span>${number(institutions.length)}</span>
        </div>
        <div class="table-scroll intelligence-table-wrap">
          <table class="account-table intelligence-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>País</th>
                <th>Tipo</th>
                <th>Papers</th>
                <th>Grants</th>
                <th>Patents</th>
                <th>Temas</th>
              </tr>
            </thead>
            <tbody>
              ${institutions.length ? institutions.map(institution => `
                <tr>
                  <td><strong>${escapeHtml(institution.name)}</strong><small>${escapeHtml(institution.city || institution.website || institution.sourceUrl || "")}</small></td>
                  <td>${escapeHtml(institution.country || "-")}</td>
                  <td>${escapeHtml(institution.type || "-")}</td>
                  <td>${number(institution.relatedPapersCount || 0)}</td>
                  <td>${number(institution.relatedGrantsCount || 0)}</td>
                  <td>${number(institution.relatedPatentsCount || 0)}</td>
                  <td>${topicPills(institution.topics)}</td>
                </tr>
              `).join("") : `<tr><td colspan="7">${emptyCell("Todavía no hay instituciones relacionadas.")}</td></tr>`}
            </tbody>
          </table>
        </div>
      </article>
    `;
  }

  function renderTopics() {
    const target = panelRoot("topics");
    if (!target) return;
    const topic = selectedTopic();
    const portfolio = topicPortfolio();
    const selectedInsight = topic ? topicInsight(topic) : null;
    target.innerHTML = `
      <section class="intelligence-grid intelligence-grid-overview intelligence-detail-layout">
        <article class="activity-surface intelligence-card">
          <div class="activity-head">
            <h3>Topics</h3>
            <span>${number(dashboard.topics.length)}</span>
          </div>
          <div class="intelligence-summary-strip">
            <div class="intelligence-summary-chip">
              <span>Active</span>
              <strong>${number(portfolio.activeCount)}</strong>
              <small>${number(portfolio.disabledCount)} paused</small>
            </div>
            <div class="intelligence-summary-chip">
              <span>Hot</span>
              <strong>${number(portfolio.hotCount)}</strong>
              <small>${number(portfolio.coldCount)} cold</small>
            </div>
            <div class="intelligence-summary-chip">
              <span>Coverage</span>
              <strong>${number(portfolio.coveredCount)}</strong>
              <small>${number(portfolio.uncoveredCount)} without hits</small>
            </div>
            <div class="intelligence-summary-chip">
              <span>Keywords avg</span>
              <strong>${number(portfolio.averageKeywords)}</strong>
              <small>per topic</small>
            </div>
          </div>
          ${portfolio.focus.length ? `
            <div class="intelligence-stack-list">
              ${portfolio.focus.map(item => `
                <article class="intelligence-stack-card intelligence-topic-focus-card">
                  <div class="intelligence-topic-topline">
                    <div>
                      <h4>${escapeHtml(item.name)}</h4>
                      <p>${escapeHtml(item.note)}</p>
                    </div>
                    <span class="intelligence-health-pill intelligence-health-${escapeAttr(item.health)}">${escapeHtml(item.healthLabel)}</span>
                  </div>
                </article>
              `).join("")}
            </div>
          ` : ""}
          <div class="intelligence-topic-list">
            ${dashboard.topics.length ? dashboard.topics.map(item => `
              ${(() => {
                const insight = topicInsight(item);
                return `
              <article class="intelligence-topic-item${item.id === selectedTopicId ? " is-active" : ""}">
                <div class="intelligence-topic-topline">
                  <div>
                    <h4>${escapeHtml(item.name)}</h4>
                    <p>${escapeHtml(item.description || "Sin descripción")}</p>
                  </div>
                  <span class="intelligence-health-pill intelligence-health-${escapeAttr(insight.health)}">${escapeHtml(insight.healthLabel)}</span>
                </div>
                <div class="intelligence-stack-meta">
                  <span>${escapeHtml(topicCategoryLabel(item.category))} · ${escapeHtml(insight.line)}</span>
                  <strong>${item.enabled ? "Enabled" : "Disabled"}</strong>
                </div>
                <div class="intelligence-mini-metrics intelligence-mini-metrics-tight intelligence-topic-metrics">
                  <div><span>Papers</span><strong>${number(insight.paperHits)}</strong></div>
                  <div><span>Signals</span><strong>${number(insight.signalHits)}</strong></div>
                  <div><span>Assets</span><strong>${number(insight.totalHits)}</strong></div>
                </div>
                <div>${topicPills(item.keywords.slice(0, 8))}</div>
                <div class="intelligence-item-actions">
                  <button class="btn btn-ghost btn-compact" type="button" data-topic-select="${escapeAttr(item.id)}">Editar</button>
                  <button class="btn btn-ghost btn-compact" type="button" data-topic-toggle="${escapeAttr(item.id)}">
                    ${item.enabled ? "Desactivar" : "Activar"}
                  </button>
                </div>
              </article>
                `;
              })()}
            `).join("") : emptyMarkup("No topics configured.", "Add the monitored topics that should drive the radar before running the first sync.", [
              { label: "Add topic", cta: "add-topic" }
            ])}
          </div>
        </article>
        <article class="activity-surface intelligence-card">
          <div class="activity-head">
            <h3>${topic ? "Editar topic" : "Nuevo topic"}</h3>
            <span>${escapeHtml(topic ? topic.name : "Draft")}</span>
          </div>
          ${selectedInsight ? `
            <div class="intelligence-mini-metrics intelligence-topic-coverage">
              <div><span>Line</span><strong>${escapeHtml(selectedInsight.line)}</strong></div>
              <div><span>Heat</span><strong>${escapeHtml(selectedInsight.healthLabel)}</strong></div>
              <div><span>Keywords</span><strong>${number(selectedInsight.keywordCount)}</strong></div>
              <div><span>Assets</span><strong>${number(selectedInsight.totalHits)}</strong></div>
            </div>
          ` : ""}
          <form class="intelligence-form" data-intelligence-topic-form>
            <input type="hidden" name="id" value="${escapeAttr(topic?.id || "")}" />
            <label class="intelligence-field">
              <span>Name</span>
              <input type="text" name="name" value="${escapeAttr(topic?.name || "")}" required maxlength="160" />
            </label>
            <label class="intelligence-field">
              <span>Category</span>
              <select name="category">
                ${Object.entries(TOPIC_CATEGORY_LABELS).map(([value, label]) => `
                  <option value="${escapeHtml(value)}"${value === (topic?.category || "general") ? " selected" : ""}>${escapeHtml(label)}</option>
                `).join("")}
              </select>
            </label>
            <label class="intelligence-field intelligence-field-wide">
              <span>Description</span>
              <textarea name="description">${escapeHtml(topic?.description || "")}</textarea>
            </label>
            <label class="intelligence-field intelligence-field-wide">
              <span>Keywords</span>
              <textarea name="keywords" placeholder="keyword 1, keyword 2, keyword 3">${escapeHtml((topic?.keywords || []).join(", "))}</textarea>
            </label>
            <label class="intelligence-toggle">
              <input type="checkbox" name="enabled"${topic?.enabled !== false ? " checked" : ""} />
              <span>Enabled</span>
            </label>
            <div class="intelligence-form-actions">
              <button class="btn btn-primary" type="submit">${topic ? "Guardar topic" : "Crear topic"}</button>
              <button class="btn btn-ghost btn-compact" type="button" data-topic-reset>Nuevo</button>
            </div>
          </form>
        </article>
      </section>
    `;
  }

  function renderSources() {
    const target = panelRoot("sources");
    if (!target) return;
    const source = selectedSource();
    const health = sourcePortfolio();
    const selectedHealth = source ? sourceInsight(source) : null;
    target.innerHTML = `
      <section class="intelligence-grid intelligence-grid-overview intelligence-detail-layout">
        <article class="activity-surface intelligence-card intelligence-card-wide">
          <div class="activity-head">
            <h3>Sources</h3>
            <span>${number(dashboard.sources.length)}</span>
          </div>
          <div class="intelligence-summary-strip">
            <div class="intelligence-summary-chip">
              <span>Enabled</span>
              <strong>${number(health.enabledCount)}</strong>
              <small>${number(health.pausedCount)} paused</small>
            </div>
            <div class="intelligence-summary-chip">
              <span>Protected</span>
              <strong>${number(health.protectedCount)}</strong>
              <small>quota-sensitive</small>
            </div>
            <div class="intelligence-summary-chip">
              <span>Never synced</span>
              <strong>${number(health.neverSyncedCount)}</strong>
              <small>need first success</small>
            </div>
            <div class="intelligence-summary-chip">
              <span>Stable</span>
              <strong>${number(health.stableCount)}</strong>
              <small>${number(health.watchCount)} on watch</small>
            </div>
          </div>
          ${health.watch.length ? `
            <div class="intelligence-focus-list">
              ${health.watch.map(item => `
                <article class="intelligence-focus-item">
                  <span>${escapeHtml(item.label)}</span>
                  <strong>${escapeHtml(item.title)}</strong>
                  <p>${escapeHtml(item.note)}</p>
                </article>
              `).join("")}
            </div>
          ` : ""}
          <div class="table-scroll intelligence-table-wrap">
            <table class="account-table intelligence-table intelligence-table-selectable">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Enabled</th>
                  <th>Last sync</th>
                  <th>Requires API key</th>
                  <th>Status</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                ${dashboard.sources.length ? dashboard.sources.map(item => `
                  ${(() => {
                    const insight = sourceInsight(item);
                    return `
                  <tr class="${item.id === selectedSourceId ? "is-selected" : ""}" data-source-select="${escapeAttr(item.id)}">
                    <td><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.type)} · ${escapeHtml(item.baseUrl || "-")}</small></td>
                    <td>${item.enabled ? "Yes" : "No"}</td>
                    <td>${escapeHtml(formatDateTime(item.lastSyncAt))}</td>
                    <td>${item.requiresApiKey ? "Yes" : "No"}</td>
                    <td><span class="intelligence-status-pill intelligence-health-${escapeAttr(insight.health)}">${escapeHtml(insight.status)}</span></td>
                    <td>${escapeHtml(insight.note)}</td>
                  </tr>
                    `;
                  })()}
                `).join("") : `<tr><td colspan="6">${emptyCell("No intelligence sources configured.")}</td></tr>`}
              </tbody>
            </table>
          </div>
          ${sourcesEmptyStateMarkup()}
        </article>
        <article class="activity-surface intelligence-card">
          <div class="activity-head">
            <h3>Source detail</h3>
            <span>${escapeHtml(source ? source.name : "Sin selección")}</span>
          </div>
          ${source ? `
            <div class="intelligence-mini-metrics intelligence-source-detail-summary">
              <div><span>Status</span><strong>${escapeHtml(selectedHealth.status)}</strong></div>
              <div><span>API mode</span><strong>${selectedHealth.requiresApiKey ? "Protected" : "Open"}</strong></div>
              <div><span>Last sync</span><strong>${escapeHtml(selectedHealth.lastSyncLabel)}</strong></div>
              <div><span>Sync age</span><strong>${escapeHtml(selectedHealth.syncAgeLabel)}</strong></div>
            </div>
            <div class="intelligence-stack-list intelligence-source-watchlist">
              ${selectedHealth.watchReasons.map(reason => `
                <article class="intelligence-stack-card">
                  <h4>${escapeHtml(reason.label)}</h4>
                  <p>${escapeHtml(reason.note)}</p>
                </article>
              `).join("")}
            </div>
            <form class="intelligence-form" data-intelligence-source-form>
              <input type="hidden" name="id" value="${escapeAttr(source.id)}" />
              <label class="intelligence-field">
                <span>Source</span>
                <input type="text" value="${escapeAttr(source.name)}" readonly />
              </label>
              <label class="intelligence-field">
                <span>Status</span>
                <input type="text" value="${escapeAttr(sourceStatus(source))}" readonly />
              </label>
              <label class="intelligence-toggle">
                <input type="checkbox" name="enabled"${source.enabled ? " checked" : ""} />
                <span>Enabled</span>
              </label>
              <label class="intelligence-field intelligence-field-wide">
                <span>Notes</span>
                <textarea name="rateLimitNotes">${escapeHtml(source.rateLimitNotes || "")}</textarea>
              </label>
              <div class="intelligence-form-actions">
                <button class="btn btn-primary" type="submit">Guardar fuente</button>
                <button class="btn btn-ghost btn-compact" type="button" data-source-toggle="${escapeAttr(source.id)}">
                  ${source.enabled ? "Desactivar" : "Activar"}
                </button>
              </div>
            </form>
          ` : emptyMarkup("Selecciona una fuente", "Elige una fila para activar, desactivar o actualizar sus notas.")}
        </article>
      </section>
    `;
  }

  function renderSettings() {
    const target = panelRoot("settings");
    if (!target) return;
    const settings = dashboard.settings || defaultSettings();
    target.innerHTML = `
      <article class="activity-surface intelligence-card intelligence-card-wide">
        <div class="activity-head">
          <h3>Settings</h3>
          <span>${escapeHtml(SETTINGS_FREQUENCY_LABELS[settings.suggestedFrequency] || settings.suggestedFrequency)}</span>
        </div>
        <form class="intelligence-form intelligence-settings-form" data-intelligence-settings-form>
          <label class="intelligence-field">
            <span>Máximo de resultados por fuente</span>
            <input type="number" name="maxResultsPerSource" min="1" max="200" value="${escapeAttr(settings.maxResultsPerSource)}" />
          </label>
          <label class="intelligence-field">
            <span>Rango temporal por defecto (días)</span>
            <input type="number" name="defaultDateRangeDays" min="1" max="3650" value="${escapeAttr(settings.defaultDateRangeDays)}" />
          </label>
          <label class="intelligence-field">
            <span>Frecuencia sugerida</span>
            <select name="suggestedFrequency">
              ${Object.entries(SETTINGS_FREQUENCY_LABELS).map(([value, label]) => `
                <option value="${escapeHtml(value)}"${value === settings.suggestedFrequency ? " selected" : ""}>${escapeHtml(label)}</option>
              `).join("")}
            </select>
          </label>
          <label class="intelligence-toggle">
            <input type="checkbox" name="defaultDryRun"${settings.defaultDryRun ? " checked" : ""} />
            <span>Modo dry-run por defecto</span>
          </label>
          <label class="intelligence-field">
            <span>Threshold oportunidad</span>
            <input type="number" name="thresholdOpportunity" min="0" max="100" value="${escapeAttr(settings.scoringThresholds?.opportunity ?? 60)}" />
          </label>
          <label class="intelligence-field">
            <span>Threshold actionability</span>
            <input type="number" name="thresholdActionability" min="0" max="100" value="${escapeAttr(settings.scoringThresholds?.actionability ?? 50)}" />
          </label>
          <label class="intelligence-field">
            <span>Threshold confidence</span>
            <input type="number" name="thresholdConfidence" min="0" max="100" value="${escapeAttr(settings.scoringThresholds?.confidence ?? 50)}" />
          </label>
          <fieldset class="intelligence-checkbox-grid intelligence-field-wide">
            <legend>Líneas BCC monitoreadas</legend>
            ${DEFAULT_LINES.map(line => `
              <label class="intelligence-checkbox-item">
                <input type="checkbox" name="monitoredLines" value="${escapeHtml(line)}"${settings.monitoredLines.includes(line) ? " checked" : ""} />
                <span>${escapeHtml(line)}</span>
              </label>
            `).join("")}
          </fieldset>
          <div class="intelligence-form-actions">
            <button class="btn btn-primary" type="submit">Guardar settings</button>
          </div>
        </form>
      </article>
    `;
  }

  function handleClick(event) {
    const ctaButton = event.target.closest("[data-intelligence-cta]");
    if (ctaButton) {
      handleEmptyStateAction(String(ctaButton.dataset.intelligenceCta || ""));
      return;
    }

    const panelButton = event.target.closest("[data-panel-target]");
    if (panelButton) {
      currentPanel = panelButton.dataset.panelTarget || "overview";
      renderPanels();
      return;
    }

    if (event.target.closest("[data-intelligence-refresh]")) {
      void loadDashboard();
      return;
    }

    if (event.target.closest("[data-intelligence-run]")) {
      void runSync();
      return;
    }

    const copyErrorButton = event.target.closest("[data-intelligence-copy-error]");
    if (copyErrorButton) {
      const run = dashboard.runs.find(item => item.id === (copyErrorButton.dataset.intelligenceCopyError || ""));
      if (run?.errorMessage) {
        void copyErrorDetail(copyErrorButton, run.errorMessage);
      }
      return;
    }

    const signalSelect = event.target.closest("[data-signal-select]");
    if (signalSelect) {
      selectedSignalId = signalSelect.dataset.signalSelect || "";
      if (currentPanel !== "signals") {
        currentPanel = "signals";
        renderPanels();
      } else {
        renderSignals();
        refreshIcons();
      }
      return;
    }

    const signalAction = event.target.closest("[data-signal-status]");
    if (signalAction) {
      void updateSignalStatus(signalAction.dataset.signalId || "", signalAction.dataset.signalStatus || "");
      return;
    }

    const topicSelect = event.target.closest("[data-topic-select]");
    if (topicSelect) {
      selectedTopicId = topicSelect.dataset.topicSelect || "";
      renderTopics();
      return;
    }

    const topicToggle = event.target.closest("[data-topic-toggle]");
    if (topicToggle) {
      const topic = dashboard.topics.find(item => item.id === (topicToggle.dataset.topicToggle || ""));
      if (topic) void saveTopic({ id: topic.id, enabled: !topic.enabled });
      return;
    }

    if (event.target.closest("[data-topic-reset]")) {
      selectedTopicId = "";
      renderTopics();
      return;
    }

    const sourceSelect = event.target.closest("[data-source-select]");
    if (sourceSelect) {
      selectedSourceId = sourceSelect.dataset.sourceSelect || "";
      renderSources();
      return;
    }

    const sourceToggle = event.target.closest("[data-source-toggle]");
    if (sourceToggle) {
      const source = dashboard.sources.find(item => item.id === (sourceToggle.dataset.sourceToggle || ""));
      if (source) void saveSource(source.id, { enabled: !source.enabled, rateLimitNotes: source.rateLimitNotes || "" });
    }
  }

  function handleChange(event) {
    if (event.target.matches("[data-intelligence-action]")) {
      currentAction = String(event.target.value || "sync_papers");
      return;
    }

    if (event.target.matches("[data-intelligence-dry-run]")) {
      syncDryRun = Boolean(event.target.checked);
      return;
    }

    if (event.target.matches("[data-intelligence-filter-panel]")) {
      const panel = String(event.target.dataset.intelligenceFilterPanel || "");
      const field = String(event.target.dataset.filterField || "");
      if (!filters[panel] || !field) return;
      filters[panel][field] = String(event.target.value || "");
      if (panel === "papers") renderPapers();
      if (panel === "grants") renderGrants();
      if (panel === "patents") renderPatents();
    }
  }

  function handleSubmit(event) {
    if (event.target.matches("[data-intelligence-topic-form]")) {
      event.preventDefault();
      void saveTopic(readTopicForm(event.target));
      return;
    }

    if (event.target.matches("[data-intelligence-source-form]")) {
      event.preventDefault();
      const id = fieldValue(event.target, "id");
      if (!id) return;
      void saveSource(id, {
        enabled: fieldChecked(event.target, "enabled"),
        rateLimitNotes: fieldValue(event.target, "rateLimitNotes")
      });
      return;
    }

    if (event.target.matches("[data-intelligence-settings-form]")) {
      event.preventDefault();
      void saveSettings(readSettingsForm(event.target));
    }
  }

  async function runSync() {
    if (runningSync) return;
    runningSync = true;
    setMessage("Disparando sync de intelligence...", "neutral");
    syncActionField().disabled = true;
    dryRunField().disabled = true;
    const runButton = root.querySelector("[data-intelligence-run]");
    if (runButton) runButton.disabled = true;
    try {
      const data = await window.BCCAuth.api("/api/admin/intelligence/sync", {
        method: "POST",
        body: JSON.stringify({
          action: currentAction,
          dryRun: syncDryRun,
          reason: "Manual intelligence sync from dashboard"
        })
      });
      setMessage(data?.runUrl ? "Workflow disparado correctamente." : "Sync disparado correctamente.", "ok");
      await loadDashboard();
    } catch (error) {
      setMessage(error.message || "No fue posible disparar el sync.", "error");
    } finally {
      runningSync = false;
      syncActionField().disabled = false;
      dryRunField().disabled = false;
      if (runButton) runButton.disabled = false;
    }
  }

  async function updateSignalStatus(id, status) {
    if (!id || !status) return;
    try {
      const data = await window.BCCAuth.api(`/api/admin/intelligence/signals/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      upsertById(dashboard.signals, data.signal);
      selectedSignalId = data.signal.id;
      writeDashboardCache(dashboard);
      setMessage(`Señal marcada como ${signalStatusLabel(status)}.`, "ok");
      renderOverview();
      renderSignals();
      refreshIcons();
    } catch (error) {
      setMessage(error.message || "No fue posible actualizar la señal.", "error");
    }
  }

  async function saveTopic(payload) {
    try {
      const endpoint = payload.id
        ? `/api/admin/intelligence/topics/${encodeURIComponent(payload.id)}`
        : "/api/admin/intelligence/topics";
      const method = payload.id ? "PATCH" : "POST";
      const data = await window.BCCAuth.api(endpoint, {
        method,
        body: JSON.stringify({
          name: payload.name,
          description: payload.description,
          category: payload.category,
          keywords: payload.keywords,
          enabled: payload.enabled
        })
      });
      upsertById(dashboard.topics, data.topic);
      selectedTopicId = data.topic.id;
      writeDashboardCache(dashboard);
      setMessage(payload.id ? "Topic actualizado." : "Topic creado.", "ok");
      renderOverview();
      renderTopics();
      renderPapers();
      renderGrants();
      renderPatents();
    } catch (error) {
      setMessage(error.message || "No fue posible guardar el topic.", "error");
    }
  }

  async function saveSource(id, payload) {
    try {
      const data = await window.BCCAuth.api(`/api/admin/intelligence/sources/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      upsertById(dashboard.sources, data.source);
      selectedSourceId = data.source.id;
      writeDashboardCache(dashboard);
      setMessage("Fuente actualizada.", "ok");
      renderOverview();
      renderSources();
      renderPapers();
    } catch (error) {
      setMessage(error.message || "No fue posible actualizar la fuente.", "error");
    }
  }

  async function saveSettings(payload) {
    try {
      const data = await window.BCCAuth.api("/api/admin/intelligence/settings", {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      dashboard.settings = { ...defaultSettings(), ...(data.settings || {}) };
      syncDryRun = dashboard.settings.defaultDryRun;
      writeDashboardCache(dashboard);
      setMessage("Settings guardados.", "ok");
      renderAll();
    } catch (error) {
      setMessage(error.message || "No fue posible guardar settings.", "error");
    }
  }

  function signalDetailMarkup(signal) {
    const evidence = Array.isArray(signal.evidenceRefs) ? signal.evidenceRefs : [];
    const breakdown = signal.scoreBreakdown && typeof signal.scoreBreakdown === "object" ? signal.scoreBreakdown : {};
    const highlights = signalBreakdownHighlights(breakdown);
    const grouped = {
      paper: evidence.filter(item => item?.type === "paper"),
      grant: evidence.filter(item => item?.type === "grant"),
      patent: evidence.filter(item => item?.type === "patent")
    };
    return `
      <div class="intelligence-signal-detail-hero">
        <div class="intelligence-signal-hero-copy">
          <div class="intelligence-stack-meta">
            <span>${escapeHtml(signalTypeLabel(signal.signalType))}</span>
            <strong>${escapeHtml(signal.relatedLine || "General")}</strong>
          </div>
          <h4>${escapeHtml(signal.title)}</h4>
          <p>${escapeHtml(signal.summary || "Sin resumen todavía.")}</p>
        </div>
        <div class="intelligence-mini-metrics intelligence-signal-hero-metrics">
          <div><span>Opportunity</span><strong>${score(signal.opportunityScore)}</strong></div>
          <div><span>Actionability</span><strong>${score(signal.actionabilityScore)}</strong></div>
          <div><span>Confidence</span><strong>${score(signal.confidenceScore)}</strong></div>
          <div><span>Evidence</span><strong>${number(signal.evidenceCount || evidence.length)}</strong></div>
        </div>
      </div>
      <div class="intelligence-detail-grid intelligence-detail-grid-signals">
        <div class="intelligence-detail-stack">
          <div class="intelligence-detail-block">
            <h4>Recommendation</h4>
            <p>${escapeHtml(signal.recommendedAction || "Sin recomendación todavía.")}</p>
          </div>
          <div class="intelligence-detail-block">
            <h4>Why this matters now</h4>
            <ul class="intelligence-related-list">
              ${highlights.map(item => `<li>${escapeHtml(item)}</li>`).join("")}
            </ul>
          </div>
          <div class="intelligence-detail-block">
            <h4>Evidence</h4>
            ${evidence.length ? `
              <div class="intelligence-evidence-groups">
                ${renderEvidenceGroup("Papers", grouped.paper)}
                ${renderEvidenceGroup("Grants", grouped.grant)}
                ${renderEvidenceGroup("Patents", grouped.patent)}
              </div>
            ` : emptyMarkup("Sin evidencia", "Esta señal no debería existir sin evidencia, así que conviene revisarla.")}
          </div>
        </div>
        <div class="intelligence-detail-stack intelligence-detail-stack-side">
          <div class="intelligence-detail-block intelligence-detail-block-sticky">
            <div class="intelligence-mini-metrics intelligence-mini-metrics-tight">
              <div><span>Status</span><strong>${escapeHtml(signalStatusLabel(signal.status))}</strong></div>
              <div><span>Updated</span><strong>${escapeHtml(formatDateTime(signal.updatedAt || signal.createdAt))}</strong></div>
              <div><span>Type</span><strong>${escapeHtml(signalTypeLabel(signal.signalType))}</strong></div>
              <div><span>Line</span><strong>${escapeHtml(signal.relatedLine || "General")}</strong></div>
            </div>
            <div class="intelligence-form-actions">
              ${SIGNAL_STATUS_ACTIONS.map(action => `
                <button class="btn btn-${action.tone}" type="button" data-signal-status="${escapeAttr(action.id)}" data-signal-id="${escapeAttr(signal.id)}">
                  ${escapeHtml(action.label)}
                </button>
              `).join("")}
            </div>
          </div>
          <div class="intelligence-detail-block">
            <h4>Related assets</h4>
            <ul class="intelligence-related-list">
              <li>Papers relacionados: ${number(grouped.paper.length)}</li>
              <li>Grants relacionados: ${number(grouped.grant.length)}</li>
              <li>Patents relacionados: ${number(grouped.patent.length)}</li>
            </ul>
          </div>
          ${renderSignalBreakdown(breakdown)}
        </div>
      </div>
    `;
  }

  function renderEvidenceGroup(title, items) {
    if (!items.length) return "";
    return `
      <div class="intelligence-evidence-group">
        <div class="intelligence-stack-meta">
          <span>${escapeHtml(title)}</span>
          <strong>${number(items.length)}</strong>
        </div>
        <div class="intelligence-evidence-list">
          ${items.map(item => `
            <a class="intelligence-evidence-item" href="${escapeAttr(safeExternalUrl(item.sourceUrl || "#"))}" target="_blank" rel="noopener noreferrer">
              <strong>${escapeHtml(item.type || "item")}</strong>
              <span>${escapeHtml(item.title || item.id || "Referencia sin título")}</span>
            </a>
          `).join("")}
        </div>
      </div>
    `;
  }

  function signalBreakdownHighlights(breakdown) {
    const list = [];
    const opportunity = breakdown?.opportunity || {};
    const actionability = breakdown?.actionability || {};
    const matching = breakdown?.matching || {};
    const evidence = breakdown?.evidence || {};
    if (typeof opportunity.topicGrowth === "number" && opportunity.topicGrowth >= 55) {
      list.push(`El tema muestra crecimiento reciente (${score(opportunity.topicGrowth)}%).`);
    }
    if (typeof opportunity.proximityToBCC === "number" && opportunity.proximityToBCC >= 55) {
      list.push(`La cercanía con las líneas BCC es alta (${score(opportunity.proximityToBCC)}%).`);
    }
    if (typeof opportunity.technicalPainDetected === "number" && opportunity.technicalPainDetected >= 45) {
      list.push(`Hay pain points técnicos visibles en la evidencia (${score(opportunity.technicalPainDetected)}%).`);
    }
    if (typeof actionability.easeOfContact === "number" && actionability.easeOfContact >= 45) {
      list.push(`La ventana de contacto/partnership parece operable (${score(actionability.easeOfContact)}%).`);
    }
    if (typeof actionability.contentPotential === "number" && actionability.contentPotential >= 50) {
      list.push(`El tema tiene buen potencial de contenido (${score(actionability.contentPotential)}%).`);
    }
    if (typeof matching.paperMeanScore === "number") {
      list.push(`La calidad media del match con papers es ${score(matching.paperMeanScore)}%.`);
    }
    if (typeof evidence.papers === "number" || typeof evidence.grants === "number" || typeof evidence.patents === "number") {
      list.push(`La señal se apoya en ${number((evidence.papers || 0) + (evidence.grants || 0) + (evidence.patents || 0))} assets relacionados.`);
    }
    return list.slice(0, 5);
  }

  function renderSignalBreakdown(breakdown) {
    const opportunity = breakdown?.opportunity && typeof breakdown.opportunity === "object" ? breakdown.opportunity : null;
    const actionability = breakdown?.actionability && typeof breakdown.actionability === "object" ? breakdown.actionability : null;
    const matching = breakdown?.matching && typeof breakdown.matching === "object" ? breakdown.matching : null;
    const evidence = breakdown?.evidence && typeof breakdown.evidence === "object" ? breakdown.evidence : null;
    if (!opportunity && !actionability && !matching && !evidence) return "";
    return `
      <div class="intelligence-detail-block">
        <h4>Score breakdown</h4>
        ${matching ? breakdownMetricList("Matching", matching) : ""}
        ${opportunity ? breakdownMetricList("Opportunity factors", opportunity) : ""}
        ${actionability ? breakdownMetricList("Actionability factors", actionability) : ""}
        ${evidence ? breakdownMetricList("Evidence density", evidence, { plainNumber: true }) : ""}
      </div>
    `;
  }

  function breakdownMetricList(title, metrics, options = {}) {
    const entries = Object.entries(metrics || {}).filter(([, value]) => typeof value === "number");
    if (!entries.length) return "";
    return `
      <div class="intelligence-breakdown-block">
        <strong>${escapeHtml(title)}</strong>
        <ul class="intelligence-related-list">
          ${entries.map(([key, value]) => `
            <li>${escapeHtml(humanizeBreakdownKey(key))}: ${options.plainNumber ? number(value) : `${score(value)}%`}</li>
          `).join("")}
        </ul>
      </div>
    `;
  }

  function humanizeBreakdownKey(key) {
    return String(key || "")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replaceAll("_", " ")
      .replace(/\b\w/g, char => char.toUpperCase());
  }

  function overviewStats() {
    const latestRun = lastRun();
    return {
      totalPapers: dashboard.overview.papersTracked || dashboard.papers.length,
      totalGrants: dashboard.overview.totalGrants || dashboard.grants.length,
      totalPatents: dashboard.overview.totalPatents || dashboard.patents.length,
      activeTopics: dashboard.topics.filter(item => item.enabled).length || dashboard.overview.priorityTopics || 0,
      newSignals: dashboard.signals.filter(item => ["new", "reviewing"].includes(item.status)).length || dashboard.overview.newSignals || 0,
      lastSyncLabel: latestRun ? formatDateTime(latestRun.finishedAt || latestRun.startedAt || latestRun.createdAt) : "Sin runs",
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
        label: "Review now",
        title: lead.title || "Signal pendiente",
        note: `${signalTypeLabel(lead.signalType)} · ${lead.relatedLine || "General"} · ${score(lead.opportunityScore)} opportunity`
      });
    }
    if (recentErrors.length) {
      const errorRun = recentErrors[0];
      items.push({
        label: "Failure watch",
        title: actionLabel(errorRun.actionType),
        note: `Último fallo ${formatDateTime(errorRun.finishedAt || errorRun.createdAt)}`
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
        label: "Topic heat",
        title: topic.name,
        note: topic.note
      });
    }
    if (!items.length) {
      items.push({
        label: "Ready",
        title: "Radar estable",
        note: "No hay señales nuevas ni fallos recientes. El siguiente paso es correr sync o revisar Topics."
      });
    }
    return {
      title: reviewSignals.length
        ? `${number(reviewSignals.length)} signal(s) requieren criterio humano`
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
        label: "Run failure",
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
          label: "No sync yet",
          title: item.name,
          state: item.requiresApiKey ? "Check credentials" : "Pending first success",
          note: item.rateLimitNotes || "La fuente sigue habilitada pero todavía no registra un sync exitoso."
        });
      });
    enabledSources
      .filter(item => item.requiresApiKey)
      .slice(0, 2)
      .forEach(item => {
        items.push({
          label: "Quota-sensitive",
          title: item.name,
          state: "Watch limits",
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

  function topicHeatmap() {
    const entries = dashboard.topics
      .filter(item => item.enabled)
      .map(topic => {
        const paperHits = dashboard.papers.filter(item => itemMatchesTopic(item, topic, ["title", "abstract", "topics", "keywords", "authors", "institutions"])).length;
        const grantHits = dashboard.grants.filter(item => itemMatchesTopic(item, topic, ["title", "abstract", "topics", "program", "agency", "institutions"])).length;
        const patentHits = dashboard.patents.filter(item => itemMatchesTopic(item, topic, ["title", "abstract", "topics", "inventors", "assignees", "jurisdiction"])).length;
        const signalHits = dashboard.signals.filter(item => (item.relatedLine || "General") === mapTopicLine(topic)).length;
        const scoreValue = paperHits * 3 + grantHits * 2 + patentHits * 2 + signalHits * 4;
        return {
          name: topic.name,
          line: mapTopicLine(topic),
          score: scoreValue,
          note: `${paperHits} papers · ${grantHits} grants · ${patentHits} patents · ${signalHits} signals`
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

  function metricBar(label, value) {
    const width = Math.max(6, Math.min(100, Math.round(Number(value) || 0)));
    return `
      <div class="intelligence-meter">
        <div><span>${escapeHtml(label)}</span><strong>${score(value)}</strong></div>
        <b style="width:${width}%"></b>
      </div>
    `;
  }

  function signalsMatrixMarkup(signals) {
    const items = Array.isArray(signals) ? signals.slice(0, 14) : [];
    if (!items.length) {
      return emptyMarkup("No strategic signals generated yet.", "Cuando el radar produzca señales, aparecerán aquí en un mapa de oportunidad vs actionability.", [
        { label: "Run first sync", cta: "run-sync" }
      ]);
    }
    const width = 640;
    const height = 292;
    const paddingX = 46;
    const paddingTop = 16;
    const paddingBottom = 34;
    const plotWidth = width - paddingX - 18;
    const plotHeight = height - paddingTop - paddingBottom;
    const toneCounts = { new: 0, reviewing: 0, accepted: 0, archived: 0, rejected: 0 };
    const points = items.map((signal, index) => {
      const opportunity = clampScore(signal.opportunityScore);
      const actionability = clampScore(signal.actionabilityScore);
      const confidence = clampScore(signal.confidenceScore);
      const cx = paddingX + (opportunity / 100) * plotWidth;
      const cy = paddingTop + ((100 - actionability) / 100) * plotHeight;
      const r = 7 + Math.round((confidence / 100) * 8);
      const tone = signalStatusTone(signal.status);
      toneCounts[tone] = (toneCounts[tone] || 0) + 1;
      return {
        id: signal.id,
        title: signal.title,
        tone,
        label: shortLineLabel(signal.relatedLine || "General"),
        cx,
        cy,
        r,
        confidence,
        opportunity,
        actionability,
        index
      };
    });
    const legend = [
      { tone: "new", label: "New" },
      { tone: "reviewing", label: "Reviewing" },
      { tone: "accepted", label: "Accepted" },
      { tone: "archived", label: "Archived / rejected" }
    ];
    return `
      <div class="intelligence-chart-card">
        <div class="intelligence-chart-head">
          <p>Opportunity on X, actionability on Y. Bigger marks mean higher confidence.</p>
          <div class="intelligence-chart-legend">
            ${legend.map(item => `
              <span><i class="intelligence-dot intelligence-dot-${escapeAttr(item.tone)}"></i>${escapeHtml(item.label)}${toneCounts[item.tone] ? ` · ${number(toneCounts[item.tone])}` : ""}</span>
            `).join("")}
          </div>
        </div>
        <svg class="intelligence-chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Signal map">
          <defs>
            <linearGradient id="intelligenceMatrixBg" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stop-color="rgba(86,255,166,.08)"></stop>
              <stop offset="100%" stop-color="rgba(114,177,255,.04)"></stop>
            </linearGradient>
          </defs>
          <rect x="${paddingX}" y="${paddingTop}" width="${plotWidth}" height="${plotHeight}" rx="14" fill="url(#intelligenceMatrixBg)"></rect>
          <line x1="${paddingX}" y1="${paddingTop + plotHeight / 2}" x2="${paddingX + plotWidth}" y2="${paddingTop + plotHeight / 2}" class="intelligence-chart-grid"></line>
          <line x1="${paddingX + plotWidth / 2}" y1="${paddingTop}" x2="${paddingX + plotWidth / 2}" y2="${paddingTop + plotHeight}" class="intelligence-chart-grid"></line>
          <line x1="${paddingX}" y1="${paddingTop}" x2="${paddingX}" y2="${paddingTop + plotHeight}" class="intelligence-chart-axis"></line>
          <line x1="${paddingX}" y1="${paddingTop + plotHeight}" x2="${paddingX + plotWidth}" y2="${paddingTop + plotHeight}" class="intelligence-chart-axis"></line>
          <text x="${paddingX + 10}" y="${paddingTop + 18}" class="intelligence-chart-caption">High actionability</text>
          <text x="${paddingX + plotWidth - 122}" y="${paddingTop + 18}" class="intelligence-chart-caption">Fast decisions</text>
          <text x="${paddingX + plotWidth - 88}" y="${paddingTop + plotHeight - 12}" class="intelligence-chart-caption">Opportunity</text>
          <text x="18" y="${paddingTop + 18}" class="intelligence-chart-caption intelligence-chart-caption-vertical">Actionability</text>
          ${points.map(point => `
            <g>
              <circle
                cx="${point.cx}"
                cy="${point.cy}"
                r="${point.r}"
                class="intelligence-point intelligence-point-${escapeAttr(point.tone)}"
                data-signal-select="${escapeAttr(point.id)}"
              ></circle>
              <text x="${point.cx}" y="${point.cy + 3}" class="intelligence-point-label" data-signal-select="${escapeAttr(point.id)}">${escapeHtml(point.label)}</text>
            </g>
          `).join("")}
          <text x="${paddingX}" y="${height - 8}" class="intelligence-chart-axis-label">0</text>
          <text x="${paddingX + plotWidth / 2 - 8}" y="${height - 8}" class="intelligence-chart-axis-label">50</text>
          <text x="${paddingX + plotWidth - 18}" y="${height - 8}" class="intelligence-chart-axis-label">100</text>
          <text x="${paddingX - 22}" y="${paddingTop + plotHeight}" class="intelligence-chart-axis-label">0</text>
          <text x="${paddingX - 30}" y="${paddingTop + plotHeight / 2 + 4}" class="intelligence-chart-axis-label">50</text>
          <text x="${paddingX - 38}" y="${paddingTop + 4}" class="intelligence-chart-axis-label">100</text>
        </svg>
      </div>
    `;
  }

  function topicHeatmapMarkup(entries) {
    const items = Array.isArray(entries) ? entries.slice(0, 8) : [];
    if (!items.length) return "";
    const maxScore = Math.max(...items.map(item => item.score || 0), 1);
    return `
      <div class="intelligence-heatmap">
        ${items.map(item => {
          const intensity = Math.max(14, Math.round((Number(item.score || 0) / maxScore) * 100));
          return `
            <button class="intelligence-heatmap-cell" type="button" data-panel-target="topics" style="--heat:${intensity}%;">
              <strong>${escapeHtml(item.name)}</strong>
              <span>${escapeHtml(item.line)}</span>
              <small>${number(item.score)} pts</small>
            </button>
          `;
        }).join("")}
      </div>
    `;
  }

  function recentRunTrend() {
    return [...dashboard.runs]
      .sort((left, right) => Date.parse(left.createdAt || 0) - Date.parse(right.createdAt || 0))
      .slice(-6)
      .map(run => ({
        id: run.id,
        label: compactDateLabel(run.finishedAt || run.startedAt || run.createdAt),
        fetched: Number(run.itemsFetched || 0),
        saved: Number(run.itemsCreated || 0) + Number(run.itemsUpdated || 0),
        signals: Number(run.signalsGenerated || 0),
        status: run.status || "pending"
      }));
  }

  function runsTrendMarkup(entries) {
    const items = Array.isArray(entries) ? entries : [];
    if (!items.length) {
      return emptyMarkup("No runs yet", "Cuando el radar ejecute syncs, aquí verás si está trayendo datos o solo generando actividad vacía.");
    }
    const maxValue = Math.max(...items.flatMap(item => [item.fetched, item.saved, item.signals]), 1);
    return `
      <div class="intelligence-runtrend">
        <div class="intelligence-chart-legend">
          <span><i class="intelligence-bar intelligence-bar-fetched"></i>Fetched</span>
          <span><i class="intelligence-bar intelligence-bar-saved"></i>Saved</span>
          <span><i class="intelligence-bar intelligence-bar-signals"></i>Signals</span>
        </div>
        <div class="intelligence-runtrend-grid">
          ${items.map(item => `
            <article class="intelligence-runtrend-item">
              <div class="intelligence-runtrend-bars">
                <b class="intelligence-runtrend-bar intelligence-bar-fetched" style="height:${Math.max(10, Math.round((item.fetched / maxValue) * 100))}%"></b>
                <b class="intelligence-runtrend-bar intelligence-bar-saved" style="height:${Math.max(10, Math.round((item.saved / maxValue) * 100))}%"></b>
                <b class="intelligence-runtrend-bar intelligence-bar-signals" style="height:${Math.max(10, Math.round((item.signals / maxValue) * 100))}%"></b>
              </div>
              <strong>${escapeHtml(item.label)}</strong>
              <small>${escapeHtml(runStatusLabel(item.status))}</small>
            </article>
          `).join("")}
        </div>
      </div>
    `;
  }

  function filteredPapers() {
    return applyResearchFilters(dashboard.papers, filters.papers, {
      dateField: "publicationDate",
      sourceField: "sourceName",
      searchFields: ["title", "abstract", "authors", "institutions", "topics", "keywords"]
    });
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

  function applyResearchFilters(items, state, config) {
    const normalizedKeyword = String(state.keyword || "").trim().toLowerCase();
    const cutoff = cutoffDate(state.dateRange);
    return [...items].filter(item => {
      if (state.topic && !itemMatchesTopic(item, state.topic, config.searchFields)) return false;
      if (state.source && String(item[config.sourceField] || "") !== state.source) return false;
      if (state.line && deriveLine(item) !== state.line) return false;
      if (cutoff) {
        const dateValue = item[config.dateField] ? new Date(item[config.dateField]) : null;
        if (!dateValue || Number.isNaN(dateValue.getTime()) || dateValue < cutoff) return false;
      }
      if (normalizedKeyword) {
        const searchable = config.searchFields.map(field => normalizeSearchValue(item[field])).join(" ").toLowerCase();
        if (!searchable.includes(normalizedKeyword)) return false;
      }
      return true;
    });
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
        if (itemMatchesTopic(item, topic, ["title", "abstract", "topics", "keywords", "authors", "institutions", "program", "agency", "inventors", "assignees", "jurisdiction", "status"])) {
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
    return [...new Set(dashboard.papers.map(item => String(item.sourceName || "").trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right));
  }

  function topicOptions() {
    return [...dashboard.topics].sort((left, right) => left.name.localeCompare(right.name));
  }

  function monitoredLines() {
    return dashboard.settings?.monitoredLines?.length ? dashboard.settings.monitoredLines : [...DEFAULT_LINES];
  }

  function panelLabel(panel) {
    return {
      overview: "Overview",
      signals: "Signals",
      papers: "Papers",
      grants: "Grants",
      patents: "Patents",
      institutions: "Institutions",
      topics: "Topics",
      sources: "Sources",
      settings: "Settings"
    }[panel] || panel;
  }

  function actionLabel(action) {
    return RUN_ACTIONS.find(item => item.id === action)?.label || action || "Run";
  }

  function signalTypeLabel(type) {
    return SIGNAL_TYPE_LABELS[type] || type || "Signal";
  }

  function signalStatusLabel(status) {
    return SIGNAL_STATUS_LABELS[status] || status || "New";
  }

  function topicCategoryLabel(category) {
    return TOPIC_CATEGORY_LABELS[category] || category || "General";
  }

  function runStatusLabel(status) {
    return {
      pending: "Pending",
      running: "Running",
      completed: "Completed",
      failed: "Failed",
      idle: "Idle"
    }[status] || status || "Idle";
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
    const line = mapTopicLine(topic);
    const paperHits = dashboard.papers.filter(item => itemMatchesTopic(item, topic, ["title", "abstract", "topics", "keywords", "authors", "institutions"])).length;
    const grantHits = dashboard.grants.filter(item => itemMatchesTopic(item, topic, ["title", "abstract", "topics", "program", "agency", "institutions"])).length;
    const patentHits = dashboard.patents.filter(item => itemMatchesTopic(item, topic, ["title", "abstract", "topics", "inventors", "assignees", "jurisdiction"])).length;
    const signalHits = dashboard.signals.filter(item => (item.relatedLine || "General") === line).length;
    const totalHits = paperHits + grantHits + patentHits + signalHits;
    const keywordCount = Array.isArray(topic?.keywords) ? topic.keywords.length : 0;
    const health = !topic.enabled ? "paused" : totalHits >= 12 ? "hot" : totalHits >= 4 ? "active" : "cold";
    const healthLabel = {
      paused: "Paused",
      hot: "Hot",
      active: "Active",
      cold: "Cold"
    }[health] || "Cold";
    return {
      id: topic.id,
      name: topic.name,
      enabled: Boolean(topic.enabled),
      line,
      paperHits,
      grantHits,
      patentHits,
      signalHits,
      totalHits,
      keywordCount,
      health,
      healthLabel,
      note: `${paperHits} papers · ${signalHits} signals · ${keywordCount} keywords`
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
      ? "Paused"
      : !hasLastSync
        ? source.requiresApiKey ? "Awaiting first sync" : "Never synced"
        : daysSinceSync > 14
          ? "Stale"
          : source.requiresApiKey
            ? "Protected"
            : "Active";
    const note = !source.enabled
      ? source.rateLimitNotes || "Disabled from the radar."
      : !hasLastSync
        ? source.rateLimitNotes || "Still waiting for the first successful sync."
        : daysSinceSync > 14
          ? `Last sync was ${daysSinceSync} days ago.`
          : source.rateLimitNotes || "Healthy source configuration.";
    const watchReasons = [];
    if (!source.enabled) {
      watchReasons.push({
        label: "Paused",
        note: "Esta fuente no participará en el próximo sync hasta volver a activarla."
      });
    }
    if (!hasLastSync) {
      watchReasons.push({
        label: "First sync pending",
        note: source.requiresApiKey
          ? "Conviene validar credenciales y lanzar un sync específico antes de confiar en esta fuente."
          : "Todavía no hay evidencia de una primera sincronización exitosa."
      });
    }
    if (source.requiresApiKey) {
      watchReasons.push({
        label: "Quota-sensitive",
        note: source.rateLimitNotes || "Mantén queries compactas y límites moderados para no gastar cuota sin señal útil."
      });
    }
    if (hasLastSync && daysSinceSync > 14) {
      watchReasons.push({
        label: "Stale source",
        note: `Pasaron ${daysSinceSync} días desde el último sync. Puede haber cobertura desactualizada.`
      });
    }
    if (!watchReasons.length) {
      watchReasons.push({
        label: "Healthy",
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
        paused: "Paused",
        cold: "Needs first sync",
        watch: "Watch",
        active: "Stable"
      }[health] || "Stable",
      status,
      note,
      lastSyncLabel: formatDateTime(source.lastSyncAt),
      syncAgeLabel: !hasLastSync ? "Never" : daysSinceSync <= 0 ? "Today" : `${daysSinceSync}d`,
      watchReasons
    };
  }

  function emptyMarkup(title, text) {
    const actions = arguments[2] || [];
    return `
      <div class="intelligence-empty">
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(text)}</p>
        ${Array.isArray(actions) && actions.length ? `
          <div class="intelligence-form-actions">
            ${actions.map(action => `
              <button class="btn btn-primary" type="button" data-intelligence-cta="${escapeAttr(action.cta || "")}">
                ${escapeHtml(action.label || "Continue")}
              </button>
            `).join("")}
          </div>
        ` : ""}
      </div>
    `;
  }

  function emptyCell(text) {
    return `<span class="table-empty">${escapeHtml(text)}</span>`;
  }

  function topicPills(values) {
    const items = Array.isArray(values) ? values.filter(Boolean) : [];
    return items.length
      ? items.slice(0, 6).map(item => `<span class="intelligence-topic-pill">${escapeHtml(item)}</span>`).join("")
      : `<span class="intelligence-empty-inline">-</span>`;
  }

  function joinList(values, limit = 3) {
    const items = Array.isArray(values) ? values.filter(Boolean) : [];
    if (!items.length) return "-";
    const visible = items.slice(0, limit).join(", ");
    return items.length > limit ? `${visible} +${items.length - limit}` : visible;
  }

  function normalizeSearchValue(value) {
    if (Array.isArray(value)) return value.join(" ");
    return String(value || "");
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

  function clampScore(value) {
    return Math.max(0, Math.min(100, Number(value || 0)));
  }

  function number(value) {
    return new Intl.NumberFormat("es-DO").format(Number(value || 0));
  }

  function score(value) {
    return `${Math.round(Number(value || 0))}`;
  }

  function formatDate(value) {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("es-DO", { year: "numeric", month: "short", day: "2-digit" });
  }

  function formatDateTime(value) {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("es-DO", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  function compactDateLabel(value) {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("es-DO", { month: "short", day: "2-digit" });
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

  function safeExternalUrl(value) {
    const text = String(value || "").trim();
    if (!text) return "#";
    try {
      const url = new URL(text, window.location.origin);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "#";
    } catch {
      return "#";
    }
  }

  function researchEmptyMessage(panelName, filterState) {
    const hasFilters = Boolean(filterState?.topic || filterState?.source || filterState?.line || filterState?.keyword || (filterState?.dateRange && filterState.dateRange !== "90"));
    if (hasFilters) return "No hay resultados para esos filtros.";
    if (panelName === "papers") return "No papers synced yet.";
    if (panelName === "grants") return "No grants synced yet.";
    if (panelName === "patents") return "No patents synced yet.";
    return "No hay resultados todavía.";
  }

  function researchEmptyStateMarkup(panelName, filterState) {
    const hasFilters = Boolean(filterState?.topic || filterState?.source || filterState?.line || filterState?.keyword || (filterState?.dateRange && filterState.dateRange !== "90"));
    if (hasFilters) {
      return emptyMarkup("No matching results.", "Adjust filters or clear the keyword range to expand the current view.");
    }
    if (panelName === "papers") {
      return emptyMarkup("No papers synced yet.", "The radar has not stored scientific papers yet.", [
        { label: "Run first sync", cta: "run-sync" }
      ]);
    }
    if (panelName === "grants") {
      return emptyMarkup("No grants synced yet.", "Grant fetching is still pending implementation, so this view is expected to stay empty for now.");
    }
    if (panelName === "patents") {
      return emptyMarkup("No patents synced yet.", "Patent fetching is still pending implementation, so this view is expected to stay empty for now.");
    }
    return "";
  }

  function sourcesEmptyStateMarkup() {
    if (dashboard.sources.length) {
      if (!dashboard.sources.some(item => item.enabled)) {
        return emptyMarkup("No intelligence sources configured.", "Sources exist but none are enabled, so the radar cannot fetch anything yet.", [
          { label: "Enable source", cta: "enable-source" }
        ]);
      }
      return "";
    }
    return emptyMarkup("No intelligence sources configured.", "Create or seed source records before trying the first sync.");
  }

  function handleEmptyStateAction(action) {
    if (action === "run-sync") {
      void runSync();
      return;
    }
    if (action === "add-topic") {
      currentPanel = "topics";
      selectedTopicId = "";
      renderPanels();
      return;
    }
    if (action === "enable-source") {
      currentPanel = "sources";
      const firstDisabled = dashboard.sources.find(item => !item.enabled);
      if (firstDisabled) selectedSourceId = firstDisabled.id;
      renderPanels();
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

  function panelRoot(name) {
    return root.querySelector(`[data-intelligence-panel="${name}"]`);
  }

  function navChips() {
    return [...root.querySelectorAll("[data-panel-target]")];
  }

  function syncActionField() {
    return root.querySelector("[data-intelligence-action]");
  }

  function dryRunField() {
    return root.querySelector("[data-intelligence-dry-run]");
  }

  function setMessage(text, tone = "neutral") {
    const message = root.querySelector("[data-intelligence-message]");
    if (!message) return;
    renderMessageBlock(
      message,
      text || "Scientific & technology intelligence para monitorear señales estratégicas.",
      tone
    );
  }

  function renderMessageBlock(target, text, tone = "neutral") {
    const content = String(text || "").trim();
    target.dataset.tone = tone;
    target.replaceChildren(document.createTextNode(content));
    if (content.length < 170) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "workspace-message-copy";
    button.textContent = "Copiar detalle";
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(content);
        button.textContent = "Copiado";
        window.setTimeout(() => {
          button.textContent = "Copiar detalle";
        }, 1400);
      } catch {
        button.textContent = "No se pudo copiar";
      }
    });
    target.append(button);
  }

  async function copyErrorDetail(button, text) {
    try {
      await navigator.clipboard.writeText(String(text || ""));
      button.textContent = "Copiado";
      window.setTimeout(() => {
        button.textContent = "Copiar detalle";
      }, 1400);
    } catch {
      button.textContent = "No se pudo copiar";
    }
  }

  function intelligenceError(error) {
    const message = String(error?.message || "");
    if (/no respondio a tiempo|timeout/i.test(message)) {
      return "Intelligence tardó demasiado en responder. Revisa Supabase o intenta de nuevo.";
    }
    if (/intelligence_|relation .* does not exist|column .* does not exist/i.test(message)) {
      return "Falta aplicar la última actualización del esquema Intelligence en Supabase.";
    }
    return message || "No fue posible cargar intelligence.";
  }

  function withTimeout(promise, timeoutMs, message) {
    let timerId = 0;
    const timeoutPromise = new Promise((_, reject) => {
      timerId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => {
      window.clearTimeout(timerId);
    });
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }

  function refreshIcons() {
    window.BCCWorkspaceIcons?.createIcons(root);
    window.refreshIcons?.();
  }

  window.BCCWorkspaceIntelligence = { init };
})();
