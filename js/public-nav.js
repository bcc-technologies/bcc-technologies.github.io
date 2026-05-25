/* Minimal public header navigation for account entry screens. */
(() => {
  function bindMenu() {
    const toggle = document.querySelector(".menu-toggle");
    const nav = document.querySelector("header nav");
    const list = document.getElementById("primary-nav");
    if (!toggle || !nav) return;

    const close = () => {
      nav.classList.remove("active");
      toggle.setAttribute("aria-expanded", "false");
    };

    toggle.addEventListener("click", event => {
      event.stopPropagation();
      const open = nav.classList.toggle("active");
      toggle.setAttribute("aria-expanded", String(open));
    });

    document.addEventListener("click", event => {
      if (nav.classList.contains("active") && !nav.contains(event.target) && !toggle.contains(event.target)) close();
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") close();
    });
    list?.addEventListener("click", event => {
      if (event.target.closest("a")) close();
    });
  }

  function markCurrentPage() {
    const page = location.pathname.split("/").pop()?.toLowerCase();
    if (!page) return;
    document.querySelectorAll("header nav a[href]").forEach(link => {
      const linkedPage = new URL(link.href, location.href).pathname.split("/").pop()?.toLowerCase();
      if (linkedPage === page) {
        link.classList.add("is-current");
        link.setAttribute("aria-current", "page");
      }
    });
  }

  async function hydrateAccountAction() {
    const actions = document.querySelector(".nav-actions");
    const loginLink = actions?.querySelector('a[href*="login.html"]');
    if (!actions || !loginLink || !window.BCCAuth?.currentUser) return;
    try {
      const user = await window.BCCAuth.currentUser();
      if (!user) return;
      const display = user.displayName || user.name || "Cuenta";
      const initial = display.trim().charAt(0).toUpperCase() || "?";
      const english = document.documentElement.lang.toLowerCase().startsWith("en");
      const role = (english
        ? { client: "Client", staff: "Staff", admin: "Administrator" }
        : { client: "Cliente", staff: "Personal", admin: "Administrador" })[user.role] || (english ? "User" : "Usuario");
      const menu = document.createElement("div");
      menu.className = "account-menu";
      menu.innerHTML = `
        <button class="account-trigger" type="button" aria-expanded="false">
          <span class="account-avatar">${escapeHtml(initial)}</span>
          <span class="account-copy"><strong>${escapeHtml(display)}</strong><small>${escapeHtml(role)}</small></span>
        </button>
        <div class="account-dropdown" hidden>
          <a href="${dashboardHref(user)}">Dashboard</a>
          <button type="button" data-public-logout>${english ? "Log out" : "Cerrar sesion"}</button>
        </div>
      `;
      loginLink.replaceWith(menu);
      const trigger = menu.querySelector(".account-trigger");
      const dropdown = menu.querySelector(".account-dropdown");
      trigger.addEventListener("click", event => {
        event.stopPropagation();
        const open = dropdown.hidden;
        dropdown.hidden = !open;
        trigger.setAttribute("aria-expanded", String(open));
      });
      document.addEventListener("click", event => {
        if (!menu.contains(event.target)) {
          dropdown.hidden = true;
          trigger.setAttribute("aria-expanded", "false");
        }
      });
      menu.querySelector("[data-public-logout]").addEventListener("click", () => window.BCCAuth.logout());
    } catch {
      // Public account screens remain usable when a session cannot be read.
    }
  }

  function dashboardHref(user) {
    return window.BCCAuth.routeForUser(user);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[char]));
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindMenu();
    markCurrentPage();
    hydrateAccountAction();
  });
})();
