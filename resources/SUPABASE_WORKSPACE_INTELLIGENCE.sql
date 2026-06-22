-- BCC Workspace intelligence schema for the admin dashboard.
-- Run after SUPABASE_AUTH_SETUP.sql in the Supabase SQL Editor.

create table if not exists public.intelligence_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null,
  base_url text not null default '',
  enabled boolean not null default true,
  requires_api_key boolean not null default false,
  rate_limit_notes text not null default '',
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint intelligence_sources_name_check check (char_length(btrim(name)) between 1 and 120),
  constraint intelligence_sources_type_check check (type in ('arxiv', 'openalex', 'crossref', 'semantic_scholar', 'pubmed', 'nih_reporter', 'nsf', 'clinicaltrials', 'epo_ops', 'cordis', 'uspto', 'custom')),
  constraint intelligence_sources_base_url_check check (char_length(base_url) <= 500),
  constraint intelligence_sources_rate_limit_notes_check check (char_length(rate_limit_notes) <= 2000)
);

create unique index if not exists intelligence_sources_name_type_uidx
on public.intelligence_sources (lower(name), type);

alter table public.intelligence_sources
  drop constraint if exists intelligence_sources_type_check;

alter table public.intelligence_sources
  add constraint intelligence_sources_type_check
  check (type in ('arxiv', 'openalex', 'crossref', 'semantic_scholar', 'pubmed', 'nih_reporter', 'nsf', 'clinicaltrials', 'epo_ops', 'cordis', 'uspto', 'custom'));

create table if not exists public.intelligence_topics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  category text not null default 'general',
  keywords text[] not null default '{}'::text[],
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint intelligence_topics_name_check check (char_length(btrim(name)) between 1 and 160),
  constraint intelligence_topics_description_check check (char_length(description) <= 2000),
  constraint intelligence_topics_category_check check (category in ('nano', 'bio', 'med', 'ing', 'general')),
  constraint intelligence_topics_keywords_check check (coalesce(array_length(keywords, 1), 0) <= 64)
);

create unique index if not exists intelligence_topics_name_uidx
on public.intelligence_topics (lower(name));

create table if not exists public.intelligence_institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  ror_id text not null default '',
  country text not null default '',
  city text not null default '',
  type text not null default 'research_center',
  website text not null default '',
  source_url text not null default '',
  related_papers_count integer not null default 0,
  related_grants_count integer not null default 0,
  related_patents_count integer not null default 0,
  topics text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint intelligence_institutions_name_check check (char_length(btrim(name)) between 1 and 200),
  constraint intelligence_institutions_ror_id_check check (char_length(ror_id) <= 64),
  constraint intelligence_institutions_country_check check (char_length(country) <= 120),
  constraint intelligence_institutions_city_check check (char_length(city) <= 120),
  constraint intelligence_institutions_type_check check (type in ('university', 'laboratory', 'hospital', 'research_center', 'company', 'government', 'nonprofit', 'other')),
  constraint intelligence_institutions_website_check check (char_length(website) <= 500),
  constraint intelligence_institutions_source_url_check check (char_length(source_url) <= 500),
  constraint intelligence_institutions_papers_count_check check (related_papers_count >= 0),
  constraint intelligence_institutions_grants_count_check check (related_grants_count >= 0),
  constraint intelligence_institutions_patents_count_check check (related_patents_count >= 0),
  constraint intelligence_institutions_topics_check check (coalesce(array_length(topics, 1), 0) <= 64)
);

create unique index if not exists intelligence_institutions_ror_uidx
on public.intelligence_institutions (lower(ror_id))
where btrim(ror_id) <> '';

create table if not exists public.intelligence_papers (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.intelligence_sources(id) on delete set null,
  external_id text not null default '',
  doi text not null default '',
  arxiv_id text not null default '',
  normalized_title text not null default '',
  title text not null,
  abstract text not null default '',
  authors text[] not null default '{}'::text[],
  institutions text[] not null default '{}'::text[],
  publication_date date,
  source_name text not null default '',
  source_url text not null default '',
  journal_or_venue text not null default '',
  topics text[] not null default '{}'::text[],
  keywords text[] not null default '{}'::text[],
  citations_count integer not null default 0,
  open_access_url text not null default '',
  possible_duplicate boolean not null default false,
  duplicate_candidates jsonb not null default '[]'::jsonb,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint intelligence_papers_external_id_check check (char_length(external_id) <= 200),
  constraint intelligence_papers_doi_check check (char_length(doi) <= 200),
  constraint intelligence_papers_arxiv_id_check check (char_length(arxiv_id) <= 80),
  constraint intelligence_papers_normalized_title_check check (char_length(normalized_title) <= 600),
  constraint intelligence_papers_title_check check (char_length(btrim(title)) between 1 and 600),
  constraint intelligence_papers_abstract_check check (char_length(abstract) <= 40000),
  constraint intelligence_papers_source_name_check check (char_length(source_name) <= 120),
  constraint intelligence_papers_source_url_check check (char_length(source_url) <= 500),
  constraint intelligence_papers_journal_check check (char_length(journal_or_venue) <= 240),
  constraint intelligence_papers_citations_count_check check (citations_count >= 0),
  constraint intelligence_papers_open_access_url_check check (char_length(open_access_url) <= 500),
  constraint intelligence_papers_authors_check check (coalesce(array_length(authors, 1), 0) <= 128),
  constraint intelligence_papers_institutions_check check (coalesce(array_length(institutions, 1), 0) <= 128),
  constraint intelligence_papers_topics_check check (coalesce(array_length(topics, 1), 0) <= 64),
  constraint intelligence_papers_keywords_check check (coalesce(array_length(keywords, 1), 0) <= 128),
  constraint intelligence_papers_duplicate_candidates_check check (jsonb_typeof(duplicate_candidates) = 'array'),
  constraint intelligence_papers_raw_data_check check (jsonb_typeof(raw_data) = 'object')
);

alter table public.intelligence_papers
  add column if not exists normalized_title text not null default '';

alter table public.intelligence_papers
  add column if not exists possible_duplicate boolean not null default false;

alter table public.intelligence_papers
  add column if not exists duplicate_candidates jsonb not null default '[]'::jsonb;

create unique index if not exists intelligence_papers_source_external_uidx
on public.intelligence_papers (source_id, external_id)
where source_id is not null and btrim(external_id) <> '';

create unique index if not exists intelligence_papers_doi_uidx
on public.intelligence_papers (lower(doi))
where btrim(doi) <> '';

create unique index if not exists intelligence_papers_arxiv_uidx
on public.intelligence_papers (lower(arxiv_id))
where btrim(arxiv_id) <> '';

create table if not exists public.intelligence_grants (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.intelligence_sources(id) on delete set null,
  external_id text not null default '',
  title text not null,
  abstract text not null default '',
  agency text not null default '',
  program text not null default '',
  amount numeric(18, 2),
  currency text not null default '',
  start_date date,
  end_date date,
  principal_investigators text[] not null default '{}'::text[],
  institutions text[] not null default '{}'::text[],
  country text not null default '',
  source_url text not null default '',
  topics text[] not null default '{}'::text[],
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint intelligence_grants_external_id_check check (char_length(external_id) <= 200),
  constraint intelligence_grants_title_check check (char_length(btrim(title)) between 1 and 600),
  constraint intelligence_grants_abstract_check check (char_length(abstract) <= 40000),
  constraint intelligence_grants_agency_check check (char_length(agency) <= 180),
  constraint intelligence_grants_program_check check (char_length(program) <= 220),
  constraint intelligence_grants_amount_check check (amount is null or amount >= 0),
  constraint intelligence_grants_currency_check check (char_length(currency) <= 8),
  constraint intelligence_grants_country_check check (char_length(country) <= 120),
  constraint intelligence_grants_source_url_check check (char_length(source_url) <= 500),
  constraint intelligence_grants_pi_check check (coalesce(array_length(principal_investigators, 1), 0) <= 128),
  constraint intelligence_grants_institutions_check check (coalesce(array_length(institutions, 1), 0) <= 128),
  constraint intelligence_grants_topics_check check (coalesce(array_length(topics, 1), 0) <= 64),
  constraint intelligence_grants_raw_data_check check (jsonb_typeof(raw_data) = 'object')
);

create unique index if not exists intelligence_grants_source_external_uidx
on public.intelligence_grants (source_id, external_id)
where source_id is not null and btrim(external_id) <> '';

create table if not exists public.intelligence_patents (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.intelligence_sources(id) on delete set null,
  external_id text not null default '',
  title text not null,
  abstract text not null default '',
  inventors text[] not null default '{}'::text[],
  assignees text[] not null default '{}'::text[],
  publication_date date,
  filing_date date,
  jurisdiction text not null default '',
  status text not null default 'published',
  source_url text not null default '',
  topics text[] not null default '{}'::text[],
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint intelligence_patents_external_id_check check (char_length(external_id) <= 200),
  constraint intelligence_patents_title_check check (char_length(btrim(title)) between 1 and 600),
  constraint intelligence_patents_abstract_check check (char_length(abstract) <= 40000),
  constraint intelligence_patents_jurisdiction_check check (char_length(jurisdiction) <= 40),
  constraint intelligence_patents_status_check check (status in ('filed', 'published', 'granted', 'expired', 'unknown')),
  constraint intelligence_patents_source_url_check check (char_length(source_url) <= 500),
  constraint intelligence_patents_inventors_check check (coalesce(array_length(inventors, 1), 0) <= 128),
  constraint intelligence_patents_assignees_check check (coalesce(array_length(assignees, 1), 0) <= 128),
  constraint intelligence_patents_topics_check check (coalesce(array_length(topics, 1), 0) <= 64),
  constraint intelligence_patents_raw_data_check check (jsonb_typeof(raw_data) = 'object')
);

create unique index if not exists intelligence_patents_source_external_uidx
on public.intelligence_patents (source_id, external_id)
where source_id is not null and btrim(external_id) <> '';

create table if not exists public.intelligence_trials (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.intelligence_sources(id) on delete set null,
  external_id text not null default '',
  title text not null,
  summary text not null default '',
  conditions text[] not null default '{}'::text[],
  interventions text[] not null default '{}'::text[],
  phase text not null default '',
  status text not null default '',
  study_type text not null default '',
  sponsor text not null default '',
  collaborators text[] not null default '{}'::text[],
  start_date date,
  completion_date date,
  locations text[] not null default '{}'::text[],
  countries text[] not null default '{}'::text[],
  source_url text not null default '',
  topics text[] not null default '{}'::text[],
  keywords text[] not null default '{}'::text[],
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint intelligence_trials_external_id_check check (char_length(external_id) <= 200),
  constraint intelligence_trials_title_check check (char_length(btrim(title)) between 1 and 600),
  constraint intelligence_trials_summary_check check (char_length(summary) <= 40000),
  constraint intelligence_trials_phase_check check (char_length(phase) <= 120),
  constraint intelligence_trials_status_check check (char_length(status) <= 120),
  constraint intelligence_trials_study_type_check check (char_length(study_type) <= 120),
  constraint intelligence_trials_sponsor_check check (char_length(sponsor) <= 200),
  constraint intelligence_trials_source_url_check check (char_length(source_url) <= 500),
  constraint intelligence_trials_conditions_check check (coalesce(array_length(conditions, 1), 0) <= 64),
  constraint intelligence_trials_interventions_check check (coalesce(array_length(interventions, 1), 0) <= 128),
  constraint intelligence_trials_collaborators_check check (coalesce(array_length(collaborators, 1), 0) <= 128),
  constraint intelligence_trials_locations_check check (coalesce(array_length(locations, 1), 0) <= 128),
  constraint intelligence_trials_countries_check check (coalesce(array_length(countries, 1), 0) <= 64),
  constraint intelligence_trials_topics_check check (coalesce(array_length(topics, 1), 0) <= 64),
  constraint intelligence_trials_keywords_check check (coalesce(array_length(keywords, 1), 0) <= 128),
  constraint intelligence_trials_raw_data_check check (jsonb_typeof(raw_data) = 'object')
);

create unique index if not exists intelligence_trials_source_external_uidx
on public.intelligence_trials (source_id, external_id)
where source_id is not null and btrim(external_id) <> '';

create table if not exists public.intelligence_signals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text not null default '',
  signal_type text not null,
  related_line text not null default 'General',
  confidence_score numeric(5, 2) not null default 0,
  opportunity_score numeric(5, 2) not null default 0,
  actionability_score numeric(5, 2) not null default 0,
  evidence_count integer not null default 0,
  evidence_refs jsonb not null default '[]'::jsonb,
  score_breakdown jsonb not null default '{}'::jsonb,
  recommended_action text not null default '',
  status text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint intelligence_signals_title_check check (char_length(btrim(title)) between 1 and 240),
  constraint intelligence_signals_summary_check check (char_length(summary) <= 6000),
  constraint intelligence_signals_type_check check (signal_type in ('product_opportunity', 'market_trend', 'research_trend', 'partnership', 'content_idea', 'competitive_risk', 'grant_opportunity')),
  constraint intelligence_signals_related_line_check check (related_line in ('MAP-Nano', 'MAP-Bio', 'MAP-Med', 'MAP-Ing', 'MAPs', 'General')),
  constraint intelligence_signals_confidence_score_check check (confidence_score between 0 and 100),
  constraint intelligence_signals_opportunity_score_check check (opportunity_score between 0 and 100),
  constraint intelligence_signals_actionability_score_check check (actionability_score between 0 and 100),
  constraint intelligence_signals_evidence_count_check check (evidence_count >= 0),
  constraint intelligence_signals_evidence_refs_check check (jsonb_typeof(evidence_refs) = 'array'),
  constraint intelligence_signals_score_breakdown_check check (jsonb_typeof(score_breakdown) = 'object'),
  constraint intelligence_signals_recommended_action_check check (char_length(recommended_action) <= 6000),
  constraint intelligence_signals_status_check check (status in ('new', 'reviewing', 'accepted', 'rejected', 'archived'))
);

alter table public.intelligence_signals
  add column if not exists score_breakdown jsonb not null default '{}'::jsonb;

create table if not exists public.intelligence_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pending',
  action_type text not null default 'sync_papers',
  dry_run boolean not null default false,
  started_at timestamptz,
  finished_at timestamptz,
  sources_used uuid[] not null default '{}'::uuid[],
  items_fetched integer not null default 0,
  items_created integer not null default 0,
  items_updated integer not null default 0,
  signals_generated integer not null default 0,
  error_message text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint intelligence_runs_status_check check (status in ('pending', 'running', 'completed', 'failed')),
  constraint intelligence_runs_action_type_check check (action_type in ('sync_papers', 'fetch_papers', 'fetch_grants', 'fetch_patents', 'fetch_trials', 'generate_signals')),
  constraint intelligence_runs_sources_used_check check (coalesce(array_length(sources_used, 1), 0) <= 128),
  constraint intelligence_runs_items_fetched_check check (items_fetched >= 0),
  constraint intelligence_runs_items_created_check check (items_created >= 0),
  constraint intelligence_runs_items_updated_check check (items_updated >= 0),
  constraint intelligence_runs_signals_generated_check check (signals_generated >= 0),
  constraint intelligence_runs_error_message_check check (char_length(error_message) <= 6000)
);

alter table public.intelligence_runs
  add column if not exists action_type text not null default 'sync_papers';

alter table public.intelligence_runs
  add column if not exists dry_run boolean not null default false;

alter table public.intelligence_runs
  drop constraint if exists intelligence_runs_action_type_check;

alter table public.intelligence_runs
  add constraint intelligence_runs_action_type_check
  check (action_type in ('sync_papers', 'fetch_papers', 'fetch_grants', 'fetch_patents', 'fetch_trials', 'generate_signals'));

create table if not exists public.intelligence_settings (
  id uuid primary key default gen_random_uuid(),
  max_results_per_source integer not null default 20,
  default_date_range_days integer not null default 90,
  suggested_frequency text not null default 'daily',
  default_dry_run boolean not null default false,
  scoring_thresholds jsonb not null default '{"opportunity": 60, "actionability": 50, "confidence": 50}'::jsonb,
  monitored_lines text[] not null default array['MAP-Nano', 'MAP-Bio', 'MAP-Med', 'MAP-Ing', 'MAPs', 'General']::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint intelligence_settings_max_results_check check (max_results_per_source between 1 and 200),
  constraint intelligence_settings_default_range_check check (default_date_range_days between 1 and 3650),
  constraint intelligence_settings_frequency_check check (suggested_frequency in ('daily', 'weekly', 'biweekly', 'monthly')),
  constraint intelligence_settings_thresholds_check check (jsonb_typeof(scoring_thresholds) = 'object'),
  constraint intelligence_settings_monitored_lines_check check (coalesce(array_length(monitored_lines, 1), 0) <= 16)
);

create index if not exists intelligence_sources_enabled_type_idx
on public.intelligence_sources (enabled, type, updated_at desc);

create index if not exists intelligence_topics_enabled_category_idx
on public.intelligence_topics (enabled, category, updated_at desc);

create index if not exists intelligence_topics_keywords_gin_idx
on public.intelligence_topics using gin (keywords);

create index if not exists intelligence_institutions_country_type_idx
on public.intelligence_institutions (country, type, updated_at desc);

create index if not exists intelligence_institutions_topics_gin_idx
on public.intelligence_institutions using gin (topics);

create index if not exists intelligence_papers_publication_idx
on public.intelligence_papers (publication_date desc, citations_count desc);

create index if not exists intelligence_papers_normalized_title_idx
on public.intelligence_papers (normalized_title);

create index if not exists intelligence_papers_topics_gin_idx
on public.intelligence_papers using gin (topics);

create index if not exists intelligence_papers_keywords_gin_idx
on public.intelligence_papers using gin (keywords);

create index if not exists intelligence_grants_dates_idx
on public.intelligence_grants (start_date desc, end_date desc);

create index if not exists intelligence_grants_topics_gin_idx
on public.intelligence_grants using gin (topics);

create index if not exists intelligence_patents_dates_idx
on public.intelligence_patents (filing_date desc, publication_date desc);

create index if not exists intelligence_patents_topics_gin_idx
on public.intelligence_patents using gin (topics);

create index if not exists intelligence_trials_dates_idx
on public.intelligence_trials (start_date desc, completion_date desc);

create index if not exists intelligence_trials_topics_gin_idx
on public.intelligence_trials using gin (topics);

create index if not exists intelligence_trials_keywords_gin_idx
on public.intelligence_trials using gin (keywords);

create index if not exists intelligence_signals_status_type_idx
on public.intelligence_signals (status, signal_type, related_line, created_at desc);

create index if not exists intelligence_runs_status_started_idx
on public.intelligence_runs (status, started_at desc, created_at desc);

create index if not exists intelligence_settings_updated_idx
on public.intelligence_settings (updated_at desc, created_at desc);

create or replace function public.set_intelligence_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_intelligence_updated_at() from public, anon, authenticated;

drop trigger if exists intelligence_sources_set_timestamps on public.intelligence_sources;
create trigger intelligence_sources_set_timestamps
before update on public.intelligence_sources
for each row execute function public.set_intelligence_updated_at();

drop trigger if exists intelligence_topics_set_timestamps on public.intelligence_topics;
create trigger intelligence_topics_set_timestamps
before update on public.intelligence_topics
for each row execute function public.set_intelligence_updated_at();

drop trigger if exists intelligence_institutions_set_timestamps on public.intelligence_institutions;
create trigger intelligence_institutions_set_timestamps
before update on public.intelligence_institutions
for each row execute function public.set_intelligence_updated_at();

drop trigger if exists intelligence_papers_set_timestamps on public.intelligence_papers;
create trigger intelligence_papers_set_timestamps
before update on public.intelligence_papers
for each row execute function public.set_intelligence_updated_at();

drop trigger if exists intelligence_grants_set_timestamps on public.intelligence_grants;
create trigger intelligence_grants_set_timestamps
before update on public.intelligence_grants
for each row execute function public.set_intelligence_updated_at();

drop trigger if exists intelligence_patents_set_timestamps on public.intelligence_patents;
create trigger intelligence_patents_set_timestamps
before update on public.intelligence_patents
for each row execute function public.set_intelligence_updated_at();

drop trigger if exists intelligence_trials_set_timestamps on public.intelligence_trials;
create trigger intelligence_trials_set_timestamps
before update on public.intelligence_trials
for each row execute function public.set_intelligence_updated_at();

drop trigger if exists intelligence_signals_set_timestamps on public.intelligence_signals;
create trigger intelligence_signals_set_timestamps
before update on public.intelligence_signals
for each row execute function public.set_intelligence_updated_at();

drop trigger if exists intelligence_runs_set_timestamps on public.intelligence_runs;
create trigger intelligence_runs_set_timestamps
before update on public.intelligence_runs
for each row execute function public.set_intelligence_updated_at();

drop trigger if exists intelligence_settings_set_timestamps on public.intelligence_settings;
create trigger intelligence_settings_set_timestamps
before update on public.intelligence_settings
for each row execute function public.set_intelligence_updated_at();

alter table public.intelligence_sources enable row level security;
alter table public.intelligence_topics enable row level security;
alter table public.intelligence_institutions enable row level security;
alter table public.intelligence_papers enable row level security;
alter table public.intelligence_grants enable row level security;
alter table public.intelligence_patents enable row level security;
alter table public.intelligence_trials enable row level security;
alter table public.intelligence_signals enable row level security;
alter table public.intelligence_runs enable row level security;
alter table public.intelligence_settings enable row level security;

revoke all on public.intelligence_sources from public, anon;
revoke all on public.intelligence_topics from public, anon;
revoke all on public.intelligence_institutions from public, anon;
revoke all on public.intelligence_papers from public, anon;
revoke all on public.intelligence_grants from public, anon;
revoke all on public.intelligence_patents from public, anon;
revoke all on public.intelligence_trials from public, anon;
revoke all on public.intelligence_signals from public, anon;
revoke all on public.intelligence_runs from public, anon;
revoke all on public.intelligence_settings from public, anon;

grant select, insert, update, delete on public.intelligence_sources to authenticated;
grant select, insert, update, delete on public.intelligence_topics to authenticated;
grant select, insert, update, delete on public.intelligence_institutions to authenticated;
grant select, insert, update, delete on public.intelligence_papers to authenticated;
grant select, insert, update, delete on public.intelligence_grants to authenticated;
grant select, insert, update, delete on public.intelligence_patents to authenticated;
grant select, insert, update, delete on public.intelligence_trials to authenticated;
grant select, insert, update, delete on public.intelligence_signals to authenticated;
grant select, insert, update, delete on public.intelligence_runs to authenticated;
grant select, insert, update, delete on public.intelligence_settings to authenticated;

drop policy if exists "Admins manage intelligence sources" on public.intelligence_sources;
create policy "Admins manage intelligence sources"
on public.intelligence_sources
for all
to authenticated
using (private.is_admin())
with check (private.is_admin());

drop policy if exists "Admins manage intelligence topics" on public.intelligence_topics;
create policy "Admins manage intelligence topics"
on public.intelligence_topics
for all
to authenticated
using (private.is_admin())
with check (private.is_admin());

drop policy if exists "Admins manage intelligence institutions" on public.intelligence_institutions;
create policy "Admins manage intelligence institutions"
on public.intelligence_institutions
for all
to authenticated
using (private.is_admin())
with check (private.is_admin());

drop policy if exists "Admins manage intelligence papers" on public.intelligence_papers;
create policy "Admins manage intelligence papers"
on public.intelligence_papers
for all
to authenticated
using (private.is_admin())
with check (private.is_admin());

drop policy if exists "Admins manage intelligence grants" on public.intelligence_grants;
create policy "Admins manage intelligence grants"
on public.intelligence_grants
for all
to authenticated
using (private.is_admin())
with check (private.is_admin());

drop policy if exists "Admins manage intelligence patents" on public.intelligence_patents;
create policy "Admins manage intelligence patents"
on public.intelligence_patents
for all
to authenticated
using (private.is_admin())
with check (private.is_admin());

drop policy if exists "Admins manage intelligence trials" on public.intelligence_trials;
create policy "Admins manage intelligence trials"
on public.intelligence_trials
for all
to authenticated
using (private.is_admin())
with check (private.is_admin());

drop policy if exists "Admins manage intelligence signals" on public.intelligence_signals;
create policy "Admins manage intelligence signals"
on public.intelligence_signals
for all
to authenticated
using (private.is_admin())
with check (private.is_admin());

drop policy if exists "Admins manage intelligence runs" on public.intelligence_runs;
create policy "Admins manage intelligence runs"
on public.intelligence_runs
for all
to authenticated
using (private.is_admin())
with check (private.is_admin());

drop policy if exists "Admins manage intelligence settings" on public.intelligence_settings;
create policy "Admins manage intelligence settings"
on public.intelligence_settings
for all
to authenticated
using (private.is_admin())
with check (private.is_admin());

comment on table public.intelligence_sources is
'Admin-only registry of external scientific and technology intelligence sources used by BCC.';

comment on table public.intelligence_topics is
'Admin-only taxonomy of monitored science and technology topics used by the intelligence module.';

comment on table public.intelligence_institutions is
'Admin-only registry of universities, labs, hospitals, research centers and companies relevant to monitored signals.';

comment on table public.intelligence_papers is
'Admin-only scientific publication and preprint registry for the intelligence radar.';

comment on table public.intelligence_grants is
'Admin-only funding opportunity and awarded grant registry for research and partnership intelligence.';

comment on table public.intelligence_patents is
'Admin-only patent and patent application registry for competitive and technology intelligence.';

comment on table public.intelligence_trials is
'Admin-only clinical and translational study registry for adoption, validation and partnership intelligence.';

comment on table public.intelligence_signals is
'Admin-only derived strategic signals generated from monitored papers, grants, patents and institutions.';

comment on table public.intelligence_runs is
'Admin-only execution log for sync and analysis runs in the intelligence module.';

comment on table public.intelligence_settings is
'Admin-only configuration for default sync behavior, scoring thresholds and monitored BCC lines.';
