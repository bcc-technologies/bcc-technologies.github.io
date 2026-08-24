import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};
const API_VERSION = "0.2";
const MAX_TOKEN_LENGTH = 256;
const READ_SCOPE = "intelligence:read";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_OPERATIONS = new Set(["health", "overview", "signals", "signal", "signal_evidence", "runs"]);

const SIGNAL_LIST_FIELDS = "id,title,summary,signal_type,related_line,confidence_score,opportunity_score,actionability_score,evidence_count,recommended_action,status,created_at,updated_at,auto_archived";
const SIGNAL_DETAIL_FIELDS = `${SIGNAL_LIST_FIELDS},evidence_refs,score_breakdown`;
const RUN_FIELDS = "id,status,started_at,finished_at,sources_used,items_fetched,items_created,items_updated,signals_generated,error_message,created_at,updated_at,action_type,dry_run";

const EVIDENCE_CONFIG = Object.freeze({
  paper: {
    table: "intelligence_papers",
    fields: "id,title,abstract,authors,institutions,publication_date,source_name,source_url,journal_or_venue,topics,keywords,citations_count,open_access_url,possible_duplicate"
  },
  grant: {
    table: "intelligence_grants",
    fields: "id,title,abstract,agency,program,amount,currency,start_date,end_date,principal_investigators,institutions,country,source_url,topics,possible_duplicate"
  },
  trial: {
    table: "intelligence_trials",
    fields: "id,title,summary,conditions,interventions,phase,status,study_type,sponsor,collaborators,start_date,completion_date,locations,countries,source_url,topics,keywords,possible_duplicate"
  },
  patent: {
    table: "intelligence_patents",
    fields: "id,title,abstract,inventors,assignees,publication_date,filing_date,jurisdiction,status,source_url,topics,possible_duplicate"
  },
  institution: {
    table: "intelligence_institutions",
    fields: "id,name,ror_id,country,city,type,website,source_url,related_papers_count,related_grants_count,related_patents_count,topics"
  }
});

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}
function cleanText(value, maxLength = 0) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return maxLength > 0 && text.length > maxLength ? text.slice(0, maxLength).trim() : text;
}
function cleanList(value, maxItems = 32, maxLength = 240) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, maxItems).map(item => cleanText(item, maxLength)).filter(Boolean);
}
function cleanUrl(value) {
  const url = cleanText(value, 500);
  return /^https?:\/\//i.test(url) ? url : "";
}
function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
function clampInteger(value, fallback, min, max) {
  const number = Math.trunc(Number(value));
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}
function optionalScore(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : null;
}
function toHex(bytes) {
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}
async function sha256(value) {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}
function bearerToken(request) {
  const header = request.headers.get("Authorization") || "";
  if (!header.startsWith("Bearer ")) return "";
  return header.slice("Bearer ".length).trim();
}
async function readJson(request) {
  try {
    const value = await request.json();
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}
function publicEvidenceRef(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const type = cleanText(value.type, 40).toLowerCase();
  const id = cleanText(value.id, 64);
  if (!UUID_RE.test(id) || !EVIDENCE_CONFIG[type]) return null;
  return {
    id,
    type,
    title: cleanText(value.title, 600),
    sourceUrl: cleanUrl(value.sourceUrl || value.source_url)
  };
}
function publicSignal(row, detail = false) {
  const signal = {
    id: row.id,
    title: cleanText(row.title, 600),
    summary: cleanText(row.summary, 4000),
    signalType: cleanText(row.signal_type, 80),
    relatedLine: cleanText(row.related_line, 80),
    confidenceScore: toNumber(row.confidence_score),
    opportunityScore: toNumber(row.opportunity_score),
    actionabilityScore: toNumber(row.actionability_score),
    evidenceCount: toNumber(row.evidence_count),
    recommendedAction: cleanText(row.recommended_action, 2000),
    status: cleanText(row.status, 80),
    autoArchived: Boolean(row.auto_archived),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null
  };
  if (detail) {
    signal.evidenceRefs = (Array.isArray(row.evidence_refs) ? row.evidence_refs : []).map(publicEvidenceRef).filter(Boolean).slice(0, 25);
    signal.scoreBreakdown = row.score_breakdown && typeof row.score_breakdown === "object" && !Array.isArray(row.score_breakdown)
      ? row.score_breakdown
      : {};
  }
  return signal;
}
function publicEvidenceItem(type, row) {
  const common = {
    id: row.id,
    type,
    title: cleanText(row.title || row.name, 600),
    sourceUrl: cleanUrl(row.source_url || row.website),
    topics: cleanList(row.topics, 32, 120),
    possibleDuplicate: Boolean(row.possible_duplicate)
  };
  if (type === "paper") return {
    ...common,
    abstract: cleanText(row.abstract, 6000),
    authors: cleanList(row.authors, 64, 240),
    institutions: cleanList(row.institutions, 64, 240),
    publicationDate: row.publication_date || null,
    sourceName: cleanText(row.source_name, 120),
    journalOrVenue: cleanText(row.journal_or_venue, 240),
    keywords: cleanList(row.keywords, 64, 160),
    citationsCount: toNumber(row.citations_count),
    openAccessUrl: cleanUrl(row.open_access_url)
  };
  if (type === "grant") return {
    ...common,
    abstract: cleanText(row.abstract, 6000),
    agency: cleanText(row.agency, 180),
    program: cleanText(row.program, 220),
    amount: row.amount === null ? null : toNumber(row.amount),
    currency: cleanText(row.currency, 8),
    startDate: row.start_date || null,
    endDate: row.end_date || null,
    principalInvestigators: cleanList(row.principal_investigators, 64, 240),
    institutions: cleanList(row.institutions, 64, 240),
    country: cleanText(row.country, 120)
  };
  if (type === "trial") return {
    ...common,
    summary: cleanText(row.summary, 6000),
    conditions: cleanList(row.conditions, 32, 240),
    interventions: cleanList(row.interventions, 64, 240),
    phase: cleanText(row.phase, 120),
    status: cleanText(row.status, 120),
    studyType: cleanText(row.study_type, 120),
    sponsor: cleanText(row.sponsor, 200),
    collaborators: cleanList(row.collaborators, 64, 240),
    startDate: row.start_date || null,
    completionDate: row.completion_date || null,
    locations: cleanList(row.locations, 64, 300),
    countries: cleanList(row.countries, 32, 120),
    keywords: cleanList(row.keywords, 64, 160)
  };
  if (type === "patent") return {
    ...common,
    abstract: cleanText(row.abstract, 6000),
    inventors: cleanList(row.inventors, 64, 240),
    assignees: cleanList(row.assignees, 64, 240),
    publicationDate: row.publication_date || null,
    filingDate: row.filing_date || null,
    jurisdiction: cleanText(row.jurisdiction, 40),
    status: cleanText(row.status, 80)
  };
  return {
    ...common,
    rorId: cleanText(row.ror_id, 64),
    country: cleanText(row.country, 120),
    city: cleanText(row.city, 120),
    institutionType: cleanText(row.type, 80),
    relatedPapersCount: toNumber(row.related_papers_count),
    relatedGrantsCount: toNumber(row.related_grants_count),
    relatedPatentsCount: toNumber(row.related_patents_count)
  };
}
async function resolveEvidence(supabase, refs, limit) {
  const selectedRefs = refs.map(publicEvidenceRef).filter(Boolean).slice(0, limit);
  const grouped = new Map();
  for (const ref of selectedRefs) {
    if (!grouped.has(ref.type)) grouped.set(ref.type, []);
    grouped.get(ref.type).push(ref.id);
  }
  const rowsByKey = new Map();
  for (const [type, ids] of grouped.entries()) {
    const config = EVIDENCE_CONFIG[type];
    const { data, error } = await supabase.from(config.table).select(config.fields).in("id", [...new Set(ids)]);
    if (error) throw error;
    for (const row of data || []) rowsByKey.set(`${type}:${row.id}`, publicEvidenceItem(type, row));
  }
  return selectedRefs.map(ref => ({ reference: ref, item: rowsByKey.get(`${ref.type}:${ref.id}`) || null }));
}
async function dispatchOperation(supabase, operation, body) {
  if (operation === "health") {
    return { status: 200, count: 1, filters: {}, body: { ok: true, operation, version: API_VERSION } };
  }
  if (operation === "overview") {
    const [signals, papers, grants, trials, patents, runs] = await Promise.all([
      supabase.from("intelligence_signals").select("id", { count: "exact", head: true }),
      supabase.from("intelligence_papers").select("id", { count: "exact", head: true }),
      supabase.from("intelligence_grants").select("id", { count: "exact", head: true }),
      supabase.from("intelligence_trials").select("id", { count: "exact", head: true }),
      supabase.from("intelligence_patents").select("id", { count: "exact", head: true }),
      supabase.from("intelligence_runs").select("id", { count: "exact", head: true })
    ]);
    const error = [signals, papers, grants, trials, patents, runs].find(result => result.error)?.error;
    if (error) throw error;
    return { status: 200, count: 6, filters: {}, body: { ok: true, operation, version: API_VERSION, radar: {
      signals: signals.count || 0, papers: papers.count || 0, grants: grants.count || 0,
      trials: trials.count || 0, patents: patents.count || 0, runs: runs.count || 0
    } } };
  }
  if (operation === "signals") {
    const limit = clampInteger(body.limit, 20, 1, 50);
    const line = cleanText(body.line, 80);
    const status = cleanText(body.status, 80);
    const signalType = cleanText(body.signalType || body.signal_type, 80);
    const minOpportunity = optionalScore(body.minOpportunity ?? body.min_opportunity);
    const includeArchived = Boolean(body.includeArchived ?? body.include_archived);
    let query = supabase.from("intelligence_signals").select(SIGNAL_LIST_FIELDS, { count: "exact" });
    if (!includeArchived) query = query.eq("auto_archived", false);
    if (line) query = query.eq("related_line", line);
    if (status) query = query.eq("status", status);
    if (signalType) query = query.eq("signal_type", signalType);
    if (minOpportunity !== null) query = query.gte("opportunity_score", minOpportunity);
    const { data, count, error } = await query.order("updated_at", { ascending: false }).limit(limit);
    if (error) throw error;
    const filters = { line, status, signalType, minOpportunity, includeArchived, limit };
    const items = (data || []).map(row => publicSignal(row, false));
    return { status: 200, count: items.length, filters, body: { ok: true, operation, version: API_VERSION, total: count || 0, returned: items.length, signals: items } };
  }
  if (operation === "signal" || operation === "signal_evidence") {
    const id = cleanText(body.id || body.signalId || body.signal_id, 64);
    if (!UUID_RE.test(id)) return { status: 400, count: 0, filters: { id }, body: { ok: false, error: "Valid signal id required." } };
    const { data: signal, error } = await supabase.from("intelligence_signals").select(SIGNAL_DETAIL_FIELDS).eq("id", id).maybeSingle();
    if (error) throw error;
    if (!signal) return { status: 404, count: 0, filters: { id }, body: { ok: false, error: "Signal not found." } };
    if (operation === "signal") {
      return { status: 200, count: 1, filters: { id }, body: { ok: true, operation, version: API_VERSION, signal: publicSignal(signal, true) } };
    }
    const limit = clampInteger(body.limit, 25, 1, 25);
    const evidence = await resolveEvidence(supabase, Array.isArray(signal.evidence_refs) ? signal.evidence_refs : [], limit);
    return { status: 200, count: evidence.length, filters: { id, limit }, body: {
      ok: true, operation, version: API_VERSION,
      signal: { id: signal.id, title: cleanText(signal.title, 600), relatedLine: cleanText(signal.related_line, 80), updatedAt: signal.updated_at || null },
      declaredEvidenceCount: toNumber(signal.evidence_count), returned: evidence.length, evidence
    } };
  }
  if (operation === "runs") {
    const limit = clampInteger(body.limit, 10, 1, 30);
    const status = cleanText(body.status, 80);
    const actionType = cleanText(body.actionType || body.action_type, 80);
    let query = supabase.from("intelligence_runs").select(RUN_FIELDS);
    if (status) query = query.eq("status", status);
    if (actionType) query = query.eq("action_type", actionType);
    const { data, error } = await query.order("created_at", { ascending: false }).limit(limit);
    if (error) throw error;
    const rows = data || [];
    const sourceIds = [...new Set(rows.flatMap(row => Array.isArray(row.sources_used) ? row.sources_used : []).filter(id => UUID_RE.test(String(id))))];
    const sourceMap = new Map();
    if (sourceIds.length) {
      const { data: sources, error: sourceError } = await supabase.from("intelligence_sources").select("id,name,type").in("id", sourceIds);
      if (sourceError) throw sourceError;
      for (const source of sources || []) sourceMap.set(source.id, { id: source.id, name: cleanText(source.name, 120), type: cleanText(source.type, 80) });
    }
    const runs = rows.map(row => ({
      id: row.id,
      status: cleanText(row.status, 80),
      actionType: cleanText(row.action_type, 80),
      dryRun: Boolean(row.dry_run),
      startedAt: row.started_at || null,
      finishedAt: row.finished_at || null,
      itemsFetched: toNumber(row.items_fetched),
      itemsCreated: toNumber(row.items_created),
      itemsUpdated: toNumber(row.items_updated),
      signalsGenerated: toNumber(row.signals_generated),
      errorMessage: cleanText(row.error_message, 1200),
      sources: (Array.isArray(row.sources_used) ? row.sources_used : []).map(id => sourceMap.get(id)).filter(Boolean),
      createdAt: row.created_at || null,
      updatedAt: row.updated_at || null
    }));
    return { status: 200, count: runs.length, filters: { status, actionType, limit }, body: { ok: true, operation, version: API_VERSION, returned: runs.length, runs } };
  }
  return { status: 400, count: 0, filters: {}, body: { ok: false, error: "Unsupported operation." } };
}

Deno.serve(async request => {
  const started = performance.now();
  if (request.method !== "POST") return json({ ok: false, error: "Method not allowed." }, 405);
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceRoleKey) return json({ ok: false, error: "Service unavailable." }, 503);
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const token = bearerToken(request);
  if (!token || token.length > MAX_TOKEN_LENGTH || !token.startsWith("bcc_agent_")) return json({ ok: false, error: "Unauthorized." }, 401);
  const tokenHash = await sha256(token);
  const { data: client, error: clientError } = await supabase.from("intelligence_api_clients")
    .select("id,name,scopes,enabled,expires_at,rate_limit_per_minute,daily_limit").eq("token_hash", tokenHash).maybeSingle();
  if (clientError) {
    console.error("bcc-intelligence-api credential lookup failed", { code: clientError.code });
    return json({ ok: false, error: "Service unavailable." }, 503);
  }
  const expired = client?.expires_at ? new Date(client.expires_at).getTime() <= Date.now() : false;
  const scopes = Array.isArray(client?.scopes) ? client.scopes.map(String) : [];
  if (!client || !client.enabled || expired || !scopes.includes(READ_SCOPE)) return json({ ok: false, error: "Unauthorized." }, 401);

  const body = await readJson(request);
  const operation = cleanText(body.operation || "overview", 80).toLowerCase() || "overview";
  let outcome;
  if (!ALLOWED_OPERATIONS.has(operation)) {
    outcome = { status: 400, count: 0, filters: {}, body: { ok: false, error: "Unsupported operation." } };
  } else {
    try {
      outcome = await dispatchOperation(supabase, operation, body);
    } catch (error) {
      console.error("bcc-intelligence-api operation failed", { operation, code: error?.code || "read_failure" });
      outcome = { status: 503, count: 0, filters: {}, body: { ok: false, error: "Service unavailable." } };
    }
  }

  const durationMs = Math.max(0, Math.round(performance.now() - started));
  const queryHash = Object.keys(outcome.filters || {}).length ? await sha256(JSON.stringify(outcome.filters)) : "";
  const now = new Date().toISOString();
  const [auditResult, clientResult] = await Promise.all([
    supabase.from("intelligence_api_audit").insert({
      client_id: client.id,
      operation,
      query_hash: queryHash,
      result_count: outcome.count,
      duration_ms: durationMs,
      status_code: outcome.status,
      filters: outcome.filters || {}
    }),
    supabase.from("intelligence_api_clients").update({ last_used_at: now, updated_at: now }).eq("id", client.id)
  ]);
  if (auditResult.error) console.error("bcc-intelligence-api audit insert failed", { code: auditResult.error.code });
  if (clientResult.error) console.error("bcc-intelligence-api client touch failed", { code: clientResult.error.code });
  return json(outcome.body, outcome.status);
});
