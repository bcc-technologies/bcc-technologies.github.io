create or replace function public.reconcile_analytics_identity(
  session_id text,
  visitor_id text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_user_id uuid := auth.uid();
  actor_role_value text := '';
  actor_is_internal boolean := false;
  updated_count integer := 0;
  clean_session_id text := left(trim(coalesce(session_id, '')), 120);
  clean_visitor_id text := left(trim(coalesce(visitor_id, '')), 120);
begin
  if actor_user_id is null then
    return 0;
  end if;

  select coalesce(nullif(lower(trim(role)), ''), 'client')
    into actor_role_value
  from public.profiles
  where id = actor_user_id
  limit 1;

  actor_role_value := coalesce(actor_role_value, 'client');
  if actor_role_value not in ('client', 'staff', 'admin') then
    actor_role_value := 'client';
  end if;
  actor_is_internal := actor_role_value in ('staff', 'admin');

  update public.analytics_events
  set
    user_id = actor_user_id,
    actor_role = actor_role_value,
    is_internal = actor_is_internal
  where created_at >= now() - interval '30 days'
    and (
      (clean_visitor_id <> '' and visitor_id = clean_visitor_id)
      or (clean_session_id <> '' and session_id = clean_session_id)
    )
    and (
      user_id is null
      or user_id = actor_user_id
      or actor_is_internal = true
    );

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

revoke all on function public.reconcile_analytics_identity(text, text) from public, anon, authenticated;
grant execute on function public.reconcile_analytics_identity(text, text) to authenticated;;
