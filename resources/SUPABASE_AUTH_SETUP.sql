-- BCC Technologies account system for Supabase.
-- Run this in Supabase SQL Editor after creating the project.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  full_name text not null default '',
  first_name text not null default '',
  middle_names text not null default '',
  first_last_name text not null default '',
  second_last_name text not null default '',
  display_name text not null default '',
  company text not null default '',
  title text not null default '',
  role text not null default 'client' check (role in ('client', 'staff', 'admin')),
  staff_roles text[] not null default '{}',
  departments text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.access_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  actor_email text not null default '',
  target_email text not null default '',
  before_access jsonb not null default '{}'::jsonb,
  after_access jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.account_emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  is_primary boolean not null default false,
  is_confirmed boolean not null default false,
  confirmation_token text not null default '',
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create unique index if not exists account_emails_user_email_key
on public.account_emails (user_id, email);

create unique index if not exists account_emails_email_key
on public.account_emails (email);

create unique index if not exists account_emails_one_primary_per_user
on public.account_emails (user_id)
where is_primary;

alter table public.profiles add column if not exists email text not null default '';
alter table public.profiles add column if not exists full_name text not null default '';
alter table public.profiles add column if not exists first_name text not null default '';
alter table public.profiles add column if not exists middle_names text not null default '';
alter table public.profiles add column if not exists first_last_name text not null default '';
alter table public.profiles add column if not exists second_last_name text not null default '';
alter table public.profiles add column if not exists display_name text not null default '';
alter table public.profiles add column if not exists company text not null default '';
alter table public.profiles add column if not exists title text not null default '';
alter table public.profiles add column if not exists role text not null default 'client';
alter table public.profiles add column if not exists staff_roles text[] not null default '{}';
alter table public.profiles add column if not exists departments text[] not null default '{}';
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_role_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
    add constraint profiles_role_check check (role in ('client', 'staff', 'admin'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_staff_roles_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
    add constraint profiles_staff_roles_check
    check (staff_roles <@ array['author', 'cofounder', 'department_director']::text[]);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_departments_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
    add constraint profiles_departments_check
    check (departments <@ array['technology', 'finance', 'operations', 'marketing', 'hr']::text[]);
  end if;
end $$;

alter table public.profiles enable row level security;
alter table public.access_audit_logs enable row level security;
alter table public.account_emails enable row level security;

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon;
grant usage on schema private to authenticated;
grant usage on schema private to service_role;

create or replace function private.is_admin()
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

revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated, service_role;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "Admins can read profiles" on public.profiles;
create policy "Admins can read profiles"
on public.profiles
for select
to authenticated
using (private.is_admin());

drop policy if exists "Admins can read access audit logs" on public.access_audit_logs;
create policy "Admins can read access audit logs"
on public.access_audit_logs
for select
to authenticated
using (private.is_admin());

revoke all on public.access_audit_logs from public, anon, authenticated;
grant select on public.access_audit_logs to authenticated;

revoke all on public.account_emails from public, anon, authenticated;
grant select (id, user_id, email, is_primary, is_confirmed, created_at, confirmed_at) on public.account_emails to authenticated;
grant insert (user_id, email, is_primary, is_confirmed, confirmation_token, confirmed_at) on public.account_emails to authenticated;

drop policy if exists "Users can read own account emails" on public.account_emails;
create policy "Users can read own account emails"
on public.account_emails
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can add own account emails" on public.account_emails;
create policy "Users can add own account emails"
on public.account_emails
for insert
to authenticated
with check (
  auth.uid() = user_id
  and (
    (is_primary = false and is_confirmed = false)
    or (is_primary = true and is_confirmed = true and email = lower(coalesce(auth.jwt()->>'email', '')))
  )
);

drop policy if exists "Users can update own account emails" on public.account_emails;
create policy "Users can update own account emails"
on public.account_emails
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own non-primary account emails" on public.account_emails;
create policy "Users can delete own non-primary account emails"
on public.account_emails
for delete
to authenticated
using (auth.uid() = user_id and is_primary = false);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id and role = 'client');

drop policy if exists "Users can update own non-role profile" on public.profiles;
create policy "Users can update own non-role profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create or replace function private.prevent_unsafe_role_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  active_admin_count integer;
begin
  if (old.role is distinct from new.role
      or old.staff_roles is distinct from new.staff_roles
      or old.departments is distinct from new.departments)
     and not private.is_admin() then
    raise exception 'No puedes cambiar roles directamente';
  end if;

  if old.role is distinct from new.role
     and old.id = auth.uid()
     and old.role = 'admin'
     and new.role <> 'admin' then
    raise exception 'No puedes quitarte tu propio rol de administrador';
  end if;

  if old.role is distinct from new.role
     and old.role = 'admin'
     and new.role <> 'admin' then
    select count(*) into active_admin_count
    from public.profiles
    where role = 'admin';

    if active_admin_count <= 1 then
      raise exception 'Debe existir al menos un administrador activo';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.prevent_unsafe_role_change() from public, anon, authenticated;
grant execute on function private.prevent_unsafe_role_change() to service_role;

drop trigger if exists protect_profile_role_update on public.profiles;
create trigger protect_profile_role_update
before update on public.profiles
for each row execute function private.prevent_unsafe_role_change();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  name text := coalesce(meta->>'full_name', meta->>'name', '');
begin
  -- This trigger must never block auth.users creation. If profile insertion
  -- fails, the fallback exception block below keeps signup alive and the
  -- frontend can create/repair the profile after login.
  insert into public.profiles (
    id,
    email,
    full_name,
    first_name,
    middle_names,
    first_last_name,
    second_last_name,
    display_name,
    company,
    title,
    role,
    staff_roles,
    departments
  )
  values (
    new.id,
    coalesce(new.email, ''),
    name,
    coalesce(meta->>'first_name', split_part(name, ' ', 1), ''),
    coalesce(meta->>'middle_names', ''),
    coalesce(meta->>'first_last_name', ''),
    coalesce(meta->>'second_last_name', ''),
    coalesce(meta->>'display_name', split_part(name, ' ', 1), ''),
    coalesce(meta->>'company', ''),
    coalesce(meta->>'title', ''),
    'client',
    '{}',
    '{}'
  )
  on conflict (id) do nothing;

  insert into public.account_emails (
    user_id,
    email,
    is_primary,
    is_confirmed,
    confirmation_token,
    confirmed_at
  )
  values (
    new.id,
    lower(coalesce(new.email, '')),
    true,
    true,
    '',
    now()
  )
  on conflict (user_id, email) do update
  set is_primary = true,
      is_confirmed = true,
      confirmation_token = '',
      confirmed_at = coalesce(public.account_emails.confirmed_at, now());

  return new;
exception
  when others then
    raise warning 'profiles insert failed for user %: %', new.id, sqlerrm;
    return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;
grant execute on function private.handle_new_user() to service_role;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

create or replace function private.set_user_access(
  target_user_id uuid,
  next_role text,
  next_staff_roles text[] default null,
  next_departments text[] default null
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
  old_staff_roles text[];
  old_departments text[];
  final_staff_roles text[];
  final_departments text[];
begin
  clean_staff_roles := array(select distinct unnest(clean_staff_roles));
  clean_departments := array(select distinct unnest(clean_departments));

  if next_role not in ('client', 'staff', 'admin') then
    raise exception 'Rol invalido';
  end if;

  if not clean_staff_roles <@ array['author', 'cofounder', 'department_director']::text[] then
    raise exception 'Rol interno invalido';
  end if;

  if not clean_departments <@ array['technology', 'finance', 'operations', 'marketing', 'hr']::text[] then
    raise exception 'Departamento invalido';
  end if;

  select role into caller_role
  from public.profiles
  where id = auth.uid();

  if caller_role is distinct from 'admin' then
    raise exception 'Permiso insuficiente';
  end if;

  select role, staff_roles, departments, email
  into target_role, old_staff_roles, old_departments, target_email
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

  update public.profiles
  set role = next_role,
      staff_roles = final_staff_roles,
      departments = final_departments,
      updated_at = now()
  where id = target_user_id;

  if target_role is distinct from next_role
     or old_staff_roles is distinct from final_staff_roles
     or old_departments is distinct from final_departments then
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
      jsonb_build_object('role', target_role, 'staffRoles', old_staff_roles, 'departments', old_departments),
      jsonb_build_object('role', next_role, 'staffRoles', final_staff_roles, 'departments', final_departments)
    );
  end if;
end;
$$;

revoke all on function private.set_user_access(uuid, text, text[], text[]) from public, anon;
grant execute on function private.set_user_access(uuid, text, text[], text[]) to authenticated, service_role;

create or replace function private.set_user_role(target_user_id uuid, next_role text)
returns void
language sql
security definer
set search_path = public, private, pg_temp
as $$
  select private.set_user_access(target_user_id, next_role, null, null);
$$;

revoke all on function private.set_user_role(uuid, text) from public, anon;
grant execute on function private.set_user_role(uuid, text) to authenticated, service_role;

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
  select private.set_user_access(target_user_id, next_role, next_staff_roles, next_departments);
$$;

create or replace function public.set_user_role(target_user_id uuid, next_role text)
returns void
language sql
security invoker
set search_path = public, private, pg_temp
as $$
  select private.set_user_role(target_user_id, next_role);
$$;

create or replace function private.confirm_account_email(target_email text, token text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.account_emails
  set is_confirmed = true,
      confirmation_token = '',
      confirmed_at = now()
  where user_id = auth.uid()
    and email = lower(trim(target_email))
    and is_confirmed = false
    and confirmation_token = token
    and confirmation_token <> '';

  if not found then
    raise exception 'Codigo de confirmacion invalido';
  end if;
end;
$$;

create or replace function private.set_primary_account_email(target_email_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_email text;
begin
  select email into target_email
  from public.account_emails
  where id = target_email_id
    and user_id = auth.uid()
    and is_confirmed = true;

  if target_email is null then
    raise exception 'Confirma el correo antes de hacerlo principal';
  end if;

  update public.account_emails
  set is_primary = false
  where user_id = auth.uid();

  update public.account_emails
  set is_primary = true
  where id = target_email_id
    and user_id = auth.uid();

  update public.profiles
  set email = target_email,
      updated_at = now()
  where id = auth.uid();
end;
$$;

create or replace function private.delete_account_email(target_email_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.account_emails
  where id = target_email_id
    and user_id = auth.uid()
    and is_primary = false;

  if not found then
    raise exception 'No puedes eliminar el correo principal';
  end if;
end;
$$;

create or replace function public.confirm_account_email(target_email text, token text)
returns void
language sql
security invoker
set search_path = public, private, pg_temp
as $$
  select private.confirm_account_email(target_email, token);
$$;

create or replace function public.set_primary_account_email(target_email_id uuid)
returns void
language sql
security invoker
set search_path = public, private, pg_temp
as $$
  select private.set_primary_account_email(target_email_id);
$$;

create or replace function public.delete_account_email(target_email_id uuid)
returns void
language sql
security invoker
set search_path = public, private, pg_temp
as $$
  select private.delete_account_email(target_email_id);
$$;

revoke all on function private.confirm_account_email(text, text) from public, anon, authenticated;
grant execute on function private.confirm_account_email(text, text) to authenticated, service_role;
revoke all on function private.set_primary_account_email(uuid) from public, anon, authenticated;
grant execute on function private.set_primary_account_email(uuid) to authenticated, service_role;
revoke all on function private.delete_account_email(uuid) from public, anon, authenticated;
grant execute on function private.delete_account_email(uuid) to authenticated, service_role;

drop function if exists public.is_admin();
drop function if exists public.prevent_unsafe_role_change();
drop function if exists public.handle_new_user();

revoke all on function public.set_user_role(uuid, text) from public, anon;
grant execute on function public.set_user_role(uuid, text) to authenticated;
revoke all on function public.set_user_access(uuid, text, text[], text[]) from public, anon;
grant execute on function public.set_user_access(uuid, text, text[], text[]) to authenticated;
revoke all on function public.confirm_account_email(text, text) from public, anon;
grant execute on function public.confirm_account_email(text, text) to authenticated;
revoke all on function public.set_primary_account_email(uuid) from public, anon;
grant execute on function public.set_primary_account_email(uuid) to authenticated;
revoke all on function public.delete_account_email(uuid) from public, anon;
grant execute on function public.delete_account_email(uuid) to authenticated;
