import { cleanText, normalizeArxivId, normalizeTitle, stripDoiUrl, titleFingerprint } from "./connectors/base.mjs";
import { findPossibleDuplicateCandidates } from "./dedupe.mjs";

const SOURCE_COLUMNS = "id,name,type,enabled,last_sync_at";
const TOPIC_COLUMNS = "id,name,keywords,enabled";
const PAPER_COLUMNS = "id,title,normalized_title,doi,arxiv_id,external_id,source_id,citations_count,possible_duplicate,duplicate_candidates";
const PAPER_DIAGNOSTIC_COLUMNS = "id,source_id,external_id,doi,arxiv_id,title,abstract,authors,institutions,publication_date,source_name,source_url,journal_or_venue,topics,keywords,citations_count,open_access_url,raw_data";
const GRANT_COLUMNS = "id,source_id,external_id,title,agency,program,start_date,end_date,amount";
const SIGNAL_COLUMNS = "id,title,signal_type,related_line,confidence_score,opportunity_score,actionability_score,evidence_count,evidence_refs,score_breakdown,recommended_action,status";
const RUN_COLUMNS = "id,status,action_type,dry_run,started_at,finished_at,items_fetched,items_created,items_updated,signals_generated,error_message";

function assertEnv(name, value) {
  if (!value) throw new Error(`Missing required env var: ${name}`);
}

function redactSensitiveText(value, secrets = []) {
  let text = cleanText(value, 6000)
    .replace(/Bearer\s+[A-Za-z0-9._\-+/=]+/gi, "Bearer [redacted]")
    .replace(/apikey[:=]\s*[A-Za-z0-9._\-+/=]+/gi, "apikey=[redacted]")
    .replace(/token[:=]\s*[A-Za-z0-9._\-+/=]+/gi, "token=[redacted]");
  for (const secret of secrets.filter(Boolean)) {
    if (String(secret).length >= 6) {
      text = text.split(String(secret)).join("[redacted]");
    }
  }
  return text;
}

function restUrl(baseUrl, pathname, params = {}) {
  const url = new URL(`/rest/v1/${pathname}`, baseUrl);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && typeof value !== "undefined" && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  return url;
}

async function restFetch(baseUrl, serviceKey, pathname, {
  method = "GET",
  params = {},
  body,
  prefer
} = {}) {
  const response = await fetch(restUrl(baseUrl, pathname, params), {
    method,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Accept: "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });

  if (!response.ok) {
    throw new Error(`Supabase ${method} ${pathname} failed with ${response.status}: ${await response.text()}`);
  }
  if (response.status === 204) return null;
  return response.json();
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
    raw_data: item.rawData && typeof item.rawData === "object" ? item.rawData : {}
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
    raw_data: item.rawData && typeof item.rawData === "object" ? item.rawData : {}
  };
}

export function createIntelligenceStoreFromEnv() {
  const baseUrl = String(process.env.SUPABASE_URL || "").trim();
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const knownSecrets = [serviceKey];
  assertEnv("SUPABASE_URL", baseUrl);
  assertEnv("SUPABASE_SERVICE_ROLE_KEY", serviceKey);

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

    async listSignalInputs() {
      const [
        papers,
        grants,
        patents,
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
      const rows = await restFetch(baseUrl, serviceKey, "intelligence_papers", {
        params: {
          select: PAPER_DIAGNOSTIC_COLUMNS,
          order: "updated_at.desc",
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
        openAccessUrl: item.open_access_url || "",
        rawData: item.raw_data && typeof item.raw_data === "object" ? item.raw_data : {}
      })) : [];
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
      if (found?.id) return found;

      const createdRows = await restFetch(baseUrl, serviceKey, "intelligence_sources", {
        method: "POST",
        prefer: "return=representation",
        body: {
          name: sourceName,
          type: sourceType,
          base_url: cleanText(connector?.baseUrl || "", 500),
          enabled: true,
          requires_api_key: Boolean(connector?.requiresApiKey),
          rate_limit_notes: cleanText(connector?.rateLimitNotes || "", 2000)
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

      const rows = await restFetch(baseUrl, serviceKey, "intelligence_papers", {
        params: {
          select: PAPER_COLUMNS,
          order: "updated_at.desc",
          limit: 50
        }
      });
      const candidates = (Array.isArray(rows) ? rows : [])
        .filter(row => row?.id && row.id !== excludeId)
        .map(row => ({
          id: row.id,
          externalId: row.external_id || "",
          sourceType: "",
          title: row.title || "",
          normalizedTitle: row.normalized_title || ""
        }));

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
        const rows = await restFetch(baseUrl, serviceKey, "intelligence_papers", {
          method: "PATCH",
          prefer: "return=representation",
          params: {
            id: `eq.${existing.id}`
          },
          body: {
            ...payload,
            citations_count: Math.max(payload.citations_count, Number(existing.citations_count) || 0),
            possible_duplicate: Boolean(payload.possible_duplicate || existing.possible_duplicate),
            duplicate_candidates: Array.isArray(payload.duplicate_candidates) && payload.duplicate_candidates.length
              ? payload.duplicate_candidates
              : (Array.isArray(existing.duplicate_candidates) ? existing.duplicate_candidates : [])
          }
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

    async findExistingGrant(item, sourceId) {
      const externalId = cleanText(item?.externalId || "", 200);
      if (sourceId && externalId) {
        const rows = await restFetch(baseUrl, serviceKey, "intelligence_grants", {
          params: {
            select: GRANT_COLUMNS,
            source_id: `eq.${sourceId}`,
            external_id: `eq.${externalId}`,
            limit: 1
          }
        });
        const found = Array.isArray(rows) ? rows[0] : rows;
        if (found?.id) return found;
      }

      const title = cleanText(item?.title || "", 600);
      if (!title) return null;
      const rows = await restFetch(baseUrl, serviceKey, "intelligence_grants", {
        params: {
          select: GRANT_COLUMNS,
          title: `eq.${title}`,
          limit: 5
        }
      });
      const matches = Array.isArray(rows) ? rows : [];
      return matches.find(row =>
        cleanText(row?.agency || "", 180).toLowerCase() === cleanText(item?.agency || "", 180).toLowerCase()
        && cleanText(row?.program || "", 220).toLowerCase() === cleanText(item?.program || "", 220).toLowerCase()
      ) || matches[0] || null;
    },

    async saveGrant(item, sourceId) {
      const existing = await this.findExistingGrant(item, sourceId);
      const payload = mapGrantRecord(item, sourceId);
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
              : Math.max(Number(payload.amount) || 0, Number(existing.amount) || 0)
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
