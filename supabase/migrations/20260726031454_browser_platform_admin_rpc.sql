-- Authenticated browser facade for MAP administration.
-- Actor identity always comes from auth.uid(); callers cannot impersonate another user.

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
    'cohorts', case when p_include_evaluations then
      coalesce((select jsonb_agg(to_jsonb(item)) from private.list_evaluation_cohorts(actor_id) item), '[]'::jsonb)
      else '[]'::jsonb end,
    'access_users', case when p_include_access then
      coalesce((select jsonb_agg(to_jsonb(item)) from private.list_platform_access_users(actor_id) item), '[]'::jsonb)
      else '[]'::jsonb end
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_my_platform_admin_dashboard(boolean, boolean) from public, anon, authenticated;
grant execute on function public.get_my_platform_admin_dashboard(boolean, boolean) to authenticated, service_role;

create or replace function public.list_my_evaluation_cohort_participants(p_cohort_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  actor_id uuid := (select auth.uid());
begin
  if actor_id is null then raise exception 'Authentication required'; end if;
  return coalesce((
    select jsonb_agg(to_jsonb(item))
    from private.list_evaluation_cohort_participants(p_cohort_id, actor_id) item
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.list_my_evaluation_cohort_participants(uuid) from public, anon, authenticated;
grant execute on function public.list_my_evaluation_cohort_participants(uuid) to authenticated, service_role;

create or replace function public.issue_my_platform_license(
  p_account_id uuid,
  p_plan_id uuid,
  p_seat_limit integer,
  p_starts_at timestamptz,
  p_ends_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare actor_id uuid := (select auth.uid()); created_id uuid;
begin
  if actor_id is null then raise exception 'Authentication required'; end if;
  select item.license_id into created_id
  from private.issue_platform_license(p_account_id, p_plan_id, p_seat_limit, p_starts_at, p_ends_at, actor_id) item;
  return created_id;
end;
$$;

revoke all on function public.issue_my_platform_license(uuid, uuid, integer, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.issue_my_platform_license(uuid, uuid, integer, timestamptz, timestamptz) to authenticated, service_role;

create or replace function public.assign_my_platform_license(p_license_id uuid, p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare actor_id uuid := (select auth.uid()); created_id uuid;
begin
  if actor_id is null then raise exception 'Authentication required'; end if;
  select item.assignment_id into created_id
  from private.assign_platform_license(p_license_id, p_user_id, actor_id) item;
  return created_id;
end;
$$;

revoke all on function public.assign_my_platform_license(uuid, uuid) from public, anon, authenticated;
grant execute on function public.assign_my_platform_license(uuid, uuid) to authenticated, service_role;

create or replace function public.revoke_my_platform_license(p_license_id uuid, p_reason text default '')
returns integer
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare actor_id uuid := (select auth.uid());
begin
  if actor_id is null then raise exception 'Authentication required'; end if;
  return private.revoke_platform_license(p_license_id, p_reason, actor_id);
end;
$$;

revoke all on function public.revoke_my_platform_license(uuid, text) from public, anon, authenticated;
grant execute on function public.revoke_my_platform_license(uuid, text) to authenticated, service_role;

create or replace function public.create_my_evaluation_account(p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare actor_id uuid := (select auth.uid()); created_id uuid;
begin
  if actor_id is null then raise exception 'Authentication required'; end if;
  select item.account_id into created_id from private.create_evaluation_account(p_display_name, actor_id) item;
  return created_id;
end;
$$;

revoke all on function public.create_my_evaluation_account(text) from public, anon, authenticated;
grant execute on function public.create_my_evaluation_account(text) to authenticated, service_role;

create or replace function public.create_my_evaluation_cohort(
  p_account_id uuid,
  p_product_key text,
  p_name text,
  p_purpose text,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare actor_id uuid := (select auth.uid()); created_id uuid;
begin
  if actor_id is null then raise exception 'Authentication required'; end if;
  select item.cohort_id into created_id
  from private.create_evaluation_cohort(p_account_id, p_product_key, p_name, p_purpose, p_starts_at, p_ends_at, actor_id) item;
  return created_id;
end;
$$;

revoke all on function public.create_my_evaluation_cohort(uuid, text, text, text, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.create_my_evaluation_cohort(uuid, text, text, text, timestamptz, timestamptz) to authenticated, service_role;

create or replace function public.provision_my_evaluation_participant(
  p_cohort_id uuid,
  p_email text
)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  actor_id uuid := (select auth.uid());
  target_user_id uuid;
  created_license_id uuid;
begin
  if actor_id is null then raise exception 'Authentication required'; end if;
  select profile.id into target_user_id
  from public.profiles profile
  where lower(profile.email) = lower(btrim(p_email))
  limit 1;
  if target_user_id is null then
    raise exception 'A registered BCC account is required before inviting this participant';
  end if;
  select item.license_id into created_license_id
  from private.provision_evaluation_access(p_cohort_id, target_user_id, 'active', null, actor_id) item;
  return created_license_id;
end;
$$;

revoke all on function public.provision_my_evaluation_participant(uuid, text) from public, anon, authenticated;
grant execute on function public.provision_my_evaluation_participant(uuid, text) to authenticated, service_role;

create or replace function public.revoke_my_evaluation_participant(
  p_cohort_id uuid,
  p_user_id uuid,
  p_reason text default ''
)
returns integer
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare actor_id uuid := (select auth.uid());
begin
  if actor_id is null then raise exception 'Authentication required'; end if;
  return private.revoke_evaluation_access(p_cohort_id, p_user_id, p_reason, actor_id);
end;
$$;

revoke all on function public.revoke_my_evaluation_participant(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.revoke_my_evaluation_participant(uuid, uuid, text) to authenticated, service_role;;
