import { createIntelligenceAgentAdapter } from "./agent-adapter.mjs";

function print(label, result) {
  process.stdout.write(`${label}: ${JSON.stringify(result, null, 2)}\n`);
}

const adapter = createIntelligenceAgentAdapter();

const status = await adapter.invoke("get_radar_status", {});
print("radar_status", status);
if (!status.ok) process.exitCode = 1;

const search = await adapter.invoke("search_intelligence", {
  query: process.env.BCC_INTELLIGENCE_SMOKE_QUERY || "SEM image analysis",
  limit: 3,
});
print("search", search);
if (!search.ok) process.exitCode = 1;
