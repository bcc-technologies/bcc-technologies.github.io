import { pathToFileURL } from "node:url";
import { getConnectors } from "./intelligence/connectors/index.mjs";
import { cleanArray, cleanText } from "./intelligence/connectors/base.mjs";
import { annotatePossibleDuplicates, dedupeItems } from "./intelligence/dedupe.mjs";
import { generateStrategicSignals } from "./intelligence/signals.mjs";
import { createIntelligenceStoreFromEnv } from "./intelligence/store.mjs";

const PAPER_ACTIONS = new Set(["sync_papers", "fetch_papers"]);

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
    generate_signals: "Generate signals"
  };
  return labels[action] || action || "Unknown action";
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
    institutions: [],
    topics
  });
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

  if (PAPER_ACTIONS.has(action)) {
    const sourceTypes = await resolveSourceTypes(store, options);
    connectors = deps.connectors || getConnectors(sourceTypes);
    if (!connectors.length) {
      throw new Error("No intelligence connectors selected.");
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
          itemsFetched: context.papers.length + context.grants.length + context.patents.length,
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
        itemsFetched: context.papers.length + context.grants.length + context.patents.length,
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

    for (const connector of connectors) {
      const items = await connector.search(query);
      fetchedBySource.push({
        connector,
        items
      });
      logger.log(`[source:${connector.sourceType}] fetched ${items.length} items`);
    }

    const combinedItems = fetchedBySource.flatMap(entry => entry.items);
    const dedupedItems = annotatePossibleDuplicates(dedupeItems(combinedItems));

    let itemsCreated = 0;
    let itemsUpdated = 0;
    let signalsGenerated = 0;

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
      runId: run?.id || ""
    };
    logger.log(`${actionLabel(action)} complete. Sources: ${connectors.length}. Fetched: ${combinedItems.length}. Deduped: ${dedupedItems.length}. Created: ${itemsCreated}. Updated: ${itemsUpdated}. Signals: ${signalsGenerated}. Dry run: ${options.dryRun ? "yes" : "no"}.`);
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
