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
  let selectedEmailId = "";
  let selectedActivityId = "";
  let searchTerm = "";
  let phaseFilter = "";
  let activeTab = "pipeline";

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
    root.querySelector("[data-prospect-search]")?.addEventListener("input", event => {
      searchTerm = String(event.target.value || "").trim().toLowerCase();
      renderBoard();
      renderDirectoryList();
    });
    root.querySelector("[data-prospect-phase-filter]")?.addEventListener("change", event => {
      phaseFilter = String(event.target.value || "");
      renderBoard();
      renderDirectoryList();
    });
    root.querySelector("[data-prospects-refresh]")?.addEventListener("click", () => {
      void loadDashboard();
    });
    root.querySelectorAll("[data-prospects-tab]").forEach(button => {
      button.addEventListener("click", () => activateProspectsTab(button.dataset.prospectsTab || "pipeline"));
    });
    root.querySelector("[data-prospect-new]")?.addEventListener("click", () => {
      selectedProspectId = "";
      selectedEmailId = "";
      selectedActivityId = "";
      renderAll();
      activateProspectsTab("directory");
    });
    root.querySelector("[data-prospects-board]")?.addEventListener("click", handleBoardClick);
    root.querySelector("[data-prospects-directory-list]")?.addEventListener("click", handleDirectoryClick);
    root.addEventListener("click", handleProspectJump);
    root.querySelector("[data-template-list]")?.addEventListener("click", handleTemplateClick);
    root.querySelector("[data-prospect-email-section]")?.addEventListener("click", handleEmailClick);
    root.querySelector("[data-activity-list]")?.addEventListener("click", handleActivityClick);
    root.querySelector("[data-prospect-form]")?.addEventListener("submit", saveProspect);
    root.querySelector("[data-template-form]")?.addEventListener("submit", saveTemplate);
    root.querySelector("[data-activity-form]")?.addEventListener("submit", saveActivity);
  }

  function activateProspectsTab(tab = "pipeline") {
    const allowedTabs = new Set(["pipeline", "directory", "communication", "activity", "templates", "intelligence"]);
    activeTab = allowedTabs.has(tab) ? tab : "pipeline";
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
    renderBoard();
    renderDirectoryList();
    renderContextCards();
    renderProspectForm();
    renderEmailSection();
    renderTemplateSection();
    renderActivitySection();
    activateProspectsTab(activeTab);
    refreshIcons();
  }

  function setMessage(text, tone = "neutral") {
    const message = root.querySelector("[data-prospects-message]");
    if (!message) return;
    const content = String(text || "").trim();
    message.hidden = !content;
    renderMessageBlock(message, content, tone);
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

  function renderBoard() {
    const board = root.querySelector("[data-prospects-board]");
    if (!board) return;
    const currentItems = sortedProspects(filteredProspects());
    const counts = new Map(PHASES.map(phase => [phase.id, prospects.filter(item => item.phase === phase.id).length]));
    const selected = selectedProspect();
    board.innerHTML = `
      <div class="prospect-stage-strip" role="list" aria-label="Fases del pipeline">
        <button class="prospect-stage-chip ${phaseFilter ? "" : "is-active"}" type="button" data-phase-chip="">
          <span>Todos</span><strong>${number(prospects.length)}</strong>
        </button>
        ${PHASES.map(phase => `
          <button class="prospect-stage-chip ${phaseFilter === phase.id ? "is-active" : ""}" type="button" data-phase-chip="${escapeAttr(phase.id)}">
            <span>${escapeHtml(phase.label)}</span><strong>${number(counts.get(phase.id) || 0)}</strong>
          </button>
        `).join("")}
      </div>
      <div class="prospect-focus-layout">
        <section class="prospect-queue" aria-label="Cola de prospectos">
          <div class="prospect-queue-head">
            <div><h3>Cola priorizada</h3><p>${number(currentItems.length)} prospecto(s) visibles</p></div>
            <button class="btn btn-ghost btn-compact" type="button" data-prospect-new-inline><i data-lucide="plus"></i>Nuevo</button>
          </div>
          <div class="prospect-list">
            ${currentItems.length ? currentItems.map(item => prospectListItem(item)).join("") : `<div class="prospect-empty">No hay prospectos que coincidan con esta búsqueda.</div>`}
          </div>
        </section>
        <aside class="prospect-selected-summary" aria-label="Resumen del prospecto seleccionado">
          ${selected ? selectedProspectSummary(selected) : emptyProspectSummary()}
        </aside>
      </div>
    `;
    refreshIcons();
  }


  function renderDirectoryList() {
    const list = root.querySelector("[data-prospects-directory-list]");
    if (!list) return;
    const currentItems = sortedProspects(filteredProspects());
    list.innerHTML = `
      <div class="prospects-directory-head">
        <div><h3>Prospectos</h3><p>${number(currentItems.length)} resultado(s)</p></div>
        <button class="btn btn-ghost btn-compact" type="button" data-prospect-new-inline><i data-lucide="plus"></i>Nuevo</button>
      </div>
      <div class="prospect-list compact">
        ${currentItems.length ? currentItems.map(item => prospectListItem(item)).join("") : `<div class="prospect-empty">No hay prospectos con estos filtros.</div>`}
      </div>
    `;
    refreshIcons();
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
        <button type="button" data-prospect-jump="directory"><i data-lucide="contact-round"></i>Ficha</button>
        <button type="button" data-prospect-jump="communication"><i data-lucide="send"></i>Correo</button>
        <button type="button" data-prospect-jump="activity"><i data-lucide="clock-3"></i>Actividad</button>
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
    if (!form) return;
    const prospect = selectedProspect() || emptyProspect();
    form.innerHTML = `
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
    const count = root.querySelector("[data-prospect-template-count]");
    if (!form || !list) return;
    const template = selectedTemplate() || emptyTemplate();
    if (count) count.textContent = String(templates.length);
    form.innerHTML = `
      <input type="hidden" name="id" value="${escapeAttr(template.id || "")}" />
      <label>Nombre
        <input name="name" maxlength="120" required value="${escapeAttr(template.name || "")}" />
      </label>
      <label>Categoría
        <input name="category" maxlength="80" value="${escapeAttr(template.category || "")}" placeholder="Primer contacto, seguimiento, propuesta..." />
      </label>
      <label>Tags
        <input name="tags" maxlength="220" value="${escapeAttr((template.tags || []).join(", "))}" />
      </label>
      <label>Asunto
        <input name="subject" maxlength="180" required value="${escapeAttr(template.subject || "")}" />
      </label>
      <label>Cuerpo
        <textarea name="body" rows="8" maxlength="12000" required>${escapeHtml(template.body || "")}</textarea>
      </label>
      <label class="prospects-checkbox">
        <input name="isActive" type="checkbox" ${template.isActive !== false ? "checked" : ""} />
        <span>Plantilla activa</span>
      </label>
      <div class="prospects-form-actions">
        <button class="btn btn-primary" type="submit">${template.id ? "Guardar plantilla" : "Crear plantilla"}</button>
        ${template.id ? `<button class="btn btn-ghost" type="button" data-template-delete="${escapeAttr(template.id)}">Eliminar</button>` : ""}
      </div>
    `;
    refreshIcons();
    form.querySelector("[data-template-delete]")?.addEventListener("click", deleteTemplate);
    list.innerHTML = `
      <button class="prospect-template-item ${selectedTemplateId ? "" : "is-active"}" type="button" data-template-open="">
        <strong>Nueva plantilla</strong>
        <span>Limpiar formulario</span>
      </button>
      ${templates.map(item => `
        <button class="prospect-template-item ${item.id === selectedTemplateId ? "is-active" : ""}" type="button" data-template-open="${escapeAttr(item.id)}">
          <strong>${escapeHtml(item.name)}</strong>
          <span>${escapeHtml(item.category || "Sin categoría")} · ${item.isActive ? "Activa" : "Pausada"}</span>
        </button>
      `).join("")}
    `;
    refreshIcons();
  }

  function handleBoardClick(event) {
    const phaseButton = event.target.closest("[data-phase-chip]");
    if (phaseButton) {
      phaseFilter = phaseButton.dataset.phaseChip || "";
      const select = root.querySelector("[data-prospect-phase-filter]");
      if (select) select.value = phaseFilter;
      renderBoard();
      return;
    }

    const newButton = event.target.closest("[data-prospect-new-inline]");
    if (newButton) {
      selectedProspectId = "";
      selectedEmailId = "";
      selectedActivityId = "";
      renderAll();
      activateProspectsTab("directory");
      return;
    }

    const jumpButton = event.target.closest("[data-prospect-jump]");
    if (jumpButton) {
      event.preventDefault();
      activateProspectsTab(jumpButton.dataset.prospectJump || "directory");
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
    const jumpButton = event.target.closest("[data-prospect-jump]");
    if (!jumpButton || !root.contains(jumpButton)) return;
    event.preventDefault();
    activateProspectsTab(jumpButton.dataset.prospectJump || "directory");
  }

  function handleDirectoryClick(event) {
    const newButton = event.target.closest("[data-prospect-new-inline]");
    if (newButton) {
      selectedProspectId = "";
      selectedEmailId = "";
      selectedActivityId = "";
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
    activateProspectsTab("directory");
  }

  function handleTemplateClick(event) {
    const button = event.target.closest("[data-template-open]");
    if (!button) return;
    selectedTemplateId = button.dataset.templateOpen || "";
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
