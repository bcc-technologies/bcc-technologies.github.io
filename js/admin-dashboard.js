document.addEventListener("DOMContentLoaded", async () => {
  const user = await window.BCCAuth.requireAuth({ admin: true });
  if (!user) return;
  window.BCCAdminCurrentUser = user;

  document.querySelectorAll("[data-user-name]").forEach(el => { el.textContent = user.displayName || user.name; });
  document.querySelectorAll("[data-user-role]").forEach(el => { el.textContent = roleLabel(user.role); });
  hydrateAccountMenu(user);
  await loadUsers();
});

async function loadUsers() {
  const table = document.querySelector("[data-users-table]");
  const message = document.querySelector("[data-admin-message]");
  if (!table) return;
  try {
    const { users } = await window.BCCAuth.api("/api/admin/users");
    table.replaceChildren(...users.map(userRow));
    if (message) message.textContent = `${users.length} cuenta(s) registrada(s).`;
  } catch (error) {
    if (message) message.textContent = error.message;
  }
}

function userRow(user) {
  const currentUser = window.BCCAdminCurrentUser;
  const isSelfAdmin = currentUser?.id === user.id && user.role === "admin";
  const row = document.createElement("tr");
  row.innerHTML = `
    <td><strong>${escapeHtml(user.name)}</strong><span>${escapeHtml(user.email)}</span></td>
    <td>${escapeHtml(user.company || "-")}</td>
    <td>
      <select data-role-select="${escapeHtml(user.id)}" ${isSelfAdmin ? "disabled title=\"No puedes quitarte tu propio rol de administrador\"" : ""}>
        ${["client", "staff", "admin"].map(role => `<option value="${role}" ${role === user.role ? "selected" : ""}>${roleLabel(role)}</option>`).join("")}
      </select>
      ${isSelfAdmin ? `<span class="role-lock-note">Protegido</span>` : ""}
    </td>
    <td>${escapeHtml(user.status || "active")}</td>
    <td>${user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "-"}</td>
  `;
  row.querySelector("select").addEventListener("change", async event => {
    try {
      await window.BCCAuth.api(`/api/admin/users/${encodeURIComponent(user.id)}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role: event.target.value })
      });
    } catch (error) {
      window.alert(error.message);
    }
    await loadUsers();
  });
  return row;
}

function roleLabel(role) {
  return { client: "Cliente", staff: "Personal", admin: "Administrador" }[role] || role;
}

function hydrateAccountMenu(user) {
  const display = user.displayName || user.name || "Cuenta";
  document.querySelectorAll("[data-user-menu-name]").forEach(el => { el.textContent = display; });
  document.querySelectorAll("[data-user-menu-role]").forEach(el => { el.textContent = roleLabel(user.role); });
  document.querySelectorAll("[data-user-initial]").forEach(el => { el.textContent = display.trim().charAt(0).toUpperCase() || "?"; });
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
