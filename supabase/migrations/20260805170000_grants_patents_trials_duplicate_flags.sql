-- Extends the fuzzy-duplicate-flag-for-review pattern already used by
-- intelligence_papers to grants, patents and trials. Those three tables
-- previously had no duplicate-detection columns at all; store.mjs instead
-- fell back to an exact-title match that could silently PATCH-merge two
-- unrelated records sharing a title. This migration only adds the columns;
-- scripts/intelligence/store.mjs carries the matching logic change.
alter table public.intelligence_grants
  add column if not exists possible_duplicate boolean not null default false,
  add column if not exists duplicate_candidates jsonb not null default '[]'::jsonb;

alter table public.intelligence_grants
  add constraint intelligence_grants_duplicate_candidates_check
  check (jsonb_typeof(duplicate_candidates) = 'array');

alter table public.intelligence_patents
  add column if not exists possible_duplicate boolean not null default false,
  add column if not exists duplicate_candidates jsonb not null default '[]'::jsonb;

alter table public.intelligence_patents
  add constraint intelligence_patents_duplicate_candidates_check
  check (jsonb_typeof(duplicate_candidates) = 'array');

alter table public.intelligence_trials
  add column if not exists possible_duplicate boolean not null default false,
  add column if not exists duplicate_candidates jsonb not null default '[]'::jsonb;

alter table public.intelligence_trials
  add constraint intelligence_trials_duplicate_candidates_check
  check (jsonb_typeof(duplicate_candidates) = 'array');
