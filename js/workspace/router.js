(() => {
  function bind(options = {}) {
    const views = [...document.querySelectorAll("[data-workspace-view]")];
    if (!views.length) return null;

    const links = [...document.querySelectorAll('.workspace-nav a[href^="#"], .workspace-main a[href^="#"], .account-dropdown a[href^="#"]')];
    const sidebarLinks = [...document.querySelectorAll('.workspace-nav a[href^="#"]')];
    const title = document.querySelector("[data-workspace-view-title]");
    const viewIds = new Set(views.map(view => view.id));
    const defaultView = options.defaultView || "resumen";
    const aliases = options.aliases || {};
    const panelAliases = options.panelAliases || {};
    const panels = options.panels || {};

    const canonicalViewId = id => aliases[id] || id || defaultView;

    const parseRoute = value => {
      const clean = String(value || "").replace(/^#/, "");
      const [viewId = "", panelId = ""] = clean.split("/");
      return { viewId, panelId };
    };

    const panelFor = (requestedId, viewId, requestedPanel = "") => {
      const allowed = panels[viewId] || [];
      if (!allowed.length) return panelAliases[requestedId] || "";
      const candidate = requestedPanel || panelAliases[requestedId] || allowed[0];
      return allowed.includes(candidate) ? candidate : allowed[0];
    };

    const routeHash = (viewId, panelId = "") => `#${viewId}${panelId ? `/${panelId}` : ""}`;

    const showView = (id, showOptions = {}) => {
      const requestedId = id || defaultView;
      const canonicalId = canonicalViewId(requestedId);
      const nextId = viewIds.has(canonicalId) ? canonicalId : defaultView;
      const panelId = panelFor(requestedId, nextId, showOptions.panelId);

      views.forEach(view => {
        view.hidden = view.id !== nextId;
      });
      sidebarLinks.forEach(link => {
        const linkId = parseRoute(link.getAttribute("href")).viewId;
        const active = canonicalViewId(linkId) === nextId;
        link.classList.toggle("active", active);
        if (active) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      });

      const activeView = views.find(view => view.id === nextId);
      if (title && activeView?.dataset.viewTitle) title.textContent = activeView.dataset.viewTitle;
      if (activeView?.dataset.viewTitle) document.title = `${activeView.dataset.viewTitle} - BCC`;

      options.onShow?.({ requestedId, nextId, panelId, activeView });

      if (showOptions.scroll !== false) {
        document.querySelector(".workspace-content")?.scrollTo({ top: 0, behavior: "auto" });
        window.scrollTo({ top: 0, behavior: "auto" });
      }
      return { requestedId, nextId, panelId, activeView };
    };

    const showRoute = (value, routeOptions = {}) => {
      const parsed = parseRoute(value);
      const result = showView(parsed.viewId, {
        panelId: parsed.panelId,
        scroll: routeOptions.scroll
      });
      const canonical = routeHash(result.nextId, result.panelId);
      const supplied = String(value || "").replace(/^#/, "");
      if (supplied && `#${supplied}` !== canonical && routeOptions.normalize !== false) {
        window.history.replaceState(null, "", canonical);
      }
      return result;
    };

    const navigate = (id, navigateOptions = {}) => {
      const requestedId = id || defaultView;
      const nextId = viewIds.has(canonicalViewId(requestedId)) ? canonicalViewId(requestedId) : defaultView;
      const panelId = panelFor(requestedId, nextId, navigateOptions.panelId);
      const nextHash = routeHash(nextId, panelId);
      if (window.location.hash !== nextHash) {
        const method = navigateOptions.replace ? "replaceState" : "pushState";
        window.history[method](null, "", nextHash);
      }
      const result = showView(requestedId, { panelId, scroll: navigateOptions.scroll });
      window.BCCWorkspaceShell?.closeMobileNav?.();
      return result;
    };

    links.forEach(link => {
      link.addEventListener("click", event => {
        const href = link.getAttribute("href") || "";
        if (!href.startsWith("#")) return;
        const parsed = parseRoute(href);
        const nextId = canonicalViewId(parsed.viewId);
        if (!viewIds.has(nextId)) return;

        event.preventDefault();
        const panelId = link.dataset.workspacePanelLink
          || link.dataset.workPanelLink
          || link.dataset.intelPanelLink
          || link.dataset.businessPanelLink
          || parsed.panelId
          || panelAliases[parsed.viewId]
          || "";
        navigate(parsed.viewId, { panelId });
      });
    });

    window.addEventListener("popstate", () => showRoute(window.location.hash, { normalize: false }));
    showRoute(window.location.hash);

    return { showView, showRoute, navigate, canonicalViewId, parseRoute };
  }

  window.BCCWorkspaceRouter = { bind };
})();
