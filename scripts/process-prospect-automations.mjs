import { createSupabaseRestClient } from "./lib/supabase-rest.mjs";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabaseRest = createSupabaseRestClient({
  baseUrl: SUPABASE_URL,
  serviceKey: SUPABASE_SERVICE_ROLE_KEY
});

function assertEnv() {
  const missing = [
    ["SUPABASE_URL", SUPABASE_URL],
    ["SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY]
  ].filter(([, value]) => !value).map(([name]) => name);
  if (missing.length) throw new Error(`Missing required env vars: ${missing.join(", ")}`);
}

async function queueProspectAutomations() {
  const result = await supabaseRest.fetch("rpc/queue_prospect_automation_notifications", {
    method: "POST",
    body: {}
  });
  return Number(result) || 0;
}

async function dispatchPendingPush() {
  const response = await fetch(new URL("/functions/v1/send-workspace-push", SUPABASE_URL), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ batchSize: 100 })
  });
  if (!response.ok) {
    throw new Error(`send-workspace-push returned ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

async function main() {
  assertEnv();

  // This is the actual automation: scanning prospects and queueing the right
  // notification for the right person. A failure here is a real bug.
  const queuedCount = await queueProspectAutomations();
  console.log(`Queued ${queuedCount} prospect automation notification(s).`);

  // Push delivery depends on VAPID secrets being configured in Supabase
  // separately (see resources/SUPABASE_WORKSPACE_WEB_PUSH.sql). Until that's
  // done, send-workspace-push always returns 500 -- that's expected, not a
  // bug in this job, so it must not fail the whole run or spam GitHub Action
  // failure emails every 30 minutes. Automation notifications still queue
  // correctly and will simply be delivered once push is configured.
  try {
    const dispatchResult = await dispatchPendingPush();
    console.log(`Push dispatch: claimed ${dispatchResult.claimed ?? 0}, sent ${dispatchResult.sent ?? 0}, failed ${dispatchResult.failed ?? 0}.`);
  } catch (error) {
    console.warn(`[warn] Push dispatch skipped: ${error.message}`);
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
