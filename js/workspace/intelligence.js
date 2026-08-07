/* Controller for the Science Radar (Intelligence) feature: DOM wiring, event handling and network actions. */
(() => {
  const api = window.BCCWorkspaceIntelligenceApi;
  const IntelligenceState = window.BCCWorkspaceIntelligenceState;
  const View = window.BCCWorkspaceIntelligenceView;
  const { PANELS, RESEARCH_PAGE_SIZE } = window.BCCWorkspaceIntelligenceConstants;

  let root = null;
  let runningSync = false;

  function init(account) {
    root = document.querySelector("[data-intelligence-workspace]");
    if (!root || root.dataset.ready === "true") return;
    root.dataset.ready = "true";
    IntelligenceState.currentUser = account;
    root.innerHTML = View.shellMarkup(IntelligenceState.currentPanel);
    refreshIcons();
    bindControls();
    void loadDashboard();
  }

  function bindControls() {
    root.addEventListener("click", handleClick);
    root.addEventListener("change", handleChange);
    root.addEventListener("submit", handleSubmit);
  }

  async function loadDashboard() {
    const cached = IntelligenceState.readDashboardCache();
    const hadSnapshot = IntelligenceState.hasDashboardContent(IntelligenceState.dashboard);
    if (cached) {
      IntelligenceState.applyDashboardState(cached.dashboard, { persist: false });
      setMessage(`Mostrando snapshot guardado (${IntelligenceState.snapshotAgeLabel(cached.savedAt)}) mientras se actualiza...`, "neutral");
      renderAll();
    } else if (hadSnapshot) {
      setMessage("Actualizando intelligence...", "neutral");
      renderAll();
    } else {
      setMessage("Cargando intelligence...", "neutral");
    }
    try {
      const data = await api.loadDashboard();
      IntelligenceState.applyDashboardState(data.dashboard);
      setMessage(cached ? "Intelligence actualizado. Snapshot refrescado correctamente." : "");
      renderAll();
    } catch (error) {
      const message = error.message || "No fue posible cargar intelligence.";
      if (cached || hadSnapshot || IntelligenceState.hasDashboardContent(IntelligenceState.dashboard)) {
        setMessage(`${message} Mostrando snapshot guardado para mantener la vista estable.`, "error");
        renderAll();
        return;
      }
      IntelligenceState.dashboard = IntelligenceState.emptyDashboard();
      IntelligenceState.filters = Object.keys(IntelligenceState.filters).length ? IntelligenceState.filters : IntelligenceState.defaultFilters("90");
      setMessage(message, "error");
      renderAll();
    }
  }

  function renderAll() {
    syncActionField().value = IntelligenceState.currentAction;
    dryRunField().checked = IntelligenceState.syncDryRun;
    renderPanels();
    refreshIcons();
  }

  function renderPanels() {
    PANELS.forEach(panel => {
      const target = panelRoot(panel);
      if (!target) return;
      target.classList.toggle("is-hidden", panel !== IntelligenceState.currentPanel);
    });
    navChips().forEach(button => {
      button.classList.toggle("is-active", button.dataset.panelTarget === IntelligenceState.currentPanel);
    });
    View.renderOverview(panelRoot("overview"));
    View.renderSignals(panelRoot("signals"));
    View.renderPapers(panelRoot("papers"));
    View.renderGrants(panelRoot("grants"));
    View.renderPatents(panelRoot("patents"));
    View.renderTrials(panelRoot("trials"));
    View.renderInstitutions(panelRoot("institutions"));
    View.renderTopics(panelRoot("topics"));
    View.renderSources(panelRoot("sources"));
    View.renderSettings(panelRoot("settings"));
  }

  function handleClick(event) {
    // The bulk-select checkbox lives inside a signal card that itself carries
    // data-signal-select; without this early return, clicking the checkbox
    // would also open that signal's detail view.
    if (event.target.closest("[data-signal-bulk-toggle-wrap]")) return;

    const ctaButton = event.target.closest("[data-intelligence-cta]");
    if (ctaButton) {
      handleEmptyStateAction(String(ctaButton.dataset.intelligenceCta || ""));
      return;
    }

    const panelButton = event.target.closest("[data-panel-target]");
    if (panelButton) {
      IntelligenceState.currentPanel = panelButton.dataset.panelTarget || "overview";
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
      const run = IntelligenceState.dashboard.runs.find(item => item.id === (copyErrorButton.dataset.intelligenceCopyError || ""));
      if (run?.errorMessage) {
        void copyErrorDetail(copyErrorButton, run.errorMessage);
      }
      return;
    }

    const signalSelect = event.target.closest("[data-signal-select]");
    if (signalSelect) {
      IntelligenceState.selectedSignalId = signalSelect.dataset.signalSelect || "";
      if (IntelligenceState.currentPanel !== "signals") {
        IntelligenceState.currentPanel = "signals";
        renderPanels();
      } else {
        View.renderSignals(panelRoot("signals"));
        refreshIcons();
      }
      return;
    }

    const signalAction = event.target.closest("[data-signal-status]");
    if (signalAction) {
      void updateSignalStatus(signalAction.dataset.signalId || "", signalAction.dataset.signalStatus || "");
      return;
    }

    const bulkSignalAction = event.target.closest("[data-signal-bulk-status]");
    if (bulkSignalAction) {
      void bulkUpdateSignalStatus([...IntelligenceState.selectedBulkSignalIds], bulkSignalAction.dataset.signalBulkStatus || "");
      return;
    }

    if (event.target.closest("[data-signal-bulk-clear]")) {
      IntelligenceState.selectedBulkSignalIds.clear();
      View.renderSignals(panelRoot("signals"));
      refreshIcons();
      return;
    }

    const topicSelect = event.target.closest("[data-topic-select]");
    if (topicSelect) {
      IntelligenceState.selectedTopicId = topicSelect.dataset.topicSelect || "";
      View.renderTopics(panelRoot("topics"));
      return;
    }

    const topicToggle = event.target.closest("[data-topic-toggle]");
    if (topicToggle) {
      const topic = IntelligenceState.dashboard.topics.find(item => item.id === (topicToggle.dataset.topicToggle || ""));
      if (topic) void saveTopic({ id: topic.id, enabled: !topic.enabled });
      return;
    }

    if (event.target.closest("[data-topic-reset]")) {
      IntelligenceState.selectedTopicId = "";
      View.renderTopics(panelRoot("topics"));
      return;
    }

    if (event.target.closest("[data-papers-reset]")) {
      IntelligenceState.filters.papers = IntelligenceState.defaultFilters(String(IntelligenceState.pickDateRange(IntelligenceState.dashboard.settings.defaultDateRangeDays))).papers;
      IntelligenceState.visibleCounts.papers = RESEARCH_PAGE_SIZE.papers;
      View.renderPapers(panelRoot("papers"));
      return;
    }

    const paperSourceChip = event.target.closest("[data-paper-source-chip]");
    if (paperSourceChip) {
      const nextSource = paperSourceChip.dataset.paperSourceChip || "";
      IntelligenceState.filters.papers.source = IntelligenceState.filters.papers.source === nextSource ? "" : nextSource;
      IntelligenceState.visibleCounts.papers = RESEARCH_PAGE_SIZE.papers;
      View.renderPapers(panelRoot("papers"));
      return;
    }

    const loadMoreButton = event.target.closest("[data-research-load-more]");
    if (loadMoreButton) {
      const panel = String(loadMoreButton.dataset.researchLoadMore || "");
      if (!RESEARCH_PAGE_SIZE[panel]) return;
      IntelligenceState.visibleCounts[panel] = (IntelligenceState.visibleCounts[panel] || RESEARCH_PAGE_SIZE[panel]) + RESEARCH_PAGE_SIZE[panel];
      if (panel === "papers") View.renderPapers(panelRoot("papers"));
      if (panel === "grants") View.renderGrants(panelRoot("grants"));
      if (panel === "patents") View.renderPatents(panelRoot("patents"));
      if (panel === "trials") View.renderTrials(panelRoot("trials"));
      return;
    }

    const sourceSelect = event.target.closest("[data-source-select]");
    if (sourceSelect) {
      IntelligenceState.selectedSourceId = sourceSelect.dataset.sourceSelect || "";
      View.renderSources(panelRoot("sources"));
      return;
    }

    const sourceToggle = event.target.closest("[data-source-toggle]");
    if (sourceToggle) {
      const source = IntelligenceState.dashboard.sources.find(item => item.id === (sourceToggle.dataset.sourceToggle || ""));
      if (source) void saveSource(source.id, { enabled: !source.enabled, rateLimitNotes: source.rateLimitNotes || "" });
    }
  }

  function handleChange(event) {
    if (event.target.matches("[data-intelligence-action]")) {
      IntelligenceState.currentAction = String(event.target.value || "sync_papers");
      return;
    }

    if (event.target.matches("[data-intelligence-dry-run]")) {
      IntelligenceState.syncDryRun = Boolean(event.target.checked);
      return;
    }

    if (event.target.matches("[data-signal-bulk-toggle]")) {
      const id = String(event.target.dataset.signalBulkToggle || "");
      if (!id) return;
      if (event.target.checked) IntelligenceState.selectedBulkSignalIds.add(id);
      else IntelligenceState.selectedBulkSignalIds.delete(id);
      View.renderSignals(panelRoot("signals"));
      refreshIcons();
      return;
    }

    if (event.target.matches("[data-intelligence-filter-panel]")) {
      const panel = String(event.target.dataset.intelligenceFilterPanel || "");
      const field = String(event.target.dataset.filterField || "");
      if (!IntelligenceState.filters[panel] || !field) return;
      IntelligenceState.filters[panel][field] = event.target.type === "checkbox"
        ? Boolean(event.target.checked)
        : String(event.target.value || "");
      if (RESEARCH_PAGE_SIZE[panel]) IntelligenceState.visibleCounts[panel] = RESEARCH_PAGE_SIZE[panel];
      if (panel === "papers") View.renderPapers(panelRoot("papers"));
      if (panel === "grants") View.renderGrants(panelRoot("grants"));
      if (panel === "patents") View.renderPatents(panelRoot("patents"));
      if (panel === "trials") View.renderTrials(panelRoot("trials"));
    }
  }

  function handleSubmit(event) {
    if (event.target.matches("[data-intelligence-topic-form]")) {
      event.preventDefault();
      void saveTopic(IntelligenceState.readTopicForm(event.target));
      return;
    }

    if (event.target.matches("[data-intelligence-source-form]")) {
      event.preventDefault();
      const id = IntelligenceState.fieldValue(event.target, "id");
      if (!id) return;
      void saveSource(id, {
        enabled: IntelligenceState.fieldChecked(event.target, "enabled"),
        rateLimitNotes: IntelligenceState.fieldValue(event.target, "rateLimitNotes")
      });
      return;
    }

    if (event.target.matches("[data-intelligence-settings-form]")) {
      event.preventDefault();
      void saveSettings(IntelligenceState.readSettingsForm(event.target));
    }
  }

  function handleEmptyStateAction(action) {
    if (action === "run-sync") {
      void runSync();
      return;
    }
    if (action === "add-topic") {
      IntelligenceState.currentPanel = "topics";
      IntelligenceState.selectedTopicId = "";
      renderPanels();
      return;
    }
    if (action === "enable-source") {
      IntelligenceState.currentPanel = "sources";
      const firstDisabled = IntelligenceState.dashboard.sources.find(item => !item.enabled);
      if (firstDisabled) IntelligenceState.selectedSourceId = firstDisabled.id;
      renderPanels();
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
      const data = await api.runSync({
        action: IntelligenceState.currentAction,
        dryRun: IntelligenceState.syncDryRun,
        reason: "Manual intelligence sync from dashboard"
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
      const data = await api.updateSignalStatus(id, status);
      IntelligenceState.upsertById(IntelligenceState.dashboard.signals, data.signal);
      IntelligenceState.invalidateTopicHits();
      IntelligenceState.selectedSignalId = data.signal.id;
      IntelligenceState.writeDashboardCache(IntelligenceState.dashboard);
      setMessage(`Señal marcada como ${IntelligenceState.signalStatusLabel(status)}.`, "ok");
      View.renderOverview(panelRoot("overview"));
      View.renderSignals(panelRoot("signals"));
      refreshIcons();
    } catch (error) {
      setMessage(error.message || "No fue posible actualizar la señal.", "error");
    }
  }

  async function bulkUpdateSignalStatus(ids, status) {
    const uniqueIds = [...new Set((Array.isArray(ids) ? ids : []).filter(Boolean))];
    if (!uniqueIds.length || !status) return;
    setMessage(`Actualizando ${uniqueIds.length} señal(es) a ${IntelligenceState.signalStatusLabel(status)}...`, "neutral");
    const results = await Promise.allSettled(uniqueIds.map(id => api.updateSignalStatus(id, status)));

    let succeeded = 0;
    results.forEach((result, index) => {
      const id = uniqueIds[index];
      if (result.status === "fulfilled") {
        IntelligenceState.upsertById(IntelligenceState.dashboard.signals, result.value.signal);
        IntelligenceState.selectedBulkSignalIds.delete(id);
        succeeded += 1;
      }
      // Failed ids stay checked in selectedBulkSignalIds so the toolbar
      // still shows them selected and the user can retry without re-picking.
    });

    if (succeeded) {
      IntelligenceState.invalidateTopicHits();
      IntelligenceState.writeDashboardCache(IntelligenceState.dashboard);
    }
    const failed = uniqueIds.length - succeeded;
    setMessage(
      failed
        ? `${succeeded} señal(es) marcadas como ${IntelligenceState.signalStatusLabel(status)}. ${failed} fallaron.`
        : `${succeeded} señal(es) marcadas como ${IntelligenceState.signalStatusLabel(status)}.`,
      failed ? "error" : "ok"
    );
    View.renderOverview(panelRoot("overview"));
    View.renderSignals(panelRoot("signals"));
    refreshIcons();
  }

  async function saveTopic(payload) {
    try {
      const data = await api.saveTopic(payload);
      IntelligenceState.upsertById(IntelligenceState.dashboard.topics, data.topic);
      IntelligenceState.invalidateTopicHits();
      IntelligenceState.selectedTopicId = data.topic.id;
      IntelligenceState.writeDashboardCache(IntelligenceState.dashboard);
      setMessage(payload.id ? "Topic actualizado." : "Topic creado.", "ok");
      View.renderOverview(panelRoot("overview"));
      View.renderTopics(panelRoot("topics"));
      View.renderPapers(panelRoot("papers"));
      View.renderGrants(panelRoot("grants"));
      View.renderPatents(panelRoot("patents"));
      View.renderTrials(panelRoot("trials"));
    } catch (error) {
      setMessage(error.message || "No fue posible guardar el topic.", "error");
    }
  }

  async function saveSource(id, payload) {
    try {
      const data = await api.saveSource(id, payload);
      IntelligenceState.upsertById(IntelligenceState.dashboard.sources, data.source);
      IntelligenceState.selectedSourceId = data.source.id;
      IntelligenceState.writeDashboardCache(IntelligenceState.dashboard);
      setMessage("Fuente actualizada.", "ok");
      View.renderOverview(panelRoot("overview"));
      View.renderSources(panelRoot("sources"));
      View.renderPapers(panelRoot("papers"));
      View.renderTrials(panelRoot("trials"));
    } catch (error) {
      setMessage(error.message || "No fue posible actualizar la fuente.", "error");
    }
  }

  async function saveSettings(payload) {
    try {
      const data = await api.saveSettings(payload);
      IntelligenceState.dashboard.settings = { ...IntelligenceState.defaultSettings(), ...(data.settings || {}) };
      IntelligenceState.syncDryRun = IntelligenceState.dashboard.settings.defaultDryRun;
      IntelligenceState.writeDashboardCache(IntelligenceState.dashboard);
      setMessage("Configuración guardada.", "ok");
      renderAll();
    } catch (error) {
      setMessage(error.message || "No fue posible guardar la configuración.", "error");
    }
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
      text || "Intelligence científica y tecnológica para monitorear señales estratégicas.",
      tone
    );
  }

  function renderMessageBlock(target, text, tone = "neutral") {
    window.BCCWorkspaceUtils.renderMessageBlock(target, text, tone);
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

  function refreshIcons() {
    window.BCCWorkspaceUtils.refreshIcons(root);
    window.refreshIcons?.();
  }

  window.BCCWorkspaceIntelligence = { init };
})();
