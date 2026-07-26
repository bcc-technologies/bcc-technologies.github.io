/* Renderer and stable facade for registered workspace icon catalogs. */
(() => {
  const library = window.BCCWorkspaceIconLibrary;
  const ICON_SIZES = new Set(["xs", "sm", "md", "lg", "xl"]);

  function createIcons(root = document) {
    root.querySelectorAll("[data-lucide]").forEach(node => {
      const requestedName = node.dataset.lucide || "circle-help";
      const pathMarkup = library.resolve(requestedName);
      const fallbackMarkup = library.resolve("circle-help");
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      const requestedSize = node.dataset.iconSize;
      svg.classList.add("workspace-icon", `workspace-icon--${ICON_SIZES.has(requestedSize) ? requestedSize : "md"}`);
      svg.dataset.workspaceIcon = requestedName;
      if (!pathMarkup) svg.classList.add("workspace-icon--fallback");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("fill", "none");
      svg.setAttribute("stroke", "currentColor");
      svg.setAttribute("stroke-width", "2");
      svg.setAttribute("stroke-linecap", "round");
      svg.setAttribute("stroke-linejoin", "round");
      svg.setAttribute("aria-hidden", "true");
      svg.innerHTML = pathMarkup || fallbackMarkup || "";
      node.replaceWith(svg);
    });
  }

  window.BCCWorkspaceIcons = Object.freeze({
    createIcons,
    has: library.has,
    catalogNames: library.catalogNames
  });
  createIcons(document);
  window.performance?.mark?.("bcc:icons-ready");
  window.BCCWorkspaceEvents.emit("iconsReady");
})();
