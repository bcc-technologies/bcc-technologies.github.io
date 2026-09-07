import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../js/auth-intelligence-opportunities-api.js', import.meta.url), 'utf8');
function harness(allowed = true) {
  const calls = [];
  const chain = new Proxy({}, { get(_, key) {
    if (key === 'then') return resolve => resolve({ data: [], count: 0 });
    return (...args) => { calls.push([key, ...args]); return chain; };
  } });
  const window = { location: { origin: 'https://example.org' } };
  vm.runInNewContext(source, { window, URL });
  const api = window.BCCAuthIntelligenceOpportunitiesApi.createApi({
    requireAdminViewUser: async () => { if (!allowed) throw new Error('forbidden'); },
    supabase: { from: name => { calls.push(['from', name]); return chain; }, rpc: async (...args) => { calls.push(['rpc', ...args]); return { data: { revision: 2 } }; } }
  });
  return { api, calls };
}
test('opportunities API authorizes before any query', async () => {
  const { api, calls } = harness(false);
  await assert.rejects(api.handle('/api/admin/intelligence/opportunities'), /forbidden/);
  assert.equal(calls.length, 0);
});
test('opportunities API filters and paginates server-side', async () => {
  const { api, calls } = harness();
  await api.handle('/api/admin/intelligence/opportunities?page=2&status=reviewing&due=true&q=100%25');
  assert.deepEqual(calls.find(c => c[0] === 'range'), ['range',60,89]);
  assert.deepEqual(calls.find(c => c[0] === 'eq'), ['eq','status','reviewing']);
  assert.deepEqual(calls.find(c => c[0] === 'ilike'), ['ilike','title','%100\\%%']);
});
test('opportunities API sends expected revision and leaves evidence capture to database', async () => {
  const { api, calls } = harness();
  const result = await api.handle('/api/admin/intelligence/opportunities', { method: 'POST', body: JSON.stringify({ id: 'id', revision: 1, dossier: { title: 'Test' }, evidence: [{ abstract: 'forged' }] }) });
  assert.equal(result.value.opportunity.revision, 2);
  const args = calls[0][2];
  assert.equal(args.p_revision, 1);
  assert.equal(args.p_paper_ids, null);
  assert.equal(args.evidence, undefined);
});
