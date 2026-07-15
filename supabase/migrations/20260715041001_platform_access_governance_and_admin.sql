-- Canonical platform access governance and staff administration read/write models.
-- Browser clients never receive direct access to the internal license tables.

insert into public.platform_permissions (key, description)
values
  ('map.release.manage', 'Approve and publish MAP releases.'),
  ('platform.licenses.read', 'Read platform licenses and assignments.'),
  ('platform.evaluations.manage', 'Manage MAP evaluation cohorts and participants.'),
  ('platform.permissions.manage', 'Manage internal platform roles and permissions.'),
  ('platform.analytics.read', 'Read sanitized MAP adoption and license analytics.')
on conflict (key) do update set description = excluded.description;

insert into public.platform_roles (key, display_name, role_kind)
values
  ('internal.license.manager', 'MAP license manager', 'internal'),
  ('internal.maps.developer', 'MAP developer', 'internal'),
  ('internal.maps.release.manager', 'MAP release manager', 'internal'),
  ('internal.product.analyst', 'MAP product analyst', 'internal')
on conflict (key) do update set display_name = excluded.display_name;

-- Generic staff access is not developer access. Developer and release access
-- are synchronized from the explicit staff_roles values on profiles.
delete from public.platform_role_permissions
where role_key = 'internal.staff'
  and permission_key = 'map.dev.access';

insert into public.platform_role_permissions (role_key, permission_key)
values
  ('internal.admin', 'map.dev.access'),
  ('internal.admin', 'map.release.manage'),
  ('internal.admin', 'platform.licenses.read'),
  ('internal.admin', 'platform.licenses.manage'),
  ('internal.admin', 'platform.evaluations.manage'),
  ('internal.admin', 'platform.permissions.manage'),
  ('internal.admin', 'platform.analytics.read'),
  ('internal.license.manager', 'platform.licenses.read'),
  ('internal.license.manager', 'platform.licenses.manage'),
  ('internal.license.manager', 'platform.evaluations.manage'),
  ('internal.license.manager', 'platform.analytics.read'),
  ('internal.maps.developer', 'map.dev.access'),
  ('internal.maps.release.manager', 'map.dev.access'),
  ('internal.maps.release.manager', 'map.release.manage'),
  ('internal.product.analyst', 'platform.licenses.read'),
  ('internal.product.analyst', 'platform.analytics.read')
on conflict do nothing;

create or replace function private.sync_platform_internal_role()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  desired_roles text[] := '{}'::text[];
  desired_role text;
begin
  if new.role = 'admin' then
    desired_roles := array['internal.admin'];
  elsif new.role = 'staff' then
    desired_roles := array['internal.staff'];
    if 'maps_developer' = any(coalesce(new.staff_roles, '{}'::text[])) then
      desired_roles := array_append(desired_roles, 'internal.maps.developer');
    end if;
    if 'maps_release_manager' = any(coalesce(new.staff_roles, '{}'::text[])) then
      desired_roles := array_append(desired_roles, 'internal.maps.release.manager');
    end if;
  end if;

  update public.platform_user_roles
  set revoked_at = now()
  where user_id = new.id
    and source = 'profile-sync'
    and revoked_at is null
    and not (role_key = any(desired_roles));

  foreach desired_role in array desired_roles loop
    insert into public.platform_user_roles (user_id, role_key, source)
    values (new.id, desired_role, 'profile-sync')
    on conflict (user_id, role_key) where revoked_at is null do nothing;
  end loop;

  return new;
end;
$$;

revoke all on function private.sync_platform_internal_role() from public, anon, authenticated;

drop trigger if exists sync_platform_internal_role on public.profiles;
create trigger sync_platform_internal_role
after insert or update of role, staff_roles on public.profiles
for each row execute function private.sync_platform_internal_role();

-- Backfill the normalized platform roles through the same trigger contract.
update public.profiles set staff_roles = staff_roles;

create or replace function private.require_platform_permission(
  p_actor_id uuid,
  p_permission_key text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_actor_id is null or not exists (
    select 1
    from public.platform_user_roles user_role
    join public.platform_role_permissions role_permission
      on role_permission.role_key = user_role.role_key
    where user_role.user_id = p_actor_id
      and user_role.revoked_at is null
      and role_permission.permission_key = p_permission_key
  ) then
    raise exception 'The actor is not allowed to perform this platform operation';
  end if;
end;
$$;

revoke all on function private.require_platform_permission(uuid, text) from public, anon, authenticated;
grant execute on function private.require_platform_permission(uuid, text) to service_role;

create or replace function private.require_license_manager(p_actor_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform private.require_platform_permission(p_actor_id, 'platform.licenses.manage');
end;
$$;

revoke all on function private.require_license_manager(uuid) from public, anon, authenticated;
grant execute on function private.require_license_manager(uuid) to service_role;

-- Foreign keys are not indexed automatically by Postgres. These indexes cover
-- joins, revocations and ON DELETE checks used by the staff dashboard.
create index if not exists evaluation_access_events_actor_id_idx on public.evaluation_access_events (actor_id);
create index if not exists evaluation_access_events_license_id_idx on public.evaluation_access_events (license_id);
create index if not exists evaluation_access_events_user_id_idx on public.evaluation_access_events (user_id);
create index if not exists evaluation_cohort_members_invited_by_idx on public.evaluation_cohort_members (invited_by);
create index if not exists evaluation_cohorts_created_by_idx on public.evaluation_cohorts (created_by);
create index if not exists evaluation_cohorts_product_key_idx on public.evaluation_cohorts (product_key);
create index if not exists license_account_members_added_by_idx on public.license_account_members (added_by);
create index if not exists license_account_members_user_id_idx on public.license_account_members (user_id);
create index if not exists license_assignments_assigned_by_idx on public.license_assignments (assigned_by);
create index if not exists license_plan_capabilities_capability_key_idx on public.license_plan_capabilities (capability_key);
create index if not exists license_plans_license_type_key_idx on public.license_plans (license_type_key);
create index if not exists platform_capabilities_product_key_idx on public.platform_capabilities (product_key);
create index if not exists platform_licenses_issued_by_idx on public.platform_licenses (issued_by);
create index if not exists platform_licenses_plan_id_idx on public.platform_licenses (plan_id);
create index if not exists platform_role_permissions_permission_key_idx on public.platform_role_permissions (permission_key);
create index if not exists platform_user_roles_granted_by_idx on public.platform_user_roles (granted_by);
create index if not exists platform_user_roles_role_key_idx on public.platform_user_roles (role_key);

create or replace function private.validate_license_assignment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  allowed_seats integer;
  active_assignments integer;
  target_account_id uuid;
  target_product_key text;
  evaluation_cohort_uuid uuid;
begin
  if new.unassigned_at is not null then return new; end if;

  select license.seat_limit, license.account_id, plan.product_key, license.evaluation_cohort_id
  into allowed_seats, target_account_id, target_product_key, evaluation_cohort_uuid
  from public.platform_licenses license
  join public.license_plans plan on plan.id = license.plan_id
  where license.id = new.license_id
    and license.status = 'active'
    and license.starts_at <= now()
    and (license.ends_at is null or license.ends_at > now())
  for update of license;

  if allowed_seats is null then raise exception 'A license assignment requires an active license'; end if;

  -- Serialize all concurrent assignments for one user, including assignments
  -- made against different licenses of the same product.
  perform 1 from auth.users where id = new.user_id for update;
  if not found then raise exception 'The assigned user does not exist'; end if;

  if not exists (
    select 1 from public.license_account_members member
    where member.account_id = target_account_id
      and member.user_id = new.user_id
      and member.revoked_at is null
  ) then
    raise exception 'The assigned user is not a member of the license account';
  end if;

  if evaluation_cohort_uuid is not null and not exists (
    select 1 from public.evaluation_cohort_members member
    where member.cohort_id = evaluation_cohort_uuid
      and member.user_id = new.user_id
      and member.status in ('invited', 'active')
  ) then
    raise exception 'An evaluation license can only be assigned to a participant of its cohort';
  end if;

  if exists (
    select 1
    from public.license_assignments assignment
    join public.platform_licenses license on license.id = assignment.license_id
    join public.license_plans plan on plan.id = license.plan_id
    where assignment.user_id = new.user_id
      and assignment.unassigned_at is null
      and assignment.id is distinct from new.id
      and plan.product_key = target_product_key
      and license.status = 'active'
      and license.starts_at <= now()
      and (license.ends_at is null or license.ends_at > now())
  ) then
    raise exception 'The user already has an active license for this product';
  end if;

  select count(*) into active_assignments
  from public.license_assignments assignment
  where assignment.license_id = new.license_id
    and assignment.unassigned_at is null
    and assignment.id is distinct from new.id;
  if active_assignments >= allowed_seats then raise exception 'The license has no remaining seats'; end if;
  return new;
end;
$$;

revoke all on function private.validate_license_assignment() from public, anon, authenticated;

create or replace function private.get_platform_admin_overview(p_actor_id uuid)
returns table (
  total_licenses bigint,
  active_licenses bigint,
  expiring_licenses bigint,
  assigned_seats bigint,
  available_seats bigint,
  active_evaluation_cohorts bigint,
  evaluation_participants bigint,
  evaluation_events_30d bigint
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform private.require_platform_permission(p_actor_id, 'platform.licenses.read');
  return query
  select
    count(*)::bigint,
    count(*) filter (
      where license.status = 'active'
        and license.starts_at <= now()
        and (license.ends_at is null or license.ends_at > now())
    )::bigint,
    count(*) filter (
      where license.status = 'active'
        and license.ends_at > now()
        and license.ends_at <= now() + interval '30 days'
    )::bigint,
    coalesce(sum(seats.assigned_count), 0)::bigint,
    coalesce(sum(greatest(license.seat_limit - seats.assigned_count, 0)), 0)::bigint,
    (select count(*) from public.evaluation_cohorts cohort
      where cohort.status = 'active' and cohort.starts_at <= now() and cohort.ends_at > now())::bigint,
    (select count(*) from public.evaluation_cohort_members member
      where member.status in ('invited', 'active'))::bigint,
    (select count(*) from public.evaluation_access_events event
      where event.occurred_at >= now() - interval '30 days')::bigint
  from public.platform_licenses license
  cross join lateral (
    select count(*)::integer as assigned_count
    from public.license_assignments assignment
    where assignment.license_id = license.id and assignment.unassigned_at is null
  ) seats;
end;
$$;

revoke all on function private.get_platform_admin_overview(uuid) from public, anon, authenticated;
grant execute on function private.get_platform_admin_overview(uuid) to service_role;

create or replace function public.get_platform_admin_overview(p_actor_id uuid)
returns table (
  total_licenses bigint,
  active_licenses bigint,
  expiring_licenses bigint,
  assigned_seats bigint,
  available_seats bigint,
  active_evaluation_cohorts bigint,
  evaluation_participants bigint,
  evaluation_events_30d bigint
)
language sql
security invoker
set search_path = public, pg_temp
as $$ select * from private.get_platform_admin_overview(p_actor_id); $$;

revoke all on function public.get_platform_admin_overview(uuid) from public, anon, authenticated;
grant execute on function public.get_platform_admin_overview(uuid) to service_role;

create or replace function private.list_platform_licenses(
  p_actor_id uuid,
  p_limit integer default 100
)
returns table (
  license_id uuid,
  account_id uuid,
  account_name text,
  product_key text,
  plan_name text,
  license_type text,
  license_status text,
  license_source text,
  seat_limit integer,
  assigned_seats bigint,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform private.require_platform_permission(p_actor_id, 'platform.licenses.read');
  return query
  select
    license.id,
    account.id,
    account.display_name,
    plan.product_key,
    plan.display_name,
    plan.license_type_key,
    license.status,
    license.source,
    license.seat_limit,
    count(assignment.id) filter (where assignment.unassigned_at is null)::bigint,
    license.starts_at,
    license.ends_at,
    license.created_at
  from public.platform_licenses license
  join public.license_accounts account on account.id = license.account_id
  join public.license_plans plan on plan.id = license.plan_id
  left join public.license_assignments assignment on assignment.license_id = license.id
  group by license.id, account.id, plan.id
  order by license.created_at desc, license.id desc
  limit greatest(1, least(coalesce(p_limit, 100), 250));
end;
$$;

revoke all on function private.list_platform_licenses(uuid, integer) from public, anon, authenticated;
grant execute on function private.list_platform_licenses(uuid, integer) to service_role;

create or replace function public.list_platform_licenses(
  p_actor_id uuid,
  p_limit integer default 100
)
returns table (
  license_id uuid,
  account_id uuid,
  account_name text,
  product_key text,
  plan_name text,
  license_type text,
  license_status text,
  license_source text,
  seat_limit integer,
  assigned_seats bigint,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz
)
language sql
security invoker
set search_path = public, pg_temp
as $$ select * from private.list_platform_licenses(p_actor_id, p_limit); $$;

revoke all on function public.list_platform_licenses(uuid, integer) from public, anon, authenticated;
grant execute on function public.list_platform_licenses(uuid, integer) to service_role;

create or replace function private.list_platform_license_accounts(p_actor_id uuid)
returns table (account_id uuid, display_name text, account_kind text, account_status text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform private.require_platform_permission(p_actor_id, 'platform.licenses.read');
  return query
  select account.id, account.display_name, account.account_kind, account.status
  from public.license_accounts account
  order by account.display_name, account.id;
end;
$$;

revoke all on function private.list_platform_license_accounts(uuid) from public, anon, authenticated;
grant execute on function private.list_platform_license_accounts(uuid) to service_role;

create or replace function public.list_platform_license_accounts(p_actor_id uuid)
returns table (account_id uuid, display_name text, account_kind text, account_status text)
language sql security invoker set search_path = public, pg_temp
as $$ select * from private.list_platform_license_accounts(p_actor_id); $$;

revoke all on function public.list_platform_license_accounts(uuid) from public, anon, authenticated;
grant execute on function public.list_platform_license_accounts(uuid) to service_role;

create or replace function private.list_platform_license_plans(p_actor_id uuid)
returns table (
  plan_id uuid,
  product_key text,
  plan_name text,
  license_type text,
  is_evaluation boolean,
  default_seat_limit integer,
  default_duration_days integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform private.require_platform_permission(p_actor_id, 'platform.licenses.read');
  return query
  select plan.id, plan.product_key, plan.display_name, plan.license_type_key,
    license_type.is_evaluation, plan.default_seat_limit, plan.default_duration_days
  from public.license_plans plan
  join public.license_types license_type on license_type.key = plan.license_type_key
  where plan.is_active
  order by plan.product_key, license_type.is_evaluation, plan.display_name;
end;
$$;

revoke all on function private.list_platform_license_plans(uuid) from public, anon, authenticated;
grant execute on function private.list_platform_license_plans(uuid) to service_role;

create or replace function public.list_platform_license_plans(p_actor_id uuid)
returns table (
  plan_id uuid,
  product_key text,
  plan_name text,
  license_type text,
  is_evaluation boolean,
  default_seat_limit integer,
  default_duration_days integer
)
language sql security invoker set search_path = public, pg_temp
as $$ select * from private.list_platform_license_plans(p_actor_id); $$;

revoke all on function public.list_platform_license_plans(uuid) from public, anon, authenticated;
grant execute on function public.list_platform_license_plans(uuid) to service_role;

create or replace function private.list_platform_license_users(p_actor_id uuid)
returns table (user_id uuid, email text, display_name text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform private.require_platform_permission(p_actor_id, 'platform.licenses.read');
  return query
  select profile.id, profile.email,
    coalesce(nullif(profile.display_name, ''), nullif(profile.full_name, ''), profile.email)
  from public.profiles profile
  order by profile.email, profile.id;
end;
$$;

revoke all on function private.list_platform_license_users(uuid) from public, anon, authenticated;
grant execute on function private.list_platform_license_users(uuid) to service_role;

create or replace function public.list_platform_license_users(p_actor_id uuid)
returns table (user_id uuid, email text, display_name text)
language sql security invoker set search_path = public, pg_temp
as $$ select * from private.list_platform_license_users(p_actor_id); $$;

revoke all on function public.list_platform_license_users(uuid) from public, anon, authenticated;
grant execute on function public.list_platform_license_users(uuid) to service_role;

create or replace function private.list_platform_access_users(p_actor_id uuid)
returns table (
  user_id uuid,
  email text,
  display_name text,
  base_role text,
  staff_roles text[],
  platform_roles text[],
  platform_permissions text[]
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform private.require_platform_permission(p_actor_id, 'platform.permissions.manage');
  return query
  select
    profile.id,
    profile.email,
    coalesce(nullif(profile.display_name, ''), nullif(profile.full_name, ''), profile.email),
    profile.role,
    profile.staff_roles,
    coalesce(array_agg(distinct user_role.role_key) filter (where user_role.role_key is not null), '{}'::text[]),
    coalesce(array_agg(distinct role_permission.permission_key) filter (where role_permission.permission_key is not null), '{}'::text[])
  from public.profiles profile
  left join public.platform_user_roles user_role
    on user_role.user_id = profile.id and user_role.revoked_at is null
  left join public.platform_role_permissions role_permission
    on role_permission.role_key = user_role.role_key
  group by profile.id
  order by profile.email, profile.id;
end;
$$;

revoke all on function private.list_platform_access_users(uuid) from public, anon, authenticated;
grant execute on function private.list_platform_access_users(uuid) to service_role;

create or replace function public.list_platform_access_users(p_actor_id uuid)
returns table (
  user_id uuid,
  email text,
  display_name text,
  base_role text,
  staff_roles text[],
  platform_roles text[],
  platform_permissions text[]
)
language sql security invoker set search_path = public, pg_temp
as $$ select * from private.list_platform_access_users(p_actor_id); $$;

revoke all on function public.list_platform_access_users(uuid) from public, anon, authenticated;
grant execute on function public.list_platform_access_users(uuid) to service_role;

create or replace function private.issue_platform_license(
  p_account_id uuid,
  p_plan_id uuid,
  p_seat_limit integer,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_actor_id uuid
)
returns table (license_id uuid, license_status text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  created_license_id uuid;
begin
  perform private.require_platform_permission(p_actor_id, 'platform.licenses.manage');
  if p_seat_limit < 1 then raise exception 'A license requires at least one seat'; end if;
  if p_ends_at is not null and p_ends_at <= p_starts_at then raise exception 'The license end must be after its start'; end if;
  if exists (
    select 1 from public.license_plans plan
    join public.license_types license_type on license_type.key = plan.license_type_key
    where plan.id = p_plan_id and license_type.is_evaluation
  ) then
    raise exception 'Evaluation licenses must be issued through a cohort';
  end if;
  if not exists (select 1 from public.license_accounts where id = p_account_id and status = 'active') then
    raise exception 'The license account is not active';
  end if;
  if not exists (select 1 from public.license_plans where id = p_plan_id and is_active) then
    raise exception 'The license plan is not active';
  end if;

  insert into public.platform_licenses (
    account_id, plan_id, status, source, seat_limit, starts_at, ends_at, issued_by
  ) values (
    p_account_id, p_plan_id, 'active', 'manual', p_seat_limit,
    coalesce(p_starts_at, now()), p_ends_at, p_actor_id
  ) returning id into created_license_id;

  return query select created_license_id, 'active'::text;
end;
$$;

revoke all on function private.issue_platform_license(uuid, uuid, integer, timestamptz, timestamptz, uuid) from public, anon, authenticated;
grant execute on function private.issue_platform_license(uuid, uuid, integer, timestamptz, timestamptz, uuid) to service_role;

create or replace function public.issue_platform_license(
  p_account_id uuid,
  p_plan_id uuid,
  p_seat_limit integer,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_actor_id uuid
)
returns table (license_id uuid, license_status text)
language sql security invoker set search_path = public, pg_temp
as $$ select * from private.issue_platform_license(p_account_id, p_plan_id, p_seat_limit, p_starts_at, p_ends_at, p_actor_id); $$;

revoke all on function public.issue_platform_license(uuid, uuid, integer, timestamptz, timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.issue_platform_license(uuid, uuid, integer, timestamptz, timestamptz, uuid) to service_role;

create or replace function private.assign_platform_license(
  p_license_id uuid,
  p_user_id uuid,
  p_actor_id uuid
)
returns table (assignment_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_account_id uuid;
  created_assignment_id uuid;
begin
  perform private.require_platform_permission(p_actor_id, 'platform.licenses.manage');
  select license.account_id into target_account_id
  from public.platform_licenses license where license.id = p_license_id;
  if target_account_id is null then raise exception 'The license does not exist'; end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then raise exception 'The user does not exist'; end if;

  insert into public.license_account_members (account_id, user_id, member_role, added_by)
  values (target_account_id, p_user_id, 'member', p_actor_id)
  on conflict (account_id, user_id) where revoked_at is null do nothing;

  insert into public.license_assignments (license_id, user_id, assigned_by)
  values (p_license_id, p_user_id, p_actor_id)
  on conflict (license_id, user_id) where unassigned_at is null do update
    set assigned_by = excluded.assigned_by
  returning id into created_assignment_id;

  return query select created_assignment_id;
end;
$$;

revoke all on function private.assign_platform_license(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function private.assign_platform_license(uuid, uuid, uuid) to service_role;

create or replace function public.assign_platform_license(
  p_license_id uuid,
  p_user_id uuid,
  p_actor_id uuid
)
returns table (assignment_id uuid)
language sql security invoker set search_path = public, pg_temp
as $$ select * from private.assign_platform_license(p_license_id, p_user_id, p_actor_id); $$;

revoke all on function public.assign_platform_license(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.assign_platform_license(uuid, uuid, uuid) to service_role;

create or replace function private.revoke_platform_license(
  p_license_id uuid,
  p_reason text,
  p_actor_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  affected integer;
begin
  perform private.require_platform_permission(p_actor_id, 'platform.licenses.manage');
  update public.platform_licenses
  set status = 'revoked',
      metadata = metadata || jsonb_build_object('revocationReason', left(coalesce(p_reason, ''), 500), 'revokedBy', p_actor_id),
      updated_at = now()
  where id = p_license_id and status <> 'revoked';
  get diagnostics affected = row_count;
  if affected = 0 then raise exception 'The license does not exist or is already revoked'; end if;
  update public.license_assignments set unassigned_at = now()
  where license_id = p_license_id and unassigned_at is null;
  return affected;
end;
$$;

revoke all on function private.revoke_platform_license(uuid, text, uuid) from public, anon, authenticated;
grant execute on function private.revoke_platform_license(uuid, text, uuid) to service_role;

create or replace function public.revoke_platform_license(
  p_license_id uuid,
  p_reason text,
  p_actor_id uuid
)
returns integer
language sql security invoker set search_path = public, pg_temp
as $$ select private.revoke_platform_license(p_license_id, p_reason, p_actor_id); $$;

revoke all on function public.revoke_platform_license(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.revoke_platform_license(uuid, text, uuid) to service_role;

-- Explicit Data API grants for the server-side integration. RLS remains active;
-- only service_role can reach the administration functions and internal tables.
grant select, insert, update on public.platform_licenses, public.license_assignments,
  public.license_accounts, public.license_account_members, public.license_plans,
  public.license_types, public.platform_user_roles, public.platform_role_permissions,
  public.platform_permissions, public.platform_roles, public.profiles,
  public.evaluation_cohorts, public.evaluation_cohort_members, public.evaluation_access_events
to service_role;
