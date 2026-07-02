self.addEventListener("push", event => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "BCC Workspace", body: event.data?.text() || "Nueva notificacion." };
  }

  const title = payload.title || "BCC Workspace";
  const vibrate = Array.isArray(payload.vibrate) && payload.vibrate.length
    ? payload.vibrate.map(Number).filter(Number.isFinite)
    : [160, 70, 160];
  const options = {
    body: payload.body || "Nueva notificacion.",
    icon: payload.icon || "/favicon.ico",
    badge: payload.badge || "/favicon.ico",
    tag: payload.tag || "bcc-workspace",
    renotify: payload.renotify !== false,
    requireInteraction: Boolean(payload.requireInteraction),
    silent: Boolean(payload.silent),
    timestamp: Number(payload.timestamp) || Date.now(),
    vibrate,
    actions: Array.isArray(payload.actions) ? payload.actions.slice(0, 2) : [{ action: "open", title: "Abrir" }],
    data: {
      url: payload.url || "/staff-dashboard.html#trabajo"
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url = event.notification.data?.url || "/staff-dashboard.html#trabajo";
  event.waitUntil((async () => {
    const allClients = await clients.matchAll({ type: "window", includeUncontrolled: true });
    const absoluteUrl = new URL(url, self.location.origin).href;
    for (const client of allClients) {
      if (client.url === absoluteUrl && "focus" in client) return client.focus();
    }
    if (clients.openWindow) return clients.openWindow(absoluteUrl);
  })());
});
