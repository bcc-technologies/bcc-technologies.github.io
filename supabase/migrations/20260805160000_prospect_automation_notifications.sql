-- Real pipeline automation: scan prospects on a schedule and queue actual
-- push notifications to the right staff member through the existing
-- workspace_notification_queue / send-workspace-push pipeline (previously
-- built for tasks/events, but never dispatched on a schedule until now).

alter table public.workspace_notification_queue
  add column if not exists related_prospect_id uuid references public.workspace_prospects(id) on delete cascade;

drop index if exists workspace_notification_queue_dedupe_idx;
create unique index workspace_notification_queue_dedupe_idx
on public.workspace_notification_queue (
  user_id,
  notification_type,
  coalesce(related_task_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(related_event_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(related_prospect_id, '00000000-0000-0000-0000-000000000000'::uuid),
  notify_at
);

alter table public.workspace_notification_queue
  drop constraint if exists workspace_notification_queue_type_check;
alter table public.workspace_notification_queue
  add constraint workspace_notification_queue_type_check
  check (notification_type in (
    'task_assigned', 'task_suggested', 'task_due', 'task_overdue', 'calendar_event',
    'prospect_overdue', 'prospect_unassigned', 'prospect_stalled'
  ));

drop function if exists private.queue_workspace_notification(uuid, text, text, text, text, text, uuid, uuid, timestamptz);

create or replace function private.queue_workspace_notification(
  target_user_id uuid,
  notification_type text,
  title text,
  body text,
  target_url text,
  tag text,
  related_task_id uuid default null,
  related_event_id uuid default null,
  notify_at timestamptz default now(),
  related_prospect_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if target_user_id is null then
    return;
  end if;

  insert into public.workspace_notification_queue (
    user_id,
    notification_type,
    title,
    body,
    target_url,
    tag,
    related_task_id,
    related_event_id,
    related_prospect_id,
    notify_at
  ) values (
    target_user_id,
    notification_type,
    left(coalesce(title, 'BCC Workspace'), 160),
    left(coalesce(body, ''), 300),
    left(coalesce(target_url, '/staff-dashboard.html#trabajo'), 300),
    left(coalesce(tag, ''), 160),
    related_task_id,
    related_event_id,
    related_prospect_id,
    coalesce(notify_at, now())
  )
  on conflict do nothing;
end;
$$;

revoke all on function private.queue_workspace_notification(uuid, text, text, text, text, text, uuid, uuid, timestamptz, uuid) from public, anon, authenticated;
grant execute on function private.queue_workspace_notification(uuid, text, text, text, text, text, uuid, uuid, timestamptz, uuid) to service_role;

-- Scans workspace_prospects and queues real notifications. Called only from
-- the process-prospect-automations.mjs scheduled script via the service
-- role key -- never from the browser.
create or replace function public.queue_prospect_automation_notifications()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  today_start timestamptz := date_trunc('day', now());
  total_queued integer := 0;
  rec record;
  manager record;
begin
  -- Rule: overdue follow-up with a known owner -> notify that owner.
  for rec in
    select id, full_name, owner_user_id
    from public.workspace_prospects
    where phase not in ('won', 'lost')
      and owner_user_id is not null
      and next_follow_up_on is not null
      and next_follow_up_on < current_date
  loop
    perform private.queue_workspace_notification(
      target_user_id => rec.owner_user_id,
      notification_type => 'prospect_overdue',
      title => 'Seguimiento vencido',
      body => coalesce(nullif(rec.full_name, ''), 'Un contacto') || ' tiene un seguimiento vencido en el CRM.',
      target_url => '/staff-dashboard.html#crm-correos',
      tag => 'prospect-overdue-' || rec.id::text,
      notify_at => today_start,
      related_prospect_id => rec.id
    );
    total_queued := total_queued + 1;
  end loop;

  -- Rule: unassigned contact older than 24h -> notify everyone who can manage the CRM.
  for rec in
    select id, full_name
    from public.workspace_prospects
    where phase not in ('won', 'lost')
      and owner_user_id is null
      and created_at < now() - interval '24 hours'
  loop
    for manager in
      select id
      from public.profiles
      where role = 'admin'
        or 'department_director' = any(coalesce(staff_roles, array[]::text[]))
    loop
      perform private.queue_workspace_notification(
        target_user_id => manager.id,
        notification_type => 'prospect_unassigned',
        title => 'Contacto sin responsable',
        body => coalesce(nullif(rec.full_name, ''), 'Un contacto') || ' lleva mas de 24h sin responsable asignado.',
        target_url => '/staff-dashboard.html#crm-correos',
        tag => 'prospect-unassigned-' || rec.id::text || '-' || manager.id::text,
        notify_at => today_start,
        related_prospect_id => rec.id
      );
      total_queued := total_queued + 1;
    end loop;
  end loop;

  -- Rule: proposal/negotiation stalled without a next follow-up date -> notify the owner.
  for rec in
    select id, full_name, owner_user_id
    from public.workspace_prospects
    where phase in ('proposal', 'negotiation')
      and next_follow_up_on is null
      and owner_user_id is not null
      and created_at < now() - interval '48 hours'
  loop
    perform private.queue_workspace_notification(
      target_user_id => rec.owner_user_id,
      notification_type => 'prospect_stalled',
      title => 'Propuesta sin proxima accion',
      body => coalesce(nullif(rec.full_name, ''), 'Un contacto') || ' no tiene fecha de seguimiento definida.',
      target_url => '/staff-dashboard.html#crm-correos',
      tag => 'prospect-stalled-' || rec.id::text,
      notify_at => today_start,
      related_prospect_id => rec.id
    );
    total_queued := total_queued + 1;
  end loop;

  return total_queued;
end;
$$;

revoke all on function public.queue_prospect_automation_notifications() from public, anon, authenticated;
grant execute on function public.queue_prospect_automation_notifications() to service_role;

-- Least-privilege read model for the CRM UI: aggregate counts only, no
-- recipient identities, gated by the same rule as the rest of the CRM.
create or replace function public.get_prospect_automation_status()
returns table(notification_type text, queued_count integer, last_queued_at timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select q.notification_type, count(*)::integer, max(q.created_at)
  from public.workspace_notification_queue q
  where private.can_manage_signals()
    and q.notification_type in ('prospect_overdue', 'prospect_unassigned', 'prospect_stalled')
    and q.created_at >= now() - interval '24 hours'
  group by q.notification_type;
$$;

revoke all on function public.get_prospect_automation_status() from public, anon;
grant execute on function public.get_prospect_automation_status() to authenticated;
