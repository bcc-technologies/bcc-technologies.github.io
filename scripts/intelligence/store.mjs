import { cleanText, normalizeArxivId, normalizeTitle, stripDoiUrl, titleFingerprint } from "./connectors/base.mjs";
import { findPossibleDuplicateCandidates } from "./dedupe.mjs";
import { redactSensitiveText, supabaseRestFetch as restFetch } from "../lib/supabase-rest.mjs";

const SOURCE_COLUMNS = "id,name,type,base_url,enabled,requires_api_key,rate_limit_notes,last_sync_at";
const TOPIC_COLUMNS = "id,name,keywords,enabled,updated_at";
const PAPER_COLUMNS = "id,title,normalized_title,doi,arxiv_id,external_id,source_id,citations_count,possible_duplicate,duplicate_candidates";
const PAPER_DIAGNOSTIC_COLUMNS = "id,source_id,external_id,doi,arxiv_id,title,abstract,authors,institutions,publication_date,source_name,source_url,journal_or_venue,topics,keywords,citations_count,open_access_url";
const GRANT_COLUMNS = "id,source_id,external_id,title,agency,program,start_date,end_date,amount,possible_duplicate,duplicate_candidates";
const PATENT_COLUMNS = "id,source_id,external_id,title,jurisdiction,status,publication_date,filing_date,possible_duplicate,duplicate_candidates";
const TRIAL_COLUMNS = "id,source_id,external_id,title,status,study_type,start_date,completion_date,sponsor,possible_duplicate,duplicate_candidates";
const SIGNAL_COLUMNS = "id,title,signal_type,related_line,confidence_score,opportunity_score,actionability_score,evidence_count,evidence_refs,score_breakdown,recommended_action,status";
const RUN_COLUMNS = "id,status,action_type,dry_run,started_at,finished_at,items_fetched,items_created,items_updated,signals_generated,error_message";

function assertEnv(name, value) {
  if (!value) throw new Error(`Missing required env var: ${name}`);
}

function mapPaperRecord(item, sourceId) {
  const doi = stripDoiUrl(item.doi || "").toLowerCase();
  const arxivId = normalizeArxivId(item.arxivId || "").toLowerCase();
  const normalizedTitle = titleFingerprint(normalizeTitle(item.title || "", 600));
  return {
    source_id: sourceId,
    external_id: cleanText(item.externalId || "", 200),
    doi,
    arxiv_id: arxivId,
    normalized_title: cleanText(normalizedTitle, 600),
    title: cleanText(item.title || "", 600),
    abstract: cleanText(item.abstract || "", 40000),
    authors: Array.isArray(item.authors) ? item.authors : [],
    institutions: Array.isArray(item.institutions) ? item.institutions : [],
    publication_date: item.publicationDate || null,
    source_name: cleanText(item.sourceName || "", 120),
    source_url: cleanText(item.sourceUrl || "", 500),
    journal_or_venue: cleanText(item.journalOrVenue || "", 240),
    topics: Array.isArray(item.topics) ? item.topics : [],
    keywords: Array.isArray(item.keywords) ? item.keywords : [],
    citations_count: Math.max(0, Number(item.citationsCount) || 0),
    open_access_url: cleanText(item.openAccessUrl || "", 500),
    possible_duplicate: Boolean(item.possibleDuplicate),
    duplicate_candidates: Array.isArray(item.duplicateCandidates) ? item.duplicateCandidates.slice(0, 8) : [],
    raw_data: item.rawData && typeof item.rawData === "object" ? item.rawData : {},
    // Every caller of savePaper() passes an item whose topics already went
    // through enrichItemTopics() -- either at initial ingestion or in the
    // topic-diagnostics scan -- so this timestamp is accurate either way. It
    // drives listPapersForTopicDiagnostics()'s ordering: without it, that scan
    // always picked the same most-recently-updated rows and never reached
    // older papers that were never touched again after being created.
    topics_checked_at: new Date().toISOString()
  };
}

function mapGrantRecord(item, sourceId) {
  return {
    source_id: sourceId,
    external_id: cleanText(item.externalId || "", 200),
    title: cleanText(item.title || "", 600),
    abstract: cleanText(item.abstract || "", 40000),
    agency: cleanText(item.agency || "", 180),
    program: cleanText(item.program || "", 220),
    amount: item.amount === null || typeof item.amount === "undefined"
      ? null
      : Math.max(0, Number(item.amount) || 0),
    currency: cleanText(item.currency || "USD", 8).toUpperCase(),
    start_date: item.startDate || null,
    end_date: item.endDate || null,
    principal_investigators: Array.isArray(item.principalInvestigators) ? item.principalInvestigators : [],
    institutions: Array.isArray(item.institutions) ? item.institutions : [],
    country: cleanText(item.country || "", 120),
    source_url: cleanText(item.sourceUrl || "", 500),
    topics: Array.isArray(item.topics) ? item.topics : [],
    possible_duplicate: Boolean(item.possibleDuplicate),
    duplicate_candidates: Array.isArray(item.duplicateCandidates) ? item.duplicateCandidates.slice(0, 8) : [],
    raw_data: item.rawData && typeof item.rawData === "object" ? item.rawData : {}
  };
}

function mapPatentRecord(item, sourceId) {
  return {
    source_id: sourceId,
    external_id: cleanText(item.externalId || "", 200),
    title: cleanText(item.title || "", 600),
    abstract: cleanText(item.abstract || "", 40000),
    inventors: Array.isArray(item.inventors) ? item.inventors : [],
    assignees: Array.isArray(item.assignees) ? item.assignees : [],
    publication_date: item.publicationDate || null,
    filing_date: item.filingDate || null,
    jurisdiction: cleanText(item.jurisdiction || "", 40).toUpperCase(),
    status: cleanText(item.status || "unknown", 24).toLowerCase() || "unknown",
    source_url: cleanText(item.sourceUrl || "", 500),
    topics: Array.isArray(item.topics) ? item.topics : [],
    possible_duplicate: Boolean(item.possibleDuplicate),
    duplicate_candidates: Array.isArray(item.duplicateCandidates) ? item.duplicateCandidates.slice(0, 8) : [],
    raw_data: item.rawData && typeof item.rawData === "object" ? item.rawData : {}
  };
}

function mapTrialRecord(item, sourceId) {
  return {
    source_id: sourceId,
    external_id: cleanText(item.externalId || "", 200),
    title: cleanText(item.title || "", 600),
    summary: cleanText(item.summary || "", 40000),
    conditions: Array.isArray(item.conditions) ? item.conditions : [],
    interventions: Array.isArray(item.interventions) ? item.interventions : [],
    phase: cleanText(item.phase || "", 120),
    status: cleanText(item.status || "", 120),
    study_type: cleanText(item.studyType || "", 120),
    sponsor: cleanText(item.sponsor || "", 200),
    collaborators: Array.isArray(item.collaborators) ? item.collaborators : [],
    start_date: item.startDate || null,
    completion_date: item.completionDate || null,
    locations: Array.isArray(item.locations) ? item.locations : [],
    countries: Array.isArray(item.countries) ? item.countries : [],
    source_url: cleanText(item.sourceUrl || "", 500),
    topics: Array.isArray(item.topics) ? item.topics : [],
    keywords: Array.isArray(item.keywords) ? item.keywords : [],
    possible_duplicate: Boolean(item.possibleDuplicate),
    duplicate_candidates: Array.isArray(item.duplicateCandidates) ? item.duplicateCandidates.slice(0, 8) : [],
    raw_data: item.rawData && typeof item.rawData === "object" ? item.rawData : {}
  };
}

export function createIntelligenceStoreFromEnv() {
  const baseUrl = String(process.env.SUPABASE_URL || "").trim();
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const knownSecrets = [serviceKey];
  assertEnv("SUPABASE_URL", baseUrl);
  assertEnv("SUPABASE_SERVICE_ROLE_KEY", serviceKey);

  // findPossiblePaperDuplicates() used to compare each new paper against only
  // the 50 most-recently-updated papers, so a duplicate of an older paper
  // nobody had touched since was never caught -- a recency-biased sample, not
  // a representative one. PAPER_COLUMNS is lean (no raw_data), so fetching the
  // whole corpus is cheap: 543 papers today cost ~167 KB. Cached for the
  // lifetime of this store instance (one sync run), since intra-batch
  // duplicates are already caught separately by annotatePossibleDuplicates()
  // before any paper reaches savePaper(). The 2000-row cap is a safety net,
  // not an expected ceiling, for whenever the corpus outgrows "fetch it all".
  let duplicateCandidatePapers = null;
  async function loadDuplicateCandidatePapers() {
    if (duplicateCandidatePapers) return duplicateCandidatePapers;
    const rows = await restFetch(baseUrl, serviceKey, "intelligence_papers", {
      params: {
        select: PAPER_COLUMNS,
        order: "updated_at.desc",
        limit: 2000
      }
    });
    duplicateCandidatePapers = (Array.isArray(rows) ? rows : []).map(row => ({
      id: row.id,
      externalId: row.external_id || "",
      sourceType: "",
      title: row.title || "",
      normalizedTitle: row.normalized_title || ""
    }));
    return duplicateCandidatePapers;
  }

  // Grants/patents/trials never had an equivalent of the above -- their
  // findExisting*() functions used to fall back to an exact title match that
  // silently PATCH-merged into whatever record it found first, with no
  // human-review step. These loaders back the same fuzzy-similarity-then-flag
  // pattern papers use instead, one small cached corpus per table.
  function createDuplicateCandidateLoader(table) {
    let cache = null;
    return async function loadCandidates() {
      if (cache) return cache;
      const rows = await restFetch(baseUrl, serviceKey, table, {
        params: {
          select: "id,external_id,title",
          order: "updated_at.desc",
          limit: 2000
        }
      });
      cache = (Array.isArray(rows) ? rows : []).map(row => ({
        id: row.id,
        externalId: row.external_id || "",
        sourceType: "",
        title: row.title || ""
      }));
      return cache;
    };
  }

  const loadDuplicateCandidateGrants = createDuplicateCandidateLoader("intelligence_grants");
  const loadDuplicateCandidatePatents = createDuplicateCandidateLoader("intelligence_patents");
  const loadDuplicateCandidateTrials = createDuplicateCandidateLoader("intelligence_trials");

  return {
    async listEnabledTopics() {
      const rows = await restFetch(baseUrl, serviceKey, "intelligence_topics", {
        params: {
          select: TOPIC_COLUMNS,
          enabled: "eq.true",
          order: "updated_at.desc"
        }
      });
      return Array.isArray(rows) ? rows : [];
    },

    async listEnabledSources() {
      const rows = await restFetch(baseUrl, serviceKey, "intelligence_sources", {
        params: {
          select: SOURCE_COLUMNS,
          enabled: "eq.true",
          order: "updated_at.desc"
        }
      });
      return Array.isArray(rows) ? rows : [];
    },

    async listSettings() {
      const rows = await restFetch(baseUrl, serviceKey, "intelligence_settings", {
        params: {
          select: "id,max_results_per_source,default_date_range_days,suggested_frequency,default_dry_run,scoring_thresholds,monitored_lines",
          order: "updated_at.desc",
          limit: 1
        }
      });
      return Array.isArray(rows) ? (rows[0] || null) : null;
    },

    // Lets runTopicDiagnostics() skip its whole scan when no topic changed
    // since the last time it ran -- the scan exists to catch papers whose
    // topics no longer match the topics config, so there's nothing to find
    // when that config hasn't moved.
    async getTopicsDiagnosticsState() {
      const rows = await restFetch(baseUrl, serviceKey, "intelligence_settings", {
        params: {
          select: "id,topics_diagnostics_last_run_at",
          order: "updated_at.desc",
          limit: 1
        }
      });
      const row = Array.isArray(rows) ? rows[0] : rows;
      return row ? { id: row.id, lastRunAt: row.topics_diagnostics_last_run_at || null } : null;
    },

    async markTopicsDiagnosticsRun(settingsId) {
      if (!settingsId) return;
      await restFetch(baseUrl, serviceKey, "intelligence_settings", {
        method: "PATCH",
        params: { id: `eq.${settingsId}` },
        body: { topics_diagnostics_last_run_at: new Date().toISOString() }
      });
    },

    async listSignalInputs() {
      const [
        papers,
        grants,
        patents,
        trials,
        institutions,
        topics
      ] = await Promise.all([
        restFetch(baseUrl, serviceKey, "intelligence_papers", {
          params: {
            select: "id,title,abstract,authors,institutions,publication_date,source_name,source_url,journal_or_venue,topics,keywords,citations_count,open_access_url,possible_duplicate,duplicate_candidates,raw_data",
            order: "publication_date.desc,updated_at.desc",
            limit: 300
          }
        }),
        restFetch(baseUrl, serviceKey, "intelligence_grants", {
          params: {
            select: "id,title,abstract,agency,program,institutions,country,source_url,topics,raw_data",
            order: "updated_at.desc",
            limit: 200
          }
        }),
        restFetch(baseUrl, serviceKey, "intelligence_patents", {
          params: {
            select: "id,title,abstract,assignees,jurisdiction,status,source_url,topics,raw_data",
            order: "publication_date.desc,updated_at.desc",
            limit: 200
          }
        }),
        restFetch(baseUrl, serviceKey, "intelligence_trials", {
          params: {
            select: "id,title,summary,conditions,interventions,phase,status,study_type,sponsor,collaborators,start_date,completion_date,locations,countries,source_url,topics,keywords,raw_data",
            order: "start_date.desc,updated_at.desc",
            limit: 200
          }
        }),
        restFetch(baseUrl, serviceKey, "intelligence_institutions", {
          params: {
            select: "id,name,website,source_url,topics",
            order: "updated_at.desc",
            limit: 200
          }
        }),
        restFetch(baseUrl, serviceKey, "intelligence_topics", {
          params: {
            select: "id,name,description,category,keywords,enabled",
            enabled: "eq.true",
            order: "updated_at.desc",
            limit: 100
          }
        })
      ]);

      return {
        papers: Array.isArray(papers) ? papers.map(item => ({
          id: item.id,
          title: item.title || "",
          abstract: item.abstract || "",
          authors: Array.isArray(item.authors) ? item.authors : [],
          institutions: Array.isArray(item.institutions) ? item.institutions : [],
          publicationDate: item.publication_date || "",
          sourceName: item.source_name || "",
          sourceUrl: item.source_url || "",
          journalOrVenue: item.journal_or_venue || "",
          topics: Array.isArray(item.topics) ? item.topics : [],
          keywords: Array.isArray(item.keywords) ? item.keywords : [],
          citationsCount: Number(item.citations_count || 0),
          openAccessUrl: item.open_access_url || "",
          rawData: item.raw_data && typeof item.raw_data === "object" ? item.raw_data : {}
        })) : [],
        grants: Array.isArray(grants) ? grants.map(item => ({
          id: item.id,
          title: item.title || "",
          abstract: item.abstract || "",
          agency: item.agency || "",
          program: item.program || "",
          institutions: Array.isArray(item.institutions) ? item.institutions : [],
          country: item.country || "",
          sourceUrl: item.source_url || "",
          topics: Array.isArray(item.topics) ? item.topics : [],
          rawData: item.raw_data && typeof item.raw_data === "object" ? item.raw_data : {}
        })) : [],
        patents: Array.isArray(patents) ? patents.map(item => ({
          id: item.id,
          title: item.title || "",
          abstract: item.abstract || "",
          assignees: Array.isArray(item.assignees) ? item.assignees : [],
          jurisdiction: item.jurisdiction || "",
          status: item.status || "",
          sourceUrl: item.source_url || "",
          topics: Array.isArray(item.topics) ? item.topics : [],
          rawData: item.raw_data && typeof item.raw_data === "object" ? item.raw_data : {}
        })) : [],
        trials: Array.isArray(trials) ? trials.map(item => ({
          id: item.id,
          title: item.title || "",
          summary: item.summary || "",
          conditions: Array.isArray(item.conditions) ? item.conditions : [],
          interventions: Array.isArray(item.interventions) ? item.interventions : [],
          phase: item.phase || "",
          status: item.status || "",
          studyType: item.study_type || "",
          sponsor: item.sponsor || "",
          collaborators: Array.isArray(item.collaborators) ? item.collaborators : [],
          startDate: item.start_date || "",
          completionDate: item.completion_date || "",
          locations: Array.isArray(item.locations) ? item.locations : [],
          countries: Array.isArray(item.countries) ? item.countries : [],
          sourceUrl: item.source_url || "",
          topics: Array.isArray(item.topics) ? item.topics : [],
          keywords: Array.isArray(item.keywords) ? item.keywords : [],
          rawData: item.raw_data && typeof item.raw_data === "object" ? item.raw_data : {}
        })) : [],
        institutions: Array.isArray(institutions) ? institutions.map(item => ({
          id: item.id,
          name: item.name || "",
          website: item.website || "",
          sourceUrl: item.source_url || "",
          topics: Array.isArray(item.topics) ? item.topics : []
        })) : [],
        topics: Array.isArray(topics) ? topics.map(item => ({
          id: item.id,
          name: item.name || "",
          description: item.description || "",
          category: item.category || "general",
          keywords: Array.isArray(item.keywords) ? item.keywords : [],
          enabled: Boolean(item.enabled)
        })) : []
      };
    },

    async listPapersForTopicDiagnostics(limit = 300) {
      // Ordering by topics_checked_at (oldest/never-checked first) instead of
      // updated_at guarantees every paper eventually rotates through this scan.
      // Sorting by recency alone meant a paper that was checked once got its
      // updated_at bumped to the front of the queue, while papers nobody ever
      // touched again kept sinking further behind and could go unreachable
      // once the corpus grew past this limit.
      const rows = await restFetch(baseUrl, serviceKey, "intelligence_papers", {
        params: {
          select: PAPER_DIAGNOSTIC_COLUMNS,
          order: "topics_checked_at.asc.nullsfirst,updated_at.desc",
          limit: Math.min(500, Math.max(1, Number(limit) || 300))
        }
      });
      return Array.isArray(rows) ? rows.map(item => ({
        id: item.id,
        sourceId: item.source_id || "",
        externalId: item.external_id || "",
        doi: item.doi || "",
        arxivId: item.arxiv_id || "",
        title: item.title || "",
        abstract: item.abstract || "",
        authors: Array.isArray(item.authors) ? item.authors : [],
        institutions: Array.isArray(item.institutions) ? item.institutions : [],
        publicationDate: item.publication_date || "",
        sourceName: item.source_name || "",
        sourceUrl: item.source_url || "",
        journalOrVenue: item.journal_or_venue || "",
        topics: Array.isArray(item.topics) ? item.topics : [],
        keywords: Array.isArray(item.keywords) ? item.keywords : [],
        citationsCount: Number(item.citations_count || 0),
        openAccessUrl: item.open_access_url || ""
        // rawData intentionally omitted here: this scan only needs text fields for
        // topic matching, and raw_data is the heaviest column on this table. savePaper()
        // preserves the existing raw_data on repair since this item never carries it.
      })) : [];
    },

    // Papers scanned by the diagnostics pass whose topic set didn't need a
    // change never go through savePaper(), so nothing stamps topics_checked_at
    // for them. Without this, a paper with correct topics would be re-picked
    // by listPapersForTopicDiagnostics() forever, starving papers that were
    // never checked at all. One bulk PATCH per diagnostics run instead of one
    // per paper.
    async markPapersTopicsChecked(ids) {
      const uniqueIds = [...new Set((Array.isArray(ids) ? ids : []).filter(Boolean))];
      if (!uniqueIds.length) return;
      await restFetch(baseUrl, serviceKey, "intelligence_papers", {
        method: "PATCH",
        params: {
          id: `in.(${uniqueIds.join(",")})`
        },
        body: {
          topics_checked_at: new Date().toISOString()
        }
      });
    },

    async ensureSourceRecord(connector) {
      const sourceType = cleanText(connector?.sourceType || "", 80).toLowerCase();
      const sourceName = cleanText(connector?.sourceName || "", 120);
      const existing = await restFetch(baseUrl, serviceKey, "intelligence_sources", {
        params: {
          select: SOURCE_COLUMNS,
          type: `eq.${sourceType}`,
          limit: 1
        }
      });
      const found = Array.isArray(existing) ? existing[0] : existing;
      const desiredEnabled = connector?.enforcedDisabled ? false : connector?.defaultEnabled !== false;
      const desiredNotes = cleanText(connector?.rateLimitNotes || "", 2000);
      if (found?.id) {
        const patch = {};
        if (cleanText(found.name || "", 120) !== sourceName) patch.name = sourceName;
        if (cleanText(found.base_url || "", 500) !== cleanText(connector?.baseUrl || "", 500)) patch.base_url = cleanText(connector?.baseUrl || "", 500);
        if (Boolean(found.requires_api_key) !== Boolean(connector?.requiresApiKey)) patch.requires_api_key = Boolean(connector?.requiresApiKey);
        if (cleanText(found.rate_limit_notes || "", 2000) !== desiredNotes) patch.rate_limit_notes = desiredNotes;
        if (connector?.enforcedDisabled && found.enabled !== false) patch.enabled = false;
        if (Object.keys(patch).length) {
          const rows = await restFetch(baseUrl, serviceKey, "intelligence_sources", {
            method: "PATCH",
            prefer: "return=representation",
            params: {
              id: `eq.${found.id}`
            },
            body: patch
          });
          return Array.isArray(rows) ? rows[0] : rows;
        }
        return found;
      }

      const createdRows = await restFetch(baseUrl, serviceKey, "intelligence_sources", {
        method: "POST",
        prefer: "return=representation",
        body: {
          name: sourceName,
          type: sourceType,
          base_url: cleanText(connector?.baseUrl || "", 500),
          enabled: desiredEnabled,
          requires_api_key: Boolean(connector?.requiresApiKey),
          rate_limit_notes: desiredNotes
        }
      });
      return Array.isArray(createdRows) ? createdRows[0] : createdRows;
    },

    async findSourceRecord(sourceType) {
      const cleanType = cleanText(sourceType || "", 80).toLowerCase();
      if (!cleanType) return null;
      const rows = await restFetch(baseUrl, serviceKey, "intelligence_sources", {
        params: {
          select: SOURCE_COLUMNS,
          type: `eq.${cleanType}`,
          limit: 1
        }
      });
      return Array.isArray(rows) ? rows[0] || null : rows;
    },

    async touchSourceSync(sourceId) {
      await restFetch(baseUrl, serviceKey, "intelligence_sources", {
        method: "PATCH",
        params: {
          id: `eq.${sourceId}`
        },
        body: {
          last_sync_at: new Date().toISOString()
        }
      });
    },

    async startRun(meta = {}) {
      const rows = await restFetch(baseUrl, serviceKey, "intelligence_runs", {
        method: "POST",
        prefer: "return=representation",
        body: {
          status: "running",
          action_type: cleanText(meta.actionType || "sync_papers", 80),
          dry_run: Boolean(meta.dryRun),
          started_at: new Date().toISOString(),
          sources_used: Array.isArray(meta.sourcesUsed) ? meta.sourcesUsed : [],
          items_fetched: 0,
          items_created: 0,
          items_updated: 0,
          signals_generated: 0,
          error_message: ""
        }
      });
      return Array.isArray(rows) ? rows[0] : rows;
    },

    async completeRun(runId, metrics = {}) {
      const rows = await restFetch(baseUrl, serviceKey, "intelligence_runs", {
        method: "PATCH",
        prefer: "return=representation",
        params: {
          id: `eq.${runId}`
        },
        body: {
          status: "completed",
          finished_at: new Date().toISOString(),
          items_fetched: Math.max(0, Number(metrics.itemsFetched) || 0),
          items_created: Math.max(0, Number(metrics.itemsCreated) || 0),
          items_updated: Math.max(0, Number(metrics.itemsUpdated) || 0),
          signals_generated: Math.max(0, Number(metrics.signalsGenerated) || 0),
          error_message: ""
        }
      });
      return Array.isArray(rows) ? rows[0] : rows;
    },

    async failRun(runId, error) {
      const rows = await restFetch(baseUrl, serviceKey, "intelligence_runs", {
        method: "PATCH",
        prefer: "return=representation",
        params: {
          id: `eq.${runId}`
        },
        body: {
          status: "failed",
          finished_at: new Date().toISOString(),
          error_message: redactSensitiveText(error?.message || String(error || "Unknown intelligence sync error"), knownSecrets)
        }
      });
      return Array.isArray(rows) ? rows[0] : rows;
    },

    async findExistingPaper(item, sourceId) {
      const doi = stripDoiUrl(item?.doi || "").toLowerCase();
      if (doi) {
        const rows = await restFetch(baseUrl, serviceKey, "intelligence_papers", {
          params: {
            select: PAPER_COLUMNS,
            doi: `eq.${doi}`,
            limit: 1
          }
        });
        const found = Array.isArray(rows) ? rows[0] : rows;
        if (found?.id) return found;
      }

      const arxivId = normalizeArxivId(item?.arxivId || "").toLowerCase();
      if (arxivId) {
        const rows = await restFetch(baseUrl, serviceKey, "intelligence_papers", {
          params: {
            select: PAPER_COLUMNS,
            arxiv_id: `eq.${arxivId}`,
            limit: 1
          }
        });
        const found = Array.isArray(rows) ? rows[0] : rows;
        if (found?.id) return found;
      }

      const externalId = cleanText(item?.externalId || "", 200);
      if (sourceId && externalId) {
        const rows = await restFetch(baseUrl, serviceKey, "intelligence_papers", {
          params: {
            select: PAPER_COLUMNS,
            source_id: `eq.${sourceId}`,
            external_id: `eq.${externalId}`,
            limit: 1
          }
        });
        const found = Array.isArray(rows) ? rows[0] : rows;
        if (found?.id) return found;
      }

      return null;
    },

    async findPossiblePaperDuplicates(item, excludeId = "") {
      const normalizedTitle = cleanText(titleFingerprint(normalizeTitle(item?.title || "", 600)), 600);
      if (!normalizedTitle) return [];

      const allCandidates = await loadDuplicateCandidatePapers();
      const candidates = allCandidates.filter(row => row?.id && row.id !== excludeId);

      return findPossibleDuplicateCandidates(item, candidates).map(candidate => {
        const match = candidates.find(row =>
          cleanText(row.externalId || "", 200) === cleanText(candidate.externalId || "", 200)
          && titleFingerprint(row.title || "") === titleFingerprint(candidate.title || "")
        );
        return {
          ...candidate,
          paperId: match?.id || ""
        };
      });
    },

    async savePaper(item, sourceId) {
      const existing = await this.findExistingPaper(item, sourceId);
      const duplicateCandidates = await this.findPossiblePaperDuplicates(item, existing?.id || "");
      const payload = mapPaperRecord({
        ...item,
        possibleDuplicate: !existing && duplicateCandidates.length > 0,
        duplicateCandidates
      }, sourceId);
      if (existing?.id) {
        const patchBody = {
          ...payload,
          citations_count: Math.max(payload.citations_count, Number(existing.citations_count) || 0),
          possible_duplicate: Boolean(payload.possible_duplicate || existing.possible_duplicate),
          duplicate_candidates: Array.isArray(payload.duplicate_candidates) && payload.duplicate_candidates.length
            ? payload.duplicate_candidates
            : (Array.isArray(existing.duplicate_candidates) ? existing.duplicate_candidates : [])
        };
        // Callers like the topic-diagnostics scan never fetch raw_data (it's the
        // heaviest column and unused for that pass), so item.rawData is absent
        // there rather than an intentional {}. Omit the key in that case so the
        // PATCH leaves the existing raw_data untouched instead of wiping it.
        if (!Object.prototype.hasOwnProperty.call(item, "rawData")) {
          delete patchBody.raw_data;
        }
        const rows = await restFetch(baseUrl, serviceKey, "intelligence_papers", {
          method: "PATCH",
          prefer: "return=representation",
          params: {
            id: `eq.${existing.id}`
          },
          body: patchBody
        });
        const updated = Array.isArray(rows) ? rows[0] : rows;
        return { action: "updated", record: updated };
      }

      const rows = await restFetch(baseUrl, serviceKey, "intelligence_papers", {
        method: "POST",
        prefer: "return=representation",
        body: payload
      });
      const created = Array.isArray(rows) ? rows[0] : rows;
      return { action: "created", record: created };
    },

    // Every grant connector (nsf-awards, nih-reporter) filters out items
    // without an externalId before they reach the store, so source_id +
    // external_id is always a reliable identity match here. This used to also
    // fall back to an exact title match plus a loose agency/program check,
    // and merged into the first row found even when that secondary check
    // failed -- two different grants that happened to share a title (a real
    // occurrence with generic program names) could get silently PATCHed
    // together. That fallback is gone; findPossibleGrantDuplicates() below
    // covers the "same title" case by flagging it for human review instead.
    async findExistingGrant(item, sourceId) {
      const externalId = cleanText(item?.externalId || "", 200);
      if (!sourceId || !externalId) return null;
      const rows = await restFetch(baseUrl, serviceKey, "intelligence_grants", {
        params: {
          select: GRANT_COLUMNS,
          source_id: `eq.${sourceId}`,
          external_id: `eq.${externalId}`,
          limit: 1
        }
      });
      const found = Array.isArray(rows) ? rows[0] : rows;
      return found?.id ? found : null;
    },

    async findPossibleGrantDuplicates(item, excludeId = "") {
      const title = cleanText(item?.title || "", 600);
      if (!title) return [];
      const allCandidates = await loadDuplicateCandidateGrants();
      const candidates = allCandidates.filter(row => row?.id && row.id !== excludeId);
      return findPossibleDuplicateCandidates(item, candidates).map(candidate => {
        const match = candidates.find(row =>
          cleanText(row.externalId || "", 200) === cleanText(candidate.externalId || "", 200)
          && titleFingerprint(row.title || "") === titleFingerprint(candidate.title || "")
        );
        return { ...candidate, grantId: match?.id || "" };
      });
    },

    async saveGrant(item, sourceId) {
      const existing = await this.findExistingGrant(item, sourceId);
      const duplicateCandidates = await this.findPossibleGrantDuplicates(item, existing?.id || "");
      const payload = mapGrantRecord({
        ...item,
        possibleDuplicate: !existing && duplicateCandidates.length > 0,
        duplicateCandidates
      }, sourceId);
      if (existing?.id) {
        const rows = await restFetch(baseUrl, serviceKey, "intelligence_grants", {
          method: "PATCH",
          prefer: "return=representation",
          params: {
            id: `eq.${existing.id}`
          },
          body: {
            ...payload,
            amount: payload.amount === null
              ? existing.amount
              : Math.max(Number(payload.amount) || 0, Number(existing.amount) || 0),
            possible_duplicate: Boolean(payload.possible_duplicate || existing.possible_duplicate),
            duplicate_candidates: Array.isArray(payload.duplicate_candidates) && payload.duplicate_candidates.length
              ? payload.duplicate_candidates
              : (Array.isArray(existing.duplicate_candidates) ? existing.duplicate_candidates : [])
          }
        });
        return { action: "updated", record: Array.isArray(rows) ? rows[0] : rows };
      }

      const rows = await restFetch(baseUrl, serviceKey, "intelligence_grants", {
        method: "POST",
        prefer: "return=representation",
        body: payload
      });
      return { action: "created", record: Array.isArray(rows) ? rows[0] : rows };
    },

    // epo-ops filters out documents without an externalId before they reach
    // the store, and uspto is disabled entirely, so source_id + external_id
    // is always available and reliable here. Dropped the exact-title +
    // jurisdiction fallback for the same reason as grants: it merged into
    // whatever row it found first whenever the jurisdiction check failed.
    async findExistingPatent(item, sourceId) {
      const externalId = cleanText(item?.externalId || "", 200);
      if (!sourceId || !externalId) return null;
      const rows = await restFetch(baseUrl, serviceKey, "intelligence_patents", {
        params: {
          select: PATENT_COLUMNS,
          source_id: `eq.${sourceId}`,
          external_id: `eq.${externalId}`,
          limit: 1
        }
      });
      const found = Array.isArray(rows) ? rows[0] : rows;
      return found?.id ? found : null;
    },

    async findPossiblePatentDuplicates(item, excludeId = "") {
      const title = cleanText(item?.title || "", 600);
      if (!title) return [];
      const allCandidates = await loadDuplicateCandidatePatents();
      const candidates = allCandidates.filter(row => row?.id && row.id !== excludeId);
      return findPossibleDuplicateCandidates(item, candidates).map(candidate => {
        const match = candidates.find(row =>
          cleanText(row.externalId || "", 200) === cleanText(candidate.externalId || "", 200)
          && titleFingerprint(row.title || "") === titleFingerprint(candidate.title || "")
        );
        return { ...candidate, patentId: match?.id || "" };
      });
    },

    async savePatent(item, sourceId) {
      const existing = await this.findExistingPatent(item, sourceId);
      const duplicateCandidates = await this.findPossiblePatentDuplicates(item, existing?.id || "");
      const payload = mapPatentRecord({
        ...item,
        possibleDuplicate: !existing && duplicateCandidates.length > 0,
        duplicateCandidates
      }, sourceId);
      if (existing?.id) {
        const rows = await restFetch(baseUrl, serviceKey, "intelligence_patents", {
          method: "PATCH",
          prefer: "return=representation",
          params: {
            id: `eq.${existing.id}`
          },
          body: {
            ...payload,
            possible_duplicate: Boolean(payload.possible_duplicate || existing.possible_duplicate),
            duplicate_candidates: Array.isArray(payload.duplicate_candidates) && payload.duplicate_candidates.length
              ? payload.duplicate_candidates
              : (Array.isArray(existing.duplicate_candidates) ? existing.duplicate_candidates : [])
          }
        });
        return { action: "updated", record: Array.isArray(rows) ? rows[0] : rows };
      }

      const rows = await restFetch(baseUrl, serviceKey, "intelligence_patents", {
        method: "POST",
        prefer: "return=representation",
        body: payload
      });
      return { action: "created", record: Array.isArray(rows) ? rows[0] : rows };
    },

    // clinicaltrials.mjs filters out studies without an NCT id (externalId)
    // before they reach the store, so source_id + external_id is always
    // available and reliable here. Dropped the exact-title + sponsor fallback
    // for the same reason as grants/patents.
    async findExistingTrial(item, sourceId) {
      const externalId = cleanText(item?.externalId || "", 200);
      if (!sourceId || !externalId) return null;
      const rows = await restFetch(baseUrl, serviceKey, "intelligence_trials", {
        params: {
          select: TRIAL_COLUMNS,
          source_id: `eq.${sourceId}`,
          external_id: `eq.${externalId}`,
          limit: 1
        }
      });
      const found = Array.isArray(rows) ? rows[0] : rows;
      return found?.id ? found : null;
    },

    async findPossibleTrialDuplicates(item, excludeId = "") {
      const title = cleanText(item?.title || "", 600);
      if (!title) return [];
      const allCandidates = await loadDuplicateCandidateTrials();
      const candidates = allCandidates.filter(row => row?.id && row.id !== excludeId);
      return findPossibleDuplicateCandidates(item, candidates).map(candidate => {
        const match = candidates.find(row =>
          cleanText(row.externalId || "", 200) === cleanText(candidate.externalId || "", 200)
          && titleFingerprint(row.title || "") === titleFingerprint(candidate.title || "")
        );
        return { ...candidate, trialId: match?.id || "" };
      });
    },

    async saveTrial(item, sourceId) {
      const existing = await this.findExistingTrial(item, sourceId);
      const duplicateCandidates = await this.findPossibleTrialDuplicates(item, existing?.id || "");
      const payload = mapTrialRecord({
        ...item,
        possibleDuplicate: !existing && duplicateCandidates.length > 0,
        duplicateCandidates
      }, sourceId);
      if (existing?.id) {
        const rows = await restFetch(baseUrl, serviceKey, "intelligence_trials", {
          method: "PATCH",
          prefer: "return=representation",
          params: {
            id: `eq.${existing.id}`
          },
          body: {
            ...payload,
            possible_duplicate: Boolean(payload.possible_duplicate || existing.possible_duplicate),
            duplicate_candidates: Array.isArray(payload.duplicate_candidates) && payload.duplicate_candidates.length
              ? payload.duplicate_candidates
              : (Array.isArray(existing.duplicate_candidates) ? existing.duplicate_candidates : [])
          }
        });
        return { action: "updated", record: Array.isArray(rows) ? rows[0] : rows };
      }

      const rows = await restFetch(baseUrl, serviceKey, "intelligence_trials", {
        method: "POST",
        prefer: "return=representation",
        body: payload
      });
      return { action: "created", record: Array.isArray(rows) ? rows[0] : rows };
    },

    async findExistingSignal(signal) {
      const title = cleanText(signal?.title || "", 240);
      const signalType = cleanText(signal?.signalType || "", 80);
      const relatedLine = cleanText(signal?.relatedLine || "General", 40);
      if (!title || !signalType) return null;
      const rows = await restFetch(baseUrl, serviceKey, "intelligence_signals", {
        params: {
          select: SIGNAL_COLUMNS,
          title: `eq.${title}`,
          signal_type: `eq.${signalType}`,
          related_line: `eq.${relatedLine}`,
          limit: 1
        }
      });
      return Array.isArray(rows) ? rows[0] || null : rows;
    },

    async saveSignal(signal) {
      const payload = {
        title: cleanText(signal?.title || "", 240),
        summary: cleanText(signal?.summary || "", 6000),
        signal_type: cleanText(signal?.signalType || "", 80),
        related_line: cleanText(signal?.relatedLine || "General", 40),
        confidence_score: Math.max(0, Math.min(100, Number(signal?.confidenceScore) || 0)),
        opportunity_score: Math.max(0, Math.min(100, Number(signal?.opportunityScore) || 0)),
        actionability_score: Math.max(0, Math.min(100, Number(signal?.actionabilityScore) || 0)),
        evidence_count: Math.max(0, Number(signal?.evidenceCount) || 0),
        evidence_refs: Array.isArray(signal?.evidenceRefs) ? signal.evidenceRefs.slice(0, 12) : [],
        score_breakdown: signal?.scoreBreakdown && typeof signal.scoreBreakdown === "object" ? signal.scoreBreakdown : {},
        recommended_action: cleanText(signal?.recommendedAction || "", 6000),
        status: cleanText(signal?.status || "new", 24) || "new"
      };
      const existing = await this.findExistingSignal(signal);
      if (existing?.id) {
        const rows = await restFetch(baseUrl, serviceKey, "intelligence_signals", {
          method: "PATCH",
          prefer: "return=representation",
          params: {
            id: `eq.${existing.id}`
          },
          body: payload
        });
        return { action: "updated", record: Array.isArray(rows) ? rows[0] : rows };
      }

      const rows = await restFetch(baseUrl, serviceKey, "intelligence_signals", {
        method: "POST",
        prefer: "return=representation",
        body: payload
      });
      return { action: "created", record: Array.isArray(rows) ? rows[0] : rows };
    },

    async getRun(runId) {
      const rows = await restFetch(baseUrl, serviceKey, "intelligence_runs", {
        params: {
          select: RUN_COLUMNS,
          id: `eq.${runId}`,
          limit: 1
        }
      });
      return Array.isArray(rows) ? rows[0] : rows;
    }
  };
}
