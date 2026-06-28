(() => {
  const root = document.body;
  const nav = document.querySelector(".workspace-sidebar");
  const menuButton = document.querySelector("[data-workspace-menu]");
  const collapseButton = document.querySelector("[data-workspace-collapse]");
  const backdrop = document.querySelector("[data-workspace-backdrop]");
  const localKey = "bcc-workspace-sidebar-collapsed";

  if (!nav) return;

  const setMobileNav = open => {
    root.classList.toggle("workspace-nav-open", open);
    menuButton?.setAttribute("aria-expanded", String(open));
  };

  const closeMobileNav = () => setMobileNav(false);

  const setCollapsed = collapsed => {
    root.classList.toggle("workspace-collapsed", collapsed);
    collapseButton?.setAttribute("aria-expanded", String(!collapsed));
    collapseButton?.setAttribute("aria-label", collapsed ? "Expandir navegacion" : "Contraer navegacion");
    try {
      window.localStorage.setItem(localKey, String(collapsed));
    } catch {}
  };

  try {
    setCollapsed(window.localStorage.getItem(localKey) === "true");
  } catch {
    setCollapsed(false);
  }

  menuButton?.setAttribute("aria-expanded", "false");
  menuButton?.addEventListener("click", () => {
    setMobileNav(!root.classList.contains("workspace-nav-open"));
  });

  collapseButton?.addEventListener("click", () => {
    setCollapsed(!root.classList.contains("workspace-collapsed"));
  });

  backdrop?.addEventListener("click", closeMobileNav);

  nav.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      if (window.matchMedia("(max-width: 900px)").matches) closeMobileNav();
    });
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeMobileNav();
  });

  const sectionLinks = [...nav.querySelectorAll('a[href^="#"]')];
  const hasWorkspaceViews = Boolean(document.querySelector("[data-workspace-view]"));
  const sections = sectionLinks
    .map(link => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

  if (!hasWorkspaceViews && sections.length && "IntersectionObserver" in window) {
    const updateActiveSection = () => {
      const anchor = 96;
      const current = sections.reduce((closest, section) => {
        const distance = Math.abs(section.getBoundingClientRect().top - anchor);
        return !closest || distance < closest.distance ? { section, distance } : closest;
      }, null)?.section;
      if (!current) return;
      sectionLinks.forEach(link => {
        link.classList.toggle("active", link.getAttribute("href") === `#${current.id}`);
      });
    };
    const observer = new IntersectionObserver(updateActiveSection, { rootMargin: "-10% 0px -55%" });
    sections.forEach(section => observer.observe(section));
    updateActiveSection();
  }

  const workspaceSearch = document.querySelector("[data-workspace-search]");
  const searchableSelector = "[data-workspace-searchable], .priority-card, .resource-rows > a, .tool-rows > div, .status-list > a, .admin-action-list > a, .staff-hub-actions > a, .staff-timeline-list > a, .staff-resource-list > a";
  const getSearchableRows = () => [...document.querySelectorAll(searchableSelector)];
  workspaceSearch?.addEventListener("input", () => {
    const query = workspaceSearch.value.trim().toLocaleLowerCase();
    getSearchableRows().forEach(row => {
      row.hidden = Boolean(query) && !row.textContent.toLocaleLowerCase().includes(query);
    });
  });

  window.BCCWorkspaceShell = { closeMobileNav, setCollapsed };
})();
