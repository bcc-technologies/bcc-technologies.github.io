-- Canonical MAP trial policy.
--
-- The standard offer is seven days. During early access, the active campaign
-- extends new evaluation licenses to fourteen days. Evaluation provisioning
-- already reads license_plans.default_duration_days, so a private trigger keeps
-- that operational value synchronized with the selected policy.

create table if not exists public.map_trial_policies (
  policy_key text primary key check (policy_key ~ '^[a-z][a-z0-9_]*$'),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 120),
  duration_days integer not null check (duration_days between 1 and 90),
  is_campaign boolean not null default false,
  is_active boolean not null default false,
  priority integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.map_trial_policies enable row level security;
alter table public.map_trial_policies force row level security;
revoke all on table public.map_trial_policies from public, anon, authenticated;
grant select on table public.map_trial_policies to anon, authenticated;
grant select, insert, update, delete on table public.map_trial_policies to service_role;

drop policy if exists "Public read active MAP trial offers" on public.map_trial_policies;
create policy "Public read active MAP trial offers"
on public.map_trial_policies
for select
to anon, authenticated
using (is_active);

create or replace function private.touch_map_trial_policy_updated_at()
returns trigger
language plpgsql
set search_path = private, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.touch_map_trial_policy_updated_at() from public, anon, authenticated;

drop trigger if exists touch_map_trial_policy_updated_at on public.map_trial_policies;
create trigger touch_map_trial_policy_updated_at
before update on public.map_trial_policies
for each row execute function private.touch_map_trial_policy_updated_at();

insert into public.map_trial_policies (
  policy_key, display_name, duration_days, is_campaign, is_active, priority
)
values
  ('standard', 'Prueba gratuita', 7, false, true, 0),
  ('early_access', 'Early access', 14, true, true, 100)
on conflict (policy_key) do update set
  display_name = excluded.display_name,
  duration_days = excluded.duration_days,
  is_campaign = excluded.is_campaign,
  is_active = excluded.is_active,
  priority = excluded.priority,
  updated_at = now();

create or replace function private.current_map_trial_offer()
returns table (
  policy_key text,
  display_name text,
  duration_days integer,
  is_campaign boolean
)
language sql
stable
security definer
set search_path = private, pg_temp
as $$
  select
    policy.policy_key,
    policy.display_name,
    policy.duration_days,
    policy.is_campaign
  from public.map_trial_policies policy
  where policy.is_active
  order by policy.priority desc, policy.policy_key
  limit 1;
$$;

revoke all on function private.current_map_trial_offer() from public, anon, authenticated;
grant execute on function private.current_map_trial_offer() to service_role;

create or replace function private.sync_map_trial_plan_duration()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  selected_duration integer;
begin
  select offer.duration_days
  into selected_duration
  from private.current_map_trial_offer() offer;

  if selected_duration is null then
    raise exception 'At least one MAP trial policy must remain active';
  end if;

  update public.license_plans plan
  set default_duration_days = selected_duration,
      updated_at = now()
  from public.license_types license_type
  where license_type.key = plan.license_type_key
    and license_type.is_evaluation
    and plan.default_duration_days is distinct from selected_duration;

  return null;
end;
$$;

revoke all on function private.sync_map_trial_plan_duration() from public, anon, authenticated;
grant execute on function private.sync_map_trial_plan_duration() to service_role;

drop trigger if exists sync_map_trial_plan_duration on public.map_trial_policies;
create trigger sync_map_trial_plan_duration
after insert or update or delete on public.map_trial_policies
for each statement execute function private.sync_map_trial_plan_duration();

update public.license_plans plan
set default_duration_days = offer.duration_days,
    updated_at = now()
from public.license_types license_type,
     private.current_map_trial_offer() offer
where license_type.key = plan.license_type_key
  and license_type.is_evaluation
  and plan.default_duration_days is distinct from offer.duration_days;

create or replace function public.get_current_map_trial_offer()
returns table (
  policy_key text,
  display_name text,
  duration_days integer,
  is_campaign boolean
)
language sql
stable
security invoker
set search_path = public, private, pg_temp
as $$
  select
    policy.policy_key,
    policy.display_name,
    policy.duration_days,
    policy.is_campaign
  from public.map_trial_policies policy
  where policy.is_active
  order by policy.priority desc, policy.policy_key
  limit 1;
$$;

revoke all on function public.get_current_map_trial_offer() from public;
grant execute on function public.get_current_map_trial_offer() to anon, authenticated, service_role;;
