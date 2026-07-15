const MAPS_DEVELOPER_PERMISSION = "map.dev.access";
const MAPS_DEVELOPER_CAPABILITIES = [
  ["map.dev.access", "Acceder al entorno de desarrollo MAP"],
  ["map.release.manage", "Aprobar y publicar versiones MAP"]
];

document.addEventListener("DOMContentLoaded", async () => {
  const user = await window.BCCAuth.requireAuth({ permission: MAPS_DEVELOPER_PERMISSION });
  if (!user) return;

  const displayName = user.displayName || user.name || user.email;
  document.querySelector("[data-maps-dev-user]").textContent = displayName;
  document.querySelector("[data-maps-dev-role]").textContent = user.title || "Personal autorizado de MAPs";

  const permissions = new Set(user.permissions || []);
  const capabilities = MAPS_DEVELOPER_CAPABILITIES
    .filter(([permission]) => permissions.has(permission))
    .map(([, label]) => `<li>${label}</li>`);
  document.querySelector("[data-maps-dev-capabilities]").innerHTML = capabilities.join("") || "<li>Acceso de entrada únicamente</li>";

  const projectUrl = String(window.BCC_MAPS_DEVELOPER_URL || "").trim();
  if (projectUrl) {
    const projectLink = document.querySelector("[data-maps-dev-project-link]");
    projectLink.href = projectUrl;
    projectLink.hidden = false;
  }
});
