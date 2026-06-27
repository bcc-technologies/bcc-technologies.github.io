-- Run after SUPABASE_AUTH_SETUP.sql.
-- Adds administrator-managed custom roles and per-user custom role assignments.

alter table public.profiles add column if not exists custom_roles text[] not null default '{}';

create table if not exists public.workspace_role_definitions (
  id text primary key,
  key text not null,
  name text not null,
  description text not null default '',
  permissions text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.workspace_role_definitions enable row level security;

create or replace function public.touch_workspace_role_definitions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_workspace_role_definitions_updated_at on public.workspace_role_definitions;
create trigger touch_workspace_role_definitions_updated_at
before update on public.workspace_role_definitions
for each row execute function public.touch_workspace_role_definitions_updated_at();

create or replace function public.current_user_can_manage_users()
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
      and role = 'admin'
  );
$$;

revoke all on function public.current_user_can_manage_users() from public, anon;
grant execute on function public.current_user_can_manage_users() to authenticated, service_role;

drop policy if exists "Admins can read workspace role definitions" on public.workspace_role_definitions;
create policy "Admins can read workspace role definitions"
on public.workspace_role_definitions
for select
to authenticated
using (public.current_user_can_manage_users());

drop policy if exists "Admins can insert workspace role definitions" on public.workspace_role_definitions;
create policy "Admins can insert workspace role definitions"
on public.workspace_role_definitions
for insert
to authenticated
with check (public.current_user_can_manage_users());

drop policy if exists "Admins can update workspace role definitions" on public.workspace_role_definitions;
create policy "Admins can update workspace role definitions"
on public.workspace_role_definitions
for update
to authenticated
using (public.current_user_can_manage_users())
with check (public.current_user_can_manage_users());

drop policy if exists "Admins can delete workspace role definitions" on public.workspace_role_definitions;
create policy "Admins can delete workspace role definitions"
on public.workspace_role_definitions
for delete
to authenticated
using (public.current_user_can_manage_users());

revoke all on public.workspace_role_definitions from public, anon;
grant select, insert, update, delete on public.workspace_role_definitions to authenticated;

create or replace function private.set_user_access(
  target_user_id uuid,
  next_role text,
  next_staff_roles text[] default null,
  next_departments text[] default null,
  next_custom_roles text[] default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller_role text;
  target_role text;
  target_email text;
  active_admin_count integer;
  clean_staff_roles text[] := coalesce(next_staff_roles, '{}'::text[]);
  clean_departments text[] := coalesce(next_departments, '{}'::text[]);
  clean_custom_roles text[] := coalesce(next_custom_roles, '{}'::text[]);
  old_staff_roles text[];
  old_departments text[];
  old_custom_roles text[];
  final_staff_roles text[];
  final_departments text[];
  final_custom_roles text[];
begin
  clean_staff_roles := array(select distinct unnest(clean_staff_roles));
  clean_departments := array(select distinct unnest(clean_departments));
  clean_custom_roles := array(select distinct unnest(clean_custom_roles));

  if next_role not in ('client', 'staff', 'admin') then
    raise exception 'Rol invalido';
  end if;

  if not clean_staff_roles <@ array['author', 'cofounder', 'department_director']::text[] then
    raise exception 'Rol interno invalido';
  end if;

  if not clean_departments <@ array['technology', 'finance', 'operations', 'marketing', 'hr']::text[] then
    raise exception 'Departamento invalido';
  end if;

  if exists (
    select 1
    from unnest(clean_custom_roles) as selected(id)
    left join public.workspace_role_definitions role_def on role_def.id = selected.id
    where role_def.id is null
  ) then
    raise exception 'Rol personalizado invalido';
  end if;

  select role into caller_role
  from public.profiles
  where id = auth.uid();

  if caller_role is distinct from 'admin' then
    raise exception 'Permiso insuficiente';
  end if;

  select role, staff_roles, departments, custom_roles, email
  into target_role, old_staff_roles, old_departments, old_custom_roles, target_email
  from public.profiles
  where id = target_user_id;

  if target_role is null then
    raise exception 'Usuario no encontrado';
  end if;

  if target_user_id = auth.uid() and target_role = 'admin' and next_role <> 'admin' then
    raise exception 'No puedes quitarte tu propio rol de administrador';
  end if;

  select count(*) into active_admin_count
  from public.profiles
  where role = 'admin';

  if target_role = 'admin' and next_role <> 'admin' and active_admin_count <= 1 then
    raise exception 'Debe existir al menos un administrador activo';
  end if;

  final_staff_roles := case when next_role in ('staff', 'admin') then clean_staff_roles else '{}'::text[] end;
  final_departments := case when next_role in ('staff', 'admin') then clean_departments else '{}'::text[] end;
  final_custom_roles := case when next_role in ('staff', 'admin') then clean_custom_roles else '{}'::text[] end;

  update public.profiles
  set role = next_role,
      staff_roles = final_staff_roles,
      departments = final_departments,
      custom_roles = final_custom_roles,
      updated_at = now()
  where id = target_user_id;

  if target_role is distinct from next_role
     or old_staff_roles is distinct from final_staff_roles
     or old_departments is distinct from final_departments
     or old_custom_roles is distinct from final_custom_roles then
    insert into public.access_audit_logs (
      actor_id,
      target_user_id,
      actor_email,
      target_email,
      before_access,
      after_access
    )
    values (
      auth.uid(),
      target_user_id,
      coalesce((select email from public.profiles where id = auth.uid()), ''),
      coalesce(target_email, ''),
      jsonb_build_object('role', target_role, 'staffRoles', old_staff_roles, 'departments', old_departments, 'customRoles', old_custom_roles),
      jsonb_build_object('role', next_role, 'staffRoles', final_staff_roles, 'departments', final_departments, 'customRoles', final_custom_roles)
    );
  end if;
end;
$$;

revoke all on function private.set_user_access(uuid, text, text[], text[], text[]) from public, anon;
grant execute on function private.set_user_access(uuid, text, text[], text[], text[]) to authenticated, service_role;

create or replace function public.set_user_access(
  target_user_id uuid,
  next_role text,
  next_staff_roles text[] default '{}',
  next_departments text[] default '{}',
  next_custom_roles text[] default '{}'
)
returns void
language sql
security invoker
set search_path = public, private, pg_temp
as $$
  select private.set_user_access(target_user_id, next_role, next_staff_roles, next_departments, next_custom_roles);
$$;

grant execute on function public.set_user_access(uuid, text, text[], text[], text[]) to authenticated, service_role;

-- Backward-compatible 4-argument wrappers used by older clients.
create or replace function private.set_user_access(
  target_user_id uuid,
  next_role text,
  next_staff_roles text[] default null,
  next_departments text[] default null
)
returns void
language sql
security definer
set search_path = public, private, pg_temp
as $$
  select private.set_user_access(target_user_id, next_role, next_staff_roles, next_departments, '{}'::text[]);
$$;

revoke all on function private.set_user_access(uuid, text, text[], text[]) from public, anon;
grant execute on function private.set_user_access(uuid, text, text[], text[]) to authenticated, service_role;

create or replace function public.set_user_access(
  target_user_id uuid,
  next_role text,
  next_staff_roles text[] default '{}',
  next_departments text[] default '{}'
)
returns void
language sql
security invoker
set search_path = public, private, pg_temp
as $$
  select private.set_user_access(target_user_id, next_role, next_staff_roles, next_departments, '{}'::text[]);
$$;

grant execute on function public.set_user_access(uuid, text, text[], text[]) to authenticated, service_role;


create or replace function private.remove_deleted_workspace_role_from_profiles()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.profiles
  set custom_roles = array_remove(custom_roles, old.id),
      updated_at = now()
  where custom_roles @> array[old.id]::text[];
  return old;
end;
$$;

revoke all on function private.remove_deleted_workspace_role_from_profiles() from public, anon, authenticated;
grant execute on function private.remove_deleted_workspace_role_from_profiles() to service_role;

drop trigger if exists remove_deleted_workspace_role_from_profiles on public.workspace_role_definitions;
create trigger remove_deleted_workspace_role_from_profiles
after delete on public.workspace_role_definitions
for each row execute function private.remove_deleted_workspace_role_from_profiles();
