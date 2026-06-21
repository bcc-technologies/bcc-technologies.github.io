# Intelligence Connectors

Stage 3 adds a modular sync layer for BCC's `Intelligence` workspace.

## Implemented connectors

- `arXiv`
- `OpenAlex`
- `Crossref`

Prepared but not implemented yet:

- `Semantic Scholar`
- `PubMed`
- `NIH RePORTER`
- `NSF Awards`
- `USPTO`

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
OPENALEX_EMAIL=
SEMANTIC_SCHOLAR_API_KEY=
NCBI_API_KEY=
NIH_REPORTER_API_KEY=
```

No secrets are stored in code.

## Usage

Dry run with explicit keywords:

```bash
npm run intelligence:sync -- --dry-run --source arxiv,openalex,crossref --keyword nanomedicine --keyword biosensors --limit 10
```

Persist results to Supabase:

```bash
SUPABASE_URL=... \
SUPABASE_SERVICE_ROLE_KEY=... \
OPENALEX_EMAIL=you@example.com \
npm run intelligence:sync -- --source arxiv,openalex,crossref --query "nanomaterials drug delivery" --limit 15
```

If you omit `--query` and `--keyword`, the script will read keywords from enabled rows in `public.intelligence_topics`.

## Deduplication strategy

The sync layer deduplicates in two places:

1. In-memory merge by DOI, arXiv ID, source/external ID, or normalized title.
2. Database lookup before insert using DOI, arXiv ID, source/external ID, and title fingerprint fallback.

## Scope in this phase

This phase saves normalized papers into `public.intelligence_papers`, ensures `public.intelligence_sources` exists for each connector, and logs run metadata into `public.intelligence_runs`.
