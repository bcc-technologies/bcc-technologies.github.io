-- MAP license seat assignments.
-- Prerequisite: SUPABASE_MAP_LICENSES.sql.

create table if not exists public.map_license_assignments (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references public.map_licenses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'revoked')),
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  revoked_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (license_id, user_id),
  check (
    (status = 'active' and revoked_at is null)
    or (status = 'revoked' and revoked_at is not null)
  )
);

create index if not exists map_license_assignments_license_status_idx
  on public.map_license_assignments (license_id, status);
create index if not exists map_license_assignments_user_status_idx
  on public.map_license_assignments (user_id, status);

create or replace function public.sync_map_license_used_seats()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' and new.status = 'active' then
    update public.map_licenses set used_seats = used_seats + 1 where id = new.license_id;
  elsif tg_op = 'DELETE' and old.status = 'active' then
    update public.map_licenses set used_seats = greatest(0, used_seats - 1) where id = old.license_id;
  elsif tg_op = 'UPDATE' and old.status is distinct from new.status then
    update public.map_licenses
    set used_seats = greatest(0, used_seats + case when new.status = 'active' then 1 else -1 end)
    where id = new.license_id;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists sync_map_license_used_seats on public.map_license_assignments;
create trigger sync_map_license_used_seats
after insert or update of status or delete on public.map_license_assignments
for each row execute function public.sync_map_license_used_seats();

revoke all on function public.sync_map_license_used_seats() from public, anon;

alter table public.map_license_assignments enable row level security;

drop policy if exists "licensed staff read assignments" on public.map_license_assignments;
create policy "licensed staff read assignments"
on public.map_license_assignments for select to authenticated
using ((select private.has_license_permission('licenses:view')));

create or replace function private.list_license_assignable_users()
returns table (
  user_id uuid,
  name text,
  email text,
  role text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not private.has_license_permission('licenses:assign') then
    raise exception 'Permiso insuficiente';
  end if;

  return query
  select
    profile.id,
    coalesce(
      nullif(profile.display_name, ''),
      nullif(profile.full_name, ''),
      split_part(profile.email, '@', 1),
      'Usuario'
    ),
    profile.email,
    profile.role
  from public.profiles profile
  order by 2, profile.email;
end;
$$;

create or replace function private.list_map_license_assignments(target_license_id uuid)
returns table (
  id uuid,
  user_id uuid,
  name text,
  email text,
  status text,
  assigned_at timestamptz,
  revoked_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not private.has_license_permission('licenses:view') then
    raise exception 'Permiso insuficiente';
  end if;
  if not exists (select 1 from public.map_licenses where map_licenses.id = target_license_id) then
    raise exception 'Licencia no encontrada';
  end if;

  return query
  select
    assignment.id,
    assignment.user_id,
    coalesce(
      nullif(profile.display_name, ''),
      nullif(profile.full_name, ''),
      split_part(profile.email, '@', 1),
      'Usuario'
    ),
    profile.email,
    assignment.status,
    assignment.assigned_at,
    assignment.revoked_at
  from public.map_license_assignments assignment
  join public.profiles profile on profile.id = assignment.user_id
  where assignment.license_id = target_license_id
    and assignment.status = 'active'
  order by assignment.assigned_at;
end;
$$;

create or replace function private.assign_map_license_user(
  target_license_id uuid,
  target_user_id uuid
)
returns table (
  id uuid,
  user_id uuid,
  name text,
  email text,
  status text,
  assigned_at timestamptz,
  revoked_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  license_row public.map_licenses%rowtype;
  target_assignment_id uuid;
begin
  if not private.has_license_permission('licenses:assign') then
    raise exception 'Permiso insuficiente';
  end if;

  select *
  into license_row
  from public.map_licenses
  where map_licenses.id = target_license_id
  for update;

  if not found then
    raise exception 'Licencia no encontrada';
  end if;
  if license_row.status not in ('trial', 'active', 'grace') then
    raise exception 'La licencia debe estar activa, en prueba o en gracia';
  end if;
  if license_row.used_seats >= license_row.seats then
    raise exception 'No hay asientos disponibles';
  end if;
  if not exists (select 1 from public.profiles where profiles.id = target_user_id) then
    raise exception 'Usuario no encontrado';
  end if;
  if exists (
    select 1
    from public.map_license_assignments
    where license_id = target_license_id
      and user_id = target_user_id
      and status = 'active'
  ) then
    raise exception 'El usuario ya tiene un asiento en esta licencia';
  end if;

  insert into public.map_license_assignments (
    license_id, user_id, status, assigned_by, assigned_at, revoked_at, updated_at
  )
  values (
    target_license_id, target_user_id, 'active', auth.uid(), now(), null, now()
  )
  on conflict (license_id, user_id) do update
  set status = 'active',
      assigned_by = auth.uid(),
      assigned_at = now(),
      revoked_at = null,
      updated_at = now()
  returning map_license_assignments.id into target_assignment_id;


  insert into public.map_license_events (
    license_id, actor_id, event_type, after_state
  )
  values (
    target_license_id,
    auth.uid(),
    'license.seat_assigned',
    jsonb_build_object('assignmentId', target_assignment_id, 'userId', target_user_id)
  );

  return query
  select
    assignment.id,
    assignment.user_id,
    coalesce(
      nullif(profile.display_name, ''),
      nullif(profile.full_name, ''),
      split_part(profile.email, '@', 1),
      'Usuario'
    ),
    profile.email,
    assignment.status,
    assignment.assigned_at,
    assignment.revoked_at
  from public.map_license_assignments assignment
  join public.profiles profile on profile.id = assignment.user_id
  where assignment.id = target_assignment_id;
end;
$$;

create or replace function private.revoke_map_license_user(
  target_license_id uuid,
  target_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_assignment_id uuid;
begin
  if not private.has_license_permission('licenses:assign') then
    raise exception 'Permiso insuficiente';
  end if;

  perform 1
  from public.map_licenses
  where map_licenses.id = target_license_id
  for update;

  if not found then
    raise exception 'Licencia no encontrada';
  end if;

  update public.map_license_assignments
  set status = 'revoked',
      revoked_at = now(),
      updated_at = now()
  where license_id = target_license_id
    and user_id = target_user_id
    and status = 'active'
  returning map_license_assignments.id into target_assignment_id;

  if not found then
    raise exception 'Asignación no encontrada';
  end if;


  insert into public.map_license_events (
    license_id, actor_id, event_type, before_state
  )
  values (
    target_license_id,
    auth.uid(),
    'license.seat_revoked',
    jsonb_build_object('assignmentId', target_assignment_id, 'userId', target_user_id)
  );
end;
$$;

create or replace function public.list_license_assignable_users()
returns table (user_id uuid, name text, email text, role text)
language sql
stable
security invoker
set search_path = public, private, pg_temp
as $$
  select * from private.list_license_assignable_users();
$$;

create or replace function public.list_map_license_assignments(target_license_id uuid)
returns table (
  id uuid,
  user_id uuid,
  name text,
  email text,
  status text,
  assigned_at timestamptz,
  revoked_at timestamptz
)
language sql
stable
security invoker
set search_path = public, private, pg_temp
as $$
  select * from private.list_map_license_assignments(target_license_id);
$$;

create or replace function public.assign_map_license_user(
  target_license_id uuid,
  target_user_id uuid
)
returns table (
  id uuid,
  user_id uuid,
  name text,
  email text,
  status text,
  assigned_at timestamptz,
  revoked_at timestamptz
)
language sql
security invoker
set search_path = public, private, pg_temp
as $$
  select * from private.assign_map_license_user(target_license_id, target_user_id);
$$;

create or replace function public.revoke_map_license_user(
  target_license_id uuid,
  target_user_id uuid
)
returns void
language sql
security invoker
set search_path = public, private, pg_temp
as $$
  select private.revoke_map_license_user(target_license_id, target_user_id);
$$;

revoke all on function private.list_license_assignable_users() from public, anon;
revoke all on function private.list_map_license_assignments(uuid) from public, anon;
revoke all on function private.assign_map_license_user(uuid, uuid) from public, anon;
revoke all on function private.revoke_map_license_user(uuid, uuid) from public, anon;

grant execute on function private.list_license_assignable_users() to authenticated, service_role;
grant execute on function private.list_map_license_assignments(uuid) to authenticated, service_role;
grant execute on function private.assign_map_license_user(uuid, uuid) to authenticated, service_role;
grant execute on function private.revoke_map_license_user(uuid, uuid) to authenticated, service_role;

revoke all on function public.list_license_assignable_users() from public, anon;
revoke all on function public.list_map_license_assignments(uuid) from public, anon;
revoke all on function public.assign_map_license_user(uuid, uuid) from public, anon;
revoke all on function public.revoke_map_license_user(uuid, uuid) from public, anon;
revoke all on public.map_license_assignments from public, anon;

grant select on public.map_license_assignments to authenticated;
grant execute on function public.list_license_assignable_users() to authenticated, service_role;
grant execute on function public.list_map_license_assignments(uuid) to authenticated, service_role;
grant execute on function public.assign_map_license_user(uuid, uuid) to authenticated, service_role;
grant execute on function public.revoke_map_license_user(uuid, uuid) to authenticated, service_role;
