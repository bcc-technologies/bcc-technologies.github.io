(() => {
  const Utils = window.BCCWorkspaceUtils;
  const {
    escapeHtml,
    permissionLabel: defaultPermissionLabel,
    renderMessageBlock,
    roleLabel,
    refreshIcons
  } = Utils;

  function hydrateAccountMenu(user, options = {}) {
    const display = user.displayName || user.name || "Cuenta";
    const labelRole = options.roleLabel || roleLabel;
    const permissions = Array.isArray(user.permissions) ? user.permissions : [];
    document.querySelectorAll("[data-user-menu-name]").forEach(el => { el.textContent = display; });
    document.querySelectorAll("[data-user-menu-role]").forEach(el => { el.textContent = labelRole(user.role); });
    document.querySelectorAll("[data-user-initial]").forEach(el => {
      el.textContent = display.trim().charAt(0).toUpperCase() || "?";
    });
    document.querySelectorAll("[data-dashboard-link]").forEach(el => {
      el.href = window.BCCAuth.routeForUser(user);
    });
    document.querySelectorAll("[data-admin-return]").forEach(el => {
      el.hidden = !(user.role === "admin" || permissions.includes("admin:view"));
    });
    document.querySelectorAll("[data-cms-access]").forEach(el => {
      el.hidden = !(user.role === "admin" || permissions.includes("cms:access"));
    });
  }

  async function bindEmailManager(user, options = {}) {
    const list = document.querySelector(options.listSelector || "[data-account-emails]");
    const addForm = document.querySelector(options.addFormSelector || "[data-email-add-form]");
    const confirmForm = document.querySelector(options.confirmFormSelector || "[data-email-confirm-form]");
    const confirmation = document.querySelector(options.confirmationSelector || "[data-email-confirmation]");
    const disclosure = addForm?.closest(".account-email-disclosure") || confirmForm?.closest(".account-email-disclosure");
    const disclosureLabel = disclosure?.querySelector("[data-email-disclosure-label]");
    const disclosureNote = disclosure?.querySelector("[data-email-disclosure-note]");
    const messageSelector = options.messageSelector || "[data-email-message]";
    if (!list) return;

    let emails = Array.isArray(user.emails) && user.emails.length
      ? user.emails
      : [{ id: "primary", email: user.email, primary: true, confirmed: true }];

    const setMessage = (text, tone = "ok") => {
      const message = document.querySelector(messageSelector);
      if (!message) return;
      renderMessageBlock(message, text, tone);
      message.hidden = !text;
    };

    const handleUserUpdate = nextUser => {
      if (!nextUser) return;
      options.onUserUpdate?.(nextUser);
    };

    const refresh = async () => {
      const data = await window.BCCAuth.api("/api/account/emails");
      emails = data.emails || [];
      renderAccountEmails(emails);
    };

    const syncEmailConfirmation = ({ reveal = false } = {}) => {
      if (!confirmation || !confirmForm) return;
      const pending = emails.find(item => !item.confirmed);
      confirmation.hidden = !pending;
      if (disclosureLabel) disclosureLabel.textContent = pending ? "Confirmar correo pendiente" : "Gestionar correos";
      if (disclosureNote) disclosureNote.textContent = pending ? "Introduce el código recibido" : "Añadir un correo";
      if (!pending) return;
      if (confirmForm.elements.email && confirmForm.elements.email.value !== pending.email) {
        confirmForm.elements.email.value = pending.email;
      }
      if (reveal && disclosure) disclosure.open = true;
    };

    const renderAccountEmails = items => {
      if (!items.length) {
        list.innerHTML = `<p class="muted-text">No hay correos registrados.</p>`;
        return;
      }
      list.replaceChildren(...items.map(item => {
        const row = document.createElement("div");
        row.className = [
          "account-email-row",
          item.primary && "is-primary",
          !item.confirmed && "is-pending"
        ].filter(Boolean).join(" ");
        row.dataset.emailId = item.id;

        const meta = document.createElement("div");
        meta.innerHTML = `
          <strong>${escapeHtml(item.email)}</strong>
          <span>${item.primary ? "Principal" : "Adicional"} · ${item.confirmed ? "Confirmado" : "Pendiente de confirmación"}</span>
        `;

        const actions = document.createElement("div");
        actions.className = "account-email-actions";
        if (!item.primary && item.confirmed) {
          const primaryButton = document.createElement("button");
          primaryButton.type = "button";
          primaryButton.className = "btn btn-ghost";
          primaryButton.dataset.emailPrimary = item.id;
          primaryButton.textContent = "Hacer principal";
          actions.append(primaryButton);
        }
        if (!item.primary) {
          const deleteButton = document.createElement("button");
          deleteButton.type = "button";
          deleteButton.className = "btn btn-ghost";
          deleteButton.dataset.emailDelete = item.id;
          deleteButton.textContent = "Eliminar";
          actions.append(deleteButton);
        }
        row.append(meta, actions);
        return row;
      }));
      syncEmailConfirmation();
      refreshIcons();
    };

    list.addEventListener("click", async event => {
      const primaryButton = event.target.closest("[data-email-primary]");
      const deleteButton = event.target.closest("[data-email-delete]");
      if (!primaryButton && !deleteButton) return;
      setMessage("");
      try {
        if (primaryButton) {
          const data = await window.BCCAuth.api(`/api/account/emails/${encodeURIComponent(primaryButton.dataset.emailPrimary)}/primary`, { method: "PATCH" });
          handleUserUpdate(data.user);
          emails = data.emails || emails;
          renderAccountEmails(emails);
          setMessage(data.pendingAuthConfirmation ? "Revisa tu correo para completar el cambio del correo principal." : "Correo principal actualizado.");
        }
        if (deleteButton) {
          const data = await window.BCCAuth.api(`/api/account/emails/${encodeURIComponent(deleteButton.dataset.emailDelete)}`, { method: "DELETE" });
          emails = data.emails || emails;
          renderAccountEmails(emails);
          setMessage("Correo eliminado.");
        }
      } catch (error) {
        setMessage(error.message, "error");
      }
    });

    addForm?.addEventListener("submit", async event => {
      event.preventDefault();
      setMessage("");
      try {
        const addedEmail = addForm.elements.email.value;
        const data = await window.BCCAuth.api("/api/account/emails", {
          method: "POST",
          body: JSON.stringify({ email: addedEmail })
        });
        emails = data.emails || emails;
        renderAccountEmails(emails);
        if (!confirmation && confirmForm?.elements.email) confirmForm.elements.email.value = addedEmail;
        addForm.reset();
        syncEmailConfirmation({ reveal: true });
        setMessage("Correo agregado. Revisa ese buzón para obtener el código de confirmación.");
      } catch (error) {
        setMessage(error.message, "error");
      }
    });

    confirmForm?.addEventListener("submit", async event => {
      event.preventDefault();
      setMessage("");
      try {
        const data = await window.BCCAuth.api("/api/account/emails/confirm", {
          method: "POST",
          body: JSON.stringify({
            email: confirmForm.elements.email.value,
            token: confirmForm.elements.token.value
          })
        });
        emails = data.emails || emails;
        renderAccountEmails(emails);
        confirmForm.reset();
        setMessage("Correo confirmado.");
      } catch (error) {
        setMessage(error.message, "error");
      }
    });

    renderAccountEmails(emails);
    refresh().catch(error => setMessage(error.message, "error"));
  }

  function hydrateProfileForm(user, options = {}) {
    const form = document.querySelector(options.formSelector || "[data-profile-form]");
    if (!form) return;
    form.elements.name.value = user.name || "";
    form.elements.company.value = user.company || "";
    form.elements.title.value = user.title || "";
    const message = document.querySelector(options.messageSelector || "[data-profile-message]");
    const saveButton = form.querySelector('button[type="submit"]');
    const fields = [form.elements.name, form.elements.company, form.elements.title].filter(Boolean);
    const snapshot = () => fields.map(field => field.value).join("\u0000");
    let baseline = snapshot();

    const syncSaveState = () => {
      const dirty = snapshot() !== baseline;
      form.dataset.dirty = String(dirty);
      if (saveButton) saveButton.disabled = !dirty;
      if (dirty && message?.dataset.tone === "ok") message.hidden = true;
    };

    fields.forEach(field => field.addEventListener("input", syncSaveState));
    syncSaveState();

    form.addEventListener("submit", async event => {
      event.preventDefault();
      if (snapshot() === baseline) return;
      try {
        const data = await window.BCCAuth.api("/api/auth/profile", {
          method: "PATCH",
          body: JSON.stringify({
            name: form.elements.name.value,
            company: form.elements.company.value,
            title: form.elements.title.value
          })
        });
        options.onUserUpdate?.(data.user);
        baseline = snapshot();
        syncSaveState();
        if (message) {
          message.textContent = "Cambios guardados.";
          message.dataset.tone = "ok";
          message.hidden = false;
        }
      } catch (error) {
        if (message) {
          message.textContent = error.message;
          message.dataset.tone = "error";
          message.hidden = false;
        }
      }
    });
  }

  function bindSecurityManager(options = {}) {
    const form = document.querySelector(options.formSelector || "[data-password-change-form]");
    const sessionButton = document.querySelector(options.sessionButtonSelector || "[data-signout-other-sessions]");
    if (!form && !sessionButton) return;

    const translate = value => window.BCCWorkspaceI18n?.t?.(value) || value;
    const passwordMessage = document.querySelector(options.passwordMessageSelector || "[data-password-change-message]");
    const sessionMessage = document.querySelector(options.sessionMessageSelector || "[data-session-message]");
    const setMessage = (element, text, tone = "ok") => {
      if (!element) return;
      renderMessageBlock(element, translate(text), tone);
      element.hidden = !text;
    };

    form?.addEventListener("submit", async event => {
      event.preventDefault();
      setMessage(passwordMessage, "");
      const submitButton = form.querySelector('button[type="submit"]');
      const currentPassword = String(form.elements.currentPassword?.value || "");
      const password = String(form.elements.password?.value || "");
      const confirmation = String(form.elements.confirmPassword?.value || "");

      if (password !== confirmation) {
        setMessage(passwordMessage, "Las contraseñas no coinciden.", "error");
        return;
      }
      if (!window.BCCAuth.validatePassword(password)) {
        setMessage(passwordMessage, "La contraseña debe tener al menos 8 caracteres, mayúscula, minúscula y un símbolo.", "error");
        return;
      }

      if (submitButton) submitButton.disabled = true;
      try {
        await window.BCCAuth.changePassword({ currentPassword, password });
        form.reset();
        setMessage(passwordMessage, "Contraseña actualizada. Ya puedes usarla en BCC y MAP.");
      } catch (error) {
        setMessage(passwordMessage, error.message, "error");
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    });

    sessionButton?.addEventListener("click", async () => {
      setMessage(sessionMessage, "");
      if (!window.confirm(translate("¿Cerrar las sesiones abiertas en otros navegadores y dispositivos?"))) return;
      sessionButton.disabled = true;
      try {
        await window.BCCAuth.signOutOtherSessions();
        setMessage(sessionMessage, "Las otras sesiones se cerraron correctamente.");
      } catch (error) {
        setMessage(sessionMessage, error.message, "error");
      } finally {
        sessionButton.disabled = false;
      }
    });
  }

  function renderPermissions(user, options = {}) {
    const permissions = document.querySelector(options.selector || "[data-permissions]");
    if (!permissions) return;
    const label = options.permissionLabel || defaultPermissionLabel;
    const values = Array.isArray(user.permissions) ? user.permissions : [];
    const labels = (options.unique === false ? values : [...new Set(values)])
      .map(label)
      .filter(Boolean);
    permissions.replaceChildren(...labels.map(text => {
      const li = document.createElement("li");
      li.textContent = text;
      return li;
    }));
  }

  window.BCCWorkspaceAccount = {
    hydrateAccountMenu,
    bindEmailManager,
    hydrateProfileForm,
    bindSecurityManager,
    renderPermissions
  };
})();
