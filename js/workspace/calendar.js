(() => {
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

  let root = null;
  let tasks = [];
  let loaded = false;
  let selectedDate = localDate();
  let unsubscribeTasks = null;

  function init() {
    root = document.querySelector("[data-calendar-workspace]");
    if (!root || root.dataset.ready === "true") return;
    root.dataset.ready = "true";
    root.innerHTML = template();
    bindControls();
    subscribeToTasks();
    render();
  }

  function template() {
    return `
      <div class="calendar-head">
        <div>
          <span class="workspace-eyebrow">Calendario operativo</span>
          <h2>Semana de trabajo</h2>
          <p>Vencimientos, prioridades y tareas por dia usando tu tablero actual.</p>
        </div>
        <button class="btn btn-ghost calendar-task-link" type="button" data-calendar-open-tasks>
          <i data-lucide="list-checks"></i>Gestionar tareas
        </button>
      </div>
      <div class="calendar-summary" data-calendar-summary></div>
      <div class="calendar-layout">
        <section class="calendar-main" aria-label="Semana operativa">
          <div class="calendar-section-head">
            <div>
              <h3>Esta semana</h3>
              <p>Selecciona un dia para ver sus tareas.</p>
            </div>
            <span data-calendar-range></span>
          </div>
          <div class="calendar-week" data-calendar-week></div>
          <div class="calendar-day-panel">
            <div class="calendar-section-head compact">
              <div>
                <h3 data-calendar-day-title>Hoy</h3>
                <p data-calendar-day-subtitle></p>
              </div>
              <span class="status-dot" data-calendar-day-count>0 tareas</span>
            </div>
            <div class="calendar-task-list" data-calendar-day-list></div>
          </div>
        </section>
        <aside class="calendar-side" aria-label="Alertas de calendario">
          <section>
            <div class="calendar-section-head compact">
              <h3>Vencidas</h3>
              <span data-calendar-overdue-count>0</span>
            </div>
            <div class="calendar-task-list compact" data-calendar-overdue></div>
          </section>
          <section>
            <div class="calendar-section-head compact">
              <h3>Proximas</h3>
              <span data-calendar-upcoming-count>0</span>
            </div>
            <div class="calendar-task-list compact" data-calendar-upcoming></div>
          </section>
          <section>
            <div class="calendar-section-head compact">
              <h3>Sin fecha</h3>
              <span data-calendar-floating-count>0</span>
            </div>
            <div class="calendar-task-list compact" data-calendar-floating></div>
          </section>
        </aside>
      </div>
    `;
  }

  function bindControls() {
    root.addEventListener("click", event => {
      const dayButton = event.target.closest("[data-calendar-day]");
      if (dayButton) {
        selectedDate = dayButton.dataset.calendarDay;
        render();
        return;
      }

      const taskLink = event.target.closest("[data-calendar-open-tasks], [data-calendar-task-row]");
      if (taskLink) {
        event.preventDefault();
        openTasksPanel();
      }
    });
  }

  function subscribeToTasks() {
    if (window.BCCWorkspaceProductivity?.subscribeTasks) {
      unsubscribeTasks?.();
      unsubscribeTasks = window.BCCWorkspaceProductivity.subscribeTasks((nextTasks, meta = {}) => {
        tasks = Array.isArray(nextTasks) ? nextTasks : [];
        loaded = Boolean(meta.loaded);
        render();
      });
      return;
    }

    document.addEventListener("bcc:workspace-tasks", event => {
      tasks = Array.isArray(event.detail?.tasks) ? event.detail.tasks : [];
      loaded = Boolean(event.detail?.loaded);
      render();
    });
  }

  function render() {
    if (!root) return;
    if (!loaded) {
      renderLoading();
      refreshIcons();
      return;
    }

    renderSummary();
    renderWeek();
    renderSelectedDay();
    renderSideLists();
    refreshIcons();
  }

  function renderLoading() {
    const list = root.querySelector("[data-calendar-day-list]");
    if (list) list.innerHTML = `<div class="calendar-empty">Cargando calendario...</div>`;
  }

  function renderSummary() {
    const today = localDate();
    const weekEnd = addDays(today, 6);
    const active = tasks.filter(task => task.status !== "done");
    const dueToday = active.filter(task => task.dueDate === today).length;
    const overdue = active.filter(task => task.dueDate && task.dueDate < today).length;
    const week = active.filter(task => task.dueDate && task.dueDate >= today && task.dueDate <= weekEnd).length;
    const floating = active.filter(task => !task.dueDate).length;
    const summary = root.querySelector("[data-calendar-summary]");
    if (!summary) return;
    summary.innerHTML = [
      ["Hoy", dueToday, "Vencen hoy"],
      ["Semana", week, "Proximos 7 dias"],
      ["Vencidas", overdue, overdue ? "Requieren atencion" : "Sin alertas"],
      ["Sin fecha", floating, "Por planificar"]
    ].map(item => `
      <article>
        <span>${item[0]}</span>
        <strong>${item[1]}</strong>
        <small>${item[2]}</small>
      </article>
    `).join("");
  }

  function renderWeek() {
    const week = weekDays();
    const weekRoot = root.querySelector("[data-calendar-week]");
    const range = root.querySelector("[data-calendar-range]");
    if (range) range.textContent = `${formatShortDate(week[0])} - ${formatShortDate(week[week.length - 1])}`;
    if (!weekRoot) return;
    weekRoot.innerHTML = week.map(day => {
      const dayTasks = tasksForDay(day).filter(task => task.status !== "done");
      const high = dayTasks.some(task => task.priority === "high");
      const selected = day === selectedDate;
      const today = day === localDate();
      return `
        <button class="calendar-day ${selected ? "active" : ""} ${today ? "today" : ""}" type="button" data-calendar-day="${escapeHtml(day)}" aria-pressed="${selected ? "true" : "false"}">
          <span>${formatWeekday(day)}</span>
          <strong>${formatDayNumber(day)}</strong>
          <small>${dayTasks.length || "-"}</small>
          ${high ? `<i aria-hidden="true"></i>` : ""}
        </button>
      `;
    }).join("");
  }

  function renderSelectedDay() {
    const dayTasks = sortTasks(tasksForDay(selectedDate));
    window.BCCWorkspaceUtils.setText(root.querySelector("[data-calendar-day-title]"), selectedDate === localDate() ? "Hoy" : formatLongDate(selectedDate));
    window.BCCWorkspaceUtils.setText(root.querySelector("[data-calendar-day-subtitle]"), selectedDate === localDate() ? "Tareas con vencimiento para hoy." : "Tareas planificadas para este dia.");
    window.BCCWorkspaceUtils.setText(root.querySelector("[data-calendar-day-count]"), `${dayTasks.length} ${dayTasks.length === 1 ? "tarea" : "tareas"}`);
    renderTaskList(root.querySelector("[data-calendar-day-list]"), dayTasks, "No hay tareas con fecha para este dia.");
  }

  function renderSideLists() {
    const today = localDate();
    const active = tasks.filter(task => task.status !== "done");
    const overdue = sortTasks(active.filter(task => task.dueDate && task.dueDate < today)).slice(0, 4);
    const upcoming = sortTasks(active.filter(task => task.dueDate && task.dueDate >= today)).slice(0, 5);
    const floating = sortTasks(active.filter(task => !task.dueDate)).slice(0, 4);

    window.BCCWorkspaceUtils.setText(root.querySelector("[data-calendar-overdue-count]"), String(overdue.length));
    window.BCCWorkspaceUtils.setText(root.querySelector("[data-calendar-upcoming-count]"), String(upcoming.length));
    window.BCCWorkspaceUtils.setText(root.querySelector("[data-calendar-floating-count]"), String(floating.length));
    renderTaskList(root.querySelector("[data-calendar-overdue]"), overdue, "Sin tareas vencidas.");
    renderTaskList(root.querySelector("[data-calendar-upcoming]"), upcoming, "Sin proximos vencimientos.");
    renderTaskList(root.querySelector("[data-calendar-floating]"), floating, "Nada por planificar.");
  }

  function renderTaskList(container, entries, emptyText) {
    if (!container) return;
    if (!entries.length) {
      container.innerHTML = `<div class="calendar-empty">${escapeHtml(emptyText)}</div>`;
      return;
    }
    container.innerHTML = entries.map(task => `
      <a class="calendar-task ${task.status === "done" ? "complete" : ""}" href="#trabajo" data-calendar-task-row data-workspace-searchable>
        <span class="calendar-priority priority-${escapeHtml(task.priority || "medium")}">${escapeHtml(PRIORITY_LABELS[task.priority] || "Media")}</span>
        <strong>${escapeHtml(task.title)}</strong>
        <small>${escapeHtml(taskMeta(task))}</small>
      </a>
    `).join("");
  }

  function taskMeta(task) {
    const status = STATUS_LABELS[task.status] || "Pendiente";
    if (!task.dueDate) return `${status} - Sin fecha`;
    return `${status} - ${formatShortDate(task.dueDate)}`;
  }

  function openTasksPanel() {
    document.querySelector('[data-work-panel-tab="tareas"]')?.click();
    if (window.location.hash !== "#trabajo") window.history.pushState(null, "", "#trabajo");
  }

  function tasksForDay(day) {
    return tasks.filter(task => task.dueDate === day);
  }

  function sortTasks(entries) {
    const priorityRank = { high: 0, medium: 1, low: 2 };
    return entries.slice().sort((a, b) => {
      const dateA = a.dueDate || "9999-12-31";
      const dateB = b.dueDate || "9999-12-31";
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      return (priorityRank[a.priority] ?? 1) - (priorityRank[b.priority] ?? 1);
    });
  }

  function weekDays() {
    const today = localDate();
    return Array.from({ length: 7 }, (_, index) => addDays(today, index));
  }

  function addDays(date, days) {
    const next = parseLocalDate(date);
    next.setDate(next.getDate() + days);
    return localDate(next);
  }

  function parseLocalDate(value) {
    const [year, month, day] = String(value).split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  function localDate(date = new Date()) {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function formatWeekday(date) {
    return parseLocalDate(date).toLocaleDateString("es", { weekday: "short" }).replace(".", "");
  }

  function formatDayNumber(date) {
    return String(parseLocalDate(date).getDate()).padStart(2, "0");
  }

  function formatShortDate(date) {
    return parseLocalDate(date).toLocaleDateString("es", { day: "2-digit", month: "short" }).replace(".", "");
  }

  function formatLongDate(date) {
    return parseLocalDate(date).toLocaleDateString("es", { weekday: "long", day: "2-digit", month: "long" });
  }

  function refreshIcons() {
    window.BCCWorkspaceUtils.refreshIcons(root);
  }

  function escapeHtml(value) {
    return window.BCCWorkspaceUtils.escapeHtml(value);
  }

  window.BCCWorkspaceCalendar = { init };
})();
