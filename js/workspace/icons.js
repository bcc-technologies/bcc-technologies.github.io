/* Local Lucide-compatible icon subset for BCC Workspace dashboards. */
(() => {
  const paths = {
    "calendar-plus": '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M12 14v6"/><path d="M9 17h6"/>',
    "contact-round": '<path d="M16 18a4 4 0 0 0-8 0"/><circle cx="12" cy="11" r="3"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M8 2v4"/><path d="M16 2v4"/>',
    "file-check-2": '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v6h6"/><path d="m9 15 2 2 4-4"/>',
    "file-plus-2": '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v6h6"/><path d="M12 18v-6"/><path d="M9 15h6"/>',
    "layout-grid": '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
    "library": '<path d="m16 6 4 14"/><path d="M12 6v14"/><path d="M8 8v12"/><path d="M4 4v16"/>',
    "list-plus": '<path d="M11 12H3"/><path d="M16 6H3"/><path d="M16 18H3"/><path d="M18 9v6"/><path d="M15 12h6"/>',
    "lock-keyhole": '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><circle cx="12" cy="16" r="1"/>',
    "message-square-text": '<path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 8h8"/><path d="M8 12h6"/>',
    "newspaper": '<path d="M4 22h14a2 2 0 0 0 2-2V4H6a2 2 0 0 0-2 2v16Z"/><path d="M2 10h4"/><path d="M8 8h8"/><path d="M8 12h8"/><path d="M8 16h5"/>',
    "refresh-cw": '<path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/>',
    "user-round-cog": '<circle cx="10" cy="8" r="4"/><path d="M2 21a8 8 0 0 1 12-6.9"/><circle cx="18" cy="17" r="3"/><path d="M18 13v1"/><path d="M18 20v1"/><path d="M14.5 15l.9.5"/><path d="M20.6 18.5l.9.5"/><path d="M14.5 19l.9-.5"/><path d="M20.6 15.5l.9-.5"/>',
    "activity": '<path d="M22 12h-4l-3 8L9 4l-3 8H2"/>',
    "badge-check": '<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.78 4.78 4 4 0 0 1-6.74 0 4 4 0 0 1-4.78-4.78 4 4 0 0 1 0-6.75z"/><path d="m9 12 2 2 4-4"/>',
    "book-open-text": '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/><path d="M6 8h2"/><path d="M6 12h2"/><path d="M16 8h2"/><path d="M16 12h2"/>',
    "boxes": '<path d="m7.5 4.27 4.5 2.6 4.5-2.6"/><path d="M3 8l4.5 2.6L12 8l4.5 2.6L21 8"/><path d="M3 8v6l4.5 2.6V10.6"/><path d="M12 8v6l4.5 2.6v-6"/><path d="M21 8v6l-4.5 2.6"/><path d="M7.5 16.6 12 19.2l4.5-2.6"/>',
    "calendar-days": '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/>',
    "clock-3": '<circle cx="12" cy="12" r="10"/><path d="M12 6v6h4"/>',
    "command": '<path d="M18 6a3 3 0 0 0-3-3h-1v6h1a3 3 0 0 0 3-3Z"/><path d="M6 6a3 3 0 0 1 3-3h1v6H9a3 3 0 0 1-3-3Z"/><path d="M18 18a3 3 0 0 1-3 3h-1v-6h1a3 3 0 0 1 3 3Z"/><path d="M6 18a3 3 0 0 0 3 3h1v-6H9a3 3 0 0 0-3 3Z"/><path d="M10 9h4v6h-4z"/>',
    "file-bar-chart": '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v6h6"/><path d="M8 18v-4"/><path d="M12 18v-7"/><path d="M16 18v-2"/>',
    "folder-kanban": '<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.5l-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z"/><path d="M8 10v6"/><path d="M12 10v4"/><path d="M16 10v7"/>',
    "folder-lock": '<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.5l-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z"/><rect width="8" height="5" x="8" y="13" rx="1"/><path d="M10 13v-2a2 2 0 1 1 4 0v2"/>',
    "home": '<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/>',
    "key-round": '<path d="M2 18a6 6 0 1 0 10.6-3.8L22 4.8V2h-2.8l-1.7 1.7V6h-2.3L13 8.2"/><circle cx="8" cy="18" r="2"/>',
    "library-big": '<rect width="8" height="18" x="3" y="3" rx="1"/><rect width="8" height="18" x="13" y="3" rx="1"/><path d="M7 7h.01"/><path d="M17 7h.01"/><path d="M7 17h.01"/><path d="M17 17h.01"/>',
    "mail-check": '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a2 2 0 0 1-2.06 0L2 7"/><path d="m9 16 2 2 4-4"/>',
    "mail-plus": '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a2 2 0 0 1-2.06 0L2 7"/><path d="M12 17h6"/><path d="M15 14v6"/>',
    "notebook-tabs": '<path d="M2 6h4"/><path d="M2 10h4"/><path d="M2 14h4"/><path d="M2 18h4"/><rect width="16" height="20" x="4" y="2" rx="2"/><path d="M15 2v6h5"/>',
    "panel-right": '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/>',
    "pencil": '<path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>',
    "radar": '<path d="M19.07 4.93A10 10 0 1 1 4.93 19.07"/><path d="M13.41 10.59a2 2 0 1 1-2.82 2.82"/><path d="M7.76 16.24a6 6 0 0 1 8.48-8.48"/><path d="M12 12 19 5"/>',
    "receipt-text": '<path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 1 .67V2Z"/><path d="M8 7h8"/><path d="M8 11h8"/><path d="M8 15h5"/>',
    "save": '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/>',
    "send": '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    "sparkles": '<path d="m12 3-1.9 5.8L4 10.5l6.1 1.7L12 18l1.9-5.8 6.1-1.7-6.1-1.7Z"/><path d="M5 3v4"/><path d="M3 5h4"/><path d="M19 17v4"/><path d="M17 19h4"/>',
    "user-cog": '<circle cx="10" cy="8" r="4"/><path d="M2 21a8 8 0 0 1 12-6.9"/><circle cx="18" cy="17" r="3"/><path d="M18 13v1"/><path d="M18 20v1"/><path d="M14.5 15l.9.5"/><path d="M20.6 18.5l.9.5"/><path d="M14.5 19l.9-.5"/><path d="M20.6 15.5l.9-.5"/>',
    "workflow": '<rect width="6" height="6" x="3" y="3" rx="1"/><rect width="6" height="6" x="15" y="15" rx="1"/><path d="M9 6h4a3 3 0 0 1 3 3v6"/><path d="m13 12 3 3 3-3"/>',
    "wrench": '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.4 2.4-3-3Z"/>',
    "arrow-left": '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
    "book-open": '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    "briefcase-business": '<path d="M12 12h.01"/><path d="M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><path d="M22 13a18.15 18.15 0 0 1-20 0"/><rect width="20" height="14" x="2" y="6" rx="2"/>',
    "check": '<path d="M20 6 9 17l-5-5"/>',
    "check-circle-2": '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>',
    "chevron-down": '<path d="m6 9 6 6 6-6"/>',
    "chevron-right": '<path d="m9 18 6-6-6-6"/>',
    "chart-no-axes-column-increasing": '<path d="M5 21v-6"/><path d="M12 21V9"/><path d="M19 21V3"/>',
    "clipboard-check": '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
    "clipboard-list": '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
    "columns-3": '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="M15 3v18"/>',
    "external-link": '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    "file-down": '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v6h6"/><path d="M12 18v-6"/><path d="m9 15 3 3 3-3"/>',
    "file-text": '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v6h6"/><path d="M10 13h4"/><path d="M10 17h4"/>',
    "file-pen-line": '<path d="M12 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6"/><path d="M16 3.5a2.1 2.1 0 0 1 3 3L12 13.5 8 14l.5-4Z"/><path d="M8 18h8"/>',
    "flask-conical": '<path d="M10 2v7.31"/><path d="M14 9.3V1.99"/><path d="M8.5 2h7"/><path d="M14 9.3 19.93 19a2 2 0 0 1-1.7 3H5.77a2 2 0 0 1-1.7-3L10 9.3"/><path d="M6.5 16h11"/>',
    "folder-open": '<path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/>',
    "headset": '<path d="M3 11a9 9 0 0 1 18 0"/><path d="M21 16v-5"/><path d="M3 11v5"/><path d="M21 16a5 5 0 0 1-5 5h-4"/><rect width="4" height="6" x="3" y="13" rx="2"/><rect width="4" height="6" x="17" y="13" rx="2"/>',
    "history": '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v6h6"/><path d="M12 7v5l4 2"/>',
    "inbox": '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="m5.45 5.11-3.38 6.65A2 2 0 0 0 2 12.5V19a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6.5a2 2 0 0 0-.07-.74l-3.38-6.65A2 2 0 0 0 16.74 4H7.26a2 2 0 0 0-1.81 1.11z"/>',
    "layout-dashboard": '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
    "list-checks": '<path d="m3 7 2 2 4-4"/><path d="m3 17 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/>',
    "life-buoy": '<circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24"/><path d="m14.83 9.17 4.24-4.24"/><path d="m14.83 14.83 4.24 4.24"/><path d="m9.17 14.83-4.24 4.24"/><circle cx="12" cy="12" r="4"/>',
    "mail": '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a2 2 0 0 1-2.06 0L2 7"/>',
    "menu": '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>',
    "messages-square": '<path d="M7 10h10"/><path d="M7 14h6"/><rect width="18" height="14" x="3" y="3" rx="2"/><path d="M8 21 12 17"/>',
    "microscope": '<path d="M6 18h8"/><path d="M3 22h18"/><path d="M14 22a7 7 0 1 0 0-14h-1"/><path d="M9 14h2"/><path d="M9 12a2 2 0 0 1-2-2V6h6v4a2 2 0 0 1-2 2Z"/><path d="M12 6V3h3"/>',
    "monitor": '<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>',
    "package": '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="M3.3 7 12 12l8.7-5"/><path d="M12 22V12"/>',
    "package-search": '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l3-1.72"/><path d="M3.3 7 12 12l8.7-5"/><path d="M12 22V12"/><circle cx="18.5" cy="15.5" r="2.5"/><path d="m20.27 17.27 1.73 1.73"/>',
    "panel-left-close": '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="m16 15-3-3 3-3"/>',
    "panels-top-left": '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/>',
    "plus": '<path d="M5 12h14"/><path d="M12 5v14"/>',
    "search": '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    "shield-check": '<path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3z"/><path d="m9 12 2 2 4-4"/>',
    "sliders-horizontal": '<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>',
    "calendar-clock": '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M12 14v3l2 1"/>',
    "trash-2": '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6 18 20H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>',
    "arrow-right": '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    "sun-moon": '<path d="M12 8a2.83 2.83 0 0 0 4 4 4 4 0 1 1-4-4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.9 4.9 1.4 1.4"/><path d="m17.7 17.7 1.4 1.4"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.3 17.7-1.4 1.4"/><path d="m19.1 4.9-1.4 1.4"/>',
    "user-round": '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
    "users-round": '<path d="M18 21a8 8 0 0 0-16 0"/><circle cx="10" cy="7" r="4"/><path d="M22 21a8 8 0 0 0-7-7.93"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    "x": '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'
  };

  function createIcons(root = document) {
    root.querySelectorAll("[data-lucide]").forEach(node => {
      const path = paths[node.dataset.lucide];
      if (!path) return;
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("fill", "none");
      svg.setAttribute("stroke", "currentColor");
      svg.setAttribute("stroke-width", "2");
      svg.setAttribute("stroke-linecap", "round");
      svg.setAttribute("stroke-linejoin", "round");
      svg.setAttribute("aria-hidden", "true");
      svg.innerHTML = path;
      node.replaceWith(svg);
    });
  }

  window.BCCWorkspaceIcons = { createIcons };
})();
