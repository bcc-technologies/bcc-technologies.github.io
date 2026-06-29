import { DOMINICAN_SOURCES, CURATED_INSTITUTIONS } from "./registry.mjs";
import { createDominicanStore } from "./store.mjs";
import { syncOpenDataCatalog } from "./connectors/ckanConnector.mjs";
import { syncDgcpDatasetMetadata } from "./connectors/dgcpConnector.mjs";
import { syncIderdServiceDirectory } from "./connectors/iderdConnector.mjs";
import { syncBcrdSkeleton } from "./connectors/bcrdConnector.mjs";
import { syncSibSkeleton } from "./connectors/sibConnector.mjs";

const SYNC_TARGETS = new Set(["all", "datos", "dgcp", "iderd", "bcrd", "sib"]);

function normalizeTarget(target) {
  const value = String(target || "all").trim().toLowerCase();
  return SYNC_TARGETS.has(value) ? value : "all";
}

function summarize(results = []) {
  return {
    datasets: results.reduce((sum, item) => sum + Number(item?.datasets?.length || 0), 0),
    resources: results.reduce((sum, item) => sum + Number(item?.resources?.length || 0), 0),
    institutions: results.reduce((sum, item) => sum + Number(item?.institutions?.length || 0), 0),
    geoLayers: results.reduce((sum, item) => sum + Number(item?.layers?.length || 0), 0),
    signals: results.reduce((sum, item) => sum + Number(item?.signals?.length || 0), 0)
  };
}

export async function runDominicanSync(options = {}) {
  const target = normalizeTarget(options.target);
  const store = options.store || createDominicanStore({ dataDir: options.dataDir });
  await store.seedRegistry();
  await store.upsertMany("sources", DOMINICAN_SOURCES);
  await store.upsertMany("institutions", CURATED_INSTITUTIONS);

  const results = [];
  const errors = [];
  const runStep = async (label, fn) => {
    try {
      results.push(await fn());
    } catch (error) {
      errors.push({ target: label, error: error.message || String(error) });
    }
  };

  if (target === "all" || target === "datos") {
    await runStep("datos", () => syncOpenDataCatalog(store, { limit: options.limit || 50 }));
  }
  if (target === "all" || target === "dgcp") {
    await runStep("dgcp", () => syncDgcpDatasetMetadata(store, { limitPerTerm: options.limitPerTerm || 8, termLimit: options.termLimit || 9 }));
  }
  if (target === "all" || target === "iderd") {
    await runStep("iderd", () => syncIderdServiceDirectory(store));
  }
  if (target === "all" || target === "bcrd") {
    await runStep("bcrd", () => syncBcrdSkeleton(store));
  }
  if (target === "all" || target === "sib") {
    await runStep("sib", () => syncSibSkeleton(store));
  }

  const dashboard = await store.dashboard();
  return {
    ok: errors.length === 0,
    target,
    summary: summarize(results),
    errors,
    dashboard
  };
}

export async function loadDominicanDashboard(options = {}) {
  const store = options.store || createDominicanStore({ dataDir: options.dataDir });
  await store.seedRegistry();
  return store.dashboard();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const targetArg = process.argv.find(arg => arg.startsWith("--target="));
  const target = targetArg ? targetArg.split("=").slice(1).join("=") : "all";
  runDominicanSync({ target })
    .then(result => {
      console.log(JSON.stringify({ ok: result.ok, target: result.target, summary: result.summary, errors: result.errors }, null, 2));
      process.exit(result.ok ? 0 : 1);
    })
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}
