(() => {
  const { PHASES, EMAIL_STATUSES, TEMPLATE_HINTS, ACTIVITY_TYPES, PROSPECTS_TIMEOUT_MS } = window.BCCWorkspaceProspectsConstants;
  const ProspectsApi = window.BCCWorkspaceProspectsApi;
  const ProspectsLayout = window.BCCWorkspaceProspectsLayout;

  let root = null;
  let user = null;
  let prospects = [];
  let templates = [];
  let emails = [];
  let activities = [];
  let selectedProspectId = "";
  let selectedTemplateId = "";
  let templateDraft = null;
  let templateSearchTerm = "";
  let templateStatusFilter = "all";
  let templateCategoryFilter = "";
  let selectedEmailId = "";
  let selectedActivityId = "";
  let searchTerm = "";
  let phaseFilter = "";
  let directoryStatusFilter = "all";
  let directorySourceFilter = "";
  let directorySort = "priority";
  let directoryMode = "view";
  let directorySection = "profile";
  let activeTab = "home";
  let pipelineMode = "board";

  function init(account) {
    root = document.querySelector("[data-prospects-workspace]");
    if (!root || root.dataset.ready === "true") return;
    root.dataset.ready = "true";
    user = account;
    renderShell();
    bindControls();
    void loadDashboard();
  }

  function renderShell() {
    ProspectsLayout.renderShell(root, { phases: PHASES, escapeHtml, refreshIcons });
  }

  function bindControls() {
    root.querySelectorAll("[data-prospect-search]").forEach(input => {
      input.addEventListener("input", event => {
        searchTerm = String(event.target.value || "").trim().toLowerCase();
        syncProspectSearchControls(event.target);
        renderBoard();
        renderDirectoryList();
      });
    });
    root.querySelectorAll("[data-prospect-phase-filter]").forEach(select => {
      select.addEventListener("change", event => {
        phaseFilter = String(event.target.value || "");
        syncProspectPhaseControls(event.target);
        renderBoard();
        renderDirectoryList();
      });
    });
    root.querySelectorAll("[data-prospects-refresh]").forEach(button => {
      button.addEventListener("click", () => {
        void loadDashboard();
      });
    });
    root.querySelectorAll("[data-prospects-tab]").forEach(button => {
      button.addEventListener("click", () => activateProspectsTab(button.dataset.prospectsTab || "pipeline"));
    });
    root.querySelectorAll("[data-prospect-new]").forEach(button => {
      button.addEventListener("click", () => {
        selectedProspectId = "";
        selectedEmailId = "";
        selectedActivityId = "";
        directoryMode = "edit";
        renderAll();
        activateProspectsTab("directory");
      });
    });
    root.querySelector("[data-prospects-board]")?.addEventListener("click", handleBoardClick);
    root.querySelector("[data-prospects-directory-list]")?.addEventListener("click", handleDirectoryClick);
    root.querySelector(".prospect-directory-side")?.addEventListener("click", handleDirectorySideClick);
    root.addEventListener("click", handleProspectJump);
    root.addEventListener("click", handleTemplateClick);
    root.querySelector("[data-prospect-email-section]")?.addEventListener("click", handleEmailClick);
    root.querySelector("[data-activity-list]")?.addEventListener("click", handleActivityClick);
    root.querySelector("[data-prospect-form]")?.addEventListener("submit", saveProspect);
    root.querySelector("[data-template-form]")?.addEventListener("submit", saveTemplate);
    root.querySelector("[data-activity-form]")?.addEventListener("submit", saveActivity);
  }

  function activateProspectsTab(tab = "pipeline") {
    const allowedTabs = new Set(["home", "pipeline", "directory", "inbox", "templates", "intelligence"]);
    activeTab = allowedTabs.has(tab) ? tab : "home";
    root.querySelectorAll("[data-prospects-tab]").forEach(button => {
      const active = button.dataset.prospectsTab === activeTab;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
    root.querySelectorAll("[data-prospects-panel]").forEach(panel => {
      const active = panel.dataset.prospectsPanel === activeTab;
      panel.hidden = !active;
      panel.classList.toggle("active", active);
    });
    refreshIcons();
  }

  function syncProspectSearchControls(source) {
    root.querySelectorAll("[data-prospect-search]").forEach(input => {
      if (input !== source) input.value = source.value;
    });
  }

  function syncProspectPhaseControls(source) {
    root.querySelectorAll("[data-prospect-phase-filter]").forEach(select => {
      if (select !== source) select.value = source.value;
    });
  }

  async function loadDashboard() {
    setMessage("Cargando prospectos...", "neutral");
    try {
      const data = await ProspectsApi.loadDashboard({ timeoutMs: PROSPECTS_TIMEOUT_MS, withTimeout });
      prospects = Array.isArray(data.prospects) ? data.prospects : [];
      templates = Array.isArray(data.templates) ? data.templates : [];
      emails = Array.isArray(data.emails) ? data.emails : [];
      activities = Array.isArray(data.activities) ? data.activities : [];
      if (!selectedProspectId && prospects[0]?.id) selectedProspectId = prospects[0].id;
      if (!selectedTemplateId && templates[0]?.id) selectedTemplateId = templates[0].id;
      setMessage("");
      renderAll();
    } catch (error) {
      setMessage(prospectsError(error), "error");
      renderAll();
    }
  }

  function renderAll() {
    renderMetrics();
    renderInsights();
    renderHomeSection();
    renderBoard();
    renderDirectoryList();
    renderProspectForm();
    renderEmailSection();
    renderInboxSection();
    renderTemplateSection();
    renderActivitySection();
    activateDirectorySection(directorySection);
    activateProspectsTab(activeTab);
    refreshIcons();
  }

  function setMessage(text, tone = "neutral") {
    const messages = root.querySelectorAll("[data-prospects-message]");
    if (!messages.length) return;
    const content = String(text || "").trim();
    messages.forEach(message => {
      message.hidden = !content;
      renderMessageBlock(message, content, tone);
    });
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

  function renderMetrics() {
    const today = todayIso();
    const dueActivities = activities.filter(item => item.dueAt && item.dueAt.slice(0, 10) <= today);
    const totals = {
      total: prospects.length,
      due: prospects.filter(item => item.nextFollowUpOn && item.nextFollowUpOn <= today && !["won", "lost"].includes(item.phase)).length + dueActivities.length,
      pipeline: prospects.filter(item => ["proposal", "negotiation"].includes(item.phase)).length,
      won: prospects.filter(item => item.phase === "won").length
    };
    Object.entries(totals).forEach(([key, value]) => {
      const target = root.querySelector(`[data-prospect-metric="${key}"]`);
      if (target) target.textContent = number(value);
    });
  }

  function renderInsights() {
    const insightGrid = root.querySelector("[data-prospect-insight-grid]");
    const phaseEmailList = root.querySelector("[data-prospect-phase-email-list]");
    const phaseEmailCount = root.querySelector("[data-prospect-phase-email-count]");
    const conversionList = root.querySelector("[data-prospect-conversion-list]");
    const conversionCount = root.querySelector("[data-prospect-conversion-count]");
    const sentCount = root.querySelector("[data-prospect-sent-count]");
    if (!insightGrid || !phaseEmailList || !conversionList) return;

    const today = todayIso();
    const sentEmails = emails.filter(item => item.status === "sent");
    const overdue = prospects.filter(item => item.nextFollowUpOn && item.nextFollowUpOn < today && !["won", "lost"].includes(item.phase)).length;
    const noTouch = prospects.filter(item => !item.lastContactAt && !["won", "lost"].includes(item.phase)).length;
    const winRate = prospects.length ? Math.round((prospects.filter(item => item.phase === "won").length / prospects.length) * 100) : 0;
    const avgSentPerProspect = prospects.length ? (sentEmails.length / prospects.length).toFixed(1) : "0.0";
    const scheduledEmails = emails.filter(item => item.status === "scheduled").length;
    const dueFollowUps = activities.filter(item => item.activityType === "follow_up" && item.dueAt && item.dueAt.slice(0, 10) <= today).length;

    insightGrid.innerHTML = [
      { label: "Correos enviados", value: number(sentEmails.length), note: "Historial total" },
      { label: "Seguimientos vencidos", value: number(overdue + dueFollowUps), note: "Prospectos y follow-ups" },
      { label: "Sin contacto", value: number(noTouch), note: "Prospectos sin toque" },
      { label: "Win rate actual", value: `${winRate}%`, note: `${scheduledEmails} correos programados · ${avgSentPerProspect} por prospecto` }
    ].map(item => `
      <div class="prospect-insight-card">
        <span>${escapeHtml(item.label)}</span>
        <strong>${escapeHtml(item.value)}</strong>
        <small>${escapeHtml(item.note)}</small>
      </div>
    `).join("");

    if (sentCount) sentCount.textContent = String(sentEmails.length);

    const sentByPhase = PHASES
      .map(phase => {
        const ids = new Set(prospects.filter(item => item.phase === phase.id).map(item => item.id));
        const total = sentEmails.filter(item => ids.has(item.prospectId)).length;
        return { label: phase.label, total };
      })
      .filter(item => item.total > 0);

    if (phaseEmailCount) phaseEmailCount.textContent = String(sentByPhase.length);
    phaseEmailList.innerHTML = sentByPhase.length
      ? sentByPhase.map(item => `
        <div class="prospect-insight-row">
          <span>${escapeHtml(item.label)}</span>
          <strong>${number(item.total)}</strong>
        </div>
      `).join("")
      : `<div class="prospect-empty">Todavía no hay correos enviados para distribuir por fase.</div>`;

    const stagePairs = [
      ["lead", "qualified"],
      ["qualified", "contacted"],
      ["contacted", "proposal"],
      ["proposal", "negotiation"],
      ["negotiation", "won"]
    ];
    const currentStageRatios = stagePairs.map(([from, to]) => {
      const fromCount = prospects.filter(item => item.phase === from).length;
      const toCount = prospects.filter(item => item.phase === to).length;
      const ratio = fromCount > 0 ? Math.round((toCount / fromCount) * 100) : 0;
      return {
        label: `${phaseLabel(from)} -> ${phaseLabel(to)}`,
        total: ratio,
        note: `${number(toCount)} de ${number(fromCount || 0)}`
      };
    });

    if (conversionCount) conversionCount.textContent = String(currentStageRatios.length);
    conversionList.innerHTML = currentStageRatios.map(item => `
      <div class="prospect-insight-row">
        <span>${escapeHtml(item.label)}</span>
        <strong>${escapeHtml(item.total)}%</strong>
        <small>${escapeHtml(item.note)}</small>
      </div>
    `).join("");
  }

  function filteredProspects() {
    return prospects.filter(item => {
      if (phaseFilter && item.phase !== phaseFilter) return false;
      if (!searchTerm) return true;
      const haystack = [item.fullName, item.company, item.email, item.phone, item.source, (item.tags || []).join(" ")].join(" ").toLowerCase();
      return haystack.includes(searchTerm);
    });
  }

  function renderHomeSection() {
    const target = root.querySelector("[data-prospects-home]");
    if (!target) return;
    const recentActivities = activities.slice().sort((left, right) => {
      const leftTime = Date.parse(left.occurredAt || left.dueAt || left.createdAt || "") || 0;
      const rightTime = Date.parse(right.occurredAt || right.dueAt || right.createdAt || "") || 0;
      return rightTime - leftTime;
    }).slice(0, 8);
    const dueProspects = sortedProspects(prospects.filter(item => prospectFollowStatus(item) === "overdue" || prospectFollowStatus(item) === "today")).slice(0, 8);
    target.innerHTML = `
      <section class="prospects-home-grid">
        <article class="module-surface prospects-panel prospects-panel-compact"><div class="activity-head"><h3>Seguimientos críticos</h3><span>${number(dueProspects.length)}</span></div><div class="prospect-home-list">${dueProspects.length ? dueProspects.map(item => `<button type="button" data-prospect-open="${escapeAttr(item.id)}" data-directory-open="profile"><strong>${escapeHtml(item.fullName)}</strong><span>${escapeHtml(nextActionLabel(item))}</span></button>`).join("") : `<div class="prospect-empty">No hay seguimientos críticos.</div>`}</div></article>
        <article class="module-surface prospects-panel prospects-panel-compact"><div class="activity-head"><h3>Actividad reciente</h3><span>${number(recentActivities.length)}</span></div><div class="prospect-home-list">${recentActivities.length ? recentActivities.map(item => `<button type="button" data-prospect-open="${escapeAttr(item.prospectId || "")}" data-directory-open="activity"><strong>${escapeHtml(activityTypeLabel(item.activityType))} · ${escapeHtml(item.title || "Actividad")}</strong><span>${escapeHtml(formatDate(item.occurredAt || item.dueAt || item.createdAt))}</span></button>`).join("") : `<div class="prospect-empty">Todavía no hay actividad registrada.</div>`}</div></article>
      </section>
    `;
    refreshIcons();
  }

  function renderInboxSection() {
    const target = root.querySelector("[data-prospect-inbox]");
    const count = root.querySelector("[data-prospect-inbox-count]");
    if (!target) return;
    const inboxItems = emails.slice().sort((left, right) => {
      const leftTime = Date.parse(left.scheduledFor || left.sentAt || left.createdAt || "") || 0;
      const rightTime = Date.parse(right.scheduledFor || right.sentAt || right.createdAt || "") || 0;
      return rightTime - leftTime;
    });
    const pendingCount = inboxItems.filter(item => ["draft", "scheduled"].includes(item.status)).length;
    if (count) count.textContent = number(pendingCount);
    target.innerHTML = `
      <div class="prospect-inbox-list">
        ${inboxItems.length ? inboxItems.map(item => {
          const prospect = prospects.find(prospect => prospect.id === item.prospectId);
          return `<button class="prospect-inbox-item" type="button" data-prospect-open="${escapeAttr(item.prospectId || "")}" data-directory-open="communication"><span class="prospect-template-state ${item.status === "sent" ? "is-enabled" : "is-paused"}">${escapeHtml(emailStatusLabel(item.status))}</span><strong>${escapeHtml(item.subject || "Sin asunto")}</strong><small>${escapeHtml(prospect?.fullName || item.recipientEmail || "Sin prospecto")} · ${escapeHtml(formatDate(item.scheduledFor || item.sentAt || item.createdAt))}</small></button>`;
        }).join("") : `<div class="prospect-empty">No hay correos registrados.</div>`}
      </div>
    `;
  }

  function renderBoard() {
    const board = root.querySelector("[data-prospects-board]");
    if (!board) return;
    const currentItems = filteredProspects();
    const selected = selectedProspect();
    const automatedCount = pipelineAutomations().filter(item => item.enabled).length;
    board.innerHTML = `
      <div class="prospects-pipeline-toolbar" aria-label="Modo de pipeline">
        <div class="prospects-pipeline-mode" role="tablist" aria-label="Vistas del pipeline">
          <button class="${pipelineMode === "board" ? "active" : ""}" type="button" role="tab" aria-selected="${pipelineMode === "board" ? "true" : "false"}" data-pipeline-mode="board"><i data-lucide="columns-3"></i>Flujo</button>
          <button class="${pipelineMode === "rules" ? "active" : ""}" type="button" role="tab" aria-selected="${pipelineMode === "rules" ? "true" : "false"}" data-pipeline-mode="rules"><i data-lucide="workflow"></i>Automatizaciones</button>
        </div>
        <div class="prospects-pipeline-stats" aria-label="Resumen operativo del pipeline">
          <span><strong>${number(currentItems.length)}</strong>En flujo</span>
          <span><strong>${number(automationCandidates(currentItems).length)}</strong>Por designar</span>
          <span><strong>${number(automatedCount)}</strong>Reglas activas</span>
        </div>
      </div>
      ${pipelineMode === "rules" ? renderPipelineAutomationView(currentItems) : renderPipelineFlowView(currentItems, selected)}
    `;
    refreshIcons();
  }

  function renderPipelineFlowView(currentItems, selected) {
    const phases = PHASES.filter(phase => !phaseFilter || phase.id === phaseFilter);
    return `
      <div class="prospects-pipeline-layout">
        <section class="prospects-pipeline-flow" aria-label="Fases operativas del pipeline">
          ${phases.map(phase => {
            const phaseItems = sortedProspects(currentItems.filter(item => item.phase === phase.id));
            const phaseValue = phaseItems.reduce((total, item) => total + Number(item.valueEstimate || 0), 0);
            const blocked = phaseItems.filter(item => prospectFollowStatus(item) === "overdue" || prospectFollowStatus(item) === "no_contact").length;
            return `
              <article class="prospect-pipeline-column" data-pipeline-phase="${escapeAttr(phase.id)}">
                <header>
                  <button class="prospect-stage-chip ${phaseFilter === phase.id ? "is-active" : ""}" type="button" data-phase-chip="${escapeAttr(phase.id)}">
                    <span>${escapeHtml(phase.label)}</span><strong>${number(phaseItems.length)}</strong>
                  </button>
                  <small>${escapeHtml(currency(phaseValue))} · ${number(blocked)} requiere acción</small>
                </header>
                <div class="prospect-pipeline-card-list">
                  ${phaseItems.length ? phaseItems.map(item => pipelineOpportunityCard(item)).join("") : `<button class="prospect-pipeline-empty" type="button" data-prospect-new-inline><i data-lucide="plus"></i>Crear oportunidad en ${escapeHtml(phase.label)}</button>`}
                </div>
              </article>
            `;
          }).join("")}
        </section>
        <aside class="prospect-pipeline-focus" aria-label="Administración de oportunidad seleccionada">
          ${selected ? pipelineFocusPanel(selected) : emptyPipelineFocus()}
        </aside>
      </div>
    `;
  }

  function renderPipelineAutomationView(currentItems) {
    const rules = pipelineAutomations();
    const candidates = automationCandidates(currentItems);
    return `
      <div class="prospects-pipeline-layout is-rules">
        <section class="prospect-automation-list" aria-label="Automatizaciones del pipeline">
          <div class="prospect-queue-head">
            <div><h3>Reglas operativas</h3><p>Automatizaciones visibles desde el pipeline para reducir trabajo manual.</p></div>
            <button class="btn btn-ghost btn-compact" type="button" data-prospect-new-inline><i data-lucide="plus"></i>Crear prospecto</button>
          </div>
          ${rules.map(rule => `
            <article class="prospect-automation-card ${rule.enabled ? "is-enabled" : "is-paused"}">
              <div>
                <span><i data-lucide="${escapeAttr(rule.icon)}"></i>${escapeHtml(rule.scope)}</span>
                <strong>${escapeHtml(rule.title)}</strong>
                <p>${escapeHtml(rule.description)}</p>
              </div>
              <em>${rule.enabled ? "Activa" : "Pausada"}</em>
            </article>
          `).join("")}
        </section>
        <aside class="prospect-automation-queue" aria-label="Prospectos que requieren designación">
          <div class="prospect-queue-head">
            <div><h3>Designación pendiente</h3><p>${number(candidates.length)} oportunidad(es) sin dueño claro o sin siguiente acción.</p></div>
          </div>
          <div class="prospect-list compact">
            ${candidates.length ? candidates.map(item => pipelineAutomationCandidate(item)).join("") : `<div class="prospect-empty">No hay oportunidades pendientes de designación con estos filtros.</div>`}
          </div>
        </aside>
      </div>
    `;
  }

  function pipelineOpportunityCard(item) {
    const tone = prospectTone(item);
    const automation = pipelineAutomationHint(item);
    const currentPhaseIndex = PHASES.findIndex(phase => phase.id === item.phase);
    const previousPhase = PHASES[currentPhaseIndex - 1];
    const nextPhase = PHASES[currentPhaseIndex + 1];
    return `
      <article class="prospect-opportunity-card ${item.id === selectedProspectId ? "is-active" : ""} ${tone}" data-prospect-open="${escapeAttr(item.id)}">
        <button class="prospect-opportunity-main" type="button" data-prospect-open="${escapeAttr(item.id)}">
          <strong>${escapeHtml(item.company || item.fullName)}</strong>
          <span>${escapeHtml(item.fullName)} · ${escapeHtml(item.valueEstimate ? currency(item.valueEstimate) : "Sin monto")}</span>
          <small>${escapeHtml(nextActionLabel(item))}</small>
        </button>
        <div class="prospect-opportunity-actions">
          ${previousPhase ? `<button type="button" title="Mover a ${escapeAttr(previousPhase.label)}" data-pipeline-move-phase="${escapeAttr(item.id)}" data-pipeline-target-phase="${escapeAttr(previousPhase.id)}"><i data-lucide="arrow-left"></i></button>` : ""}
          ${nextPhase ? `<button type="button" title="Mover a ${escapeAttr(nextPhase.label)}" data-pipeline-move-phase="${escapeAttr(item.id)}" data-pipeline-target-phase="${escapeAttr(nextPhase.id)}"><i data-lucide="arrow-right"></i></button>` : ""}
          <button type="button" title="Abrir ficha" data-prospect-open="${escapeAttr(item.id)}" data-directory-open="profile"><i data-lucide="contact-round"></i></button>
          <button type="button" title="Enviar correo" data-prospect-open="${escapeAttr(item.id)}" data-directory-open="communication"><i data-lucide="send"></i></button>
          <button type="button" title="Registrar actividad" data-prospect-open="${escapeAttr(item.id)}" data-directory-open="activity"><i data-lucide="clock-3"></i></button>
        </div>
        <span class="prospect-automation-hint"><i data-lucide="zap"></i>${escapeHtml(automation)}</span>
      </article>
    `;
  }

  function pipelineFocusPanel(item) {
    const currentPhaseIndex = PHASES.findIndex(phase => phase.id === item.phase);
    const nextPhase = PHASES[currentPhaseIndex + 1];
    return `
      <div class="prospect-summary-head">
        <span class="prospect-phase-pill">${escapeHtml(phaseLabel(item.phase))}</span>
        <strong>${escapeHtml(item.company || item.fullName)}</strong>
        <small>${escapeHtml(item.fullName)} · ${escapeHtml(item.email || item.phone || "sin contacto")}</small>
      </div>
      <dl class="prospect-summary-grid">
        <div><dt>Siguiente acción</dt><dd>${escapeHtml(nextActionLabel(item))}</dd></div>
        <div><dt>Valor</dt><dd>${escapeHtml(item.valueEstimate ? currency(item.valueEstimate) : "-")}</dd></div>
        <div><dt>Automatización</dt><dd>${escapeHtml(pipelineAutomationHint(item))}</dd></div>
        <div><dt>Fase siguiente</dt><dd>${escapeHtml(nextPhase?.label || "Cierre")}</dd></div>
      </dl>
      <div class="prospect-summary-actions">
        ${nextPhase ? `<button type="button" data-pipeline-move-phase="${escapeAttr(item.id)}" data-pipeline-target-phase="${escapeAttr(nextPhase.id)}"><i data-lucide="arrow-right"></i>Mover</button>` : ""}
        <button type="button" data-directory-open="profile"><i data-lucide="contact-round"></i>Ficha</button>
        <button type="button" data-directory-open="communication"><i data-lucide="send"></i>Correo</button>
        <button type="button" data-directory-open="activity"><i data-lucide="clock-3"></i>Actividad</button>
      </div>
      <div class="prospect-pipeline-next-step">
        <span><i data-lucide="workflow"></i>Acción sugerida</span>
        <p>${escapeHtml(pipelineNextStep(item))}</p>
      </div>
    `;
  }

  function emptyPipelineFocus() {
    return `<div class="prospect-empty">Selecciona una oportunidad para administrar su siguiente acción, comunicación o automatización.</div>`;
  }

  function pipelineAutomations() {
    return [
      { scope: "Entrada", title: "Nuevo prospecto -> asignar dueño", description: "Marca prospectos sin contacto para que el equipo los designe antes de que se enfríen.", icon: "user-plus", enabled: true },
      { scope: "Seguimiento", title: "Fecha vencida -> actividad pendiente", description: "Detecta oportunidades vencidas y las empuja a la cola de designación del pipeline.", icon: "calendar-clock", enabled: true },
      { scope: "Propuesta", title: "Propuesta sin respuesta -> correo", description: "Sugiere comunicación desde plantillas cuando una propuesta queda sin próximo paso claro.", icon: "send", enabled: true },
      { scope: "Cierre", title: "Ganado o perdido -> congelar acciones", description: "Evita que los cierres sigan apareciendo como trabajo operativo activo.", icon: "lock", enabled: false }
    ];
  }

  function automationCandidates(items) {
    return sortedProspects(items.filter(item => {
      const status = prospectFollowStatus(item);
      return !["won", "lost"].includes(item.phase) && (status === "overdue" || status === "no_contact" || !item.nextFollowUpOn);
    }));
  }

  function pipelineAutomationCandidate(item) {
    return `
      <button class="prospect-list-item ${item.id === selectedProspectId ? "is-active" : ""} ${prospectTone(item)}" type="button" data-prospect-open="${escapeAttr(item.id)}">
        <span class="prospect-phase-pill">${escapeHtml(phaseLabel(item.phase))}</span>
        <strong>${escapeHtml(item.company || item.fullName)}</strong>
        <small>${escapeHtml(item.fullName)} · ${escapeHtml(pipelineAutomationHint(item))}</small>
        <em>${escapeHtml(nextActionLabel(item))}</em>
      </button>
    `;
  }

  function pipelineAutomationHint(item) {
    const status = prospectFollowStatus(item);
    if (status === "overdue") return "Reasignar seguimiento";
    if (status === "today") return "Ejecutar hoy";
    if (status === "no_contact") return "Designar primer contacto";
    if (["proposal", "negotiation"].includes(item.phase) && !item.nextFollowUpOn) return "Programar respuesta";
    if (["won", "lost"].includes(item.phase)) return "Cerrar automatizaciones";
    return "Mantener en flujo";
  }

  function pipelineNextStep(item) {
    const status = prospectFollowStatus(item);
    if (status === "overdue") return "Crear actividad inmediata o reasignar la oportunidad a una persona responsable.";
    if (status === "no_contact") return "Designar responsable y abrir comunicación inicial desde una plantilla.";
    if (["proposal", "negotiation"].includes(item.phase)) return "Confirmar siguiente hito, registrar actividad y preparar automatización de seguimiento.";
    if (["won", "lost"].includes(item.phase)) return "Revisar ficha, documentar cierre y evitar seguimientos activos innecesarios.";
    return "Mantener el avance por fase y registrar el próximo seguimiento operativo.";
  }

  async function moveProspectPhase(prospectId, targetPhase) {
    const prospect = prospects.find(item => item.id === prospectId);
    if (!prospect || !PHASES.some(phase => phase.id === targetPhase) || prospect.phase === targetPhase) return;
    const payload = {
      fullName: prospect.fullName || "",
      company: prospect.company || "",
      email: prospect.email || "",
      phone: prospect.phone || "",
      phase: targetPhase,
      tags: (prospect.tags || []).join(", "),
      source: prospect.source || "",
      valueEstimate: prospect.valueEstimate ?? "",
      nextFollowUpOn: prospect.nextFollowUpOn || "",
      lastContactAt: prospect.lastContactAt || null,
      notes: prospect.notes || ""
    };
    try {
      const data = await ProspectsApi.saveProspect(prospect.id, payload);
      upsertStateItem(prospects, data.prospect);
      selectedProspectId = data.prospect.id;
      setMessage(`${data.prospect.fullName} movido a ${phaseLabel(targetPhase)}.`, "ok");
      renderMetrics();
      renderBoard();
      renderDirectoryList();
    } catch (error) {
      setMessage(error.message || "No fue posible mover la oportunidad.", "error");
    }
  }


  function renderDirectoryList() {
    const list = root.querySelector("[data-prospects-directory-list]");
    const controls = root.querySelector("[data-directory-controls]");
    const detail = root.querySelector("[data-directory-detail]");
    if (!list || !controls || !detail) return;
    const currentItems = directoryProspects();
    const selected = selectedProspect();
    const sources = Array.from(new Set(prospects.map(item => String(item.source || "Sin fuente").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));

    controls.innerHTML = `
      <div class="prospects-directory-filterbar">
        <select data-directory-status-filter aria-label="Filtrar por seguimiento">
          <option value="all" ${directoryStatusFilter === "all" ? "selected" : ""}>Todos los seguimientos</option>
          <option value="overdue" ${directoryStatusFilter === "overdue" ? "selected" : ""}>Vencidos</option>
          <option value="today" ${directoryStatusFilter === "today" ? "selected" : ""}>Para hoy</option>
          <option value="upcoming" ${directoryStatusFilter === "upcoming" ? "selected" : ""}>Próximos</option>
          <option value="no_contact" ${directoryStatusFilter === "no_contact" ? "selected" : ""}>Sin contacto</option>
          <option value="closed" ${directoryStatusFilter === "closed" ? "selected" : ""}>Cerrados</option>
        </select>
        <select data-directory-source-filter aria-label="Filtrar por fuente">
          <option value="">Todas las fuentes</option>
          ${sources.map(source => `<option value="${escapeAttr(source)}" ${source === directorySourceFilter ? "selected" : ""}>${escapeHtml(source)}</option>`).join("")}
        </select>
        <select data-directory-sort aria-label="Ordenar prospectos">
          <option value="priority" ${directorySort === "priority" ? "selected" : ""}>Prioridad</option>
          <option value="follow_up" ${directorySort === "follow_up" ? "selected" : ""}>Próximo seguimiento</option>
          <option value="last_contact" ${directorySort === "last_contact" ? "selected" : ""}>Último contacto</option>
          <option value="value" ${directorySort === "value" ? "selected" : ""}>Valor estimado</option>
          <option value="name" ${directorySort === "name" ? "selected" : ""}>Nombre</option>
          <option value="company" ${directorySort === "company" ? "selected" : ""}>Empresa</option>
        </select>
      </div>
      <div class="prospects-directory-stats" aria-label="Resumen del directorio">
        <span><strong>${number(currentItems.length)}</strong>Visibles</span>
        <span><strong>${number(prospects.filter(item => prospectFollowStatus(item) === "overdue").length)}</strong>Vencidos</span>
        <span><strong>${number(prospects.filter(item => prospectFollowStatus(item) === "no_contact").length)}</strong>Sin contacto</span>
      </div>
    `;

    list.innerHTML = `
      <div class="prospect-directory-table" role="table" aria-label="Prospectos filtrados">
        <div class="prospect-directory-row prospect-directory-row-head" role="row">
          <span>Prospecto</span><span>Empresa</span><span>Fase</span><span>Seguimiento</span><span>Valor</span><span></span>
        </div>
        ${currentItems.length ? currentItems.map(item => directoryRow(item)).join("") : `<div class="prospect-empty">No hay prospectos con estos filtros.</div>`}
      </div>
    `;

    detail.innerHTML = selected ? directoryDetail(selected) : emptyProspectSummary();
    bindDirectoryControls(controls);
    refreshIcons();
  }

  function bindDirectoryControls(controls) {
    controls.querySelector("[data-directory-status-filter]")?.addEventListener("change", event => {
      directoryStatusFilter = String(event.target.value || "all");
      renderDirectoryList();
    });
    controls.querySelector("[data-directory-source-filter]")?.addEventListener("change", event => {
      directorySourceFilter = String(event.target.value || "");
      renderDirectoryList();
    });
    controls.querySelector("[data-directory-sort]")?.addEventListener("change", event => {
      directorySort = String(event.target.value || "priority");
      renderDirectoryList();
    });
  }

  function directoryProspects() {
    return filteredProspects()
      .filter(item => {
        const status = prospectFollowStatus(item);
        if (directoryStatusFilter !== "all" && status !== directoryStatusFilter) return false;
        if (directorySourceFilter && String(item.source || "Sin fuente").trim() !== directorySourceFilter) return false;
        return true;
      })
      .slice()
      .sort(directorySortComparator);
  }

  function directorySortComparator(left, right) {
    if (directorySort === "follow_up") return nullableDate(left.nextFollowUpOn) - nullableDate(right.nextFollowUpOn);
    if (directorySort === "last_contact") return nullableDate(right.lastContactAt) - nullableDate(left.lastContactAt);
    if (directorySort === "value") return Number(right.valueEstimate || 0) - Number(left.valueEstimate || 0);
    if (directorySort === "name") return String(left.fullName || "").localeCompare(String(right.fullName || ""));
    if (directorySort === "company") return String(left.company || "").localeCompare(String(right.company || ""));
    return sortedProspects([left, right])[0] === left ? -1 : 1;
  }

  function nullableDate(value) {
    if (!value) return Number.MAX_SAFE_INTEGER;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
  }

  function directoryRow(item) {
    const status = prospectFollowStatus(item);
    return `
      <button class="prospect-directory-row ${item.id === selectedProspectId ? "is-active" : ""} is-${escapeAttr(status)}" type="button" role="row" data-prospect-open="${escapeAttr(item.id)}">
        <span><strong>${escapeHtml(item.fullName)}</strong><small>${escapeHtml(item.email || item.phone || "Sin contacto")}</small></span>
        <span>${escapeHtml(item.company || "Sin empresa")}</span>
        <span><em class="prospect-phase-pill">${escapeHtml(phaseLabel(item.phase))}</em></span>
        <span>${escapeHtml(nextActionLabel(item))}</span>
        <span>${escapeHtml(item.valueEstimate ? currency(item.valueEstimate) : "-")}</span>
        <span class="prospect-directory-actions"><i data-lucide="chevron-right"></i></span>
      </button>
    `;
  }

  function directoryDetail(item) {
    const prospectEmails = emails.filter(email => email.prospectId === item.id);
    const prospectActivities = activities.filter(activity => activity.prospectId === item.id);
    return `
      <div class="prospect-directory-detail-head">
        <span class="prospect-phase-pill">${escapeHtml(phaseLabel(item.phase))}</span>
        <h3>${escapeHtml(item.fullName)}</h3>
        <p>${escapeHtml(item.company || item.email || "Sin empresa")}</p>
      </div>
      <dl class="prospect-summary-grid">
        <div><dt>Seguimiento</dt><dd>${escapeHtml(item.nextFollowUpOn ? formatDate(item.nextFollowUpOn) : "Sin fecha")}</dd></div>
        <div><dt>Último contacto</dt><dd>${escapeHtml(item.lastContactAt ? formatDate(item.lastContactAt) : "Sin contacto")}</dd></div>
        <div><dt>Valor</dt><dd>${escapeHtml(item.valueEstimate ? currency(item.valueEstimate) : "-")}</dd></div>
        <div><dt>Fuente</dt><dd>${escapeHtml(item.source || "Sin fuente")}</dd></div>
        <div><dt>Correos</dt><dd>${number(prospectEmails.length)}</dd></div>
        <div><dt>Actividad</dt><dd>${number(prospectActivities.length)}</dd></div>
      </dl>
      ${(item.tags || []).length ? `<div class="prospect-tag-row">${item.tags.map(tag => `<em>${escapeHtml(tag)}</em>`).join("")}</div>` : ""}
      ${item.notes ? `<p class="prospect-directory-notes">${escapeHtml(item.notes.slice(0, 260))}</p>` : ""}
      <div class="prospect-summary-actions">
        <button type="button" data-directory-edit="${escapeAttr(item.id)}"><i data-lucide="pencil"></i>Editar</button>
        <button type="button" data-directory-open="communication"><i data-lucide="send"></i>Correo</button>
        <button type="button" data-directory-open="activity"><i data-lucide="clock-3"></i>Actividad</button>
      </div>
    `;
  }

  function prospectFollowStatus(item) {
    const today = todayIso();
    if (["won", "lost"].includes(item.phase)) return "closed";
    if (!item.lastContactAt) return "no_contact";
    if (item.nextFollowUpOn && item.nextFollowUpOn < today) return "overdue";
    if (item.nextFollowUpOn === today) return "today";
    if (item.nextFollowUpOn) return "upcoming";
    return "no_date";
  }

  function renderContextCards() {
    root.querySelectorAll("[data-prospect-context]").forEach(target => {
      const prospect = selectedProspect();
      target.innerHTML = prospect ? selectedProspectSummary(prospect) : emptyProspectSummary();
    });
    refreshIcons();
  }


  function sortedProspects(entries) {
    const phaseRank = { negotiation: 0, proposal: 1, contacted: 2, qualified: 3, lead: 4, won: 5, lost: 6 };
    return entries.slice().sort((left, right) => {
      const leftScore = prospectPriorityScore(left);
      const rightScore = prospectPriorityScore(right);
      if (leftScore !== rightScore) return leftScore - rightScore;
      const phaseDiff = (phaseRank[left.phase] ?? 8) - (phaseRank[right.phase] ?? 8);
      if (phaseDiff) return phaseDiff;
      return String(right.updatedAt || right.createdAt || "").localeCompare(String(left.updatedAt || left.createdAt || ""));
    });
  }

  function prospectPriorityScore(item) {
    const today = todayIso();
    if (!["won", "lost"].includes(item.phase) && item.nextFollowUpOn && item.nextFollowUpOn < today) return 0;
    if (!["won", "lost"].includes(item.phase) && item.nextFollowUpOn === today) return 1;
    if (["proposal", "negotiation"].includes(item.phase)) return 2;
    if (!item.lastContactAt && !["won", "lost"].includes(item.phase)) return 3;
    if (item.nextFollowUpOn) return 4;
    return 5;
  }

  function prospectListItem(item) {
    const tone = prospectTone(item);
    return `
      <button class="prospect-list-item ${item.id === selectedProspectId ? "is-active" : ""} ${tone}" type="button" data-prospect-open="${escapeAttr(item.id)}">
        <span class="prospect-phase-pill">${escapeHtml(phaseLabel(item.phase))}</span>
        <strong>${escapeHtml(item.fullName)}</strong>
        <small>${escapeHtml(item.company || item.email)}</small>
        <em>${escapeHtml(nextActionLabel(item))}</em>
      </button>
    `;
  }

  function selectedProspectSummary(item) {
    const prospectEmails = emails.filter(email => email.prospectId === item.id);
    const prospectActivities = activities.filter(activity => activity.prospectId === item.id);
    return `
      <div class="prospect-summary-head">
        <span class="prospect-phase-pill">${escapeHtml(phaseLabel(item.phase))}</span>
        <strong>${escapeHtml(item.fullName)}</strong>
        <small>${escapeHtml(item.company || item.email)}</small>
      </div>
      <dl class="prospect-summary-grid">
        <div><dt>Seguimiento</dt><dd>${escapeHtml(item.nextFollowUpOn ? formatDate(item.nextFollowUpOn) : "Sin fecha")}</dd></div>
        <div><dt>Último contacto</dt><dd>${escapeHtml(item.lastContactAt ? formatDate(item.lastContactAt) : "Sin contacto")}</dd></div>
        <div><dt>Correos</dt><dd>${number(prospectEmails.length)}</dd></div>
        <div><dt>Actividad</dt><dd>${number(prospectActivities.length)}</dd></div>
      </dl>
      <div class="prospect-summary-actions">
        <button type="button" data-directory-open="profile"><i data-lucide="contact-round"></i>Ficha</button>
        <button type="button" data-directory-open="communication"><i data-lucide="send"></i>Correo</button>
        <button type="button" data-directory-open="activity"><i data-lucide="clock-3"></i>Actividad</button>
      </div>
    `;
  }

  function emptyProspectSummary() {
    return `<div class="prospect-empty">Selecciona un prospecto para ver contexto y acciones.</div>`;
  }

  function prospectTone(item) {
    const today = todayIso();
    if (!["won", "lost"].includes(item.phase) && item.nextFollowUpOn && item.nextFollowUpOn < today) return "is-overdue";
    if (!["won", "lost"].includes(item.phase) && item.nextFollowUpOn === today) return "is-due";
    if (["won", "lost"].includes(item.phase)) return "is-closed";
    return "";
  }

  function nextActionLabel(item) {
    const today = todayIso();
    if (!["won", "lost"].includes(item.phase) && item.nextFollowUpOn && item.nextFollowUpOn < today) return `Vencido · ${formatDate(item.nextFollowUpOn)}`;
    if (!["won", "lost"].includes(item.phase) && item.nextFollowUpOn === today) return "Seguimiento hoy";
    if (item.nextFollowUpOn) return `Próximo · ${formatDate(item.nextFollowUpOn)}`;
    if (!item.lastContactAt && !["won", "lost"].includes(item.phase)) return "Sin contacto registrado";
    return prospectMeta(item);
  }


  function renderProspectForm() {
    const form = root.querySelector("[data-prospect-form]");
    const editor = root.querySelector("[data-directory-editor]");
    if (!form) return;
    const editing = directoryMode === "edit";
    if (editor) editor.hidden = !editing;
    if (!editing) {
      form.innerHTML = "";
      return;
    }
    const prospect = selectedProspect() || emptyProspect();
    form.innerHTML = `
      <div class="prospect-editor-head"><div><h3>${prospect.id ? "Editar prospecto" : "Nuevo prospecto"}</h3><p>${prospect.id ? "Actualiza la ficha comercial." : "Crea un nuevo registro en la base comercial."}</p></div><button class="icon-close" type="button" data-directory-editor-close aria-label="Cerrar editor"><i data-lucide="x"></i></button></div>
      <input type="hidden" name="id" value="${escapeAttr(prospect.id || "")}" />
      <div class="prospects-form-grid">
        <label>Nombre
          <input name="fullName" maxlength="120" required value="${escapeAttr(prospect.fullName || "")}" />
        </label>
        <label>Empresa
          <input name="company" maxlength="120" value="${escapeAttr(prospect.company || "")}" />
        </label>
        <label>Correo
          <input name="email" type="email" maxlength="160" required value="${escapeAttr(prospect.email || "")}" />
        </label>
        <label>Teléfono
          <input name="phone" maxlength="60" value="${escapeAttr(prospect.phone || "")}" />
        </label>
        <label>Fase
          <select name="phase">
            ${PHASES.map(phase => `<option value="${escapeHtml(phase.id)}" ${phase.id === prospect.phase ? "selected" : ""}>${escapeHtml(phase.label)}</option>`).join("")}
          </select>
        </label>
        <label>Fuente
          <input name="source" maxlength="80" value="${escapeAttr(prospect.source || "")}" placeholder="Web, referido, evento..." />
        </label>
        <label>Tags
          <input name="tags" maxlength="220" value="${escapeAttr((prospect.tags || []).join(", "))}" placeholder="industrial, MAP, demo..." />
        </label>
        <label>Monto estimado
          <input name="valueEstimate" type="number" min="0" step="0.01" value="${escapeAttr(prospect.valueEstimate ?? "")}" />
        </label>
        <label>Próximo seguimiento
          <input name="nextFollowUpOn" type="date" value="${escapeAttr(prospect.nextFollowUpOn || "")}" />
        </label>
        <label>Último contacto
          <input name="lastContactAt" type="datetime-local" value="${escapeAttr(datetimeLocalValue(prospect.lastContactAt))}" />
        </label>
      </div>
      <label>Notas
        <textarea name="notes" rows="7" maxlength="4000" placeholder="Contexto comercial, necesidades, objeciones, próximos pasos...">${escapeHtml(prospect.notes || "")}</textarea>
      </label>
      <div class="prospects-form-actions">
        <button class="btn btn-primary" type="submit">${prospect.id ? "Guardar cambios" : "Crear prospecto"}</button>
        ${prospect.id ? `<button class="btn btn-ghost" type="button" data-prospect-delete="${escapeAttr(prospect.id)}">Eliminar</button>` : ""}
      </div>
    `;
    refreshIcons();
    form.querySelector("[data-prospect-delete]")?.addEventListener("click", deleteProspect);
    form.querySelector("[data-directory-editor-close]")?.addEventListener("click", () => {
      directoryMode = "view";
      renderDirectoryList();
      renderProspectForm();
    });
  }

  function renderEmailSection() {
    const section = root.querySelector("[data-prospect-email-section]");
    const count = root.querySelector("[data-prospect-email-count]");
    if (!section) return;
    const prospect = selectedProspect();
    const prospectEmails = prospect ? emails.filter(item => item.prospectId === prospect.id) : [];
    if (count) count.textContent = String(prospectEmails.length);
    if (!prospect) {
      section.innerHTML = `<p class="muted-text">Selecciona o crea un prospecto para registrar seguimiento por correo.</p>`;
      return;
    }
    const currentEmail = selectedEmail() || emptyEmail(prospect);
    section.innerHTML = `
      <div class="prospects-email-toolbar">
        <label>Plantilla
          <select data-email-template-select>
            <option value="">Sin plantilla</option>
            ${templates.map(template => `<option value="${escapeHtml(template.id)}" ${template.id === selectedTemplateId ? "selected" : ""}>${escapeHtml(template.name)}</option>`).join("")}
          </select>
        </label>
        <button class="btn btn-ghost btn-compact" type="button" data-email-apply-template ${templates.length ? "" : "disabled"}>Aplicar plantilla</button>
        ${currentEmail.sentAt ? `<span class="prospect-email-note">Enviado ${escapeHtml(formatDate(currentEmail.sentAt))}</span>` : ""}
      </div>
      <form class="prospects-form prospects-form-compact" data-email-form>
        <input type="hidden" name="id" value="${escapeAttr(currentEmail.id || "")}" />
        <div class="prospects-form-grid">
          <label>Destinatario
            <input name="recipientEmail" type="email" maxlength="160" required value="${escapeAttr(currentEmail.recipientEmail || prospect.email || "")}" />
          </label>
          <label>Estado
            <select name="status">
              ${EMAIL_STATUSES.map(item => `<option value="${escapeHtml(item.id)}" ${item.id === currentEmail.status ? "selected" : ""}>${escapeHtml(item.label)}</option>`).join("")}
            </select>
          </label>
          <label>Programado para
            <input name="scheduledFor" type="datetime-local" value="${escapeAttr(datetimeLocalValue(currentEmail.scheduledFor))}" />
          </label>
        </div>
        <label>Asunto
          <input name="subject" maxlength="180" required value="${escapeAttr(currentEmail.subject || "")}" />
        </label>
        <label>Cuerpo
          <textarea name="body" rows="8" maxlength="12000" required>${escapeHtml(currentEmail.body || "")}</textarea>
        </label>
        <label>Adjuntos por URL
          <textarea name="attachments" rows="4" placeholder="brochure.pdf | https://tu-dominio.com/brochure.pdf&#10;ficha-tecnica.pdf | https://tu-dominio.com/ficha.pdf">${escapeHtml(attachmentsText(currentEmail.attachments || []))}</textarea>
        </label>
        <div class="prospect-template-hints">
          ${TEMPLATE_HINTS.map(item => `<span>${escapeHtml(item)}</span>`).join("")}
          <span>Adjuntos: nombre | URL</span>
        </div>
        <div class="prospects-form-actions">
          <button class="btn btn-primary" type="submit" data-email-intent="save">${currentEmail.id ? "Guardar correo" : "Registrar borrador"}</button>
          ${currentEmail.status !== "sent" ? `<button class="btn btn-ghost" type="submit" data-email-intent="send">${currentEmail.id ? "Guardar y enviar" : "Crear y enviar"}</button>` : ""}
          ${currentEmail.status !== "sent" ? `<button class="btn btn-ghost" type="submit" data-email-intent="schedule">${currentEmail.id ? "Guardar y programar" : "Crear y programar"}</button>` : ""}
          ${currentEmail.id ? `<button class="btn btn-ghost" type="button" data-email-delete="${escapeAttr(currentEmail.id)}">Eliminar</button>` : ""}
        </div>
      </form>
      <div class="prospect-email-list">
        ${prospectEmails.length ? prospectEmails.map(item => `
          <button class="prospect-email-item ${item.id === selectedEmailId ? "is-active" : ""}" type="button" data-email-open="${escapeAttr(item.id)}">
            <strong>${escapeHtml(item.subject)}</strong>
            <span>${escapeHtml(emailStatusLabel(item.status))} · ${escapeHtml(formatDate(item.sentAt || item.scheduledFor || item.createdAt))}</span>
          </button>
        `).join("") : `<div class="prospect-empty">Todavía no hay correos registrados para este prospecto.</div>`}
      </div>
    `;
    refreshIcons();
    section.querySelector("[data-email-template-select]")?.addEventListener("change", event => {
      selectedTemplateId = String(event.target.value || "");
    });
    section.querySelector("[data-email-apply-template]")?.addEventListener("click", applySelectedTemplate);
    section.querySelector("[data-email-form]")?.addEventListener("submit", saveEmail);
    section.querySelector("[data-email-delete]")?.addEventListener("click", deleteEmail);
  }

  function renderActivitySection() {
    const form = root.querySelector("[data-activity-form]");
    const list = root.querySelector("[data-activity-list]");
    const count = root.querySelector("[data-prospect-activity-count]");
    if (!form || !list) return;
    const prospect = selectedProspect();
    const activity = selectedActivity() || emptyActivity(prospect?.id || "");
    const prospectActivities = prospect
      ? activities
        .filter(item => item.prospectId === prospect.id)
        .sort((left, right) => {
          const leftTime = Date.parse(left.occurredAt || left.dueAt || left.createdAt || "") || 0;
          const rightTime = Date.parse(right.occurredAt || right.dueAt || right.createdAt || "") || 0;
          return rightTime - leftTime;
        })
      : [];
    if (count) count.textContent = String(prospectActivities.length);
    if (!prospect) {
      form.innerHTML = `<p class="muted-text">Selecciona un prospecto para registrar notas, llamadas, reuniones o seguimientos.</p>`;
      list.innerHTML = "";
      return;
    }
    form.innerHTML = `
      <input type="hidden" name="id" value="${escapeAttr(activity.id || "")}" />
      <div class="prospects-form-grid">
        <label>Tipo
          <select name="activityType">
            ${activityTypeOptions().map(item => `<option value="${escapeHtml(item.id)}" ${item.id === activity.activityType ? "selected" : ""}>${escapeHtml(item.label)}</option>`).join("")}
          </select>
        </label>
        <label>Vence / seguimiento
          <input name="dueAt" type="datetime-local" value="${escapeAttr(datetimeLocalValue(activity.dueAt))}" />
        </label>
      </div>
      <label>Título
        <input name="title" maxlength="160" required value="${escapeAttr(activity.title || "")}" />
      </label>
      <label>Detalle
        <textarea name="details" rows="5" maxlength="4000">${escapeHtml(activity.details || "")}</textarea>
      </label>
      <div class="prospects-form-actions">
        <button class="btn btn-primary" type="submit">${activity.id ? "Guardar actividad" : "Crear actividad"}</button>
        ${activity.id ? `<button class="btn btn-ghost" type="button" data-activity-delete="${escapeAttr(activity.id)}">Eliminar</button>` : ""}
      </div>
    `;
    refreshIcons();
    form.querySelector("[data-activity-delete]")?.addEventListener("click", deleteActivity);
    list.innerHTML = prospectActivities.length ? prospectActivities.map(item => `
      <button class="prospect-activity-item ${item.id === selectedActivityId ? "is-active" : ""}" type="button" data-activity-open="${escapeAttr(item.id)}">
        <strong>${escapeHtml(activityTypeLabel(item.activityType))} · ${escapeHtml(item.title)}</strong>
        <span>${escapeHtml(formatDate(item.occurredAt || item.createdAt))}</span>
        ${item.dueAt ? `<small>Seguimiento: ${escapeHtml(formatDate(item.dueAt))}</small>` : ""}
        ${item.details ? `<p>${escapeHtml(item.details.slice(0, 180))}</p>` : ""}
      </button>
    `).join("") : `<div class="prospect-empty">Todavía no hay actividad registrada para este prospecto.</div>`;
  }

  function renderTemplateSection() {
    const form = root.querySelector("[data-template-form]");
    const list = root.querySelector("[data-template-list]");
    const preview = root.querySelector("[data-template-preview]");
    const controls = root.querySelector("[data-template-controls]");
    const count = root.querySelector("[data-prospect-template-count]");
    if (!form || !list || !preview || !controls) return;

    const categories = Array.from(new Set(templates.map(item => String(item.category || "Sin categoría").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    const visibleTemplates = filteredTemplates();
    const selected = templateDraft || selectedTemplate() || emptyTemplate();
    const activeCount = templates.filter(item => item.isActive !== false).length;
    if (count) count.textContent = `${number(activeCount)}/${number(templates.length)}`;

    controls.innerHTML = `
      <div class="prospects-template-filterbar">
        <label class="workspace-search prospects-search"><i data-lucide="search"></i><input type="search" data-template-search placeholder="Buscar plantillas..." value="${escapeAttr(templateSearchTerm)}" autocomplete="off" aria-label="Buscar plantillas" /></label>
        <select data-template-category-filter aria-label="Filtrar plantillas por categoría">
          <option value="">Todas las categorías</option>
          ${categories.map(category => `<option value="${escapeAttr(category)}" ${category === templateCategoryFilter ? "selected" : ""}>${escapeHtml(category)}</option>`).join("")}
        </select>
        <select data-template-status-filter aria-label="Filtrar plantillas por estado">
          <option value="all" ${templateStatusFilter === "all" ? "selected" : ""}>Todas</option>
          <option value="active" ${templateStatusFilter === "active" ? "selected" : ""}>Activas</option>
          <option value="paused" ${templateStatusFilter === "paused" ? "selected" : ""}>Pausadas</option>
        </select>
        <button class="btn btn-primary btn-compact" type="button" data-template-new><i data-lucide="plus"></i>Nueva plantilla</button>
      </div>
      <div class="prospects-template-stats" aria-label="Resumen de plantillas">
        <span><strong>${number(templates.length)}</strong>Total</span>
        <span><strong>${number(activeCount)}</strong>Activas</span>
        <span><strong>${number(categories.length)}</strong>Categorías</span>
      </div>
    `;

    form.innerHTML = `
      <div class="prospect-template-editor-head">
        <div><h3>${selected.id ? "Editar plantilla" : templateDraft ? "Duplicar plantilla" : "Nueva plantilla"}</h3><p>${selected.id ? "Actualiza contenido y estado." : "Crea un mensaje reutilizable."}</p></div>
        <span class="status-dot">${selected.isActive !== false ? "Activa" : "Pausada"}</span>
      </div>
      <input type="hidden" name="id" value="${escapeAttr(selected.id || "")}" />
      <label>Nombre
        <input name="name" maxlength="120" required value="${escapeAttr(selected.name || "")}" />
      </label>
      <div class="prospects-form-grid">
        <label>Categoría
          <input name="category" maxlength="80" value="${escapeAttr(selected.category || "")}" placeholder="Primer contacto, seguimiento, propuesta..." />
        </label>
        <label>Tags
          <input name="tags" maxlength="220" value="${escapeAttr((selected.tags || []).join(", "))}" />
        </label>
      </div>
      <label>Asunto
        <input name="subject" maxlength="180" required value="${escapeAttr(selected.subject || "")}" />
      </label>
      <label>Cuerpo
        <textarea name="body" rows="8" maxlength="12000" required>${escapeHtml(selected.body || "")}</textarea>
      </label>
      <div class="prospect-template-hints">
        ${TEMPLATE_HINTS.map(item => `<span>${escapeHtml(item)}</span>`).join("")}
      </div>
      <label class="prospects-checkbox">
        <input name="isActive" type="checkbox" ${selected.isActive !== false ? "checked" : ""} />
        <span>Plantilla activa</span>
      </label>
      <div class="prospects-form-actions">
        <button class="btn btn-primary" type="submit">${selected.id ? "Guardar cambios" : "Crear plantilla"}</button>
        ${selected.id ? `<button class="btn btn-ghost" type="button" data-template-delete="${escapeAttr(selected.id)}">Eliminar</button>` : ""}
        ${selected.id ? `<button class="btn btn-ghost" type="button" data-template-duplicate="${escapeAttr(selected.id)}"><i data-lucide="copy"></i>Duplicar</button>` : ""}
      </div>
    `;

    preview.innerHTML = selected.name || selected.subject || selected.body ? templatePreviewMarkup(selected) : `
      <div class="prospect-empty">Selecciona una plantilla o crea una nueva para ver su preview.</div>
    `;

    list.innerHTML = visibleTemplates.length ? visibleTemplates.map(item => templateLibraryItem(item)).join("") : `
      <div class="prospect-empty">No hay plantillas que coincidan con estos filtros.</div>
    `;

    refreshIcons();
    bindTemplateControls(controls, form);
  }

  function renderTemplateLibrary() {
    const list = root.querySelector("[data-template-list]");
    if (!list) return;
    const visibleTemplates = filteredTemplates();
    list.innerHTML = visibleTemplates.length ? visibleTemplates.map(item => templateLibraryItem(item)).join("") : `
      <div class="prospect-empty">No hay plantillas que coincidan con estos filtros.</div>
    `;
    refreshIcons();
  }

  function filteredTemplates() {
    return templates.filter(item => {
      const category = String(item.category || "Sin categoría").trim();
      if (templateCategoryFilter && category !== templateCategoryFilter) return false;
      if (templateStatusFilter === "active" && item.isActive === false) return false;
      if (templateStatusFilter === "paused" && item.isActive !== false) return false;
      if (!templateSearchTerm) return true;
      const haystack = [item.name, item.category, item.subject, item.body, (item.tags || []).join(" ")].join(" ").toLowerCase();
      return haystack.includes(templateSearchTerm);
    }).slice().sort((left, right) => {
      const activeDiff = Number(right.isActive !== false) - Number(left.isActive !== false);
      if (activeDiff) return activeDiff;
      return String(left.name || "").localeCompare(String(right.name || ""));
    });
  }

  function bindTemplateControls(controls, form) {
    controls.querySelector("[data-template-search]")?.addEventListener("input", event => {
      templateSearchTerm = String(event.target.value || "").trim().toLowerCase();
      renderTemplateLibrary();
    });
    controls.querySelector("[data-template-category-filter]")?.addEventListener("change", event => {
      templateCategoryFilter = String(event.target.value || "");
      renderTemplateLibrary();
    });
    controls.querySelector("[data-template-status-filter]")?.addEventListener("change", event => {
      templateStatusFilter = String(event.target.value || "all");
      renderTemplateLibrary();
    });
    controls.querySelector("[data-template-new]")?.addEventListener("click", () => {
      selectedTemplateId = "";
      templateDraft = null;
      renderTemplateSection();
    });
    form.querySelector("[data-template-delete]")?.addEventListener("click", deleteTemplate);
  }

  function templateLibraryItem(item) {
    const status = item.isActive !== false ? "Activa" : "Pausada";
    const category = item.category || "Sin categoría";
    return `
      <article class="prospect-template-card ${item.id === selectedTemplateId ? "is-active" : ""}" data-template-open="${escapeAttr(item.id)}">
        <button class="prospect-template-card-main" type="button" data-template-open="${escapeAttr(item.id)}">
          <span class="prospect-template-state ${item.isActive !== false ? "is-enabled" : "is-paused"}">${escapeHtml(status)}</span>
          <strong>${escapeHtml(item.name)}</strong>
          <small>${escapeHtml(category)} · ${escapeHtml(item.subject || "Sin asunto")}</small>
          ${(item.tags || []).length ? `<span class="prospect-template-tags">${item.tags.slice(0, 3).map(tag => `<em>${escapeHtml(tag)}</em>`).join("")}</span>` : ""}
        </button>
        <div class="prospect-template-card-actions">
          <button type="button" title="Editar" data-template-open="${escapeAttr(item.id)}"><i data-lucide="pencil"></i></button>
          <button type="button" title="Duplicar" data-template-duplicate="${escapeAttr(item.id)}"><i data-lucide="copy"></i></button>
          <button type="button" title="Usar en comunicación" data-template-use="${escapeAttr(item.id)}"><i data-lucide="send"></i></button>
        </div>
      </article>
    `;
  }

  function templatePreviewMarkup(template) {
    const prospect = selectedProspect() || collectProspectDraft();
    const hydratedSubject = hydrateTemplate(template.subject || "", prospect);
    const hydratedBody = hydrateTemplate(template.body || "", prospect);
    return `
      <div class="prospect-template-preview-head">
        <span class="prospect-template-state ${template.isActive !== false ? "is-enabled" : "is-paused"}">${template.isActive !== false ? "Activa" : "Pausada"}</span>
        <h3>${escapeHtml(template.name || "Plantilla sin nombre")}</h3>
        <p>${escapeHtml(template.category || "Sin categoría")}</p>
      </div>
      <div class="prospect-template-preview-message">
        <span>Asunto</span>
        <strong>${escapeHtml(hydratedSubject || "Sin asunto")}</strong>
        <span>Cuerpo</span>
        <p>${escapeHtml(hydratedBody || "Sin contenido")}</p>
      </div>
      <div class="prospect-template-preview-actions">
        ${template.id ? `<button class="btn btn-ghost btn-compact" type="button" data-template-duplicate="${escapeAttr(template.id)}"><i data-lucide="copy"></i>Duplicar</button>` : ""}
        ${template.id ? `<button class="btn btn-primary btn-compact" type="button" data-template-use="${escapeAttr(template.id)}"><i data-lucide="send"></i>Usar</button>` : ""}
      </div>
    `;
  }

  function handleBoardClick(event) {
    const moveButton = event.target.closest("[data-pipeline-move-phase]");
    if (moveButton) {
      void moveProspectPhase(moveButton.dataset.pipelineMovePhase || "", moveButton.dataset.pipelineTargetPhase || "");
      return;
    }

    const modeButton = event.target.closest("[data-pipeline-mode]");
    if (modeButton) {
      pipelineMode = modeButton.dataset.pipelineMode || "board";
      renderBoard();
      return;
    }

    const phaseButton = event.target.closest("[data-phase-chip]");
    if (phaseButton) {
      phaseFilter = phaseButton.dataset.phaseChip || "";
      root.querySelectorAll("[data-prospect-phase-filter]").forEach(select => {
        select.value = phaseFilter;
      });
      renderBoard();
      return;
    }

    const newButton = event.target.closest("[data-prospect-new-inline]");
    if (newButton) {
      selectedProspectId = "";
      selectedEmailId = "";
      selectedActivityId = "";
      directoryMode = "edit";
      renderAll();
      activateProspectsTab("directory");
      return;
    }

    const button = event.target.closest("[data-prospect-open]");
    if (!button) return;
    selectedProspectId = button.dataset.prospectOpen || "";
    selectedEmailId = "";
    selectedActivityId = "";
    renderAll();
  }

  function handleProspectJump(event) {
    const directoryButton = event.target.closest("[data-directory-open]");
    if (directoryButton && root.contains(directoryButton)) {
      event.preventDefault();
      const prospectButton = event.target.closest("[data-prospect-open]");
      if (prospectButton?.dataset?.prospectOpen) selectedProspectId = prospectButton.dataset.prospectOpen;
      directorySection = directoryButton.dataset.directoryOpen || "profile";
      directoryMode = "view";
      renderAll();
      activateProspectsTab("directory");
      activateDirectorySection(directorySection);
      return;
    }

    const jumpButton = event.target.closest("[data-prospect-jump]");
    if (!jumpButton || !root.contains(jumpButton)) return;
    event.preventDefault();
    activateProspectsTab(jumpButton.dataset.prospectJump || "directory");
  }

  function handleDirectorySideClick(event) {
    const sectionButton = event.target.closest("[data-directory-section]");
    if (sectionButton) {
      directoryMode = "view";
      directorySection = sectionButton.dataset.directorySection || "profile";
      renderProspectForm();
      activateDirectorySection(directorySection);
      return;
    }
  }

  function activateDirectorySection(section = "profile") {
    const allowed = new Set(["profile", "communication", "activity"]);
    directorySection = allowed.has(section) ? section : "profile";
    root.querySelectorAll("[data-directory-section]").forEach(button => {
      const active = button.dataset.directorySection === directorySection;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
    root.querySelectorAll("[data-directory-panel]").forEach(panel => {
      panel.hidden = panel.dataset.directoryPanel !== directorySection;
    });
  }

  function handleDirectoryClick(event) {
    const newButton = event.target.closest("[data-prospect-new-inline]");
    if (newButton) {
      selectedProspectId = "";
      selectedEmailId = "";
      selectedActivityId = "";
      directoryMode = "edit";
      renderAll();
      activateProspectsTab("directory");
      return;
    }

    const editButton = event.target.closest("[data-directory-edit]");
    if (editButton) {
      selectedProspectId = editButton.dataset.directoryEdit || selectedProspectId;
      directoryMode = "edit";
      directorySection = "profile";
      renderDirectoryList();
      renderProspectForm();
      return;
    }

    const button = event.target.closest("[data-prospect-open]");
    if (!button) return;
    selectedProspectId = button.dataset.prospectOpen || "";
    selectedEmailId = "";
    selectedActivityId = "";
    directoryMode = "view";
    directorySection = "profile";
    renderAll();
    activateProspectsTab("directory");
  }

  function handleTemplateClick(event) {
    const useButton = event.target.closest("[data-template-use]");
    if (useButton && root.contains(useButton)) {
      event.preventDefault();
      selectedTemplateId = useButton.dataset.templateUse || "";
      templateDraft = null;
      directorySection = "communication";
      renderEmailSection();
      applySelectedTemplate();
      activateProspectsTab("directory");
      activateDirectorySection("communication");
      return;
    }

    const duplicateButton = event.target.closest("[data-template-duplicate]");
    if (duplicateButton && root.contains(duplicateButton)) {
      event.preventDefault();
      duplicateTemplate({ currentTarget: duplicateButton });
      return;
    }

    const button = event.target.closest("[data-template-open]");
    if (!button || !root.contains(button)) return;
    selectedTemplateId = button.dataset.templateOpen || "";
    templateDraft = null;
    renderTemplateSection();
  }

  function handleEmailClick(event) {
    const button = event.target.closest("[data-email-open]");
    if (!button) return;
    selectedEmailId = button.dataset.emailOpen || "";
    renderEmailSection();
  }

  function handleActivityClick(event) {
    const button = event.target.closest("[data-activity-open]");
    if (!button) return;
    selectedActivityId = button.dataset.activityOpen || "";
    renderActivitySection();
  }

  async function saveProspect(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = {
      fullName: fieldValue(form, "fullName"),
      company: fieldValue(form, "company"),
      email: fieldValue(form, "email"),
      phone: fieldValue(form, "phone"),
      phase: fieldValue(form, "phase"),
      tags: fieldValue(form, "tags"),
      source: fieldValue(form, "source"),
      valueEstimate: fieldValue(form, "valueEstimate"),
      nextFollowUpOn: fieldValue(form, "nextFollowUpOn"),
      lastContactAt: fieldValue(form, "lastContactAt") ? new Date(fieldValue(form, "lastContactAt")).toISOString() : null,
      notes: fieldValue(form, "notes")
    };
    try {
      const prospectId = fieldValue(form, "id");
      const data = await ProspectsApi.saveProspect(prospectId, payload);
      upsertStateItem(prospects, data.prospect);
      selectedProspectId = data.prospect.id;
      selectedEmailId = "";
      directoryMode = "view";
      setMessage(`Prospecto ${data.prospect.fullName} guardado.`, "ok");
      renderAll();
    } catch (error) {
      setMessage(error.message || "No fue posible guardar el prospecto.", "error");
    }
  }

  async function deleteProspect(event) {
    const id = event.currentTarget.dataset.prospectDelete || "";
    if (!id || !window.confirm("¿Eliminar este prospecto y su historial de correos?")) return;
    try {
      await ProspectsApi.deleteProspect(id);
      prospects = prospects.filter(item => item.id !== id);
      emails = emails.filter(item => item.prospectId !== id);
      activities = activities.filter(item => item.prospectId !== id);
      if (selectedProspectId === id) {
        selectedProspectId = prospects[0]?.id || "";
        selectedEmailId = "";
        selectedActivityId = "";
      }
      setMessage("Prospecto eliminado.", "ok");
      renderAll();
    } catch (error) {
      setMessage(error.message || "No fue posible eliminar el prospecto.", "error");
    }
  }

  function duplicateTemplate(event) {
    const id = event.currentTarget.dataset.templateDuplicate || "";
    const template = templates.find(item => item.id === id);
    if (!template) return;
    selectedTemplateId = "";
    templateDraft = {
      ...template,
      id: "",
      name: `${template.name || "Plantilla"} copia`,
      isActive: true
    };
    renderTemplateSection();
  }

  async function saveTemplate(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = {
      name: fieldValue(form, "name"),
      category: fieldValue(form, "category"),
      tags: fieldValue(form, "tags"),
      subject: fieldValue(form, "subject"),
      body: fieldValue(form, "body"),
      isActive: fieldChecked(form, "isActive")
    };
    try {
      const templateId = fieldValue(form, "id");
      const data = await ProspectsApi.saveTemplate(templateId, payload);
      upsertStateItem(templates, data.template);
      selectedTemplateId = data.template.id;
      templateDraft = null;
      setMessage(`Plantilla ${data.template.name} guardada.`, "ok");
      renderTemplateSection();
      renderEmailSection();
    } catch (error) {
      setMessage(error.message || "No fue posible guardar la plantilla.", "error");
    }
  }

  async function deleteTemplate(event) {
    const id = event.currentTarget.dataset.templateDelete || "";
    if (!id || !window.confirm("¿Eliminar esta plantilla?")) return;
    try {
      await ProspectsApi.deleteTemplate(id);
      templates = templates.filter(item => item.id !== id);
      if (selectedTemplateId === id) selectedTemplateId = templates[0]?.id || "";
      templateDraft = null;
      setMessage("Plantilla eliminada.", "ok");
      renderTemplateSection();
      renderEmailSection();
    } catch (error) {
      setMessage(error.message || "No fue posible eliminar la plantilla.", "error");
    }
  }

  async function saveEmail(event) {
    event.preventDefault();
    const prospect = selectedProspect();
    if (!prospect?.id) return;
    const form = event.currentTarget;
    const intent = event.submitter?.dataset?.emailIntent || "save";
    const payload = {
      templateId: selectedTemplateId || null,
      recipientEmail: fieldValue(form, "recipientEmail"),
      subject: fieldValue(form, "subject"),
      body: fieldValue(form, "body"),
      attachments: parseAttachments(fieldValue(form, "attachments")),
      scheduledFor: fieldValue(form, "scheduledFor") ? new Date(fieldValue(form, "scheduledFor")).toISOString() : null,
      status: fieldValue(form, "status")
    };
    try {
      const emailId = fieldValue(form, "id");
      if (intent === "schedule") {
        if (!payload.scheduledFor) throw new Error("Define una fecha y hora para programar el correo.");
        payload.status = "scheduled";
      } else if (intent === "send") {
        payload.status = "draft";
      }
      const data = await persistEmail(prospect.id, payload, emailId);
      if (intent === "send") {
        await invokeSendEmail(data.email.id);
        setMessage("Correo guardado y enviado correctamente.", "ok");
      } else if (intent === "schedule") {
        setMessage("Correo guardado y programado.", "ok");
      } else {
        setMessage("Correo registrado en el historial.", "ok");
      }
      renderAll();
    } catch (error) {
      setMessage(error.message || "No fue posible guardar el correo.", "error");
    }
  }

  async function deleteEmail(event) {
    const id = event.currentTarget.dataset.emailDelete || "";
    if (!id || !window.confirm("¿Eliminar este correo del historial?")) return;
    try {
      await ProspectsApi.deleteEmail(id);
      emails = emails.filter(item => item.id !== id);
      if (selectedEmailId === id) selectedEmailId = "";
      setMessage("Correo eliminado.", "ok");
      renderEmailSection();
    } catch (error) {
      setMessage(error.message || "No fue posible eliminar el correo.", "error");
    }
  }

  async function saveActivity(event) {
    event.preventDefault();
    const prospect = selectedProspect();
    if (!prospect?.id) return;
    const form = event.currentTarget;
    const payload = {
      activityType: fieldValue(form, "activityType"),
      title: fieldValue(form, "title"),
      details: fieldValue(form, "details"),
      dueAt: fieldValue(form, "dueAt") ? new Date(fieldValue(form, "dueAt")).toISOString() : null
    };
    try {
      const activityId = fieldValue(form, "id");
      const data = await ProspectsApi.saveActivity(prospect.id, activityId, payload);
      upsertStateItem(activities, data.activity);
      selectedActivityId = data.activity.id;
      setMessage("Actividad guardada en la timeline.", "ok");
      renderMetrics();
      renderInsights();
      renderActivitySection();
    } catch (error) {
      setMessage(error.message || "No fue posible guardar la actividad.", "error");
    }
  }

  async function deleteActivity(event) {
    const id = event.currentTarget.dataset.activityDelete || "";
    if (!id || !window.confirm("¿Eliminar esta actividad del timeline?")) return;
    try {
      await ProspectsApi.deleteActivity(id);
      activities = activities.filter(item => item.id !== id);
      if (selectedActivityId === id) selectedActivityId = "";
      setMessage("Actividad eliminada.", "ok");
      renderMetrics();
      renderInsights();
      renderActivitySection();
    } catch (error) {
      setMessage(error.message || "No fue posible eliminar la actividad.", "error");
    }
  }

  async function persistEmail(prospectId, payload, emailId = "") {
    const data = await ProspectsApi.persistEmail(prospectId, payload, emailId);
    upsertStateItem(emails, data.email);
    selectedEmailId = data.email.id;
    return data;
  }

  async function invokeSendEmail(id) {
    const data = await ProspectsApi.sendEmail(id, { edgeFunctionError });
    if (data?.email) {
      upsertStateItem(emails, data.email);
      selectedEmailId = data.email.id;
    }
    if (data?.activity) {
      upsertStateItem(activities, data.activity);
      selectedActivityId = data.activity.id;
    }
    return data;
  }

  function applySelectedTemplate() {
    const prospect = collectProspectDraft();
    const template = selectedTemplate();
    const form = root.querySelector("[data-email-form]");
    if (!template || !form) return;
    form.subject.value = hydrateTemplate(template.subject, prospect);
    form.body.value = hydrateTemplate(template.body, prospect);
    form.recipientEmail.value = prospect.email || "";
    if (!form.status.value) form.status.value = "draft";
  }

  function collectProspectDraft() {
    const form = root.querySelector("[data-prospect-form]");
    if (!form) return selectedProspect() || emptyProspect();
    return {
      id: fieldValue(form, "id") || selectedProspectId || "",
      fullName: fieldValue(form, "fullName"),
      company: fieldValue(form, "company"),
      email: fieldValue(form, "email"),
      phone: fieldValue(form, "phone"),
      phase: fieldValue(form, "phase") || "lead",
      source: fieldValue(form, "source"),
      tags: splitTags(fieldValue(form, "tags")),
      valueEstimate: fieldValue(form, "valueEstimate"),
      nextFollowUpOn: fieldValue(form, "nextFollowUpOn"),
      notes: fieldValue(form, "notes")
    };
  }

  function hydrateTemplate(content, prospect) {
    const firstName = String(prospect.fullName || "").trim().split(/\s+/).filter(Boolean)[0] || "";
    return String(content || "")
      .replaceAll("{{first_name}}", firstName)
      .replaceAll("{{full_name}}", prospect.fullName || "")
      .replaceAll("{{company}}", prospect.company || "")
      .replaceAll("{{email}}", prospect.email || "")
      .replaceAll("{{phase}}", phaseLabel(prospect.phase));
  }

  function selectedProspect() {
    return prospects.find(item => item.id === selectedProspectId) || null;
  }

  function selectedTemplate() {
    return templates.find(item => item.id === selectedTemplateId) || null;
  }

  function selectedEmail() {
    return emails.find(item => item.id === selectedEmailId) || null;
  }

  function selectedActivity() {
    return activities.find(item => item.id === selectedActivityId) || null;
  }

  function emptyProspect() {
    return {
      id: "",
      fullName: "",
      company: "",
      email: "",
      phone: "",
      phase: "lead",
      tags: [],
      source: "",
      notes: "",
      valueEstimate: null,
      nextFollowUpOn: "",
      lastContactAt: null
    };
  }

  function emptyTemplate() {
    return {
      id: "",
      name: "",
      category: "",
      tags: [],
      subject: "",
      body: "",
      isActive: true
    };
  }

  function emptyEmail(prospect) {
    return {
      id: "",
      prospectId: prospect.id,
      templateId: selectedTemplateId || "",
      recipientEmail: prospect.email || "",
      subject: "",
      body: "",
      attachments: [],
      status: "draft",
      scheduledFor: null,
      sentAt: null,
      providerMessageId: ""
    };
  }

  function emptyActivity(prospectId) {
    return {
      id: "",
      prospectId,
      activityType: "note",
      title: "",
      details: "",
      dueAt: null,
      occurredAt: null,
      meta: {}
    };
  }

  function upsertStateItem(collection, item) {
    const index = collection.findIndex(entry => entry.id === item.id);
    if (index >= 0) collection.splice(index, 1, item);
    else collection.unshift(item);
  }

  function prospectMeta(item) {
    const parts = [];
    if (item.company) parts.push(item.company);
    if (item.nextFollowUpOn) parts.push(`seg. ${item.nextFollowUpOn}`);
    return parts.join(" · ") || item.email;
  }

  function phaseLabel(phaseId) {
    return PHASES.find(item => item.id === phaseId)?.label || "Sin fase";
  }

  function emailStatusLabel(status) {
    return EMAIL_STATUSES.find(item => item.id === status)?.label || "Correo";
  }

  function activityTypeOptions() {
    return ACTIVITY_TYPES;
  }

  function activityTypeLabel(value) {
    return activityTypeOptions().find(item => item.id === value)?.label || "Actividad";
  }

  function splitTags(value) {
    return [...new Set(String(value || "").split(",").map(item => item.trim()).filter(Boolean))];
  }

  function parseAttachments(value) {
    return String(value || "")
      .split("\n")
      .map(item => item.trim())
      .filter(Boolean)
      .map(line => {
        const [namePart, ...urlParts] = line.split("|");
        const path = String(urlParts.join("|") || namePart || "").trim();
        const filename = String(urlParts.length ? namePart : deriveFilename(path)).trim();
        if (!path) throw new Error("Cada adjunto necesita una URL.");
        if (!/^https?:\/\//i.test(path)) throw new Error("Los adjuntos deben usar URLs http(s).");
        if (!filename) throw new Error("Cada adjunto necesita un nombre.");
        return { filename: filename.slice(0, 180), path };
      })
      .slice(0, 10);
  }

  function attachmentsText(items) {
    return (Array.isArray(items) ? items : [])
      .map(item => {
        const filename = String(item?.filename || "").trim();
        const path = String(item?.path || "").trim();
        return filename && path ? `${filename} | ${path}` : "";
      })
      .filter(Boolean)
      .join("\n");
  }

  function deriveFilename(url) {
    try {
      const pathname = new URL(url).pathname.split("/").filter(Boolean).pop() || "";
      return decodeURIComponent(pathname) || "adjunto";
    } catch {
      return "adjunto";
    }
  }

  function datetimeLocalValue(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const pad = part => String(part).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function todayIso() {
    return new Date().toISOString().slice(0, 10);
  }

  function formatDate(value) {
    return window.BCCWorkspaceUtils.formatDateTime(value, { empty: "sin fecha" });
  }

  function number(value) {
    return new Intl.NumberFormat("es-DO").format(Number(value || 0));
  }

  function currency(value) {
    return new Intl.NumberFormat("es-DO", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value || 0));
  }

  function withTimeout(promise, timeoutMs, message) {
    return window.BCCWorkspaceUtils.withTimeout(promise, timeoutMs, message);
  }

  function prospectsError(error) {
    const message = String(error?.message || "");
    if (/no respondio a tiempo|timeout/i.test(message)) {
      return "Prospectos tardo demasiado en responder. Revisa Supabase o intenta de nuevo.";
    }
    if (/workspace_prospect_|relation .* does not exist|column .* does not exist/i.test(message)) {
      return "Falta aplicar la ultima actualizacion del esquema de Prospectos en Supabase.";
    }
    return message || "No fue posible cargar prospectos.";
  }

  async function edgeFunctionError(error, fallback) {
    if (typeof error?.context?.json === "function") {
      try {
        const payload = await error.context.json();
        if (payload?.error) return new Error(String(payload.error));
      } catch {}
    }
    return error instanceof Error ? error : new Error(fallback);
  }

  function fieldValue(form, name) {
    return String(form?.elements?.namedItem(name)?.value || "");
  }

  function fieldChecked(form, name) {
    return Boolean(form?.elements?.namedItem(name)?.checked);
  }

  function escapeHtml(value) {
    return window.BCCWorkspaceUtils.escapeHtml(value);
  }

  function escapeAttr(value) {
    return window.BCCWorkspaceUtils.escapeAttr(value);
  }

  function refreshIcons() {
    window.BCCWorkspaceUtils.refreshIcons(root || document);
  }

  window.BCCWorkspaceProspects = { init };
})();
