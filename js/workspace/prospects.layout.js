(() => {
  function renderShell(root, { phases, escapeHtml, refreshIcons }) {
    root.innerHTML = `
      <section class="prospects-workspace">
        <section class="module-surface prospects-hero">
          <div class="prospects-hero-copy">
            <h2>Prospectos</h2>
            <p class="muted-text" data-prospects-message>Cargando CRM...</p>
          </div>
          <div class="prospects-toolbar-actions">
            <label class="workspace-search prospects-search">
              <i data-lucide="search"></i>
              <input type="search" data-prospect-search placeholder="Buscar prospectos..." autocomplete="off" aria-label="Buscar prospectos" />
            </label>
            <select data-prospect-phase-filter aria-label="Filtrar por fase">
              <option value="">Todas las fases</option>
              ${phases.map(phase => `<option value="${escapeHtml(phase.id)}">${escapeHtml(phase.label)}</option>`).join("")}
            </select>
            <button class="btn btn-ghost btn-compact" type="button" data-prospects-refresh><i data-lucide="refresh-cw"></i>Actualizar</button>
            <button class="btn btn-primary" type="button" data-prospect-new><i data-lucide="plus"></i>Nuevo prospecto</button>
          </div>
        </section>

        <section class="workspace-metrics prospects-metrics" aria-label="Resumen de prospectos">
          <div><span>Prospectos</span><strong data-prospect-metric="total">-</strong><small>Base activa</small></div>
          <div><span>Seguimiento hoy</span><strong data-prospect-metric="due">-</strong><small>Acciones vencidas o para hoy</small></div>
          <div><span>En propuesta</span><strong data-prospect-metric="pipeline">-</strong><small>Propuesta y negociación</small></div>
          <div><span>Ganados</span><strong data-prospect-metric="won">-</strong><small>Cierres registrados</small></div>
        </section>

        <section class="prospects-command-grid">
          <article class="module-surface prospects-pipeline-panel">
            <div class="module-head compact">
              <h2>Trabajo comercial</h2>
            </div>
            <section class="prospects-board" data-prospects-board aria-label="Pipeline de prospectos"></section>
          </article>
          <aside class="prospects-signal-stack" aria-label="Señales comerciales">
            <article class="module-surface prospects-panel prospects-panel-compact">
              <div class="activity-head">
                <h3>Señales</h3>
                <span data-prospect-sent-count>0</span>
              </div>
              <div class="prospect-insight-grid" data-prospect-insight-grid></div>
            </article>
            <article class="module-surface prospects-panel prospects-panel-compact">
              <div class="activity-head">
                <h3>Correos</h3>
                <span data-prospect-phase-email-count>0</span>
              </div>
              <div class="prospect-insight-list" data-prospect-phase-email-list></div>
            </article>
            <article class="module-surface prospects-panel prospects-panel-compact">
              <div class="activity-head">
                <h3>Conversión</h3>
                <span data-prospect-conversion-count>0</span>
              </div>
              <div class="prospect-insight-list" data-prospect-conversion-list></div>
            </article>
          </aside>
        </section>

        <section class="prospects-workbench">
          <article class="module-surface prospects-panel prospect-profile-panel">
            <div class="activity-head">
              <h3>Ficha del prospecto</h3>
              <span data-prospect-card-state>nuevo</span>
            </div>
            <form class="prospects-form" data-prospect-form></form>
          </article>
          <article class="module-surface prospects-panel prospect-email-panel">
            <div class="activity-head">
              <h3>Correos y seguimiento</h3>
              <span data-prospect-email-count>0</span>
            </div>
            <section class="prospects-email" data-prospect-email-section></section>
          </article>
        </section>

        <section class="prospects-operations-grid">
          <article class="module-surface prospects-panel">
            <div class="activity-head">
              <h3>Plantillas</h3>
              <span data-prospect-template-count>0</span>
            </div>
            <section class="prospects-template-layout">
              <form class="prospects-form prospects-form-compact" data-template-form></form>
              <div class="prospect-template-list" data-template-list></div>
            </section>
          </article>
          <article class="module-surface prospects-panel">
            <div class="activity-head">
              <h3>Timeline</h3>
              <span data-prospect-activity-count>0</span>
            </div>
            <section class="prospects-timeline-layout">
              <form class="prospects-form prospects-form-compact" data-activity-form></form>
              <div class="prospect-activity-list" data-activity-list></div>
            </section>
          </article>
        </section>
      </section>
    `;
    refreshIcons();
  }

  window.BCCWorkspaceProspectsLayout = { renderShell };
})();
