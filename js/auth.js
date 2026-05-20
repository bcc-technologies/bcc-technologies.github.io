async function bccApi(path, options = {}) {
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: options.body instanceof FormData ? {} : { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new Error(data.error || "Solicitud fallida.");
  return data;
}

function authMessage(text, tone = "error") {
  const el = document.querySelector("[data-auth-message]");
  if (!el) return;
  el.textContent = text || "";
  el.dataset.tone = tone;
  el.hidden = !text;
}

function routeForUser(user) {
  return user?.permissions?.includes("admin:view") ? "/admin-dashboard.html" : "/dashboard.html";
}

async function requireAuth({ admin = false } = {}) {
  try {
    const { user } = await bccApi("/api/auth/me");
    if (!user) {
      window.location.replace(`/login.html?next=${encodeURIComponent(location.pathname)}`);
      return null;
    }
    if (admin && !user.permissions.includes("admin:view")) {
      window.location.replace("/dashboard.html");
      return null;
    }
    return user;
  } catch {
    window.location.replace(`/login.html?next=${encodeURIComponent(location.pathname)}`);
    return null;
  }
}

async function logout() {
  await bccApi("/api/auth/logout", { method: "POST", body: "{}" });
  window.location.assign("/login.html");
}

window.BCCAuth = { api: bccApi, requireAuth, logout, routeForUser };

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-account-trigger]").forEach(button => {
    const menu = button.closest("[data-account-menu]");
    const dropdown = menu?.querySelector("[data-account-dropdown]");
    if (!menu || !dropdown) return;

    button.addEventListener("click", event => {
      event.stopPropagation();
      const open = dropdown.hidden;
      dropdown.hidden = !open;
      button.setAttribute("aria-expanded", String(open));
    });

    document.addEventListener("click", event => {
      if (dropdown.hidden || menu.contains(event.target)) return;
      dropdown.hidden = true;
      button.setAttribute("aria-expanded", "false");
    });
  });

  document.querySelectorAll("[data-logout]").forEach(button => {
    button.addEventListener("click", () => logout().catch(() => window.location.assign("/login.html")));
  });

  const loginForm = document.querySelector("[data-login-form]");
  if (loginForm) {
    loginForm.addEventListener("submit", async event => {
      event.preventDefault();
      authMessage("");
      const form = new FormData(loginForm);
      try {
        const data = await bccApi("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({
            email: form.get("email"),
            password: form.get("password")
          })
        });
        const next = new URLSearchParams(location.search).get("next");
        window.location.assign(next || data.redirectTo || routeForUser(data.user));
      } catch (error) {
        authMessage(error.message);
      }
    });
  }

  const signupForm = document.querySelector("[data-signup-form]");
  if (signupForm) {
    signupForm.addEventListener("submit", async event => {
      event.preventDefault();
      authMessage("");
      const form = new FormData(signupForm);
      const password = String(form.get("password") || "");
      if (password !== String(form.get("confirmPassword") || "")) {
        authMessage("Las contraseñas no coinciden.");
        return;
      }
      try {
        const data = await bccApi("/api/auth/signup", {
          method: "POST",
          body: JSON.stringify({
            name: form.get("name"),
            email: form.get("email"),
            company: form.get("company"),
            title: form.get("title"),
            password
          })
        });
        window.location.assign(data.redirectTo || routeForUser(data.user));
      } catch (error) {
        authMessage(error.message);
      }
    });
  }
});
