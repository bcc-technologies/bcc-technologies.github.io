(() => {
  function renderShell(root, { phases, escapeHtml, refreshIcons }) {
    root.innerHTML = `
      <section class="prospects-workspace">
        <section class="module-surface prospects-hero">
          <div class="prospects-hero-copy"><h2>Prospectos</h2><p class="muted-text" data-prospects-message>Cargando CRM...</p></div>
          <div class="prospects-toolbar-actions">
            <label class="workspace-search prospects-search"><i data-lucide="search"></i><input type="search" data-prospect-search placeholder="Buscar prospectos..." autocomplete="off" aria-label="Buscar prospectos" /></label>
            <select data-prospect-phase-filter aria-label="Filtrar por fase"><option value="">Todas las fases</option>${phases.map(phase => `<option value="${escapeHtml(phase.id)}">${escapeHtml(phase.label)}</option>`).join("")}</select>
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
        <div class="prospects-flow-tabs" role="tablist" aria-label="Subsecciones de prospectos">
          <button class="active" type="button" role="tab" aria-selected="true" data-prospects-tab="pipeline"><i data-lucide="folder-kanban"></i><span>Pipeline</span></button>
          <button type="button" role="tab" aria-selected="false" data-prospects-tab="directory"><i data-lucide="contact-round"></i><span>Directorio</span></button>
          <button type="button" role="tab" aria-selected="false" data-prospects-tab="communication"><i data-lucide="send"></i><span>Comunicación</span></button>
          <button type="button" role="tab" aria-selected="false" data-prospects-tab="activity"><i data-lucide="clock-3"></i><span>Actividad</span></button>
          <button type="button" role="tab" aria-selected="false" data-prospects-tab="templates"><i data-lucide="file-text"></i><span>Plantillas</span></button>
          <button type="button" role="tab" aria-selected="false" data-prospects-tab="intelligence"><i data-lucide="radar"></i><span>Inteligencia</span></button>
        </div>
        <section class="module-surface prospects-flow-panel active" data-prospects-panel="pipeline">
          <div class="module-head compact"><h2>Pipeline comercial</h2><span class="status-dot">Priorizado</span></div>
          <section class="prospects-board" data-prospects-board aria-label="Pipeline de prospectos"></section>
        </section>
        <section class="module-surface prospects-flow-panel" data-prospects-panel="directory" hidden>
          <div class="module-head compact"><h2>Directorio y ficha</h2><span class="status-dot">Datos base</span></div>
          <div class="prospects-directory-layout">
            <aside class="prospects-directory-list" data-prospects-directory-list aria-label="Lista de prospectos"></aside>
            <article class="prospect-profile-panel"><form class="prospects-form" data-prospect-form></form></article>
          </div>
        </section>
        <section class="module-surface prospects-flow-panel" data-prospects-panel="communication" hidden>
          <div class="module-head compact"><h2>Comunicación</h2><span class="status-dot" data-prospect-email-count>0</span></div>
          <div class="prospects-two-column-flow">
            <aside class="prospects-context-card" data-prospect-context="communication"></aside>
            <section class="prospects-email" data-prospect-email-section></section>
          </div>
        </section>
        <section class="module-surface prospects-flow-panel" data-prospects-panel="activity" hidden>
          <div class="module-head compact"><h2>Actividad</h2><span class="status-dot" data-prospect-activity-count>0</span></div>
          <div class="prospects-two-column-flow">
            <aside class="prospects-context-card" data-prospect-context="activity"></aside>
            <div class="prospects-split-action"><form class="prospects-form prospects-form-compact" data-activity-form></form><div class="prospect-activity-list" data-activity-list></div></div>
          </div>
        </section>
        <section class="module-surface prospects-flow-panel" data-prospects-panel="templates" hidden>
          <div class="module-head compact"><h2>Plantillas</h2><span class="status-dot" data-prospect-template-count>0</span></div>
          <div class="prospects-template-layout"><form class="prospects-form prospects-form-compact" data-template-form></form><div class="prospect-template-list" data-template-list></div></div>
        </section>
        <section class="prospects-intelligence-grid" data-prospects-panel="intelligence" hidden>
          <article class="module-surface prospects-panel prospects-panel-compact"><div class="activity-head"><h3>Señales</h3><span data-prospect-sent-count>0</span></div><div class="prospect-insight-grid" data-prospect-insight-grid></div></article>
          <article class="module-surface prospects-panel prospects-panel-compact"><div class="activity-head"><h3>Correos por fase</h3><span data-prospect-phase-email-count>0</span></div><div class="prospect-insight-list" data-prospect-phase-email-list></div></article>
          <article class="module-surface prospects-panel prospects-panel-compact"><div class="activity-head"><h3>Conversión</h3><span data-prospect-conversion-count>0</span></div><div class="prospect-insight-list" data-prospect-conversion-list></div></article>
        </section>
      </section>
    `;
    refreshIcons();
  }
  window.BCCWorkspaceProspectsLayout = { renderShell };
})();
