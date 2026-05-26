-- BCC Workspace private productivity module for Supabase.
-- Run after SUPABASE_AUTH_SETUP.sql in the Supabase SQL Editor.

create table if not exists public.workspace_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  description text not null default '',
  status text not null default 'backlog',
  priority text not null default 'medium',
  due_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspace_tasks_title_check check (char_length(btrim(title)) between 1 and 160),
  constraint workspace_tasks_description_check check (char_length(description) <= 500),
  constraint workspace_tasks_status_check check (status in ('backlog', 'in_progress', 'done')),
  constraint workspace_tasks_priority_check check (priority in ('low', 'medium', 'high'))
);

create index if not exists workspace_tasks_user_status_due_idx
on public.workspace_tasks (user_id, status, due_date, created_at desc);

create or replace function public.set_workspace_task_timestamps()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  if new.status = 'done' and (old.status is distinct from 'done' or new.completed_at is null) then
    new.completed_at = now();
  elsif new.status <> 'done' then
    new.completed_at = null;
  end if;
  return new;
end;
$$;

revoke all on function public.set_workspace_task_timestamps() from public, anon, authenticated;

drop trigger if exists workspace_tasks_set_timestamps on public.workspace_tasks;
create trigger workspace_tasks_set_timestamps
before update on public.workspace_tasks
for each row execute function public.set_workspace_task_timestamps();

alter table public.workspace_tasks enable row level security;

revoke all on public.workspace_tasks from public, anon;
grant select, insert, update, delete on public.workspace_tasks to authenticated;

drop policy if exists "Users can read own workspace tasks" on public.workspace_tasks;
create policy "Users can read own workspace tasks"
on public.workspace_tasks
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create own workspace tasks" on public.workspace_tasks;
create policy "Users can create own workspace tasks"
on public.workspace_tasks
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own workspace tasks" on public.workspace_tasks;
create policy "Users can update own workspace tasks"
on public.workspace_tasks
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own workspace tasks" on public.workspace_tasks;
create policy "Users can delete own workspace tasks"
on public.workspace_tasks
for delete
to authenticated
using ((select auth.uid()) = user_id);

comment on table public.workspace_tasks is
'Private per-user task tracking for dashboards. No cross-user reporting is exposed to client sessions.';
