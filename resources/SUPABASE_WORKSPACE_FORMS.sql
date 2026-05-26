-- BCC Workspace form generation and response service for Supabase.
-- Run after SUPABASE_AUTH_SETUP.sql in the Supabase SQL Editor.

create table if not exists public.workspace_forms (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  title text not null,
  purpose text not null,
  audience text not null,
  questions jsonb not null default '[]'::jsonb,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspace_forms_title_check check (char_length(btrim(title)) between 1 and 120),
  constraint workspace_forms_purpose_check check (char_length(btrim(purpose)) between 1 and 280),
  constraint workspace_forms_audience_check check (audience in ('client', 'staff')),
  constraint workspace_forms_status_check check (status in ('draft', 'published')),
  constraint workspace_forms_questions_check check (jsonb_typeof(questions) = 'array' and jsonb_array_length(questions) between 1 and 12)
);

create table if not exists public.workspace_form_responses (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.workspace_forms(id) on delete cascade,
  respondent_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(),
  constraint workspace_form_responses_answers_check check (jsonb_typeof(answers) = 'object'),
  constraint workspace_form_responses_unique_user unique (form_id, respondent_id)
);

create index if not exists workspace_forms_audience_status_created_idx
on public.workspace_forms (audience, status, created_at desc);

create index if not exists workspace_form_responses_form_submitted_idx
on public.workspace_form_responses (form_id, submitted_at desc);

create or replace function public.set_workspace_form_timestamps()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_workspace_form_timestamps() from public, anon, authenticated;

drop trigger if exists workspace_forms_set_timestamps on public.workspace_forms;
create trigger workspace_forms_set_timestamps
before update on public.workspace_forms
for each row execute function public.set_workspace_form_timestamps();

alter table public.workspace_forms enable row level security;
alter table public.workspace_form_responses enable row level security;

revoke all on public.workspace_forms from public, anon;
revoke all on public.workspace_form_responses from public, anon;
grant select, insert, update, delete on public.workspace_forms to authenticated;
grant select, insert, update on public.workspace_form_responses to authenticated;

drop policy if exists "Admins manage workspace forms" on public.workspace_forms;
create policy "Admins manage workspace forms"
on public.workspace_forms
for all
to authenticated
using (private.is_admin())
with check (private.is_admin());

drop policy if exists "Recipients read published workspace forms" on public.workspace_forms;
create policy "Recipients read published workspace forms"
on public.workspace_forms
for select
to authenticated
using (
  status = 'published'
  and exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and (
        (workspace_forms.audience = 'client' and profiles.role = 'client')
        or (workspace_forms.audience = 'staff' and profiles.role = 'staff')
      )
  )
);

drop policy if exists "Users read own form responses" on public.workspace_form_responses;
create policy "Users read own form responses"
on public.workspace_form_responses
for select
to authenticated
using ((select auth.uid()) = respondent_id);

drop policy if exists "Admins read form responses" on public.workspace_form_responses;
create policy "Admins read form responses"
on public.workspace_form_responses
for select
to authenticated
using (private.is_admin());

drop policy if exists "Recipients submit own published forms" on public.workspace_form_responses;
create policy "Recipients submit own published forms"
on public.workspace_form_responses
for insert
to authenticated
with check (
  (select auth.uid()) = respondent_id
  and exists (
    select 1
    from public.workspace_forms
    join public.profiles on profiles.id = (select auth.uid())
    where workspace_forms.id = workspace_form_responses.form_id
      and workspace_forms.status = 'published'
      and (
        (workspace_forms.audience = 'client' and profiles.role = 'client')
        or (workspace_forms.audience = 'staff' and profiles.role = 'staff')
      )
  )
);

drop policy if exists "Recipients update own published forms" on public.workspace_form_responses;
create policy "Recipients update own published forms"
on public.workspace_form_responses
for update
to authenticated
using ((select auth.uid()) = respondent_id)
with check (
  (select auth.uid()) = respondent_id
  and exists (
    select 1
    from public.workspace_forms
    join public.profiles on profiles.id = (select auth.uid())
    where workspace_forms.id = workspace_form_responses.form_id
      and workspace_forms.status = 'published'
      and (
        (workspace_forms.audience = 'client' and profiles.role = 'client')
        or (workspace_forms.audience = 'staff' and profiles.role = 'staff')
      )
  )
);

comment on table public.workspace_forms is
'Administrator-generated questionnaires published separately to client or staff audiences.';

comment on table public.workspace_form_responses is
'Private responses readable by their respondent and administrators only.';
