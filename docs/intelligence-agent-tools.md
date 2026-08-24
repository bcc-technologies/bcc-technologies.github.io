# BCC Intelligence Agent Tools v0.5

The agent layer is deliberately separated from Supabase and from the human `/api/admin/intelligence/*` surface.

```text
Agent / MCP / ChatGPT / Codex
        ↓ tool calls
scripts/intelligence/agent-adapter.mjs
        ↓ authenticated HTTPS POST
bcc-intelligence-api (Supabase Edge Function, API 0.4)
        ↓ service-role internal reads
BCC Intelligence canonical tables
```

## Security boundary

- Agents receive a scoped `bcc_agent_*` credential, never a Supabase key or user JWT.
- The adapter sends the credential only in the HTTPS `Authorization` header.
- It refuses non-HTTPS endpoints except localhost development.
- Redirects are disabled so the bearer cannot be forwarded to another origin.
- The adapter never includes the token in returned data or normalized errors.
- Requests remain bounded by the API 0.4 rate limiter; remaining minute/day quota is surfaced only as metadata.
- Responses are capped at 1 MiB and have an end-to-end timeout.
- The adapter fails closed if the upstream response is malformed or is not API version `0.4`.
- All public tools are read-only and have `additionalProperties: false` schemas.

## Environment

Required:

```text
BCC_INTELLIGENCE_AGENT_TOKEN=bcc_agent_...
```

Optional:

```text
BCC_INTELLIGENCE_API_URL=https://bglkyqiqzrcwegpjrucc.supabase.co/functions/v1/bcc-intelligence-api
BCC_INTELLIGENCE_SMOKE_QUERY=SEM image analysis
```

Do not commit the plaintext token.

## Tool surface

### `search_intelligence`

Searches ranked signals, papers, and grants.

Inputs: `query` (required), `types`, `line`, `source`, `since`, `until`, `includeArchived`, `limit`, `offset`.

Maps only to API operation `search`.

### `list_intelligence_signals`

Lists current Radar signals with optional line/status/type/opportunity filters.

Maps only to API operation `signals`.

### `get_intelligence_signal`

Gets one signal by UUID, including bounded evidence references and score breakdown.

Maps only to API operation `signal`.

### `get_signal_evidence`

Resolves typed evidence for one signal.

Maps only to API operation `signal_evidence`.

### `get_radar_status`

Returns corpus counts and API version.

Maps only to API operation `overview`.

### `get_recent_intelligence_runs`

Returns recent ingestion/sync runs and normalized source names.

Maps only to API operation `runs`.

There is intentionally no generic SQL, table selector, mutation tool, sync trigger, or arbitrary API operation.

## Adapter API

```js
import { createIntelligenceAgentAdapter } from "./scripts/intelligence/agent-adapter.mjs";

const intelligence = createIntelligenceAgentAdapter();
const result = await intelligence.call("search_intelligence", {
  query: "SEM image segmentation",
  types: ["signal", "paper"],
  line: "MAP-Nano",
  limit: 10,
});
```

`call()` throws `IntelligenceAgentError` for callers that want exception semantics.

`invoke()` never throws normal adapter errors and instead returns either:

```json
{ "ok": true, "tool": "...", "data": {}, "meta": {} }
```

or:

```json
{
  "ok": false,
  "tool": "...",
  "error": {
    "code": "RATE_LIMITED",
    "message": "Rate limit exceeded.",
    "status": 429,
    "retryAfterSeconds": 30,
    "rateLimit": { "minuteRemaining": 0, "dayRemaining": 4900 }
  }
}
```

Stable normalized error codes currently include `INVALID_ARGUMENT`, `UNKNOWN_TOOL`, `CONFIGURATION_ERROR`, `AUTHENTICATION_ERROR`, `RATE_LIMITED`, `NOT_FOUND`, `BAD_REQUEST`, `TIMEOUT`, `NETWORK_ERROR`, `UPSTREAM_UNAVAILABLE`, `UPSTREAM_ERROR`, `PROTOCOL_ERROR`, and `VERSION_MISMATCH`.

## Smoke test

With the token supplied only in the shell environment:

```bash
npm run intelligence:agent:smoke
```

The smoke runner calls `get_radar_status` and a three-result search. It prints returned Radar data and normalized metadata, never the bearer token.

## MCP integration

An MCP server should register `intelligenceToolDefinitions` unchanged and delegate tool execution to `adapter.call(name, args)` or `adapter.invoke(name, args)`.

The MCP layer must not add a generic passthrough operation. The adapter is the policy boundary for the agent-facing tool vocabulary.
