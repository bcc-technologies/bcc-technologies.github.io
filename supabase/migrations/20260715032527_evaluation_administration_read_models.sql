-- Read models for the server-side evaluation administration UI.
-- These remain unavailable to browser Supabase clients; only the MAP backend
-- service role may call the public wrappers after it verifies an administrator.

create or replace function private.list_evaluation_cohorts(p_actor_id uuid)
returns table (
  cohort_id uuid,
  account_id uuid,
  account_name text,
  product_key text,
  cohort_name text,
  purpose text,
  cohort_status text,
  starts_at timestamptz,
  ends_at timestamptz,
  participant_count bigint,
  active_participant_count bigint
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform private.require_license_manager(p_actor_id);

  return query
  select
    cohort.id,
    account.id,
    account.display_name,
    cohort.product_key,
    cohort.name,
    cohort.purpose,
    cohort.status,
    cohort.starts_at,
    cohort.ends_at,
    count(member.id),
    count(member.id) filter (where member.status = 'active')
  from public.evaluation_cohorts cohort
  join public.license_accounts account on account.id = cohort.account_id
  left join public.evaluation_cohort_members member on member.cohort_id = cohort.id
  group by cohort.id, account.id
  order by cohort.ends_at desc, cohort.created_at desc;
end;
$$;

revoke all on function private.list_evaluation_cohorts(uuid) from public, anon, authenticated;
grant execute on function private.list_evaluation_cohorts(uuid) to service_role;

create or replace function public.list_evaluation_cohorts(p_actor_id uuid)
returns table (
  cohort_id uuid,
  account_id uuid,
  account_name text,
  product_key text,
  cohort_name text,
  purpose text,
  cohort_status text,
  starts_at timestamptz,
  ends_at timestamptz,
  participant_count bigint,
  active_participant_count bigint
)
language sql
security invoker
set search_path = public, private, pg_temp
as $$
  select * from private.list_evaluation_cohorts(p_actor_id);
$$;

revoke all on function public.list_evaluation_cohorts(uuid) from public, anon, authenticated;
grant execute on function public.list_evaluation_cohorts(uuid) to service_role;

create or replace function private.list_evaluation_cohort_participants(
  p_cohort_id uuid,
  p_actor_id uuid
)
returns table (
  user_id uuid,
  email text,
  display_name text,
  member_status text,
  access_status text,
  valid_until timestamptz,
  license_id uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform private.require_license_manager(p_actor_id);

  if not exists (select 1 from public.evaluation_cohorts where id = p_cohort_id) then
    raise exception 'The evaluation cohort does not exist';
  end if;

  return query
  select
    member.user_id,
    coalesce(profile.email, auth_user.email),
    coalesce(nullif(btrim(profile.display_name), ''), nullif(btrim(profile.full_name), ''), auth_user.email),
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
    least(cohort.ends_at, license.ends_at),
    license.id
  from public.evaluation_cohort_members member
  join public.evaluation_cohorts cohort on cohort.id = member.cohort_id
  join auth.users auth_user on auth_user.id = member.user_id
  left join public.profiles profile on profile.id = member.user_id
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
  where member.cohort_id = p_cohort_id
  order by member.invited_at desc;
end;
$$;

revoke all on function private.list_evaluation_cohort_participants(uuid, uuid) from public, anon, authenticated;
grant execute on function private.list_evaluation_cohort_participants(uuid, uuid) to service_role;

create or replace function public.list_evaluation_cohort_participants(
  p_cohort_id uuid,
  p_actor_id uuid
)
returns table (
  user_id uuid,
  email text,
  display_name text,
  member_status text,
  access_status text,
  valid_until timestamptz,
  license_id uuid
)
language sql
security invoker
set search_path = public, private, pg_temp
as $$
  select * from private.list_evaluation_cohort_participants(p_cohort_id, p_actor_id);
$$;

revoke all on function public.list_evaluation_cohort_participants(uuid, uuid) from public, anon, authenticated;
grant execute on function public.list_evaluation_cohort_participants(uuid, uuid) to service_role;
