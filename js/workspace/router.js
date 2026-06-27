(() => {
  function bind(options = {}) {
    const views = [...document.querySelectorAll("[data-workspace-view]")];
    if (!views.length) return null;

    const links = [...document.querySelectorAll('.workspace-nav a[href^="#"], .workspace-main a[href^="#"]')];
    const sidebarLinks = [...document.querySelectorAll('.workspace-nav a[href^="#"]')];
    const title = document.querySelector("[data-workspace-view-title]");
    const viewIds = new Set(views.map(view => view.id));
    const defaultView = options.defaultView || "resumen";
    const aliases = options.aliases || {};
    const panelAliases = options.panelAliases || {};

    const canonicalViewId = id => aliases[id] || id || defaultView;

    const showView = (id, showOptions = {}) => {
      const requestedId = id || defaultView;
      const canonicalId = canonicalViewId(requestedId);
      const nextId = viewIds.has(canonicalId) ? canonicalId : defaultView;
      const panelId = showOptions.panelId || panelAliases[requestedId] || "";

      views.forEach(view => {
        view.hidden = view.id !== nextId;
      });
      sidebarLinks.forEach(link => {
        const linkId = link.getAttribute("href").slice(1);
        link.classList.toggle("active", canonicalViewId(linkId) === nextId);
      });

      const activeView = views.find(view => view.id === nextId);
      if (title && activeView?.dataset.viewTitle) title.textContent = activeView.dataset.viewTitle;

      options.onShow?.({ requestedId, nextId, panelId, activeView });

      if (showOptions.scroll !== false) {
        document.querySelector(".workspace-content")?.scrollTo({ top: 0, behavior: "auto" });
        window.scrollTo({ top: 0, behavior: "auto" });
      }
    };

    links.forEach(link => {
      link.addEventListener("click", event => {
        const href = link.getAttribute("href") || "";
        if (!href.startsWith("#")) return;
        const id = href.slice(1);
        const nextId = canonicalViewId(id);
        if (!viewIds.has(nextId)) return;

        event.preventDefault();
        const panelId = link.dataset.workPanelLink || panelAliases[id] || "";
        if (window.location.hash !== `#${nextId}`) {
          window.history.pushState(null, "", `#${nextId}`);
        }
        showView(id, { panelId });
        window.BCCWorkspaceShell?.closeMobileNav?.();
      });
    });

    window.addEventListener("popstate", () => showView(window.location.hash.slice(1)));
    showView(window.location.hash.slice(1));

    return { showView, canonicalViewId };
  }

  window.BCCWorkspaceRouter = { bind };
})();
