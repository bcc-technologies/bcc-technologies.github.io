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
  const EVENT_TYPE_LABELS = {
    meeting: "Reunion",
    call: "Llamada",
    milestone: "Hito",
    blocker: "Bloqueo",
    reminder: "Recordatorio",
    availability: "Disponibilidad",
    review: "Revision"
  };
  const EVENT_VISIBILITY_LABELS = {
    private: "Privado",
    team: "Equipo",
    client: "Cliente"
  };

  let root = null;
  let tasks = [];
  let events = [];
  let loaded = false;
  let eventsLoaded = false;
  let selectedDate = localDate();
  let editingEventId = null;
  let unsubscribeTasks = null;

  function init() {
    root = document.querySelector("[data-calendar-workspace]");
    if (!root || root.dataset.ready === "true") return;
    root.dataset.ready = "true";
    root.innerHTML = template();
    bindControls();
    subscribeToTasks();
    render();
    loadEvents();
  }

  function template() {
    return `
      <div class="calendar-head">
        <div>
          <span class="workspace-eyebrow">Calendario operativo</span>
          <h2>Agenda de trabajo</h2>
          <p>Eventos, reuniones y tareas con fecha en una agenda operativa.</p>
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
              <p>Selecciona un dia para revisar agenda y tareas.</p>
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
              <span class="status-dot" data-calendar-day-count>0 items</span>
              <div class="calendar-create-actions" aria-label="Crear en calendario">
                <button class="btn btn-ghost calendar-add-task" type="button" data-calendar-create-task>
                  <i data-lucide="list-plus"></i>Tarea
                </button>
                <button class="btn btn-primary calendar-add-task" type="button" data-calendar-create-event>
                  <i data-lucide="calendar-plus"></i>Evento
                </button>
              </div>
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
              <h3>Proximos</h3>
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
      <dialog class="calendar-event-dialog" data-calendar-event-dialog>
        <form class="calendar-event-form" data-calendar-event-form>
          <div class="calendar-event-head">
            <div>
              <h2 data-calendar-event-title>Nuevo evento</h2>
              <p>Agrega una reunion, hito, llamada o recordatorio a la agenda.</p>
            </div>
            <button class="icon-close" type="button" data-calendar-event-close aria-label="Cerrar">
              <i data-lucide="x"></i>
            </button>
          </div>
          <label>
            Titulo
            <input type="text" name="title" maxlength="160" required placeholder="Nombre del evento" />
          </label>
          <div class="calendar-event-row">
            <label>
              Tipo
              <select name="type">
                <option value="meeting">Reunion</option>
                <option value="call">Llamada</option>
                <option value="milestone">Hito</option>
                <option value="blocker">Bloqueo</option>
                <option value="reminder">Recordatorio</option>
                <option value="availability">Disponibilidad</option>
                <option value="review">Revision</option>
              </select>
            </label>
            <label>
              Fecha
              <input type="date" name="date" required />
            </label>
          </div>
          <div class="calendar-event-row triple">
            <label>
              Inicio
              <input type="time" name="startTime" />
            </label>
            <label>
              Cierre
              <input type="time" name="endTime" />
            </label>
            <label>
              Visibilidad
              <select name="visibility">
                <option value="private">Privado</option>
                <option value="team">Equipo</option>
                <option value="client">Cliente</option>
              </select>
            </label>
          </div>
          <label>
            Ubicacion o enlace
            <input type="text" name="location" maxlength="180" placeholder="Sala, lugar o contexto" />
          </label>
          <label>
            Link
            <input type="url" name="link" maxlength="300" placeholder="https://..." />
          </label>
          <label>
            Detalle
            <textarea name="description" maxlength="700" rows="3" placeholder="Notas opcionales"></textarea>
          </label>
          <p class="calendar-event-message" data-calendar-event-message hidden></p>
          <div class="calendar-event-actions">
            <button class="btn btn-danger calendar-event-delete" type="button" data-calendar-event-delete hidden>Eliminar</button>
            <span></span>
            <button class="btn btn-ghost" type="button" data-calendar-event-close>Cancelar</button>
            <button class="btn btn-primary" type="submit" data-calendar-event-submit>Crear evento</button>
          </div>
        </form>
      </dialog>
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

      const createTask = event.target.closest("[data-calendar-create-task]");
      if (createTask) {
        event.preventDefault();
        window.BCCWorkspaceProductivity?.openNewTask?.({ dueDate: selectedDate });
        return;
      }

      const createEvent = event.target.closest("[data-calendar-create-event]");
      if (createEvent) {
        event.preventDefault();
        openEventDialog(null, { date: selectedDate });
        return;
      }

      const editEvent = event.target.closest("[data-calendar-edit-event]");
      if (editEvent) {
        event.preventDefault();
        openEventDialog(findEvent(editEvent.dataset.eventId));
        return;
      }

      const deleteEventButton = event.target.closest("[data-calendar-event-delete]");
      if (deleteEventButton) {
        event.preventDefault();
        deleteEvent();
        return;
      }

      const editTask = event.target.closest("[data-calendar-edit-task]");
      if (editTask) {
        event.preventDefault();
        window.BCCWorkspaceProductivity?.openTaskEditor?.(editTask.dataset.taskId);
        return;
      }

      const taskLink = event.target.closest("[data-calendar-open-tasks], [data-calendar-task-row]");
      if (taskLink) {
        event.preventDefault();
        openTasksPanel();
      }
    });
    root.querySelector("[data-calendar-event-form]")?.addEventListener("submit", saveEvent);
    root.querySelectorAll("[data-calendar-event-close]").forEach(button => {
      button.addEventListener("click", closeEventDialog);
    });
  }


  async function loadEvents() {
    try {
      const data = await window.BCCAuth.api("/api/workspace/events");
      events = Array.isArray(data.events) ? data.events : [];
      eventsLoaded = true;
      render();
    } catch (error) {
      eventsLoaded = true;
      setEventMessage(calendarError(error), "error");
      render();
    }
  }

  function openEventDialog(event = null, defaults = {}) {
    const dialog = root.querySelector("[data-calendar-event-dialog]");
    const form = root.querySelector("[data-calendar-event-form]");
    editingEventId = event?.id || null;
    form?.reset();
    if (form && event) {
      form.elements.title.value = event.title || "";
      form.elements.type.value = event.type || "meeting";
      form.elements.date.value = event.date || localDate();
      form.elements.startTime.value = event.startTime || "";
      form.elements.endTime.value = event.endTime || "";
      form.elements.visibility.value = event.visibility || "private";
      form.elements.location.value = event.location || "";
      form.elements.link.value = event.link || "";
      form.elements.description.value = event.description || "";
    } else if (form) {
      form.elements.date.value = defaults.date || selectedDate;
      form.elements.type.value = "meeting";
      form.elements.visibility.value = "private";
    }
    root.querySelector("[data-calendar-event-title]").textContent = event ? "Editar evento" : "Nuevo evento";
    root.querySelector("[data-calendar-event-submit]").textContent = event ? "Guardar cambios" : "Crear evento";
    const deleteButton = root.querySelector("[data-calendar-event-delete]");
    if (deleteButton) deleteButton.hidden = !event;
    setEventMessage("");
    dialog?.showModal();
    form?.elements.title.focus();
  }

  function closeEventDialog() {
    editingEventId = null;
    root.querySelector("[data-calendar-event-dialog]")?.close();
  }

  async function saveEvent(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const currentEventId = editingEventId;
    const payload = {
      title: String(form.elements.title.value || "").trim(),
      type: form.elements.type.value,
      date: form.elements.date.value,
      startTime: form.elements.startTime.value || null,
      endTime: form.elements.endTime.value || null,
      visibility: form.elements.visibility.value,
      location: String(form.elements.location.value || "").trim(),
      link: String(form.elements.link.value || "").trim(),
      description: String(form.elements.description.value || "").trim()
    };
    const submit = form.querySelector("[data-calendar-event-submit]");
    submit.disabled = true;
    submit.textContent = "Guardando...";
    try {
      const data = await window.BCCAuth.api(currentEventId ? `/api/workspace/events/${encodeURIComponent(currentEventId)}` : "/api/workspace/events", {
        method: currentEventId ? "PATCH" : "POST",
        body: JSON.stringify(payload)
      });
      if (currentEventId) {
        events = events.map(item => item.id === currentEventId ? data.event : item);
      } else {
        events.push(data.event);
      }
      editingEventId = null;
      closeEventDialog();
      render();
    } catch (error) {
      setEventMessage(calendarError(error), "error");
    } finally {
      submit.disabled = false;
      submit.textContent = currentEventId ? "Guardar cambios" : "Crear evento";
    }
  }

  async function deleteEvent() {
    const currentEventId = editingEventId;
    if (!currentEventId) return;
    const button = root.querySelector("[data-calendar-event-delete]");
    button.disabled = true;
    try {
      await window.BCCAuth.api(`/api/workspace/events/${encodeURIComponent(currentEventId)}`, { method: "DELETE" });
      events = events.filter(event => event.id !== currentEventId);
      editingEventId = null;
      closeEventDialog();
      render();
    } catch (error) {
      setEventMessage(calendarError(error), "error");
    } finally {
      button.disabled = false;
    }
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
    if (!loaded || !eventsLoaded) {
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
    const todayEvents = events.filter(event => event.date === today).length;
    const weekEvents = events.filter(event => event.date >= today && event.date <= weekEnd).length;
    const dueToday = active.filter(task => task.dueDate === today).length;
    const overdue = active.filter(task => task.dueDate && task.dueDate < today).length;
    const week = active.filter(task => task.dueDate && task.dueDate >= today && task.dueDate <= weekEnd).length;
    const floating = active.filter(task => !task.dueDate).length;
    const summary = root.querySelector("[data-calendar-summary]");
    if (!summary) return;
    summary.innerHTML = [
      ["Agenda hoy", todayEvents, `${dueToday} tareas`],
      ["Semana", weekEvents, `${week} tareas`],
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
      const dayEvents = eventsForDay(day);
      const high = dayTasks.some(task => task.priority === "high") || dayEvents.some(event => event.type === "blocker");
      const selected = day === selectedDate;
      const today = day === localDate();
      return `
        <button class="calendar-day ${selected ? "active" : ""} ${today ? "today" : ""}" type="button" data-calendar-day="${escapeHtml(day)}" aria-pressed="${selected ? "true" : "false"}">
          <span>${formatWeekday(day)}</span>
          <strong>${formatDayNumber(day)}</strong>
          <small>${dayEvents.length}/${dayTasks.length}</small>
          ${high ? `<i aria-hidden="true"></i>` : ""}
        </button>
      `;
    }).join("");
  }

  function renderSelectedDay() {
    const dayTasks = sortTasks(tasksForDay(selectedDate));
    const dayEvents = sortEvents(eventsForDay(selectedDate));
    const total = dayTasks.length + dayEvents.length;
    window.BCCWorkspaceUtils.setText(root.querySelector("[data-calendar-day-title]"), selectedDate === localDate() ? "Hoy" : formatLongDate(selectedDate));
    window.BCCWorkspaceUtils.setText(root.querySelector("[data-calendar-day-subtitle]"), selectedDate === localDate() ? "Agenda y vencimientos para hoy." : "Agenda y tareas planificadas para este dia.");
    window.BCCWorkspaceUtils.setText(root.querySelector("[data-calendar-day-count]"), `${total} ${total === 1 ? "item" : "items"}`);
    renderDayAgenda(root.querySelector("[data-calendar-day-list]"), dayEvents, dayTasks);
  }

  function renderSideLists() {
    const today = localDate();
    const active = tasks.filter(task => task.status !== "done");
    const overdue = sortTasks(active.filter(task => task.dueDate && task.dueDate < today)).slice(0, 4);
    const upcoming = sortEvents(events.filter(event => event.date >= today)).slice(0, 5);
    const floating = sortTasks(active.filter(task => !task.dueDate)).slice(0, 4);

    window.BCCWorkspaceUtils.setText(root.querySelector("[data-calendar-overdue-count]"), String(overdue.length));
    window.BCCWorkspaceUtils.setText(root.querySelector("[data-calendar-upcoming-count]"), String(upcoming.length));
    window.BCCWorkspaceUtils.setText(root.querySelector("[data-calendar-floating-count]"), String(floating.length));
    renderTaskList(root.querySelector("[data-calendar-overdue]"), overdue, "Sin tareas vencidas.");
    renderEventList(root.querySelector("[data-calendar-upcoming]"), upcoming, "Sin eventos proximos.");
    renderTaskList(root.querySelector("[data-calendar-floating]"), floating, "Nada por planificar.");
  }

  function renderDayAgenda(container, dayEvents, dayTasks) {
    if (!container) return;
    container.innerHTML = `
      <section class="calendar-agenda-block">
        <div class="calendar-subhead"><h4>Agenda</h4><span>${dayEvents.length}</span></div>
        <div class="calendar-event-list">${dayEvents.length ? eventCards(dayEvents) : `<div class="calendar-empty">No hay eventos para este dia.</div>`}</div>
      </section>
      <section class="calendar-agenda-block">
        <div class="calendar-subhead"><h4>Tareas con fecha</h4><span>${dayTasks.length}</span></div>
        <div class="calendar-task-list compact">${dayTasks.length ? taskCards(dayTasks) : `<div class="calendar-empty">No hay tareas con fecha para este dia.</div>`}</div>
      </section>
    `;
  }

  function renderEventList(container, entries, emptyText) {
    if (!container) return;
    if (!entries.length) {
      container.innerHTML = `<div class="calendar-empty">${escapeHtml(emptyText)}</div>`;
      return;
    }
    container.innerHTML = eventCards(entries);
  }

  function renderTaskList(container, entries, emptyText) {
    if (!container) return;
    if (!entries.length) {
      container.innerHTML = `<div class="calendar-empty">${escapeHtml(emptyText)}</div>`;
      return;
    }
    container.innerHTML = taskCards(entries);
  }

  function taskCards(entries) {
    return entries.map(task => `
      <button class="calendar-task ${task.status === "done" ? "complete" : ""}" type="button" data-calendar-edit-task data-task-id="${escapeHtml(task.id)}" data-workspace-searchable>
        <span class="calendar-priority priority-${escapeHtml(task.priority || "medium")}">${escapeHtml(PRIORITY_LABELS[task.priority] || "Media")}</span>
        <strong>${escapeHtml(task.title)}</strong>
        <small>${escapeHtml(taskMeta(task))}</small>
        <i data-lucide="pencil" aria-hidden="true"></i>
      </button>
    `).join("");
  }

  function eventCards(entries) {
    return entries.map(event => `
      <button class="calendar-event calendar-event-${escapeAttr(event.type || "meeting")}" type="button" data-calendar-edit-event data-event-id="${escapeAttr(event.id)}" data-workspace-searchable>
        <span class="calendar-event-type">${escapeHtml(EVENT_TYPE_LABELS[event.type] || "Evento")}</span>
        <strong>${escapeHtml(event.title)}</strong>
        <small>${escapeHtml(eventMeta(event))}</small>
        <i data-lucide="calendar-clock" aria-hidden="true"></i>
      </button>
    `).join("");
  }

  function eventMeta(event) {
    const time = event.startTime ? `${event.startTime}${event.endTime ? ` - ${event.endTime}` : ""}` : "Sin hora";
    const place = event.location || event.link || EVENT_VISIBILITY_LABELS[event.visibility] || "Privado";
    return `${time} - ${place}`;
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

  function eventsForDay(day) {
    return events.filter(event => event.date === day);
  }

  function findEvent(id) {
    return events.find(event => event.id === id) || null;
  }

  function sortEvents(entries) {
    return entries.slice().sort((a, b) => {
      const timeA = a.startTime || "99:99";
      const timeB = b.startTime || "99:99";
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      if (timeA !== timeB) return timeA.localeCompare(timeB);
      return a.title.localeCompare(b.title);
    });
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

  function setEventMessage(message, tone = "neutral") {
    window.BCCWorkspaceUtils.setMessage(root.querySelector("[data-calendar-event-message]"), message, tone);
  }

  function calendarError(error) {
    if (/workspace_events|relation .* does not exist/i.test(error.message || "")) {
      return "El calendario requiere activar la tabla de eventos en Supabase.";
    }
    return error.message || "No fue posible actualizar el calendario.";
  }

  function refreshIcons() {
    window.BCCWorkspaceUtils.refreshIcons(root);
  }

  function escapeHtml(value) {
    return window.BCCWorkspaceUtils.escapeHtml(value);
  }

  function escapeAttr(value) {
    return window.BCCWorkspaceUtils.escapeAttr(value);
  }

  window.BCCWorkspaceCalendar = { init };
})();
