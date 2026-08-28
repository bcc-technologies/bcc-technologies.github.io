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
;
