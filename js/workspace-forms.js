(() => {
  const TEMPLATES = {
    client_feedback: {
      audience: "client",
      label: "Experiencia general",
      title: "Customer feedback",
      purpose: "Comprender satisfaccion, necesidades y oportunidades de mejora.",
      questions: [
        question("satisfaction", "Que tan satisfecho estas con tu experiencia?", "scale", true),
        question("value", "Que aspecto te ha resultado mas valioso?", "long_text", true),
        question("improve", "Que deberiamos mejorar primero?", "long_text", false)
      ]
    },
    client_support: {
      audience: "client",
      label: "Seguimiento de soporte",
      title: "Seguimiento de soporte",
      purpose: "Evaluar resolucion, claridad y proximos pasos luego de una solicitud.",
      questions: [
        question("resolved", "Tu necesidad quedo resuelta?", "choice", true, ["Si", "Parcialmente", "No"]),
        question("service", "Califica la atencion recibida.", "scale", true),
        question("pending", "Que queda pendiente?", "long_text", false)
      ]
    },
    client_discovery: {
      audience: "client",
      label: "Necesidades futuras",
      title: "Nuevas necesidades",
      purpose: "Identificar proyectos, productos o acompanamiento de interes.",
      questions: [
        question("priority", "Cual es tu prioridad principal para los proximos meses?", "long_text", true),
        question("interest", "En que area necesitas apoyo?", "choice", true, ["Tecnologia", "Operaciones", "Analisis", "Otro"]),
        question("contact", "Deseas que alguien te contacte?", "choice", false, ["Si", "No"])
      ]
    },
    staff_monthly: {
      audience: "staff",
      label: "Informe mensual",
      title: "Informe mensual de trabajo",
      purpose: "Recopilar avances, bloqueos y prioridades para el siguiente ciclo.",
      questions: [
        question("wins", "Principales avances del mes", "long_text", true),
        question("blockers", "Bloqueos o riesgos identificados", "long_text", false),
        question("next", "Prioridades del proximo mes", "long_text", true)
      ]
    },
    staff_suggestions: {
      audience: "staff",
      label: "Sugerencias internas",
      title: "Sugerencias internas",
      purpose: "Canalizar oportunidades para procesos, herramientas y colaboracion.",
      questions: [
        question("area", "Area relacionada", "choice", true, ["Tecnologia", "Finanzas", "Operaciones", "Marketing", "Recursos humanos", "General"]),
        question("suggestion", "Describe tu sugerencia", "long_text", true),
        question("impact", "Que impacto esperas?", "long_text", false)
      ]
    },
    staff_culture: {
      audience: "staff",
      label: "Cultura y satisfaccion",
      title: "Pulso de cultura y satisfaccion",
      purpose: "Monitorear bienestar, colaboracion y condiciones de trabajo.",
      questions: [
        question("satisfaction", "Que tan satisfecho estas en tu trabajo actualmente?", "scale", true),
        question("supported", "Te sientes apoyado por tu equipo?", "scale", true),
        question("culture", "Que cambio fortaleceria nuestra cultura?", "long_text", false)
      ]
    }
  };

  let root = null;
  let user = null;
  let forms = [];
  let responses = [];
  let draftQuestions = [];
  let activeForm = null;
  let view = "";

  function question(id, label, type, required, options = []) {
    return { id, label, type, required, options };
  }

  async function init(account) {
    root = document.querySelector("[data-forms-workspace]");
    if (!root || root.dataset.ready === "true") return;
    root.dataset.ready = "true";
    user = account;
    view = root.dataset.formsView || account.role || "client";
    root.innerHTML = canManage() ? adminTemplate() : inboxTemplate();
    bindControls();
    refreshIcons();
    if (canManage()) chooseTemplate(Object.keys(TEMPLATES)[0]);
    await loadForms();
  }

  function isAdmin() {
    return user?.permissions?.includes("admin:view");
  }

  function canManage() {
    return isAdmin() && view === "admin";
  }

  function isPreview() {
    return isAdmin() && !canManage();
  }

  function adminTemplate() {
    return `
      <div class="forms-head">
        <div>
          <h2>Formularios</h2>
          <p>Crea instrumentos para clientes o personal y controla su publicacion.</p>
        </div>
      </div>
      <p class="forms-message" data-forms-message hidden></p>
      <div class="forms-admin-layout">
        <form class="form-builder forms-surface" data-form-builder>
          <div class="forms-panel-head">
            <h3>Generar formulario</h3>
            <span class="forms-badge">Administrador</span>
          </div>
          <div class="form-builder-row">
            <label>Audiencia
              <select data-form-audience name="audience">
                <option value="client">Clientes</option>
                <option value="staff">Personal</option>
              </select>
            </label>
            <label>Plantilla
              <select data-form-template></select>
            </label>
          </div>
          <label>Titulo
            <input name="title" maxlength="120" required />
          </label>
          <label>Objetivo
            <textarea name="purpose" maxlength="280" rows="2" required></textarea>
          </label>
          <div class="builder-question-head">
            <h4>Preguntas</h4>
            <button class="btn btn-ghost" type="button" data-add-question><i data-lucide="plus"></i>Pregunta</button>
          </div>
          <div class="builder-questions" data-builder-questions></div>
          <div class="form-builder-actions">
            <button class="btn btn-primary" type="submit">Guardar borrador</button>
          </div>
        </form>
        <section class="forms-surface form-library">
          <div class="forms-panel-head">
            <div>
              <h3>Formularios creados</h3>
              <p>Publica para habilitar respuestas.</p>
            </div>
          </div>
          <div class="form-library-list" data-form-library></div>
        </section>
      </div>
      <dialog class="response-dialog result-dialog" data-results-dialog>
        <div class="response-dialog-body">
          <div class="response-dialog-head">
            <div><h2 data-results-title>Respuestas</h2><p data-results-caption></p></div>
            <button class="icon-close" type="button" data-results-close aria-label="Cerrar"><i data-lucide="x"></i></button>
          </div>
          <div class="result-list" data-results-list></div>
        </div>
      </dialog>
    `;
  }

  function inboxTemplate() {
    const audience = view === "staff" ? "personal" : "clientes";
    return `
      <div class="forms-head">
        <div>
          <h2>Formularios</h2>
          <p>${isPreview() ? `Vista previa de encuestas publicadas para ${audience}.` : `Encuestas disponibles para ${audience}. Tus respuestas quedan registradas de forma privada.`}</p>
        </div>
      </div>
      <p class="forms-message" data-forms-message hidden></p>
      <section class="forms-surface form-inbox">
        <div class="forms-panel-head">
          <h3>Pendientes y completados</h3>
          <span class="forms-badge" data-form-count>0 disponibles</span>
        </div>
        <div class="form-inbox-list" data-form-inbox></div>
      </section>
      <dialog class="response-dialog" data-response-dialog>
        <form class="response-dialog-body" data-response-form>
          <div class="response-dialog-head">
            <div><h2 data-response-title></h2><p data-response-purpose></p></div>
            <button class="icon-close" type="button" data-response-close aria-label="Cerrar"><i data-lucide="x"></i></button>
          </div>
          <div class="response-fields" data-response-fields></div>
          <div class="task-dialog-actions">
            <button class="btn btn-ghost" type="button" data-response-close>Cancelar</button>
            ${isPreview() ? "" : `<button class="btn btn-primary" type="submit">Enviar respuestas</button>`}
          </div>
        </form>
      </dialog>
    `;
  }

  function bindControls() {
    if (canManage()) {
      root.querySelector("[data-form-audience]").addEventListener("change", event => populateTemplates(event.target.value));
      root.querySelector("[data-form-template]").addEventListener("change", event => chooseTemplate(event.target.value));
      root.querySelector("[data-add-question]").addEventListener("click", addDraftQuestion);
      root.querySelector("[data-form-builder]").addEventListener("submit", saveForm);
      root.querySelector("[data-form-library]").addEventListener("click", handleLibraryAction);
      root.querySelector("[data-results-close]").addEventListener("click", () => root.querySelector("[data-results-dialog]").close());
      root.querySelector("[data-builder-questions]").addEventListener("click", handleBuilderQuestionAction);
    } else {
      root.querySelector("[data-form-inbox]").addEventListener("click", handleInboxAction);
      root.querySelector("[data-response-form]").addEventListener("submit", submitResponse);
      root.querySelectorAll("[data-response-close]").forEach(button => button.addEventListener("click", () => root.querySelector("[data-response-dialog]").close()));
    }
  }

  async function loadForms() {
    setMessage("Cargando formularios...", "neutral");
    try {
      const data = await window.BCCAuth.api("/api/workspace/forms");
      forms = Array.isArray(data.forms) ? data.forms : [];
      if (!canManage()) {
        forms = forms.filter(form => form.status === "published" && form.audience === view);
      }
      if (!canManage() && !isPreview()) {
        const received = await window.BCCAuth.api("/api/workspace/form-responses/me");
        responses = Array.isArray(received.responses) ? received.responses : [];
      }
      setMessage("");
      renderForms();
    } catch (error) {
      setMessage(formsError(error), "error");
      renderForms();
    }
  }

  function populateTemplates(audience) {
    const select = root.querySelector("[data-form-template]");
    const choices = Object.entries(TEMPLATES).filter(([, item]) => item.audience === audience);
    select.innerHTML = choices.map(([key, item]) => `<option value="${key}">${escapeHtml(item.label)}</option>`).join("");
    if (choices[0]) chooseTemplate(choices[0][0]);
  }

  function chooseTemplate(key) {
    const item = TEMPLATES[key];
    if (!item) {
      populateTemplates(root.querySelector("[data-form-audience]").value);
      return;
    }
    root.querySelector("[data-form-audience]").value = item.audience;
    const templateSelect = root.querySelector("[data-form-template]");
    if (!templateSelect.options.length || !Array.from(templateSelect.options).some(option => option.value === key)) {
      templateSelect.innerHTML = Object.entries(TEMPLATES)
        .filter(([, template]) => template.audience === item.audience)
        .map(([value, template]) => `<option value="${value}">${escapeHtml(template.label)}</option>`).join("");
    }
    templateSelect.value = key;
    const form = root.querySelector("[data-form-builder]");
    form.elements.title.value = item.title;
    form.elements.purpose.value = item.purpose;
    draftQuestions = item.questions.map(copyQuestion);
    renderDraftQuestions();
  }

  function addDraftQuestion() {
    if (draftQuestions.length >= 12) {
      setMessage("Puedes incluir hasta 12 preguntas.", "error");
      return;
    }
    draftQuestions.push(question(`custom_${Date.now()}`, "Nueva pregunta", "long_text", false));
    renderDraftQuestions();
  }

  function handleBuilderQuestionAction(event) {
    const button = event.target.closest("[data-remove-question]");
    if (!button) return;
    if (draftQuestions.length <= 1) return;
    draftQuestions.splice(Number(button.dataset.removeQuestion), 1);
    renderDraftQuestions();
  }

  function renderDraftQuestions() {
    const target = root.querySelector("[data-builder-questions]");
    target.innerHTML = draftQuestions.map((item, index) => `
      <div class="builder-question">
        <label>
          <span class="sr-only">Pregunta ${index + 1}</span>
          <input data-question-label="${index}" value="${escapeHtml(item.label)}" maxlength="180" required />
        </label>
        <select data-question-type="${index}" aria-label="Tipo de pregunta">
          <option value="long_text" ${item.type === "long_text" ? "selected" : ""}>Texto largo</option>
          <option value="short_text" ${item.type === "short_text" ? "selected" : ""}>Texto corto</option>
          <option value="scale" ${item.type === "scale" ? "selected" : ""}>Escala 1 a 5</option>
          <option value="choice" ${item.type === "choice" ? "selected" : ""}>Opciones</option>
        </select>
        <label class="question-required">
          <input type="checkbox" data-question-required="${index}" ${item.required ? "checked" : ""} /> Obligatoria
        </label>
        <button class="task-delete" type="button" data-remove-question="${index}" aria-label="Quitar pregunta"><i data-lucide="trash-2"></i></button>
      </div>
    `).join("");
    refreshIcons();
  }

  function collectQuestions() {
    return draftQuestions.map((item, index) => {
      const label = root.querySelector(`[data-question-label="${index}"]`).value.trim();
      const type = root.querySelector(`[data-question-type="${index}"]`).value;
      const required = root.querySelector(`[data-question-required="${index}"]`).checked;
      if (!label) throw new Error("Todas las preguntas necesitan texto.");
      const options = type === "choice" ? (item.options.length ? item.options : ["Si", "No"]) : [];
      return { id: item.id, label, type, required, options };
    });
  }

  async function saveForm(event) {
    event.preventDefault();
    const builder = event.currentTarget;
    const button = builder.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const data = await window.BCCAuth.api("/api/workspace/forms", {
        method: "POST",
        body: JSON.stringify({
          audience: builder.elements.audience.value,
          title: builder.elements.title.value.trim(),
          purpose: builder.elements.purpose.value.trim(),
          questions: collectQuestions()
        })
      });
      forms.unshift(data.form);
      setMessage("Formulario guardado como borrador.", "ok");
      renderForms();
    } catch (error) {
      setMessage(formsError(error), "error");
    } finally {
      button.disabled = false;
    }
  }

  async function handleLibraryAction(event) {
    const button = event.target.closest("[data-form-action]");
    if (!button) return;
    const form = forms.find(item => item.id === button.dataset.formId);
    if (!form) return;
    if (button.dataset.formAction === "responses") {
      await showResults(form);
      return;
    }
    const nextStatus = button.dataset.formAction === "publish" ? "published" : "draft";
    button.disabled = true;
    try {
      const data = await window.BCCAuth.api(`/api/workspace/forms/${encodeURIComponent(form.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus })
      });
      forms = forms.map(item => item.id === form.id ? data.form : item);
      setMessage(nextStatus === "published" ? "Formulario publicado." : "Formulario retirado.", "ok");
      renderForms();
    } catch (error) {
      setMessage(formsError(error), "error");
      button.disabled = false;
    }
  }

  async function showResults(form) {
    try {
      const data = await window.BCCAuth.api(`/api/workspace/forms/${encodeURIComponent(form.id)}/responses`);
      const list = root.querySelector("[data-results-list]");
      const entries = Array.isArray(data.responses) ? data.responses : [];
      root.querySelector("[data-results-title]").textContent = form.title;
      root.querySelector("[data-results-caption]").textContent = `${entries.length} respuestas registradas`;
      list.innerHTML = entries.length ? entries.map(response => `
        <article class="result-entry">
          <strong>${escapeHtml(response.respondentLabel || "Usuario")}</strong>
          <time>${escapeHtml(formatDate(response.submittedAt))}</time>
          ${form.questions.map(item => `<div><span>${escapeHtml(item.label)}</span><p>${escapeHtml(String(response.answers[item.id] || "Sin respuesta"))}</p></div>`).join("")}
        </article>
      `).join("") : `<p class="forms-empty">Todavia no hay respuestas para este formulario.</p>`;
      root.querySelector("[data-results-dialog]").showModal();
      refreshIcons();
    } catch (error) {
      setMessage(formsError(error), "error");
    }
  }

  function renderForms() {
    if (canManage()) return renderLibrary();
    const target = root.querySelector("[data-form-inbox]");
    root.querySelector("[data-form-count]").textContent = `${forms.length} disponibles`;
    if (!forms.length) {
      target.innerHTML = `<p class="forms-empty">No hay formularios publicados para tu cuenta.</p>`;
      return;
    }
    target.innerHTML = forms.map(form => {
      const response = responses.find(item => item.formId === form.id);
      return `
        <article class="inbox-form">
          <div>
            <span class="forms-status ${response ? "answered" : ""}">${response ? "Respondido" : "Pendiente"}</span>
            <h4>${escapeHtml(form.title)}</h4>
            <p>${escapeHtml(form.purpose)}</p>
          </div>
          <button class="btn ${response ? "btn-ghost" : "btn-primary"}" type="button" data-answer-form="${escapeHtml(form.id)}">
            ${isPreview() ? "Ver" : response ? "Actualizar" : "Responder"}
          </button>
        </article>
      `;
    }).join("");
  }

  function renderLibrary() {
    const target = root.querySelector("[data-form-library]");
    if (!forms.length) {
      target.innerHTML = `<p class="forms-empty">Crea el primer formulario para comenzar.</p>`;
      return;
    }
    target.innerHTML = forms.map(form => `
      <article class="library-form">
        <div class="library-form-top">
          <span class="forms-status ${form.status}">${form.status === "published" ? "Publicado" : "Borrador"}</span>
          <span class="forms-audience">${form.audience === "client" ? "Clientes" : "Personal"}</span>
        </div>
        <h4>${escapeHtml(form.title)}</h4>
        <p>${escapeHtml(form.purpose)}</p>
        <div class="library-actions">
          <button class="btn btn-ghost" type="button" data-form-action="responses" data-form-id="${escapeHtml(form.id)}">Respuestas</button>
          <button class="btn btn-primary" type="button" data-form-action="${form.status === "published" ? "unpublish" : "publish"}" data-form-id="${escapeHtml(form.id)}">
            ${form.status === "published" ? "Retirar" : "Publicar"}
          </button>
        </div>
      </article>
    `).join("");
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
    if (!activeForm || isPreview()) return;
    const submission = new FormData(event.currentTarget);
    const answers = {};
    activeForm.questions.forEach(item => { answers[item.id] = String(submission.get(item.id) || "").trim(); });
    const submit = event.currentTarget.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      const data = await window.BCCAuth.api(`/api/workspace/forms/${encodeURIComponent(activeForm.id)}/response`, {
        method: "POST",
        body: JSON.stringify({ answers })
      });
      responses = [...responses.filter(item => item.formId !== activeForm.id), data.response];
      root.querySelector("[data-response-dialog]").close();
      setMessage("Respuestas enviadas.", "ok");
      renderForms();
    } catch (error) {
      setMessage(formsError(error), "error");
    } finally {
      submit.disabled = false;
    }
  }

  function copyQuestion(item) {
    return { ...item, options: [...item.options] };
  }

  function setMessage(message, tone = "neutral") {
    const target = root.querySelector("[data-forms-message]");
    target.textContent = message || "";
    target.dataset.tone = tone;
    target.hidden = !message;
  }

  function formsError(error) {
    if (/workspace_forms|workspace_form_responses|relation .* does not exist/i.test(error.message || "")) {
      return "El servicio requiere activar las tablas de formularios en Supabase.";
    }
    return error.message || "No fue posible actualizar formularios.";
  }

  function formatDate(value) {
    return value ? new Date(value).toLocaleDateString("es-DO", { day: "numeric", month: "short", year: "numeric" }) : "";
  }

  function refreshIcons() {
    window.BCCWorkspaceIcons?.createIcons(root);
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[char]));
  }

  window.BCCWorkspaceForms = { init };
})();
