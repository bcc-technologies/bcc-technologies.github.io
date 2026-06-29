(() => {
  function renderShell(root, { phases, escapeHtml, refreshIcons }) {
    const phaseOptions = phases.map(phase => `<option value="${escapeHtml(phase.id)}">${escapeHtml(phase.label)}</option>`).join("");
    const searchControl = `<label class="workspace-search prospects-search"><i data-lucide="search"></i><input type="search" data-prospect-search placeholder="Buscar prospectos..." autocomplete="off" aria-label="Buscar prospectos" /></label>`;
    const phaseControl = `<select data-prospect-phase-filter aria-label="Filtrar por fase"><option value="">Todas las fases</option>${phaseOptions}</select>`;
    root.innerHTML = `
      <section class="prospects-workspace">
        <div class="staff-work-tabs prospects-tabs" role="tablist" aria-label="Subsecciones de prospectos">
          <button id="prospects-tab-pipeline" class="active" type="button" role="tab" aria-selected="true" aria-controls="prospects-panel-pipeline" data-prospects-tab="pipeline"><i data-lucide="folder-kanban"></i><span>Pipeline</span></button>
          <button id="prospects-tab-directory" type="button" role="tab" aria-selected="false" aria-controls="prospects-panel-directory" data-prospects-tab="directory"><i data-lucide="contact-round"></i><span>Directorio</span></button>
          <button id="prospects-tab-communication" type="button" role="tab" aria-selected="false" aria-controls="prospects-panel-communication" data-prospects-tab="communication"><i data-lucide="send"></i><span>Comunicación</span></button>
          <button id="prospects-tab-activity" type="button" role="tab" aria-selected="false" aria-controls="prospects-panel-activity" data-prospects-tab="activity"><i data-lucide="clock-3"></i><span>Actividad</span></button>
          <button id="prospects-tab-templates" type="button" role="tab" aria-selected="false" aria-controls="prospects-panel-templates" data-prospects-tab="templates"><i data-lucide="file-text"></i><span>Plantillas</span></button>
          <button id="prospects-tab-intelligence" type="button" role="tab" aria-selected="false" aria-controls="prospects-panel-intelligence" data-prospects-tab="intelligence"><i data-lucide="radar"></i><span>Inteligencia</span></button>
        </div>
        <section id="prospects-panel-pipeline" class="module-surface staff-work-panel prospects-panel-shell active" role="tabpanel" aria-labelledby="prospects-tab-pipeline" data-prospects-panel="pipeline">
          <div class="module-head compact prospects-panel-head">
            <div><h2>Pipeline comercial</h2><p>Prioriza oportunidades por fase, urgencia de seguimiento y estado del ciclo comercial.</p><p class="prospects-status-message muted-text" data-prospects-message hidden></p></div>
            <div class="prospects-panel-actions">${searchControl}${phaseControl}<button class="btn btn-ghost btn-compact" type="button" data-prospects-refresh><i data-lucide="refresh-cw"></i>Actualizar</button><button class="btn btn-primary" type="button" data-prospect-new><i data-lucide="plus"></i>Nuevo prospecto</button></div>
          </div>
          <div class="staff-work-panel-body flush prospects-panel-body">
          <section class="workspace-metrics prospects-metrics" aria-label="Resumen del pipeline">
            <div><span>Prospectos</span><strong data-prospect-metric="total">-</strong><small>Base activa</small></div>
            <div><span>Seguimiento hoy</span><strong data-prospect-metric="due">-</strong><small>Acciones vencidas o para hoy</small></div>
            <div><span>En propuesta</span><strong data-prospect-metric="pipeline">-</strong><small>Propuesta y negociación</small></div>
            <div><span>Ganados</span><strong data-prospect-metric="won">-</strong><small>Cierres registrados</small></div>
          </section>
          <section class="prospects-board" data-prospects-board aria-label="Pipeline de prospectos"></section>
          </div>
        </section>
        <section id="prospects-panel-directory" class="module-surface staff-work-panel prospects-panel-shell" role="tabpanel" aria-labelledby="prospects-tab-directory" data-prospects-panel="directory" hidden>
          <div class="module-head compact prospects-panel-head">
            <div><h2>Directorio y ficha</h2><p>Administra la base, edita datos comerciales y crea nuevos prospectos.</p><p class="prospects-status-message muted-text" data-prospects-message hidden></p></div>
            <div class="prospects-panel-actions">${searchControl}${phaseControl}<button class="btn btn-primary" type="button" data-prospect-new><i data-lucide="plus"></i>Nuevo prospecto</button></div>
          </div>
          <div class="staff-work-panel-body flush prospects-panel-body">
          <div class="prospects-directory-layout">
            <aside class="prospects-directory-list" data-prospects-directory-list aria-label="Lista de prospectos"></aside>
            <article class="prospect-profile-panel"><form class="prospects-form" data-prospect-form></form></article>
          </div>
          </div>
        </section>
        <section id="prospects-panel-communication" class="module-surface staff-work-panel prospects-panel-shell" role="tabpanel" aria-labelledby="prospects-tab-communication" data-prospects-panel="communication" hidden>
          <div class="module-head compact prospects-panel-head">
            <div><h2>Comunicación</h2><p>Redacta, programa y consulta correos para el prospecto activo.</p><p class="prospects-status-message muted-text" data-prospects-message hidden></p></div>
            <span class="status-dot" data-prospect-email-count>0</span>
          </div>
          <div class="staff-work-panel-body flush prospects-panel-body">
          <div class="prospects-two-column-flow">
            <aside class="prospects-context-card" data-prospect-context="communication"></aside>
            <section class="prospects-email" data-prospect-email-section></section>
          </div>
          </div>
        </section>
        <section id="prospects-panel-activity" class="module-surface staff-work-panel prospects-panel-shell" role="tabpanel" aria-labelledby="prospects-tab-activity" data-prospects-panel="activity" hidden>
          <div class="module-head compact prospects-panel-head">
            <div><h2>Actividad</h2><p>Registra llamadas, reuniones, notas y próximos pasos.</p><p class="prospects-status-message muted-text" data-prospects-message hidden></p></div>
            <span class="status-dot" data-prospect-activity-count>0</span>
          </div>
          <div class="staff-work-panel-body flush prospects-panel-body">
          <div class="prospects-two-column-flow">
            <aside class="prospects-context-card" data-prospect-context="activity"></aside>
            <div class="prospects-split-action"><form class="prospects-form prospects-form-compact" data-activity-form></form><div class="prospect-activity-list" data-activity-list></div></div>
          </div>
          </div>
        </section>
        <section id="prospects-panel-templates" class="module-surface staff-work-panel prospects-panel-shell" role="tabpanel" aria-labelledby="prospects-tab-templates" data-prospects-panel="templates" hidden>
          <div class="module-head compact prospects-panel-head">
            <div><h2>Plantillas</h2><p>Administra mensajes reutilizables para comunicación comercial.</p><p class="prospects-status-message muted-text" data-prospects-message hidden></p></div>
            <span class="status-dot" data-prospect-template-count>0</span>
          </div>
          <div class="staff-work-panel-body flush prospects-panel-body">
          <div class="prospects-template-layout"><form class="prospects-form prospects-form-compact" data-template-form></form><div class="prospect-template-list" data-template-list></div></div>
          </div>
        </section>
        <section id="prospects-panel-intelligence" class="module-surface staff-work-panel prospects-panel-shell" role="tabpanel" aria-labelledby="prospects-tab-intelligence" data-prospects-panel="intelligence" hidden>
          <div class="module-head compact prospects-panel-head">
            <div><h2>Inteligencia comercial</h2><p>Evalúa señales, conversión por fase y rendimiento de comunicación.</p><p class="prospects-status-message muted-text" data-prospects-message hidden></p></div>
            <span class="status-dot">Análisis</span>
          </div>
          <div class="staff-work-panel-body flush prospects-panel-body">
          <div class="prospects-intelligence-grid">
            <article class="module-surface prospects-panel prospects-panel-compact"><div class="activity-head"><h3>Señales</h3><span data-prospect-sent-count>0</span></div><div class="prospect-insight-grid" data-prospect-insight-grid></div></article>
            <article class="module-surface prospects-panel prospects-panel-compact"><div class="activity-head"><h3>Correos por fase</h3><span data-prospect-phase-email-count>0</span></div><div class="prospect-insight-list" data-prospect-phase-email-list></div></article>
            <article class="module-surface prospects-panel prospects-panel-compact"><div class="activity-head"><h3>Conversión</h3><span data-prospect-conversion-count>0</span></div><div class="prospect-insight-list" data-prospect-conversion-list></div></article>
          </div>
          </div>
        </section>
      </section>
    `;
    refreshIcons();
  }
  window.BCCWorkspaceProspectsLayout = { renderShell };
})();
