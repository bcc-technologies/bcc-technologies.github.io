-- Workspace calendar events for the staff dashboard.
-- Apply in Supabase after task productivity resources are available.

create table if not exists public.workspace_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  type text not null default 'meeting',
  event_date date not null,
  start_time time,
  end_time time,
  description text not null default '',
  location text not null default '',
  link text not null default '',
  visibility text not null default 'private',
  related_task_id uuid references public.workspace_tasks(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspace_events_title_check check (char_length(btrim(title)) between 1 and 160),
  constraint workspace_events_type_check check (type in ('meeting', 'call', 'milestone', 'blocker', 'reminder', 'availability', 'review')),
  constraint workspace_events_description_check check (char_length(description) <= 700),
  constraint workspace_events_location_check check (char_length(location) <= 180),
  constraint workspace_events_link_check check (char_length(link) <= 300),
  constraint workspace_events_visibility_check check (visibility in ('private', 'team', 'client')),
  constraint workspace_events_time_check check (end_time is null or start_time is null or end_time >= start_time)
);

create index if not exists workspace_events_user_date_idx
on public.workspace_events (user_id, event_date, start_time, created_at desc);

create or replace function public.set_workspace_event_timestamps()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_workspace_event_timestamps() from public, anon, authenticated;

drop trigger if exists workspace_events_set_timestamps on public.workspace_events;
create trigger workspace_events_set_timestamps
before update on public.workspace_events
for each row execute function public.set_workspace_event_timestamps();

alter table public.workspace_events enable row level security;

revoke all on public.workspace_events from public, anon;
grant select, insert, update, delete on public.workspace_events to authenticated;

drop policy if exists "Users can read own workspace events" on public.workspace_events;
create policy "Users can read own workspace events"
on public.workspace_events
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create own workspace events" on public.workspace_events;
create policy "Users can create own workspace events"
on public.workspace_events
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own workspace events" on public.workspace_events;
create policy "Users can update own workspace events"
on public.workspace_events
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own workspace events" on public.workspace_events;
create policy "Users can delete own workspace events"
on public.workspace_events
for delete
to authenticated
using ((select auth.uid()) = user_id);

comment on table public.workspace_events is
'Private per-user calendar events for staff workspace agendas.';
