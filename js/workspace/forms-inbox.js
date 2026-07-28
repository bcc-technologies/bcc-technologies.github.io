/* Client-only inbox for forms explicitly delivered to the signed-in account. */
(() => {
  const ui = window.BCCWorkspaceUI;
  const repository = window.BCCWorkspaceFormRepository;

  let root = null;
  let forms = [];
  let responses = [];
  let activeForm = null;
  let lifecycleSignal = null;

  async function init(_account, context = {}) {
    root = context.root || document.querySelector("[data-client-form-inbox]");
    lifecycleSignal = context.signal || null;
    if (!root || root.dataset.ready === "true") return;
    root.dataset.ready = "true";
    root.innerHTML = inboxTemplate();
    bindControls();
    refreshIcons();
    await loadInbox();
  }

  function inboxTemplate() {
    return `
      <p class="forms-message" data-forms-message hidden></p>
      <section class="form-inbox form-inbox--received" aria-live="polite">
        <div class="forms-panel-head">
          <div class="form-inbox-intro"><span class="form-inbox-eyebrow">Bandeja privada</span><h3>Requerimientos de tu cuenta</h3><p>Revisa, responde o actualiza los formularios que BCC haya compartido contigo.</p></div>
          <span class="forms-badge" data-form-count>0 recibidos</span>
        </div>
        <div class="form-inbox-list" data-form-inbox></div>
      </section>
      <dialog class="response-dialog" data-response-dialog>
        <form class="response-dialog-body" data-response-form>
          <div class="response-dialog-head">
            <div><h2 data-response-title></h2><p data-response-purpose></p></div>
            <button class="icon-close" type="button" data-response-close aria-label="Cerrar">${ui.icon("x", "sm")}</button>
          </div>
          <div class="response-fields" data-response-fields></div>
          <div class="task-dialog-actions">
            <button class="btn btn-ghost" type="button" data-response-close>Cancelar</button>
            <button class="btn btn-primary" type="submit">Enviar respuestas</button>
          </div>
        </form>
      </dialog>
    `;
  }

  function bindControls() {
    root.querySelector("[data-form-inbox]").addEventListener("click", handleInboxAction);
    root.querySelector("[data-response-form]").addEventListener("submit", submitResponse);
    root.querySelectorAll("[data-response-close]").forEach(button => button.addEventListener("click", () => root.querySelector("[data-response-dialog]").close()));
  }

  async function loadInbox() {
    const signal = lifecycleSignal;
    setMessage("Cargando formularios recibidos...", "neutral");
    try {
      const [nextForms, nextResponses] = await Promise.all([
        repository.listReceived(requestOptions(signal)),
        repository.listMine(requestOptions(signal))
      ]);
      if (!isActive(signal)) return;
      forms = nextForms;
      responses = nextResponses;
      setMessage("");
      renderInbox();
    } catch (error) {
      if (isCancelled(error, signal)) return;
      setMessage(formsError(error), "error");
      renderInbox();
    }
  }

  function renderInbox() {
    if (!root) return;
    const target = root.querySelector("[data-form-inbox]");
    const pending = forms.filter(form => !responses.some(item => item.formId === form.id)).length;
    root.querySelector("[data-form-count]").textContent = pending
      ? `${pending} ${pending === 1 ? "pendiente" : "pendientes"}`
      : forms.length ? "Al día" : "Sin envíos";
    if (!forms.length) {
      target.innerHTML = `<div class="forms-empty forms-empty--received">${ui.icon("inbox", "md")}<div><strong>No tienes formularios pendientes</strong><p>Cuando BCC te comparta un requerimiento, aparecerá aquí para que puedas responderlo.</p></div></div>`;
      refreshIcons();
      return;
    }
    target.innerHTML = forms.map((form, index) => {
      const response = responses.find(item => item.formId === form.id);
      return `
        <article class="inbox-form">
          <span class="inbox-form-sequence" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>
          <div class="inbox-form-copy">
            <span class="forms-status ${response ? "answered" : ""}">${response ? "Respondido" : "Pendiente"}</span>
            <h4>${escapeHtml(form.title)}</h4>
            <p>${escapeHtml(form.purpose)}</p>
          </div>
          <div class="inbox-form-action"><button class="btn ${response ? "btn-ghost" : "btn-primary"}" type="button" data-answer-form="${escapeHtml(form.id)}">
              ${response ? "Actualizar respuesta" : "Responder formulario"}
            </button></div>
        </article>
      `;
    }).join("");
  }

  function handleInboxAction(event) {
    const button = event.target.closest("[data-answer-form]");
    if (!button) return;
    activeForm = forms.find(item => item.id === button.dataset.answerForm);
    if (!activeForm) return;
    const previous = responses.find(item => item.formId === activeForm.id);
    root.querySelector("[data-response-title]").textContent = activeForm.title;
    root.querySelector("[data-response-purpose]").textContent = activeForm.purpose;
    root.querySelector("[data-response-fields]").innerHTML = activeForm.questions.map(item => responseField(item, previous?.answers?.[item.id] || "")).join("");
    root.querySelector("[data-response-dialog]").showModal();
    refreshIcons();
  }

  function responseField(item, answer) {
    const required = item.required ? "required" : "";
    if (item.type === "scale") {
      return `<fieldset class="response-scale"><legend>${escapeHtml(item.label)}${item.required ? " *" : ""}</legend>
        <div>${[1, 2, 3, 4, 5].map(value => `<label><input type="radio" name="${escapeHtml(item.id)}" value="${value}" ${String(answer) === String(value) ? "checked" : ""} ${required} /><span>${value}</span></label>`).join("")}</div>
      </fieldset>`;
    }
    if (item.type === "choice") {
      return `<label class="response-field">${escapeHtml(item.label)}${item.required ? " *" : ""}
        <select name="${escapeHtml(item.id)}" ${required}><option value="">Selecciona una opcion</option>${item.options.map(value => `<option value="${escapeHtml(value)}" ${answer === value ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}</select>
      </label>`;
    }
    if (item.type === "short_text") {
      return `<label class="response-field">${escapeHtml(item.label)}${item.required ? " *" : ""}
        <input name="${escapeHtml(item.id)}" maxlength="240" value="${escapeHtml(answer)}" ${required} />
      </label>`;
    }
    return `<label class="response-field">${escapeHtml(item.label)}${item.required ? " *" : ""}
      <textarea name="${escapeHtml(item.id)}" maxlength="1500" rows="3" ${required}>${escapeHtml(answer)}</textarea>
    </label>`;
  }

  async function submitResponse(event) {
    event.preventDefault();
    if (!activeForm) return;
    const submission = new FormData(event.currentTarget);
    const answers = {};
    activeForm.questions.forEach(item => { answers[item.id] = String(submission.get(item.id) || "").trim(); });
    const submit = event.currentTarget.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      const savedResponse = await repository.submit(activeForm.id, answers, requestOptions());
      responses = [...responses.filter(item => item.formId !== activeForm.id), savedResponse];
      root.querySelector("[data-response-dialog]").close();
      setMessage("Respuestas enviadas.", "ok");
      renderInbox();
    } catch (error) {
      if (!isCancelled(error)) setMessage(formsError(error), "error");
    } finally {
      if (submit.isConnected) submit.disabled = false;
    }
  }

  function setMessage(message, tone = "neutral") {
    window.BCCWorkspaceUtils.setMessage(root.querySelector("[data-forms-message]"), message, tone);
  }

  function requestOptions(signal = lifecycleSignal) {
    return signal ? { signal } : {};
  }

  function isActive(signal = lifecycleSignal) {
    return Boolean(root) && !signal?.aborted;
  }

  function isCancelled(error, signal = lifecycleSignal) {
    return Boolean(signal?.aborted || error?.code === "cancelled");
  }

  function activate(context = {}) {
    lifecycleSignal = context.signal || lifecycleSignal;
    if (root) renderInbox();
  }

  function destroy() {
    if (root) {
      root.querySelectorAll("dialog[open]").forEach(dialog => dialog.close());
      root.replaceChildren();
      delete root.dataset.ready;
    }
    root = null;
    forms = [];
    responses = [];
    activeForm = null;
    lifecycleSignal = null;
  }

  function formsError(error) {
    return window.BCCWorkspaceFormContracts.toError(error).message;
  }

  function refreshIcons() {
    window.BCCWorkspaceUtils.refreshIcons(root);
  }

  function escapeHtml(value) {
    return window.BCCWorkspaceUtils.escapeHtml(value);
  }

  window.BCCWorkspaceFormInbox = { init, activate, destroy };
})();
