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
  let tasksLoaded = false;
  const taskSubscribers = new Set();
  let activeFilter = "all";
  let activeSort = "smart";
  let activeView = "tasks";
  let editingTaskId = null;
  let messageTimer = null;
  let root = null;

  async function init(user) {
    root = document.querySelector("[data-productivity-workspace]");
    if (!root || root.dataset.ready === "true") return;
    root.dataset.ready = "true";
    root.innerHTML = template(user);
    bindControls();
    moveTaskDialog();
    renderAll();
    refreshIcons();
    await loadTasks();
  }

  function template() {
    return `
      <div class="productivity-head">
        <div>
          <h2>Tareas</h2>
          <p>Tareas privadas, avance visual y reportes basados en tu actividad.</p>
          <p class="productivity-message" data-task-message hidden></p>
        </div>
        <button class="btn btn-primary productivity-new" type="button" data-task-new>
          <i data-lucide="plus"></i>Nueva tarea
        </button>
      </div>
      <div class="productivity-tabs" role="tablist" aria-label="Vistas de tareas">
        <button class="active" type="button" role="tab" aria-selected="true" data-productivity-tab="tasks">
          <i data-lucide="list-checks"></i>Lista
        </button>
        <button type="button" role="tab" aria-selected="false" data-productivity-tab="board">
          <i data-lucide="columns-3"></i>Tablero
        </button>
        <button type="button" role="tab" aria-selected="false" data-productivity-tab="matrix">
          <i data-lucide="layout-grid"></i>Matriz
        </button>
      </div>
      <section class="productivity-panel productivity-overview" data-productivity-panel="tasks">
        <article class="productivity-surface">
          <div class="productivity-toolbar">
            <h3>Mis tareas</h3>
            <div class="productivity-list-controls">
              <label>
                <span>Filtro</span>
                <select data-task-filter>
                  <option value="all">Todas</option>
                  <option value="active">Activas</option>
                  <option value="due">Por vencer</option>
                  <option value="done">Completadas</option>
                </select>
              </label>
              <label>
                <span>Orden</span>
                <select data-task-sort>
                  <option value="smart">Activas primero</option>
                  <option value="due">Fecha limite</option>
                  <option value="importance">Importancia</option>
                  <option value="urgency">Urgencia</option>
                  <option value="newest">Mas recientes</option>
                  <option value="title">Titulo</option>
                  <option value="done_first">Completadas primero</option>
                </select>
              </label>
            </div>
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
      <section class="productivity-panel productivity-matrix" data-productivity-panel="matrix" hidden>
        <div class="eisenhower-mount" data-eisenhower-matrix></div>
      </section>
      <dialog class="task-dialog" data-task-dialog>
        <form class="task-form" data-task-form>
          <div class="task-dialog-head">
            <div>
              <h2 data-task-dialog-title>Nueva tarea</h2>
              <p data-task-dialog-copy>Agrega una actividad a tu tablero privado.</p>
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
            <div class="task-slider-control">
              <label for="task-importance">Importancia <strong data-importance-output>3</strong></label>
              <input id="task-importance" type="range" name="importance" min="1" max="5" value="3" />
            </div>
            <div class="task-slider-control">
              <label for="task-urgency">Urgencia <strong data-urgency-output>3</strong></label>
              <input id="task-urgency" type="range" name="urgency" min="1" max="5" value="3" />
            </div>
          </div>
          <div class="task-form-row task-form-row-date">
            <label>
              Fecha limite
              <input type="date" name="dueDate" />
            </label>
            <p class="task-derived-priority" data-derived-priority>Prioridad derivada: Media</p>
          </div>
          <label>
            Detalle
            <textarea name="description" maxlength="500" rows="3" placeholder="Notas opcionales"></textarea>
          </label>
          <div class="task-dialog-actions">
            <button class="btn btn-ghost" type="button" data-task-close>Cancelar</button>
            <button class="btn btn-primary" type="submit" data-task-submit>Crear tarea</button>
          </div>
        </form>
      </dialog>
    `;
  }

  function bindControls() {
    root.querySelector("[data-task-new]")?.addEventListener("click", () => openTaskDialog());
    root.querySelectorAll("[data-task-close]").forEach(button => {
      button.addEventListener("click", closeTaskDialog);
    });
    document.querySelector("[data-task-form]")?.addEventListener("submit", createTask);
    root.querySelectorAll("[name=importance], [name=urgency]").forEach(input => {
      input.addEventListener("input", syncTaskPriorityPreview);
    });
    root.querySelector("[data-task-filter]")?.addEventListener("change", event => {
      activeFilter = event.target.value;
      renderTaskList();
    });
    root.querySelector("[data-task-sort]")?.addEventListener("change", event => {
      activeSort = event.target.value;
      renderTaskList();
    });
    root.querySelectorAll("[data-productivity-tab]").forEach(button => {
      button.addEventListener("click", () => selectView(button.dataset.productivityTab));
    });
    root.addEventListener("click", handleTaskAction);
    root.addEventListener("change", handleTaskToggle);
  }

  function moveTaskDialog() {
    const dialog = document.querySelector("[data-task-dialog]");
    if (dialog && dialog.parentElement !== document.body) document.body.append(dialog);
  }

  async function loadTasks() {
    setMessage("Cargando tareas...", "neutral");
    try {
      const data = await window.BCCAuth.api("/api/workspace/tasks");
      tasks = Array.isArray(data.tasks) ? data.tasks : [];
      tasksLoaded = true;
      setMessage("");
      renderAll();
      notifyTasksChanged();
    } catch (error) {
      setMessage(productivityError(error), "error");
      tasksLoaded = true;
      renderAll();
      notifyTasksChanged();
    }
  }

  function closeTaskDialog() {
    editingTaskId = null;
    document.querySelector("[data-task-dialog]")?.close();
  }

  function openTaskDialog(task = null, defaults = {}) {
    const dialog = document.querySelector("[data-task-dialog]");
    const form = document.querySelector("[data-task-form]");
    editingTaskId = task?.id || null;
    form?.reset();
    if (form && task) {
      form.elements.title.value = task.title || "";
      form.elements.description.value = task.description || "";
      form.elements.dueDate.value = task.dueDate || "";
      const sliderValues = taskSliderValues(task);
      form.elements.importance.value = sliderValues.importance;
      form.elements.urgency.value = sliderValues.urgency;
    } else if (form && defaults?.dueDate) {
      form.elements.dueDate.value = defaults.dueDate;
    }
    document.querySelector("[data-task-dialog-title]").textContent = task ? "Editar tarea" : "Nueva tarea";
    document.querySelector("[data-task-dialog-copy]").textContent = task ? "Actualiza la actividad sin perder su estado actual." : "Agrega una actividad a tu tablero privado.";
    document.querySelector("[data-task-submit]").textContent = task ? "Guardar cambios" : "Crear tarea";
    syncTaskPriorityPreview();
    dialog?.showModal();
    form?.elements.title.focus();
  }

  async function createTask(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const title = String(form.elements.title.value || "").trim();
    if (!title) return;
    const currentEditingTaskId = editingTaskId;
    toggleSubmitting(form, true);
    try {
      const payload = {
        title,
        priority: derivePriority(form.elements.importance.value, form.elements.urgency.value),
        importance: Number(form.elements.importance.value || 3),
        urgency: Number(form.elements.urgency.value || 3),
        dueDate: form.elements.dueDate.value || null,
        description: String(form.elements.description.value || "").trim()
      };
      const data = await window.BCCAuth.api(currentEditingTaskId ? `/api/workspace/tasks/${encodeURIComponent(currentEditingTaskId)}` : "/api/workspace/tasks", {
        method: currentEditingTaskId ? "PATCH" : "POST",
        body: JSON.stringify(payload)
      });
      if (currentEditingTaskId) {
        tasks = tasks.map(item => item.id === currentEditingTaskId ? data.task : item);
      } else {
        tasks.unshift(data.task);
      }
      editingTaskId = null;
      document.querySelector("[data-task-dialog]")?.close();
      setMessage(currentEditingTaskId ? "Tarea actualizada." : "Tarea creada.", "ok");
      renderAll();
      notifyTasksChanged();
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
    if (button.dataset.taskAction === "edit") {
      openTaskDialog(task);
      return;
    }
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
      notifyTasksChanged();
    } catch (error) {
      setMessage(productivityError(error), "error");
      renderAll();
      notifyTasksChanged();
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
      notifyTasksChanged();
    } catch (error) {
      setMessage(productivityError(error), "error");
      renderAll();
      notifyTasksChanged();
    }
  }

  function selectView(view) {
    if (view === "matrix") clearTaskMessage();
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
    renderMatrix();
    renderKpis();
    selectView(activeView);
    refreshIcons();
  }

  function renderTaskList() {
    const list = root.querySelector("[data-task-list]");
    if (!list) return;
    const visible = sortTasksForList(filterTasks(tasks));
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
        <div class="task-actions">
          <button class="task-icon-action" type="button" data-task-action="edit" data-task-id="${escapeHtml(task.id)}" aria-label="Editar tarea">
            <i data-lucide="pencil"></i>
          </button>
          <button class="task-icon-action task-delete" type="button" data-task-action="delete" data-task-id="${escapeHtml(task.id)}" aria-label="Eliminar tarea">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
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
                  <button type="button" data-task-action="edit" data-task-id="${escapeHtml(task.id)}" aria-label="Editar tarea">
                    <i data-lucide="pencil"></i>
                  </button>
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

  function renderMatrix() {
    const matrix = root.querySelector("[data-eisenhower-matrix]");
    if (!matrix) return;
    const quadrants = eisenhowerQuadrants();
    matrix.innerHTML = `
      <section class="eisenhower-shell" aria-label="Matriz de Eisenhower por importancia y urgencia">
        <div class="matrix-axis matrix-axis-urgency" aria-hidden="true"><span>Urgencia</span><i></i></div>
        <div class="matrix-axis matrix-axis-importance" aria-hidden="true"><span>Importancia</span><i></i></div>
        <div class="eisenhower-grid">
          ${quadrants.map(quadrant => `
            <article class="eisenhower-quadrant ${quadrant.tone}" data-matrix-quadrant="${escapeAttr(quadrant.key)}" aria-label="${escapeAttr(quadrant.title)}">
              <div class="matrix-quadrant-action">
                <strong>${escapeHtml(quadrant.title)}</strong>
                <span>${escapeHtml(quadrant.action)}</span>
              </div>
              <div class="matrix-task-list">
                ${quadrant.tasks.length ? quadrant.tasks.map(task => matrixTaskCard(task, quadrant)).join("") : `<p class="matrix-empty">Sin tareas activas</p>`}
              </div>
            </article>
          `).join("")}
        </div>
      </section>
    `;
  }

  function matrixTaskCard(task, quadrant) {
    return `
      <article class="matrix-task">
        <div class="matrix-task-copy">
          <strong>${escapeHtml(task.title)}</strong>
          <div>
            <span class="priority priority-${escapeHtml(task.priority)}">${escapeHtml(PRIORITY_LABELS[task.priority] || "Media")}</span>
            <span class="matrix-action-tag">${escapeHtml(quadrant.title)}</span>
            ${task.dueDate ? `<small class="${dueTone(task)}">${escapeHtml(formatDate(task.dueDate))}</small>` : `<small>Sin fecha</small>`}
          </div>
        </div>
        <button class="task-icon-action" type="button" data-task-action="edit" data-task-id="${escapeHtml(task.id)}" aria-label="Editar tarea">
          <i data-lucide="pencil"></i>
        </button>
      </article>
    `;
  }

  function eisenhowerQuadrants() {
    const quadrants = [
      { key: "plan", title: "Planificar", action: "Agendar foco antes de que escale", tone: "matrix-plan", tasks: [] },
      { key: "do", title: "Hacer ahora", action: "Resolver primero", tone: "matrix-do", tasks: [] },
      { key: "pause", title: "Pausar", action: "Eliminar, archivar o dejar en espera", tone: "matrix-pause", tasks: [] },
      { key: "delegate", title: "Delegar", action: "Mover, pedir apoyo o responder rapido", tone: "matrix-delegate", tasks: [] }
    ];
    tasks.filter(task => task.status !== "done").forEach(task => {
      const important = importanceScore(task) >= 4;
      const urgent = urgencyScore(task) >= 4;
      const key = important && urgent ? "do" : important ? "plan" : urgent ? "delegate" : "pause";
      quadrants.find(quadrant => quadrant.key === key)?.tasks.push(task);
    });
    quadrants.forEach(quadrant => {
      quadrant.tasks.sort((first, second) => urgencyScore(second) - urgencyScore(first) || importanceScore(second) - importanceScore(first));
    });
    return quadrants;
  }


  function renderKpis() {
    const summary = calculateKpis(tasks);
    const compact = root.querySelector("[data-kpi-compact]");
    const reports = root.querySelector("[data-kpi-reports]") || document.querySelector("[data-kpi-reports]");
    const bars = root.querySelector("[data-workload-bars]") || document.querySelector("[data-workload-bars]");
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
      if (!summary.total) {
        reports.innerHTML = `<article class="kpi-empty-state"><i data-lucide="chart-no-axes-column-increasing"></i><strong>Sin actividad medible todavia</strong><span>Crea tareas para empezar a medir carga, vencimientos y avance.</span></article>`;
      } else {
        reports.innerHTML = [
          ["Tareas totales", summary.total, "Registro personal"],
          ["Completadas", summary.completed, `${summary.rate}% del total`],
          ["En curso", summary.inProgress, "Trabajo activo"],
          ["Vencidas", summary.overdue, summary.overdue ? "Requieren atencion" : "Sin alertas"]
        ].map(item => `<article class="report-stat"><span>${item[0]}</span><strong>${item[1]}</strong><small>${item[2]}</small></article>`).join("");
      }
    }
    if (bars) {
      if (!summary.total) {
        bars.innerHTML = `<div class="workload-empty">Sin tareas para distribuir todavia.</div>`;
      } else {
        bars.innerHTML = STATUS_ORDER.map(status => {
          const count = summary.byStatus[status];
          const rate = summary.total ? Math.round((count / summary.total) * 100) : 0;
          return `<div><label><span>${STATUS_LABELS[status]}</span><strong>${count}</strong></label><progress max="100" value="${rate}"></progress></div>`;
        }).join("");
      }
    }
  }

  function taskSliderValues(task) {
    return {
      importance: clampTaskScore(task.importance, priorityImportanceFallback(task.priority)),
      urgency: clampTaskScore(task.urgency, priorityUrgencyFallback(task.priority, task.dueDate))
    };
  }

  function clampTaskScore(value, fallback = 3) {
    const score = Number(value);
    if (!Number.isFinite(score)) return fallback;
    return Math.min(5, Math.max(1, Math.round(score)));
  }

  function syncTaskPriorityPreview() {
    const form = document.querySelector("[data-task-form]");
    if (!form) return;
    const importance = Number(form.elements.importance?.value || 3);
    const urgency = Number(form.elements.urgency?.value || 3);
    const priority = derivePriority(importance, urgency);
    const importanceOutput = document.querySelector("[data-importance-output]");
    const urgencyOutput = document.querySelector("[data-urgency-output]");
    const derived = document.querySelector("[data-derived-priority]");
    if (importanceOutput) importanceOutput.textContent = String(importance);
    if (urgencyOutput) urgencyOutput.textContent = String(urgency);
    if (derived) derived.textContent = `Prioridad derivada: ${PRIORITY_LABELS[priority] || "Media"}`;
  }

  function derivePriority(importance, urgency) {
    const importanceValue = Number(importance || 3);
    const urgencyValue = Number(urgency || 3);
    if (importanceValue >= 4 || (importanceValue >= 3 && urgencyValue >= 5)) return "high";
    if (importanceValue >= 3 || urgencyValue >= 4) return "medium";
    return "low";
  }

  function priorityImportanceFallback(priority) {
    if (priority === "high") return 5;
    if (priority === "medium") return 3;
    return 2;
  }

  function priorityUrgencyFallback(priority, dueDate) {
    if (dueDate) return priority === "high" ? 4 : 3;
    if (priority === "high") return 3;
    if (priority === "medium") return 3;
    return 2;
  }

  function importanceScore(task) {
    return clampTaskScore(task.importance, priorityImportanceFallback(task.priority));
  }

  function urgencyScore(task) {
    if (task.status === "done") return 0;
    return clampTaskScore(task.urgency, priorityUrgencyFallback(task.priority, task.dueDate));
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

  function sortTasksForList(entries) {
    return entries.slice().sort((a, b) => {
      const group = completionGroup(a, b);
      if (group) return group;
      if (activeSort === "due" || activeSort === "smart" || activeSort === "done_first") return compareDueDate(a, b) || compareUrgency(a, b) || compareNewest(a, b);
      if (activeSort === "importance") return compareImportance(a, b) || compareUrgency(a, b) || compareDueDate(a, b);
      if (activeSort === "urgency") return compareUrgency(a, b) || compareImportance(a, b) || compareDueDate(a, b);
      if (activeSort === "newest") return compareNewest(a, b);
      if (activeSort === "title") return String(a.title || "").localeCompare(String(b.title || ""), "es", { sensitivity: "base" });
      return compareDueDate(a, b) || compareNewest(a, b);
    });
  }

  function completionGroup(a, b) {
    const aDone = a.status === "done";
    const bDone = b.status === "done";
    if (aDone === bDone) return 0;
    return activeSort === "done_first" ? (aDone ? -1 : 1) : (aDone ? 1 : -1);
  }

  function compareDueDate(a, b) {
    const left = a.dueDate || "9999-12-31";
    const right = b.dueDate || "9999-12-31";
    return left.localeCompare(right);
  }

  function compareImportance(a, b) {
    return importanceScore(b) - importanceScore(a);
  }

  function compareUrgency(a, b) {
    return clampTaskScore(b.urgency, priorityUrgencyFallback(b.priority, b.dueDate)) - clampTaskScore(a.urgency, priorityUrgencyFallback(a.priority, a.dueDate));
  }

  function compareNewest(a, b) {
    return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
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

  function openNewTask(defaults = {}) {
    openTaskDialog(null, defaults);
  }

  function openTaskEditor(id) {
    const task = findTask(id);
    if (!task) return false;
    openTaskDialog(task);
    return true;
  }

  function getTasks() {
    return tasks.slice();
  }

  function subscribeTasks(callback) {
    if (typeof callback !== "function") return () => {};
    taskSubscribers.add(callback);
    callback(getTasks(), { loaded: tasksLoaded });
    return () => taskSubscribers.delete(callback);
  }

  function notifyTasksChanged() {
    const detail = { tasks: getTasks(), loaded: tasksLoaded };
    taskSubscribers.forEach(callback => callback(detail.tasks, { loaded: tasksLoaded }));
    document.dispatchEvent(new CustomEvent("bcc:workspace-tasks", { detail }));
  }

  function clearTaskMessage() {
    if (messageTimer) window.clearTimeout(messageTimer);
    messageTimer = null;
    window.BCCWorkspaceUtils.setMessage(root.querySelector("[data-task-message]"), "");
  }

  function setMessage(message, tone = "neutral") {
    if (messageTimer) window.clearTimeout(messageTimer);
    messageTimer = null;
    const target = root.querySelector("[data-task-message]");
    window.BCCWorkspaceUtils.setMessage(target, message, tone);
    if (message && tone !== "error") {
      messageTimer = window.setTimeout(clearTaskMessage, 2400);
    }
  }

  function toggleSubmitting(form, busy) {
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = busy;
    submit.textContent = busy ? "Guardando..." : (editingTaskId ? "Guardar cambios" : "Crear tarea");
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

  function escapeAttr(value) {
    return window.BCCWorkspaceUtils.escapeAttr(value);
  }

  function escapeHtml(value) {
    return window.BCCWorkspaceUtils.escapeHtml(value);
  }

  window.BCCWorkspaceProductivity = { init, getTasks, subscribeTasks, openNewTask, openTaskEditor };
})();
