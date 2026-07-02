(() => {
  const STORAGE_KEY = "bcc_workspace_notifications_seen_v1";
  const DAY_MS = 24 * 60 * 60 * 1000;
  let currentUser = null;
  let tasks = [];
  let events = [];
  let ready = false;
  let scanTimer = 0;
  let pollTimer = 0;
  let button = null;
  let serviceWorkerRegistration = null;

  function init(user = {}) {
    if (ready) return;
    ready = true;
    currentUser = user || {};
    button = document.querySelector("[data-workspace-notifications]");
    bindButton();
    bindStreams();
    updateButtonState();
    scanTimer = window.setInterval(scanNow, 60 * 1000);
    pollTimer = window.setInterval(pollWorkspace, 2 * 60 * 1000);
    window.setTimeout(pollWorkspace, 2500);
  }

  function bindButton() {
    if (!button) return;
    if (!supportsNotifications()) {
      button.hidden = true;
      return;
    }
    button.hidden = false;
    button.addEventListener("click", async () => {
      if (Notification.permission === "default") await Notification.requestPermission();
      updateButtonState();
      await ensurePushSubscription();
      await pollWorkspace();
      scanNow({ forceAssignments: true });
    });
  }

  function bindStreams() {
    document.addEventListener("bcc:workspace-tasks", event => {
      tasks = Array.isArray(event.detail?.tasks) ? event.detail.tasks : [];
      if (event.detail?.loaded) scanTasks({ forceAssignments: false });
    });
    document.addEventListener("bcc:workspace-events", event => {
      events = Array.isArray(event.detail?.events) ? event.detail.events : [];
      if (event.detail?.loaded) scanEvents();
    });
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) scanNow();
    });
  }

  function updateButtonState() {
    if (!button || !supportsNotifications()) return;
    const permission = Notification.permission;
    const pushReady = supportsPush() && Boolean(publicVapidKey());
    button.dataset.notificationState = permission;
    button.dataset.pushReady = pushReady ? "true" : "false";
    button.setAttribute("aria-label", permission === "granted" ? "Notificaciones activas" : "Activar notificaciones");
    button.title = permission === "granted"
      ? (pushReady ? "Push notifications activas" : "Notificaciones locales activas; falta VAPID public key para push real")
      : permission === "denied"
        ? "Notificaciones bloqueadas en el navegador"
        : "Activar notificaciones";
    button.innerHTML = permission === "granted" ? '<i data-lucide="bell-ring"></i>' : '<i data-lucide="bell"></i>';
    window.BCCWorkspaceUtils?.refreshIcons(button);
  }

  async function pollWorkspace() {
    if (!window.BCCAuth?.api) return;
    const [taskResult, eventResult] = await Promise.allSettled([
      window.BCCAuth.api("/api/workspace/tasks"),
      window.BCCAuth.api("/api/workspace/events")
    ]);
    if (taskResult.status === "fulfilled") tasks = Array.isArray(taskResult.value.tasks) ? taskResult.value.tasks : tasks;
    if (eventResult.status === "fulfilled") events = Array.isArray(eventResult.value.events) ? eventResult.value.events : events;
    scanNow();
  }

  function scanNow(options = {}) {
    scanTasks(options);
    scanEvents();
  }


  async function ensurePushSubscription() {
    if (!canNotify() || !supportsPush() || !publicVapidKey() || !window.BCCAuth?.api) return false;
    try {
      serviceWorkerRegistration ||= await navigator.serviceWorker.register("/workspace-service-worker.js", { scope: "/" });
      const existing = await serviceWorkerRegistration.pushManager.getSubscription();
      const subscription = existing || await serviceWorkerRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicVapidKey())
      });
      await window.BCCAuth.api("/api/workspace/push-subscriptions", {
        method: "POST",
        body: JSON.stringify(subscription.toJSON())
      });
      return true;
    } catch (error) {
      console.warn("BCC push subscription failed", error);
      return false;
    }
  }

  function publicVapidKey() {
    return String(window.BCC_WEB_PUSH_PUBLIC_KEY || "").trim();
  }

  function supportsPush() {
    return "serviceWorker" in navigator && "PushManager" in window;
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
  }

  function scanTasks(options = {}) {
    if (!canNotify()) return;
    const today = localDate();
    const tomorrow = localDate(addDays(new Date(), 1));
    tasks.forEach(task => {
      if (!task || task.assignmentStatus === "rejected") return;
      const mine = task.assigneeId === currentUser?.id;
      const fromOther = task.createdBy && task.createdBy !== currentUser?.id;
      if (mine && fromOther && ["assigned", "suggested"].includes(task.assignmentMode)) {
        const key = `task-assignment:${task.id}:${task.assignmentMode}:${task.assignmentStatus}`;
        const title = task.assignmentMode === "suggested" ? "Nueva sugerencia de tarea" : "Nueva tarea asignada";
        const body = task.assignmentMode === "suggested"
          ? `${task.creatorName || "El equipo"} sugiere: ${task.title}`
          : `${task.creatorName || "El equipo"} te asigno: ${task.title}`;
        notifyOnce(key, title, { body, tag: key, kind: task.assignmentMode === "suggested" ? "task_suggested" : "task_assigned", requireInteraction: true });
      }

      if (task.status === "done" || task.assignmentStatus === "pending") return;
      if (!task.dueDate) return;
      if (task.dueDate < today) {
        notifyOnce(`task-overdue:${task.id}:${today}`, "Tarea vencida", {
          body: `${task.title} vencio el ${formatDate(task.dueDate)}.`,
          tag: `task-due-${task.id}`,
          kind: "task_overdue",
          requireInteraction: true
        });
      } else if (task.dueDate === today) {
        notifyOnce(`task-due-today:${task.id}:${today}`, "Tarea vence hoy", {
          body: task.title,
          tag: `task-due-${task.id}`,
          kind: "task_due"
        });
      } else if (task.dueDate === tomorrow) {
        notifyOnce(`task-due-tomorrow:${task.id}:${today}`, "Tarea vence mañana", {
          body: task.title,
          tag: `task-due-${task.id}`,
          kind: "task_due"
        });
      }
    });
  }

  function scanEvents() {
    if (!canNotify()) return;
    const now = new Date();
    const today = localDate(now);
    const tomorrow = localDate(addDays(now, 1));
    events.forEach(event => {
      if (!event?.date) return;
      if (event.date === today) {
        const minutes = minutesUntilEvent(event, now);
        if (minutes !== null && minutes >= 0 && minutes <= 60) {
          notifyOnce(`event-hour:${event.id}:${today}`, "Evento próximo", {
            body: `${event.title}${event.startTime ? ` · ${event.startTime}` : ""}`,
            tag: `event-${event.id}`,
            kind: "calendar_event"
          });
          return;
        }
        notifyOnce(`event-today:${event.id}:${today}`, "Evento hoy", {
          body: `${event.title}${event.startTime ? ` · ${event.startTime}` : ""}`,
          tag: `event-${event.id}`,
          kind: "calendar_event"
        });
      } else if (event.date === tomorrow) {
        notifyOnce(`event-tomorrow:${event.id}:${today}`, "Evento mañana", {
          body: `${event.title}${event.startTime ? ` · ${event.startTime}` : ""}`,
          tag: `event-${event.id}`,
          kind: "calendar_event"
        });
      }
    });
  }

  function notifyOnce(key, title, options = {}) {
    const seen = readSeen();
    if (seen[key]) return;
    seen[key] = Date.now();
    writeSeen(pruneSeen(seen));
    try {
      const vibrate = notificationVibration(options.kind || key);
      new Notification(title, {
        body: options.body || "",
        tag: options.tag || key,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        renotify: true,
        requireInteraction: Boolean(options.requireInteraction),
        silent: false,
        timestamp: Date.now(),
        vibrate
      });
      navigator.vibrate?.(vibrate);
    } catch {}
  }

  function notificationVibration(kind = "") {
    const value = String(kind);
    if (value.includes("overdue") || value.includes("vencida")) return [220, 90, 220, 90, 160];
    if (value.includes("assignment") || value.includes("assigned") || value.includes("suggested")) return [180, 80, 180];
    if (value.includes("event")) return [140, 70, 140];
    return [160, 70, 160];
  }

  function readSeen() {
    try {
      const payload = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return payload && typeof payload === "object" ? payload : {};
    } catch {
      return {};
    }
  }

  function writeSeen(value) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch {}
  }

  function pruneSeen(seen) {
    const cutoff = Date.now() - 14 * DAY_MS;
    return Object.fromEntries(Object.entries(seen).filter(([, value]) => Number(value) > cutoff));
  }

  function supportsNotifications() {
    return "Notification" in window;
  }

  function canNotify() {
    return supportsNotifications() && Notification.permission === "granted";
  }

  function minutesUntilEvent(event, now) {
    if (!event.startTime) return null;
    const date = parseLocalDate(event.date);
    const [hours, minutes] = String(event.startTime).split(":").map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    date.setHours(hours, minutes, 0, 0);
    return Math.round((date.getTime() - now.getTime()) / 60000);
  }

  function parseLocalDate(value) {
    const [year, month, day] = String(value).split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  function addDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  function localDate(date = new Date()) {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function formatDate(value) {
    return window.BCCWorkspaceUtils?.formatLocalDate?.(value) || value;
  }

  window.BCCWorkspaceNotifications = { init };
})();
