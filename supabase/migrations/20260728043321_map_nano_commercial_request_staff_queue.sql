-- Staff-only MAP-Nano commercial request queue.
-- Contact details remain available only through explicitly authorized RPCs.

create or replace function private.get_my_map_nano_commercial_request_queue(
  p_status text default null,
  p_limit integer default 200
)
returns table (
  request_id uuid,
  account_id uuid,
  plan_key text,
  request_type text,
  status text,
  contact_name text,
  contact_email text,
  organization_name text,
  country text,
  estimated_users integer,
  analysis_volume text,
  message text,
  created_at timestamptz,
  updated_at timestamptz,
  cancelled_at timestamptz,
  cancellation_note text,
  reviewed_at timestamptz,
  reviewed_by_name text,
  resolution_note text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := (select auth.uid());
  normalized_status text := nullif(lower(btrim(coalesce(p_status, ''))), '');
  requested_limit integer := greatest(1, least(coalesce(p_limit, 200), 200));
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  perform private.require_license_manager(current_user_id);

  if normalized_status is not null
    and normalized_status not in ('pending', 'in_review', 'resolved', 'declined', 'cancelled') then
    raise exception 'The commercial request status is not valid';
  end if;

  return query
  select
    request.id,
    request.account_id,
    request.plan_key,
    request.request_type,
    request.status,
    request.contact_name,
    request.contact_email,
    request.organization_name,
    request.country,
    request.estimated_users,
    request.analysis_volume,
    request.message,
    request.created_at,
    request.updated_at,
    request.cancelled_at,
    request.cancellation_note,
    request.reviewed_at,
    coalesce(
      nullif(btrim(reviewer.display_name), ''),
      nullif(btrim(reviewer.full_name), ''),
      nullif(btrim(reviewer.email), '')
    ),
    request.resolution_note
  from public.map_nano_commercial_requests request
  left join public.profiles reviewer on reviewer.id = request.reviewed_by
  where normalized_status is null or request.status = normalized_status
  order by request.created_at desc, request.id desc
  limit requested_limit;
end;
$$;

revoke all on function private.get_my_map_nano_commercial_request_queue(text, integer) from public, anon, authenticated;
grant execute on function private.get_my_map_nano_commercial_request_queue(text, integer) to authenticated, service_role;

create or replace function public.get_my_map_nano_commercial_request_queue(
  p_status text default null,
  p_limit integer default 200
)
returns table (
  request_id uuid,
  account_id uuid,
  plan_key text,
  request_type text,
  status text,
  contact_name text,
  contact_email text,
  organization_name text,
  country text,
  estimated_users integer,
  analysis_volume text,
  message text,
  created_at timestamptz,
  updated_at timestamptz,
  cancelled_at timestamptz,
  cancellation_note text,
  reviewed_at timestamptz,
  reviewed_by_name text,
  resolution_note text
)
language sql
stable
security invoker
set search_path = public, private, pg_temp
as $$
  select * from private.get_my_map_nano_commercial_request_queue(p_status, p_limit);
$$;

revoke all on function public.get_my_map_nano_commercial_request_queue(text, integer) from public, anon;
grant execute on function public.get_my_map_nano_commercial_request_queue(text, integer) to authenticated, service_role;

create or replace function private.review_my_map_nano_commercial_request(
  p_request_id uuid,
  p_status text,
  p_resolution_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := (select auth.uid());
  normalized_status text := lower(btrim(coalesce(p_status, '')));
  normalized_resolution_note text := nullif(btrim(coalesce(p_resolution_note, '')), '');
  reviewed_request_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  perform private.require_license_manager(current_user_id);

  if p_request_id is null then
    raise exception 'A commercial request is required';
  end if;
  if normalized_status not in ('in_review', 'resolved', 'declined') then
    raise exception 'The commercial request review status is not valid';
  end if;
  if normalized_resolution_note is not null and char_length(normalized_resolution_note) > 2000 then
    raise exception 'The resolution note cannot exceed 2000 characters';
  end if;
  if normalized_status in ('resolved', 'declined') and normalized_resolution_note is null then
    raise exception 'A resolution note is required when resolving or declining a commercial request';
  end if;

  update public.map_nano_commercial_requests request
  set status = normalized_status,
      reviewed_at = now(),
      reviewed_by = current_user_id,
      resolution_note = normalized_resolution_note
  where request.id = p_request_id
    and request.status in ('pending', 'in_review')
  returning request.id into reviewed_request_id;

  if reviewed_request_id is null then
    raise exception 'The commercial request is not open for review';
  end if;

  return reviewed_request_id;
end;
$$;

revoke all on function private.review_my_map_nano_commercial_request(uuid, text, text) from public, anon, authenticated;
grant execute on function private.review_my_map_nano_commercial_request(uuid, text, text) to authenticated, service_role;

create or replace function public.review_my_map_nano_commercial_request(
  p_request_id uuid,
  p_status text,
  p_resolution_note text default null
)
returns uuid
language sql
security invoker
set search_path = public, private, pg_temp
as $$
  select private.review_my_map_nano_commercial_request(p_request_id, p_status, p_resolution_note);
$$;

revoke all on function public.review_my_map_nano_commercial_request(uuid, text, text) from public, anon;
grant execute on function public.review_my_map_nano_commercial_request(uuid, text, text) to authenticated, service_role;;
