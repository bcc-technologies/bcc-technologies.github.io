-- Keep MAP seat assignments current and move large member lists behind a scoped RPC.

create extension if not exists pg_cron with schema pg_catalog;

create or replace function private.release_noncurrent_license_assignments(
  p_license_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  released_count integer;
begin
  with stale_assignment as (
    select
      assignment.id,
      assignment.assigned_at,
      assignment.user_id,
      license.id as license_id,
      license.account_id,
      plan.product_key,
      case
        when license.status <> 'active' then 'license_' || license.status
        when license.starts_at > now() then 'license_not_started'
        else 'license_expired'
      end as release_reason
    from public.license_assignments assignment
    join public.platform_licenses license on license.id = assignment.license_id
    join public.license_plans plan on plan.id = license.plan_id
    where assignment.unassigned_at is null
      and (p_license_id is null or license.id = p_license_id)
      and (
        license.status <> 'active'
        or license.starts_at > now()
        or (license.ends_at is not null and license.ends_at <= now())
      )
    order by assignment.id
    for update of assignment skip locked
  ),
  released as (
    update public.license_assignments assignment
    set unassigned_at = greatest(assignment.assigned_at, now())
    from stale_assignment stale
    where assignment.id = stale.id
    returning
      assignment.id,
      stale.account_id,
      stale.license_id,
      stale.user_id,
      stale.product_key,
      stale.release_reason
  ),
  logged as (
    insert into public.license_self_service_events (
      account_id,
      license_id,
      assignment_id,
      actor_id,
      subject_user_id,
      event_type,
      details
    )
    select
      released.account_id,
      released.license_id,
      released.id,
      null,
      released.user_id,
      'seat_released',
      jsonb_build_object(
        'product_key', released.product_key,
        'automatic', true,
        'reason', released.release_reason
      )
    from released
    returning 1
  )
  select count(*)::integer into released_count from logged;

  return coalesce(released_count, 0);
end;
$$;

revoke all on function private.release_noncurrent_license_assignments(uuid)
  from public, anon, authenticated;
grant execute on function private.release_noncurrent_license_assignments(uuid)
  to service_role;

create or replace function private.release_license_assignments_on_lifecycle_change()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  perform private.release_noncurrent_license_assignments(new.id);
  return new;
end;
$$;

revoke all on function private.release_license_assignments_on_lifecycle_change()
  from public, anon, authenticated;

drop trigger if exists release_license_assignments_on_lifecycle_change
  on public.platform_licenses;
create trigger release_license_assignments_on_lifecycle_change
after update of status, starts_at, ends_at on public.platform_licenses
for each row
when (
  old.status is distinct from new.status
  or old.starts_at is distinct from new.starts_at
  or old.ends_at is distinct from new.ends_at
)
execute function private.release_license_assignments_on_lifecycle_change();

create or replace function private.get_my_license_overview()
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

  select jsonb_build_object(
    'accounts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'account_id', account.id,
        'display_name', account.display_name,
        'account_kind', account.account_kind,
        'account_status', account.status,
        'member_role', member.member_role,
        'can_manage_seats', member.member_role in ('owner', 'admin') and account.status = 'active'
      ) order by account.display_name, account.id)
      from public.license_account_members member
      join public.license_accounts account on account.id = member.account_id
      where member.user_id = current_user_id
        and member.revoked_at is null
    ), '[]'::jsonb),
    'licenses', coalesce((
      select jsonb_agg(jsonb_build_object(
        'license_id', license.id,
        'account_id', account.id,
        'account_name', account.display_name,
        'product_key', plan.product_key,
        'plan_name', plan.display_name,
        'license_type', plan.license_type_key,
        'is_evaluation', license_type.is_evaluation,
        'license_status', license.status,
        'seat_limit', license.seat_limit,
        'assigned_seats', seat_counts.assigned_seats,
        'starts_at', license.starts_at,
        'ends_at', license.ends_at,
        'member_role', actor_membership.member_role,
        'can_manage_seats', actor_membership.member_role in ('owner', 'admin')
          and account.status = 'active'
          and license.status = 'active'
          and license.starts_at <= now()
          and (license.ends_at is null or license.ends_at > now())
          and not license_type.is_evaluation,
        'is_assigned_to_me', exists (
          select 1
          from public.license_assignments own_assignment
          where own_assignment.license_id = license.id
            and own_assignment.user_id = current_user_id
            and own_assignment.unassigned_at is null
        )
      ) order by license.created_at desc, license.id desc)
      from public.platform_licenses license
      join public.license_accounts account on account.id = license.account_id
      join public.license_plans plan on plan.id = license.plan_id
      join public.license_types license_type on license_type.key = plan.license_type_key
      join public.license_account_members actor_membership
        on actor_membership.account_id = license.account_id
       and actor_membership.user_id = current_user_id
       and actor_membership.revoked_at is null
      cross join lateral (
        select count(*)::integer as assigned_seats
        from public.license_assignments assignment
        where assignment.license_id = license.id
          and assignment.unassigned_at is null
      ) seat_counts
      where actor_membership.member_role in ('owner', 'admin')
         or exists (
           select 1
           from public.license_assignments own_assignment
           where own_assignment.license_id = license.id
             and own_assignment.user_id = current_user_id
             and own_assignment.unassigned_at is null
         )
    ), '[]'::jsonb),
    'members', '[]'::jsonb,
    'assignments', '[]'::jsonb,
    'recent_events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'event_id', event.id,
        'account_id', event.account_id,
        'license_id', event.license_id,
        'actor_id', event.actor_id,
        'subject_user_id', event.subject_user_id,
        'subject_name', event.subject_name,
        'subject_email', event.subject_email,
        'event_type', event.event_type,
        'details', event.details,
        'occurred_at', event.occurred_at
      ) order by event.occurred_at desc, event.id desc)
      from (
        select
          self_event.*,
          coalesce(
            nullif(subject_profile.display_name, ''),
            nullif(subject_profile.full_name, ''),
            subject_profile.email
          ) as subject_name,
          subject_profile.email as subject_email
        from public.license_self_service_events self_event
        left join public.profiles subject_profile on subject_profile.id = self_event.subject_user_id
        where self_event.actor_id = current_user_id
           or self_event.subject_user_id = current_user_id
           or exists (
             select 1
             from public.license_account_members manager_membership
             where manager_membership.account_id = self_event.account_id
               and manager_membership.user_id = current_user_id
               and manager_membership.revoked_at is null
               and manager_membership.member_role in ('owner', 'admin')
           )
        order by self_event.occurred_at desc, self_event.id desc
        limit 30
      ) event
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function private.get_my_license_overview()
  from public, anon, authenticated;
grant execute on function private.get_my_license_overview()
  to authenticated, service_role;

create or replace function public.get_my_license_overview()
returns jsonb
language sql
stable
security invoker
set search_path = public, private, pg_temp
as $$ select private.get_my_license_overview(); $$;

revoke all on function public.get_my_license_overview()
  from public, anon, authenticated;
grant execute on function public.get_my_license_overview()
  to authenticated, service_role;

create or replace function private.get_my_license_seat_management(
  p_license_id uuid,
  p_query text default null,
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := (select auth.uid());
  search_term text := lower(trim(coalesce(p_query, '')));
  result_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  target_license record;
  assigned_seats integer;
  assignment_matches integer;
  candidate_matches integer;
  result jsonb;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_license_id is null then
    raise exception 'License is required';
  end if;

  select
    license.id as license_id,
    license.account_id,
    license.seat_limit,
    account.display_name as account_name,
    plan.product_key
  into target_license
  from public.platform_licenses license
  join public.license_accounts account on account.id = license.account_id
  join public.license_plans plan on plan.id = license.plan_id
  join public.license_types license_type on license_type.key = plan.license_type_key
  join public.license_account_members actor_membership
    on actor_membership.account_id = license.account_id
   and actor_membership.user_id = current_user_id
   and actor_membership.revoked_at is null
   and actor_membership.member_role in ('owner', 'admin')
  where license.id = p_license_id
    and account.status = 'active'
    and license.status = 'active'
    and license.starts_at <= now()
    and (license.ends_at is null or license.ends_at > now())
    and not license_type.is_evaluation;

  if not found then
    raise exception 'Only an account owner or administrator can manage seats for an active license';
  end if;

  select count(*)::integer
  into assigned_seats
  from public.license_assignments assignment
  where assignment.license_id = p_license_id
    and assignment.unassigned_at is null;

  select count(*)::integer
  into assignment_matches
  from public.license_assignments assignment
  where assignment.license_id = p_license_id
    and assignment.unassigned_at is null;

  select count(*)::integer
  into candidate_matches
  from public.license_account_members member
  join public.profiles profile on profile.id = member.user_id
  where member.account_id = target_license.account_id
    and member.revoked_at is null
    and not exists (
      select 1
      from public.license_assignments assignment
      where assignment.license_id = p_license_id
        and assignment.user_id = member.user_id
        and assignment.unassigned_at is null
    )
    and (
      search_term = ''
      or lower(concat_ws(' ', profile.display_name, profile.full_name, profile.email)) like '%' || search_term || '%'
    );

  select jsonb_build_object(
    'license_id', target_license.license_id,
    'account_id', target_license.account_id,
    'account_name', target_license.account_name,
    'product_key', target_license.product_key,
    'seat_limit', target_license.seat_limit,
    'assigned_seats', assigned_seats,
    'query', search_term,
    'result_limit', result_limit,
    'assignment_matches', assignment_matches,
    'candidate_matches', candidate_matches,
    'assignments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'assignment_id', page.id,
        'license_id', p_license_id,
        'account_id', target_license.account_id,
        'user_id', page.user_id,
        'display_name', page.display_name,
        'email', page.email,
        'assigned_at', page.assigned_at,
        'is_mine', page.user_id = current_user_id,
        'can_release', assigned_seats > 1 and page.user_id <> current_user_id,
        'release_block_reason', case
          when assigned_seats <= 1 then 'last_assignment'
          when page.user_id = current_user_id then 'manager_self_release'
          else null
        end,
        'is_evaluation', false
      ) order by page.display_name, page.email, page.id)
      from (
        select
          assignment.id,
          assignment.user_id,
          assignment.assigned_at,
          coalesce(nullif(profile.display_name, ''), nullif(profile.full_name, ''), profile.email) as display_name,
          profile.email
        from public.license_assignments assignment
        join public.profiles profile on profile.id = assignment.user_id
        where assignment.license_id = p_license_id
          and assignment.unassigned_at is null
        order by
          coalesce(nullif(profile.display_name, ''), nullif(profile.full_name, ''), profile.email),
          profile.email,
          assignment.id
        limit result_limit
      ) page
    ), '[]'::jsonb),
    'candidates', coalesce((
      select jsonb_agg(jsonb_build_object(
        'account_id', target_license.account_id,
        'user_id', page.user_id,
        'member_role', page.member_role,
        'display_name', page.display_name,
        'email', page.email
      ) order by page.display_name, page.email, page.user_id)
      from (
        select
          member.user_id,
          member.member_role,
          coalesce(nullif(profile.display_name, ''), nullif(profile.full_name, ''), profile.email) as display_name,
          profile.email
        from public.license_account_members member
        join public.profiles profile on profile.id = member.user_id
        where member.account_id = target_license.account_id
          and member.revoked_at is null
          and not exists (
            select 1
            from public.license_assignments assignment
            where assignment.license_id = p_license_id
              and assignment.user_id = member.user_id
              and assignment.unassigned_at is null
          )
          and (
            search_term = ''
            or lower(concat_ws(' ', profile.display_name, profile.full_name, profile.email)) like '%' || search_term || '%'
          )
        order by
          coalesce(nullif(profile.display_name, ''), nullif(profile.full_name, ''), profile.email),
          profile.email,
          member.user_id
        limit result_limit
      ) page
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function private.get_my_license_seat_management(uuid, text, integer)
  from public, anon, authenticated;
grant execute on function private.get_my_license_seat_management(uuid, text, integer)
  to authenticated, service_role;

create or replace function public.get_my_license_seat_management(
  p_license_id uuid,
  p_query text default null,
  p_limit integer default 50
)
returns jsonb
language sql
stable
security invoker
set search_path = public, private, pg_temp
as $$
  select private.get_my_license_seat_management(p_license_id, p_query, p_limit);
$$;

revoke all on function public.get_my_license_seat_management(uuid, text, integer)
  from public, anon, authenticated;
grant execute on function public.get_my_license_seat_management(uuid, text, integer)
  to authenticated, service_role;



create or replace function private.release_my_license_assignment(p_assignment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_account_id uuid;
  target_license_id uuid;
  target_user_id uuid;
  target_product_key text;
  target_is_evaluation boolean;
  actor_is_manager boolean;
  active_assignment_count integer;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_assignment_id is null then
    raise exception 'Assignment is required';
  end if;

  select license.account_id, assignment.license_id, assignment.user_id,
    plan.product_key, license_type.is_evaluation
  into target_account_id, target_license_id, target_user_id,
    target_product_key, target_is_evaluation
  from public.license_assignments assignment
  join public.platform_licenses license on license.id = assignment.license_id
  join public.license_plans plan on plan.id = license.plan_id
  join public.license_types license_type on license_type.key = plan.license_type_key
  where assignment.id = p_assignment_id
    and assignment.unassigned_at is null
  for update of assignment, license;

  if target_account_id is null then
    raise exception 'Assignment is not active';
  end if;
  if target_is_evaluation then
    raise exception 'Evaluation access is managed by BCC staff';
  end if;

  select exists (
    select 1
    from public.license_account_members actor_membership
    where actor_membership.account_id = target_account_id
      and actor_membership.user_id = current_user_id
      and actor_membership.revoked_at is null
      and actor_membership.member_role in ('owner', 'admin')
  ) into actor_is_manager;

  if target_user_id <> current_user_id and not actor_is_manager then
    raise exception 'You cannot release this assignment';
  end if;

  select count(*)
  into active_assignment_count
  from public.license_assignments assignment
  where assignment.license_id = target_license_id
    and assignment.unassigned_at is null;

  if active_assignment_count <= 1 then
    raise exception 'The only active seat cannot be released';
  end if;
  if target_user_id = current_user_id and actor_is_manager then
    raise exception 'An account owner or administrator cannot release their own seat without transferring management';
  end if;

  update public.license_assignments
  set unassigned_at = now()
  where id = p_assignment_id;

  insert into public.license_self_service_events (
    account_id, license_id, assignment_id, actor_id, subject_user_id, event_type, details
  ) values (
    target_account_id, target_license_id, p_assignment_id, current_user_id, target_user_id,
    'seat_released', jsonb_build_object('product_key', target_product_key)
  );

  return p_assignment_id;
end;
$$;

revoke all on function private.release_my_license_assignment(uuid) from public, anon, authenticated;
grant execute on function private.release_my_license_assignment(uuid) to authenticated, service_role;
do $$
declare
  existing_job_id bigint;
begin
  select jobid
  into existing_job_id
  from cron.job
  where jobname = 'map-license-assignment-lifecycle';

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'map-license-assignment-lifecycle',
    '*/15 * * * *',
    $job$select private.release_noncurrent_license_assignments();$job$
  );
end;
$$;

select private.release_noncurrent_license_assignments();
