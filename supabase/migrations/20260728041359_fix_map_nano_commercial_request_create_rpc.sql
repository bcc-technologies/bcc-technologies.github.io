create or replace function private.create_my_map_nano_commercial_request(
  p_plan_key text,
  p_request_type text,
  p_contact_name text,
  p_contact_email text,
  p_organization_name text,
  p_country text,
  p_estimated_users integer,
  p_analysis_volume text,
  p_message text default null,
  p_account_id uuid default null
)
returns table (
  request_id uuid,
  status text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := (select auth.uid());
  normalized_plan_key text := lower(btrim(coalesce(p_plan_key, '')));
  normalized_request_type text := lower(btrim(coalesce(p_request_type, '')));
  normalized_contact_name text := btrim(coalesce(p_contact_name, ''));
  normalized_contact_email text := lower(btrim(coalesce(p_contact_email, '')));
  normalized_organization_name text := btrim(coalesce(p_organization_name, ''));
  normalized_country text := btrim(coalesce(p_country, ''));
  normalized_analysis_volume text := lower(btrim(coalesce(p_analysis_volume, '')));
  normalized_message text := nullif(btrim(coalesce(p_message, '')), '');
  created_request_id uuid;
  created_request_status text;
  created_request_at timestamptz;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if normalized_plan_key not in ('essential', 'professional', 'facility', 'institutional', 'project') then
    raise exception 'The MAP-Nano plan is not valid';
  end if;
  if normalized_request_type not in ('new_license', 'upgrade', 'institutional_quote', 'project_access', 'demo') then
    raise exception 'The commercial request type is not valid';
  end if;
  if normalized_contact_name !~ '.{2,160}' then
    raise exception 'A contact name between 2 and 160 characters is required';
  end if;
  if normalized_contact_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'A valid contact email is required';
  end if;
  if normalized_organization_name !~ '.{2,240}' then
    raise exception 'An organization name between 2 and 240 characters is required';
  end if;
  if normalized_country !~ '.{2,120}' then
    raise exception 'A country between 2 and 120 characters is required';
  end if;
  if p_estimated_users is null or p_estimated_users < 1 or p_estimated_users > 100000 then
    raise exception 'Estimated users must be between 1 and 100000';
  end if;
  if normalized_analysis_volume not in ('under_100', '100_to_1000', 'over_1000', 'unknown') then
    raise exception 'The analysis volume is not valid';
  end if;
  if normalized_message is not null and char_length(normalized_message) > 5000 then
    raise exception 'The message cannot exceed 5000 characters';
  end if;

  if p_account_id is not null and not exists (
    select 1
    from public.license_account_members membership
    join public.license_accounts account on account.id = membership.account_id
    where membership.account_id = p_account_id
      and membership.user_id = current_user_id
      and membership.revoked_at is null
      and membership.member_role in ('owner', 'admin')
      and account.status = 'active'
  ) then
    raise exception 'Only an account owner or administrator can create a commercial request for this account';
  end if;

  if exists (
    select 1
    from public.map_nano_commercial_requests request
    where request.product_key = 'map.nano'
      and coalesce(request.account_id, request.requester_id) = coalesce(p_account_id, current_user_id)
      and request.plan_key = normalized_plan_key
      and request.request_type = normalized_request_type
      and request.status in ('pending', 'in_review')
  ) then
    raise exception 'An open commercial request already exists for this MAP-Nano plan'
      using errcode = 'unique_violation';
  end if;

  insert into public.map_nano_commercial_requests as request (
    requester_id,
    account_id,
    plan_key,
    request_type,
    contact_name,
    contact_email,
    organization_name,
    country,
    estimated_users,
    analysis_volume,
    message
  ) values (
    current_user_id,
    p_account_id,
    normalized_plan_key,
    normalized_request_type,
    normalized_contact_name,
    normalized_contact_email,
    normalized_organization_name,
    normalized_country,
    p_estimated_users,
    normalized_analysis_volume,
    normalized_message
  )
  returning request.id, request.status, request.created_at
  into created_request_id, created_request_status, created_request_at;

  return query
  select created_request_id, created_request_status, created_request_at;
end;
$$;

revoke all on function private.create_my_map_nano_commercial_request(text, text, text, text, text, text, integer, text, text, uuid)
  from public, anon, authenticated;
grant execute on function private.create_my_map_nano_commercial_request(text, text, text, text, text, text, integer, text, text, uuid)
  to authenticated, service_role;;
