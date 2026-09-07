/* Curated opportunities boundary. Database RPC owns validation and audit writes. */
(() => {
  const base = '/api/admin/intelligence/opportunities';
  function createApi({ supabase, requireAdminViewUser }) {
    return { async handle(path, options = {}) {
      const url = new URL(path, window.location.origin);
      if (url.pathname !== base && !url.pathname.startsWith(`${base}/`)) return { handled: false };
      await requireAdminViewUser();
      const method = options.method || 'GET';
      let result;
      if (url.pathname === base && method === 'GET') {
        const page = Math.max(0, Math.min(10000, Number.parseInt(url.searchParams.get('page'), 10) || 0));
        let query = supabase.from('intelligence_opportunities').select('*', { count: 'exact' })
          .order('updated_at', { ascending: false }).order('id', { ascending: true });
        const status = url.searchParams.get('status');
        if (status) query = query.eq('status', status);
        const term = (url.searchParams.get('q') || '').trim().slice(0, 120).replace(/[%_\\]/g, '\\$&');
        if (term) query = query.ilike('title', `%${term}%`);
        if (url.searchParams.get('due') === 'true') query = query.lte('review_on', new Date().toISOString().slice(0, 10))
          .in('status', ['candidate', 'reviewing', 'validating']);
        const { data, error, count } = await query.range(page * 30, page * 30 + 29);
        if (error) throw error;
        result = { opportunities: data || [], total: count || 0, page };
      } else if (url.pathname === base && method === 'POST') {
        const body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body || {};
        const { data, error } = await supabase.rpc('save_intelligence_opportunity', {
          p_id: body.id || null, p_revision: body.revision ?? 0,
          p_dossier: body.dossier, p_paper_ids: body.paperIds ?? null
        });
        if (error) throw error;
        result = { opportunity: data };
      } else if (method === 'GET' && /^\/api\/admin\/intelligence\/opportunities\/[0-9a-f-]{36}\/history$/i.test(url.pathname)) {
        const id = url.pathname.split('/').at(-2);
        const before = Number.parseInt(url.searchParams.get('before'), 10);
        let query = supabase.from('intelligence_opportunity_history').select('*').eq('opportunity_id', id)
          .order('revision', { ascending: false });
        if (Number.isInteger(before) && before > 0) query = query.lt('revision', before);
        const { data, error } = await query.limit(30);
        if (error) throw error;
        result = { history: data || [] };
      } else throw new Error('Operación de oportunidades no disponible.');
      return { handled: true, value: { ok: true, ...result } };
    } };
  }
  window.BCCAuthIntelligenceOpportunitiesApi = Object.freeze({ createApi });
})();
