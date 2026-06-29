import { sourceById } from "../registry.mjs";
import { sourceHealthSignal } from "../scoring.mjs";

export async function syncSibSkeleton(store) {
  const source = sourceById("sib");
  const run = await store.startRun({ sourceId: source.id, connectorKey: source.connectorKey, metadataJson: { target: "sib", liveStatistics: false } });
  const signal = sourceHealthSignal(source, "Superintendencia de Bancos connector is registered but live financial statistic sync is planned, not enabled.");
  signal.id = "sig-planned-sib";
  signal.category = "economic";
  signal.relevanceScore = 38;
  signal.urgency = "low";
  await store.upsertMany("signals", [signal]);
  await store.completeRun(run.id, {
    sourceId: source.id,
    sourceStatus: "planned",
    status: "completed",
    recordsFound: 0,
    recordsCreated: 0,
    recordsUpdated: 0,
    metadataJson: { plannedIndicatorGroups: ["banking_system", "financial_statistics"], noFakeLiveValues: true }
  });
  return { indicators: [], signals: [signal] };
}
