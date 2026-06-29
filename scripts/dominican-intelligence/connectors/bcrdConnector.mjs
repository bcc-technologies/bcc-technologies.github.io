import { sourceById } from "../registry.mjs";
import { sourceHealthSignal } from "../scoring.mjs";

export async function syncBcrdSkeleton(store) {
  const source = sourceById("bcrd");
  const run = await store.startRun({ sourceId: source.id, connectorKey: source.connectorKey, metadataJson: { target: "bcrd", liveIndicators: false } });
  const signal = sourceHealthSignal(source, "BCRD connector is registered but live indicator sync is planned, not enabled.");
  signal.id = "sig-planned-bcrd";
  signal.category = "economic";
  signal.relevanceScore = 42;
  signal.urgency = "low";
  await store.upsertMany("signals", [signal]);
  await store.completeRun(run.id, {
    sourceId: source.id,
    sourceStatus: "planned",
    status: "completed",
    recordsFound: 0,
    recordsCreated: 0,
    recordsUpdated: 0,
    metadataJson: { plannedIndicatorGroups: ["inflation", "exchange_rates", "labor_market", "tourism", "external_sector"], noFakeLiveValues: true }
  });
  return { indicators: [], signals: [signal] };
}
