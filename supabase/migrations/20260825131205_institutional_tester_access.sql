-- Separate each user's individual MAP account from an optional institution
-- and an optional institution cohort. Organization license accounts remain the
-- canonical institution records, preserving all existing commercial behavior.

create table public.institution_domains (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.license_accounts(id) on delete cascade,
  domain text not null,
  status text not null default 'pending' check (status in ('pending', 'verified', 'disabled')),
  verified_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (domain = lower(btrim(domain))),
  check (domain ~ '^[a-z0-9][a-z0-9.-]*[.][a-z0-9-]+$'),
  check ((status = 'verified' and verified_at is not null) or status <> 'verified')
);

create unique index institution_domains_unique_domain
  on public.institution_domains (domain);

create index institution_domains_institution_status_lookup
  on public.institution_domains (institution_id, status, domain);

create index institution_domains_created_by_idx
  on public.institution_domains (created_by)
  where created_by is not null;

alter table public.institution_domains enable row level security;
revoke all on table public.institution_domains from public, anon, authenticated;
grant select, insert, update, delete on table public.institution_domains to service_role;

create or replace function private.validate_institution_domain()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.domain := regexp_replace(lower(btrim(new.domain)), '^@', '');
  if not exists (
    select 1
    from public.license_accounts account
    where account.id = new.institution_id
      and account.account_kind = 'organization'
      and account.status = 'active'
  ) then
    raise exception 'An institution domain requires an active institution';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.validate_institution_domain()
  from public, anon, authenticated;

create trigger validate_institution_domain
before insert or update of institution_id, domain, status, verified_at
on public.institution_domains
for each row execute function private.validate_institution_domain();

alter table public.platform_licenses
  add column institution_id uuid references public.license_accounts(id) on delete set null,
  add column access_program_type text,
  add column access_grant_reason text,
  add column access_review_at timestamptz,
  add column access_sponsored_by uuid references auth.users(id) on delete set null;

alter table public.platform_licenses
  add constraint platform_licenses_access_program_type_check
  check (
    access_program_type is null
    or access_program_type in ('standard_evaluation', 'partner_test', 'complimentary_pilot')
  );

alter table public.platform_licenses
  add constraint platform_licenses_access_grant_reason_check
  check (
    access_program_type is null
    or access_program_type = 'standard_evaluation'
    or char_length(btrim(coalesce(access_grant_reason, ''))) >= 10
  );

create index platform_licenses_institution_status_lookup
  on public.platform_licenses (institution_id, status, starts_at, ends_at)
  where institution_id is not null;

create index platform_licenses_access_sponsored_by_idx
  on public.platform_licenses (access_sponsored_by)
  where access_sponsored_by is not null;

alter table public.evaluation_access_events
  alter column cohort_id drop not null,
  add column institution_id uuid references public.license_accounts(id) on delete set null;

create index evaluation_access_events_institution_time_lookup
  on public.evaluation_access_events (institution_id, occurred_at desc)
  where institution_id is not null;

update public.platform_licenses license
set institution_id = cohort.account_id,
    access_program_type = cohort.program_type,
    access_grant_reason = nullif(btrim(cohort.grant_reason), ''),
    access_review_at = cohort.review_at,
    access_sponsored_by = cohort.sponsored_by,
    metadata = coalesce(license.metadata, '{}'::jsonb) || jsonb_build_object(
      'tester_access', true,
      'institution_id', cohort.account_id
    )
from public.evaluation_cohorts cohort
where license.evaluation_cohort_id = cohort.id
  and license.source = 'evaluation';

update public.evaluation_access_events event
set institution_id = cohort.account_id
from public.evaluation_cohorts cohort
where event.cohort_id = cohort.id
  and event.institution_id is null;

create or replace function private.create_institution(
  p_display_name text,
  p_domain text,
  p_actor_id uuid
)
returns table (institution_id uuid, display_name text, verified_domain text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_name text := btrim(coalesce(p_display_name, ''));
  normalized_domain text := nullif(
    regexp_replace(lower(btrim(coalesce(p_domain, ''))), '^@', ''),
    ''
  );
  created_account public.license_accounts%rowtype;
begin
  perform private.require_license_manager(p_actor_id);

  if char_length(normalized_name) not between 1 and 160 then
    raise exception 'An institution name must contain between 1 and 160 characters';
  end if;
  if normalized_domain is not null
    and normalized_domain !~ '^[a-z0-9][a-z0-9.-]*[.][a-z0-9-]+$' then
    raise exception 'The institution domain is not valid';
  end if;

  insert into public.license_accounts (account_kind, display_name)
  values ('organization', normalized_name)
  returning * into created_account;

  if normalized_domain is not null then
    insert into public.institution_domains (
      institution_id, domain, status, verified_at, created_by
    ) values (
      created_account.id, normalized_domain, 'verified', now(), p_actor_id
    );
  end if;

  return query
  select created_account.id, created_account.display_name, normalized_domain;
end;
$$;

revoke all on function private.create_institution(text, text, uuid)
  from public, anon, authenticated;
grant execute on function private.create_institution(text, text, uuid)
  to service_role;

create or replace function public.create_my_institution(
  p_display_name text,
  p_domain text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  created_id uuid;
begin
  if actor_id is null then raise exception 'Authentication required'; end if;

  select item.institution_id into created_id
  from private.create_institution(p_display_name, p_domain, actor_id) item;

  return created_id;
end;
$$;

revoke all on function public.create_my_institution(text, text)
  from public, anon, authenticated;
grant execute on function public.create_my_institution(text, text)
  to authenticated, service_role;

create or replace function private.list_platform_institutions(p_actor_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  perform private.require_platform_permission(p_actor_id, 'platform.licenses.read');

  select coalesce(
    jsonb_agg(item.payload order by item.display_name, item.institution_id),
    '[]'::jsonb
  )
  into result
  from (
    select
      account.id as institution_id,
      account.display_name,
      jsonb_build_object(
        'institution_id', account.id,
        'display_name', account.display_name,
        'status', account.status,
        'verified_domains', coalesce((
          select jsonb_agg(domain.domain order by domain.domain)
          from public.institution_domains domain
          where domain.institution_id = account.id
            and domain.status = 'verified'
        ), '[]'::jsonb),
        'member_count', (
          select count(*)
          from public.license_account_members member
          where member.account_id = account.id
            and member.revoked_at is null
        )
      ) as payload
    from public.license_accounts account
    where account.account_kind = 'organization'
      and account.status = 'active'
  ) item;

  return result;
end;
$$;

revoke all on function private.list_platform_institutions(uuid)
  from public, anon, authenticated;
grant execute on function private.list_platform_institutions(uuid)
  to service_role;

create or replace function private.ensure_individual_license_account_for_user(
  p_user_id uuid,
  p_actor_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  individual_account_id uuid;
  account_name text;
begin
  perform private.require_license_manager(p_actor_id);

  select coalesce(
    nullif(btrim(profile.display_name), ''),
    nullif(btrim(profile.full_name), ''),
    auth_user.email,
    'MAP user'
  )
  into account_name
  from auth.users auth_user
  left join public.profiles profile on profile.id = auth_user.id
  where auth_user.id = p_user_id;

  if not found then raise exception 'The tester user does not exist'; end if;

  insert into public.license_accounts (
    account_kind, display_name, individual_owner_id
  ) values (
    'individual', account_name, p_user_id
  )
  on conflict (individual_owner_id) where account_kind = 'individual'
  do update set
    display_name = coalesce(
      nullif(public.license_accounts.display_name, ''),
      excluded.display_name
    ),
    updated_at = now()
  returning id into individual_account_id;

  insert into public.license_account_members (
    account_id, user_id, member_role, added_by
  ) values (
    individual_account_id, p_user_id, 'owner', p_actor_id
  )
  on conflict (account_id, user_id) where revoked_at is null do nothing;

  return individual_account_id;
end;
$$;

revoke all on function private.ensure_individual_license_account_for_user(uuid, uuid)
  from public, anon, authenticated;
grant execute on function private.ensure_individual_license_account_for_user(uuid, uuid)
  to service_role;

create or replace function private.get_tester_invite_context(
  p_institution_id uuid,
  p_cohort_id uuid,
  p_email text,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text := lower(btrim(coalesce(p_email, '')));
  email_domain text;
  target_user auth.users%rowtype;
  cohort_institution_id uuid;
  effective_institution_id uuid := p_institution_id;
  suggested_institution_id uuid;
begin
  perform private.require_license_manager(p_actor_id);

  if normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'A valid participant email is required';
  end if;
  email_domain := split_part(normalized_email, '@', 2);

  if p_cohort_id is not null then
    select cohort.account_id into cohort_institution_id
    from public.evaluation_cohorts cohort
    where cohort.id = p_cohort_id
      and cohort.status = 'active'
      and cohort.starts_at <= now()
      and cohort.ends_at > now();

    if cohort_institution_id is null then
      raise exception 'The evaluation cohort is not active';
    end if;
    if effective_institution_id is not null
      and effective_institution_id <> cohort_institution_id then
      raise exception 'The cohort does not belong to the selected institution';
    end if;
    effective_institution_id := cohort_institution_id;
  end if;

  if effective_institution_id is not null and not exists (
    select 1
    from public.license_accounts account
    where account.id = effective_institution_id
      and account.account_kind = 'organization'
      and account.status = 'active'
  ) then
    raise exception 'The selected institution is not active';
  end if;

  select domain.institution_id into suggested_institution_id
  from public.institution_domains domain
  where domain.domain = email_domain
    and domain.status = 'verified'
  limit 1;

  select auth_user.* into target_user
  from auth.users auth_user
  where lower(auth_user.email) = normalized_email
  limit 1;

  return jsonb_build_object(
    'email', normalized_email,
    'user_id', target_user.id,
    'has_signed_in', target_user.last_sign_in_at is not null,
    'institution_id', effective_institution_id,
    'suggested_institution_id', suggested_institution_id
  );
end;
$$;

revoke all on function private.get_tester_invite_context(uuid, uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function private.get_tester_invite_context(uuid, uuid, text, uuid)
  to service_role;

create or replace function public.get_tester_invite_context(
  p_institution_id uuid,
  p_cohort_id uuid,
  p_email text,
  p_actor_id uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.get_tester_invite_context(
    p_institution_id, p_cohort_id, p_email, p_actor_id
  );
$$;

revoke all on function public.get_tester_invite_context(uuid, uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.get_tester_invite_context(uuid, uuid, text, uuid)
  to service_role;

create or replace function private.provision_tester_access(
  p_institution_id uuid,
  p_cohort_id uuid,
  p_user_id uuid,
  p_member_status text,
  p_product_key text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_grant_reason text,
  p_review_at timestamptz,
  p_actor_id uuid
)
returns table (
  license_id uuid,
  member_status text,
  valid_until timestamptz,
  institution_id uuid,
  cohort_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  cohort_row public.evaluation_cohorts%rowtype;
  evaluation_plan public.license_plans%rowtype;
  effective_institution_id uuid := p_institution_id;
  individual_account_id uuid;
  effective_product_key text := nullif(btrim(coalesce(p_product_key, '')), '');
  effective_starts_at timestamptz := coalesce(p_starts_at, now());
  effective_ends_at timestamptz := p_ends_at;
  effective_program_type text := 'partner_test';
  effective_grant_reason text := btrim(coalesce(p_grant_reason, ''));
  effective_review_at timestamptz := p_review_at;
  existing_license_id uuid;
  existing_cohort_id uuid;
  existing_institution_id uuid;
  existing_valid_until timestamptz;
  existing_is_tester boolean;
begin
  perform private.require_license_manager(p_actor_id);

  if p_member_status not in ('invited', 'active') then
    raise exception 'A tester can only be provisioned as invited or active';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'The tester user does not exist';
  end if;

  if p_cohort_id is not null then
    select * into cohort_row
    from public.evaluation_cohorts
    where id = p_cohort_id
    for update;

    if not found
      or cohort_row.status <> 'active'
      or cohort_row.starts_at > now()
      or cohort_row.ends_at <= now() then
      raise exception 'The evaluation cohort is not active';
    end if;
    if cohort_row.program_type <> 'partner_test' then
      raise exception 'Tester access requires a partner tester cohort';
    end if;
    if effective_institution_id is not null
      and effective_institution_id <> cohort_row.account_id then
      raise exception 'The cohort does not belong to the selected institution';
    end if;

    effective_institution_id := cohort_row.account_id;
    effective_product_key := cohort_row.product_key;
    effective_starts_at := greatest(now(), cohort_row.starts_at);
    effective_ends_at := least(cohort_row.ends_at, coalesce(p_ends_at, cohort_row.ends_at));
    effective_program_type := cohort_row.program_type;
    effective_grant_reason := cohort_row.grant_reason;
    effective_review_at := cohort_row.review_at;
  end if;

  if effective_institution_id is not null and not exists (
    select 1
    from public.license_accounts account
    where account.id = effective_institution_id
      and account.account_kind = 'organization'
      and account.status = 'active'
  ) then
    raise exception 'The selected institution is not active';
  end if;
  if effective_product_key is null then raise exception 'A MAP product is required'; end if;

  select plan.* into evaluation_plan
  from public.license_plans plan
  join public.license_types license_type on license_type.key = plan.license_type_key
  where plan.product_key = effective_product_key
    and plan.is_active
    and license_type.is_evaluation
  limit 1;

  if not found then
    raise exception 'No active evaluation plan exists for the product';
  end if;
  if effective_ends_at is null or effective_ends_at <= effective_starts_at then
    raise exception 'Tester access requires a valid start and end time';
  end if;
  if char_length(effective_grant_reason) < 10 then
    raise exception 'Tester access requires a grant reason of at least 10 characters';
  end if;
  if effective_review_at is not null
    and (
      effective_review_at <= effective_starts_at
      or effective_review_at >= effective_ends_at
    ) then
    raise exception 'The review date must fall inside the tester access window';
  end if;

  individual_account_id :=
    private.ensure_individual_license_account_for_user(p_user_id, p_actor_id);

  if effective_institution_id is not null then
    insert into public.license_account_members (
      account_id, user_id, member_role, added_by
    ) values (
      effective_institution_id, p_user_id, 'member', p_actor_id
    )
    on conflict (account_id, user_id) where revoked_at is null do nothing;
  end if;

  if p_cohort_id is not null then
    insert into public.evaluation_cohort_members (
      cohort_id, user_id, status, invited_by, invited_at, activated_at,
      revoked_at, revocation_reason
    ) values (
      p_cohort_id, p_user_id, p_member_status, p_actor_id, now(),
      case when p_member_status = 'active' then now() else null end,
      null, null
    )
    on conflict (cohort_id, user_id) do update
    set status = excluded.status,
        invited_by = excluded.invited_by,
        invited_at = excluded.invited_at,
        activated_at = case
          when excluded.status = 'active'
            then coalesce(public.evaluation_cohort_members.activated_at, now())
          else null
        end,
        revoked_at = null,
        revocation_reason = null,
        updated_at = now();
  end if;

  select license.id, license.evaluation_cohort_id, license.institution_id,
    license.ends_at,
    coalesce((license.metadata ->> 'tester_access')::boolean, false)
  into existing_license_id, existing_cohort_id, existing_institution_id,
    existing_valid_until, existing_is_tester
  from public.license_assignments assignment
  join public.platform_licenses license on license.id = assignment.license_id
  join public.license_plans plan on plan.id = license.plan_id
  where assignment.user_id = p_user_id
    and assignment.unassigned_at is null
    and license.status = 'active'
    and license.starts_at <= now()
    and (license.ends_at is null or license.ends_at > now())
    and plan.product_key = effective_product_key
  order by license.created_at desc
  limit 1;

  if existing_license_id is not null then
    if existing_is_tester
      and existing_cohort_id is not distinct from p_cohort_id
      and existing_institution_id is not distinct from effective_institution_id then
      return query
      select existing_license_id, p_member_status, existing_valid_until,
        existing_institution_id, existing_cohort_id;
      return;
    end if;
    raise exception 'The user already has active MAP access for this product';
  end if;

  insert into public.platform_licenses (
    account_id, plan_id, status, source, seat_limit, starts_at, ends_at,
    issued_by, evaluation_cohort_id, institution_id, access_program_type,
    access_grant_reason, access_review_at, access_sponsored_by, metadata
  ) values (
    individual_account_id, evaluation_plan.id, 'active', 'evaluation', 1,
    effective_starts_at, effective_ends_at, p_actor_id, p_cohort_id,
    effective_institution_id, effective_program_type, effective_grant_reason,
    effective_review_at, p_actor_id,
    jsonb_build_object(
      'tester_access', true,
      'institution_id', effective_institution_id
    )
  )
  returning id into existing_license_id;

  insert into public.license_assignments (license_id, user_id, assigned_by)
  values (existing_license_id, p_user_id, p_actor_id);

  insert into public.evaluation_access_events (
    cohort_id, institution_id, user_id, license_id, event_type, actor_id, details
  ) values (
    p_cohort_id, effective_institution_id, p_user_id, existing_license_id,
    'license_issued', p_actor_id,
    jsonb_build_object(
      'direct_access', p_cohort_id is null,
      'program_type', effective_program_type
    )
  );

  if p_cohort_id is not null then
    insert into public.evaluation_access_events (
      cohort_id, institution_id, user_id, license_id, event_type, actor_id
    ) values (
      p_cohort_id, effective_institution_id, p_user_id, existing_license_id,
      case
        when p_member_status = 'invited' then 'participant_invited'
        else 'participant_activated'
      end,
      p_actor_id
    );
  end if;

  return query
  select existing_license_id, p_member_status, effective_ends_at,
    effective_institution_id, p_cohort_id;
end;
$$;

revoke all on function private.provision_tester_access(
  uuid, uuid, uuid, text, text, timestamptz, timestamptz, text, timestamptz, uuid
) from public, anon, authenticated;
grant execute on function private.provision_tester_access(
  uuid, uuid, uuid, text, text, timestamptz, timestamptz, text, timestamptz, uuid
) to service_role;

create or replace function public.provision_tester_access(
  p_institution_id uuid,
  p_cohort_id uuid,
  p_user_id uuid,
  p_member_status text,
  p_product_key text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_grant_reason text,
  p_review_at timestamptz,
  p_actor_id uuid
)
returns table (
  license_id uuid,
  member_status text,
  valid_until timestamptz,
  institution_id uuid,
  cohort_id uuid
)
language sql
security invoker
set search_path = ''
as $$
  select *
  from private.provision_tester_access(
    p_institution_id, p_cohort_id, p_user_id, p_member_status,
    p_product_key, p_starts_at, p_ends_at, p_grant_reason,
    p_review_at, p_actor_id
  );
$$;

revoke all on function public.provision_tester_access(
  uuid, uuid, uuid, text, text, timestamptz, timestamptz, text, timestamptz, uuid
) from public, anon, authenticated;
grant execute on function public.provision_tester_access(
  uuid, uuid, uuid, text, text, timestamptz, timestamptz, text, timestamptz, uuid
) to service_role;

create or replace function private.provision_evaluation_access(
  p_cohort_id uuid,
  p_user_id uuid,
  p_member_status text,
  p_requested_ends_at timestamptz,
  p_actor_id uuid
)
returns table (license_id uuid, member_status text, valid_until timestamptz)
language sql
security definer
set search_path = ''
as $$
  select provisioned.license_id, provisioned.member_status, provisioned.valid_until
  from private.provision_tester_access(
    null, p_cohort_id, p_user_id, p_member_status, null, null,
    p_requested_ends_at, '', null, p_actor_id
  ) provisioned;
$$;

revoke all on function private.provision_evaluation_access(
  uuid, uuid, text, timestamptz, uuid
) from public, anon, authenticated;
grant execute on function private.provision_evaluation_access(
  uuid, uuid, text, timestamptz, uuid
) to service_role;

create or replace function public.get_my_platform_admin_dashboard(
  p_include_evaluations boolean default false,
  p_include_access boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  result jsonb;
begin
  if actor_id is null then raise exception 'Authentication required'; end if;

  select jsonb_build_object(
    'overview', coalesce((
      select to_jsonb(item)
      from private.get_platform_admin_overview(actor_id) item
    ), '{}'::jsonb),
    'licenses', coalesce((
      select jsonb_agg(to_jsonb(item))
      from private.list_platform_licenses(actor_id, 250) item
    ), '[]'::jsonb),
    'accounts', coalesce((
      select jsonb_agg(to_jsonb(item))
      from private.list_platform_license_accounts(actor_id) item
    ), '[]'::jsonb),
    'institutions', private.list_platform_institutions(actor_id),
    'plans', coalesce((
      select jsonb_agg(to_jsonb(item))
      from private.list_platform_license_plans(actor_id) item
    ), '[]'::jsonb),
    'users', coalesce((
      select jsonb_agg(to_jsonb(item))
      from private.list_platform_license_users(actor_id) item
    ), '[]'::jsonb),
    'cohorts', case
      when p_include_evaluations
        then private.get_access_program_cohorts(actor_id)
      else '[]'::jsonb
    end,
    'access_users', case
      when p_include_access then coalesce((
        select jsonb_agg(to_jsonb(item))
        from private.list_platform_access_users(actor_id) item
      ), '[]'::jsonb)
      else '[]'::jsonb
    end
  )
  into result;

  return result;
end;
$$;

revoke all on function public.get_my_platform_admin_dashboard(boolean, boolean)
  from public, anon, authenticated;
grant execute on function public.get_my_platform_admin_dashboard(boolean, boolean)
  to authenticated, service_role;
