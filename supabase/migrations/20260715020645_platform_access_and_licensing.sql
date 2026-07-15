-- BCC platform access and licensing foundation.
--
-- Identity remains in auth.users. This migration deliberately separates:
--   1. internal authorization roles (staff/admin),
--   2. commercial licenses, and
--   3. effective MAP capabilities.
--
-- Run through the Supabase migration workflow. It is additive and does not
-- retire the legacy MAP authentication provider.

create schema if not exists private;

create table if not exists public.platform_permissions (
  key text primary key check (key ~ '^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$'),
  description text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.platform_roles (
  key text primary key check (key ~ '^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$'),
  display_name text not null,
  role_kind text not null check (role_kind in ('internal')),
  created_at timestamptz not null default now()
);

create table if not exists public.platform_role_permissions (
  role_key text not null references public.platform_roles(key) on delete cascade,
  permission_key text not null references public.platform_permissions(key) on delete cascade,
  primary key (role_key, permission_key)
);

create table if not exists public.platform_user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role_key text not null references public.platform_roles(key) on delete restrict,
  source text not null default 'profile-sync' check (source in ('profile-sync', 'manual', 'migration')),
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  check (revoked_at is null or revoked_at >= granted_at)
);

create unique index if not exists platform_user_roles_one_active_role
  on public.platform_user_roles (user_id, role_key)
  where revoked_at is null;

create table if not exists public.platform_products (
  key text primary key check (key ~ '^map\.(nano|bio|med)$'),
  display_name text not null,
  domain text not null unique check (domain in ('nano', 'bio', 'med')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.platform_capabilities (
  key text primary key check (key ~ '^map\.[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$'),
  product_key text references public.platform_products(key) on delete restrict,
  access_kind text not null check (access_kind in ('workspace', 'product', 'developer', 'administration')),
  description text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.license_accounts (
  id uuid primary key default gen_random_uuid(),
  account_kind text not null check (account_kind in ('individual', 'organization')),
  display_name text not null,
  individual_owner_id uuid references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'suspended', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (account_kind = 'individual' and individual_owner_id is not null)
    or (account_kind = 'organization' and individual_owner_id is null)
  )
);

create unique index if not exists license_accounts_one_individual_owner
  on public.license_accounts (individual_owner_id)
  where account_kind = 'individual';

create table if not exists public.license_account_members (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.license_accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  member_role text not null check (member_role in ('owner', 'admin', 'member')),
  added_by uuid references auth.users(id) on delete set null,
  added_at timestamptz not null default now(),
  revoked_at timestamptz,
  check (revoked_at is null or revoked_at >= added_at)
);

create unique index if not exists license_account_members_one_active_membership
  on public.license_account_members (account_id, user_id)
  where revoked_at is null;

create table if not exists public.license_types (
  key text primary key check (key ~ '^[a-z][a-z0-9_]*$'),
  display_name text not null,
  seat_mode text not null check (seat_mode in ('named_user', 'organization')),
  is_evaluation boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.license_plans (
  id uuid primary key default gen_random_uuid(),
  product_key text not null references public.platform_products(key) on delete restrict,
  license_type_key text not null references public.license_types(key) on delete restrict,
  display_name text not null,
  default_seat_limit integer not null default 1 check (default_seat_limit >= 1),
  default_duration_days integer check (default_duration_days is null or default_duration_days >= 1),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_key, license_type_key)
);

create table if not exists public.license_plan_capabilities (
  plan_id uuid not null references public.license_plans(id) on delete cascade,
  capability_key text not null references public.platform_capabilities(key) on delete restrict,
  primary key (plan_id, capability_key)
);

create table if not exists public.platform_licenses (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.license_accounts(id) on delete restrict,
  plan_id uuid not null references public.license_plans(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'active', 'suspended', 'expired', 'revoked')),
  source text not null default 'manual' check (source in ('manual', 'checkout', 'migration', 'internal')),
  external_reference text unique,
  seat_limit integer not null check (seat_limit >= 1),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  issued_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

create index if not exists platform_licenses_active_lookup
  on public.platform_licenses (account_id, status, starts_at, ends_at);

create table if not exists public.license_assignments (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references public.platform_licenses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  unassigned_at timestamptz,
  check (unassigned_at is null or unassigned_at >= assigned_at)
);

create unique index if not exists license_assignments_one_active_assignment
  on public.license_assignments (license_id, user_id)
  where unassigned_at is null;

create index if not exists license_assignments_user_active_lookup
  on public.license_assignments (user_id, license_id)
  where unassigned_at is null;

insert into public.platform_permissions (key, description)
values
  ('map.dev.access', 'Access the MAP developer workspace.'),
  ('map.workspace.access', 'Access an entitled MAP analysis workspace.'),
  ('map.nano.use', 'Use the MAP Nano workspace.'),
  ('map.bio.use', 'Use the MAP Bio workspace.'),
  ('map.med.use', 'Use the MAP Med workspace.'),
  ('platform.licenses.manage', 'Manage platform licenses and assignments.')
on conflict (key) do update set description = excluded.description;

insert into public.platform_roles (key, display_name, role_kind)
values
  ('internal.staff', 'BCC staff', 'internal'),
  ('internal.admin', 'BCC administrator', 'internal')
on conflict (key) do update set display_name = excluded.display_name;

insert into public.platform_role_permissions (role_key, permission_key)
values
  ('internal.staff', 'map.dev.access'),
  ('internal.admin', 'map.dev.access'),
  ('internal.admin', 'platform.licenses.manage')
on conflict do nothing;

insert into public.platform_products (key, display_name, domain)
values
  ('map.nano', 'MAP Nano', 'nano'),
  ('map.bio', 'MAP Bio', 'bio'),
  ('map.med', 'MAP Med', 'med')
on conflict (key) do update set display_name = excluded.display_name, domain = excluded.domain;

insert into public.platform_capabilities (key, product_key, access_kind, description)
values
  ('map.workspace.access', null, 'workspace', 'Access the licensed MAP workspace.'),
  ('map.nano.use', 'map.nano', 'product', 'Use MAP Nano.'),
  ('map.bio.use', 'map.bio', 'product', 'Use MAP Bio.'),
  ('map.med.use', 'map.med', 'product', 'Use MAP Med.')
on conflict (key) do update set
  product_key = excluded.product_key,
  access_kind = excluded.access_kind,
  description = excluded.description;

insert into public.license_types (key, display_name, seat_mode, is_evaluation)
values
  ('evaluation', 'Evaluation', 'named_user', true),
  ('named_user', 'Named user', 'named_user', false),
  ('organization', 'Organization', 'organization', false)
on conflict (key) do update set
  display_name = excluded.display_name,
  seat_mode = excluded.seat_mode,
  is_evaluation = excluded.is_evaluation;

insert into public.license_plans (product_key, license_type_key, display_name, default_seat_limit, default_duration_days)
values
  ('map.nano', 'evaluation', 'MAP Nano evaluation', 1, 30),
  ('map.bio', 'evaluation', 'MAP Bio evaluation', 1, 30),
  ('map.med', 'evaluation', 'MAP Med evaluation', 1, 30),
  ('map.nano', 'named_user', 'MAP Nano named user', 1, null),
  ('map.bio', 'named_user', 'MAP Bio named user', 1, null),
  ('map.med', 'named_user', 'MAP Med named user', 1, null),
  ('map.nano', 'organization', 'MAP Nano organization', 5, null),
  ('map.bio', 'organization', 'MAP Bio organization', 5, null),
  ('map.med', 'organization', 'MAP Med organization', 5, null)
on conflict (product_key, license_type_key) do update set
  display_name = excluded.display_name,
  default_seat_limit = excluded.default_seat_limit,
  default_duration_days = excluded.default_duration_days;

insert into public.license_plan_capabilities (plan_id, capability_key)
select plan.id, capability.key
from public.license_plans plan
join public.platform_capabilities capability
  on capability.key in ('map.workspace.access', plan.product_key || '.use')
on conflict do nothing;

-- The existing web authorization system has profile.role. Keep it as the
-- compatibility source for internal roles while MAP adopts the normalized
-- access tables above.
create or replace function private.sync_platform_internal_role()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  desired_role text;
begin
  desired_role := case new.role
    when 'admin' then 'internal.admin'
    when 'staff' then 'internal.staff'
    else null
  end;

  update public.platform_user_roles
  set revoked_at = now()
  where user_id = new.id
    and source = 'profile-sync'
    and revoked_at is null
    and (desired_role is null or role_key <> desired_role);

  if desired_role is not null then
    insert into public.platform_user_roles (user_id, role_key, source)
    values (new.id, desired_role, 'profile-sync')
    on conflict (user_id, role_key) where revoked_at is null do nothing;
  end if;

  return new;
end;
$$;

revoke all on function private.sync_platform_internal_role() from public, anon, authenticated;

drop trigger if exists sync_platform_internal_role on public.profiles;
create trigger sync_platform_internal_role
after insert or update of role on public.profiles
for each row execute function private.sync_platform_internal_role();

create or replace function private.ensure_individual_license_account()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  account_uuid uuid;
begin
  insert into public.license_accounts (account_kind, display_name, individual_owner_id)
  values (
    'individual',
    coalesce(nullif(btrim(new.display_name), ''), nullif(btrim(new.full_name), ''), new.email),
    new.id
  )
  on conflict (individual_owner_id) where account_kind = 'individual' do update
  set display_name = excluded.display_name,
      updated_at = now()
  returning id into account_uuid;

  insert into public.license_account_members (account_id, user_id, member_role)
  values (account_uuid, new.id, 'owner')
  on conflict (account_id, user_id) where revoked_at is null do nothing;

  return new;
end;
$$;

revoke all on function private.ensure_individual_license_account() from public, anon, authenticated;

drop trigger if exists ensure_individual_license_account on public.profiles;
create trigger ensure_individual_license_account
after insert on public.profiles
for each row execute function private.ensure_individual_license_account();

insert into public.license_accounts (account_kind, display_name, individual_owner_id)
select
  'individual',
  coalesce(nullif(btrim(profile.display_name), ''), nullif(btrim(profile.full_name), ''), profile.email),
  profile.id
from public.profiles profile
on conflict (individual_owner_id) where account_kind = 'individual' do update
set display_name = excluded.display_name,
    updated_at = now();

insert into public.license_account_members (account_id, user_id, member_role)
select account.id, profile.id, 'owner'
from public.profiles profile
join public.license_accounts account
  on account.account_kind = 'individual' and account.individual_owner_id = profile.id
on conflict (account_id, user_id) where revoked_at is null do nothing;

insert into public.platform_user_roles (user_id, role_key, source)
select
  profile.id,
  case profile.role when 'admin' then 'internal.admin' else 'internal.staff' end,
  'profile-sync'
from public.profiles profile
where profile.role in ('staff', 'admin')
on conflict (user_id, role_key) where revoked_at is null do nothing;

create or replace function private.validate_license_assignment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  allowed_seats integer;
  active_assignments integer;
begin
  if new.unassigned_at is not null then
    return new;
  end if;

  select license.seat_limit
  into allowed_seats
  from public.platform_licenses license
  where license.id = new.license_id
    and license.status = 'active'
    and license.starts_at <= now()
    and (license.ends_at is null or license.ends_at > now())
  for update;

  if allowed_seats is null then
    raise exception 'A license assignment requires an active license';
  end if;

  select count(*)
  into active_assignments
  from public.license_assignments assignment
  where assignment.license_id = new.license_id
    and assignment.unassigned_at is null
    and assignment.id is distinct from new.id;

  if active_assignments >= allowed_seats then
    raise exception 'The license has no remaining seats';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_license_assignment() from public, anon, authenticated;

drop trigger if exists validate_license_assignment on public.license_assignments;
create trigger validate_license_assignment
before insert or update of license_id, user_id, unassigned_at on public.license_assignments
for each row execute function private.validate_license_assignment();

create or replace function private.get_current_platform_access()
returns table (
  access_key text,
  access_source text,
  product_key text,
  license_id uuid,
  valid_until timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    role_permission.permission_key,
    'internal_role'::text,
    null::text,
    null::uuid,
    null::timestamptz
  from public.platform_user_roles user_role
  join public.platform_role_permissions role_permission on role_permission.role_key = user_role.role_key
  where user_role.user_id = (select auth.uid())
    and user_role.revoked_at is null

  union

  select
    plan_capability.capability_key,
    'license'::text,
    capability.product_key,
    license.id,
    license.ends_at
  from public.license_assignments assignment
  join public.platform_licenses license on license.id = assignment.license_id
  join public.license_plan_capabilities plan_capability on plan_capability.plan_id = license.plan_id
  join public.platform_capabilities capability on capability.key = plan_capability.capability_key
  where assignment.user_id = (select auth.uid())
    and assignment.unassigned_at is null
    and license.status = 'active'
    and license.starts_at <= now()
    and (license.ends_at is null or license.ends_at > now());
$$;

revoke all on function private.get_current_platform_access() from public, anon, authenticated;
grant execute on function private.get_current_platform_access() to authenticated, service_role;

create or replace function public.get_my_platform_access()
returns table (
  access_key text,
  access_source text,
  product_key text,
  license_id uuid,
  valid_until timestamptz
)
language sql
stable
security invoker
set search_path = public, private, pg_temp
as $$
  select * from private.get_current_platform_access();
$$;

revoke all on function public.get_my_platform_access() from public, anon;
grant execute on function public.get_my_platform_access() to authenticated, service_role;

-- New exposed tables are deny-by-default. The public catalog is readable by
-- authenticated users; licenses, seats, accounts and internal assignments are
-- exposed only through carefully scoped RPCs added in later phases.
alter table public.platform_permissions enable row level security;
alter table public.platform_roles enable row level security;
alter table public.platform_role_permissions enable row level security;
alter table public.platform_user_roles enable row level security;
alter table public.platform_products enable row level security;
alter table public.platform_capabilities enable row level security;
alter table public.license_accounts enable row level security;
alter table public.license_account_members enable row level security;
alter table public.license_types enable row level security;
alter table public.license_plans enable row level security;
alter table public.license_plan_capabilities enable row level security;
alter table public.platform_licenses enable row level security;
alter table public.license_assignments enable row level security;

revoke all on public.platform_permissions, public.platform_roles, public.platform_role_permissions,
  public.platform_user_roles, public.platform_products, public.platform_capabilities,
  public.license_accounts, public.license_account_members, public.license_types,
  public.license_plans, public.license_plan_capabilities, public.platform_licenses,
  public.license_assignments from anon, authenticated;

grant select on public.platform_products, public.platform_capabilities,
  public.license_types, public.license_plans, public.license_plan_capabilities
  to authenticated;

drop policy if exists "Authenticated users read platform products" on public.platform_products;
create policy "Authenticated users read platform products"
on public.platform_products for select to authenticated using (true);

drop policy if exists "Authenticated users read platform capabilities" on public.platform_capabilities;
create policy "Authenticated users read platform capabilities"
on public.platform_capabilities for select to authenticated using (true);

drop policy if exists "Authenticated users read license types" on public.license_types;
create policy "Authenticated users read license types"
on public.license_types for select to authenticated using (true);

drop policy if exists "Authenticated users read active license plans" on public.license_plans;
create policy "Authenticated users read active license plans"
on public.license_plans for select to authenticated using (is_active = true);

drop policy if exists "Authenticated users read active plan capabilities" on public.license_plan_capabilities;
create policy "Authenticated users read active plan capabilities"
on public.license_plan_capabilities for select to authenticated using (
  exists (
    select 1
    from public.license_plans plan
    where plan.id = license_plan_capabilities.plan_id
      and plan.is_active = true
  )
);

-- Legacy MAP-specific staff roles were partially introduced before the profile
-- constraint was updated. Keep the old web UI assignment path valid during the
-- transition; canonical MAP authorization now comes from platform roles.
alter table public.profiles drop constraint if exists profiles_staff_roles_check;
alter table public.profiles add constraint profiles_staff_roles_check
  check (staff_roles <@ array[
    'author', 'cofounder', 'department_director', 'maps_developer', 'maps_release_manager'
  ]::text[]);
