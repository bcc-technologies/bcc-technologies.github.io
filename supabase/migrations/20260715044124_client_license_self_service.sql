-- Client-facing MAP license self-service (remote migration 20260715044124).
-- Direct table access remains closed; authenticated users use RPCs scoped to auth.uid().

create table if not exists public.license_self_service_events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.license_accounts(id) on delete restrict,
  license_id uuid references public.platform_licenses(id) on delete set null,
  assignment_id uuid references public.license_assignments(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  subject_user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('seat_assigned', 'seat_released')),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  occurred_at timestamptz not null default now()
);

alter table public.license_self_service_events enable row level security;

drop policy if exists license_self_service_events_deny_direct_access
  on public.license_self_service_events;
create policy license_self_service_events_deny_direct_access
  on public.license_self_service_events
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

revoke all on table public.license_self_service_events from public, anon, authenticated;
grant select, insert on table public.license_self_service_events to service_role;

create index if not exists license_self_service_events_account_time_idx
  on public.license_self_service_events (account_id, occurred_at desc);
create index if not exists license_self_service_events_license_id_idx
  on public.license_self_service_events (license_id);
create index if not exists license_self_service_events_assignment_id_idx
  on public.license_self_service_events (assignment_id);
create index if not exists license_self_service_events_actor_id_idx
  on public.license_self_service_events (actor_id);
create index if not exists license_self_service_events_subject_user_id_idx
  on public.license_self_service_events (subject_user_id);

create or replace function private.get_my_license_dashboard()
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
          select 1 from public.license_assignments own_assignment
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
           select 1 from public.license_assignments own_assignment
           where own_assignment.license_id = license.id
             and own_assignment.user_id = current_user_id
             and own_assignment.unassigned_at is null
         )
    ), '[]'::jsonb),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'account_id', member.account_id,
        'user_id', member.user_id,
        'member_role', member.member_role,
        'display_name', coalesce(nullif(profile.display_name, ''), nullif(profile.full_name, ''), profile.email),
        'email', profile.email
      ) order by member.account_id, coalesce(nullif(profile.display_name, ''), nullif(profile.full_name, ''), profile.email), member.user_id)
      from public.license_account_members member
      join public.profiles profile on profile.id = member.user_id
      where member.revoked_at is null
        and exists (
          select 1 from public.license_account_members actor_membership
          where actor_membership.account_id = member.account_id
            and actor_membership.user_id = current_user_id
            and actor_membership.revoked_at is null
            and actor_membership.member_role in ('owner', 'admin')
        )
    ), '[]'::jsonb),
    'assignments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'assignment_id', assignment.id,
        'license_id', assignment.license_id,
        'account_id', license.account_id,
        'user_id', assignment.user_id,
        'display_name', coalesce(nullif(profile.display_name, ''), nullif(profile.full_name, ''), profile.email),
        'email', profile.email,
        'assigned_at', assignment.assigned_at,
        'is_mine', assignment.user_id = current_user_id,
        'can_release', assignment.user_id = current_user_id or manager_membership.user_id is not null,
        'is_evaluation', license_type.is_evaluation
      ) order by assignment.assigned_at desc, assignment.id desc)
      from public.license_assignments assignment
      join public.platform_licenses license on license.id = assignment.license_id
      join public.license_plans plan on plan.id = license.plan_id
      join public.license_types license_type on license_type.key = plan.license_type_key
      join public.profiles profile on profile.id = assignment.user_id
      left join public.license_account_members manager_membership
        on manager_membership.account_id = license.account_id
       and manager_membership.user_id = current_user_id
       and manager_membership.revoked_at is null
       and manager_membership.member_role in ('owner', 'admin')
      where assignment.unassigned_at is null
        and (assignment.user_id = current_user_id or manager_membership.user_id is not null)
    ), '[]'::jsonb),
    'recent_events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'event_id', event.id,
        'account_id', event.account_id,
        'license_id', event.license_id,
        'actor_id', event.actor_id,
        'subject_user_id', event.subject_user_id,
        'event_type', event.event_type,
        'details', event.details,
        'occurred_at', event.occurred_at
      ) order by event.occurred_at desc, event.id desc)
      from (
        select self_event.*
        from public.license_self_service_events self_event
        where self_event.actor_id = current_user_id
           or self_event.subject_user_id = current_user_id
           or exists (
             select 1 from public.license_account_members manager_membership
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

revoke all on function private.get_my_license_dashboard() from public, anon, authenticated;
grant execute on function private.get_my_license_dashboard() to authenticated, service_role;

create or replace function public.get_my_license_dashboard()
returns jsonb
language sql
stable
security invoker
set search_path = public, private, pg_temp
as $$ select private.get_my_license_dashboard(); $$;

revoke all on function public.get_my_license_dashboard() from public, anon, authenticated;
grant execute on function public.get_my_license_dashboard() to authenticated, service_role;

create or replace function private.assign_my_account_license(
  p_license_id uuid,
  p_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_account_id uuid;
  target_product_key text;
  target_is_evaluation boolean;
  created_assignment_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_license_id is null or p_user_id is null then
    raise exception 'License and user are required';
  end if;

  select license.account_id, plan.product_key, license_type.is_evaluation
  into target_account_id, target_product_key, target_is_evaluation
  from public.platform_licenses license
  join public.license_accounts account on account.id = license.account_id
  join public.license_plans plan on plan.id = license.plan_id
  join public.license_types license_type on license_type.key = plan.license_type_key
  where license.id = p_license_id
    and account.status = 'active'
    and license.status = 'active'
    and license.starts_at <= now()
    and (license.ends_at is null or license.ends_at > now())
  for update of license;

  if target_account_id is null then
    raise exception 'License is not active';
  end if;
  if target_is_evaluation then
    raise exception 'Evaluation access is managed by BCC staff';
  end if;
  if not exists (
    select 1 from public.license_account_members actor_membership
    where actor_membership.account_id = target_account_id
      and actor_membership.user_id = current_user_id
      and actor_membership.revoked_at is null
      and actor_membership.member_role in ('owner', 'admin')
  ) then
    raise exception 'Only an account owner or administrator can assign seats';
  end if;
  if not exists (
    select 1 from public.license_account_members target_membership
    where target_membership.account_id = target_account_id
      and target_membership.user_id = p_user_id
      and target_membership.revoked_at is null
  ) then
    raise exception 'The selected user is not an active account member';
  end if;
  if exists (
    select 1 from public.license_assignments assignment
    where assignment.license_id = p_license_id
      and assignment.user_id = p_user_id
      and assignment.unassigned_at is null
  ) then
    raise exception 'The selected user already has this license';
  end if;

  insert into public.license_assignments (license_id, user_id, assigned_by)
  values (p_license_id, p_user_id, current_user_id)
  returning id into created_assignment_id;

  insert into public.license_self_service_events (
    account_id, license_id, assignment_id, actor_id, subject_user_id, event_type, details
  ) values (
    target_account_id, p_license_id, created_assignment_id, current_user_id, p_user_id,
    'seat_assigned', jsonb_build_object('product_key', target_product_key)
  );

  return created_assignment_id;
end;
$$;

revoke all on function private.assign_my_account_license(uuid, uuid) from public, anon, authenticated;
grant execute on function private.assign_my_account_license(uuid, uuid) to authenticated, service_role;

create or replace function public.assign_my_account_license(
  p_license_id uuid,
  p_user_id uuid
)
returns uuid
language sql
security invoker
set search_path = public, private, pg_temp
as $$ select private.assign_my_account_license(p_license_id, p_user_id); $$;

revoke all on function public.assign_my_account_license(uuid, uuid) from public, anon, authenticated;
grant execute on function public.assign_my_account_license(uuid, uuid) to authenticated, service_role;

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
  for update of assignment;

  if target_account_id is null then
    raise exception 'Assignment is not active';
  end if;
  if target_is_evaluation then
    raise exception 'Evaluation access is managed by BCC staff';
  end if;
  if target_user_id <> current_user_id and not exists (
    select 1 from public.license_account_members actor_membership
    where actor_membership.account_id = target_account_id
      and actor_membership.user_id = current_user_id
      and actor_membership.revoked_at is null
      and actor_membership.member_role in ('owner', 'admin')
  ) then
    raise exception 'You cannot release this assignment';
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

create or replace function public.release_my_license_assignment(p_assignment_id uuid)
returns uuid
language sql
security invoker
set search_path = public, private, pg_temp
as $$ select private.release_my_license_assignment(p_assignment_id); $$;

revoke all on function public.release_my_license_assignment(uuid) from public, anon, authenticated;
grant execute on function public.release_my_license_assignment(uuid) to authenticated, service_role;

-- Existing internal license tables stay unavailable to browser roles.
revoke all on table public.license_accounts, public.license_account_members,
  public.license_plans, public.license_types, public.platform_licenses,
  public.license_assignments from anon, authenticated;
