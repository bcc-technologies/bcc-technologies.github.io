-- BCC Supabase security hardening.
-- Run after the workspace/auth/web-push/custom-role schemas.

-- Trigger functions are implementation details. They should not be callable
-- through the REST/RPC surface by anon or regular authenticated clients.
revoke execute on function public.queue_workspace_event_push() from public, anon, authenticated;
revoke execute on function public.queue_workspace_task_push() from public, anon, authenticated;
revoke execute on function public.touch_workspace_push_subscription() from public, anon, authenticated;
revoke execute on function public.touch_workspace_role_definitions_updated_at() from public, anon, authenticated;

grant execute on function public.queue_workspace_event_push() to postgres, service_role;
grant execute on function public.queue_workspace_task_push() to postgres, service_role;
grant execute on function public.touch_workspace_push_subscription() to postgres, service_role;
grant execute on function public.touch_workspace_role_definitions_updated_at() to postgres, service_role;

-- Public role-management wrappers are only meant for signed-in users.
revoke execute on function public.set_user_access(uuid, text, text[], text[]) from public, anon;
revoke execute on function public.set_user_access(uuid, text, text[], text[], text[]) from public, anon;
grant execute on function public.set_user_access(uuid, text, text[], text[]) to authenticated, service_role;
grant execute on function public.set_user_access(uuid, text, text[], text[], text[]) to authenticated, service_role;

-- Anonymous clients should not have table privileges on profiles. Auth signup
-- is handled by auth triggers and authenticated profile access is controlled by RLS.
revoke all on public.profiles from anon;

-- Data API users do not need schema-management-style privileges.
revoke references, trigger, truncate on all tables in schema public from anon, authenticated;

-- Keep the role-definition timestamp trigger function explicit and lint-clean.
create or replace function public.touch_workspace_role_definitions_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.touch_workspace_role_definitions_updated_at() from public, anon, authenticated;
grant execute on function public.touch_workspace_role_definitions_updated_at() to postgres, service_role;

-- This helper only needs to inspect the caller's own profile through RLS.
alter function public.current_user_can_manage_users() security invoker;

-- RLS performance cleanup: wrap auth functions in SELECT so Postgres can
-- evaluate them once per statement instead of once per candidate row.
drop policy if exists "Admins can read profiles" on public.profiles;
drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Authenticated can read permitted profiles" on public.profiles;
create policy "Authenticated can read permitted profiles"
on public.profiles
for select
to authenticated
using (((select auth.uid()) = id) or (select private.is_admin()));

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles
for insert
to authenticated
with check (((select auth.uid()) = id) and role = 'client');

drop policy if exists "Users can update own non-role profile" on public.profiles;
create policy "Users can update own non-role profile"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "Users can read own account emails" on public.account_emails;
create policy "Users can read own account emails"
on public.account_emails
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can add own account emails" on public.account_emails;
create policy "Users can add own account emails"
on public.account_emails
for insert
to authenticated
with check (
  ((select auth.uid()) = user_id)
  and (
    ((is_primary = false) and (is_confirmed = false))
    or (
      (is_primary = true)
      and (is_confirmed = true)
      and (email = lower(coalesce(((select auth.jwt()) ->> 'email'), '')))
    )
  )
);

-- Consolidate SELECT policies that were functionally correct but duplicated for
-- authenticated users, which adds avoidable RLS evaluation work.
drop policy if exists "CMS managers read all posts" on public.cms_posts;
drop policy if exists "Published CMS posts are public" on public.cms_posts;
create policy "Published CMS posts are public"
on public.cms_posts
for select
to anon
using (is_published = true);
drop policy if exists "Authenticated can read permitted CMS posts" on public.cms_posts;
create policy "Authenticated can read permitted CMS posts"
on public.cms_posts
for select
to authenticated
using ((is_published = true) or (select private.can_manage_cms_content()));

drop policy if exists "Admins manage workspace forms" on public.workspace_forms;
drop policy if exists "Recipients read published workspace forms" on public.workspace_forms;
drop policy if exists "Admins create workspace forms" on public.workspace_forms;
create policy "Admins create workspace forms"
on public.workspace_forms
for insert
to authenticated
with check ((select private.is_admin()));
drop policy if exists "Admins update workspace forms" on public.workspace_forms;
create policy "Admins update workspace forms"
on public.workspace_forms
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));
drop policy if exists "Admins delete workspace forms" on public.workspace_forms;
create policy "Admins delete workspace forms"
on public.workspace_forms
for delete
to authenticated
using ((select private.is_admin()));
drop policy if exists "Authenticated can read permitted workspace forms" on public.workspace_forms;
create policy "Authenticated can read permitted workspace forms"
on public.workspace_forms
for select
to authenticated
using (
  (select private.is_admin())
  or (
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
  )
);

drop policy if exists "Admins read form responses" on public.workspace_form_responses;
drop policy if exists "Users read own form responses" on public.workspace_form_responses;
drop policy if exists "Authenticated can read permitted form responses" on public.workspace_form_responses;
create policy "Authenticated can read permitted form responses"
on public.workspace_form_responses
for select
to authenticated
using (((select auth.uid()) = respondent_id) or (select private.is_admin()));

-- Phase 2: keep privileged SECURITY DEFINER bodies out of the exposed public
-- schema, while preserving the public RPC contract through SECURITY INVOKER wrappers.
do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'get_admin_analytics_dashboard'
      and p.prosecdef = true
  ) and not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'get_admin_analytics_dashboard'
  ) then
    execute 'alter function public.get_admin_analytics_dashboard(integer) set schema private';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'get_workspace_task_collaborators'
      and p.prosecdef = true
  ) and not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'get_workspace_task_collaborators'
  ) then
    execute 'alter function public.get_workspace_task_collaborators() set schema private';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'reconcile_analytics_identity'
      and p.prosecdef = true
  ) and not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'reconcile_analytics_identity'
  ) then
    execute 'alter function public.reconcile_analytics_identity(text, text) set schema private';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'record_analytics_event'
      and p.prosecdef = true
  ) and not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'record_analytics_event'
  ) then
    execute 'alter function public.record_analytics_event(text, text, text, text, text, text, text, text, text, text, text, jsonb, text) set schema private';
  end if;
end;
$$;

create or replace function public.get_admin_analytics_dashboard(range_days integer default 30)
returns jsonb
language sql
security invoker
set search_path = public, private, pg_temp
as $$
  select private.get_admin_analytics_dashboard(range_days);
$$;

create or replace function public.get_workspace_task_collaborators()
returns table(id uuid, name text, email text, role text, hierarchy_level integer, relation text)
language sql
stable
security invoker
set search_path = public, private, pg_temp
as $$
  select * from private.get_workspace_task_collaborators();
$$;

create or replace function public.reconcile_analytics_identity(session_id text, visitor_id text)
returns integer
language sql
security invoker
set search_path = public, private, pg_temp
as $$
  select private.reconcile_analytics_identity(session_id, visitor_id);
$$;

create or replace function public.record_analytics_event(
  event_name text,
  session_id text,
  visitor_id text,
  page_path text,
  page_url text,
  page_title text,
  page_lang text,
  referrer_host text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  metadata jsonb,
  event_source text
)
returns void
language sql
security invoker
set search_path = public, private, pg_temp
as $$
  select private.record_analytics_event(
    event_name,
    session_id,
    visitor_id,
    page_path,
    page_url,
    page_title,
    page_lang,
    referrer_host,
    utm_source,
    utm_medium,
    utm_campaign,
    metadata,
    event_source
  );
$$;

revoke all on function public.get_admin_analytics_dashboard(integer) from public, anon;
revoke all on function public.get_workspace_task_collaborators() from public, anon;
revoke all on function public.reconcile_analytics_identity(text, text) from public, anon;
revoke all on function public.record_analytics_event(text, text, text, text, text, text, text, text, text, text, text, jsonb, text) from public;

grant execute on function public.get_admin_analytics_dashboard(integer) to authenticated, service_role;
grant execute on function public.get_workspace_task_collaborators() to authenticated, service_role;
grant execute on function public.reconcile_analytics_identity(text, text) to authenticated, service_role;
grant execute on function public.record_analytics_event(text, text, text, text, text, text, text, text, text, text, text, jsonb, text) to anon, authenticated, service_role;

revoke all on function private.get_admin_analytics_dashboard(integer) from public, anon;
revoke all on function private.get_workspace_task_collaborators() from public, anon;
revoke all on function private.reconcile_analytics_identity(text, text) from public, anon;
revoke all on function private.record_analytics_event(text, text, text, text, text, text, text, text, text, text, text, jsonb, text) from public;

grant execute on function private.get_admin_analytics_dashboard(integer) to authenticated, service_role;
grant execute on function private.get_workspace_task_collaborators() to authenticated, service_role;
grant execute on function private.reconcile_analytics_identity(text, text) to authenticated, service_role;
grant execute on function private.record_analytics_event(text, text, text, text, text, text, text, text, text, text, text, jsonb, text) to anon, authenticated, service_role;
