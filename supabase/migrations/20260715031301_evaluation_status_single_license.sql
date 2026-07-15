-- A participant can receive a later evaluation license after an earlier one
-- expires. Return the best current license once per cohort rather than one
-- status row for every historical assignment.

create or replace function private.get_current_evaluation_status()
returns table (
  cohort_id uuid,
  cohort_name text,
  product_key text,
  member_status text,
  access_status text,
  valid_until timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    cohort.id,
    cohort.name,
    cohort.product_key,
    member.status,
    case
      when member.status = 'revoked' then 'revoked'
      when member.status = 'completed' then 'completed'
      when cohort.status = 'paused' then 'paused'
      when cohort.status = 'closed' or cohort.ends_at <= now() then 'expired'
      when member.status = 'invited' then 'pending'
      when license.id is not null
        and license.status = 'active'
        and license.starts_at <= now()
        and license.ends_at > now()
        and cohort.status = 'active'
        and cohort.starts_at <= now()
        and cohort.ends_at > now()
        then 'active'
      else 'inactive'
    end,
    least(cohort.ends_at, license.ends_at)
  from public.evaluation_cohort_members member
  join public.evaluation_cohorts cohort on cohort.id = member.cohort_id
  left join lateral (
    select license.*
    from public.license_assignments assignment
    join public.platform_licenses license on license.id = assignment.license_id
    where assignment.user_id = member.user_id
      and assignment.unassigned_at is null
      and license.evaluation_cohort_id = cohort.id
    order by
      case when license.status = 'active' and license.starts_at <= now() and license.ends_at > now() then 0 else 1 end,
      license.ends_at desc
    limit 1
  ) license on true
  where member.user_id = (select auth.uid());
$$;

revoke all on function private.get_current_evaluation_status() from public, anon, authenticated;
grant execute on function private.get_current_evaluation_status() to authenticated, service_role;
