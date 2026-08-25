create or replace function private.can_manage_signals()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and (
        role = 'admin'
        or 'department_director' = any(coalesce(staff_roles, array[]::text[]))
      )
  );
$$;

revoke all on function private.can_manage_signals() from public, anon;
grant execute on function private.can_manage_signals() to authenticated, service_role;

drop policy if exists "Admins read analytics events" on public.analytics_events;
create policy "Admins read analytics events"
on public.analytics_events
for select
to authenticated
using (private.can_manage_signals());

do $$
declare
  ddl text;
begin
  select pg_get_functiondef('public.get_admin_analytics_dashboard(integer)'::regprocedure) into ddl;
  ddl := replace(ddl, 'private.is_admin()', 'private.can_manage_signals()');
  execute ddl;
end;
$$;

drop policy if exists "Admins manage workspace prospects" on public.workspace_prospects;
create policy "Admins manage workspace prospects"
on public.workspace_prospects
for all
to authenticated
using (private.can_manage_signals())
with check (private.can_manage_signals());

drop policy if exists "Admins manage workspace prospect templates" on public.workspace_prospect_templates;
create policy "Admins manage workspace prospect templates"
on public.workspace_prospect_templates
for all
to authenticated
using (private.can_manage_signals())
with check (private.can_manage_signals());

drop policy if exists "Admins manage workspace prospect emails" on public.workspace_prospect_emails;
create policy "Admins manage workspace prospect emails"
on public.workspace_prospect_emails
for all
to authenticated
using (private.can_manage_signals())
with check (private.can_manage_signals());

drop policy if exists "Admins manage workspace prospect activities" on public.workspace_prospect_activities;
create policy "Admins manage workspace prospect activities"
on public.workspace_prospect_activities
for all
to authenticated
using (private.can_manage_signals())
with check (private.can_manage_signals());

drop policy if exists "Admins manage intelligence sources" on public.intelligence_sources;
create policy "Admins manage intelligence sources"
on public.intelligence_sources
for all
to authenticated
using (private.can_manage_signals())
with check (private.can_manage_signals());

drop policy if exists "Admins manage intelligence topics" on public.intelligence_topics;
create policy "Admins manage intelligence topics"
on public.intelligence_topics
for all
to authenticated
using (private.can_manage_signals())
with check (private.can_manage_signals());

drop policy if exists "Admins manage intelligence institutions" on public.intelligence_institutions;
create policy "Admins manage intelligence institutions"
on public.intelligence_institutions
for all
to authenticated
using (private.can_manage_signals())
with check (private.can_manage_signals());

drop policy if exists "Admins manage intelligence papers" on public.intelligence_papers;
create policy "Admins manage intelligence papers"
on public.intelligence_papers
for all
to authenticated
using (private.can_manage_signals())
with check (private.can_manage_signals());

drop policy if exists "Admins manage intelligence grants" on public.intelligence_grants;
create policy "Admins manage intelligence grants"
on public.intelligence_grants
for all
to authenticated
using (private.can_manage_signals())
with check (private.can_manage_signals());

drop policy if exists "Admins manage intelligence patents" on public.intelligence_patents;
create policy "Admins manage intelligence patents"
on public.intelligence_patents
for all
to authenticated
using (private.can_manage_signals())
with check (private.can_manage_signals());

drop policy if exists "Admins manage intelligence trials" on public.intelligence_trials;
create policy "Admins manage intelligence trials"
on public.intelligence_trials
for all
to authenticated
using (private.can_manage_signals())
with check (private.can_manage_signals());

drop policy if exists "Admins manage intelligence signals" on public.intelligence_signals;
create policy "Admins manage intelligence signals"
on public.intelligence_signals
for all
to authenticated
using (private.can_manage_signals())
with check (private.can_manage_signals());

drop policy if exists "Admins manage intelligence runs" on public.intelligence_runs;
create policy "Admins manage intelligence runs"
on public.intelligence_runs
for all
to authenticated
using (private.can_manage_signals())
with check (private.can_manage_signals());

drop policy if exists "Admins manage intelligence settings" on public.intelligence_settings;
create policy "Admins manage intelligence settings"
on public.intelligence_settings
for all
to authenticated
using (private.can_manage_signals())
with check (private.can_manage_signals());;
