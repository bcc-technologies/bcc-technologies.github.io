import { pathToFileURL } from "node:url";
import { CONNECTORS, getConnectors } from "./intelligence/connectors/index.mjs";
import { cleanArray, cleanText } from "./intelligence/connectors/base.mjs";
import { annotatePossibleDuplicates, dedupeItems } from "./intelligence/dedupe.mjs";
import { generateStrategicSignals } from "./intelligence/signals.mjs";
import { createIntelligenceStoreFromEnv } from "./intelligence/store.mjs";

const PAPER_ACTIONS = new Set(["sync_papers", "fetch_papers"]);
const GRANT_ACTIONS = new Set(["fetch_grants"]);
const PATENT_ACTIONS = new Set(["fetch_patents"]);
const TRIAL_ACTIONS = new Set(["fetch_trials"]);

function redactSensitiveText(value) {
  return String(value || "")
    .replace(/Bearer\s+[A-Za-z0-9._\-+/=]+/gi, "Bearer [redacted]")
    .replace(/apikey[:=]\s*[A-Za-z0-9._\-+/=]+/gi, "apikey=[redacted]")
    .replace(/token[:=]\s*[A-Za-z0-9._\-+/=]+/gi, "token=[redacted]");
}

function parseArgs(argv) {
  const options = {
    sourceTypes: [],
    keywords: [],
    dryRun: false,
    action: "sync_papers",
    limit: 20,
    queryText: "",
    fromDate: "",
    toDate: ""
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--action" && next) {
      options.action = String(next).trim().toLowerCase();
      index += 1;
      continue;
    }
    if (arg === "--source" && next) {
      options.sourceTypes = next.split(",").map(value => value.trim()).filter(Boolean);
      index += 1;
      continue;
    }
    if ((arg === "--query" || arg === "--text") && next) {
      options.queryText = next;
      index += 1;
      continue;
    }
    if (arg === "--keyword" && next) {
      options.keywords.push(next);
      index += 1;
      continue;
    }
    if (arg === "--limit" && next) {
      options.limit = Math.min(100, Math.max(1, Number(next) || 20));
      index += 1;
      continue;
    }
    if (arg === "--from" && next) {
      options.fromDate = next;
      index += 1;
      continue;
    }
    if (arg === "--to" && next) {
      options.toDate = next;
      index += 1;
      continue;
    }
  }

  return options;
}

function normalizeOptions(rawOptions = {}) {
  return {
    sourceTypes: Array.isArray(rawOptions.sourceTypes) ? rawOptions.sourceTypes.filter(Boolean) : [],
    keywords: Array.isArray(rawOptions.keywords) ? rawOptions.keywords.filter(Boolean) : [],
    dryRun: Boolean(rawOptions.dryRun),
    action: String(rawOptions.action || "sync_papers").trim().toLowerCase() || "sync_papers",
    limit: Math.min(100, Math.max(1, Number(rawOptions.limit) || 20)),
    queryText: cleanText(rawOptions.queryText || "", 400),
    fromDate: cleanText(rawOptions.fromDate || "", 32),
    toDate: cleanText(rawOptions.toDate || "", 32)
  };
}

function hasSupabaseEnv() {
  return Boolean(String(process.env.SUPABASE_URL || "").trim() && String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim());
}

async function resolveKeywords(store, options) {
  const explicitKeywords = cleanArray(options.keywords, 32, 120);
  if (explicitKeywords.length || cleanText(options.queryText, 400)) {
    return explicitKeywords;
  }

  if (!store) {
    throw new Error("No query keywords provided and Supabase env is missing. Pass --query or --keyword.");
  }

  const topics = await store.listEnabledTopics();
  return cleanArray(
    topics.flatMap(topic => Array.isArray(topic?.keywords) ? topic.keywords : [topic?.name || ""]),
    32,
    120
  );
}

async function resolveSourceTypes(store, options) {
  const explicitTypes = Array.isArray(options.sourceTypes) ? options.sourceTypes.filter(Boolean) : [];
  if (explicitTypes.length) return explicitTypes;
  if (!store) return [];

  const enabledSources = await store.listEnabledSources();
  return enabledSources
    .map(source => String(source?.type || "").trim().toLowerCase())
    .filter(Boolean);
}

function actionLabel(action) {
  const labels = {
    sync_papers: "Run Intelligence Sync",
    fetch_papers: "Fetch latest papers",
    fetch_grants: "Fetch grants",
    fetch_patents: "Fetch patents",
    fetch_trials: "Fetch trials",
    generate_signals: "Generate signals"
  };
  return labels[action] || action || "Unknown action";
}

function normalizeTopicMatchValue(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function topicMatchTerms(topic) {
  return cleanArray(
    [
      topic?.name || "",
      ...(Array.isArray(topic?.keywords) ? topic.keywords : [])
    ],
    32,
    120
  )
    .map(normalizeTopicMatchValue)
    .filter(Boolean);
}

function itemTopicHaystack(item) {
  return [
    item?.title,
    item?.abstract,
    item?.summary,
    ...(Array.isArray(item?.topics) ? item.topics : []),
    ...(Array.isArray(item?.keywords) ? item.keywords : []),
    ...(Array.isArray(item?.conditions) ? item.conditions : []),
    ...(Array.isArray(item?.interventions) ? item.interventions : []),
    ...(Array.isArray(item?.institutions) ? item.institutions : []),
    ...(Array.isArray(item?.authors) ? item.authors : []),
    ...(Array.isArray(item?.principalInvestigators) ? item.principalInvestigators : []),
    ...(Array.isArray(item?.assignees) ? item.assignees : []),
    ...(Array.isArray(item?.collaborators) ? item.collaborators : []),
    ...(Array.isArray(item?.locations) ? item.locations : []),
    ...(Array.isArray(item?.countries) ? item.countries : []),
    item?.agency,
    item?.program,
    item?.country,
    item?.phase,
    item?.status,
    item?.studyType,
    item?.sponsor,
    item?.journalOrVenue,
    item?.sourceName
  ]
    .map(normalizeTopicMatchValue)
    .join(" ");
}

function enrichItemTopics(item, topics = []) {
  if (!topics.length) return item;
  const explicitTopics = Array.isArray(item?.topics) ? item.topics : [];
  const explicitNormalized = explicitTopics.map(normalizeTopicMatchValue);
  const haystack = itemTopicHaystack(item);
  const matchedTopicNames = topics
    .filter(topic => topic?.enabled !== false)
    .filter(topic => {
      const topicName = normalizeTopicMatchValue(topic?.name || "");
      if (topicName && explicitNormalized.includes(topicName)) return true;
      return topicMatchTerms(topic).some(term => term && haystack.includes(term));
    })
    .map(topic => cleanText(topic?.name || "", 160))
    .filter(Boolean);

  const topicsOut = cleanArray([...explicitTopics, ...matchedTopicNames], 64, 120);
  return {
    ...item,
      topics: topicsOut
  };
}

function sameTopicSet(left = [], right = []) {
  const normalize = values => cleanArray(values, 64, 120)
    .map(normalizeTopicMatchValue)
    .sort();
  const a = normalize(left);
  const b = normalize(right);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

async function runTopicDiagnostics(store, topics, logger) {
  if (!store || !topics.length || typeof store.listPapersForTopicDiagnostics !== "function") {
    return { scanned: 0, repaired: 0, candidates: 0 };
  }

  const existingPapers = await store.listPapersForTopicDiagnostics(300);
  let repaired = 0;
  let candidates = 0;

  for (const paper of existingPapers) {
    const enriched = enrichItemTopics(paper, topics);
    if (sameTopicSet(paper.topics, enriched.topics)) continue;
    candidates += 1;
    await store.savePaper(enriched, paper.sourceId || "");
    repaired += 1;
  }

  if (logger?.log) {
    logger.log(`[diagnostics:topics] scanned ${existingPapers.length} papers · candidates ${candidates} · repaired ${repaired}`);
  }

  return {
    scanned: existingPapers.length,
    repaired,
    candidates
  };
}

function dryRunSignalContext(store, topics, dedupedItems) {
  if (store) {
    // Dry-run still uses persisted topics/grants/patents when available so scoring is representative,
    // but replaces papers with the just-fetched batch to avoid accidental writes.
    return store.listSignalInputs().then(context => ({
      ...context,
      papers: dedupedItems
    }));
  }
  return Promise.resolve({
    papers: dedupedItems,
    grants: [],
    patents: [],
    trials: [],
    institutions: [],
    topics
  });
}

function dedupeGrantItems(items = []) {
  const seen = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const externalId = cleanText(item?.externalId || "", 200).toLowerCase();
    const title = cleanText(item?.title || "", 600).toLowerCase();
    const sourceType = cleanText(item?.sourceType || "", 80).toLowerCase();
    const key = externalId ? `${sourceType}:${externalId}` : `${sourceType}:title:${title}`;
    if (!key || seen.has(key)) continue;
    seen.set(key, item);
  }
  return [...seen.values()].filter(item => cleanText(item?.title || "", 600));
}

function logSourceFailure(logger, connector, error) {
  const message = `[source:${connector.sourceType}] ${error instanceof Error ? error.message : String(error)}`;
  if (typeof logger?.warn === "function") {
    logger.warn(message);
    return;
  }
  if (typeof logger?.log === "function") {
    logger.log(message);
  }
}

export async function runIntelligenceSync(rawOptions = {}, deps = {}) {
  const options = normalizeOptions(rawOptions);
  const logger = deps.logger || console;
  const store = Object.prototype.hasOwnProperty.call(deps, "store")
    ? deps.store
    : (hasSupabaseEnv() ? createIntelligenceStoreFromEnv() : null);
  const action = options.action;
  let connectors = [];
  let sourceRecords = [];
  let run = null;
  let enabledTopics = [];

  if (PAPER_ACTIONS.has(action) || GRANT_ACTIONS.has(action) || PATENT_ACTIONS.has(action) || TRIAL_ACTIONS.has(action)) {
    if (store && !options.dryRun && !deps.connectors) {
      const registryConnectors = CONNECTORS;
      await Promise.all(registryConnectors.map(connector => store.ensureSourceRecord(connector)));
    }
    const sourceTypes = await resolveSourceTypes(store, options);
    connectors = deps.connectors || getConnectors(sourceTypes, action);
    if (!connectors.length) {
      throw new Error("No intelligence connectors selected.");
    }
    if (store && (PAPER_ACTIONS.has(action) || GRANT_ACTIONS.has(action) || PATENT_ACTIONS.has(action) || TRIAL_ACTIONS.has(action))) {
      enabledTopics = await store.listEnabledTopics();
    }
  }

  if (store) {
    if (options.dryRun) {
      sourceRecords = (await Promise.all(
        connectors.map(connector => store.findSourceRecord(connector.sourceType))
      )).filter(Boolean);
    } else {
      sourceRecords = await Promise.all(connectors.map(connector => store.ensureSourceRecord(connector)));
    }
    run = await store.startRun({
      sourcesUsed: sourceRecords.map(record => record.id),
      actionType: action,
      dryRun: options.dryRun
    });
  }

  try {
    if (action === "generate_signals") {
      if (!store) throw new Error("Generate signals requires Supabase env.");
      const context = await store.listSignalInputs();
      const signals = generateStrategicSignals(context);
      let savedSignals = 0;
      if (!options.dryRun) {
        for (const signal of signals) {
          await store.saveSignal(signal);
          savedSignals += 1;
        }
      }
      if (run && store) {
        await store.completeRun(run.id, {
          itemsFetched: context.papers.length + context.grants.length + context.patents.length + (context.trials?.length || 0),
          itemsCreated: 0,
          itemsUpdated: 0,
          signalsGenerated: signals.length
        });
      }
      const result = {
        action,
        dryRun: options.dryRun,
        connectors: [],
        sourceRecords,
        itemsFetched: context.papers.length + context.grants.length + context.patents.length + (context.trials?.length || 0),
        itemsDeduped: context.papers.length,
        itemsCreated: 0,
        itemsUpdated: 0,
        signalsGenerated: signals.length,
        signalsSaved: savedSignals,
        runId: run?.id || ""
      };
      logger.log(`${actionLabel(action)} complete. Evidence items: ${result.itemsFetched}. Signals: ${signals.length}. Saved: ${savedSignals}. Dry run: ${options.dryRun ? "yes" : "no"}.`);
      return result;
    }

    if (GRANT_ACTIONS.has(action)) {
      const keywords = await resolveKeywords(store, options);
      const query = {
        text: cleanText(options.queryText, 400),
        keywords,
        limit: options.limit,
        fromDate: options.fromDate,
        toDate: options.toDate
      };

      const fetchedBySource = [];
      const sourceFailures = [];
      for (const connector of connectors) {
        try {
          const items = (await connector.search(query)).map(item => enrichItemTopics(item, enabledTopics));
          fetchedBySource.push({ connector, items });
          logger.log(`[source:${connector.sourceType}] fetched ${items.length} grants`);
        } catch (error) {
          sourceFailures.push({ sourceType: connector.sourceType, message: error instanceof Error ? error.message : String(error) });
          logSourceFailure(logger, connector, error);
        }
      }
      if (!fetchedBySource.length && sourceFailures.length) {
        throw new Error(sourceFailures.map(item => `${item.sourceType}: ${item.message}`).join(" | "));
      }

      const combinedItems = fetchedBySource.flatMap(entry => entry.items);
      const dedupedItems = dedupeGrantItems(combinedItems);
      let itemsCreated = 0;
      let itemsUpdated = 0;

      if (store && !options.dryRun) {
        for (const entry of fetchedBySource) {
          const sourceRecord = sourceRecords.find(record => record.type === entry.connector.sourceType);
          if (!sourceRecord?.id) continue;
          for (const item of dedupeGrantItems(entry.items)) {
            const result = await store.saveGrant(item, sourceRecord.id);
            if (result.action === "created") itemsCreated += 1;
            if (result.action === "updated") itemsUpdated += 1;
          }
          await store.touchSourceSync(sourceRecord.id);
        }
      }

      if (run && store) {
        await store.completeRun(run.id, {
          itemsFetched: combinedItems.length,
          itemsCreated,
          itemsUpdated,
          signalsGenerated: 0
        });
      }

      const result = {
        action,
        dryRun: options.dryRun,
        connectors: connectors.map(connector => connector.sourceType),
        sourceRecords,
        itemsFetched: combinedItems.length,
        itemsDeduped: dedupedItems.length,
        itemsCreated,
        itemsUpdated,
        signalsGenerated: 0,
        sourceFailures,
        runId: run?.id || ""
      };
      logger.log(`${actionLabel(action)} complete. Sources: ${connectors.length}. Fetched: ${combinedItems.length}. Deduped: ${dedupedItems.length}. Created: ${itemsCreated}. Updated: ${itemsUpdated}. Dry run: ${options.dryRun ? "yes" : "no"}.`);
      return result;
    }

    if (PATENT_ACTIONS.has(action)) {
      const keywords = await resolveKeywords(store, options);
      const query = {
        text: cleanText(options.queryText, 400),
        keywords,
        limit: options.limit,
        fromDate: options.fromDate,
        toDate: options.toDate
      };

      const fetchedBySource = [];
      const sourceFailures = [];
      for (const connector of connectors) {
        try {
          const items = (await connector.search(query)).map(item => enrichItemTopics(item, enabledTopics));
          fetchedBySource.push({ connector, items });
          logger.log(`[source:${connector.sourceType}] fetched ${items.length} patents`);
        } catch (error) {
          sourceFailures.push({ sourceType: connector.sourceType, message: error instanceof Error ? error.message : String(error) });
          logSourceFailure(logger, connector, error);
        }
      }
      if (!fetchedBySource.length && sourceFailures.length) {
        throw new Error(sourceFailures.map(item => `${item.sourceType}: ${item.message}`).join(" | "));
      }

      const combinedItems = fetchedBySource.flatMap(entry => entry.items);
      const dedupedItems = dedupeGrantItems(combinedItems);
      let itemsCreated = 0;
      let itemsUpdated = 0;

      if (store && !options.dryRun) {
        for (const entry of fetchedBySource) {
          const sourceRecord = sourceRecords.find(record => record.type === entry.connector.sourceType);
          if (!sourceRecord?.id) continue;
          for (const item of dedupeGrantItems(entry.items)) {
            const result = await store.savePatent(item, sourceRecord.id);
            if (result.action === "created") itemsCreated += 1;
            if (result.action === "updated") itemsUpdated += 1;
          }
          await store.touchSourceSync(sourceRecord.id);
        }
      }

      if (run && store) {
        await store.completeRun(run.id, {
          itemsFetched: combinedItems.length,
          itemsCreated,
          itemsUpdated,
          signalsGenerated: 0
        });
      }

      const result = {
        action,
        dryRun: options.dryRun,
        connectors: connectors.map(connector => connector.sourceType),
        sourceRecords,
        itemsFetched: combinedItems.length,
        itemsDeduped: dedupedItems.length,
        itemsCreated,
        itemsUpdated,
        signalsGenerated: 0,
        sourceFailures,
        runId: run?.id || ""
      };
      logger.log(`${actionLabel(action)} complete. Sources: ${connectors.length}. Fetched: ${combinedItems.length}. Deduped: ${dedupedItems.length}. Created: ${itemsCreated}. Updated: ${itemsUpdated}. Dry run: ${options.dryRun ? "yes" : "no"}.`);
      return result;
    }

    if (TRIAL_ACTIONS.has(action)) {
      const keywords = await resolveKeywords(store, options);
      const query = {
        text: cleanText(options.queryText, 400),
        keywords,
        limit: options.limit,
        fromDate: options.fromDate,
        toDate: options.toDate
      };

      const fetchedBySource = [];
      const sourceFailures = [];
      for (const connector of connectors) {
        try {
          const items = (await connector.search(query)).map(item => enrichItemTopics(item, enabledTopics));
          fetchedBySource.push({ connector, items });
          logger.log(`[source:${connector.sourceType}] fetched ${items.length} trials`);
        } catch (error) {
          sourceFailures.push({ sourceType: connector.sourceType, message: error instanceof Error ? error.message : String(error) });
          logSourceFailure(logger, connector, error);
        }
      }
      if (!fetchedBySource.length && sourceFailures.length) {
        throw new Error(sourceFailures.map(item => `${item.sourceType}: ${item.message}`).join(" | "));
      }

      const combinedItems = fetchedBySource.flatMap(entry => entry.items);
      const dedupedItems = dedupeGrantItems(combinedItems);
      let itemsCreated = 0;
      let itemsUpdated = 0;

      if (store && !options.dryRun) {
        for (const entry of fetchedBySource) {
          const sourceRecord = sourceRecords.find(record => record.type === entry.connector.sourceType);
          if (!sourceRecord?.id) continue;
          for (const item of dedupeGrantItems(entry.items)) {
            const result = await store.saveTrial(item, sourceRecord.id);
            if (result.action === "created") itemsCreated += 1;
            if (result.action === "updated") itemsUpdated += 1;
          }
          await store.touchSourceSync(sourceRecord.id);
        }
      }

      if (run && store) {
        await store.completeRun(run.id, {
          itemsFetched: combinedItems.length,
          itemsCreated,
          itemsUpdated,
          signalsGenerated: 0
        });
      }

      const result = {
        action,
        dryRun: options.dryRun,
        connectors: connectors.map(connector => connector.sourceType),
        sourceRecords,
        itemsFetched: combinedItems.length,
        itemsDeduped: dedupedItems.length,
        itemsCreated,
        itemsUpdated,
        signalsGenerated: 0,
        sourceFailures,
        runId: run?.id || ""
      };
      logger.log(`${actionLabel(action)} complete. Sources: ${connectors.length}. Fetched: ${combinedItems.length}. Deduped: ${dedupedItems.length}. Created: ${itemsCreated}. Updated: ${itemsUpdated}. Dry run: ${options.dryRun ? "yes" : "no"}.`);
      return result;
    }

    if (!PAPER_ACTIONS.has(action)) {
      throw new Error(`${actionLabel(action)} is not implemented yet.`);
    }

    const keywords = await resolveKeywords(store, options);
    const query = {
      text: cleanText(options.queryText, 400),
      keywords,
      limit: options.limit,
      fromDate: options.fromDate,
      toDate: options.toDate
    };

    const fetchedBySource = [];
    const sourceFailures = [];

    for (const connector of connectors) {
      try {
        const items = (await connector.search(query)).map(item => enrichItemTopics(item, enabledTopics));
        fetchedBySource.push({
          connector,
          items
        });
        logger.log(`[source:${connector.sourceType}] fetched ${items.length} items`);
      } catch (error) {
        sourceFailures.push({ sourceType: connector.sourceType, message: error instanceof Error ? error.message : String(error) });
        logSourceFailure(logger, connector, error);
      }
    }
    if (!fetchedBySource.length && sourceFailures.length) {
      throw new Error(sourceFailures.map(item => `${item.sourceType}: ${item.message}`).join(" | "));
    }

    const combinedItems = fetchedBySource.flatMap(entry => entry.items);
    const dedupedItems = annotatePossibleDuplicates(dedupeItems(combinedItems));

    let itemsCreated = 0;
    let itemsUpdated = 0;
    let signalsGenerated = 0;
    let diagnostics = { scanned: 0, repaired: 0, candidates: 0 };

    if (store && !options.dryRun) {
      for (const entry of fetchedBySource) {
        const sourceRecord = sourceRecords.find(record => record.type === entry.connector.sourceType);
        if (!sourceRecord?.id) continue;
        for (const item of annotatePossibleDuplicates(dedupeItems(entry.items))) {
          const result = await store.savePaper(item, sourceRecord.id);
          if (result.action === "created") itemsCreated += 1;
          if (result.action === "updated") itemsUpdated += 1;
        }
        await store.touchSourceSync(sourceRecord.id);
      }

      diagnostics = await runTopicDiagnostics(store, enabledTopics, logger);
      itemsUpdated += diagnostics.repaired;

      if (action === "sync_papers") {
        const signalContext = await store.listSignalInputs();
        const signals = generateStrategicSignals(signalContext);
        for (const signal of signals) {
          await store.saveSignal(signal);
        }
        signalsGenerated = signals.length;
      }
    } else if (action === "sync_papers") {
      const signalContext = await dryRunSignalContext(store, [], dedupedItems);
      const signals = generateStrategicSignals(signalContext);
      signalsGenerated = signals.length;
    }

    if (run && store) {
      await store.completeRun(run.id, {
        itemsFetched: combinedItems.length,
        itemsCreated,
        itemsUpdated,
        signalsGenerated
      });
    }

    const result = {
      action,
      dryRun: options.dryRun,
      connectors: connectors.map(connector => connector.sourceType),
      sourceRecords,
      itemsFetched: combinedItems.length,
      itemsDeduped: dedupedItems.length,
      itemsCreated,
      itemsUpdated,
        signalsGenerated,
        diagnostics,
        sourceFailures,
        runId: run?.id || ""
      };
    logger.log(`${actionLabel(action)} complete. Sources: ${connectors.length}. Fetched: ${combinedItems.length}. Deduped: ${dedupedItems.length}. Created: ${itemsCreated}. Updated: ${itemsUpdated}. Signals: ${signalsGenerated}. Topic diagnostics repaired: ${diagnostics.repaired}. Dry run: ${options.dryRun ? "yes" : "no"}.`);
    return result;
  } catch (error) {
    if (run && store) {
      await store.failRun(run.id, error);
    }
    throw error;
  }
}

async function main() {
  return runIntelligenceSync(parseArgs(process.argv.slice(2)));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(redactSensitiveText(error?.stack || error?.message || String(error)));
    process.exitCode = 1;
  });
}
