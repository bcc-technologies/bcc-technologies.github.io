(() => {
  const EVENT_LABELS = {
    page_view: "Vista de página",
    engaged_visit: "Visita comprometida",
    scroll_depth_50: "Scroll 50%",
    scroll_depth_90: "Scroll 90%",
    cta_click: "CTA general",
    contact_cta_click: "CTA a contacto",
    quote_cta_click: "CTA a cotización",
    quote_option_select: "Selección en cotización",
    contact_submit: "Formulario de contacto",
    form_submit: "Formulario enviado",
    email_click: "Click en email",
    phone_click: "Click en teléfono",
    whatsapp_click: "Click en WhatsApp",
    outbound_click: "Salida externa",
    product_filter_apply: "Filtro de productos",
    product_compare_add: "Producto añadido a comparar",
    product_compare_remove: "Producto removido de comparar",
    product_compare_clear: "Comparador limpiado",
    product_detail_open: "Ficha rápida abierta",
    product_cta_click: "CTA de producto",
    product_hero_tab_select: "Ruta de producto seleccionada",
    product_scroll_jump: "Salto a sección de producto",
    blog_search: "Búsqueda en blog",
    blog_tag_filter: "Filtro de blog",
    blog_post_open: "Post abierto desde índice",
    science_arxiv_filter: "Filtro de ArXiv",
    science_arxiv_paper_open: "Paper de ArXiv abierto",
    science_journal_open: "Post abierto desde Ciencia",
    science_widget_deck_open: "Tarjetero abierto",
    science_widget_template_catalog_open: "Catálogo de plantillas abierto",
    science_widget_template_apply: "Plantilla aplicada",
    science_widget_export_png: "Smartboard exportado a PNG",
    science_widget_export_csv: "Smartboard exportado a CSV",
    science_widget_share: "Smartboard compartido",
    science_widget_reset: "Smartboard reiniciado"
  };

  const DOMAIN_CARDS = {
    products: {
      title: "Productos",
      metrics: [
        { key: "filterApplies", label: "Filtros aplicados" },
        { key: "compareAdds", label: "Añadidos a comparar" },
        { key: "detailOpens", label: "Fichas rápidas" },
        { key: "ctaClicks", label: "CTAs de producto" }
      ],
      primaryList: { key: "topProducts", title: "Productos con más intención", mode: "label" },
      secondaryList: { key: "topEvents", title: "Señales de producto", mode: "event" }
    },
    blog: {
      title: "Blog",
      metrics: [
        { key: "searches", label: "Búsquedas" },
        { key: "tagFilters", label: "Filtros por tag" },
        { key: "postOpens", label: "Posts abiertos" }
      ],
      primaryList: { key: "topPosts", title: "Posts más abiertos", mode: "label" },
      secondaryList: { key: "topSearches", title: "Búsquedas frecuentes", mode: "label" }
    },
    science: {
      title: "Ciencia",
      metrics: [
        { key: "arxivFilters", label: "Filtros ArXiv" },
        { key: "paperOpens", label: "Papers abiertos" },
        { key: "deckOpens", label: "Tarjeteros abiertos" },
        { key: "templateApplies", label: "Plantillas aplicadas" }
      ],
      primaryList: { key: "topActions", title: "Acciones destacadas", mode: "label" },
      secondaryList: { key: "topEvents", title: "Señales de ciencia", mode: "event" }
    }
  };

  let root = null;
  let rangeDays = 30;
  const ANALYTICS_TIMEOUT_MS = 12000;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function number(value) {
    return new Intl.NumberFormat("es-DO").format(Number(value || 0));
  }

  function eventLabel(name) {
    return EVENT_LABELS[name] || String(name || "").replaceAll("_", " ") || "Evento";
  }

  function compactPath(path) {
    const clean = String(path || "").trim();
    return clean || "/";
  }

  function formatDate(value) {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("es-DO", {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function actorRoleLabel(role) {
    if (role === "admin") return "Admin";
    if (role === "staff") return "Staff";
    if (role === "client") return "Cliente";
    return "Interno";
  }

  function renderShell() {
    root.innerHTML = `
      <section class="users-surface analytics-surface">
        <div class="surface-toolbar analytics-toolbar">
          <div>
            <h2>Analytics del sitio</h2>
            <p class="muted-text" data-analytics-message>Cargando métricas...</p>
          </div>
          <div class="analytics-controls">
            <label class="analytics-range-field">
              <span>Rango</span>
              <select data-analytics-range aria-label="Seleccionar rango">
                <option value="7">7 días</option>
                <option value="30" selected>30 días</option>
                <option value="90">90 días</option>
              </select>
            </label>
            <button class="btn btn-ghost btn-compact" type="button" data-analytics-refresh>Actualizar</button>
          </div>
        </div>
        <section class="workspace-metrics analytics-metrics" aria-label="Resumen de analytics">
          <div><span>Page views</span><strong data-analytics-metric="pageViews">-</strong><small>Rango seleccionado</small></div>
          <div><span>Visitantes únicos</span><strong data-analytics-metric="uniqueVisitors">-</strong><small>Basado en visitor id</small></div>
          <div><span>Visitas comprometidas</span><strong data-analytics-metric="engagedVisits">-</strong><small>30s visibles</small></div>
          <div><span>Contactos enviados</span><strong data-analytics-metric="contactSubmits">-</strong><small>Formspree y contacto</small></div>
          <div><span>Señales de cotización</span><strong data-analytics-metric="quoteSignals">-</strong><small>CTAs y selecciones</small></div>
          <div><span>Clicks en CTA</span><strong data-analytics-metric="ctaClicks">-</strong><small>Botones internos</small></div>
        </section>
        <section class="analytics-grid">
          <article class="activity-surface analytics-card">
            <div class="activity-head">
              <h3>Tendencia diaria</h3>
              <span data-analytics-range-badge>30d</span>
            </div>
            <div class="analytics-trend" data-analytics-trend></div>
          </article>
          <article class="activity-surface analytics-card">
            <div class="activity-head">
              <h3>Páginas más vistas</h3>
              <span data-analytics-pages-count>0</span>
            </div>
            <div class="table-scroll analytics-table-wrap">
              <table class="account-table analytics-table">
                <thead>
                  <tr><th>Página</th><th>Views</th></tr>
                </thead>
                <tbody data-analytics-top-pages></tbody>
              </table>
            </div>
          </article>
          <article class="activity-surface analytics-card">
            <div class="activity-head">
              <h3>Señales más frecuentes</h3>
              <span data-analytics-events-count>0</span>
            </div>
            <div class="table-scroll analytics-table-wrap">
              <table class="account-table analytics-table">
                <thead>
                  <tr><th>Evento</th><th>Total</th></tr>
                </thead>
                <tbody data-analytics-top-events></tbody>
              </table>
            </div>
          </article>
          <article class="activity-surface analytics-card">
            <div class="activity-head">
              <h3>CTAs destacados</h3>
              <span data-analytics-ctas-count>0</span>
            </div>
            <div class="table-scroll analytics-table-wrap">
              <table class="account-table analytics-table">
                <thead>
                  <tr><th>CTA</th><th>Total</th></tr>
                </thead>
                <tbody data-analytics-top-ctas></tbody>
              </table>
            </div>
          </article>
        </section>
        <section class="analytics-domain-grid" data-analytics-domain-grid></section>
        <section class="analytics-grid">
          <article class="activity-surface analytics-card analytics-card-wide">
            <div class="activity-head">
              <h3>Acciones recientes</h3>
              <span data-analytics-recent-count>0</span>
            </div>
            <ol class="activity-feed" data-analytics-recent></ol>
          </article>
        </section>
        <section class="analytics-grid">
          <article class="activity-surface analytics-card analytics-card-wide">
            <div class="activity-head">
              <h3>Actividad interna</h3>
              <span data-analytics-internal-count>0</span>
            </div>
            <div class="analytics-domain-metrics" data-analytics-internal-metrics></div>
          </article>
          <article class="activity-surface analytics-card">
            <div class="activity-head">
              <h3>Páginas internas</h3>
              <span data-analytics-internal-pages-count>0</span>
            </div>
            <div class="table-scroll analytics-table-wrap">
              <table class="account-table analytics-table">
                <thead>
                  <tr><th>Página</th><th>Views</th></tr>
                </thead>
                <tbody data-analytics-internal-pages></tbody>
              </table>
            </div>
          </article>
          <article class="activity-surface analytics-card">
            <div class="activity-head">
              <h3>Eventos internos</h3>
              <span data-analytics-internal-events-count>0</span>
            </div>
            <div class="table-scroll analytics-table-wrap">
              <table class="account-table analytics-table">
                <thead>
                  <tr><th>Evento</th><th>Total</th></tr>
                </thead>
                <tbody data-analytics-internal-events></tbody>
              </table>
            </div>
          </article>
        </section>
        <section class="analytics-grid">
          <article class="activity-surface analytics-card analytics-card-wide">
            <div class="activity-head">
              <h3>Recientes internos</h3>
              <span data-analytics-internal-recent-count>0</span>
            </div>
            <ol class="activity-feed" data-analytics-internal-recent></ol>
          </article>
        </section>
      </section>
    `;

    root.querySelector("[data-analytics-range]")?.addEventListener("change", event => {
      rangeDays = Number.parseInt(event.target.value, 10) || 30;
      void loadAnalytics();
    });
    root.querySelector("[data-analytics-refresh]")?.addEventListener("click", () => void loadAnalytics());
  }

  function setMessage(text) {
    const message = root.querySelector("[data-analytics-message]");
    if (message) message.textContent = text;
  }

  function withTimeout(promise, timeoutMs, message) {
    let timerId = 0;
    const timeoutPromise = new Promise((_, reject) => {
      timerId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => {
      window.clearTimeout(timerId);
    });
  }

  function renderEmptyRows(target, colspan, message) {
    const row = document.createElement("tr");
    row.innerHTML = `<td class="table-empty" colspan="${colspan}">${escapeHtml(message)}</td>`;
    target.replaceChildren(row);
  }

  function renderMetrics(totals) {
    Object.entries(totals).forEach(([key, value]) => {
      const cell = root.querySelector(`[data-analytics-metric="${key}"]`);
      if (cell) cell.textContent = number(value);
    });
  }

  function renderTrend(items) {
    const target = root.querySelector("[data-analytics-trend]");
    const badge = root.querySelector("[data-analytics-range-badge]");
    if (!target) return;
    if (badge) badge.textContent = `${rangeDays}d`;
    if (!items.length) {
      target.innerHTML = `<p class="muted-text">Todavía no hay eventos para este rango.</p>`;
      return;
    }
    const maxPageViews = Math.max(...items.map(item => item.pageViews), 1);
    target.innerHTML = items.map(item => {
      const pageWidth = Math.max(8, Math.round((item.pageViews / maxPageViews) * 100));
      const actionWidth = Math.max(6, Math.round((item.keyActions / maxPageViews) * 100));
      return `
        <div class="analytics-trend-row">
          <div class="analytics-trend-copy">
            <strong>${escapeHtml(item.day)}</strong>
            <small>${number(item.pageViews)} views · ${number(item.keyActions)} acciones</small>
          </div>
          <div class="analytics-trend-bars" aria-hidden="true">
            <span class="analytics-bar pageviews" style="width:${pageWidth}%"></span>
            <span class="analytics-bar actions" style="width:${actionWidth}%"></span>
          </div>
        </div>
      `;
    }).join("");
  }

  function renderTopPages(items) {
    const target = root.querySelector("[data-analytics-top-pages]");
    const badge = root.querySelector("[data-analytics-pages-count]");
    if (!target) return;
    if (badge) badge.textContent = String(items.length);
    if (!items.length) {
      renderEmptyRows(target, 2, "Sin páginas registradas.");
      return;
    }
    target.innerHTML = items.map(item => `
      <tr>
        <td data-label="Página">
          <strong>${escapeHtml(item.pageTitle || compactPath(item.pagePath))}</strong>
          <span>${escapeHtml(compactPath(item.pagePath))}</span>
        </td>
        <td data-label="Views">${number(item.views)}</td>
      </tr>
    `).join("");
  }

  function renderTopEvents(items) {
    const target = root.querySelector("[data-analytics-top-events]");
    const badge = root.querySelector("[data-analytics-events-count]");
    if (!target) return;
    if (badge) badge.textContent = String(items.length);
    if (!items.length) {
      renderEmptyRows(target, 2, "Sin señales registradas.");
      return;
    }
    target.innerHTML = items.map(item => `
      <tr>
        <td data-label="Evento">
          <strong>${escapeHtml(eventLabel(item.eventName))}</strong>
          <span>${escapeHtml(item.eventName)}</span>
        </td>
        <td data-label="Total">${number(item.total)}</td>
      </tr>
    `).join("");
  }

  function renderTopCtas(items) {
    const target = root.querySelector("[data-analytics-top-ctas]");
    const badge = root.querySelector("[data-analytics-ctas-count]");
    if (!target) return;
    if (badge) badge.textContent = String(items.length);
    if (!items.length) {
      renderEmptyRows(target, 2, "Sin CTAs todavía.");
      return;
    }
    target.innerHTML = items.map(item => `
      <tr>
        <td data-label="CTA">
          <strong>${escapeHtml(item.label || item.targetPath || "/")}</strong>
          <span>${escapeHtml(item.targetPath || "-")}</span>
        </td>
        <td data-label="Total">${number(item.total)}</td>
      </tr>
    `).join("");
  }

  function renderRecent(items) {
    const target = root.querySelector("[data-analytics-recent]");
    const badge = root.querySelector("[data-analytics-recent-count]");
    if (!target) return;
    if (badge) badge.textContent = String(items.length);
    if (!items.length) {
      target.innerHTML = `<li><div><p class="muted-text">No hay acciones recientes para este rango.</p></div></li>`;
      return;
    }
    target.innerHTML = items.map(item => `
      <li>
        <span class="activity-dot"></span>
        <div>
          <strong>${escapeHtml(eventLabel(item.eventName))}</strong>
          <p>${escapeHtml(item.label || compactPath(item.pagePath))}</p>
          <small>${escapeHtml(compactPath(item.pagePath))} · ${escapeHtml(formatDate(item.createdAt))}</small>
        </div>
      </li>
    `).join("");
  }

  function renderDomainList(items, mode, emptyText) {
    if (!items.length) {
      return `<div class="analytics-domain-empty">${escapeHtml(emptyText)}</div>`;
    }
    return `
      <ol class="analytics-domain-list">
        ${items.map(item => `
          <li>
            <span>${escapeHtml(mode === "event" ? eventLabel(item.eventName) : item.label || "-")}</span>
            <strong>${number(item.total)}</strong>
          </li>
        `).join("")}
      </ol>
    `;
  }

  function renderDomainBreakdowns(domainBreakdowns) {
    const target = root.querySelector("[data-analytics-domain-grid]");
    if (!target) return;
    target.innerHTML = Object.entries(DOMAIN_CARDS).map(([domainKey, config]) => {
      const block = domainBreakdowns?.[domainKey] || { totals: {} };
      const metricMarkup = config.metrics.map(metric => `
        <div class="analytics-domain-metric">
          <span>${escapeHtml(metric.label)}</span>
          <strong>${number(block.totals?.[metric.key] || 0)}</strong>
        </div>
      `).join("");
      const primaryItems = Array.isArray(block[config.primaryList.key]) ? block[config.primaryList.key] : [];
      const secondaryItems = Array.isArray(block[config.secondaryList.key]) ? block[config.secondaryList.key] : [];
      return `
        <article class="activity-surface analytics-domain-card">
          <div class="activity-head">
            <h3>${escapeHtml(config.title)}</h3>
            <span>${number(primaryItems.length + secondaryItems.length)}</span>
          </div>
          <div class="analytics-domain-metrics">${metricMarkup}</div>
          <div class="analytics-domain-columns">
            <section>
              <h4>${escapeHtml(config.primaryList.title)}</h4>
              ${renderDomainList(primaryItems, config.primaryList.mode, "Sin datos todavía.")}
            </section>
            <section>
              <h4>${escapeHtml(config.secondaryList.title)}</h4>
              ${renderDomainList(secondaryItems, config.secondaryList.mode, "Sin datos todavía.")}
            </section>
          </div>
        </article>
      `;
    }).join("");
  }

  function renderInternalActivity(internalActivity) {
    const metricsTarget = root.querySelector("[data-analytics-internal-metrics]");
    const metricsBadge = root.querySelector("[data-analytics-internal-count]");
    const pagesTarget = root.querySelector("[data-analytics-internal-pages]");
    const pagesBadge = root.querySelector("[data-analytics-internal-pages-count]");
    const eventsTarget = root.querySelector("[data-analytics-internal-events]");
    const eventsBadge = root.querySelector("[data-analytics-internal-events-count]");
    const recentTarget = root.querySelector("[data-analytics-internal-recent]");
    const recentBadge = root.querySelector("[data-analytics-internal-recent-count]");
    if (!metricsTarget || !pagesTarget || !eventsTarget || !recentTarget) return;

    const totals = internalActivity?.totals || {};
    const topPages = Array.isArray(internalActivity?.topPages) ? internalActivity.topPages : [];
    const topEvents = Array.isArray(internalActivity?.topEvents) ? internalActivity.topEvents : [];
    const recentActivity = Array.isArray(internalActivity?.recentActivity) ? internalActivity.recentActivity : [];

    if (metricsBadge) metricsBadge.textContent = number(totals.events || 0);
    metricsTarget.innerHTML = [
      { label: "Eventos internos", value: number(totals.events || 0) },
      { label: "Usuarios activos", value: number(totals.activeUsers || 0) },
      { label: "Eventos admin", value: number(totals.adminEvents || 0) },
      { label: "Eventos staff", value: number(totals.staffEvents || 0) }
    ].map(item => `
      <div class="analytics-domain-metric">
        <span>${escapeHtml(item.label)}</span>
        <strong>${escapeHtml(item.value)}</strong>
      </div>
    `).join("");

    if (pagesBadge) pagesBadge.textContent = String(topPages.length);
    if (!topPages.length) {
      renderEmptyRows(pagesTarget, 2, "Sin navegación interna registrada.");
    } else {
      pagesTarget.innerHTML = topPages.map(item => `
        <tr>
          <td data-label="Página">
            <strong>${escapeHtml(item.pageTitle || compactPath(item.pagePath))}</strong>
            <span>${escapeHtml(compactPath(item.pagePath))}</span>
          </td>
          <td data-label="Views">${number(item.views)}</td>
        </tr>
      `).join("");
    }

    if (eventsBadge) eventsBadge.textContent = String(topEvents.length);
    if (!topEvents.length) {
      renderEmptyRows(eventsTarget, 2, "Sin eventos internos todavía.");
    } else {
      eventsTarget.innerHTML = topEvents.map(item => `
        <tr>
          <td data-label="Evento">
            <strong>${escapeHtml(eventLabel(item.eventName))}</strong>
            <span>${escapeHtml(item.eventName)}</span>
          </td>
          <td data-label="Total">${number(item.total)}</td>
        </tr>
      `).join("");
    }

    if (recentBadge) recentBadge.textContent = String(recentActivity.length);
    if (!recentActivity.length) {
      recentTarget.innerHTML = `<li><div><p class="muted-text">Todavía no hay actividad interna reciente.</p></div></li>`;
      return;
    }
    recentTarget.innerHTML = recentActivity.map(item => `
      <li>
        <span class="activity-dot"></span>
        <div>
          <strong>${escapeHtml(eventLabel(item.eventName))}</strong>
          <p>${escapeHtml(item.label || item.pageTitle || compactPath(item.pagePath))}</p>
          <small>${escapeHtml(actorRoleLabel(item.actorRole))} · ${escapeHtml(compactPath(item.pagePath))} · ${escapeHtml(formatDate(item.createdAt))}</small>
        </div>
      </li>
    `).join("");
  }

  async function loadAnalytics() {
    setMessage("Cargando métricas...");
    try {
      const { dashboard } = await withTimeout(
        window.BCCAuth.api(`/api/admin/analytics/overview?days=${encodeURIComponent(rangeDays)}`),
        ANALYTICS_TIMEOUT_MS,
        "Supabase no respondio a tiempo al cargar analytics."
      );
      renderMetrics(dashboard.totals || {});
      renderTrend(dashboard.daily || []);
      renderTopPages(dashboard.topPages || []);
      renderTopEvents(dashboard.topEvents || []);
      renderTopCtas(dashboard.topCtas || []);
      renderDomainBreakdowns(dashboard.domainBreakdowns || {});
      renderRecent(dashboard.recentSignals || []);
      renderInternalActivity(dashboard.internalActivity || {});
      setMessage(`Mostrando ${dashboard.rangeDays} día(s) de señales web y eventos frontend.`);
    } catch (error) {
      setMessage(analyticsError(error));
    }
  }

  function analyticsError(error) {
    if (/no respondio a tiempo|timeout/i.test(error.message || "")) {
      return "Analytics tardo demasiado en responder. Revisa Supabase o intenta de nuevo.";
    }
    if (/analytics_events|record_analytics_event|get_admin_analytics_dashboard|relation .* does not exist/i.test(error.message || "")) {
      return "Falta activar el esquema analytics en Supabase.";
    }
    return error.message || "No fue posible cargar analytics.";
  }

  function init() {
    root = document.querySelector("[data-analytics-workspace]");
    if (!root) return;
    renderShell();
    void loadAnalytics();
  }

  window.BCCWorkspaceAnalytics = { init };
})();
