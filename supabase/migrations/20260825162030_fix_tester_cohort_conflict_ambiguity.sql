-- Avoid PL/pgSQL resolving the output parameter cohort_id against the
-- evaluation_cohort_members conflict target. Naming the unique constraint
-- keeps the UPSERT explicit without changing the function's public contract.

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
    on conflict on constraint evaluation_cohort_members_cohort_id_user_id_key do update
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
