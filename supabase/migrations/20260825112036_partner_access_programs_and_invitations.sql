-- Classify external MAP evaluation access as an explicit operational program.
--
-- Existing evaluation cohorts remain valid and default to
-- `standard_evaluation`. Partner and complimentary programs require a written
-- grant reason, an accountable sponsor, and an approval actor. Browser clients
-- never receive direct access to the underlying tables or service-role helpers.

alter table public.evaluation_cohorts
  add column if not exists program_type text not null default 'standard_evaluation',
  add column if not exists grant_reason text not null default '',
  add column if not exists sponsored_by uuid references auth.users(id) on delete set null,
  add column if not exists approved_by uuid references auth.users(id) on delete set null,
  add column if not exists review_at timestamptz,
  add column if not exists max_renewals smallint not null default 0,
  add column if not exists renewal_count smallint not null default 0;

alter table public.evaluation_cohorts
  drop constraint if exists evaluation_cohorts_program_type_check;
alter table public.evaluation_cohorts
  add constraint evaluation_cohorts_program_type_check
  check (program_type in ('standard_evaluation', 'partner_test', 'complimentary_pilot'));

alter table public.evaluation_cohorts
  drop constraint if exists evaluation_cohorts_grant_reason_check;
alter table public.evaluation_cohorts
  add constraint evaluation_cohorts_grant_reason_check
  check (
    char_length(grant_reason) <= 1000
    and (
      program_type = 'standard_evaluation'
      or char_length(btrim(grant_reason)) >= 10
    )
  );

alter table public.evaluation_cohorts
  drop constraint if exists evaluation_cohorts_review_at_check;
alter table public.evaluation_cohorts
  add constraint evaluation_cohorts_review_at_check
  check (review_at is null or (review_at >= starts_at and review_at <= ends_at));

alter table public.evaluation_cohorts
  drop constraint if exists evaluation_cohorts_renewals_check;
alter table public.evaluation_cohorts
  add constraint evaluation_cohorts_renewals_check
  check (
    max_renewals between 0 and 12
    and renewal_count between 0 and max_renewals
  );

create index if not exists evaluation_cohorts_program_status_lookup
  on public.evaluation_cohorts (program_type, status, ends_at desc);

create index if not exists evaluation_cohorts_review_queue_lookup
  on public.evaluation_cohorts (review_at, status)
  where review_at is not null and status in ('active', 'paused');

create index if not exists evaluation_cohorts_sponsored_by_idx
  on public.evaluation_cohorts (sponsored_by)
  where sponsored_by is not null;

create index if not exists evaluation_cohorts_approved_by_idx
  on public.evaluation_cohorts (approved_by)
  where approved_by is not null;

create or replace function private.create_access_program_cohort(
  p_account_id uuid,
  p_product_key text,
  p_name text,
  p_purpose text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_program_type text,
  p_grant_reason text,
  p_review_at timestamptz,
  p_max_renewals integer,
  p_actor_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  created_id uuid;
  normalized_program_type text := lower(btrim(coalesce(p_program_type, 'standard_evaluation')));
  normalized_grant_reason text := btrim(coalesce(p_grant_reason, ''));
  normalized_max_renewals integer := coalesce(p_max_renewals, 0);
begin
  perform private.require_license_manager(p_actor_id);

  if normalized_program_type not in ('standard_evaluation', 'partner_test', 'complimentary_pilot') then
    raise exception 'The MAP access program type is invalid';
  end if;
  if normalized_program_type <> 'standard_evaluation' and char_length(normalized_grant_reason) < 10 then
    raise exception 'Partner and complimentary access require a written grant reason';
  end if;
  if char_length(normalized_grant_reason) > 1000 then
    raise exception 'The grant reason is too long';
  end if;
  if normalized_max_renewals < 0 or normalized_max_renewals > 12 then
    raise exception 'The renewal limit must be between zero and twelve';
  end if;
  if p_review_at is not null and (p_review_at < p_starts_at or p_review_at > p_ends_at) then
    raise exception 'The review date must fall inside the cohort window';
  end if;

  select item.cohort_id into created_id
  from private.create_evaluation_cohort(
    p_account_id,
    p_product_key,
    p_name,
    p_purpose,
    p_starts_at,
    p_ends_at,
    p_actor_id
  ) item;

  update public.evaluation_cohorts
  set program_type = normalized_program_type,
      grant_reason = normalized_grant_reason,
      sponsored_by = p_actor_id,
      approved_by = p_actor_id,
      review_at = p_review_at,
      max_renewals = normalized_max_renewals,
      updated_at = now()
  where id = created_id;

  update public.evaluation_access_events
  set details = details || jsonb_build_object(
    'program_type', normalized_program_type,
    'grant_reason', normalized_grant_reason,
    'review_at', p_review_at,
    'max_renewals', normalized_max_renewals
  )
  where cohort_id = created_id
    and event_type = 'cohort_created';

  return created_id;
end;
$$;

revoke all on function private.create_access_program_cohort(
  uuid, text, text, text, timestamptz, timestamptz, text, text, timestamptz, integer, uuid
) from public, anon, authenticated;
grant execute on function private.create_access_program_cohort(
  uuid, text, text, text, timestamptz, timestamptz, text, text, timestamptz, integer, uuid
) to service_role;

create or replace function public.create_my_access_program_cohort(
  p_account_id uuid,
  p_product_key text,
  p_name text,
  p_purpose text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_program_type text default 'standard_evaluation',
  p_grant_reason text default '',
  p_review_at timestamptz default null,
  p_max_renewals integer default 0
)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  actor_id uuid := (select auth.uid());
begin
  if actor_id is null then raise exception 'Authentication required'; end if;
  return private.create_access_program_cohort(
    p_account_id,
    p_product_key,
    p_name,
    p_purpose,
    p_starts_at,
    p_ends_at,
    p_program_type,
    p_grant_reason,
    p_review_at,
    p_max_renewals,
    actor_id
  );
end;
$$;

revoke all on function public.create_my_access_program_cohort(
  uuid, text, text, text, timestamptz, timestamptz, text, text, timestamptz, integer
) from public, anon, authenticated;
grant execute on function public.create_my_access_program_cohort(
  uuid, text, text, text, timestamptz, timestamptz, text, text, timestamptz, integer
) to authenticated, service_role;

-- Service-role-only lookup used by the invitation Edge Function. It verifies
-- the operator through the same canonical permission function before reading
-- auth.users, and returns only the minimum identity state needed for an
-- idempotent invite/provision decision.
create or replace function public.get_evaluation_invite_context(
  p_cohort_id uuid,
  p_email text,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public, private, pg_temp
as $$
declare
  normalized_email text := lower(btrim(coalesce(p_email, '')));
  target_user auth.users%rowtype;
begin
  perform private.require_license_manager(p_actor_id);

  if normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'A valid participant email is required';
  end if;
  if not exists (
    select 1
    from public.evaluation_cohorts cohort
    where cohort.id = p_cohort_id
      and cohort.status = 'active'
      and cohort.starts_at <= now()
      and cohort.ends_at > now()
  ) then
    raise exception 'The evaluation cohort is not active';
  end if;

  select auth_user.* into target_user
  from auth.users auth_user
  where lower(auth_user.email) = normalized_email
  limit 1;

  return jsonb_build_object(
    'email', normalized_email,
    'user_id', target_user.id,
    'has_signed_in', target_user.last_sign_in_at is not null
  );
end;
$$;

revoke all on function public.get_evaluation_invite_context(uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.get_evaluation_invite_context(uuid, text, uuid)
  to service_role;

-- Rich browser read model. The legacy service-role read model remains intact
-- for backend compatibility.
create or replace function private.get_access_program_cohorts(p_actor_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  result jsonb;
begin
  perform private.require_license_manager(p_actor_id);

  select coalesce(jsonb_agg(item.payload order by item.ends_at desc, item.created_at desc), '[]'::jsonb)
  into result
  from (
    select
      cohort.ends_at,
      cohort.created_at,
      to_jsonb(base_row) || jsonb_build_object(
        'program_type', cohort.program_type,
        'grant_reason', cohort.grant_reason,
        'review_at', cohort.review_at,
        'max_renewals', cohort.max_renewals,
        'renewal_count', cohort.renewal_count,
        'sponsored_by', cohort.sponsored_by,
        'sponsor_name', coalesce(nullif(btrim(sponsor.display_name), ''), nullif(btrim(sponsor.full_name), ''), sponsor.email),
        'approved_by', cohort.approved_by,
        'approver_name', coalesce(nullif(btrim(approver.display_name), ''), nullif(btrim(approver.full_name), ''), approver.email)
      ) as payload
    from (
      select
        cohort.id as cohort_id,
        account.id as account_id,
        account.display_name as account_name,
        cohort.product_key,
        cohort.name as cohort_name,
        cohort.purpose,
        cohort.status as cohort_status,
        cohort.starts_at,
        cohort.ends_at,
        count(member.id) as participant_count,
        count(member.id) filter (where member.status = 'active') as active_participant_count
      from public.evaluation_cohorts cohort
      join public.license_accounts account on account.id = cohort.account_id
      left join public.evaluation_cohort_members member on member.cohort_id = cohort.id
      group by cohort.id, account.id
    ) base_row
    join public.evaluation_cohorts cohort on cohort.id = base_row.cohort_id
    left join public.profiles sponsor on sponsor.id = cohort.sponsored_by
    left join public.profiles approver on approver.id = cohort.approved_by
  ) item;

  return result;
end;
$$;

revoke all on function private.get_access_program_cohorts(uuid)
  from public, anon, authenticated;
grant execute on function private.get_access_program_cohorts(uuid)
  to service_role;

create or replace function public.get_my_platform_admin_dashboard(
  p_include_evaluations boolean default false,
  p_include_access boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  actor_id uuid := (select auth.uid());
  result jsonb;
begin
  if actor_id is null then raise exception 'Authentication required'; end if;

  select jsonb_build_object(
    'overview', coalesce((select to_jsonb(item) from private.get_platform_admin_overview(actor_id) item), '{}'::jsonb),
    'licenses', coalesce((select jsonb_agg(to_jsonb(item)) from private.list_platform_licenses(actor_id, 250) item), '[]'::jsonb),
    'accounts', coalesce((select jsonb_agg(to_jsonb(item)) from private.list_platform_license_accounts(actor_id) item), '[]'::jsonb),
    'plans', coalesce((select jsonb_agg(to_jsonb(item)) from private.list_platform_license_plans(actor_id) item), '[]'::jsonb),
    'users', coalesce((select jsonb_agg(to_jsonb(item)) from private.list_platform_license_users(actor_id) item), '[]'::jsonb),
    'cohorts', case when p_include_evaluations then private.get_access_program_cohorts(actor_id) else '[]'::jsonb end,
    'access_users', case when p_include_access then
      coalesce((select jsonb_agg(to_jsonb(item)) from private.list_platform_access_users(actor_id) item), '[]'::jsonb)
      else '[]'::jsonb end
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_my_platform_admin_dashboard(boolean, boolean)
  from public, anon, authenticated;
grant execute on function public.get_my_platform_admin_dashboard(boolean, boolean)
  to authenticated, service_role;
