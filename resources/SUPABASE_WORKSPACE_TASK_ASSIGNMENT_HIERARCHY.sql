-- Workspace task hierarchy and cross-user assignment/suggestion contract.
-- Run after SUPABASE_AUTH_SETUP.sql, SUPABASE_CUSTOM_ROLES.sql and SUPABASE_WORKSPACE_PRODUCTIVITY.sql.

alter table public.workspace_role_definitions
  add column if not exists hierarchy_level integer not null default 50;

alter table public.workspace_tasks
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists assignee_id uuid references auth.users(id) on delete cascade,
  add column if not exists assignment_mode text not null default 'self',
  add column if not exists assignment_status text not null default 'accepted',
  add column if not exists assignment_note text not null default '',
  add column if not exists responded_at timestamptz;

update public.workspace_tasks
set created_by = coalesce(created_by, user_id),
    assignee_id = coalesce(assignee_id, user_id),
    assignment_mode = coalesce(nullif(assignment_mode, ''), 'self'),
    assignment_status = coalesce(nullif(assignment_status, ''), 'accepted')
where created_by is null
   or assignee_id is null
   or assignment_mode = ''
   or assignment_status = '';

alter table public.workspace_tasks
  alter column created_by set default auth.uid(),
  alter column assignee_id set default auth.uid();

alter table public.workspace_tasks
  alter column created_by set not null,
  alter column assignee_id set not null;

do $$
begin
  alter table public.workspace_role_definitions
    add constraint workspace_role_definitions_hierarchy_level_check check (hierarchy_level between 0 and 100);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.workspace_tasks
    add constraint workspace_tasks_assignment_mode_check check (assignment_mode in ('self', 'assigned', 'suggested'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.workspace_tasks
    add constraint workspace_tasks_assignment_status_check check (assignment_status in ('accepted', 'pending', 'rejected'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.workspace_tasks
    add constraint workspace_tasks_assignment_note_check check (char_length(assignment_note) <= 500);
exception when duplicate_object then null;
end $$;

create index if not exists workspace_tasks_assignment_idx
on public.workspace_tasks (assignee_id, created_by, assignment_mode, assignment_status, created_at desc);

create or replace function private.workspace_profile_hierarchy_level(target_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with profile as (
    select role, staff_roles, custom_roles
    from public.profiles
    where id = target_user_id
  ), levels as (
    select case role when 'admin' then 0 when 'staff' then 50 else 90 end as level
    from profile
    union all
    select case staff_role
      when 'cofounder' then 10
      when 'department_director' then 20
      when 'author' then 40
      else 50
    end
    from profile, unnest(coalesce(staff_roles, array[]::text[])) as staff_role
    union all
    select coalesce(definition.hierarchy_level, 50)
    from profile,
      unnest(coalesce(custom_roles, array[]::text[])) as custom_role
      left join public.workspace_role_definitions definition on definition.id = custom_role
  )
  select coalesce(min(level), 90) from levels;
$$;

revoke all on function private.workspace_profile_hierarchy_level(uuid) from public, anon;
grant execute on function private.workspace_profile_hierarchy_level(uuid) to authenticated, service_role;

create or replace function private.can_create_workspace_task_for(target_user_id uuid, mode text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with actor as (
    select (select auth.uid()) as id, private.workspace_profile_hierarchy_level((select auth.uid())) as level
  ), target as (
    select p.id, private.workspace_profile_hierarchy_level(p.id) as level
    from public.profiles p
    where p.id = target_user_id
      and p.role in ('staff', 'admin')
  )
  select coalesce((
    select case
      when actor.id is null then false
      when target.id = actor.id and mode = 'self' then true
      when actor.level = 0 and target.id <> actor.id and mode = 'assigned' then true
      when actor.level < target.level and mode = 'assigned' then true
      when actor.level = target.level and target.id <> actor.id and mode = 'suggested' then true
      else false
    end
    from actor, target
  ), false);
$$;

revoke all on function private.can_create_workspace_task_for(uuid, text) from public, anon;
grant execute on function private.can_create_workspace_task_for(uuid, text) to authenticated, service_role;

create or replace function public.get_workspace_task_collaborators()
returns table (
  id uuid,
  name text,
  email text,
  role text,
  hierarchy_level integer,
  relation text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with actor as (
    select (select auth.uid()) as id, private.workspace_profile_hierarchy_level((select auth.uid())) as level
  ), candidates as (
    select
      p.id,
      coalesce(nullif(p.display_name, ''), nullif(p.full_name, ''), p.email, 'Cuenta') as name,
      p.email,
      p.role,
      private.workspace_profile_hierarchy_level(p.id) as hierarchy_level
    from public.profiles p, actor
    where p.id <> actor.id
      and p.role in ('staff', 'admin')
  )
  select
    candidates.id,
    candidates.name,
    candidates.email,
    candidates.role,
    candidates.hierarchy_level,
    case
      when actor.level = 0 then 'assign'
      when actor.level < candidates.hierarchy_level then 'assign'
      when actor.level = candidates.hierarchy_level then 'suggest'
      else null
    end as relation
  from candidates, actor
  where actor.id is not null
    and (
      actor.level = 0
      or actor.level < candidates.hierarchy_level
      or actor.level = candidates.hierarchy_level
    )
  order by relation, candidates.hierarchy_level, candidates.name;
$$;

revoke all on function public.get_workspace_task_collaborators() from public, anon;
grant execute on function public.get_workspace_task_collaborators() to authenticated, service_role;

create or replace function public.set_workspace_task_timestamps()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
    if new.assignment_mode = 'self' then
      new.user_id := auth.uid();
      new.assignee_id := auth.uid();
      new.assignment_status := 'accepted';
    else
      new.assignee_id := coalesce(new.assignee_id, new.user_id);
      new.user_id := new.assignee_id;
      if new.assignment_mode = 'assigned' then
        new.assignment_status := 'accepted';
      elsif new.assignment_mode = 'suggested' then
        new.assignment_status := 'pending';
      end if;
    end if;
  else
    new.updated_at := now();
    new.user_id := old.user_id;
    new.assignee_id := old.assignee_id;
    new.created_by := old.created_by;
    new.assignment_mode := old.assignment_mode;

    if new.assignment_status is distinct from old.assignment_status then
      if old.assignment_mode = 'suggested'
        and old.assignment_status = 'pending'
        and auth.uid() = old.assignee_id
        and new.assignment_status in ('accepted', 'rejected') then
        new.responded_at := now();
      else
        new.assignment_status := old.assignment_status;
        new.responded_at := old.responded_at;
      end if;
    end if;
  end if;

  if new.status = 'done' and (tg_op = 'INSERT' or old.status is distinct from 'done' or new.completed_at is null) then
    new.completed_at = now();
  elsif new.status <> 'done' then
    new.completed_at = null;
  end if;
  return new;
end;
$$;

revoke all on function public.set_workspace_task_timestamps() from public, anon, authenticated;

drop policy if exists "Users can read own workspace tasks" on public.workspace_tasks;
drop policy if exists "Users can create own workspace tasks" on public.workspace_tasks;
drop policy if exists "Users can update own workspace tasks" on public.workspace_tasks;
drop policy if exists "Users can delete own workspace tasks" on public.workspace_tasks;

drop policy if exists "Participants can read workspace tasks" on public.workspace_tasks;
create policy "Participants can read workspace tasks"
on public.workspace_tasks
for select
to authenticated
using ((select auth.uid()) in (user_id, assignee_id, created_by));

drop policy if exists "Hierarchy can create workspace tasks" on public.workspace_tasks;
create policy "Hierarchy can create workspace tasks"
on public.workspace_tasks
for insert
to authenticated
with check (private.can_create_workspace_task_for(coalesce(assignee_id, user_id), assignment_mode));

drop policy if exists "Participants can update workspace tasks" on public.workspace_tasks;
create policy "Participants can update workspace tasks"
on public.workspace_tasks
for update
to authenticated
using ((select auth.uid()) in (user_id, assignee_id, created_by))
with check ((select auth.uid()) in (user_id, assignee_id, created_by));

drop policy if exists "Participants can delete workspace tasks" on public.workspace_tasks;
create policy "Participants can delete workspace tasks"
on public.workspace_tasks
for delete
to authenticated
using ((select auth.uid()) in (user_id, assignee_id, created_by));

comment on column public.workspace_role_definitions.hierarchy_level is
'Lower values represent higher hierarchy for assignment rules.';

comment on column public.workspace_tasks.assignment_mode is
'self = private task, assigned = direct downward assignment, suggested = peer suggestion requiring acceptance.';

-- Ensure assignment safeguards run for direct inserts as well as updates.
create or replace function public.set_workspace_task_timestamps()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
    if new.assignment_mode = 'self' then
      new.user_id := auth.uid();
      new.assignee_id := auth.uid();
      new.assignment_status := 'accepted';
    else
      new.assignee_id := coalesce(new.assignee_id, new.user_id);
      new.user_id := new.assignee_id;
      if new.assignment_mode = 'assigned' then
        new.assignment_status := 'accepted';
      elsif new.assignment_mode = 'suggested' then
        new.assignment_status := 'pending';
      end if;
    end if;

    if new.status = 'done' then
      new.completed_at := coalesce(new.completed_at, now());
    end if;
    return new;
  end if;

  new.updated_at := now();
  new.user_id := old.user_id;
  new.assignee_id := old.assignee_id;
  new.created_by := old.created_by;
  new.assignment_mode := old.assignment_mode;

  if new.assignment_status is distinct from old.assignment_status then
    if old.assignment_mode = 'suggested'
      and old.assignment_status = 'pending'
      and auth.uid() = old.assignee_id
      and new.assignment_status in ('accepted', 'rejected') then
      new.responded_at := now();
    else
      new.assignment_status := old.assignment_status;
      new.responded_at := old.responded_at;
    end if;
  end if;

  if new.status = 'done' and (old.status is distinct from 'done' or new.completed_at is null) then
    new.completed_at := now();
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists workspace_tasks_set_timestamps on public.workspace_tasks;
create trigger workspace_tasks_set_timestamps
before insert or update on public.workspace_tasks
for each row execute function public.set_workspace_task_timestamps();
