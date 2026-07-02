-- Workspace Web Push subscriptions and notification queue.
-- Requires VAPID keys configured in the Edge Function environment.

create table if not exists public.workspace_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_notification_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null,
  title text not null,
  body text not null default '',
  target_url text not null default '/staff-dashboard.html#trabajo',
  tag text not null default '',
  related_task_id uuid references public.workspace_tasks(id) on delete cascade,
  related_event_id uuid references public.workspace_events(id) on delete cascade,
  notify_at timestamptz not null default now(),
  status text not null default 'pending',
  attempts integer not null default 0,
  last_error text not null default '',
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint workspace_notification_queue_type_check check (notification_type in ('task_assigned', 'task_suggested', 'task_due', 'task_overdue', 'calendar_event')),
  constraint workspace_notification_queue_status_check check (status in ('pending', 'processing', 'sent', 'failed'))
);

create index if not exists workspace_push_subscriptions_user_idx
on public.workspace_push_subscriptions (user_id, updated_at desc);

create index if not exists workspace_notification_queue_due_idx
on public.workspace_notification_queue (status, notify_at, attempts, created_at);

create unique index if not exists workspace_notification_queue_dedupe_idx
on public.workspace_notification_queue (user_id, notification_type, coalesce(related_task_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(related_event_id, '00000000-0000-0000-0000-000000000000'::uuid), notify_at);

alter table public.workspace_push_subscriptions enable row level security;
alter table public.workspace_notification_queue enable row level security;

revoke all on public.workspace_push_subscriptions from public, anon;
revoke all on public.workspace_notification_queue from public, anon;
grant select, insert, update, delete on public.workspace_push_subscriptions to authenticated;
grant select on public.workspace_notification_queue to authenticated;

drop policy if exists "Users manage own push subscriptions" on public.workspace_push_subscriptions;
create policy "Users manage own push subscriptions"
on public.workspace_push_subscriptions
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users read own notification queue" on public.workspace_notification_queue;
create policy "Users read own notification queue"
on public.workspace_notification_queue
for select
to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.touch_workspace_push_subscription()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists workspace_push_subscription_touch on public.workspace_push_subscriptions;
create trigger workspace_push_subscription_touch
before update on public.workspace_push_subscriptions
for each row execute function public.touch_workspace_push_subscription();

create or replace function private.queue_workspace_notification(
  target_user_id uuid,
  notification_type text,
  title text,
  body text,
  target_url text,
  tag text,
  related_task_id uuid default null,
  related_event_id uuid default null,
  notify_at timestamptz default now()
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
    coalesce(notify_at, now())
  )
  on conflict do nothing;
end;
$$;

revoke all on function private.queue_workspace_notification(uuid, text, text, text, text, text, uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function private.queue_workspace_notification(uuid, text, text, text, text, text, uuid, uuid, timestamptz) to service_role;

create or replace function public.queue_workspace_task_push()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' and new.assignment_mode in ('assigned', 'suggested') and new.assignee_id <> new.created_by then
    perform private.queue_workspace_notification(
      new.assignee_id,
      case when new.assignment_mode = 'suggested' then 'task_suggested' else 'task_assigned' end,
      case when new.assignment_mode = 'suggested' then 'Nueva sugerencia de tarea' else 'Nueva tarea asignada' end,
      new.title,
      '/staff-dashboard.html#trabajo',
      'workspace-task-' || new.id::text,
      new.id,
      null,
      now()
    );
  end if;

  if new.due_date is not null and new.status <> 'done' and coalesce(new.assignment_status, 'accepted') = 'accepted' then
    perform private.queue_workspace_notification(
      new.assignee_id,
      'task_due',
      'Tarea por vencer',
      new.title,
      '/staff-dashboard.html#trabajo',
      'workspace-task-due-' || new.id::text,
      new.id,
      null,
      greatest((new.due_date::timestamp at time zone 'UTC') - interval '9 hours', now())
    );
  end if;

  return new;
end;
$$;

drop trigger if exists workspace_tasks_queue_push on public.workspace_tasks;
create trigger workspace_tasks_queue_push
after insert or update of due_date, status, assignment_status on public.workspace_tasks
for each row execute function public.queue_workspace_task_push();

create or replace function public.queue_workspace_event_push()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  event_time timestamptz;
begin
  event_time := (new.event_date::timestamp + coalesce(new.start_time, '09:00'::time)) at time zone 'UTC';
  perform private.queue_workspace_notification(
    new.user_id,
    'calendar_event',
    'Evento próximo',
    new.title,
    '/staff-dashboard.html#trabajo',
    'workspace-event-' || new.id::text,
    null,
    new.id,
    greatest(event_time - interval '1 hour', now())
  );
  return new;
end;
$$;

drop trigger if exists workspace_events_queue_push on public.workspace_events;
create trigger workspace_events_queue_push
after insert or update of event_date, start_time, title on public.workspace_events
for each row execute function public.queue_workspace_event_push();

drop function if exists public.claim_workspace_push_notifications(integer);

create or replace function public.claim_workspace_push_notifications(batch_size integer default 25)
returns table (
  notification_id uuid,
  user_id uuid,
  notification_type text,
  title text,
  body text,
  target_url text,
  tag text,
  subscription_id uuid,
  endpoint text,
  p256dh text,
  auth text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  with picked as (
    select q.id
    from public.workspace_notification_queue q
    where q.status = 'pending'
      and q.notify_at <= now()
      and q.attempts < 5
      and exists (
        select 1
        from public.workspace_push_subscriptions s
        where s.user_id = q.user_id
      )
    order by q.notify_at, q.created_at
    limit least(greatest(batch_size, 1), 100)
    for update skip locked
  ), marked as (
    update public.workspace_notification_queue q
    set status = 'processing', attempts = q.attempts + 1
    from picked
    where q.id = picked.id
    returning q.*
  )
  select
    marked.id,
    marked.user_id,
    marked.notification_type,
    marked.title,
    marked.body,
    marked.target_url,
    marked.tag,
    s.id,
    s.endpoint,
    s.p256dh,
    s.auth
  from marked
  join public.workspace_push_subscriptions s on s.user_id = marked.user_id;
end;
$$;

revoke all on function public.claim_workspace_push_notifications(integer) from public, anon, authenticated;
grant execute on function public.claim_workspace_push_notifications(integer) to service_role;

create or replace function public.mark_workspace_push_notification(notification_id uuid, succeeded boolean, error_message text default '')
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.workspace_notification_queue
  set status = case when succeeded then 'sent' when attempts >= 5 then 'failed' else 'pending' end,
      sent_at = case when succeeded then now() else sent_at end,
      last_error = left(coalesce(error_message, ''), 500)
  where id = notification_id;
end;
$$;

revoke all on function public.mark_workspace_push_notification(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.mark_workspace_push_notification(uuid, boolean, text) to service_role;
