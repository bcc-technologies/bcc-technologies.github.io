-- Canonical MAP-Nano commercial request workflow.
-- Browser clients use scoped RPCs only; direct table access remains denied.

create table if not exists public.map_nano_commercial_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete restrict,
  account_id uuid references public.license_accounts(id) on delete set null,
  product_key text not null default 'map.nano' check (product_key = 'map.nano'),
  plan_key text not null check (plan_key in ('essential', 'professional', 'facility', 'institutional', 'project')),
  request_type text not null check (request_type in ('new_license', 'upgrade', 'institutional_quote', 'project_access', 'demo')),
  status text not null default 'pending' check (status in ('pending', 'in_review', 'resolved', 'declined', 'cancelled')),
  contact_name text not null check (char_length(btrim(contact_name)) between 2 and 160),
  contact_email text not null check (char_length(btrim(contact_email)) between 3 and 320 and contact_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  organization_name text not null check (char_length(btrim(organization_name)) between 2 and 240),
  country text not null check (char_length(btrim(country)) between 2 and 120),
  estimated_users integer not null check (estimated_users between 1 and 100000),
  analysis_volume text not null check (analysis_volume in ('under_100', '100_to_1000', 'over_1000', 'unknown')),
  message text check (message is null or char_length(message) <= 5000),
  cancelled_at timestamptz,
  cancellation_note text check (cancellation_note is null or char_length(cancellation_note) <= 500),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  resolution_note text check (resolution_note is null or char_length(resolution_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'cancelled' and cancelled_at is not null) or (status <> 'cancelled' and cancelled_at is null)),
  check ((reviewed_at is null and reviewed_by is null) or (reviewed_at is not null and reviewed_by is not null))
);

alter table public.map_nano_commercial_requests enable row level security;
drop policy if exists map_nano_commercial_requests_deny_direct_access on public.map_nano_commercial_requests;
create policy map_nano_commercial_requests_deny_direct_access
on public.map_nano_commercial_requests as restrictive for all to anon, authenticated
using (false) with check (false);
revoke all on table public.map_nano_commercial_requests from public, anon, authenticated;
grant select, insert, update, delete on table public.map_nano_commercial_requests to service_role;

create index if not exists map_nano_commercial_requests_requester_created_idx
  on public.map_nano_commercial_requests (requester_id, created_at desc);
create index if not exists map_nano_commercial_requests_account_created_idx
  on public.map_nano_commercial_requests (account_id, created_at desc) where account_id is not null;
create unique index if not exists map_nano_commercial_requests_one_open_change
  on public.map_nano_commercial_requests (product_key, (coalesce(account_id, requester_id)), plan_key, request_type)
  where status in ('pending', 'in_review');

create or replace function private.touch_map_nano_commercial_request()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function private.touch_map_nano_commercial_request() from public, anon, authenticated;
drop trigger if exists touch_map_nano_commercial_request on public.map_nano_commercial_requests;
create trigger touch_map_nano_commercial_request
before update on public.map_nano_commercial_requests
for each row execute function private.touch_map_nano_commercial_request();

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
returns table (request_id uuid, status text, created_at timestamptz)
language plpgsql security definer set search_path = public, pg_temp as $$
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
  if current_user_id is null then raise exception 'Authentication required'; end if;
  if normalized_plan_key not in ('essential', 'professional', 'facility', 'institutional', 'project') then
    raise exception 'The MAP-Nano plan is not valid';
  end if;
  if normalized_request_type not in ('new_license', 'upgrade', 'institutional_quote', 'project_access', 'demo') then
    raise exception 'The commercial request type is not valid';
  end if;
  if normalized_contact_name !~ '.{2,160}' then raise exception 'A contact name between 2 and 160 characters is required'; end if;
  if normalized_contact_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'A valid contact email is required'; end if;
  if normalized_organization_name !~ '.{2,240}' then raise exception 'An organization name between 2 and 240 characters is required'; end if;
  if normalized_country !~ '.{2,120}' then raise exception 'A country between 2 and 120 characters is required'; end if;
  if p_estimated_users is null or p_estimated_users < 1 or p_estimated_users > 100000 then raise exception 'Estimated users must be between 1 and 100000'; end if;
  if normalized_analysis_volume not in ('under_100', '100_to_1000', 'over_1000', 'unknown') then raise exception 'The analysis volume is not valid'; end if;
  if normalized_message is not null and char_length(normalized_message) > 5000 then raise exception 'The message cannot exceed 5000 characters'; end if;

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
    select 1 from public.map_nano_commercial_requests request
    where request.product_key = 'map.nano'
      and coalesce(request.account_id, request.requester_id) = coalesce(p_account_id, current_user_id)
      and request.plan_key = normalized_plan_key
      and request.request_type = normalized_request_type
      and request.status in ('pending', 'in_review')
  ) then
    raise exception 'An open commercial request already exists for this MAP-Nano plan' using errcode = 'unique_violation';
  end if;

  insert into public.map_nano_commercial_requests as request (
    requester_id, account_id, plan_key, request_type, contact_name, contact_email,
    organization_name, country, estimated_users, analysis_volume, message
  ) values (
    current_user_id, p_account_id, normalized_plan_key, normalized_request_type,
    normalized_contact_name, normalized_contact_email, normalized_organization_name,
    normalized_country, p_estimated_users, normalized_analysis_volume, normalized_message
  ) returning request.id, request.status, request.created_at
  into created_request_id, created_request_status, created_request_at;

  return query select created_request_id, created_request_status, created_request_at;
end;
$$;
revoke all on function private.create_my_map_nano_commercial_request(text, text, text, text, text, text, integer, text, text, uuid) from public, anon, authenticated;
grant execute on function private.create_my_map_nano_commercial_request(text, text, text, text, text, text, integer, text, text, uuid) to authenticated, service_role;

create or replace function public.create_my_map_nano_commercial_request(
  p_plan_key text, p_request_type text, p_contact_name text, p_contact_email text,
  p_organization_name text, p_country text, p_estimated_users integer, p_analysis_volume text,
  p_message text default null, p_account_id uuid default null
)
returns table (request_id uuid, status text, created_at timestamptz)
language sql security invoker set search_path = public, private, pg_temp as $$
  select * from private.create_my_map_nano_commercial_request(
    p_plan_key, p_request_type, p_contact_name, p_contact_email, p_organization_name,
    p_country, p_estimated_users, p_analysis_volume, p_message, p_account_id
  );
$$;
revoke all on function public.create_my_map_nano_commercial_request(text, text, text, text, text, text, integer, text, text, uuid) from public, anon;
grant execute on function public.create_my_map_nano_commercial_request(text, text, text, text, text, text, integer, text, text, uuid) to authenticated, service_role;

create or replace function private.get_my_map_nano_commercial_requests()
returns table (
  request_id uuid, account_id uuid, plan_key text, request_type text, status text,
  organization_name text, created_at timestamptz, updated_at timestamptz,
  cancelled_at timestamptz, can_cancel boolean
)
language sql stable security definer set search_path = public, pg_temp as $$
  with actor as (select (select auth.uid()) as user_id),
  accessible_requests as (
    select request.*, (
      request.requester_id = actor.user_id or exists (
        select 1 from public.license_account_members membership
        where membership.account_id = request.account_id
          and membership.user_id = actor.user_id
          and membership.revoked_at is null
          and membership.member_role in ('owner', 'admin')
      )
    ) as is_requester_or_account_manager
    from public.map_nano_commercial_requests request
    cross join actor
    where actor.user_id is not null and (
      request.requester_id = actor.user_id or exists (
        select 1 from public.license_account_members membership
        where membership.account_id = request.account_id
          and membership.user_id = actor.user_id
          and membership.revoked_at is null
          and membership.member_role in ('owner', 'admin')
      )
    )
  )
  select request.id, request.account_id, request.plan_key, request.request_type,
    request.status, request.organization_name, request.created_at, request.updated_at,
    request.cancelled_at,
    request.status in ('pending', 'in_review') and request.is_requester_or_account_manager
  from accessible_requests request
  order by request.created_at desc, request.id desc;
$$;
revoke all on function private.get_my_map_nano_commercial_requests() from public, anon, authenticated;
grant execute on function private.get_my_map_nano_commercial_requests() to authenticated, service_role;

create or replace function public.get_my_map_nano_commercial_requests()
returns table (
  request_id uuid, account_id uuid, plan_key text, request_type text, status text,
  organization_name text, created_at timestamptz, updated_at timestamptz,
  cancelled_at timestamptz, can_cancel boolean
)
language sql stable security invoker set search_path = public, private, pg_temp as $$
  select * from private.get_my_map_nano_commercial_requests();
$$;
revoke all on function public.get_my_map_nano_commercial_requests() from public, anon;
grant execute on function public.get_my_map_nano_commercial_requests() to authenticated, service_role;

create or replace function private.cancel_my_map_nano_commercial_request(
  p_request_id uuid,
  p_cancellation_note text default null
)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  current_user_id uuid := (select auth.uid());
  cancelled_request_id uuid;
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  if p_request_id is null then raise exception 'A commercial request is required'; end if;
  if p_cancellation_note is not null and char_length(btrim(p_cancellation_note)) > 500 then
    raise exception 'The cancellation note cannot exceed 500 characters';
  end if;

  update public.map_nano_commercial_requests request
  set status = 'cancelled',
      cancelled_at = now(),
      cancellation_note = nullif(btrim(coalesce(p_cancellation_note, '')), '')
  where request.id = p_request_id
    and request.status in ('pending', 'in_review')
    and (request.requester_id = current_user_id or exists (
      select 1 from public.license_account_members membership
      where membership.account_id = request.account_id
        and membership.user_id = current_user_id
        and membership.revoked_at is null
        and membership.member_role in ('owner', 'admin')
    ))
  returning request.id into cancelled_request_id;

  if cancelled_request_id is null then
    raise exception 'The commercial request is not open or cannot be cancelled by this user';
  end if;
  return cancelled_request_id;
end;
$$;
revoke all on function private.cancel_my_map_nano_commercial_request(uuid, text) from public, anon, authenticated;
grant execute on function private.cancel_my_map_nano_commercial_request(uuid, text) to authenticated, service_role;

create or replace function public.cancel_my_map_nano_commercial_request(
  p_request_id uuid,
  p_cancellation_note text default null
)
returns uuid language sql security invoker set search_path = public, private, pg_temp as $$
  select private.cancel_my_map_nano_commercial_request(p_request_id, p_cancellation_note);
$$;
revoke all on function public.cancel_my_map_nano_commercial_request(uuid, text) from public, anon;
grant execute on function public.cancel_my_map_nano_commercial_request(uuid, text) to authenticated, service_role;
