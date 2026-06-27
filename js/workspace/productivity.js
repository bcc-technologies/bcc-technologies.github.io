(() => {
  const STATUS_ORDER = ["backlog", "in_progress", "done"];
  const STATUS_LABELS = {
    backlog: "Pendiente",
    in_progress: "En curso",
    done: "Completado"
  };
  const PRIORITY_LABELS = {
    low: "Baja",
    medium: "Media",
    high: "Alta"
  };

  let tasks = [];
  let activeFilter = "all";
  let activeView = "tasks";
  let root = null;

  async function init(user) {
    root = document.querySelector("[data-productivity-workspace]");
    if (!root || root.dataset.ready === "true") return;
    root.dataset.ready = "true";
    root.innerHTML = template(user);
    bindControls();
    renderAll();
    refreshIcons();
    await loadTasks();
  }

  function template() {
    return `
      <div class="productivity-head">
        <div>
          <h2>Tareas y KPIs</h2>
          <p>Tareas privadas, avance visual y reportes basados en tu actividad.</p>
        </div>
        <button class="btn btn-primary productivity-new" type="button" data-task-new>
          <i data-lucide="plus"></i>Nueva tarea
        </button>
      </div>
      <div class="productivity-tabs" role="tablist" aria-label="Vistas de tareas y KPIs">
        <button class="active" type="button" role="tab" aria-selected="true" data-productivity-tab="tasks">
          <i data-lucide="list-checks"></i>Tareas
        </button>
        <button type="button" role="tab" aria-selected="false" data-productivity-tab="board">
          <i data-lucide="columns-3"></i>Tablero
        </button>
        <button type="button" role="tab" aria-selected="false" data-productivity-tab="reports">
          <i data-lucide="chart-no-axes-column-increasing"></i>KPIs
        </button>
      </div>
      <p class="productivity-message" data-task-message hidden></p>
      <section class="productivity-panel productivity-overview" data-productivity-panel="tasks">
        <article class="productivity-surface">
          <div class="productivity-toolbar">
            <h3>Mis tareas</h3>
            <label>
              <span class="sr-only">Filtrar tareas</span>
              <select data-task-filter>
                <option value="all">Todas</option>
                <option value="active">Activas</option>
                <option value="due">Por vencer</option>
                <option value="done">Completadas</option>
              </select>
            </label>
          </div>
          <ul class="task-list" data-task-list></ul>
        </article>
        <aside class="productivity-surface kpi-rail">
          <h3>Resumen</h3>
          <div class="kpi-compact-grid" data-kpi-compact></div>
          <div class="kpi-progress">
            <div><span>Progreso</span><strong data-kpi-rate>0%</strong></div>
            <progress data-kpi-progress max="100" value="0"></progress>
          </div>
        </aside>
      </section>
      <section class="productivity-panel productivity-board" data-productivity-panel="board" hidden>
        <div class="kanban-grid" data-kanban-board></div>
      </section>
      <section class="productivity-panel productivity-reports" data-productivity-panel="reports" hidden>
        <div class="report-stat-grid" data-kpi-reports></div>
        <article class="productivity-surface workload-report">
          <div class="productivity-toolbar">
            <div>
              <h3>Distribucion del trabajo</h3>
              <p>Estado actual de tus tareas registradas.</p>
            </div>
          </div>
          <div class="workload-bars" data-workload-bars></div>
        </article>
      </section>
      <dialog class="task-dialog" data-task-dialog>
        <form class="task-form" data-task-form>
          <div class="task-dialog-head">
            <div>
              <h2>Nueva tarea</h2>
              <p>Agrega una actividad a tu tablero privado.</p>
            </div>
            <button class="icon-close" type="button" data-task-close aria-label="Cerrar">
              <i data-lucide="x"></i>
            </button>
          </div>
          <label>
            Titulo
            <input type="text" name="title" maxlength="160" required placeholder="Que necesitas completar?" />
          </label>
          <div class="task-form-row">
            <label>
              Prioridad
              <select name="priority">
                <option value="medium">Media</option>
                <option value="high">Alta</option>
                <option value="low">Baja</option>
              </select>
            </label>
            <label>
              Fecha limite
              <input type="date" name="dueDate" />
            </label>
          </div>
          <label>
            Detalle
            <textarea name="description" maxlength="500" rows="3" placeholder="Notas opcionales"></textarea>
          </label>
          <div class="task-dialog-actions">
            <button class="btn btn-ghost" type="button" data-task-close>Cancelar</button>
            <button class="btn btn-primary" type="submit">Crear tarea</button>
          </div>
        </form>
      </dialog>
    `;
  }

  function bindControls() {
    root.querySelector("[data-task-new]")?.addEventListener("click", openTaskDialog);
    root.querySelectorAll("[data-task-close]").forEach(button => {
      button.addEventListener("click", () => root.querySelector("[data-task-dialog]")?.close());
    });
    root.querySelector("[data-task-form]")?.addEventListener("submit", createTask);
    root.querySelector("[data-task-filter]")?.addEventListener("change", event => {
      activeFilter = event.target.value;
      renderTaskList();
    });
    root.querySelectorAll("[data-productivity-tab]").forEach(button => {
      button.addEventListener("click", () => selectView(button.dataset.productivityTab));
    });
    root.addEventListener("click", handleTaskAction);
    root.addEventListener("change", handleTaskToggle);
  }

  async function loadTasks() {
    setMessage("Cargando tareas...", "neutral");
    try {
      const data = await window.BCCAuth.api("/api/workspace/tasks");
      tasks = Array.isArray(data.tasks) ? data.tasks : [];
      setMessage("");
      renderAll();
    } catch (error) {
      setMessage(productivityError(error), "error");
      renderAll();
    }
  }

  function openTaskDialog() {
    const dialog = root.querySelector("[data-task-dialog]");
    const form = root.querySelector("[data-task-form]");
    form?.reset();
    dialog?.showModal();
    form?.elements.title.focus();
  }

  async function createTask(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const title = String(form.elements.title.value || "").trim();
    if (!title) return;
    toggleSubmitting(form, true);
    try {
      const data = await window.BCCAuth.api("/api/workspace/tasks", {
        method: "POST",
        body: JSON.stringify({
          title,
          priority: form.elements.priority.value,
          dueDate: form.elements.dueDate.value || null,
          description: String(form.elements.description.value || "").trim()
        })
      });
      tasks.unshift(data.task);
      root.querySelector("[data-task-dialog]")?.close();
      setMessage("Tarea creada.", "ok");
      renderAll();
    } catch (error) {
      setMessage(productivityError(error), "error");
    } finally {
      toggleSubmitting(form, false);
    }
  }

  async function handleTaskToggle(event) {
    const checkbox = event.target.closest("[data-task-complete]");
    if (!checkbox) return;
    const task = findTask(checkbox.dataset.taskComplete);
    if (!task) return;
    const status = checkbox.checked ? "done" : "in_progress";
    await updateTask(task, { status }, checkbox);
  }

  async function handleTaskAction(event) {
    const button = event.target.closest("[data-task-action]");
    if (!button) return;
    const task = findTask(button.dataset.taskId);
    if (!task) return;
    if (button.dataset.taskAction === "delete") {
      await deleteTask(task, button);
      return;
    }
    const direction = button.dataset.taskAction === "forward" ? 1 : -1;
    const index = STATUS_ORDER.indexOf(task.status);
    const status = STATUS_ORDER[index + direction];
    if (status) await updateTask(task, { status }, button);
  }

  async function updateTask(task, updates, control) {
    control.disabled = true;
    try {
      const data = await window.BCCAuth.api(`/api/workspace/tasks/${encodeURIComponent(task.id)}`, {
        method: "PATCH",
        body: JSON.stringify(updates)
      });
      tasks = tasks.map(item => item.id === task.id ? data.task : item);
      setMessage("Tarea actualizada.", "ok");
      renderAll();
    } catch (error) {
      setMessage(productivityError(error), "error");
      renderAll();
    }
  }

  async function deleteTask(task, control) {
    if (!window.confirm(`Eliminar la tarea "${task.title}"?`)) return;
    control.disabled = true;
    try {
      await window.BCCAuth.api(`/api/workspace/tasks/${encodeURIComponent(task.id)}`, { method: "DELETE" });
      tasks = tasks.filter(item => item.id !== task.id);
      setMessage("Tarea eliminada.", "ok");
      renderAll();
    } catch (error) {
      setMessage(productivityError(error), "error");
      renderAll();
    }
  }

  function selectView(view) {
    activeView = view;
    root.querySelectorAll("[data-productivity-tab]").forEach(button => {
      const selected = button.dataset.productivityTab === view;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-selected", String(selected));
    });
    root.querySelectorAll("[data-productivity-panel]").forEach(panel => {
      panel.hidden = panel.dataset.productivityPanel !== view;
    });
  }

  function renderAll() {
    renderTaskList();
    renderBoard();
    renderKpis();
    selectView(activeView);
    refreshIcons();
  }

  function renderTaskList() {
    const list = root.querySelector("[data-task-list]");
    if (!list) return;
    const visible = filterTasks(tasks);
    if (!visible.length) {
      list.innerHTML = `<li class="task-empty">${tasks.length ? "No hay tareas en este filtro." : "Aun no tienes tareas. Crea la primera para iniciar tu seguimiento."}</li>`;
      return;
    }
    list.innerHTML = visible.map(task => `
      <li class="task-row ${task.status === "done" ? "complete" : ""}">
        <label class="task-check">
          <input type="checkbox" data-task-complete="${escapeHtml(task.id)}" ${task.status === "done" ? "checked" : ""} />
          <span></span>
        </label>
        <div class="task-copy">
          <strong>${escapeHtml(task.title)}</strong>
          <div>
            <span class="priority priority-${escapeHtml(task.priority)}">${escapeHtml(PRIORITY_LABELS[task.priority] || "Media")}</span>
            <span class="task-status">${escapeHtml(STATUS_LABELS[task.status] || "Pendiente")}</span>
            ${task.dueDate ? `<span class="task-date ${dueTone(task)}"><i data-lucide="calendar-clock"></i>${escapeHtml(formatDate(task.dueDate))}</span>` : ""}
          </div>
        </div>
        <button class="task-delete" type="button" data-task-action="delete" data-task-id="${escapeHtml(task.id)}" aria-label="Eliminar tarea">
          <i data-lucide="trash-2"></i>
        </button>
      </li>
    `).join("");
  }

  function renderBoard() {
    const board = root.querySelector("[data-kanban-board]");
    if (!board) return;
    board.innerHTML = STATUS_ORDER.map((status, columnIndex) => {
      const columnTasks = tasks.filter(task => task.status === status);
      return `
        <article class="kanban-column">
          <div class="kanban-column-head">
            <h3>${STATUS_LABELS[status]}</h3>
            <span>${columnTasks.length}</span>
          </div>
          <div class="kanban-cards">
            ${columnTasks.length ? columnTasks.map(task => `
              <article class="kanban-card">
                <strong>${escapeHtml(task.title)}</strong>
                <div class="kanban-meta">
                  <span class="priority priority-${escapeHtml(task.priority)}">${escapeHtml(PRIORITY_LABELS[task.priority] || "Media")}</span>
                  ${task.dueDate ? `<small class="${dueTone(task)}">${escapeHtml(formatDate(task.dueDate))}</small>` : ""}
                </div>
                <div class="kanban-actions">
                  <button type="button" data-task-action="back" data-task-id="${escapeHtml(task.id)}" ${columnIndex === 0 ? "disabled" : ""} aria-label="Mover atras">
                    <i data-lucide="arrow-left"></i>
                  </button>
                  <button type="button" data-task-action="forward" data-task-id="${escapeHtml(task.id)}" ${columnIndex === STATUS_ORDER.length - 1 ? "disabled" : ""} aria-label="Mover adelante">
                    <i data-lucide="arrow-right"></i>
                  </button>
                </div>
              </article>
            `).join("") : `<p class="kanban-empty">Sin tareas</p>`}
          </div>
        </article>
      `;
    }).join("");
  }

  function renderKpis() {
    const summary = calculateKpis(tasks);
    const compact = root.querySelector("[data-kpi-compact]");
    const reports = root.querySelector("[data-kpi-reports]");
    const bars = root.querySelector("[data-workload-bars]");
    if (compact) {
      compact.innerHTML = [
        ["Completadas", summary.completed],
        ["En curso", summary.inProgress],
        ["Vencidas", summary.overdue]
      ].map(item => `<div><span>${item[0]}</span><strong>${item[1]}</strong></div>`).join("");
    }
    root.querySelector("[data-kpi-rate]").textContent = `${summary.rate}%`;
    root.querySelector("[data-kpi-progress]").value = summary.rate;
    if (reports) {
      reports.innerHTML = [
        ["Tareas totales", summary.total, "Registro personal"],
        ["Completadas", summary.completed, `${summary.rate}% del total`],
        ["En curso", summary.inProgress, "Trabajo activo"],
        ["Vencidas", summary.overdue, summary.overdue ? "Requieren atencion" : "Sin alertas"]
      ].map(item => `<article class="report-stat"><span>${item[0]}</span><strong>${item[1]}</strong><small>${item[2]}</small></article>`).join("");
    }
    if (bars) {
      bars.innerHTML = STATUS_ORDER.map(status => {
        const count = summary.byStatus[status];
        const rate = summary.total ? Math.round((count / summary.total) * 100) : 0;
        return `<div><label><span>${STATUS_LABELS[status]}</span><strong>${count}</strong></label><progress max="100" value="${rate}"></progress></div>`;
      }).join("");
    }
  }

  function calculateKpis(entries) {
    const today = localDate();
    const byStatus = { backlog: 0, in_progress: 0, done: 0 };
    entries.forEach(task => { byStatus[task.status] = (byStatus[task.status] || 0) + 1; });
    const completed = byStatus.done || 0;
    const overdue = entries.filter(task => task.status !== "done" && task.dueDate && task.dueDate < today).length;
    return {
      total: entries.length,
      completed,
      inProgress: byStatus.in_progress || 0,
      overdue,
      rate: entries.length ? Math.round((completed / entries.length) * 100) : 0,
      byStatus
    };
  }

  function filterTasks(entries) {
    const today = localDate();
    const sevenDays = new Date();
    sevenDays.setDate(sevenDays.getDate() + 7);
    const deadline = localDate(sevenDays);
    if (activeFilter === "active") return entries.filter(task => task.status !== "done");
    if (activeFilter === "done") return entries.filter(task => task.status === "done");
    if (activeFilter === "due") return entries.filter(task => task.status !== "done" && task.dueDate && task.dueDate >= today && task.dueDate <= deadline);
    return entries;
  }

  function dueTone(task) {
    return task.status !== "done" && task.dueDate && task.dueDate < localDate() ? "overdue" : "";
  }

  function formatDate(date) {
    return window.BCCWorkspaceUtils.formatLocalDate(date);
  }

  function localDate(date = new Date()) {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function findTask(id) {
    return tasks.find(task => task.id === id);
  }

  function setMessage(message, tone = "neutral") {
    window.BCCWorkspaceUtils.setMessage(root.querySelector("[data-task-message]"), message, tone);
  }

  function toggleSubmitting(form, busy) {
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = busy;
    submit.textContent = busy ? "Guardando..." : "Crear tarea";
  }

  function productivityError(error) {
    if (/workspace_tasks|relation .* does not exist/i.test(error.message || "")) {
      return "El modulo requiere activar la tabla de tareas en Supabase.";
    }
    return error.message || "No fue posible actualizar las tareas.";
  }

  function refreshIcons() {
    window.BCCWorkspaceUtils.refreshIcons(root);
  }

  function escapeHtml(value) {
    return window.BCCWorkspaceUtils.escapeHtml(value);
  }

  window.BCCWorkspaceProductivity = { init };
})();
