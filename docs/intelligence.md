# Intelligence Module

## What it is

`Intelligence` is an internal Scientific & Technology Intelligence module inside the admin dashboard.

Its job is to help BCC monitor:

- scientific papers and preprints
- grants and funded projects
- patents
- institutions
- monitored topics
- derived strategic signals

It acts as a technical radar for BCC product lines such as `MAP-Nano`, `MAP-Bio`, `MAP-Med`, and `MAP-Ing`.

## What problem it solves

Before this module, relevant signals were scattered across public sources and had to be reviewed manually.

`Intelligence` centralizes that work so BCC can:

- detect product opportunities earlier
- identify scientific and technical trends
- find potential partners and active institutions
- spot content ideas backed by evidence
- monitor grant and collaboration windows
- watch early competitive pressure in adjacent technical areas

## Main architecture

The current implementation has four layers:

1. `Supabase`
   Stores sources, topics, papers, grants, patents, institutions, signals, runs, and settings.

2. `Connectors`
   Fetch external data and normalize it into the internal model.

3. `Sync + scoring pipeline`
   Runs connector searches, deduplicates papers, stores normalized items, and generates strategic signals.

4. `Admin dashboard`
   Lets admins review the overview, inspect signals, manage topics and sources, and trigger sync manually.

Relevant files:

- `js/workspace-intelligence.js`
- `js/auth.js`
- `scripts/sync-intelligence.mjs`
- `scripts/intelligence/connectors/`
- `scripts/intelligence/dedupe.mjs`
- `scripts/intelligence/signals.mjs`
- `scripts/intelligence/store.mjs`
- `resources/SUPABASE_WORKSPACE_INTELLIGENCE.sql`

## Data sources

Implemented now:

- `arXiv`
- `OpenAlex`
- `Crossref`
- `Semantic Scholar`
- `PubMed / NCBI`
- `NIH RePORTER`
- `NSF Awards`

Prepared but not fully implemented yet:

- `NIH RePORTER`
- `NSF Awards`
- `USPTO`

The active sources visible in the dashboard are stored in `public.intelligence_sources`.

## Configuration and secrets

### Supabase and GitHub secrets already used by the sync flow

Supabase Edge Function secrets:

```bash
GITHUB_WORKFLOW_TOKEN=
GITHUB_REPO_OWNER=
GITHUB_REPO_NAME=
GITHUB_INTELLIGENCE_WORKFLOW_FILE=
GITHUB_INTELLIGENCE_WORKFLOW_REF=
```

GitHub Actions secrets:

```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
OPENALEX_API_KEY=
OPENALEX_EMAIL=
SEMANTIC_SCHOLAR_API_KEY=
NCBI_API_KEY=
NIH_REPORTER_API_KEY=
```

### Notes

- `SUPABASE_SERVICE_ROLE_KEY` is backend-only. Never expose it to the frontend.
- `OPENALEX_API_KEY` should be treated as required for real OpenAlex sync usage.
- `OPENALEX_EMAIL` is optional and useful as a contact identifier.
- `SEMANTIC_SCHOLAR_API_KEY` is optional but recommended for steadier rate limits.
- `NCBI_API_KEY` is optional but recommended for smoother PubMed sync volume.
- `NIH_REPORTER_API_KEY` is not needed for the currently implemented NIH RePORTER connector.
- Secrets are not stored in the `Intelligence` tables.

More operational detail:

- `resources/SUPABASE_INTELLIGENCE_SYNC.md`
- `resources/INTELLIGENCE_CONNECTORS.md`

## Manual sync

There are two supported ways to run the radar manually.

### From the dashboard

Go to:

- `admin-dashboard.html#intelligence`

Then use:

- `Run Intelligence Sync`
- `Fetch latest papers`
- `Generate signals`

`Fetch grants` and `Fetch patents` exist in the UI but are still placeholders in the current version.

### From the CLI

Dry-run example:

```bash
node scripts/sync-intelligence.mjs --dry-run --source arxiv,openalex,crossref --keyword "SEM image analysis" --limit 10
```

Persisted run example:

```bash
SUPABASE_URL=... \
SUPABASE_SERVICE_ROLE_KEY=... \
OPENALEX_API_KEY=... \
OPENALEX_EMAIL=you@example.com \
node scripts/sync-intelligence.mjs --source arxiv,openalex,crossref --query "scientific image analysis" --limit 15
```

If no explicit `--query` or `--keyword` is provided, the script falls back to the enabled topic keywords stored in Supabase.

### OpenAlex free quota design

OpenAlex now uses an API key plus a free daily quota. The current BCC sync should stay conservative:

- keep routine per-source limits around `20` to `50`
- use `dry-run` first for broad exploratory queries
- avoid repeated full-text syncs with very generic keywords
- prefer specific topic keywords over vague searches
- keep the scheduled run low-frequency unless there is a clear need to increase it

## Adding a new connector

Follow the existing modular pattern. Do not hardcode the new source into a single shared fetch function.

### Current connector contract

```js
{
  sourceName,
  sourceType,
  search(query),
  fetchById?(id)
}
```

### Steps

1. Create a dedicated module under `scripts/intelligence/connectors/`.
2. Normalize all outbound items with the base helpers in `scripts/intelligence/connectors/base.mjs`.
3. Respect timeouts, retries, and rate limits through `scripts/intelligence/http.mjs`.
4. Return normalized paper-like records with `rawData`.
5. Register the connector in `scripts/intelligence/connectors/index.mjs`.
6. If the source needs credentials, use environment variables only.
7. Add tests for normalization and the expected connector behavior.

## Scoring model

Signals are currently heuristic, not LLM-based.

Implemented in:

- `scripts/intelligence/signals.mjs`

### Opportunity Score

```text
0.25 * topicGrowth
+ 0.20 * proximityToBCC
+ 0.15 * fundingPresence
+ 0.15 * technicalPainDetected
+ 0.10 * activeInstitutions
+ 0.10 * competitiveWhiteSpace
+ 0.05 * openDataAvailability
```

### Actionability Score

Current implementation estimates it from:

- `dataAvailability`
- `clarityOfUseCase`
- `easeOfContact`
- `compatibilityWithCurrentProduct`
- `contentPotential`

### Heuristic inputs used today

- `proximityToBCC`
  Keyword matching against the MAP lines and the topic evidence.

- `technicalPainDetected`
  Looks for terms such as:
  `manual`, `limitation`, `bottleneck`, `time-consuming`, `segmentation challenge`, `annotation`, `thresholding`, `low accuracy`, `noisy images`

- `fundingPresence`
  Increased by related grants.

- `activeInstitutions`
  Based on the number of distinct institutions detected in matching papers and grants.

- `contentPotential`
  Increased when the topic has clear evidence, abstracts, and usable source links.

- `openDataAvailability`
  Increased when open access or dataset-like evidence is present.

### Evidence rule

Signals are not emitted without evidence.

Each signal must include `evidenceRefs`, for example:

```json
[
  {
    "type": "paper",
    "id": "paper-id",
    "title": "Example title",
    "sourceUrl": "https://example.org"
  }
]
```

## Deduplication and normalization

The sync pipeline tries to reduce garbage conservatively.

### Exact merge keys

Papers are treated as the same item when one of these matches:

- DOI
- arXiv ID
- `sourceType + externalId`

### Ambiguous duplicates

If the normalized title is very similar but not matched by the exact keys, the paper is marked as a possible duplicate instead of being auto-merged.

This keeps the system conservative and avoids silently discarding uncertain records.

### Normalized fields

The current pipeline normalizes:

- titles
- authors
- institutions
- dates
- source URLs
- topics
- keywords

`rawData` is preserved for traceability.

## Security model

- Only admins can access the `Intelligence` admin routes.
- API keys and backend secrets are not exposed to the frontend.
- The manual sync Edge Function is admin-only.
- Manual sync has basic rate limiting and active-run protection.
- External fetches use timeout and moderate retries.
- Error logs attempt to redact sensitive tokens before persisting or printing.
- External links rendered in the UI are sanitized and restricted to safe protocols.

## Testing

The project uses `node:test` for Intelligence coverage.

Run:

```bash
node --test tests/intelligence-*.test.mjs
```

Or, when `npm` is available in the environment:

```bash
npm run test:intelligence
```

Current coverage includes:

- paper normalization
- deduplication by DOI
- deduplication by arXiv ID
- signal generation with and without evidence
- dry-run behavior
- admin API protection
- topics CRUD
- source enable/disable
- empty overview UI rendering

Reference:

- `resources/INTELLIGENCE_TESTING.md`

## Current limitations

- `Fetch grants` and `Fetch patents` are still not implemented end-to-end.
- The current sync is strongest on papers; grants and patents still need fuller source ingestion.
- Signal scoring is heuristic and intentionally simple.
- Duplicate review exists as metadata, but not yet as a full analyst workflow.
- Institution enrichment is still lightweight.
- There is no advanced explainability view beyond the evidence references and score outputs.
- Some dashboard reads are still optimized for small-to-medium datasets, not very large intelligence corpora.

## Pending work

Natural next steps after this stage:

- implement real grants connectors
- implement real patents connectors
- add duplicate review workflow in the dashboard
- improve institution/entity resolution
- improve signal review lifecycle and analyst notes
- add better filtering, saved views, and exports
- evolve scoring with richer heuristics or model-assisted ranking when justified
