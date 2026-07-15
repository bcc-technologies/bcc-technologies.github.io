-- Controlled UserUI evaluation cohorts.
--
-- Evaluation access remains license-based. Cohorts add a bounded lifecycle
-- around that access: a partner account, a product, dates, participant state,
-- and a minimal audit trail. They never grant internal MAP developer roles.

create table public.evaluation_cohorts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.license_accounts(id) on delete restrict,
  product_key text not null references public.platform_products(key) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  purpose text not null default '' check (char_length(purpose) <= 2000),
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'closed')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index evaluation_cohorts_account_status_lookup
  on public.evaluation_cohorts (account_id, status, starts_at, ends_at);

create table public.evaluation_cohort_members (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.evaluation_cohorts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('invited', 'active', 'completed', 'revoked')),
  invited_by uuid references auth.users(id) on delete set null,
  invited_at timestamptz not null default now(),
  activated_at timestamptz,
  revoked_at timestamptz,
  revocation_reason text check (revocation_reason is null or char_length(revocation_reason) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cohort_id, user_id),
  check (
    (status <> 'active' or activated_at is not null)
    and (status <> 'revoked' or revoked_at is not null)
  )
);

create index evaluation_cohort_members_user_status_lookup
  on public.evaluation_cohort_members (user_id, status, cohort_id);

create table public.evaluation_access_events (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.evaluation_cohorts(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  license_id uuid references public.platform_licenses(id) on delete set null,
  event_type text not null check (event_type in (
    'cohort_created',
    'participant_invited',
    'participant_activated',
    'participant_revoked',
    'license_issued'
  )),
  actor_id uuid references auth.users(id) on delete set null,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  occurred_at timestamptz not null default now()
);

create index evaluation_access_events_cohort_time_lookup
  on public.evaluation_access_events (cohort_id, occurred_at desc);

alter table public.platform_licenses
  add column evaluation_cohort_id uuid references public.evaluation_cohorts(id) on delete restrict;

alter table public.platform_licenses
  drop constraint if exists platform_licenses_source_check;

alter table public.platform_licenses
  add constraint platform_licenses_source_check
  check (source in ('manual', 'checkout', 'migration', 'internal', 'evaluation'));

alter table public.platform_licenses
  add constraint platform_licenses_evaluation_source_check
  check (
    (source = 'evaluation' and evaluation_cohort_id is not null)
    or (source <> 'evaluation' and evaluation_cohort_id is null)
  );

create index platform_licenses_evaluation_cohort_lookup
  on public.platform_licenses (evaluation_cohort_id, status, ends_at)
  where evaluation_cohort_id is not null;

create or replace function private.require_license_manager(p_actor_id uuid)
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
      and role_permission.permission_key = 'platform.licenses.manage'
  ) then
    raise exception 'The actor is not allowed to manage evaluation access';
  end if;
end;
$$;

revoke all on function private.require_license_manager(uuid) from public, anon, authenticated;
grant execute on function private.require_license_manager(uuid) to service_role;

create or replace function private.validate_evaluation_license()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  cohort_row public.evaluation_cohorts%rowtype;
  plan_product_key text;
  plan_is_evaluation boolean;
begin
  if new.evaluation_cohort_id is null then
    return new;
  end if;

  select * into cohort_row
  from public.evaluation_cohorts
  where id = new.evaluation_cohort_id
  for key share;

  if not found then
    raise exception 'The evaluation cohort does not exist';
  end if;

  select plan.product_key, license_type.is_evaluation
  into plan_product_key, plan_is_evaluation
  from public.license_plans plan
  join public.license_types license_type on license_type.key = plan.license_type_key
  where plan.id = new.plan_id;

  if plan_product_key is distinct from cohort_row.product_key or coalesce(plan_is_evaluation, false) is false then
    raise exception 'An evaluation license must use the cohort product evaluation plan';
  end if;
  if new.account_id is distinct from cohort_row.account_id then
    raise exception 'An evaluation license must belong to the cohort account';
  end if;
  if new.seat_limit <> 1 then
    raise exception 'Evaluation licenses are named-user licenses with one seat';
  end if;
  if new.starts_at < cohort_row.starts_at or new.starts_at >= cohort_row.ends_at then
    raise exception 'The evaluation license starts outside the cohort window';
  end if;
  if new.ends_at is null or new.ends_at > cohort_row.ends_at then
    raise exception 'The evaluation license ends outside the cohort window';
  end if;
  if new.status = 'active' and cohort_row.status <> 'active' then
    raise exception 'Only active cohorts can issue active evaluation licenses';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_evaluation_license() from public, anon, authenticated;

drop trigger if exists validate_evaluation_license on public.platform_licenses;
create trigger validate_evaluation_license
before insert or update of account_id, plan_id, status, seat_limit, starts_at, ends_at, evaluation_cohort_id
on public.platform_licenses
for each row execute function private.validate_evaluation_license();

create or replace function private.validate_license_assignment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  allowed_seats integer;
  active_assignments integer;
  evaluation_cohort_uuid uuid;
begin
  if new.unassigned_at is not null then
    return new;
  end if;

  select license.seat_limit, license.evaluation_cohort_id
  into allowed_seats, evaluation_cohort_uuid
  from public.platform_licenses license
  where license.id = new.license_id
    and license.status = 'active'
    and license.starts_at <= now()
    and (license.ends_at is null or license.ends_at > now())
  for update;

  if allowed_seats is null then
    raise exception 'A license assignment requires an active license';
  end if;

  if evaluation_cohort_uuid is not null and not exists (
    select 1
    from public.evaluation_cohort_members member
    where member.cohort_id = evaluation_cohort_uuid
      and member.user_id = new.user_id
      and member.status in ('invited', 'active')
  ) then
    raise exception 'An evaluation license can only be assigned to a participant of its cohort';
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
  left join public.evaluation_cohorts cohort on cohort.id = license.evaluation_cohort_id
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

revoke all on function private.get_current_platform_access() from public, anon, authenticated;
grant execute on function private.get_current_platform_access() to authenticated, service_role;

create or replace function private.activate_current_evaluation_memberships()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  activated_count integer;
begin
  with activated as (
    update public.evaluation_cohort_members member
    set status = 'active',
        activated_at = coalesce(member.activated_at, now()),
        updated_at = now()
    from public.evaluation_cohorts cohort
    where member.cohort_id = cohort.id
      and member.user_id = (select auth.uid())
      and member.status = 'invited'
      and cohort.status = 'active'
      and cohort.starts_at <= now()
      and cohort.ends_at > now()
    returning member.cohort_id, member.user_id
  ), recorded as (
    insert into public.evaluation_access_events (cohort_id, user_id, event_type, actor_id)
    select cohort_id, user_id, 'participant_activated', user_id
    from activated
  )
  select count(*) into activated_count from activated;

  return activated_count;
end;
$$;

revoke all on function private.activate_current_evaluation_memberships() from public, anon, authenticated;
grant execute on function private.activate_current_evaluation_memberships() to authenticated, service_role;

create or replace function public.activate_my_evaluation_memberships()
returns integer
language sql
security invoker
set search_path = public, private, pg_temp
as $$
  select private.activate_current_evaluation_memberships();
$$;

revoke all on function public.activate_my_evaluation_memberships() from public, anon;
grant execute on function public.activate_my_evaluation_memberships() to authenticated, service_role;

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
  left join public.license_assignments assignment
    on assignment.user_id = member.user_id
    and assignment.unassigned_at is null
  left join public.platform_licenses license
    on license.id = assignment.license_id
    and license.evaluation_cohort_id = cohort.id
  where member.user_id = (select auth.uid());
$$;

revoke all on function private.get_current_evaluation_status() from public, anon, authenticated;
grant execute on function private.get_current_evaluation_status() to authenticated, service_role;

create or replace function public.get_my_evaluation_status()
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
security invoker
set search_path = public, private, pg_temp
as $$
  select * from private.get_current_evaluation_status();
$$;

revoke all on function public.get_my_evaluation_status() from public, anon;
grant execute on function public.get_my_evaluation_status() to authenticated, service_role;

create or replace function private.create_evaluation_account(
  p_display_name text,
  p_actor_id uuid
)
returns table (account_id uuid, display_name text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  created_account public.license_accounts%rowtype;
begin
  perform private.require_license_manager(p_actor_id);

  if char_length(btrim(coalesce(p_display_name, ''))) not between 1 and 160 then
    raise exception 'An evaluation account name must contain between 1 and 160 characters';
  end if;

  insert into public.license_accounts (account_kind, display_name)
  values ('organization', btrim(p_display_name))
  returning * into created_account;

  return query select created_account.id, created_account.display_name;
end;
$$;

revoke all on function private.create_evaluation_account(text, uuid) from public, anon, authenticated;
grant execute on function private.create_evaluation_account(text, uuid) to service_role;

create or replace function public.create_evaluation_account(
  p_display_name text,
  p_actor_id uuid
)
returns table (account_id uuid, display_name text)
language sql
security invoker
set search_path = public, private, pg_temp
as $$
  select * from private.create_evaluation_account(p_display_name, p_actor_id);
$$;

revoke all on function public.create_evaluation_account(text, uuid) from public, anon, authenticated;
grant execute on function public.create_evaluation_account(text, uuid) to service_role;

create or replace function private.create_evaluation_cohort(
  p_account_id uuid,
  p_product_key text,
  p_name text,
  p_purpose text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_actor_id uuid
)
returns table (cohort_id uuid, status text, starts_at timestamptz, ends_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  created_cohort public.evaluation_cohorts%rowtype;
begin
  perform private.require_license_manager(p_actor_id);

  if not exists (
    select 1 from public.license_accounts account
    where account.id = p_account_id
      and account.account_kind = 'organization'
      and account.status = 'active'
  ) then
    raise exception 'The evaluation cohort requires an active organization account';
  end if;
  if not exists (
    select 1 from public.platform_products product
    where product.key = p_product_key and product.is_active
  ) then
    raise exception 'The evaluation cohort requires an active MAP product';
  end if;
  if p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at then
    raise exception 'The evaluation cohort requires a valid start and end time';
  end if;

  insert into public.evaluation_cohorts (
    account_id, product_key, name, purpose, status, starts_at, ends_at, created_by
  ) values (
    p_account_id, p_product_key, btrim(p_name), coalesce(p_purpose, ''), 'active', p_starts_at, p_ends_at, p_actor_id
  ) returning * into created_cohort;

  insert into public.evaluation_access_events (cohort_id, event_type, actor_id)
  values (created_cohort.id, 'cohort_created', p_actor_id);

  return query select created_cohort.id, created_cohort.status, created_cohort.starts_at, created_cohort.ends_at;
end;
$$;

revoke all on function private.create_evaluation_cohort(uuid, text, text, text, timestamptz, timestamptz, uuid) from public, anon, authenticated;
grant execute on function private.create_evaluation_cohort(uuid, text, text, text, timestamptz, timestamptz, uuid) to service_role;

create or replace function public.create_evaluation_cohort(
  p_account_id uuid,
  p_product_key text,
  p_name text,
  p_purpose text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_actor_id uuid
)
returns table (cohort_id uuid, status text, starts_at timestamptz, ends_at timestamptz)
language sql
security invoker
set search_path = public, private, pg_temp
as $$
  select * from private.create_evaluation_cohort(
    p_account_id, p_product_key, p_name, p_purpose, p_starts_at, p_ends_at, p_actor_id
  );
$$;

revoke all on function public.create_evaluation_cohort(uuid, text, text, text, timestamptz, timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.create_evaluation_cohort(uuid, text, text, text, timestamptz, timestamptz, uuid) to service_role;

create or replace function private.provision_evaluation_access(
  p_cohort_id uuid,
  p_user_id uuid,
  p_member_status text,
  p_requested_ends_at timestamptz,
  p_actor_id uuid
)
returns table (license_id uuid, member_status text, valid_until timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  cohort_row public.evaluation_cohorts%rowtype;
  evaluation_plan public.license_plans%rowtype;
  effective_ends_at timestamptz;
  existing_license_id uuid;
  existing_valid_until timestamptz;
begin
  perform private.require_license_manager(p_actor_id);

  if p_member_status not in ('invited', 'active') then
    raise exception 'A participant can only be provisioned as invited or active';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'The participant user does not exist';
  end if;

  select * into cohort_row
  from public.evaluation_cohorts
  where id = p_cohort_id
  for update;

  if not found or cohort_row.status <> 'active' or cohort_row.starts_at > now() or cohort_row.ends_at <= now() then
    raise exception 'The evaluation cohort is not active';
  end if;

  select plan.* into evaluation_plan
  from public.license_plans plan
  join public.license_types license_type on license_type.key = plan.license_type_key
  where plan.product_key = cohort_row.product_key
    and plan.is_active
    and license_type.is_evaluation
  limit 1;

  if not found then
    raise exception 'No active evaluation plan exists for the cohort product';
  end if;

  effective_ends_at := least(
    cohort_row.ends_at,
    coalesce(p_requested_ends_at, now() + make_interval(days => coalesce(evaluation_plan.default_duration_days, 30)))
  );
  if effective_ends_at <= now() then
    raise exception 'The requested evaluation end time has already passed';
  end if;

  insert into public.license_account_members (account_id, user_id, member_role, added_by)
  values (cohort_row.account_id, p_user_id, 'member', p_actor_id)
  on conflict (account_id, user_id) where revoked_at is null do nothing;

  insert into public.evaluation_cohort_members (
    cohort_id, user_id, status, invited_by, invited_at, activated_at, revoked_at, revocation_reason
  ) values (
    cohort_row.id,
    p_user_id,
    p_member_status,
    p_actor_id,
    now(),
    case when p_member_status = 'active' then now() else null end,
    null,
    null
  ) on conflict (cohort_id, user_id) do update
  set status = excluded.status,
      invited_by = excluded.invited_by,
      invited_at = excluded.invited_at,
      activated_at = case when excluded.status = 'active' then coalesce(evaluation_cohort_members.activated_at, now()) else null end,
      revoked_at = null,
      revocation_reason = null,
      updated_at = now();

  select license.id, license.ends_at
  into existing_license_id, existing_valid_until
  from public.platform_licenses license
  join public.license_assignments assignment on assignment.license_id = license.id
  where license.evaluation_cohort_id = cohort_row.id
    and assignment.user_id = p_user_id
    and assignment.unassigned_at is null
    and license.status = 'active'
  order by license.ends_at desc
  limit 1;

  if existing_license_id is not null then
    return query select existing_license_id, p_member_status, existing_valid_until;
    return;
  end if;

  insert into public.platform_licenses (
    account_id, plan_id, status, source, seat_limit, starts_at, ends_at, issued_by, evaluation_cohort_id
  ) values (
    cohort_row.account_id,
    evaluation_plan.id,
    'active',
    'evaluation',
    1,
    greatest(now(), cohort_row.starts_at),
    effective_ends_at,
    p_actor_id,
    cohort_row.id
  ) returning id into existing_license_id;

  insert into public.license_assignments (license_id, user_id, assigned_by)
  values (existing_license_id, p_user_id, p_actor_id);

  insert into public.evaluation_access_events (cohort_id, user_id, license_id, event_type, actor_id)
  values
    (cohort_row.id, p_user_id, existing_license_id, 'license_issued', p_actor_id),
    (cohort_row.id, p_user_id, existing_license_id,
      case when p_member_status = 'invited' then 'participant_invited' else 'participant_activated' end,
      p_actor_id);

  return query select existing_license_id, p_member_status, effective_ends_at;
end;
$$;

revoke all on function private.provision_evaluation_access(uuid, uuid, text, timestamptz, uuid) from public, anon, authenticated;
grant execute on function private.provision_evaluation_access(uuid, uuid, text, timestamptz, uuid) to service_role;

create or replace function public.provision_evaluation_access(
  p_cohort_id uuid,
  p_user_id uuid,
  p_member_status text,
  p_requested_ends_at timestamptz,
  p_actor_id uuid
)
returns table (license_id uuid, member_status text, valid_until timestamptz)
language sql
security invoker
set search_path = public, private, pg_temp
as $$
  select * from private.provision_evaluation_access(
    p_cohort_id, p_user_id, p_member_status, p_requested_ends_at, p_actor_id
  );
$$;

revoke all on function public.provision_evaluation_access(uuid, uuid, text, timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.provision_evaluation_access(uuid, uuid, text, timestamptz, uuid) to service_role;

create or replace function private.revoke_evaluation_access(
  p_cohort_id uuid,
  p_user_id uuid,
  p_reason text,
  p_actor_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  revoked_license_count integer;
begin
  perform private.require_license_manager(p_actor_id);

  update public.evaluation_cohort_members
  set status = 'revoked',
      revoked_at = now(),
      revocation_reason = nullif(btrim(coalesce(p_reason, '')), ''),
      updated_at = now()
  where cohort_id = p_cohort_id
    and user_id = p_user_id
    and status <> 'revoked';

  if not found then
    raise exception 'The participant has no active or pending cohort membership';
  end if;

  with revoked_licenses as (
    update public.platform_licenses license
    set status = 'revoked', updated_at = now()
    from public.license_assignments assignment
    where license.id = assignment.license_id
      and license.evaluation_cohort_id = p_cohort_id
      and assignment.user_id = p_user_id
      and assignment.unassigned_at is null
      and license.status in ('draft', 'active', 'suspended')
    returning license.id
  ), unassigned as (
    update public.license_assignments assignment
    set unassigned_at = now()
    where assignment.user_id = p_user_id
      and assignment.unassigned_at is null
      and assignment.license_id in (select id from revoked_licenses)
  )
  select count(*) into revoked_license_count from revoked_licenses;

  insert into public.evaluation_access_events (cohort_id, user_id, event_type, actor_id, details)
  values (
    p_cohort_id,
    p_user_id,
    'participant_revoked',
    p_actor_id,
    jsonb_strip_nulls(jsonb_build_object('reason', nullif(btrim(coalesce(p_reason, '')), '')))
  );

  return revoked_license_count;
end;
$$;

revoke all on function private.revoke_evaluation_access(uuid, uuid, text, uuid) from public, anon, authenticated;
grant execute on function private.revoke_evaluation_access(uuid, uuid, text, uuid) to service_role;

create or replace function public.revoke_evaluation_access(
  p_cohort_id uuid,
  p_user_id uuid,
  p_reason text,
  p_actor_id uuid
)
returns integer
language sql
security invoker
set search_path = public, private, pg_temp
as $$
  select private.revoke_evaluation_access(p_cohort_id, p_user_id, p_reason, p_actor_id);
$$;

revoke all on function public.revoke_evaluation_access(uuid, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.revoke_evaluation_access(uuid, uuid, text, uuid) to service_role;

alter table public.evaluation_cohorts enable row level security;
alter table public.evaluation_cohort_members enable row level security;
alter table public.evaluation_access_events enable row level security;

revoke all on public.evaluation_cohorts, public.evaluation_cohort_members, public.evaluation_access_events
from anon, authenticated;

create policy "No direct evaluation cohort access"
on public.evaluation_cohorts as restrictive for all to authenticated
using (false) with check (false);

create policy "No direct evaluation participant access"
on public.evaluation_cohort_members as restrictive for all to authenticated
using (false) with check (false);

create policy "No direct evaluation audit access"
on public.evaluation_access_events as restrictive for all to authenticated
using (false) with check (false);
