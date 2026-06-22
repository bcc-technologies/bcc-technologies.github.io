# Intelligence Connectors

Stage 3 adds a modular sync layer for BCC's `Intelligence` workspace.

## Implemented connectors

- `arXiv`
- `OpenAlex`
- `Crossref`
- `Semantic Scholar`
- `PubMed`

Prepared but not fully activatable yet:

- `EPO OPS`
- `USPTO`

Implemented grants connectors:

- `NIH RePORTER`
- `NSF Awards`

Implemented patent pipeline:

- `EPO OPS` connector and `fetch_patents` flow are in code, but the source stays disabled until `EPO_OPS_KEY` and `EPO_OPS_SECRET` are configured.
- `USPTO` stays visible but intentionally inactive because the current official credential path is not available for this workspace.

## Files

- `scripts/intelligence/connectors/`
- `scripts/intelligence/store.mjs`
- `scripts/intelligence/dedupe.mjs`
- `scripts/sync-intelligence.mjs`

## Environment variables

Required for saving to Supabase:

```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

Optional connector configuration:

```bash
OPENALEX_API_KEY=
OPENALEX_EMAIL=
SEMANTIC_SCHOLAR_API_KEY=
NCBI_API_KEY=
NIH_REPORTER_API_KEY=
EPO_OPS_KEY=
EPO_OPS_SECRET=
```

No secrets are stored in code.

`OpenAlex` now expects an API key for normal usage. Treat `OPENALEX_API_KEY` as required for real sync runs. `OPENALEX_EMAIL` remains optional as a contact identifier.

`Semantic Scholar` can run without `SEMANTIC_SCHOLAR_API_KEY`, but the key is recommended for steadier rate limits and less friction during broader manual sync runs.

`PubMed` can run without `NCBI_API_KEY`, but the key is recommended for smoother sync volume because NCBI rate limits are tighter without it.

`NIH RePORTER` currently uses the public v2 Project Search API and does not require an API key in the implemented flow.

`NSF Awards` currently uses the public NSF Award Search API and does not require an API key in the implemented flow.

`EPO OPS` requires `EPO_OPS_KEY` and `EPO_OPS_SECRET` plus OAuth token exchange. The connector is ready in code but should remain disabled until those credentials exist.

## Usage

Dry run with explicit keywords:

```bash
npm run intelligence:sync -- --dry-run --source arxiv,openalex,crossref --keyword nanomedicine --keyword biosensors --limit 10
```

Persist results to Supabase:

```bash
SUPABASE_URL=... \
SUPABASE_SERVICE_ROLE_KEY=... \
OPENALEX_API_KEY=... \
OPENALEX_EMAIL=you@example.com \
NCBI_API_KEY=... \
npm run intelligence:sync -- --source arxiv,openalex,crossref,pubmed,semantic_scholar --query "nanomaterials drug delivery" --limit 15
```

If you omit `--query` and `--keyword`, the script will read keywords from enabled rows in `public.intelligence_topics`.

## OpenAlex quota design notes

To stay inside the free OpenAlex allowance:

1. Keep the normal per-source limit low, usually `20` to `50`.
2. Avoid repeated broad full-text sync runs in the same day.
3. Use `dry-run` for exploratory testing.
4. Prefer topic-specific queries over generic searches.
5. The connector already uses a conservative interval and `select` fields to reduce unnecessary payload size.

## Semantic Scholar and PubMed notes

1. `Semantic Scholar` uses the Graph API search endpoint and stores normalized paper payloads only.
2. `PubMed` uses a two-step `esearch` plus `efetch` flow so abstracts, authors, affiliations, DOI, PMID and PMC links can be normalized into the paper model.
3. `NIH RePORTER` uses the official v2 `projects/search` endpoint and normalizes awards into `intelligence_grants`.
4. `NSF Awards` uses the official NSF Award Search API and normalizes awards into `intelligence_grants`.
5. `EPO OPS` is the current patent-source target in code and normalizes published-data search results into `intelligence_patents`.
6. On the next real sync, the runner will auto-register known connectors into `intelligence_sources`. Sources like `USPTO` can therefore stay visible but paused with a reason.

## Deduplication strategy

The sync layer deduplicates in two places:

1. In-memory merge by DOI, arXiv ID, source/external ID, or normalized title.
2. Database lookup before insert using DOI, arXiv ID, source/external ID, and title fingerprint fallback.

## Scope in this phase

This phase saves normalized papers into `public.intelligence_papers`, ensures `public.intelligence_sources` exists for each connector, and logs run metadata into `public.intelligence_runs`.
