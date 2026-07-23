(() => {
  const root = document.body;
  const sidebar = document.querySelector(".workspace-sidebar");
  const menuButton = document.querySelector("[data-workspace-menu]");
  const collapseButton = document.querySelector("[data-workspace-collapse]");
  const backdrop = document.querySelector("[data-workspace-backdrop]");
  const mobileQuery = window.matchMedia("(max-width: 900px)");
  const collapseKey = "bcc-workspace-shell:v2:collapsed";
  const legacyCollapseKey = "bcc-workspace-sidebar-collapsed";
  let focusBeforeMobileNav = null;

  if (!sidebar) return;

  const focusables = () => [...sidebar.querySelectorAll(
    'a[href]:not([hidden]), button:not([disabled]):not([hidden]), select:not([disabled]):not([hidden]), [tabindex]:not([tabindex="-1"]):not([hidden])'
  )].filter(element => !element.closest("[hidden]"));

  function setMobileNav(open, options = {}) {
    const nextOpen = Boolean(open && mobileQuery.matches);
    if (nextOpen) focusBeforeMobileNav = document.activeElement;
    root.classList.toggle("workspace-nav-open", nextOpen);
    menuButton?.setAttribute("aria-expanded", String(nextOpen));
    menuButton?.setAttribute("aria-label", nextOpen ? "Cerrar navegación" : "Abrir navegación");
    if (nextOpen) {
      window.requestAnimationFrame(() => focusables()[0]?.focus());
    } else if (options.restoreFocus !== false && focusBeforeMobileNav?.focus) {
      focusBeforeMobileNav.focus();
      focusBeforeMobileNav = null;
    }
  }

  const closeMobileNav = options => setMobileNav(false, options);

  function setCollapsed(collapsed, persist = true) {
    const next = Boolean(collapsed && !mobileQuery.matches);
    root.classList.toggle("workspace-collapsed", next);
    collapseButton?.classList.toggle("is-collapsed", next);
    collapseButton?.setAttribute("aria-expanded", String(!next));
    collapseButton?.setAttribute("aria-label", next ? "Expandir navegación" : "Contraer navegación");
    collapseButton?.setAttribute("title", next ? "Expandir navegación" : "Contraer navegación");
    window.BCCWorkspaceNavigation?.syncTooltips?.(next);
    if (persist) {
      try { localStorage.setItem(collapseKey, String(next)); } catch {}
    }
  }

  function readCollapsedState() {
    try {
      const current = localStorage.getItem(collapseKey);
      const legacy = localStorage.getItem(legacyCollapseKey);
      if (legacy !== null) localStorage.removeItem(legacyCollapseKey);
      return (current ?? legacy) === "true";
    } catch {
      return false;
    }
  }

  function enhanceHelp() {
    const help = sidebar.querySelector(".workspace-help");
    const heading = help?.querySelector(":scope > strong");
    if (!help || !heading || help.dataset.enhanced) return;
    help.dataset.enhanced = "true";
    const content = document.createElement("div");
    content.className = "workspace-help-content";
    [...help.children].filter(child => child !== heading).forEach(child => content.append(child));
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "workspace-help-trigger";
    trigger.innerHTML = `<span>${heading.textContent}</span><span aria-hidden="true">⌄</span>`;
    heading.remove();
    help.prepend(trigger, content);
    const key = `bcc-workspace-shell:v1:help:${document.body.classList.contains("staff-workspace") ? "staff" : "client"}`;
    let open = false;
    try { open = localStorage.getItem(key) === "true"; } catch {}
    const update = value => {
      help.classList.toggle("is-open", value);
      trigger.setAttribute("aria-expanded", String(value));
      content.hidden = !value;
      try { localStorage.setItem(key, String(value)); } catch {}
    };
    update(open);
    trigger.addEventListener("click", () => update(!help.classList.contains("is-open")));
  }

  setCollapsed(readCollapsedState(), false);
  enhanceHelp();
  menuButton?.setAttribute("aria-expanded", "false");
  menuButton?.addEventListener("click", () => setMobileNav(!root.classList.contains("workspace-nav-open")));
  collapseButton?.addEventListener("click", () => setCollapsed(!root.classList.contains("workspace-collapsed")));
  backdrop?.addEventListener("click", () => closeMobileNav());

  sidebar.addEventListener("click", event => {
    if (event.target.closest("a") && mobileQuery.matches) closeMobileNav({ restoreFocus: false });
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && root.classList.contains("workspace-nav-open")) {
      event.preventDefault();
      closeMobileNav();
      return;
    }
    if (event.key !== "Tab" || !root.classList.contains("workspace-nav-open")) return;
    const items = focusables();
    if (!items.length) return;
    const first = items[0];
    const last = items.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  const handleBreakpoint = () => {
    if (!mobileQuery.matches) closeMobileNav({ restoreFocus: false });
    setCollapsed(readCollapsedState(), false);
  };
  mobileQuery.addEventListener?.("change", handleBreakpoint);

  const sectionLinks = [...sidebar.querySelectorAll('a[href^="#"]')];
  const hasWorkspaceViews = Boolean(document.querySelector("[data-workspace-view]"));
  const sections = sectionLinks.map(link => document.querySelector(link.getAttribute("href"))).filter(Boolean);
  if (!hasWorkspaceViews && sections.length && "IntersectionObserver" in window) {
    const updateActiveSection = () => {
      const anchor = 96;
      const current = sections.reduce((closest, section) => {
        const distance = Math.abs(section.getBoundingClientRect().top - anchor);
        return !closest || distance < closest.distance ? { section, distance } : closest;
      }, null)?.section;
      if (!current) return;
      sectionLinks.forEach(link => link.classList.toggle("active", link.hash === `#${current.id}`));
    };
    const observer = new IntersectionObserver(updateActiveSection, { rootMargin: "-10% 0px -55%" });
    sections.forEach(section => observer.observe(section));
    updateActiveSection();
  }

  const workspaceSearch = document.querySelector("[data-workspace-search]");
  const searchableSelector = "[data-workspace-searchable], .priority-card, .resource-rows > a, .tool-rows > div, .status-list > a, .admin-action-list > a, .staff-hub-actions > a, .staff-timeline-list > a, .staff-resource-list > a";
  workspaceSearch?.addEventListener("input", () => {
    const query = workspaceSearch.value.trim().toLocaleLowerCase();
    document.querySelectorAll(searchableSelector).forEach(row => {
      row.hidden = Boolean(query) && !row.textContent.toLocaleLowerCase().includes(query);
    });
  });

  window.BCCWorkspaceShell = { closeMobileNav, setCollapsed, setMobileNav };
})();
