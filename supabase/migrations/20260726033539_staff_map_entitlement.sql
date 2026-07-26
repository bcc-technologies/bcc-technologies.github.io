-- Automatic, non-commercial MAP entitlement for active BCC staff.
-- Developer workspace access remains governed independently by map.dev.access.

create table if not exists public.platform_role_capabilities (
  role_key text not null references public.platform_roles(key) on delete cascade,
  capability_key text not null references public.platform_capabilities(key) on delete cascade,
  primary key (role_key, capability_key)
);

alter table public.platform_role_capabilities enable row level security;

drop policy if exists platform_role_capabilities_deny_direct_access
  on public.platform_role_capabilities;
create policy platform_role_capabilities_deny_direct_access
  on public.platform_role_capabilities
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

revoke all on table public.platform_role_capabilities from public, anon, authenticated;
grant select on table public.platform_role_capabilities to service_role;

insert into public.platform_role_capabilities (role_key, capability_key)
select role.key, capability.key
from public.platform_roles role
cross join public.platform_capabilities capability
where role.key in ('internal.staff', 'internal.admin')
  and capability.key in (
    'map.workspace.access',
    'map.nano.use',
    'map.bio.use',
    'map.med.use'
  )
on conflict do nothing;

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
  join public.platform_role_permissions role_permission
    on role_permission.role_key = user_role.role_key
  where user_role.user_id = (select auth.uid())
    and user_role.revoked_at is null

  union

  select
    role_capability.capability_key,
    'staff_license'::text,
    capability.product_key,
    null::uuid,
    null::timestamptz
  from public.platform_user_roles user_role
  join public.platform_role_capabilities role_capability
    on role_capability.role_key = user_role.role_key
  join public.platform_capabilities capability
    on capability.key = role_capability.capability_key
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
  join public.license_plan_capabilities plan_capability
    on plan_capability.plan_id = license.plan_id
  join public.platform_capabilities capability
    on capability.key = plan_capability.capability_key
  left join public.evaluation_cohorts cohort
    on cohort.id = license.evaluation_cohort_id
  left join public.evaluation_cohort_members member
    on member.cohort_id = cohort.id
   and member.user_id = assignment.user_id
  where assignment.user_id = (select auth.uid())
    and assignment.unassigned_at is null
    and license.status = 'active'
    and license.starts_at <= now()
    and (license.ends_at is null or license.ends_at > now())
    and (
      license.evaluation_cohort_id is null
      or (
        cohort.status = 'active'
        and cohort.starts_at <= now()
        and cohort.ends_at > now()
        and member.status = 'active'
      )
    );
$$;

revoke all on function private.get_current_platform_access()
  from public, anon, authenticated;
grant execute on function private.get_current_platform_access()
  to authenticated, service_role;

create or replace function private.get_my_internal_entitlements()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := (select auth.uid());
  result jsonb;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  select coalesce(jsonb_agg(entitlement), '[]'::jsonb)
  into result
  from (
    select jsonb_build_object(
      'entitlement_key', 'map.staff',
      'display_name', 'MAP Staff',
      'status', 'active',
      'license_kind', 'internal_staff',
      'seat_mode', 'none',
      'price', 0,
      'starts_at', min(user_role.granted_at),
      'ends_at', null,
      'product_keys', coalesce(
        jsonb_agg(distinct capability.product_key)
          filter (where capability.product_key is not null),
        '[]'::jsonb
      ),
      'capabilities', jsonb_agg(distinct role_capability.capability_key)
    ) as entitlement
    from public.platform_user_roles user_role
    join public.platform_role_capabilities role_capability
      on role_capability.role_key = user_role.role_key
    join public.platform_capabilities capability
      on capability.key = role_capability.capability_key
    where user_role.user_id = current_user_id
      and user_role.revoked_at is null
      and user_role.role_key in ('internal.staff', 'internal.admin')
    having count(*) > 0
  ) staff_entitlement;

  return result;
end;
$$;

revoke all on function private.get_my_internal_entitlements()
  from public, anon, authenticated;
grant execute on function private.get_my_internal_entitlements()
  to authenticated, service_role;

create or replace function public.get_my_internal_entitlements()
returns jsonb
language sql
stable
security invoker
set search_path = public, private, pg_temp
as $$ select private.get_my_internal_entitlements(); $$;

revoke all on function public.get_my_internal_entitlements()
  from public, anon, authenticated;
grant execute on function public.get_my_internal_entitlements()
  to authenticated, service_role;
