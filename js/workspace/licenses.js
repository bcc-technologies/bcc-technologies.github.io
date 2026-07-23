(() => {
  const PRODUCTS = ["MAP-Nano", "MAP-Bio", "MAP-Med", "MAP-Ing"];
  const CACHE_PREFIX = "bcc-map-licenses:session-cache:v3";
  const OPERATIONAL_STATUSES = new Set(["trial", "active", "grace"]);
  const statusLabel = {
    draft: "Borrador", trial: "Prueba", active: "Activa", grace: "Gracia",
    suspended: "Suspendida", expired: "Expirada", cancelled: "Cancelada"
  };
  let root;
  let licenses = [];
  let selectedId = "";
  let canManage = false;
  let canAssign = false;
  let loading = false;
  let readOnly = true;
  let cacheKey = CACHE_PREFIX;
  let metricFilter = "";
  let detailReturnFocus = null;
  let assignableUsers = null;
  const assignmentsByLicense = new Map();

  const esc = value => window.BCCWorkspaceUtils.escapeHtml(String(value ?? ""));
  const daysUntil = value => value ? Math.ceil((new Date(value).getTime() - Date.now()) / 86400000) : null;
  const isOfflineError = error => navigator.onLine === false || /fetch|network|offline|conexión|conexion/i.test(String(error?.message || error || ""));

  const repository = {
    async list() {
      try {
        const response = await window.BCCAuth.api("/api/admin/licenses");
        const items = Array.isArray(response?.licenses) ? response.licenses : [];
        try { sessionStorage.setItem(cacheKey, JSON.stringify(items)); } catch {}
        return { items, stale: false };
      } catch (error) {
        try {
          const cached = JSON.parse(sessionStorage.getItem(cacheKey) || "[]");
          if (isOfflineError(error) && Array.isArray(cached) && cached.length) return { items: cached, stale: true, error };
        } catch {}
        throw error;
      }
    },
    async create(payload) {
      const response = await window.BCCAuth.api("/api/admin/licenses", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
      });
      return response.license;
    },
    async setStatus(id, status) {
      const response = await window.BCCAuth.api(`/api/admin/licenses/${encodeURIComponent(id)}/status`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status })
      });
      return response.license;
    },
    async assignments(id) {
      const response = await window.BCCAuth.api(`/api/admin/licenses/${encodeURIComponent(id)}/assignments`);
      return Array.isArray(response?.assignments) ? response.assignments : [];
    },
    async assignableUsers() {
      const response = await window.BCCAuth.api("/api/admin/licenses/assignable-users");
      return Array.isArray(response?.users) ? response.users : [];
    },
    async assign(id, userId) {
      return window.BCCAuth.api(`/api/admin/licenses/${encodeURIComponent(id)}/assignments`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId })
      });
    },
    async revoke(id, userId) {
      return window.BCCAuth.api(`/api/admin/licenses/${encodeURIComponent(id)}/assignments/${encodeURIComponent(userId)}`, {
        method: "DELETE"
      });
    }
  };

  function feedback(message = "", tone = "info") {
    const region = root?.querySelector("[data-license-feedback]");
    if (!region) return;
    region.textContent = message;
    region.dataset.tone = tone;
    region.hidden = !message;
  }

  function persistCache() {
    try { sessionStorage.setItem(cacheKey, JSON.stringify(licenses)); } catch {}
  }

  function replaceLicense(updated) {
    if (!updated?.id) return;
    licenses = licenses.map(item => item.id === updated.id ? updated : item);
    persistCache();
  }

  function syncManageControls() {
    const createButton = root?.querySelector("[data-new-license]");
    if (createButton) createButton.hidden = !canManage || readOnly;
  }

  function filtered() {
    const query = root.querySelector("[data-license-search]").value.trim().toLowerCase();
    const status = root.querySelector("[data-license-status]").value;
    const product = root.querySelector("[data-license-product]").value;
    const matchesMetric = item => metricFilter === "active"
      ? item.status === "active"
      : metricFilter === "expiring"
        ? (() => { const days = daysUntil(item.endsAt); return days !== null && days >= 0 && days <= 30; })()
        : true;
    return licenses.filter(item => {
      const haystack = [item.organization, item.contactEmail, ...(item.products || [])].join(" ").toLowerCase();
      return matchesMetric(item) && (!query || haystack.includes(query))
        && (!status || item.status === status)
        && (!product || (item.products || []).includes(product));
    });
  }

  function renderMetrics() {
    const active = licenses.filter(item => item.status === "active").length;
    const expiring = licenses.filter(item => {
      const days = daysUntil(item.endsAt);
      return days !== null && days >= 0 && days <= 30;
    }).length;
    const used = licenses.reduce((sum, item) => sum + Number(item.usedSeats || 0), 0);
    const total = licenses.reduce((sum, item) => sum + Number(item.seats || 0), 0);
    root.querySelector("[data-license-metrics]").innerHTML = `
      <button type="button" data-metric-filter="active" aria-pressed="${metricFilter === "active"}"><span>Activas</span><strong>${active}</strong><small>Licencias operativas</small></button>
      <button type="button" data-metric-filter="expiring" aria-pressed="${metricFilter === "expiring"}"><span>Vencen en 30 días</span><strong>${expiring}</strong><small>Requieren seguimiento</small></button>
      <div><span>Asientos</span><strong>${used}/${total}</strong><small>Asignados y disponibles</small></div>
      <div><span>Total</span><strong>${licenses.length}</strong><small>Todos los estados</small></div>`;
  }

  function render() {
    renderMetrics();
    const rows = filtered();
    const body = root.querySelector("[data-license-rows]");
    root.querySelector("[data-license-result-count]").textContent = loading ? "Cargando…" : `${rows.length} licencia${rows.length === 1 ? "" : "s"}`;
    if (loading) {
      body.innerHTML = `<tr><td colspan="7"><div class="license-empty" role="status"><strong>Cargando licencias…</strong><span>Consultando la fuente de acceso.</span></div></td></tr>`;
      return;
    }
    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="7"><div class="license-empty"><strong>No hay licencias que mostrar</strong><span>${canManage && !readOnly ? "Crea una licencia o ajusta los filtros." : "Ajusta los filtros o actualiza la fuente."}</span></div></td></tr>`;
      return;
    }
    body.innerHTML = rows.map(item => `
      <tr data-license-id="${esc(item.id)}" tabindex="0" role="button" aria-label="Abrir licencia de ${esc(item.organization)}">
        <td><strong>${esc(item.organization)}</strong><small>${esc(item.contactEmail || "Sin contacto")}</small></td>
        <td><div class="license-products">${(item.products || []).map(product => `<span>${esc(product)}</span>`).join("")}</div></td>
        <td>${esc(item.plan)}</td><td><strong>${Number(item.usedSeats || 0)}/${Number(item.seats || 0)}</strong></td>
        <td><span class="license-status is-${esc(item.status)}">${esc(statusLabel[item.status] || item.status)}</span></td>
        <td>${item.endsAt ? esc(new Date(`${item.endsAt}T00:00:00`).toLocaleDateString("es-DO")) : "Sin fecha"}</td>
        <td><button type="button" data-open-license="${esc(item.id)}" aria-label="Abrir licencia de ${esc(item.organization)}">Ver</button></td>
      </tr>`).join("");
  }

  async function load() {
    loading = true;
    feedback();
    render();
    try {
      const result = await repository.list();
      licenses = result.items;
      readOnly = result.stale;
      if (result.stale) feedback("Sin conexión con la fuente. Se muestra una copia de esta sesión en modo lectura.", "warning");
    } catch (error) {
      readOnly = true;
      licenses = [];
      feedback(error?.message || "No se pudieron cargar las licencias.", "error");
    } finally {
      loading = false;
      syncManageControls();
      render();
    }
  }

  function closeDetail() {
    const drawer = root.querySelector("[data-license-detail]");
    drawer.hidden = true;
    if (detailReturnFocus?.isConnected) detailReturnFocus.focus();
  }

  function seatActionState(item) {
    if (readOnly) return { allowed: false, reason: "No disponible sin conexión." };
    if (!OPERATIONAL_STATUSES.has(item.status)) return { allowed: false, reason: "Activa la licencia para asignar asientos." };
    if (Number(item.usedSeats || 0) >= Number(item.seats || 0)) return { allowed: false, reason: "No hay asientos disponibles." };
    return { allowed: true, reason: "" };
  }

  function renderAssignments(id) {
    if (selectedId !== id) return;
    const target = root.querySelector("[data-license-assignment-list]");
    if (!target) return;
    const assignments = assignmentsByLicense.get(id) || [];
    if (!assignments.length) {
      target.innerHTML = `<div class="license-assignment-empty"><strong>Sin usuarios asignados</strong><span>Los asientos asignados aparecerán aquí.</span></div>`;
      return;
    }
    target.innerHTML = assignments.map(item => `
      <article class="license-assignment-row">
        <span class="license-user-avatar" aria-hidden="true">${esc((item.name || item.email || "U").slice(0, 1).toUpperCase())}</span>
        <div><strong>${esc(item.name)}</strong><small>${esc(item.email)}</small></div>
        ${canAssign && !readOnly ? `<button type="button" data-revoke-assignment="${esc(item.userId)}" aria-label="Revocar asiento de ${esc(item.name)}">Revocar</button>` : ""}
      </article>`).join("");
  }

  async function loadAssignments(id) {
    const target = root.querySelector("[data-license-assignment-list]");
    if (target && selectedId === id) target.innerHTML = `<div class="license-assignment-empty" role="status"><span>Cargando usuarios…</span></div>`;
    try {
      assignmentsByLicense.set(id, await repository.assignments(id));
      renderAssignments(id);
    } catch (error) {
      if (target && selectedId === id) {
        target.innerHTML = `<div class="license-assignment-empty is-error"><strong>No se pudieron cargar los usuarios</strong><button type="button" data-retry-assignments>Reintentar</button></div>`;
      }
    }
  }

  function openDetail(id) {
    const item = licenses.find(entry => entry.id === id);
    if (!item) return;
    selectedId = id;
    const action = seatActionState(item);
    const percent = Math.min(100, Math.round((Number(item.usedSeats || 0) / Math.max(1, Number(item.seats || 0))) * 100));
    const drawer = root.querySelector("[data-license-detail]");
    drawer.innerHTML = `
      <div class="license-detail-head"><div><span>Licencia MAPs</span><h3>${esc(item.organization)}</h3></div><button type="button" data-close-detail aria-label="Cerrar">×</button></div>
      <div class="license-detail-status"><span class="license-status is-${esc(item.status)}">${esc(statusLabel[item.status] || item.status)}</span><strong>${esc(item.plan)}</strong></div>
      <dl class="license-detail-grid">
        <div><dt>Contacto</dt><dd>${esc(item.contactEmail || "Sin contacto")}</dd></div>
        <div><dt>Vigencia</dt><dd>${item.endsAt ? esc(new Date(`${item.endsAt}T00:00:00`).toLocaleDateString("es-DO")) : "Sin fecha"}</dd></div>
        <div><dt>Asientos</dt><dd>${Number(item.usedSeats || 0)} de ${Number(item.seats || 0)}</dd></div>
        <div><dt>Plataforma</dt><dd>${esc(item.platform || "Web")}</dd></div>
      </dl>
      <section><span class="license-detail-label">Productos habilitados</span><div class="license-products">${(item.products || []).map(product => `<span>${esc(product)}</span>`).join("")}</div></section>
      <section class="license-seat-section">
        <div class="license-seat-head"><div><span class="license-detail-label">Usuarios con acceso</span><strong>${Number(item.usedSeats || 0)} / ${Number(item.seats || 0)}</strong></div>${canAssign ? `<button type="button" class="btn btn-primary" data-open-assignment ${action.allowed ? "" : "disabled"} title="${esc(action.reason)}">Asignar usuario</button>` : ""}</div>
        <div class="license-seat-progress" role="progressbar" aria-label="Asientos ocupados" aria-valuemin="0" aria-valuemax="${Number(item.seats || 0)}" aria-valuenow="${Number(item.usedSeats || 0)}"><span style="width:${percent}%"></span></div>
        ${!action.allowed && canAssign ? `<small class="license-seat-hint">${esc(action.reason)}</small>` : ""}
        <div class="license-assignment-list" data-license-assignment-list></div>
      </section>
      <section><span class="license-detail-label">Actividad</span><p>Creada ${esc(new Date(item.createdAt).toLocaleString("es-DO"))}. Las asignaciones y cambios de estado quedan auditados.</p></section>
      <div class="license-detail-actions">${canManage && !readOnly ? `<button type="button" class="btn btn-ghost" data-license-suspend>${item.status === "suspended" ? "Reactivar" : "Suspender"}</button>` : ""}</div>`;
    drawer.hidden = false;
    drawer.querySelector("[data-close-detail]").focus();
    loadAssignments(id);
  }

  function renderAssignmentCandidates() {
    const query = root.querySelector("[data-assignment-search]").value.trim().toLowerCase();
    const assignedIds = new Set((assignmentsByLicense.get(selectedId) || []).map(item => item.userId));
    const candidates = (assignableUsers || []).filter(user => {
      const haystack = `${user.name} ${user.email}`.toLowerCase();
      return !assignedIds.has(user.id) && (!query || haystack.includes(query));
    });
    const list = root.querySelector("[data-assignment-candidates]");
    if (!candidates.length) {
      list.innerHTML = `<div class="license-assignment-empty"><strong>Sin cuentas disponibles</strong><span>Prueba otra búsqueda o revisa las asignaciones actuales.</span></div>`;
      return;
    }
    list.innerHTML = candidates.map(user => `
      <button type="button" class="license-candidate" data-assign-user="${esc(user.id)}">
        <span class="license-user-avatar" aria-hidden="true">${esc((user.name || user.email || "U").slice(0, 1).toUpperCase())}</span>
        <span><strong>${esc(user.name)}</strong><small>${esc(user.email)}</small></span>
        <em>${esc(user.role === "admin" ? "Administrador" : user.role === "staff" ? "Personal" : "Cliente")}</em>
      </button>`).join("");
  }

  async function openAssignmentDialog() {
    const dialog = root.querySelector("[data-assignment-dialog]");
    root.querySelector("[data-assignment-search]").value = "";
    root.querySelector("[data-assignment-candidates]").innerHTML = `<div class="license-assignment-empty" role="status"><span>Cargando cuentas…</span></div>`;
    dialog.showModal();
    try {
      assignableUsers = await repository.assignableUsers();
      renderAssignmentCandidates();
      root.querySelector("[data-assignment-search]").focus();
    } catch (error) {
      root.querySelector("[data-assignment-candidates]").innerHTML = `<div class="license-assignment-empty is-error"><strong>No se pudieron cargar las cuentas</strong><span>${esc(error?.message || "Intenta nuevamente.")}</span></div>`;
    }
  }

  async function assignUser(button) {
    if (readOnly || !canAssign) return;
    button.disabled = true;
    try {
      const response = await repository.assign(selectedId, button.dataset.assignUser);
      replaceLicense(response.license);
      const assignments = assignmentsByLicense.get(selectedId) || [];
      assignmentsByLicense.set(selectedId, [...assignments, response.assignment]);
      root.querySelector("[data-assignment-dialog]").close();
      feedback("Asiento asignado correctamente.", "success");
      render();
      openDetail(selectedId);
    } catch (error) {
      feedback(error?.message || "No se pudo asignar el asiento.", "error");
      button.disabled = false;
    }
  }

  async function revokeUser(button) {
    if (readOnly || !canAssign) return;
    if (button.dataset.confirm !== "true") {
      button.dataset.confirm = "true";
      button.textContent = "Confirmar";
      window.setTimeout(() => {
        if (button.isConnected && button.dataset.confirm === "true") {
          delete button.dataset.confirm;
          button.textContent = "Revocar";
        }
      }, 4000);
      return;
    }
    button.disabled = true;
    try {
      const userId = button.dataset.revokeAssignment;
      const response = await repository.revoke(selectedId, userId);
      replaceLicense(response.license);
      assignmentsByLicense.set(selectedId, (assignmentsByLicense.get(selectedId) || []).filter(item => item.userId !== userId));
      feedback("Asiento revocado.", "success");
      render();
      openDetail(selectedId);
    } catch (error) {
      feedback(error?.message || "No se pudo revocar el asiento.", "error");
      button.disabled = false;
    }
  }

  async function createLicense(form) {
    if (readOnly) return;
    const submit = form.querySelector("[type=submit]");
    const data = new FormData(form);
    const products = data.getAll("products");
    if (!products.length) {
      feedback("Selecciona al menos un producto MAP.", "error");
      return;
    }
    submit.disabled = true;
    submit.textContent = "Guardando…";
    try {
      const item = await repository.create({
        organization: String(data.get("organization") || "").trim(),
        contactEmail: String(data.get("contactEmail") || "").trim(),
        products,
        plan: String(data.get("plan") || "Equipo"),
        seats: Math.max(1, Number(data.get("seats") || 1)),
        status: data.get("activate") ? "active" : "draft",
        platform: String(data.get("platform") || "Web"),
        startsAt: new Date().toISOString().slice(0, 10),
        endsAt: String(data.get("endsAt") || "")
      });
      licenses.unshift(item);
      persistCache();
      form.closest("dialog").close();
      detailReturnFocus = root.querySelector("[data-new-license]");
      form.reset();
      feedback("Licencia creada correctamente.", "success");
      render();
      openDetail(item.id);
    } catch (error) {
      feedback(error?.message || "No se pudo crear la licencia.", "error");
    } finally {
      submit.disabled = false;
      submit.textContent = "Guardar licencia";
    }
  }

  async function toggleStatus(button) {
    if (readOnly) return;
    const item = licenses.find(entry => entry.id === selectedId);
    if (!item) return;
    const nextStatus = item.status === "suspended" ? "active" : "suspended";
    button.disabled = true;
    try {
      const updated = await repository.setStatus(item.id, nextStatus);
      replaceLicense(updated);
      feedback(nextStatus === "suspended" ? "Licencia suspendida." : "Licencia reactivada.", "success");
      render();
      openDetail(updated.id);
    } catch (error) {
      feedback(error?.message || "No se pudo cambiar el estado.", "error");
      button.disabled = false;
    }
  }

  function bind() {
    root.addEventListener("input", event => {
      if (event.target.matches("[data-license-search]")) render();
      if (event.target.matches("[data-assignment-search]")) renderAssignmentCandidates();
    });
    root.addEventListener("change", event => {
      if (event.target.matches("[data-license-status], [data-license-product]")) render();
    });
    root.addEventListener("keydown", event => {
      if (event.key === "Escape" && root.querySelector("dialog[open]")) return;
      if (event.key === "Escape" && !root.querySelector("[data-license-detail]").hidden) { closeDetail(); return; }
      const row = event.target.closest("[data-license-id]");
      if (row && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        openDetail(row.dataset.licenseId);
      }
    });
    root.addEventListener("click", async event => {
      const open = event.target.closest("[data-open-license], [data-license-id]");
      if (open) detailReturnFocus = open;
      const metric = event.target.closest("[data-metric-filter]");
      if (metric) { metricFilter = metricFilter === metric.dataset.metricFilter ? "" : metric.dataset.metricFilter; render(); }
      if (open) openDetail(open.dataset.openLicense || open.dataset.licenseId);
      if (event.target.closest("[data-new-license]")) root.querySelector("[data-license-dialog]").showModal();
      if (event.target.closest("[data-close-license-dialog]")) root.querySelector("[data-license-dialog]").close();
      if (event.target.closest("[data-close-assignment-dialog]")) root.querySelector("[data-assignment-dialog]").close();
      if (event.target.closest("[data-close-detail]")) closeDetail();
      if (event.target.closest("[data-open-assignment]")) await openAssignmentDialog();
      if (event.target.closest("[data-retry-assignments]")) await loadAssignments(selectedId);
      const assignButton = event.target.closest("[data-assign-user]");
      if (assignButton) await assignUser(assignButton);
      const revokeButton = event.target.closest("[data-revoke-assignment]");
      if (revokeButton) await revokeUser(revokeButton);
      if (event.target.closest("[data-retry-licenses]")) await load();
      if (event.target.closest("[data-clear-license-filters]")) {
        metricFilter = "";
        root.querySelector("[data-license-search]").value = "";
        root.querySelector("[data-license-status]").value = "";
        root.querySelector("[data-license-product]").value = "";
        render();
      }
      const statusButton = event.target.closest("[data-license-suspend]");
      if (statusButton) await toggleStatus(statusButton);
    });
    root.querySelector("[data-license-form]").addEventListener("submit", async event => {
      event.preventDefault();
      await createLicense(event.currentTarget);
    });
  }

  async function init(user = {}) {
    root = document.querySelector("[data-licenses-workspace]");
    if (!root || root.dataset.ready) return;
    root.dataset.ready = "true";
    canManage = (user.permissions || []).includes("licenses:manage");
    canAssign = (user.permissions || []).includes("licenses:assign");
    cacheKey = `${CACHE_PREFIX}:${user.id || "anonymous"}`;
    root.innerHTML = `
      <section class="licenses-head"><div><span class="workspace-eyebrow">Licencias</span><h2>Licencias MAPs</h2><p>Administra productos, vigencia y acceso por organización.</p></div>${canManage ? `<button class="btn btn-primary" type="button" data-new-license>+ Nueva licencia</button>` : ""}</section>
      <div class="license-feedback" data-license-feedback role="status" aria-live="polite" hidden></div>
      <section class="license-metrics" data-license-metrics></section>
      <section class="module-surface licenses-surface">
        <div class="licenses-toolbar"><label><span class="sr-only">Buscar</span><input type="search" data-license-search placeholder="Buscar organización, correo o MAP…" /></label><select data-license-status aria-label="Estado"><option value="">Todos los estados</option>${Object.entries(statusLabel).map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select><select data-license-product aria-label="Producto"><option value="">Todos los MAPs</option>${PRODUCTS.map(product => `<option>${product}</option>`).join("")}</select><button type="button" data-clear-license-filters>Limpiar</button><button type="button" data-retry-licenses>Actualizar</button><strong data-license-result-count></strong></div>
        <div class="table-scroll"><table class="licenses-table"><thead><tr><th>Organización</th><th>Productos</th><th>Plan</th><th>Asientos</th><th>Estado</th><th>Renovación</th><th></th></tr></thead><tbody data-license-rows></tbody></table></div>
      </section>
      <aside class="license-detail" data-license-detail hidden></aside>
      <dialog class="license-dialog" data-license-dialog><form method="dialog" data-license-form><div class="license-dialog-head"><div><span>Nueva licencia</span><h3>Cliente y condiciones</h3></div><button type="button" data-close-license-dialog aria-label="Cerrar">×</button></div><label>Organización<input name="organization" required /></label><label>Contacto principal<input type="email" name="contactEmail" required /></label><fieldset><legend>Productos</legend>${PRODUCTS.map(product => `<label><input type="checkbox" name="products" value="${product}" />${product}</label>`).join("")}</fieldset><div class="license-form-grid"><label>Plan<select name="plan"><option>Equipo</option><option>Individual</option><option>Enterprise</option><option>Prueba</option></select></label><label>Asientos<input type="number" name="seats" min="1" value="5" /></label><label>Plataforma<select name="platform"><option>Web</option><option>Desktop</option><option>Web + Desktop</option></select></label><label>Vencimiento<input type="date" name="endsAt" /></label></div><label class="license-activate"><input type="checkbox" name="activate" />Activar inmediatamente</label><div class="license-dialog-actions"><button class="btn btn-ghost" type="button" data-close-license-dialog>Cancelar</button><button class="btn btn-primary" type="submit">Guardar licencia</button></div></form></dialog>
      <dialog class="license-dialog license-assignment-dialog" data-assignment-dialog><div class="license-assignment-dialog-body"><div class="license-dialog-head"><div><span>Asignar asiento</span><h3>Selecciona una cuenta</h3></div><button type="button" data-close-assignment-dialog aria-label="Cerrar">×</button></div><label class="license-assignment-search"><span class="sr-only">Buscar cuenta</span><input type="search" data-assignment-search placeholder="Buscar por nombre o correo…" autocomplete="off" /></label><div class="license-candidate-list" data-assignment-candidates></div><div class="license-dialog-actions"><button class="btn btn-ghost" type="button" data-close-assignment-dialog>Cerrar</button></div></div></dialog>`;
    bind();
    syncManageControls();
    await load();
  }

  window.BCCWorkspaceLicenses = { init, products: PRODUCTS };
})();
