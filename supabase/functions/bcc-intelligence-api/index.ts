import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
const API_VERSION = "0.3";
const READ_SCOPE = "intelligence:read";
const MAX_TOKEN_LENGTH = 256;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ALLOWED_OPERATIONS = new Set(["health", "overview", "signals", "signal", "signal_evidence", "runs", "search"]);
const STOP_WORDS = new Set(["the","and","for","with","from","into","sobre","para","por","con","una","uno","las","los","del","de","la","el","y","en"]);

const SIGNAL_LIST_FIELDS = "id,title,summary,signal_type,related_line,confidence_score,opportunity_score,actionability_score,evidence_count,recommended_action,status,created_at,updated_at,auto_archived";
const SIGNAL_DETAIL_FIELDS = `${SIGNAL_LIST_FIELDS},evidence_refs,score_breakdown`;
const RUN_FIELDS = "id,status,started_at,finished_at,sources_used,items_fetched,items_created,items_updated,signals_generated,error_message,created_at,updated_at,action_type,dry_run";
const SEARCH_SPECS = Object.freeze({
  signal: { table: "intelligence_signals", fields: SIGNAL_LIST_FIELDS, searchFields: ["title","summary","recommended_action"] },
  paper: { table: "intelligence_papers", fields: "id,title,abstract,authors,institutions,publication_date,source_name,source_url,journal_or_venue,topics,keywords,citations_count,open_access_url,possible_duplicate,updated_at", searchFields: ["title","abstract"] },
  grant: { table: "intelligence_grants", fields: "id,title,abstract,agency,program,amount,currency,start_date,end_date,principal_investigators,institutions,country,source_url,topics,possible_duplicate,updated_at", searchFields: ["title","abstract","program","agency"] }
});
const EVIDENCE_CONFIG = Object.freeze({
  paper: { table: "intelligence_papers", fields: SEARCH_SPECS.paper.fields },
  grant: { table: "intelligence_grants", fields: SEARCH_SPECS.grant.fields },
  trial: { table: "intelligence_trials", fields: "id,title,summary,conditions,interventions,phase,status,study_type,sponsor,collaborators,start_date,completion_date,locations,countries,source_url,topics,keywords,possible_duplicate" },
  patent: { table: "intelligence_patents", fields: "id,title,abstract,inventors,assignees,publication_date,filing_date,jurisdiction,status,source_url,topics,possible_duplicate" },
  institution: { table: "intelligence_institutions", fields: "id,name,ror_id,country,city,type,website,source_url,related_papers_count,related_grants_count,related_patents_count,topics" }
});

function json(body, status = 200) { return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS }); }
function cleanText(value, max = 0) { const text = String(value ?? "").replace(/\s+/g, " ").trim(); return max && text.length > max ? text.slice(0, max).trim() : text; }
function cleanList(value, maxItems = 32, maxLength = 240) { return Array.isArray(value) ? value.slice(0,maxItems).map(v => cleanText(v,maxLength)).filter(Boolean) : []; }
function cleanUrl(value) { const url = cleanText(value,500); return /^https?:\/\//i.test(url) ? url : ""; }
function number(value, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
function clampInt(value, fallback, min, max) { const n = Math.trunc(Number(value)); return Number.isFinite(n) ? Math.max(min,Math.min(max,n)) : fallback; }
function optionalScore(value) { if (value === null || value === undefined || value === "") return null; const n = Number(value); return Number.isFinite(n) ? Math.max(0,Math.min(100,n)) : null; }
function validDate(value) { const text = cleanText(value,10); return DATE_RE.test(text) ? text : ""; }
function cleanUrlLike(value) { return cleanText(value,120).replace(/[\\%_]/g, match => `\\${match}`); }
function normalize(value) { return cleanText(value).normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase(); }
function searchTokens(query) {
  const tokens = cleanText(query,240).normalize("NFKC").toLowerCase().split(/[^\p{L}\p{N}+#.-]+/gu)
    .map(v => v.replace(/^[.+#-]+|[.+#-]+$/g, "")).filter(v => v.length >= 2 && !STOP_WORDS.has(v));
  return [...new Set(tokens)].slice(0,3);
}
function toHex(bytes) { return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2,"0")).join(""); }
async function sha256(value) { return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))); }
function bearerToken(request) { const h = request.headers.get("Authorization") || ""; return h.startsWith("Bearer ") ? h.slice(7).trim() : ""; }
async function readJson(request) { try { const v = await request.json(); return v && typeof v === "object" && !Array.isArray(v) ? v : {}; } catch { return {}; } }

function publicSignal(row, detail = false) {
  const out = { id: row.id, title: cleanText(row.title,600), summary: cleanText(row.summary,4000), signalType: cleanText(row.signal_type,80), relatedLine: cleanText(row.related_line,80), confidenceScore: number(row.confidence_score), opportunityScore: number(row.opportunity_score), actionabilityScore: number(row.actionability_score), evidenceCount: number(row.evidence_count), recommendedAction: cleanText(row.recommended_action,2000), status: cleanText(row.status,80), autoArchived: Boolean(row.auto_archived), createdAt: row.created_at || null, updatedAt: row.updated_at || null };
  if (detail) { out.evidenceRefs = (Array.isArray(row.evidence_refs) ? row.evidence_refs : []).map(publicEvidenceRef).filter(Boolean).slice(0,25); out.scoreBreakdown = row.score_breakdown && typeof row.score_breakdown === "object" && !Array.isArray(row.score_breakdown) ? row.score_breakdown : {}; }
  return out;
}
function publicEvidenceRef(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const type = cleanText(value.type,40).toLowerCase(), id = cleanText(value.id,64);
  if (!UUID_RE.test(id) || !EVIDENCE_CONFIG[type]) return null;
  return { id, type, title: cleanText(value.title,600), sourceUrl: cleanUrl(value.sourceUrl || value.source_url) };
}
function publicPaper(row, abstractMax = 3000) { return { id: row.id, type: "paper", title: cleanText(row.title,600), abstract: cleanText(row.abstract,abstractMax), authors: cleanList(row.authors,24,180), institutions: cleanList(row.institutions,24,220), publicationDate: row.publication_date || null, sourceName: cleanText(row.source_name,120), sourceUrl: cleanUrl(row.source_url), journalOrVenue: cleanText(row.journal_or_venue,240), topics: cleanList(row.topics,24,140), keywords: cleanList(row.keywords,24,140), citationsCount: number(row.citations_count), openAccessUrl: cleanUrl(row.open_access_url), possibleDuplicate: Boolean(row.possible_duplicate), updatedAt: row.updated_at || null }; }
function publicGrant(row, abstractMax = 3000) { return { id: row.id, type: "grant", title: cleanText(row.title,600), abstract: cleanText(row.abstract,abstractMax), agency: cleanText(row.agency,180), program: cleanText(row.program,220), amount: row.amount === null ? null : number(row.amount), currency: cleanText(row.currency,8), startDate: row.start_date || null, endDate: row.end_date || null, principalInvestigators: cleanList(row.principal_investigators,24,200), institutions: cleanList(row.institutions,24,220), country: cleanText(row.country,120), sourceUrl: cleanUrl(row.source_url), topics: cleanList(row.topics,24,140), possibleDuplicate: Boolean(row.possible_duplicate), updatedAt: row.updated_at || null }; }
function publicEvidenceItem(type,row) {
  if (type === "paper") return publicPaper(row,6000);
  if (type === "grant") return publicGrant(row,6000);
  const common = { id: row.id, type, title: cleanText(row.title || row.name,600), sourceUrl: cleanUrl(row.source_url || row.website), topics: cleanList(row.topics,32,140), possibleDuplicate: Boolean(row.possible_duplicate) };
  if (type === "trial") return { ...common, summary: cleanText(row.summary,6000), conditions: cleanList(row.conditions,32,240), interventions: cleanList(row.interventions,64,240), phase: cleanText(row.phase,120), status: cleanText(row.status,120), studyType: cleanText(row.study_type,120), sponsor: cleanText(row.sponsor,200), collaborators: cleanList(row.collaborators,48,220), startDate: row.start_date || null, completionDate: row.completion_date || null, locations: cleanList(row.locations,48,300), countries: cleanList(row.countries,24,120), keywords: cleanList(row.keywords,48,160) };
  if (type === "patent") return { ...common, abstract: cleanText(row.abstract,6000), inventors: cleanList(row.inventors,48,200), assignees: cleanList(row.assignees,48,200), publicationDate: row.publication_date || null, filingDate: row.filing_date || null, jurisdiction: cleanText(row.jurisdiction,40), status: cleanText(row.status,80) };
  return { ...common, rorId: cleanText(row.ror_id,64), country: cleanText(row.country,120), city: cleanText(row.city,120), institutionType: cleanText(row.type,80), relatedPapersCount: number(row.related_papers_count), relatedGrantsCount: number(row.related_grants_count), relatedPatentsCount: number(row.related_patents_count) };
}
async function resolveEvidence(supabase, refs, limit) {
  const selected = refs.map(publicEvidenceRef).filter(Boolean).slice(0,limit), grouped = new Map(), rows = new Map();
  for (const ref of selected) { if (!grouped.has(ref.type)) grouped.set(ref.type,[]); grouped.get(ref.type).push(ref.id); }
  for (const [type,ids] of grouped) { const cfg = EVIDENCE_CONFIG[type]; const res = await supabase.from(cfg.table).select(cfg.fields).in("id",[...new Set(ids)]); if (res.error) throw res.error; for (const row of res.data || []) rows.set(`${type}:${row.id}`,publicEvidenceItem(type,row)); }
  return selected.map(ref => ({ reference: ref, item: rows.get(`${ref.type}:${ref.id}`) || null }));
}

function searchTypes(value) {
  const raw = Array.isArray(value) ? value : cleanText(value,80).split(",");
  const types = [...new Set(raw.map(v => cleanText(v,20).toLowerCase()).filter(v => SEARCH_SPECS[v]))];
  return types.length ? types : ["signal","paper","grant"];
}
function applyCandidateFilters(query,type,filters) {
  if (type === "signal") { if (!filters.includeArchived) query = query.eq("auto_archived",false); if (filters.line) query = query.eq("related_line",filters.line); if (filters.since) query = query.gte("updated_at",`${filters.since}T00:00:00Z`); if (filters.until) query = query.lte("updated_at",`${filters.until}T23:59:59.999Z`); }
  if (type === "paper") { if (filters.source) query = query.ilike("source_name",`%${cleanUrlLike(filters.source)}%`); if (filters.since) query = query.gte("publication_date",filters.since); if (filters.until) query = query.lte("publication_date",filters.until); }
  if (type === "grant") { if (filters.source) query = query.ilike("agency",`%${cleanUrlLike(filters.source)}%`); if (filters.since) query = query.gte("start_date",filters.since); if (filters.until) query = query.lte("start_date",filters.until); }
  return query;
}
async function fetchCandidates(supabase,type,probes,filters,candidateLimit) {
  const spec = SEARCH_SPECS[type], requests = [];
  for (const field of spec.searchFields) for (const probe of probes) {
    let query = supabase.from(spec.table).select(spec.fields).ilike(field,`%${cleanUrlLike(probe)}%`);
    query = applyCandidateFilters(query,type,filters).limit(candidateLimit);
    requests.push(query);
  }
  const responses = await Promise.all(requests), out = new Map();
  for (const res of responses) { if (res.error) throw res.error; for (const row of res.data || []) out.set(row.id,row); }
  return [...out.values()];
}
function searchDocument(type,row) {
  if (type === "signal") return { title: row.title, body: `${row.summary || ""} ${row.recommended_action || ""}`, topics: [row.related_line,row.signal_type], keywords: [], source: "", date: row.updated_at || row.created_at };
  if (type === "paper") return { title: row.title, body: row.abstract, topics: row.topics, keywords: row.keywords, source: `${row.source_name || ""} ${row.journal_or_venue || ""}`, date: row.publication_date || row.updated_at };
  return { title: row.title, body: `${row.abstract || ""} ${row.program || ""}`, topics: row.topics, keywords: [], source: row.agency, date: row.start_date || row.updated_at };
}
function rankCandidate(type,row,query,tokens) {
  const doc = searchDocument(type,row), q = normalize(query), title = normalize(doc.title), body = normalize(doc.body), topics = normalize(cleanList(doc.topics,64,240).join(" ")), keywords = normalize(cleanList(doc.keywords,64,180).join(" ")), source = normalize(doc.source);
  let score = 0; const fields = new Set();
  if (title === q) { score += 120; fields.add("title_exact"); } else if (title.includes(q)) { score += 80; fields.add("title_phrase"); }
  if (body.includes(q)) { score += 42; fields.add("body_phrase"); }
  if (topics.includes(q)) { score += 30; fields.add("topics_phrase"); }
  if (keywords.includes(q)) { score += 24; fields.add("keywords_phrase"); }
  if (source.includes(q)) { score += 14; fields.add("source_phrase"); }
  for (const token of tokens.map(normalize)) { if (title.includes(token)) { score += 14; fields.add("title_token"); } if (body.includes(token)) { score += 6; fields.add("body_token"); } if (topics.includes(token)) { score += 8; fields.add("topics_token"); } if (keywords.includes(token)) { score += 7; fields.add("keywords_token"); } if (source.includes(token)) { score += 4; fields.add("source_token"); } }
  if (type === "signal") score += Math.min(10, number(row.opportunity_score)/10) + Math.min(6, number(row.actionability_score)/16.67);
  if (type === "grant") score += 3;
  const timestamp = Date.parse(doc.date || ""); if (Number.isFinite(timestamp)) { const ageDays = Math.max(0,(Date.now()-timestamp)/86400000); score += Math.max(0,8-Math.min(8,ageDays/90)); }
  return { score: Math.round(score*100)/100, matchedFields: [...fields] };
}
function publicSearchItem(type,row,ranking) {
  const base = type === "signal" ? { type, ...publicSignal(row,false) } : type === "paper" ? publicPaper(row) : publicGrant(row);
  return { ...base, relevanceScore: ranking.score, matchedFields: ranking.matchedFields };
}
async function searchOperation(supabase,body) {
  const query = cleanText(body.q || body.query,240); if (query.length < 2) return { status:400,count:0,filters:{},body:{ok:false,error:"Search query must contain at least 2 characters."} };
  const types = searchTypes(body.types), tokens = searchTokens(query), probes = tokens.length ? tokens : [query];
  const limit = clampInt(body.limit,15,1,25), offset = clampInt(body.offset,0,0,200), candidateLimit = Math.min(60,Math.max(30,offset+limit+15));
  const filters = { types, line: cleanText(body.line,80), source: cleanText(body.source,120), since: validDate(body.since), until: validDate(body.until), includeArchived: Boolean(body.includeArchived ?? body.include_archived), limit, offset };
  const candidateGroups = await Promise.all(types.map(type => fetchCandidates(supabase,type,probes,filters,candidateLimit)));
  const ranked = [];
  types.forEach((type,index) => { for (const row of candidateGroups[index]) { const ranking = rankCandidate(type,row,query,tokens); if (ranking.score > 0) ranked.push({ type,row,ranking }); } });
  ranked.sort((a,b) => b.ranking.score-a.ranking.score || Date.parse(searchDocument(b.type,b.row).date || 0)-Date.parse(searchDocument(a.type,a.row).date || 0) || String(a.row.id).localeCompare(String(b.row.id)));
  const page = ranked.slice(offset,offset+limit), results = page.map(item => publicSearchItem(item.type,item.row,item.ranking));
  const hasMore = offset + results.length < ranked.length;
  return { status:200,count:results.length,filters,queryMaterial:query,body:{ ok:true,operation:"search",version:API_VERSION,query,types,candidateCount:ranked.length,offset,returned:results.length,hasMore,nextOffset:hasMore ? offset+results.length : null,results } };
}

async function dispatch(supabase,operation,body) {
  if (operation === "health") return { status:200,count:1,filters:{},body:{ok:true,operation,version:API_VERSION} };
  if (operation === "search") return searchOperation(supabase,body);
  if (operation === "overview") {
    const rs = await Promise.all(["intelligence_signals","intelligence_papers","intelligence_grants","intelligence_trials","intelligence_patents","intelligence_runs"].map(t => supabase.from(t).select("id",{count:"exact",head:true})));
    const err = rs.find(r => r.error)?.error; if (err) throw err;
    return { status:200,count:6,filters:{},body:{ok:true,operation,version:API_VERSION,radar:{signals:rs[0].count||0,papers:rs[1].count||0,grants:rs[2].count||0,trials:rs[3].count||0,patents:rs[4].count||0,runs:rs[5].count||0}} };
  }
  if (operation === "signals") {
    const limit = clampInt(body.limit,20,1,50), line = cleanText(body.line,80), status = cleanText(body.status,80), signalType = cleanText(body.signalType || body.signal_type,80), minOpportunity = optionalScore(body.minOpportunity ?? body.min_opportunity), includeArchived = Boolean(body.includeArchived ?? body.include_archived);
    let q = supabase.from("intelligence_signals").select(SIGNAL_LIST_FIELDS,{count:"exact"}); if (!includeArchived) q=q.eq("auto_archived",false); if(line)q=q.eq("related_line",line); if(status)q=q.eq("status",status); if(signalType)q=q.eq("signal_type",signalType); if(minOpportunity!==null)q=q.gte("opportunity_score",minOpportunity);
    const res = await q.order("updated_at",{ascending:false}).limit(limit); if(res.error)throw res.error; const items=(res.data||[]).map(r=>publicSignal(r));
    return {status:200,count:items.length,filters:{line,status,signalType,minOpportunity,includeArchived,limit},body:{ok:true,operation,version:API_VERSION,total:res.count||0,returned:items.length,signals:items}};
  }
  if (operation === "signal" || operation === "signal_evidence") {
    const id=cleanText(body.id||body.signalId||body.signal_id,64); if(!UUID_RE.test(id))return{status:400,count:0,filters:{id},body:{ok:false,error:"Valid signal id required."}};
    const res=await supabase.from("intelligence_signals").select(SIGNAL_DETAIL_FIELDS).eq("id",id).maybeSingle(); if(res.error)throw res.error; if(!res.data)return{status:404,count:0,filters:{id},body:{ok:false,error:"Signal not found."}};
    if(operation==="signal")return{status:200,count:1,filters:{id},body:{ok:true,operation,version:API_VERSION,signal:publicSignal(res.data,true)}};
    const limit=clampInt(body.limit,25,1,25), evidence=await resolveEvidence(supabase,Array.isArray(res.data.evidence_refs)?res.data.evidence_refs:[],limit);
    return{status:200,count:evidence.length,filters:{id,limit},body:{ok:true,operation,version:API_VERSION,signal:{id:res.data.id,title:cleanText(res.data.title,600),relatedLine:cleanText(res.data.related_line,80),updatedAt:res.data.updated_at||null},declaredEvidenceCount:number(res.data.evidence_count),returned:evidence.length,evidence}};
  }
  if (operation === "runs") {
    const limit=clampInt(body.limit,10,1,30),status=cleanText(body.status,80),actionType=cleanText(body.actionType||body.action_type,80); let q=supabase.from("intelligence_runs").select(RUN_FIELDS); if(status)q=q.eq("status",status); if(actionType)q=q.eq("action_type",actionType); const res=await q.order("created_at",{ascending:false}).limit(limit); if(res.error)throw res.error;
    const rows=res.data||[],ids=[...new Set(rows.flatMap(r=>Array.isArray(r.sources_used)?r.sources_used:[]).filter(v=>UUID_RE.test(String(v))))],sourceMap=new Map(); if(ids.length){const s=await supabase.from("intelligence_sources").select("id,name,type").in("id",ids);if(s.error)throw s.error;for(const row of s.data||[])sourceMap.set(row.id,{id:row.id,name:cleanText(row.name,120),type:cleanText(row.type,80)});}
    const runs=rows.map(r=>({id:r.id,status:cleanText(r.status,80),actionType:cleanText(r.action_type,80),dryRun:Boolean(r.dry_run),startedAt:r.started_at||null,finishedAt:r.finished_at||null,itemsFetched:number(r.items_fetched),itemsCreated:number(r.items_created),itemsUpdated:number(r.items_updated),signalsGenerated:number(r.signals_generated),errorMessage:cleanText(r.error_message,1200),sources:(Array.isArray(r.sources_used)?r.sources_used:[]).map(id=>sourceMap.get(id)).filter(Boolean),createdAt:r.created_at||null,updatedAt:r.updated_at||null}));
    return{status:200,count:runs.length,filters:{status,actionType,limit},body:{ok:true,operation,version:API_VERSION,returned:runs.length,runs}};
  }
  return { status:400,count:0,filters:{},body:{ok:false,error:"Unsupported operation."} };
}

Deno.serve(async request => {
  const started=performance.now(); if(request.method!=="POST")return json({ok:false,error:"Method not allowed."},405);
  const url=Deno.env.get("SUPABASE_URL")||"",key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||""; if(!url||!key)return json({ok:false,error:"Service unavailable."},503);
  const supabase=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}),token=bearerToken(request); if(!token||token.length>MAX_TOKEN_LENGTH||!token.startsWith("bcc_agent_"))return json({ok:false,error:"Unauthorized."},401);
  const tokenHash=await sha256(token),clientRes=await supabase.from("intelligence_api_clients").select("id,name,scopes,enabled,expires_at,rate_limit_per_minute,daily_limit").eq("token_hash",tokenHash).maybeSingle(); if(clientRes.error){console.error("credential lookup failed",{code:clientRes.error.code});return json({ok:false,error:"Service unavailable."},503);}
  const client=clientRes.data,expired=client?.expires_at?Date.parse(client.expires_at)<=Date.now():false,scopes=Array.isArray(client?.scopes)?client.scopes.map(String):[]; if(!client||!client.enabled||expired||!scopes.includes(READ_SCOPE))return json({ok:false,error:"Unauthorized."},401);
  const body=await readJson(request),operation=cleanText(body.operation||"overview",80).toLowerCase()||"overview"; let outcome;
  if(!ALLOWED_OPERATIONS.has(operation))outcome={status:400,count:0,filters:{},body:{ok:false,error:"Unsupported operation."}}; else try{outcome=await dispatch(supabase,operation,body);}catch(error){console.error("operation failed",{operation,code:error?.code||"read_failure"});outcome={status:503,count:0,filters:{},body:{ok:false,error:"Service unavailable."}};}
  const durationMs=Math.max(0,Math.round(performance.now()-started)),queryHash=outcome.queryMaterial?await sha256(outcome.queryMaterial):Object.keys(outcome.filters||{}).length?await sha256(JSON.stringify(outcome.filters)):"",now=new Date().toISOString();
  const [audit,touch]=await Promise.all([supabase.from("intelligence_api_audit").insert({client_id:client.id,operation,query_hash:queryHash,result_count:outcome.count,duration_ms:durationMs,status_code:outcome.status,filters:outcome.filters||{}}),supabase.from("intelligence_api_clients").update({last_used_at:now,updated_at:now}).eq("id",client.id)]); if(audit.error)console.error("audit insert failed",{code:audit.error.code});if(touch.error)console.error("client touch failed",{code:touch.error.code});
  return json(outcome.body,outcome.status);
});