-- BCC Workspace prospect and email management for the admin dashboard.
-- Run after SUPABASE_AUTH_SETUP.sql in the Supabase SQL Editor.

create table if not exists public.workspace_prospects (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  full_name text not null,
  company text not null default '',
  email text not null,
  phone text not null default '',
  phase text not null default 'lead',
  tags text[] not null default '{}'::text[],
  source text not null default '',
  notes text not null default '',
  value_estimate numeric(12, 2),
  next_follow_up_on date,
  last_contact_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspace_prospects_full_name_check check (char_length(btrim(full_name)) between 1 and 120),
  constraint workspace_prospects_company_check check (char_length(company) <= 120),
  constraint workspace_prospects_email_check check (char_length(btrim(email)) between 3 and 160),
  constraint workspace_prospects_phone_check check (char_length(phone) <= 60),
  constraint workspace_prospects_phase_check check (phase in ('lead', 'qualified', 'contacted', 'proposal', 'negotiation', 'won', 'lost')),
  constraint workspace_prospects_source_check check (char_length(source) <= 80),
  constraint workspace_prospects_notes_check check (char_length(notes) <= 4000),
  constraint workspace_prospects_value_check check (value_estimate is null or value_estimate >= 0),
  constraint workspace_prospects_tags_check check (coalesce(array_length(tags, 1), 0) <= 12)
);

create table if not exists public.workspace_prospect_templates (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  name text not null,
  category text not null default '',
  tags text[] not null default '{}'::text[],
  subject text not null,
  body text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspace_prospect_templates_name_check check (char_length(btrim(name)) between 1 and 120),
  constraint workspace_prospect_templates_category_check check (char_length(category) <= 80),
  constraint workspace_prospect_templates_subject_check check (char_length(btrim(subject)) between 1 and 180),
  constraint workspace_prospect_templates_body_check check (char_length(btrim(body)) between 1 and 12000),
  constraint workspace_prospect_templates_tags_check check (coalesce(array_length(tags, 1), 0) <= 12)
);

create table if not exists public.workspace_prospect_emails (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.workspace_prospects(id) on delete cascade,
  template_id uuid references public.workspace_prospect_templates(id) on delete set null,
  actor_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  recipient_email text not null,
  subject text not null,
  body text not null,
  attachments jsonb not null default '[]'::jsonb,
  status text not null default 'draft',
  scheduled_for timestamptz,
  sent_at timestamptz,
  provider_message_id text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspace_prospect_emails_email_check check (char_length(btrim(recipient_email)) between 3 and 160),
  constraint workspace_prospect_emails_subject_check check (char_length(btrim(subject)) between 1 and 180),
  constraint workspace_prospect_emails_body_check check (char_length(btrim(body)) between 1 and 12000),
  constraint workspace_prospect_emails_attachments_check check (jsonb_typeof(attachments) = 'array'),
  constraint workspace_prospect_emails_status_check check (status in ('draft', 'scheduled', 'sent', 'archived'))
);

alter table public.workspace_prospect_emails add column if not exists attachments jsonb not null default '[]'::jsonb;
alter table public.workspace_prospect_emails add column if not exists scheduled_for timestamptz;
alter table public.workspace_prospect_emails add column if not exists provider_message_id text not null default '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'workspace_prospect_emails_attachments_check'
  ) then
    alter table public.workspace_prospect_emails
      add constraint workspace_prospect_emails_attachments_check
      check (jsonb_typeof(attachments) = 'array');
  end if;
end;
$$;

create table if not exists public.workspace_prospect_activities (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.workspace_prospects(id) on delete cascade,
  actor_id uuid default auth.uid() references auth.users(id) on delete restrict,
  activity_type text not null default 'note',
  title text not null,
  details text not null default '',
  due_at timestamptz,
  occurred_at timestamptz not null default now(),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspace_prospect_activities_type_check check (activity_type in ('note', 'call', 'meeting', 'email', 'follow_up')),
  constraint workspace_prospect_activities_title_check check (char_length(btrim(title)) between 1 and 160),
  constraint workspace_prospect_activities_details_check check (char_length(details) <= 4000),
  constraint workspace_prospect_activities_meta_check check (jsonb_typeof(meta) = 'object')
);

alter table public.workspace_prospect_activities alter column actor_id drop not null;

create index if not exists workspace_prospects_phase_follow_up_idx
on public.workspace_prospects (phase, next_follow_up_on, updated_at desc);

create index if not exists workspace_prospect_templates_active_updated_idx
on public.workspace_prospect_templates (is_active, updated_at desc);

create index if not exists workspace_prospect_emails_prospect_created_idx
on public.workspace_prospect_emails (prospect_id, created_at desc);

create index if not exists workspace_prospect_emails_status_scheduled_idx
on public.workspace_prospect_emails (status, scheduled_for, created_at desc);

create index if not exists workspace_prospect_activities_prospect_occurred_idx
on public.workspace_prospect_activities (prospect_id, occurred_at desc, created_at desc);

create or replace function public.set_workspace_prospect_timestamps()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  if tg_table_name = 'workspace_prospect_emails' then
    if new.status = 'sent' and new.sent_at is null then
      new.sent_at = now();
    elsif new.status <> 'sent' then
      new.sent_at = null;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.set_workspace_prospect_timestamps() from public, anon, authenticated;

drop trigger if exists workspace_prospects_set_timestamps on public.workspace_prospects;
create trigger workspace_prospects_set_timestamps
before update on public.workspace_prospects
for each row execute function public.set_workspace_prospect_timestamps();

drop trigger if exists workspace_prospect_templates_set_timestamps on public.workspace_prospect_templates;
create trigger workspace_prospect_templates_set_timestamps
before update on public.workspace_prospect_templates
for each row execute function public.set_workspace_prospect_timestamps();

drop trigger if exists workspace_prospect_emails_set_timestamps on public.workspace_prospect_emails;
create trigger workspace_prospect_emails_set_timestamps
before update on public.workspace_prospect_emails
for each row execute function public.set_workspace_prospect_timestamps();

drop trigger if exists workspace_prospect_activities_set_timestamps on public.workspace_prospect_activities;
create trigger workspace_prospect_activities_set_timestamps
before update on public.workspace_prospect_activities
for each row execute function public.set_workspace_prospect_timestamps();

alter table public.workspace_prospects enable row level security;
alter table public.workspace_prospect_templates enable row level security;
alter table public.workspace_prospect_emails enable row level security;
alter table public.workspace_prospect_activities enable row level security;

revoke all on public.workspace_prospects from public, anon;
revoke all on public.workspace_prospect_templates from public, anon;
revoke all on public.workspace_prospect_emails from public, anon;
revoke all on public.workspace_prospect_activities from public, anon;
grant select, insert, update, delete on public.workspace_prospects to authenticated;
grant select, insert, update, delete on public.workspace_prospect_templates to authenticated;
grant select, insert, update, delete on public.workspace_prospect_emails to authenticated;
grant select, insert, update, delete on public.workspace_prospect_activities to authenticated;

drop policy if exists "Admins manage workspace prospects" on public.workspace_prospects;
create policy "Admins manage workspace prospects"
on public.workspace_prospects
for all
to authenticated
using (private.is_admin())
with check (private.is_admin());

drop policy if exists "Admins manage workspace prospect templates" on public.workspace_prospect_templates;
create policy "Admins manage workspace prospect templates"
on public.workspace_prospect_templates
for all
to authenticated
using (private.is_admin())
with check (private.is_admin());

drop policy if exists "Admins manage workspace prospect emails" on public.workspace_prospect_emails;
create policy "Admins manage workspace prospect emails"
on public.workspace_prospect_emails
for all
to authenticated
using (private.is_admin())
with check (private.is_admin());

drop policy if exists "Admins manage workspace prospect activities" on public.workspace_prospect_activities;
create policy "Admins manage workspace prospect activities"
on public.workspace_prospect_activities
for all
to authenticated
using (private.is_admin())
with check (private.is_admin());

comment on table public.workspace_prospects is
'Admin-only prospect CRM table used for acquisition and follow-up tracking.';

comment on table public.workspace_prospect_templates is
'Reusable admin-only email templates for outreach and follow-up.';

comment on table public.workspace_prospect_emails is
'Admin-only outbound email log and draft registry for each prospect.';

comment on table public.workspace_prospect_activities is
'Admin-only activity timeline for prospect notes, calls, meetings, emails and follow-ups.';
