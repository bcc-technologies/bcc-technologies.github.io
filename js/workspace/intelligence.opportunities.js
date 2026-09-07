/* Independent dossier workspace: no writes to the generated signal collection. */
(() => {
  const endpoint = '/api/admin/intelligence/opportunities';
  const statuses = { candidate: 'Candidata', reviewing: 'En revisión', validating: 'En prueba', validated: 'Validada', rejected: 'Rechazada', archived: 'Archivada' };
  const fields = {
    title: 'Título concreto', problem: 'Problema observado', target_user: 'Usuario o laboratorio objetivo',
    bcc_fit: 'Qué aportaría BCC', hypothesis: 'Hipótesis y criterio para aprobar la prueba', next_action: 'Próximo paso',
    owner: 'Responsable', verification_notes: 'Fuentes, datos y derechos verificados (o pendientes)',
    decision_reason: 'Motivo de la decisión', outcome: 'Resultado de la prueba'
  };
  const required = new Set(['title', 'problem', 'target_user', 'bcc_fit', 'hypothesis', 'next_action']);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = value => /^https?:\/\//i.test(String(value)) ? value : '';
  let target, navigate, mounted = false, rows = [], total = 0, page = 0, selected = null, history = [], busy = false;
  let filters = { status: '', q: '', due: false };
  const request = (path = '', options) => window.BCCWorkspaceTransport.request(endpoint + path, options);
  function message(value) { target.querySelector('[data-op-message]').textContent = value; }
  function init(root, onNavigate) {
    target = root.querySelector('[data-intelligence-panel="opportunities"]');
    if (!target) return;
    navigate = onNavigate;
    root.addEventListener('click', event => {
      const paper = event.target.closest('[data-opportunity-paper]');
      const signal = event.target.closest('[data-opportunity-signal]');
      if (!paper && !signal) return;
      navigate();
      const state = window.BCCWorkspaceIntelligenceState;
      const source = signal && state.dashboard.signals.find(row => row.id === signal.dataset.opportunitySignal);
      const ids = paper ? [paper.dataset.opportunityPaper] : (source?.evidenceRefs || []).filter(ref => ref.type === 'paper').map(ref => ref.id);
      edit(null, [...new Set(ids)].slice(0, 20));
    });
  }
  function show() {
    if (!target || mounted) return;
    mounted = true;
    target.innerHTML = `<h3>Archivo de oportunidades</h3><p>Conserva el problema, la evidencia y la decisión. Una candidata todavía no es una oportunidad validada.</p>
      <form data-op-filter class="intelligence-controls"><label class="intelligence-field">Buscar título <input name="q" maxlength="120"></label>
      <label class="intelligence-field">Estado <select name="status"><option value="">Todos</option>${options('')}</select></label>
      <label><input type="checkbox" name="due">Revisión pendiente</label><button class="btn btn-ghost">Buscar</button>
      <button type="button" class="btn btn-primary" data-op-new>Nueva ficha</button></form>
      <p role="status" data-op-message></p><div data-op-list></div>
      <div class="intelligence-controls"><button class="btn btn-ghost" data-op-prev>Anterior</button><span data-op-page></span><button class="btn btn-ghost" data-op-next>Siguiente</button></div>
      <div data-op-editor></div>`;
    target.addEventListener('click', click);
    target.addEventListener('submit', submit);
    void load();
  }
  function options(value) { return Object.entries(statuses).map(([id, label]) => `<option value="${id}"${id === value ? ' selected' : ''}>${label}</option>`).join(''); }
  async function load() {
    if (busy) return;
    busy = true;
    message('Cargando archivo…');
    try {
      const data = await request(`?${new URLSearchParams({ ...filters, page })}`);
      rows = data.opportunities; total = data.total;
      target.querySelector('[data-op-list]').innerHTML = rows.map(row => `<article class="intelligence-detail-block">
        <button type="button" class="btn btn-ghost" data-op-open="${esc(row.id)}">${esc(row.title)}</button>
        <p>${esc(statuses[row.status])} · ${esc(row.related_line)} · Responsable: ${esc(row.dossier.owner || 'Sin asignar')} · Revisión: ${esc(row.review_on || 'Sin fecha')} · v${row.revision}</p>
      </article>`).join('') || '<p>No hay fichas que coincidan con estos filtros.</p>';
      target.querySelector('[data-op-page]').textContent = `${total} fichas · Página ${page + 1}`;
      target.querySelector('[data-op-prev]').disabled = page === 0;
      target.querySelector('[data-op-next]').disabled = (page + 1) * 30 >= total;
      message('Archivo actualizado.');
    } catch (error) { message(error.message); }
    finally { busy = false; }
  }
  function edit(row, paperIds = []) {
    selected = row; history = [];
    const data = row?.dossier || {};
    const papers = window.BCCWorkspaceIntelligenceState.dashboard.papers || [];
    const choices = new Map(papers.map(p => [p.id, p.title]));
    for (const ref of row?.evidence || []) choices.set(ref.id, ref.title);
    const chosen = new Set(row ? row.evidence.map(ref => ref.id) : paperIds);
    target.querySelector('[data-op-editor]').innerHTML = `<section class="intelligence-detail-block"><h3>${row ? 'Editar ficha' : 'Nueva candidata'}</h3>
      <form data-op-save class="intelligence-opportunity-form">
      ${Object.entries(fields).map(([name, label]) => `<label class="intelligence-field">${esc(label)}${required.has(name) ? ' *' : ''}<textarea name="${name}" maxlength="${name === 'title' ? 500 : 6000}" rows="${required.has(name) ? 2 : 3}"${required.has(name) ? ' required' : ''}>${esc(data[name])}</textarea></label>`).join('')}
      <label class="intelligence-field">Línea <select name="related_line">${window.BCCWorkspaceIntelligenceConstants.DEFAULT_LINES.map(line => `<option${line === (row?.related_line || 'MAP-Nano') ? ' selected' : ''}>${esc(line)}</option>`).join('')}</select></label>
      <label class="intelligence-field">Estado <select name="status">${options(row?.status || 'candidate')}</select></label>
      <label class="intelligence-field">Revisar el <input type="date" name="review_on" value="${esc(row?.review_on)}"></label>
      <label class="intelligence-field">Papers (1–20; Ctrl/Cmd para seleccionar varios)<select name="paperIds" multiple size="6">${[...choices].map(([id, title]) => `<option value="${esc(id)}"${chosen.has(id) ? ' selected' : ''}>${esc(title)}</option>`).join('')}</select></label>
      <p>La lista incluye los papers cargados en el radar y los de esta ficha. Guardar conserva la evidencia existente. Para cambiarla, activa la recaptura; las versiones anteriores permanecen en el historial.</p>
      ${row ? '<label class="intelligence-opportunity-toggle"><input name="recapture" type="checkbox">Recapturar la selección desde el corpus</label>' : ''}
      <div class="intelligence-controls"><button class="btn btn-primary">Guardar revisión</button><button class="btn btn-ghost" type="button" data-op-close>Cerrar ficha</button>
      ${row ? '<button class="btn btn-ghost" type="button" data-op-history>Ver historial</button><button class="btn btn-ghost" type="button" data-op-export>Exportar ficha e historial cargado</button>' : ''}</div>
      </form><div data-op-evidence>${evidenceMarkup(row?.evidence || [])}</div><div data-op-history-list></div></section>`;
  }
  function evidenceMarkup(evidence) {
    return evidence.map(ref => `<details><summary>${esc(ref.title)} · Capturada ${esc(ref.captured_at)}</summary>
      <p>${esc(ref.abstract || 'Sin resumen disponible')}</p><p>Publicación: ${esc(ref.publication_date || 'Desconocida')}</p>
      ${safeUrl(ref.url) ? `<a href="${esc(ref.url)}" target="_blank" rel="noopener noreferrer">Consultar fuente</a>` : '<p>Sin URL verificable.</p>'}</details>`).join('');
  }
  async function submit(event) {
    if (!event.target.matches('[data-op-save], [data-op-filter]')) return;
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.target);
    if (event.target.matches('[data-op-filter]')) {
      filters = { q: form.get('q'), status: form.get('status'), due: form.has('due') }; page = 0; await load(); return;
    }
    busy = true;
    const button = event.target.querySelector('button'); button.disabled = true;
    message('Guardando revisión…');
    try {
      const dossier = Object.fromEntries(Object.keys(fields).concat(['related_line', 'status', 'review_on']).map(name => [name, form.get(name) || '']));
      const data = await request('', { method: 'POST', body: { id: selected?.id, revision: selected?.revision || 0, dossier,
        paperIds: !selected || form.has('recapture') ? form.getAll('paperIds') : null } });
      edit(data.opportunity);
      busy = false; await load(); message('Revisión y evidencia guardadas.');
    } catch (error) { message(error.message); }
    finally { busy = false; button.disabled = false; }
  }
  async function click(event) {
    if (busy) return;
    if (event.target.closest('[data-op-new]')) edit(null);
    const open = event.target.closest('[data-op-open]');
    if (open) edit(rows.find(row => row.id === open.dataset.opOpen));
    if (event.target.closest('[data-op-close]')) target.querySelector('[data-op-editor]').innerHTML = '';
    if (event.target.closest('[data-op-prev]') && page > 0) { page--; await load(); }
    if (event.target.closest('[data-op-next]') && (page + 1) * 30 < total) { page++; await load(); }
    if (event.target.closest('[data-op-history]') && selected) {
      busy = true;
      try {
        const before = history.at(-1)?.revision;
        const data = await request(`/${selected.id}/history${before ? `?before=${before}` : ''}`);
        history.push(...data.history);
        target.querySelector('[data-op-history-list]').innerHTML = history.map(item => `<details><summary>v${item.revision} · ${esc(item.recorded_at)} · Autor ${esc(item.actor_id)}</summary>
          <pre>${esc(JSON.stringify(item.snapshot, null, 2))}</pre></details>`).join('');
        event.target.textContent = data.history.length === 30 ? 'Cargar revisiones anteriores' : 'Historial completo';
        event.target.disabled = data.history.length < 30;
        message(`${history.length} revisiones cargadas.`);
      } catch (error) { message(error.message); } finally { busy = false; }
    }
    if (event.target.closest('[data-op-export]') && selected) {
      const url = URL.createObjectURL(new Blob([JSON.stringify({ schemaVersion: 1, exportedAt: new Date().toISOString(), opportunity: selected,
        history, historyComplete: history.length === selected.revision }, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = `oportunidad-${selected.id}-v${selected.revision}.json`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }
  window.BCCWorkspaceIntelligenceOpportunities = Object.freeze({ init, show });
})();
