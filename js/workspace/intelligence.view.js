/* Pure rendering / markup layer for the Science Radar (Intelligence) feature. */
(() => {
  const IntelligenceState = window.BCCWorkspaceIntelligenceState;
  const {
    PANELS,
    RUN_ACTIONS,
    SIGNAL_STATUS_ACTIONS,
    TOPIC_CATEGORY_LABELS,
    SETTINGS_FREQUENCY_LABELS,
    DEFAULT_LINES,
    DATE_RANGE_OPTIONS
  } = window.BCCWorkspaceIntelligenceConstants;

  function shellMarkup(currentPanel) {
    return `
      <section class="users-surface intelligence-surface">
        <div class="surface-toolbar intelligence-toolbar">
          <div>
            <h2>Intelligence</h2>
            <p class="muted-text" data-intelligence-message>Cargando intelligence...</p>
          </div>
          <div class="intelligence-controls">
            <label class="intelligence-inline-field">
              <span>Acción</span>
              <select data-intelligence-action aria-label="Seleccionar acción de sync">
                ${RUN_ACTIONS.map(action => `<option value="${escapeHtml(action.id)}">${escapeHtml(action.label)}</option>`).join("")}
              </select>
            </label>
            <label class="intelligence-toggle intelligence-toggle-compact">
              <input type="checkbox" data-intelligence-dry-run />
              <span>Dry-run</span>
            </label>
            <button class="btn btn-primary" type="button" data-intelligence-run>
              <i data-lucide="radar"></i>Ejecutar sincronización
            </button>
            <button class="btn btn-ghost btn-compact" type="button" data-intelligence-refresh>Actualizar</button>
          </div>
        </div>
        <nav class="intelligence-nav" aria-label="Secciones de intelligence">
          ${PANELS.map(panel => `
            <button class="intelligence-nav-chip${panel === currentPanel ? " is-active" : ""}" type="button" data-panel-target="${escapeHtml(panel)}">
              ${escapeHtml(IntelligenceState.panelLabel(panel))}
            </button>
          `).join("")}
        </nav>
        <section class="intelligence-panels">
          <section class="intelligence-panel" data-intelligence-panel="overview"></section>
          <section class="intelligence-panel is-hidden" data-intelligence-panel="signals"></section>
          <section class="intelligence-panel is-hidden" data-intelligence-panel="papers"></section>
          <section class="intelligence-panel is-hidden" data-intelligence-panel="grants"></section>
          <section class="intelligence-panel is-hidden" data-intelligence-panel="patents"></section>
          <section class="intelligence-panel is-hidden" data-intelligence-panel="trials"></section>
          <section class="intelligence-panel is-hidden" data-intelligence-panel="institutions"></section>
          <section class="intelligence-panel is-hidden" data-intelligence-panel="topics"></section>
          <section class="intelligence-panel is-hidden" data-intelligence-panel="sources"></section>
          <section class="intelligence-panel is-hidden" data-intelligence-panel="settings"></section>
        </section>
      </section>
    `;
  }

  function renderOverview(target) {
    if (!target) return;
    const latestRun = IntelligenceState.lastRun();
    const prioritizedSignals = IntelligenceState.signalReviewQueue();
    const recentSignals = prioritizedSignals.slice(0, 5);
    const recentErrors = IntelligenceState.failedRuns().slice(0, 5);
    const reviewSignals = IntelligenceState.signalsNeedingReview();
    const sourceWatch = IntelligenceState.sourceWatchItems().slice(0, 4);
    const hotTopics = IntelligenceState.topicHeatmap();
    const heatTopicsPreview = hotTopics.slice(0, 4);
    const runTrend = IntelligenceState.recentRunTrend();
    const stats = IntelligenceState.overviewStats();
    const briefing = IntelligenceState.overviewBriefing({ latestRun, reviewSignals, recentErrors, sourceWatch, hotTopics: heatTopicsPreview });

    target.innerHTML = `
      <section class="workspace-metrics intelligence-metrics" aria-label="Resumen de intelligence">
        <div><span>Total papers</span><strong>${number(stats.totalPapers)}</strong><small>Repositorio actual</small></div>
        <div><span>Total grants</span><strong>${number(stats.totalGrants)}</strong><small>Oportunidades y awards</small></div>
        <div><span>Total patentes</span><strong>${number(stats.totalPatents)}</strong><small>Patentes y solicitudes</small></div>
        <div><span>Total ensayos</span><strong>${number(stats.totalTrials)}</strong><small>Estudios y validación</small></div>
        <div><span>Temas activos</span><strong>${number(stats.activeTopics)}</strong><small>Radar habilitado</small></div>
        <div><span>Señales nuevas</span><strong>${number(stats.newSignals)}</strong><small>Nuevas + en revisión</small></div>
        <div><span>Último sync</span><strong>${escapeHtml(stats.lastSyncLabel)}</strong><small>${escapeHtml(stats.lastSyncState)}</small></div>
        <div><span>Línea con mayor densidad</span><strong>${escapeHtml(stats.topLine)}</strong><small>Mayor densidad actual</small></div>
      </section>
      <section class="intelligence-grid intelligence-grid-overview">
        <article class="activity-surface intelligence-card intelligence-card-hero intelligence-briefing-card">
          <div class="intelligence-briefing-head">
            <div>
              <span class="intelligence-kicker">Radar briefing</span>
              <h3>${escapeHtml(briefing.title)}</h3>
              <p>${escapeHtml(briefing.summary)}</p>
            </div>
            <span class="intelligence-status-pill">${escapeHtml(IntelligenceState.runStatusLabel(latestRun?.status || "idle"))}</span>
          </div>
          <div class="intelligence-briefing-metrics">
            <div><span>Requieren revisión</span><strong>${number(reviewSignals.length)}</strong><small>Nuevas + en revisión</small></div>
            <div><span>Fuentes en observación</span><strong>${number(sourceWatch.length)}</strong><small>Fuentes con atención</small></div>
            <div><span>Fallos recientes</span><strong>${number(recentErrors.length)}</strong><small>Runs fallidos recientes</small></div>
            <div><span>Temas en tendencia</span><strong>${number(hotTopics.length)}</strong><small>Temas con mayor tracción</small></div>
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
            <h3>Mapa de señales</h3>
            <span>${number(prioritizedSignals.length)}</span>
          </div>
          ${signalsMatrixMarkup(prioritizedSignals)}
        </article>
        <article class="activity-surface intelligence-card">
          <div class="activity-head">
            <h3>Estado del sync</h3>
            <span>${escapeHtml(latestRun ? IntelligenceState.runStatusLabel(latestRun.status) : "Sin runs")}</span>
          </div>
          <div class="intelligence-mini-metrics intelligence-mini-metrics-tight">
            <div><span>Acción</span><strong>${escapeHtml(IntelligenceState.actionLabel(latestRun?.actionType || IntelligenceState.currentAction))}</strong></div>
            <div><span>Encontrados</span><strong>${number(latestRun?.itemsFetched || 0)}</strong></div>
            <div><span>Guardados</span><strong>${number((latestRun?.itemsCreated || 0) + (latestRun?.itemsUpdated || 0))}</strong></div>
            <div><span>Señales generadas</span><strong>${number(latestRun?.signalsGenerated || 0)}</strong></div>
          </div>
          ${latestRun ? `
            <div class="intelligence-focus-list">
              <div class="intelligence-focus-item">
                <span>${escapeHtml(latestRun.dryRun ? "Dry-run" : "Sync")}</span>
                <strong>${escapeHtml(formatDateTime(latestRun.finishedAt || latestRun.startedAt || latestRun.createdAt))}</strong>
                <p>${escapeHtml(latestRun.errorMessage ? "La última ejecución terminó con error." : "La última ejecución ya quedó registrada en el radar.")}</p>
                ${latestRun.errorMessage ? `
                  <button class="btn btn-ghost btn-compact" type="button" data-intelligence-copy-error="${escapeAttr(latestRun.id)}">Copiar detalle</button>
                ` : ""}
              </div>
            </div>
          ` : emptyMarkup("Todavía no hay runs", "Usa Ejecutar sincronización para lanzar el radar y empezar a llenar el log.")}
        </article>
        <article class="activity-surface intelligence-card">
          <div class="activity-head">
            <h3>Tendencia de runs</h3>
            <span>${number(runTrend.length)}</span>
          </div>
          ${runsTrendMarkup(runTrend)}
        </article>
        <article class="activity-surface intelligence-card">
          <div class="activity-head">
            <h3>Cola de revisión</h3>
            <span>${number(reviewSignals.length)}</span>
          </div>
          ${reviewSignals.length ? `
            <div class="intelligence-queue-list">
              ${reviewSignals.slice(0, 4).map(signal => `
                <article class="intelligence-queue-item" data-signal-select="${escapeAttr(signal.id)}">
                  <div class="intelligence-stack-meta">
                    <span>${escapeHtml(IntelligenceState.signalTypeLabel(signal.signalType))}</span>
                    <strong>${escapeHtml(signal.relatedLine || "General")}</strong>
                  </div>
                  <h4>${escapeHtml(signal.title)}</h4>
                  <p>${escapeHtml(signal.summary || signal.recommendedAction || "Sin resumen todavía.")}</p>
                  <div class="intelligence-queue-meters">
                    ${metricBar("Oportunidad", signal.opportunityScore)}
                    ${metricBar("Actionabilidad", signal.actionabilityScore)}
                    ${metricBar("Confianza", signal.confidenceScore)}
                  </div>
                </article>
              `).join("")}
            </div>
          ` : emptyMarkup("No hay señales esperando revisión", "Cuando haya señales nuevas o en revisión, aparecerán aquí como cola de trabajo.")}
        </article>
        <article class="activity-surface intelligence-card">
          <div class="activity-head">
            <h3>Fuentes en observación</h3>
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
            <h3>Temas en tendencia</h3>
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
          ` : emptyMarkup("Todavía no hay temas en tendencia", "Cuando papers y señales empiecen a concentrarse, aparecerán aquí para orientar prioridad.")}
        </article>
        <article class="activity-surface intelligence-card intelligence-card-wide">
          <div class="activity-head">
            <h3>Señales estratégicas recientes</h3>
            <span>${number(recentSignals.length)}</span>
          </div>
          ${recentSignals.length ? `
            <div class="intelligence-signal-showcase">
              ${recentSignals.map(signal => `
                <article class="intelligence-signal-showcase-item" data-signal-select="${escapeAttr(signal.id)}">
                  <div class="intelligence-stack-meta">
                    <span>${escapeHtml(IntelligenceState.signalTypeLabel(signal.signalType))}</span>
                    <strong>${escapeHtml(signal.relatedLine || "General")}</strong>
                  </div>
                  <h4>${escapeHtml(signal.title)}</h4>
                  <p>${escapeHtml(signal.summary || signal.recommendedAction || "Sin resumen todavía.")}</p>
                  <div class="intelligence-mini-metrics intelligence-mini-metrics-tight">
                    <div><span>Op.</span><strong>${score(signal.opportunityScore)}</strong></div>
                    <div><span>Act.</span><strong>${score(signal.actionabilityScore)}</strong></div>
                    <div><span>Conf.</span><strong>${score(signal.confidenceScore)}</strong></div>
                    <div><span>Estado</span><strong>${escapeHtml(IntelligenceState.signalStatusLabel(signal.status))}</strong></div>
                  </div>
                </article>
              `).join("")}
            </div>
          ` : emptyMarkup("Todavía no hay señales estratégicas generadas.", "Ejecuta el primer sync o corre Generar señales para producir oportunidades estratégicas.", [
            { label: "Ejecutar primer sync", cta: "run-sync" }
          ])}
        </article>
      </section>
    `;
  }

  function bulkSignalToolbarMarkup(selectedIds) {
    if (!selectedIds.size) return "";
    return `
      <div class="intelligence-bulk-toolbar">
        <span>${number(selectedIds.size)} seleccionadas</span>
        <div class="intelligence-bulk-toolbar-actions">
          ${SIGNAL_STATUS_ACTIONS.map(action => `
            <button class="btn btn-${action.tone} btn-compact" type="button" data-signal-bulk-status="${escapeAttr(action.id)}">
              ${escapeHtml(action.label)} en bloque
            </button>
          `).join("")}
          <button class="btn btn-ghost btn-compact" type="button" data-signal-bulk-clear>Cancelar selección</button>
        </div>
      </div>
    `;
  }

  function renderSignals(target) {
    if (!target) return;
    const signals = IntelligenceState.sortedSignals();
    const selected = IntelligenceState.selectedSignal();
    const bulkSelectedIds = IntelligenceState.selectedBulkSignalIds;
    target.innerHTML = `
      <section class="intelligence-signal-stage">
        <article class="activity-surface intelligence-card intelligence-signal-rail">
          <div class="activity-head">
            <h3>Cola de señales</h3>
            <span>${number(signals.length)}</span>
          </div>
          <div class="intelligence-signal-summary">
            <div><span>Requieren revisión</span><strong>${number(IntelligenceState.signalsNeedingReview().length)}</strong></div>
            <div><span>Aceptadas</span><strong>${number(signals.filter(item => item.status === "accepted").length)}</strong></div>
            <div><span>Op. promedio</span><strong>${IntelligenceState.averageScore(signals, "opportunityScore")}</strong></div>
          </div>
          ${signals.length ? `
            <div class="intelligence-signal-rail-note">
              <p>La cola está ordenada para revisión humana. Empieza por señales con mejor combinación de oportunidad, actionability y confidence. Marca varias con la casilla para aceptarlas, rechazarlas o archivarlas en bloque.</p>
            </div>
          ` : ""}
          ${bulkSignalToolbarMarkup(bulkSelectedIds)}
          ${signals.length ? `
            <div class="intelligence-signal-queue">
              ${signals.map(signal => `
                <article class="intelligence-signal-card${signal.id === IntelligenceState.selectedSignalId ? " is-selected" : ""}" data-signal-select="${escapeAttr(signal.id)}">
                  <div class="intelligence-signal-card-head">
                    <label class="intelligence-bulk-checkbox" data-signal-bulk-toggle-wrap>
                      <input type="checkbox" data-signal-bulk-toggle="${escapeAttr(signal.id)}"${bulkSelectedIds.has(signal.id) ? " checked" : ""} />
                    </label>
                    <div class="intelligence-stack-meta">
                      <span>${escapeHtml(IntelligenceState.signalTypeLabel(signal.signalType))}</span>
                      <strong>${escapeHtml(signal.relatedLine || "General")}</strong>
                    </div>
                  </div>
                  <h4>${escapeHtml(signal.title)}</h4>
                  <p>${escapeHtml(signal.summary || "Sin resumen todavía.")}</p>
                  <div class="intelligence-signal-card-meta">
                    <span class="intelligence-status-pill">${escapeHtml(IntelligenceState.signalStatusLabel(signal.status))}</span>
                    ${signal.autoArchived ? `<span class="intelligence-meta-pill intelligence-meta-pill-warn">Auto-archivada</span>` : ""}
                    <small>${escapeHtml(formatDateTime(signal.updatedAt || signal.createdAt))}</small>
                  </div>
                  <div class="intelligence-queue-meters">
                    ${metricBar("Oportunidad", signal.opportunityScore)}
                    ${metricBar("Actionabilidad", signal.actionabilityScore)}
                    ${metricBar("Confianza", signal.confidenceScore)}
                  </div>
                </article>
              `).join("")}
            </div>
          ` : emptyMarkup("Todavía no hay señales estratégicas generadas.", "Ejecuta el primer sync o corre Generar señales para producir oportunidades estratégicas.")}
        </article>
        <article class="activity-surface intelligence-card intelligence-signal-detail">
          <div class="activity-head intelligence-detail-head">
            <h3>Detalle de la señal</h3>
            <span>${escapeHtml(selected ? IntelligenceState.signalStatusLabel(selected.status) : "Sin selección")}</span>
          </div>
          ${selected ? signalDetailMarkup(selected) : emptyMarkup("Selecciona una señal", "Elige una fila para revisar evidencia, scores y acciones sugeridas.")}
        </article>
      </section>
    `;
  }

  function renderPapers(target) {
    if (!target) return;
    const items = IntelligenceState.filteredPapers();
    const state = IntelligenceState.filters.papers;
    const stats = IntelligenceState.paperInsights(items);
    const sourceOptions = IntelligenceState.uniqueSourcesFromPapers();
    target.innerHTML = `
      <article class="activity-surface intelligence-card intelligence-card-wide">
        <div class="activity-head intelligence-head-split">
          <div>
            <h3>Papers</h3>
            <p class="muted-text">Explora la producción científica del radar con mejor contexto, filtros más finos y lectura más rápida.</p>
          </div>
          <span>${number(items.length)}</span>
        </div>
        <div class="intelligence-summary-strip">
          <article class="intelligence-summary-chip">
            <span>Acceso abierto</span>
            <strong>${number(stats.openAccessCount)}</strong>
            <small>${stats.openAccessRatio}% del total filtrado</small>
          </article>
          <article class="intelligence-summary-chip">
            <span>Posibles duplicados</span>
            <strong>${number(stats.duplicateCount)}</strong>
            <small>${stats.duplicateCount ? "Papers marcados para revisión de duplicados" : "Sin alertas de duplicados en esta vista"}</small>
          </article>
          <article class="intelligence-summary-chip">
            <span>Densidad de señal</span>
            <strong>${number(stats.avgCitations)}</strong>
            <small>${stats.topSource ? `Fuente dominante: ${stats.topSource}` : "Aún no hay una fuente dominante clara"}</small>
          </article>
        </div>
        <div class="intelligence-paper-filter-deck">
          <div class="intelligence-filter-grid intelligence-filter-grid-papers">
            <label class="intelligence-field intelligence-field-wide">
              <span>Palabra clave</span>
              <input type="search" data-intelligence-filter-panel="papers" data-filter-field="keyword" value="${escapeAttr(state.keyword)}" placeholder="Título, abstract, autores, instituciones, tags..." />
            </label>
            <label class="intelligence-field">
              <span>Tema</span>
              <select data-intelligence-filter-panel="papers" data-filter-field="topic">
                <option value="">Todos</option>
                ${IntelligenceState.topicOptions().map(topic => `<option value="${escapeHtml(topic.name)}"${topic.name === state.topic ? " selected" : ""}>${escapeHtml(topic.name)}</option>`).join("")}
              </select>
            </label>
            <label class="intelligence-field">
              <span>Línea</span>
              <select data-intelligence-filter-panel="papers" data-filter-field="line">
                <option value="">Todas</option>
                ${IntelligenceState.monitoredLines().map(line => `<option value="${escapeHtml(line)}"${line === state.line ? " selected" : ""}>${escapeHtml(line)}</option>`).join("")}
              </select>
            </label>
            <label class="intelligence-field">
              <span>Fuente</span>
              <select data-intelligence-filter-panel="papers" data-filter-field="source">
                <option value="">Todas</option>
                ${sourceOptions.map(source => `<option value="${escapeHtml(source)}"${source === state.source ? " selected" : ""}>${escapeHtml(source)}</option>`).join("")}
              </select>
            </label>
            <label class="intelligence-field">
              <span>Rango de fechas</span>
              <select data-intelligence-filter-panel="papers" data-filter-field="dateRange">
                ${DATE_RANGE_OPTIONS.map(option => `<option value="${escapeHtml(option.value)}"${option.value === state.dateRange ? " selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
              </select>
            </label>
            <label class="intelligence-field">
              <span>Orden</span>
              <select data-intelligence-filter-panel="papers" data-filter-field="sort">
                ${paperSortOptions().map(option => `<option value="${escapeHtml(option.value)}"${option.value === state.sort ? " selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
              </select>
            </label>
          </div>
          <div class="intelligence-paper-filter-rail">
            <label class="intelligence-toggle">
              <input type="checkbox" data-intelligence-filter-panel="papers" data-filter-field="openAccessOnly"${state.openAccessOnly ? " checked" : ""} />
              <span>Solo acceso abierto</span>
            </label>
            <label class="intelligence-toggle">
              <input type="checkbox" data-intelligence-filter-panel="papers" data-filter-field="withAbstractOnly"${state.withAbstractOnly ? " checked" : ""} />
              <span>Con abstract</span>
            </label>
            <label class="intelligence-toggle">
              <input type="checkbox" data-intelligence-filter-panel="papers" data-filter-field="duplicatesOnly"${state.duplicatesOnly ? " checked" : ""} />
              <span>Posibles duplicados</span>
            </label>
          </div>
          <div class="intelligence-paper-source-row">
            <span class="intelligence-source-row-label">Fuentes rápidas</span>
            <div class="intelligence-source-chip-list">
              ${paperSourceChips(state.source).join("")}
            </div>
          </div>
        </div>
        <div class="intelligence-paper-results">
          ${items.length ? items.slice(0, IntelligenceState.visibleCounts.papers).map(renderPaperCard).join("") : ""}
        </div>
        ${items.length ? loadMoreMarkup("papers", items.length) : researchEmptyStateMarkup("papers", state)}
      </article>
    `;
  }

  function duplicateBadge(item) {
    return item.possibleDuplicate ? `<span class="intelligence-meta-pill intelligence-meta-pill-warn">Posible duplicado</span>` : "";
  }

  function renderGrants(target) {
    renderResearchTable(target, "grants", {
      title: "Grants",
      items: IntelligenceState.filteredGrants(),
      filters: IntelligenceState.filters.grants,
      rows: item => `
        <tr>
          <td><strong>${escapeHtml(item.title)}</strong>${duplicateBadge(item)}<small>${escapeHtml(item.abstract || "Sin abstract")}</small></td>
          <td>${escapeHtml(formatDate(item.startDate || item.endDate))}</td>
          <td>${escapeHtml(item.agency || IntelligenceState.sourceHost(item.sourceUrl))}</td>
          <td>${escapeHtml(joinList(item.principalInvestigators, 3))}</td>
          <td>${escapeHtml(joinList(item.institutions, 2))}</td>
          <td>${topicPills(item.topics)}</td>
          <td>${escapeHtml(item.amount ? `${number(item.amount)} ${item.currency || ""}`.trim() : "-")}</td>
          <td><a href="${escapeAttr(safeExternalUrl(item.sourceUrl || "#"))}" target="_blank" rel="noopener noreferrer">Abrir</a></td>
        </tr>
      `
    });
  }

  function renderPatents(target) {
    renderResearchTable(target, "patents", {
      title: "Patentes",
      items: IntelligenceState.filteredPatents(),
      filters: IntelligenceState.filters.patents,
      rows: item => `
        <tr>
          <td><strong>${escapeHtml(item.title)}</strong>${duplicateBadge(item)}<small>${escapeHtml(item.abstract || "Sin abstract")}</small></td>
          <td>${escapeHtml(formatDate(item.publicationDate || item.filingDate))}</td>
          <td>${escapeHtml(item.jurisdiction || IntelligenceState.sourceHost(item.sourceUrl))}</td>
          <td>${escapeHtml(joinList(item.inventors, 3))}</td>
          <td>${escapeHtml(joinList(item.assignees, 2))}</td>
          <td>${topicPills(item.topics)}</td>
          <td>${escapeHtml(item.status || "-")}</td>
          <td><a href="${escapeAttr(safeExternalUrl(item.sourceUrl || "#"))}" target="_blank" rel="noopener noreferrer">Abrir</a></td>
        </tr>
      `
    });
  }

  function renderTrials(target) {
    renderResearchTable(target, "trials", {
      title: "Ensayos",
      items: IntelligenceState.filteredTrials(),
      filters: IntelligenceState.filters.trials,
      rows: item => `
        <tr>
          <td><strong>${escapeHtml(item.title)}</strong>${duplicateBadge(item)}<small>${escapeHtml(item.summary || "Sin resumen")}</small></td>
          <td>${escapeHtml(formatDate(item.startDate || item.completionDate))}</td>
          <td>${escapeHtml(item.sponsor || IntelligenceState.sourceHost(item.sourceUrl))}</td>
          <td>${escapeHtml(joinList(item.interventions, 2))}</td>
          <td>${escapeHtml(joinList(item.locations, 2))}</td>
          <td>${topicPills(item.topics)}</td>
          <td>${escapeHtml(item.status || item.phase || "-")}</td>
          <td><a href="${escapeAttr(safeExternalUrl(item.sourceUrl || "#"))}" target="_blank" rel="noopener noreferrer">Abrir</a></td>
        </tr>
      `
    });
  }

  function renderResearchTable(target, panelName, config) {
    if (!target) return;
    const filterState = config.filters;
    const duplicateCount = config.items.filter(item => item.possibleDuplicate).length;
    target.innerHTML = `
      <article class="activity-surface intelligence-card intelligence-card-wide">
        <div class="activity-head">
          <h3>${escapeHtml(config.title)}</h3>
          <span>${number(config.items.length)}${duplicateCount ? ` · ${number(duplicateCount)} posibles duplicados` : ""}</span>
        </div>
        <div class="intelligence-filter-grid">
          <label class="intelligence-field">
            <span>Tema</span>
            <select data-intelligence-filter-panel="${escapeAttr(panelName)}" data-filter-field="topic">
              <option value="">Todos</option>
              ${IntelligenceState.topicOptions().map(topic => `<option value="${escapeHtml(topic.name)}"${topic.name === filterState.topic ? " selected" : ""}>${escapeHtml(topic.name)}</option>`).join("")}
            </select>
          </label>
          ${panelName === "papers" ? `
            <label class="intelligence-field">
              <span>Fuente</span>
              <select data-intelligence-filter-panel="${escapeAttr(panelName)}" data-filter-field="source">
                <option value="">Todas</option>
                ${config.sourceOptions.map(source => `<option value="${escapeHtml(source)}"${source === filterState.source ? " selected" : ""}>${escapeHtml(source)}</option>`).join("")}
              </select>
            </label>
          ` : ""}
          <label class="intelligence-field">
            <span>Línea</span>
            <select data-intelligence-filter-panel="${escapeAttr(panelName)}" data-filter-field="line">
              <option value="">Todas</option>
              ${IntelligenceState.monitoredLines().map(line => `<option value="${escapeHtml(line)}"${line === filterState.line ? " selected" : ""}>${escapeHtml(line)}</option>`).join("")}
            </select>
          </label>
          <label class="intelligence-field">
            <span>Rango de fechas</span>
            <select data-intelligence-filter-panel="${escapeAttr(panelName)}" data-filter-field="dateRange">
              ${DATE_RANGE_OPTIONS.map(option => `<option value="${escapeHtml(option.value)}"${option.value === filterState.dateRange ? " selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
            </select>
          </label>
          <label class="intelligence-field intelligence-field-wide">
            <span>Palabra clave</span>
            <input type="search" data-intelligence-filter-panel="${escapeAttr(panelName)}" data-filter-field="keyword" value="${escapeAttr(filterState.keyword)}" placeholder="Buscar por título, abstract, autores, instituciones..." />
          </label>
        </div>
        <label class="intelligence-toggle">
          <input type="checkbox" data-intelligence-filter-panel="${escapeAttr(panelName)}" data-filter-field="duplicatesOnly"${filterState.duplicatesOnly ? " checked" : ""} />
          <span>Solo posibles duplicados</span>
        </label>
        <div class="table-scroll intelligence-table-wrap">
          <table class="account-table intelligence-table">
            <thead>
              <tr>
                <th>Título</th>
                <th>Fecha</th>
                <th>${panelName === "grants" ? "Agencia" : panelName === "patents" ? "Jurisdicción" : panelName === "trials" ? "Patrocinador" : "Fuente"}</th>
                <th>${panelName === "grants" ? "Investigadores" : panelName === "patents" ? "Inventores" : panelName === "trials" ? "Intervenciones" : "Autores"}</th>
                <th>${panelName === "patents" ? "Asignatarios" : panelName === "trials" ? "Ubicaciones" : "Instituciones"}</th>
                <th>Temas</th>
                <th>${panelName === "grants" ? "Monto" : panelName === "patents" ? "Estado" : panelName === "trials" ? "Estado / fase" : "Citas"}</th>
                <th>Enlace</th>
              </tr>
            </thead>
            <tbody>
              ${config.items.length ? config.items.slice(0, IntelligenceState.visibleCounts[panelName]).map(config.rows).join("") : `<tr><td colspan="8">${emptyCell(researchEmptyMessage(panelName, filterState))}</td></tr>`}
            </tbody>
          </table>
        </div>
        ${config.items.length ? loadMoreMarkup(panelName, config.items.length) : researchEmptyStateMarkup(panelName, filterState)}
      </article>
    `;
  }

  function renderInstitutions(target) {
    if (!target) return;
    const institutions = [...IntelligenceState.dashboard.institutions].sort((left, right) => (right.relatedPapersCount || 0) - (left.relatedPapersCount || 0));
    target.innerHTML = `
      <article class="activity-surface intelligence-card intelligence-card-wide">
        <div class="activity-head">
          <h3>Instituciones</h3>
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
                <th>Patentes</th>
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

  function renderTopics(target) {
    if (!target) return;
    const dashboard = IntelligenceState.dashboard;
    const topic = IntelligenceState.selectedTopic();
    const portfolio = IntelligenceState.topicPortfolio();
    const selectedInsight = topic ? IntelligenceState.topicInsight(topic) : null;
    target.innerHTML = `
      <section class="intelligence-grid intelligence-grid-overview intelligence-detail-layout">
        <article class="activity-surface intelligence-card">
          <div class="activity-head">
            <h3>Temas</h3>
            <span>${number(dashboard.topics.length)}</span>
          </div>
          <div class="intelligence-summary-strip">
            <div class="intelligence-summary-chip">
              <span>Activos</span>
              <strong>${number(portfolio.activeCount)}</strong>
              <small>${number(portfolio.disabledCount)} en pausa</small>
            </div>
            <div class="intelligence-summary-chip">
              <span>En tendencia</span>
              <strong>${number(portfolio.hotCount)}</strong>
              <small>${number(portfolio.coldCount)} fríos</small>
            </div>
            <div class="intelligence-summary-chip">
              <span>Cobertura</span>
              <strong>${number(portfolio.coveredCount)}</strong>
              <small>${number(portfolio.uncoveredCount)} sin resultados</small>
            </div>
            <div class="intelligence-summary-chip">
              <span>Keywords promedio</span>
              <strong>${number(portfolio.averageKeywords)}</strong>
              <small>por tema</small>
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
                const insight = IntelligenceState.topicInsight(item);
                return `
              <article class="intelligence-topic-item${item.id === IntelligenceState.selectedTopicId ? " is-active" : ""}">
                <div class="intelligence-topic-topline">
                  <div>
                    <h4>${escapeHtml(item.name)}</h4>
                    <p>${escapeHtml(item.description || "Sin descripción")}</p>
                  </div>
                  <span class="intelligence-health-pill intelligence-health-${escapeAttr(insight.health)}">${escapeHtml(insight.healthLabel)}</span>
                </div>
                <div class="intelligence-stack-meta">
                  <span>${escapeHtml(IntelligenceState.topicCategoryLabel(item.category))} · ${escapeHtml(insight.line)}</span>
                  <strong>${item.enabled ? "Activo" : "Desactivado"}</strong>
                </div>
                <div class="intelligence-mini-metrics intelligence-mini-metrics-tight intelligence-topic-metrics">
                  <div><span>Papers</span><strong>${number(insight.paperHits)}</strong></div>
                  <div><span>Señales</span><strong>${number(insight.signalHits)}</strong></div>
                  <div><span>Activos</span><strong>${number(insight.totalHits)}</strong></div>
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
            `).join("") : emptyMarkup("No hay topics configurados.", "Agrega los temas monitoreados que deben impulsar el radar antes de correr el primer sync.", [
              { label: "Agregar topic", cta: "add-topic" }
            ])}
          </div>
        </article>
        <article class="activity-surface intelligence-card">
          <div class="activity-head">
            <h3>${topic ? "Editar topic" : "Nuevo topic"}</h3>
            <span>${escapeHtml(topic ? topic.name : "Borrador")}</span>
          </div>
          ${selectedInsight ? `
            <div class="intelligence-mini-metrics intelligence-topic-coverage">
              <div><span>Línea</span><strong>${escapeHtml(selectedInsight.line)}</strong></div>
              <div><span>Tendencia</span><strong>${escapeHtml(selectedInsight.healthLabel)}</strong></div>
              <div><span>Keywords</span><strong>${number(selectedInsight.keywordCount)}</strong></div>
              <div><span>Activos</span><strong>${number(selectedInsight.totalHits)}</strong></div>
            </div>
          ` : ""}
          <form class="intelligence-form" data-intelligence-topic-form>
            <input type="hidden" name="id" value="${escapeAttr(topic?.id || "")}" />
            <label class="intelligence-field">
              <span>Nombre</span>
              <input type="text" name="name" value="${escapeAttr(topic?.name || "")}" required maxlength="160" />
            </label>
            <label class="intelligence-field">
              <span>Categoría</span>
              <select name="category">
                ${Object.entries(TOPIC_CATEGORY_LABELS).map(([value, label]) => `
                  <option value="${escapeHtml(value)}"${value === (topic?.category || "general") ? " selected" : ""}>${escapeHtml(label)}</option>
                `).join("")}
              </select>
            </label>
            <label class="intelligence-field intelligence-field-wide">
              <span>Descripción</span>
              <textarea name="description">${escapeHtml(topic?.description || "")}</textarea>
            </label>
            <label class="intelligence-field intelligence-field-wide">
              <span>Keywords</span>
              <textarea name="keywords" placeholder="keyword 1, keyword 2, keyword 3">${escapeHtml((topic?.keywords || []).join(", "))}</textarea>
            </label>
            <label class="intelligence-toggle">
              <input type="checkbox" name="enabled"${topic?.enabled !== false ? " checked" : ""} />
              <span>Activo</span>
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

  function renderSources(target) {
    if (!target) return;
    const dashboard = IntelligenceState.dashboard;
    const source = IntelligenceState.selectedSource();
    const health = IntelligenceState.sourcePortfolio();
    const selectedHealth = source ? IntelligenceState.sourceInsight(source) : null;
    target.innerHTML = `
      <section class="intelligence-grid intelligence-grid-overview intelligence-detail-layout">
        <article class="activity-surface intelligence-card intelligence-card-wide">
          <div class="activity-head">
            <h3>Fuentes</h3>
            <span>${number(dashboard.sources.length)}</span>
          </div>
          <div class="intelligence-summary-strip">
            <div class="intelligence-summary-chip">
              <span>Activas</span>
              <strong>${number(health.enabledCount)}</strong>
              <small>${number(health.pausedCount)} en pausa</small>
            </div>
            <div class="intelligence-summary-chip">
              <span>Protegidas</span>
              <strong>${number(health.protectedCount)}</strong>
              <small>sensibles a cuota</small>
            </div>
            <div class="intelligence-summary-chip">
              <span>Nunca sincronizadas</span>
              <strong>${number(health.neverSyncedCount)}</strong>
              <small>necesitan primer éxito</small>
            </div>
            <div class="intelligence-summary-chip">
              <span>Estables</span>
              <strong>${number(health.stableCount)}</strong>
              <small>${number(health.watchCount)} en observación</small>
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
                  <th>Fuente</th>
                  <th>Activa</th>
                  <th>Último sync</th>
                  <th>Requiere API key</th>
                  <th>Estado</th>
                  <th>Notas</th>
                </tr>
              </thead>
              <tbody>
                ${dashboard.sources.length ? dashboard.sources.map(item => `
                  ${(() => {
                    const insight = IntelligenceState.sourceInsight(item);
                    return `
                  <tr class="${item.id === IntelligenceState.selectedSourceId ? "is-selected" : ""}" data-source-select="${escapeAttr(item.id)}">
                    <td><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.type)} · ${escapeHtml(item.baseUrl || "-")}</small></td>
                    <td>${item.enabled ? "Sí" : "No"}</td>
                    <td>${escapeHtml(formatDateTime(item.lastSyncAt))}</td>
                    <td>${item.requiresApiKey ? "Sí" : "No"}</td>
                    <td><span class="intelligence-status-pill intelligence-health-${escapeAttr(insight.health)}">${escapeHtml(insight.status)}</span></td>
                    <td>${escapeHtml(insight.note)}</td>
                  </tr>
                    `;
                  })()}
                `).join("") : `<tr><td colspan="6">${emptyCell("No hay fuentes de intelligence configuradas.")}</td></tr>`}
              </tbody>
            </table>
          </div>
          ${sourcesEmptyStateMarkup()}
        </article>
        <article class="activity-surface intelligence-card">
          <div class="activity-head">
            <h3>Detalle de la fuente</h3>
            <span>${escapeHtml(source ? source.name : "Sin selección")}</span>
          </div>
          ${source ? `
            <div class="intelligence-mini-metrics intelligence-source-detail-summary">
              <div><span>Estado</span><strong>${escapeHtml(selectedHealth.status)}</strong></div>
              <div><span>Modo API</span><strong>${selectedHealth.requiresApiKey ? "Protegida" : "Abierta"}</strong></div>
              <div><span>Último sync</span><strong>${escapeHtml(selectedHealth.lastSyncLabel)}</strong></div>
              <div><span>Antigüedad del sync</span><strong>${escapeHtml(selectedHealth.syncAgeLabel)}</strong></div>
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
                <span>Fuente</span>
                <input type="text" value="${escapeAttr(source.name)}" readonly />
              </label>
              <label class="intelligence-field">
                <span>Estado</span>
                <input type="text" value="${escapeAttr(IntelligenceState.sourceStatus(source))}" readonly />
              </label>
              <label class="intelligence-toggle">
                <input type="checkbox" name="enabled"${source.enabled ? " checked" : ""} />
                <span>Activa</span>
              </label>
              <label class="intelligence-field intelligence-field-wide">
                <span>Notas</span>
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

  function renderSettings(target) {
    if (!target) return;
    const settings = IntelligenceState.dashboard.settings || IntelligenceState.defaultSettings();
    target.innerHTML = `
      <article class="activity-surface intelligence-card intelligence-card-wide">
        <div class="activity-head">
          <h3>Configuración</h3>
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
            <span>Umbral de oportunidad</span>
            <input type="number" name="thresholdOpportunity" min="0" max="100" value="${escapeAttr(settings.scoringThresholds?.opportunity ?? 60)}" />
          </label>
          <label class="intelligence-field">
            <span>Umbral de actionabilidad</span>
            <input type="number" name="thresholdActionability" min="0" max="100" value="${escapeAttr(settings.scoringThresholds?.actionability ?? 50)}" />
          </label>
          <label class="intelligence-field">
            <span>Umbral de confianza</span>
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
            <button class="btn btn-primary" type="submit">Guardar configuración</button>
          </div>
        </form>
      </article>
    `;
  }

  function signalDetailMarkup(signal) {
    const evidence = Array.isArray(signal.evidenceRefs) ? signal.evidenceRefs : [];
    const breakdown = signal.scoreBreakdown && typeof signal.scoreBreakdown === "object" ? signal.scoreBreakdown : {};
    const highlights = signalBreakdownHighlights(breakdown);
    const grouped = {
      paper: evidence.filter(item => item?.type === "paper"),
      grant: evidence.filter(item => item?.type === "grant"),
      patent: evidence.filter(item => item?.type === "patent"),
      trial: evidence.filter(item => item?.type === "trial")
    };
    return `
      <div class="intelligence-signal-detail-hero">
        <div class="intelligence-signal-hero-copy">
          <div class="intelligence-stack-meta">
            <span>${escapeHtml(IntelligenceState.signalTypeLabel(signal.signalType))}</span>
            <strong>${escapeHtml(signal.relatedLine || "General")}</strong>
          </div>
          <h4>${escapeHtml(signal.title)}</h4>
          <p>${escapeHtml(signal.summary || "Sin resumen todavía.")}</p>
        </div>
        <div class="intelligence-mini-metrics intelligence-signal-hero-metrics">
          <div><span>Oportunidad</span><strong>${score(signal.opportunityScore)}</strong></div>
          <div><span>Actionabilidad</span><strong>${score(signal.actionabilityScore)}</strong></div>
          <div><span>Confianza</span><strong>${score(signal.confidenceScore)}</strong></div>
          <div><span>Evidencia</span><strong>${number(signal.evidenceCount || evidence.length)}</strong></div>
        </div>
      </div>
      <div class="intelligence-detail-grid intelligence-detail-grid-signals">
        <div class="intelligence-detail-stack">
          <div class="intelligence-detail-block">
            <h4>Recomendación</h4>
            <p>${escapeHtml(signal.recommendedAction || "Sin recomendación todavía.")}</p>
          </div>
          <div class="intelligence-detail-block">
            <h4>Por qué importa ahora</h4>
            <ul class="intelligence-related-list">
              ${highlights.map(item => `<li>${escapeHtml(item)}</li>`).join("")}
            </ul>
          </div>
          <div class="intelligence-detail-block">
            <h4>Evidencia</h4>
            ${evidence.length ? `
              <div class="intelligence-evidence-groups">
                ${renderEvidenceGroup("Papers", grouped.paper)}
                ${renderEvidenceGroup("Grants", grouped.grant)}
                ${renderEvidenceGroup("Patentes", grouped.patent)}
                ${renderEvidenceGroup("Ensayos", grouped.trial)}
              </div>
            ` : emptyMarkup("Sin evidencia", "Esta señal no debería existir sin evidencia, así que conviene revisarla.")}
          </div>
        </div>
        <div class="intelligence-detail-stack intelligence-detail-stack-side">
          <div class="intelligence-detail-block intelligence-detail-block-sticky">
            <div class="intelligence-mini-metrics intelligence-mini-metrics-tight">
              <div><span>Estado</span><strong>${escapeHtml(IntelligenceState.signalStatusLabel(signal.status))}${signal.autoArchived ? " (auto)" : ""}</strong></div>
              <div><span>Actualizado</span><strong>${escapeHtml(formatDateTime(signal.updatedAt || signal.createdAt))}</strong></div>
              <div><span>Tipo</span><strong>${escapeHtml(IntelligenceState.signalTypeLabel(signal.signalType))}</strong></div>
              <div><span>Línea</span><strong>${escapeHtml(signal.relatedLine || "General")}</strong></div>
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
            <h4>Activos relacionados</h4>
            <ul class="intelligence-related-list">
              <li>Papers relacionados: ${number(grouped.paper.length)}</li>
              <li>Grants relacionados: ${number(grouped.grant.length)}</li>
              <li>Patentes relacionadas: ${number(grouped.patent.length)}</li>
              <li>Ensayos relacionados: ${number(grouped.trial.length)}</li>
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
    if (typeof evidence.papers === "number" || typeof evidence.grants === "number" || typeof evidence.patents === "number" || typeof evidence.trials === "number") {
      list.push(`La señal se apoya en ${number((evidence.papers || 0) + (evidence.grants || 0) + (evidence.patents || 0) + (evidence.trials || 0))} assets relacionados.`);
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
        <h4>Desglose del score</h4>
        ${matching ? breakdownMetricList("Coincidencia", matching) : ""}
        ${opportunity ? breakdownMetricList("Factores de oportunidad", opportunity) : ""}
        ${actionability ? breakdownMetricList("Factores de actionabilidad", actionability) : ""}
        ${evidence ? breakdownMetricList("Densidad de evidencia", evidence, { plainNumber: true }) : ""}
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
      return emptyMarkup("Todavía no hay señales estratégicas generadas.", "Cuando el radar produzca señales, aparecerán aquí en un mapa de oportunidad vs actionability.", [
        { label: "Ejecutar primer sync", cta: "run-sync" }
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
      const tone = IntelligenceState.signalStatusTone(signal.status);
      toneCounts[tone] = (toneCounts[tone] || 0) + 1;
      return {
        id: signal.id,
        title: signal.title,
        tone,
        label: IntelligenceState.shortLineLabel(signal.relatedLine || "General"),
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
      { tone: "new", label: "Nueva" },
      { tone: "reviewing", label: "En revisión" },
      { tone: "accepted", label: "Aceptada" },
      { tone: "archived", label: "Archivada / rechazada" }
    ];
    return `
      <div class="intelligence-chart-card">
        <div class="intelligence-chart-head">
          <p>Oportunidad en X, actionabilidad en Y. Marcas más grandes indican mayor confianza.</p>
          <div class="intelligence-chart-legend">
            ${legend.map(item => `
              <span><i class="intelligence-dot intelligence-dot-${escapeAttr(item.tone)}"></i>${escapeHtml(item.label)}${toneCounts[item.tone] ? ` · ${number(toneCounts[item.tone])}` : ""}</span>
            `).join("")}
          </div>
        </div>
        <svg class="intelligence-chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Mapa de señales">
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
          <text x="${paddingX + 10}" y="${paddingTop + 18}" class="intelligence-chart-caption">Alta actionabilidad</text>
          <text x="${paddingX + plotWidth - 122}" y="${paddingTop + 18}" class="intelligence-chart-caption">Decisiones rápidas</text>
          <text x="${paddingX + plotWidth - 88}" y="${paddingTop + plotHeight - 12}" class="intelligence-chart-caption">Oportunidad</text>
          <text x="18" y="${paddingTop + 18}" class="intelligence-chart-caption intelligence-chart-caption-vertical">Actionabilidad</text>
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

  function runsTrendMarkup(entries) {
    const items = Array.isArray(entries) ? entries : [];
    if (!items.length) {
      return emptyMarkup("Todavía no hay runs", "Cuando el radar ejecute syncs, aquí verás si está trayendo datos o solo generando actividad vacía.");
    }
    const maxValue = Math.max(...items.flatMap(item => [item.fetched, item.saved, item.signals]), 1);
    return `
      <div class="intelligence-runtrend">
        <div class="intelligence-chart-legend">
          <span><i class="intelligence-bar intelligence-bar-fetched"></i>Encontrados</span>
          <span><i class="intelligence-bar intelligence-bar-saved"></i>Guardados</span>
          <span><i class="intelligence-bar intelligence-bar-signals"></i>Señales</span>
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
              <small>${escapeHtml(IntelligenceState.runStatusLabel(item.status))}</small>
            </article>
          `).join("")}
        </div>
      </div>
    `;
  }

  function paperSortOptions() {
    return [
      { value: "latest", label: "Más recientes primero" },
      { value: "citations", label: "Más citados" },
      { value: "updated", label: "Actualizados recientemente" },
      { value: "source", label: "Fuente A-Z" }
    ];
  }

  function paperFiltersActive(state) {
    return Boolean(
      state?.topic ||
      state?.source ||
      state?.line ||
      state?.keyword ||
      state?.openAccessOnly ||
      state?.withAbstractOnly ||
      state?.duplicatesOnly ||
      (state?.sort && state.sort !== "latest") ||
      (state?.dateRange && state.dateRange !== "90")
    );
  }

  function paperSourceChips(activeSource) {
    return paperTopSources().map(source => `
      <button class="intelligence-source-chip${source === activeSource ? " is-active" : ""}" type="button" data-paper-source-chip="${escapeAttr(source)}">
        ${escapeHtml(source)}
      </button>
    `);
  }

  function paperTopSources(limit = 6) {
    return IntelligenceState.paperTopSources(limit);
  }

  function renderPaperCard(item) {
    const sourceUrl = safeExternalUrl(item.sourceUrl || "#");
    const openAccessUrl = safeExternalUrl(item.openAccessUrl || "#");
    const line = IntelligenceState.deriveLine(item);
    const tags = [
      line ? `<span class="intelligence-meta-pill intelligence-meta-pill-line">${escapeHtml(line)}</span>` : "",
      item.sourceName ? `<span class="intelligence-meta-pill">${escapeHtml(item.sourceName)}</span>` : "",
      item.possibleDuplicate ? `<span class="intelligence-meta-pill intelligence-meta-pill-warn">Posible duplicado</span>` : "",
      item.openAccessUrl ? `<span class="intelligence-meta-pill intelligence-meta-pill-ok">Acceso abierto</span>` : ""
    ].filter(Boolean).join("");
    const abstract = trimText(item.abstract || "Sin abstract disponible.", 360);
    return `
      <article class="intelligence-paper-card">
        <div class="intelligence-paper-card-head">
          <div class="intelligence-paper-card-title">
            <h4>${escapeHtml(item.title)}</h4>
            <div class="intelligence-paper-card-tags">${tags}</div>
          </div>
          <div class="intelligence-paper-card-side">
            <strong>${number(item.citationsCount || 0)}</strong>
            <span>Citas</span>
          </div>
        </div>
        <div class="intelligence-paper-card-meta">
          <span>${escapeHtml(formatDate(item.publicationDate))}</span>
          <span>${escapeHtml(item.journalOrVenue || IntelligenceState.sourceHost(item.sourceUrl) || "Fuente sin venue")}</span>
          ${item.doi ? `<span>DOI: ${escapeHtml(item.doi)}</span>` : ""}
          ${item.arxivId ? `<span>arXiv: ${escapeHtml(item.arxivId)}</span>` : ""}
        </div>
        <p class="intelligence-paper-card-abstract">${escapeHtml(abstract)}</p>
        <div class="intelligence-paper-card-grid">
          <div>
            <span class="intelligence-paper-card-label">Autores</span>
            <strong>${escapeHtml(joinList(item.authors, 5))}</strong>
          </div>
          <div>
            <span class="intelligence-paper-card-label">Instituciones</span>
            <strong>${escapeHtml(joinList(item.institutions, 4))}</strong>
          </div>
        </div>
        <div class="intelligence-paper-card-footer">
          <div class="intelligence-paper-card-topics">${topicPills(item.topics)}</div>
          <div class="intelligence-paper-card-actions">
            <a class="btn btn-ghost btn-compact" href="${escapeAttr(sourceUrl)}" target="_blank" rel="noopener noreferrer">Abrir fuente</a>
            ${item.openAccessUrl ? `<a class="btn btn-primary btn-compact" href="${escapeAttr(openAccessUrl)}" target="_blank" rel="noopener noreferrer">Abrir PDF</a>` : ""}
          </div>
        </div>
      </article>
    `;
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

  function loadMoreMarkup(panelName, totalCount) {
    const shown = Math.min(IntelligenceState.visibleCounts[panelName] || 0, totalCount);
    if (shown >= totalCount) return "";
    return `
      <div class="intelligence-load-more">
        <span>Mostrando ${number(shown)} de ${number(totalCount)}</span>
        <button class="btn btn-ghost btn-compact" type="button" data-research-load-more="${escapeAttr(panelName)}">Cargar más</button>
      </div>
    `;
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
    return window.BCCWorkspaceUtils.formatDate(value, {
      empty: "-",
      dateOptions: { year: "numeric", month: "short", day: "2-digit" }
    });
  }

  function trimText(value, maxLength = 0) {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    if (!maxLength || text.length <= maxLength) return text;
    return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
  }

  function formatDateTime(value) {
    return window.BCCWorkspaceUtils.formatDateTime(value, { empty: "-" });
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
    const hasFilters = hasResearchFilters(panelName, filterState);
    if (hasFilters) return "No hay resultados para esos filtros.";
    if (panelName === "papers") return "Todavía no hay papers sincronizados.";
    if (panelName === "grants") return "Todavía no hay grants sincronizados.";
    if (panelName === "patents") return "Todavía no hay patentes sincronizadas.";
    if (panelName === "trials") return "Todavía no hay ensayos sincronizados.";
    return "No hay resultados todavía.";
  }

  function researchEmptyStateMarkup(panelName, filterState) {
    const hasFilters = hasResearchFilters(panelName, filterState);
    if (hasFilters) {
      return emptyMarkup("No hay resultados que coincidan.", "Ajusta los filtros o limpia la palabra clave para ampliar la vista actual.");
    }
    if (panelName === "papers") {
      return emptyMarkup("Todavía no hay papers sincronizados.", "El radar todavía no ha guardado papers científicos.", [
        { label: "Ejecutar primer sync", cta: "run-sync" }
      ]);
    }
    if (panelName === "grants") {
      return emptyMarkup("Todavía no hay grants sincronizados.", "La obtención de grants ya está implementada, pero el sync automático diario solo corre para papers. Selecciona \"Obtener grants\" en la acción de sync y ejecútalo manualmente para traer resultados.");
    }
    if (panelName === "patents") {
      return emptyMarkup("Todavía no hay patentes sincronizadas.", "La obtención de patentes ya está implementada, pero el sync automático diario solo corre para papers. Selecciona \"Obtener patentes\" en la acción de sync y ejecútalo manualmente para traer resultados.");
    }
    if (panelName === "trials") {
      return emptyMarkup("Todavía no hay ensayos sincronizados.", "El radar todavía no ha guardado estudios de ClinicalTrials.gov.", [
        { label: "Ejecutar primer sync", cta: "run-sync" }
      ]);
    }
    return "";
  }

  function hasResearchFilters(panelName, filterState) {
    if (panelName === "papers") return paperFiltersActive(filterState);
    return Boolean(filterState?.topic || filterState?.source || filterState?.line || filterState?.keyword || filterState?.duplicatesOnly || (filterState?.dateRange && filterState.dateRange !== "90"));
  }

  function sourcesEmptyStateMarkup() {
    const dashboard = IntelligenceState.dashboard;
    if (dashboard.sources.length) {
      if (!dashboard.sources.some(item => item.enabled)) {
        return emptyMarkup("No hay fuentes de intelligence activas.", "Existen fuentes pero ninguna está activa, así que el radar no puede traer nada todavía.", [
          { label: "Activar fuente", cta: "enable-source" }
        ]);
      }
      return "";
    }
    return emptyMarkup("No hay fuentes de intelligence configuradas.", "Crea o registra fuentes antes de intentar el primer sync.");
  }

  function escapeHtml(value) {
    return window.BCCWorkspaceUtils.escapeHtml(value);
  }

  function escapeAttr(value) {
    return window.BCCWorkspaceUtils.escapeAttr(value);
  }

  window.BCCWorkspaceIntelligenceView = {
    shellMarkup,
    renderOverview,
    renderSignals,
    renderPapers,
    renderGrants,
    renderPatents,
    renderTrials,
    renderInstitutions,
    renderTopics,
    renderSources,
    renderSettings,
    researchEmptyMessage,
    researchEmptyStateMarkup,
    hasResearchFilters,
    escapeHtml,
    escapeAttr
  };
})();
