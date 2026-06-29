(() => {
  function renderShell(root, { phases, escapeHtml, refreshIcons }) {
    const phaseOptions = phases.map(phase => `<option value="${escapeHtml(phase.id)}">${escapeHtml(phase.label)}</option>`).join("");
    const searchControl = `<label class="workspace-search prospects-search"><i data-lucide="search"></i><input type="search" data-prospect-search placeholder="Buscar contactos..." autocomplete="off" aria-label="Buscar contactos" /></label>`;
    const phaseControl = `<select data-prospect-phase-filter aria-label="Filtrar por fase"><option value="">Todas las fases</option>${phaseOptions}</select>`;
    root.innerHTML = `
      <section class="prospects-workspace">
        <div class="staff-work-tabs prospects-tabs" role="tablist" aria-label="Subsecciones de CRM">
          <button id="prospects-tab-home" class="active" type="button" role="tab" aria-selected="true" aria-controls="prospects-panel-home" data-prospects-tab="home"><i data-lucide="layout-dashboard"></i><span>Inicio</span></button>
          <button id="prospects-tab-pipeline" type="button" role="tab" aria-selected="false" aria-controls="prospects-panel-pipeline" data-prospects-tab="pipeline"><i data-lucide="folder-kanban"></i><span>Pipeline</span></button>
          <button id="prospects-tab-directory" type="button" role="tab" aria-selected="false" aria-controls="prospects-panel-directory" data-prospects-tab="directory"><i data-lucide="contact-round"></i><span>Directorio</span></button>
          <button id="prospects-tab-inbox" type="button" role="tab" aria-selected="false" aria-controls="prospects-panel-inbox" data-prospects-tab="inbox"><i data-lucide="inbox"></i><span>Bandeja</span></button>
          <button id="prospects-tab-templates" type="button" role="tab" aria-selected="false" aria-controls="prospects-panel-templates" data-prospects-tab="templates"><i data-lucide="file-text"></i><span>Plantillas</span></button>
          <button id="prospects-tab-intelligence" type="button" role="tab" aria-selected="false" aria-controls="prospects-panel-intelligence" data-prospects-tab="intelligence"><i data-lucide="radar"></i><span>Inteligencia</span></button>
        </div>
        <section id="prospects-panel-home" class="module-surface staff-work-panel prospects-panel-shell active" role="tabpanel" aria-labelledby="prospects-tab-home" data-prospects-panel="home">
          <div class="module-head compact prospects-panel-head">
            <div><h2>Inicio comercial</h2><p>Actividad reciente, próximos seguimientos y estado general de la base comercial.</p><p class="prospects-status-message muted-text" data-prospects-message hidden></p></div>
            <span class="status-dot">Resumen</span>
          </div>
          <div class="staff-work-panel-body flush prospects-panel-body"><section data-prospects-home></section></div>
        </section>
        <section id="prospects-panel-pipeline" class="module-surface staff-work-panel prospects-panel-shell" role="tabpanel" aria-labelledby="prospects-tab-pipeline" data-prospects-panel="pipeline" hidden>
          <div class="module-head compact prospects-panel-head">
            <div><h2>Pipeline operativo</h2><p>Crea, mueve, designa y administra automatizaciones del flujo comercial.</p><p class="prospects-status-message muted-text" data-prospects-message hidden></p></div>
            <div class="prospects-panel-actions">${searchControl}${phaseControl}<button class="btn btn-ghost btn-compact" type="button" data-prospects-refresh><i data-lucide="refresh-cw"></i>Actualizar</button><button class="btn btn-primary" type="button" data-prospect-new><i data-lucide="plus"></i>Nuevo contacto</button></div>
          </div>
          <div class="staff-work-panel-body flush prospects-panel-body">
            <section class="workspace-metrics prospects-metrics" aria-label="Resumen del pipeline">
              <div><span>Contactos</span><strong data-prospect-metric="total">-</strong><small>Base activa</small></div>
              <div><span>Seguimiento hoy</span><strong data-prospect-metric="due">-</strong><small>Acciones vencidas o para hoy</small></div>
              <div><span>En propuesta</span><strong data-prospect-metric="pipeline">-</strong><small>Propuesta y negociación</small></div>
              <div><span>Ganados</span><strong data-prospect-metric="won">-</strong><small>Cierres registrados</small></div>
            </section>
            <section class="prospects-board" data-prospects-board aria-label="Pipeline operativo de contactos"></section>
          </div>
        </section>
        <section id="prospects-panel-directory" class="module-surface staff-work-panel prospects-panel-shell" role="tabpanel" aria-labelledby="prospects-tab-directory" data-prospects-panel="directory" hidden>
          <div class="module-head compact prospects-panel-head">
            <div><h2>Directorio y ficha</h2><p>Administra la base y trabaja la comunicación/actividad de cada contacto.</p><p class="prospects-status-message muted-text" data-prospects-message hidden></p></div>
            <div class="prospects-panel-actions">${searchControl}${phaseControl}<button class="btn btn-primary" type="button" data-prospect-new><i data-lucide="plus"></i>Nuevo contacto</button></div>
          </div>
          <div class="staff-work-panel-body flush prospects-panel-body">
            <section class="prospects-directory-workspace" aria-label="Directorio comercial">
              <div class="prospects-directory-controls" data-directory-controls></div>
              <div class="prospects-directory-layout">
                <section class="prospects-directory-list" data-prospects-directory-list aria-label="Directorio de contactos"></section>
                <aside class="prospect-directory-side" aria-label="Trabajo del contacto seleccionado">
                  <div class="prospect-directory-tabs" role="tablist" aria-label="Detalle del contacto">
                    <button class="active" type="button" data-directory-section="profile"><i data-lucide="contact-round"></i>Ficha</button>
                    <button type="button" data-directory-section="communication"><i data-lucide="send"></i>Comunicación</button>
                    <button type="button" data-directory-section="activity"><i data-lucide="clock-3"></i>Actividad</button>
                  </div>
                  <section data-directory-panel="profile"><div class="prospect-directory-detail" data-directory-detail></div></section>
                  <section data-directory-panel="communication" hidden><section class="prospects-email" data-prospect-email-section></section></section>
                  <section data-directory-panel="activity" hidden><div class="prospects-split-action"><form class="prospects-form prospects-form-compact" data-activity-form></form><div class="prospect-activity-list" data-activity-list></div></div></section>
                  <article class="prospect-profile-panel" data-directory-editor hidden><form class="prospects-form" data-prospect-form></form></article>
                </aside>
              </div>
            </section>
          </div>
        </section>
        <section id="prospects-panel-inbox" class="module-surface staff-work-panel prospects-panel-shell" role="tabpanel" aria-labelledby="prospects-tab-inbox" data-prospects-panel="inbox" hidden>
          <div class="module-head compact prospects-panel-head">
            <div><h2>Bandeja de entrada</h2><p>Correos pendientes, programados, borradores y enviados de todos los contactos.</p><p class="prospects-status-message muted-text" data-prospects-message hidden></p></div>
            <span class="status-dot" data-prospect-inbox-count>0</span>
          </div>
          <div class="staff-work-panel-body flush prospects-panel-body"><section data-prospect-inbox></section></div>
        </section>
        <section id="prospects-panel-templates" class="module-surface staff-work-panel prospects-panel-shell" role="tabpanel" aria-labelledby="prospects-tab-templates" data-prospects-panel="templates" hidden>
          <div class="module-head compact prospects-panel-head">
            <div><h2>Plantillas</h2><p>Administra mensajes reutilizables para comunicación comercial.</p><p class="prospects-status-message muted-text" data-prospects-message hidden></p></div>
            <span class="status-dot" data-prospect-template-count>0</span>
          </div>
          <div class="staff-work-panel-body flush prospects-panel-body">
            <section class="prospects-template-workspace" aria-label="Biblioteca de plantillas">
              <div class="prospects-template-controls" data-template-controls></div>
              <div class="prospects-template-layout">
                <section class="prospect-template-library" data-template-list aria-label="Biblioteca de plantillas"></section>
                <aside class="prospect-template-preview" data-template-preview aria-label="Vista previa de plantilla"></aside>
                <form class="prospects-form prospects-form-compact prospect-template-editor" data-template-form></form>
              </div>
            </section>
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
