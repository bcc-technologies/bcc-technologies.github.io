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

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const store = hasSupabaseEnv() ? createIntelligenceStoreFromEnv() : null;
  const action = String(options.action || "sync_papers").trim().toLowerCase();
  let connectors = [];
  let sourceRecords = [];
  let run = null;

  if (PAPER_ACTIONS.has(action)) {
    const sourceTypes = await resolveSourceTypes(store, options);
    connectors = getConnectors(sourceTypes);
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
      console.log(`${actionLabel(action)} complete. Evidence items: ${context.papers.length + context.grants.length + context.patents.length}. Signals: ${signals.length}. Saved: ${savedSignals}. Dry run: ${options.dryRun ? "yes" : "no"}.`);
      return;
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
      console.log(`[source:${connector.sourceType}] fetched ${items.length} items`);
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
      const signals = generateStrategicSignals({
        papers: dedupedItems,
        grants: [],
        patents: [],
        institutions: [],
        topics: store ? (await store.listSignalInputs()).topics : []
      });
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

    console.log(`${actionLabel(action)} complete. Sources: ${connectors.length}. Fetched: ${combinedItems.length}. Deduped: ${dedupedItems.length}. Created: ${itemsCreated}. Updated: ${itemsUpdated}. Signals: ${signalsGenerated}. Dry run: ${options.dryRun ? "yes" : "no"}.`);
  } catch (error) {
    if (run && store) {
      await store.failRun(run.id, error);
    }
    throw error;
  }
}

main().catch(error => {
  console.error(redactSensitiveText(error?.stack || error?.message || String(error)));
  process.exitCode = 1;
});
