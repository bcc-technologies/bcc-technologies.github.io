-- BCC Dominican Intelligence schema.
-- Run after SUPABASE_AUTH_SETUP.sql.

create table if not exists public.dominican_sources (
  id text primary key,
  name text not null,
  institution text not null default '',
  section text not null,
  category text not null,
  source_type text not null,
  url text not null default '',
  status text not null default 'unknown',
  strategic_value text not null default 'medium',
  bcc_relevance_json jsonb not null default '[]'::jsonb,
  connector_key text not null default '',
  notes text not null default '',
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dominican_sources_section_check check (section in ('data_sources','institutions','public_market','economy_finance','demographics_statistics','territory_environment','regulation_policy','science_academia','radar')),
  constraint dominican_sources_category_check check (category in ('open_data','government_api','procurement','economy','finance','trade','statistics','demographics','geospatial','environment','satellite','regulation','policy','science','institutional')),
  constraint dominican_sources_type_check check (source_type in ('api','ckan','csv','xlsx','ods','wms','wmts','wfs','csw','web_portal','document','manual','satellite_api')),
  constraint dominican_sources_status_check check (status in ('active','partial','unknown','planned','failed')),
  constraint dominican_sources_value_check check (strategic_value in ('high','medium','low')),
  constraint dominican_sources_relevance_check check (jsonb_typeof(bcc_relevance_json) = 'array')
);

create table if not exists public.dominican_source_resources (
  id text primary key,
  source_id text references public.dominican_sources(id) on delete cascade,
  external_id text not null default '',
  name text not null,
  format text not null default '',
  url text not null default '',
  resource_type text not null default '',
  description text not null default '',
  metadata_json jsonb not null default '{}'::jsonb,
  last_modified timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dominican_source_resources_metadata_check check (jsonb_typeof(metadata_json) = 'object')
);

create table if not exists public.dominican_datasets (
  id text primary key,
  source_id text references public.dominican_sources(id) on delete set null,
  external_id text not null default '',
  title text not null,
  name text not null default '',
  organization text not null default '',
  section text not null default 'data_sources',
  category text not null default 'open_data',
  notes text not null default '',
  tags_json jsonb not null default '[]'::jsonb,
  resources_json jsonb not null default '[]'::jsonb,
  metadata_json jsonb not null default '{}'::jsonb,
  relevance_score integer not null default 0,
  last_modified timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dominican_datasets_tags_check check (jsonb_typeof(tags_json) = 'array'),
  constraint dominican_datasets_resources_check check (jsonb_typeof(resources_json) = 'array'),
  constraint dominican_datasets_metadata_check check (jsonb_typeof(metadata_json) = 'object'),
  constraint dominican_datasets_score_check check (relevance_score between 0 and 100)
);

create table if not exists public.dominican_institutions (
  id text primary key,
  name text not null,
  kind text not null,
  sector text not null default '',
  source_id text references public.dominican_sources(id) on delete set null,
  relevance_to_bcc text not null default 'medium',
  notes text not null default '',
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dominican_institutions_kind_check check (kind in ('ministry','agency','superintendency','municipality','university','public_company','international')),
  constraint dominican_institutions_relevance_check check (relevance_to_bcc in ('high','medium','low')),
  constraint dominican_institutions_metadata_check check (jsonb_typeof(metadata_json) = 'object')
);

create table if not exists public.dominican_procurement_records (
  id text primary key,
  source_id text references public.dominican_sources(id) on delete set null,
  external_id text not null default '',
  title text not null,
  institution text not null default '',
  procedure_type text not null default '',
  status text not null default '',
  amount numeric(18,2),
  currency text not null default '',
  publication_date date,
  category text not null default '',
  raw_json jsonb not null default '{}'::jsonb,
  relevance_score integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dominican_procurement_raw_check check (jsonb_typeof(raw_json) = 'object'),
  constraint dominican_procurement_score_check check (relevance_score between 0 and 100)
);

create table if not exists public.dominican_economic_indicators (
  id text primary key,
  source_id text references public.dominican_sources(id) on delete set null,
  indicator_name text not null,
  indicator_code text not null default '',
  value numeric,
  unit text not null default '',
  period text not null default '',
  category text not null default '',
  raw_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dominican_economic_raw_check check (jsonb_typeof(raw_json) = 'object')
);

create table if not exists public.dominican_geo_layers (
  id text primary key,
  source_id text references public.dominican_sources(id) on delete set null,
  name text not null,
  layer_type text not null default '',
  service_type text not null default '',
  service_url text not null default '',
  category text not null default '',
  description text not null default '',
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dominican_geo_metadata_check check (jsonb_typeof(metadata_json) = 'object')
);

create table if not exists public.dominican_policy_documents (
  id text primary key,
  source_id text references public.dominican_sources(id) on delete set null,
  title text not null,
  institution text not null default '',
  document_type text not null default '',
  publication_date date,
  url text not null default '',
  summary text not null default '',
  raw_text text not null default '',
  metadata_json jsonb not null default '{}'::jsonb,
  relevance_score integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dominican_policy_metadata_check check (jsonb_typeof(metadata_json) = 'object'),
  constraint dominican_policy_score_check check (relevance_score between 0 and 100)
);

create table if not exists public.dominican_signals (
  id text primary key,
  source_id text references public.dominican_sources(id) on delete set null,
  section text not null,
  category text not null,
  title text not null,
  summary text not null default '',
  why_flagged text not null default '',
  relevance_score integer not null default 0,
  urgency text not null default 'low',
  entity_name text not null default '',
  entity_type text not null default '',
  suggested_action text not null default '',
  raw_json jsonb not null default '{}'::jsonb,
  detected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dominican_signals_urgency_check check (urgency in ('low','medium','high')),
  constraint dominican_signals_score_check check (relevance_score between 0 and 100),
  constraint dominican_signals_raw_check check (jsonb_typeof(raw_json) = 'object')
);

create table if not exists public.dominican_sync_runs (
  id uuid primary key default gen_random_uuid(),
  source_id text references public.dominican_sources(id) on delete set null,
  connector_key text not null default '',
  status text not null default 'running',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  records_found integer not null default 0,
  records_created integer not null default 0,
  records_updated integer not null default 0,
  error_message text not null default '',
  metadata_json jsonb not null default '{}'::jsonb,
  constraint dominican_sync_runs_status_check check (status in ('running','completed','failed','partial')),
  constraint dominican_sync_runs_metadata_check check (jsonb_typeof(metadata_json) = 'object')
);

create index if not exists dominican_sources_section_status_idx on public.dominican_sources (section, status, updated_at desc);
create index if not exists dominican_datasets_relevance_idx on public.dominican_datasets (relevance_score desc, updated_at desc);
create index if not exists dominican_resources_source_idx on public.dominican_source_resources (source_id, updated_at desc);
create index if not exists dominican_signals_relevance_idx on public.dominican_signals (relevance_score desc, detected_at desc);
create index if not exists dominican_sync_runs_started_idx on public.dominican_sync_runs (started_at desc);

create or replace function public.set_dominican_intelligence_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_dominican_intelligence_updated_at() from public, anon, authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'dominican_sources',
    'dominican_source_resources',
    'dominican_datasets',
    'dominican_institutions',
    'dominican_procurement_records',
    'dominican_economic_indicators',
    'dominican_geo_layers',
    'dominican_policy_documents',
    'dominican_signals'
  ]
  loop
    execute format('drop trigger if exists %I on public.%I', table_name || '_set_updated_at', table_name);
    execute format('create trigger %I before update on public.%I for each row execute function public.set_dominican_intelligence_updated_at()', table_name || '_set_updated_at', table_name);
  end loop;
end;
$$;

alter table public.dominican_sources enable row level security;
alter table public.dominican_source_resources enable row level security;
alter table public.dominican_datasets enable row level security;
alter table public.dominican_institutions enable row level security;
alter table public.dominican_procurement_records enable row level security;
alter table public.dominican_economic_indicators enable row level security;
alter table public.dominican_geo_layers enable row level security;
alter table public.dominican_policy_documents enable row level security;
alter table public.dominican_signals enable row level security;
alter table public.dominican_sync_runs enable row level security;

revoke all on public.dominican_sources from public, anon;
revoke all on public.dominican_source_resources from public, anon;
revoke all on public.dominican_datasets from public, anon;
revoke all on public.dominican_institutions from public, anon;
revoke all on public.dominican_procurement_records from public, anon;
revoke all on public.dominican_economic_indicators from public, anon;
revoke all on public.dominican_geo_layers from public, anon;
revoke all on public.dominican_policy_documents from public, anon;
revoke all on public.dominican_signals from public, anon;
revoke all on public.dominican_sync_runs from public, anon;

grant select, insert, update, delete on public.dominican_sources to authenticated;
grant select, insert, update, delete on public.dominican_source_resources to authenticated;
grant select, insert, update, delete on public.dominican_datasets to authenticated;
grant select, insert, update, delete on public.dominican_institutions to authenticated;
grant select, insert, update, delete on public.dominican_procurement_records to authenticated;
grant select, insert, update, delete on public.dominican_economic_indicators to authenticated;
grant select, insert, update, delete on public.dominican_geo_layers to authenticated;
grant select, insert, update, delete on public.dominican_policy_documents to authenticated;
grant select, insert, update, delete on public.dominican_signals to authenticated;
grant select, insert, update, delete on public.dominican_sync_runs to authenticated;

drop policy if exists "Admins manage Dominican sources" on public.dominican_sources;
create policy "Admins manage Dominican sources" on public.dominican_sources for all to authenticated using (private.can_manage_signals()) with check (private.can_manage_signals());
drop policy if exists "Admins manage Dominican resources" on public.dominican_source_resources;
create policy "Admins manage Dominican resources" on public.dominican_source_resources for all to authenticated using (private.can_manage_signals()) with check (private.can_manage_signals());
drop policy if exists "Admins manage Dominican datasets" on public.dominican_datasets;
create policy "Admins manage Dominican datasets" on public.dominican_datasets for all to authenticated using (private.can_manage_signals()) with check (private.can_manage_signals());
drop policy if exists "Admins manage Dominican institutions" on public.dominican_institutions;
create policy "Admins manage Dominican institutions" on public.dominican_institutions for all to authenticated using (private.can_manage_signals()) with check (private.can_manage_signals());
drop policy if exists "Admins manage Dominican procurement" on public.dominican_procurement_records;
create policy "Admins manage Dominican procurement" on public.dominican_procurement_records for all to authenticated using (private.can_manage_signals()) with check (private.can_manage_signals());
drop policy if exists "Admins manage Dominican indicators" on public.dominican_economic_indicators;
create policy "Admins manage Dominican indicators" on public.dominican_economic_indicators for all to authenticated using (private.can_manage_signals()) with check (private.can_manage_signals());
drop policy if exists "Admins manage Dominican geo layers" on public.dominican_geo_layers;
create policy "Admins manage Dominican geo layers" on public.dominican_geo_layers for all to authenticated using (private.can_manage_signals()) with check (private.can_manage_signals());
drop policy if exists "Admins manage Dominican policy" on public.dominican_policy_documents;
create policy "Admins manage Dominican policy" on public.dominican_policy_documents for all to authenticated using (private.can_manage_signals()) with check (private.can_manage_signals());
drop policy if exists "Admins manage Dominican signals" on public.dominican_signals;
create policy "Admins manage Dominican signals" on public.dominican_signals for all to authenticated using (private.can_manage_signals()) with check (private.can_manage_signals());
drop policy if exists "Admins manage Dominican sync runs" on public.dominican_sync_runs;
create policy "Admins manage Dominican sync runs" on public.dominican_sync_runs for all to authenticated using (private.can_manage_signals()) with check (private.can_manage_signals());
