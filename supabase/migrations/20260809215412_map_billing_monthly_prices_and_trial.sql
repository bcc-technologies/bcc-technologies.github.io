-- Expand MAP-Nano self-service billing to monthly and annual Prices and add
-- an account/user-scoped, server-reserved 14-day Stripe trial.

alter table public.billing_price_catalog
  drop constraint if exists billing_price_catalog_plan_id_livemode_key;

create unique index if not exists billing_price_catalog_plan_mode_interval_unique
  on public.billing_price_catalog (plan_id, livemode, recurring_interval);

alter table public.billing_price_catalog
  add column if not exists trial_period_days smallint not null default 14
  check (trial_period_days between 0 and 90);

insert into public.billing_price_catalog (
  plan_id, livemode, stripe_price_id, lookup_key, currency, unit_amount,
  recurring_interval, trial_period_days, active
)
select
  plan.id, true, catalog.stripe_price_id, catalog.lookup_key, 'usd',
  catalog.unit_amount, 'month', 14, true
from (
  values
    ('essential', 'price_1U2eO361z0I4dYgKCrV0KcHo', 'map_nano_essential_usd_month', 12000::bigint),
    ('professional', 'price_1U2eOC61z0I4dYgKxmosZL0C', 'map_nano_professional_usd_month', 30000::bigint)
) as catalog(commercial_key, stripe_price_id, lookup_key, unit_amount)
join public.license_plans plan
  on plan.product_key = 'map.nano'
 and plan.commercial_key = catalog.commercial_key
on conflict (stripe_price_id) do update
set lookup_key = excluded.lookup_key,
    currency = excluded.currency,
    unit_amount = excluded.unit_amount,
    recurring_interval = excluded.recurring_interval,
    trial_period_days = excluded.trial_period_days,
    active = excluded.active,
    updated_at = now();

create table if not exists public.billing_trial_claims (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.license_accounts(id) on delete restrict,
  user_id uuid not null,
  product_key text not null references public.platform_products(key) on delete restrict,
  livemode boolean not null,
  request_id uuid not null unique,
  state text not null default 'reserved' check (state in ('reserved', 'redeemed', 'released')),
  trial_period_days smallint not null check (trial_period_days between 1 and 90),
  reserved_until timestamptz not null,
  stripe_checkout_session_id text unique,
  stripe_subscription_id text unique,
  trial_start timestamptz,
  trial_end timestamptz,
  redeemed_at timestamptz,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (trial_end is null or trial_start is null or trial_end > trial_start)
);

create unique index if not exists billing_trial_claims_redeemed_account_unique
  on public.billing_trial_claims (account_id, product_key, livemode)
  where state = 'redeemed';

create unique index if not exists billing_trial_claims_redeemed_user_unique
  on public.billing_trial_claims (user_id, product_key, livemode)
  where state = 'redeemed';

create unique index if not exists billing_trial_claims_reserved_account_unique
  on public.billing_trial_claims (account_id, product_key, livemode)
  where state = 'reserved';

create unique index if not exists billing_trial_claims_reserved_user_unique
  on public.billing_trial_claims (user_id, product_key, livemode)
  where state = 'reserved';

alter table public.billing_trial_claims enable row level security;
revoke all on table public.billing_trial_claims from public, anon, authenticated;
grant select, insert, update, delete on table public.billing_trial_claims to service_role;

drop function if exists public.get_map_checkout_context(uuid, uuid, text, boolean);

create function public.get_map_checkout_context(
  p_actor_id uuid,
  p_account_id uuid,
  p_plan_key text,
  p_billing_interval text,
  p_livemode boolean
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  target_account_id uuid := p_account_id;
  plan_record record;
  price_record record;
  customer_record record;
  subscription_record record;
begin
  if p_actor_id is null then raise exception 'Authentication required'; end if;
  if lower(trim(p_billing_interval)) not in ('month', 'year') then
    raise exception 'Invalid MAP-Nano billing interval';
  end if;

  if target_account_id is null then
    select member.account_id into target_account_id
    from public.license_account_members member
    join public.license_accounts account on account.id = member.account_id
    where member.user_id = p_actor_id
      and member.revoked_at is null
      and member.member_role in ('owner', 'admin')
      and account.status = 'active'
    order by (account.account_kind = 'individual') desc, member.added_at
    limit 1;
  end if;

  if target_account_id is null or not private.can_manage_billing_account(p_actor_id, target_account_id) then
    raise exception 'You cannot manage billing for this account';
  end if;

  select * into plan_record
  from public.license_plans
  where product_key = 'map.nano'
    and commercial_key = lower(trim(p_plan_key))
    and is_active
    and self_serve_enabled
    and billing_model = 'subscription';
  if not found then raise exception 'This MAP-Nano plan is not available for self-service checkout'; end if;

  select * into price_record
  from public.billing_price_catalog
  where plan_id = plan_record.id
    and livemode = p_livemode
    and recurring_interval = lower(trim(p_billing_interval))
    and active;
  if not found then raise exception 'No active Stripe price is configured for this plan, interval, and mode'; end if;

  select * into customer_record
  from public.billing_customers
  where account_id = target_account_id and livemode = p_livemode;

  select subscription.* into subscription_record
  from public.billing_subscriptions subscription
  where subscription.account_id = target_account_id
    and subscription.product_key = 'map.nano'
    and subscription.livemode = p_livemode
    and subscription.status in ('incomplete', 'trialing', 'active', 'past_due', 'unpaid', 'paused')
  order by subscription.updated_at desc
  limit 1;

  if subscription_record.id is not null then
    raise exception 'This account already has an open MAP-Nano subscription';
  end if;

  return jsonb_build_object(
    'account_id', target_account_id,
    'plan_id', plan_record.id,
    'plan_key', plan_record.commercial_key,
    'plan_name', plan_record.display_name,
    'stripe_price_id', price_record.stripe_price_id,
    'currency', price_record.currency,
    'unit_amount', price_record.unit_amount,
    'recurring_interval', price_record.recurring_interval,
    'trial_period_days', price_record.trial_period_days,
    'stripe_customer_id', customer_record.stripe_customer_id
  );
end;
$$;

revoke all on function public.get_map_checkout_context(uuid, uuid, text, text, boolean) from public, anon, authenticated;
grant execute on function public.get_map_checkout_context(uuid, uuid, text, text, boolean) to service_role;

create or replace function public.reserve_map_billing_trial(
  p_actor_id uuid,
  p_account_id uuid,
  p_plan_key text,
  p_billing_interval text,
  p_livemode boolean,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  trial_days smallint;
  existing_claim record;
  claim_id uuid;
begin
  if p_actor_id is null then raise exception 'Authentication required'; end if;
  if not private.can_manage_billing_account(p_actor_id, p_account_id) then
    raise exception 'You cannot manage billing for this account';
  end if;

  select price.trial_period_days into trial_days
  from public.billing_price_catalog price
  join public.license_plans plan on plan.id = price.plan_id
  where plan.product_key = 'map.nano'
    and plan.commercial_key = lower(trim(p_plan_key))
    and price.recurring_interval = lower(trim(p_billing_interval))
    and price.livemode = p_livemode
    and price.active;
  if not found then raise exception 'No active trial offer is configured for this plan and interval'; end if;
  if trial_days <= 0 then return jsonb_build_object('eligible', false, 'trial_period_days', 0); end if;

  update public.billing_trial_claims
  set state = 'released', released_at = now(), updated_at = now()
  where state = 'reserved'
    and reserved_until <= now()
    and product_key = 'map.nano'
    and livemode = p_livemode
    and (account_id = p_account_id or user_id = p_actor_id);

  select * into existing_claim
  from public.billing_trial_claims
  where product_key = 'map.nano'
    and livemode = p_livemode
    and state = 'redeemed'
    and (account_id = p_account_id or user_id = p_actor_id)
  limit 1;
  if found then return jsonb_build_object('eligible', false, 'trial_period_days', 0); end if;

  select * into existing_claim
  from public.billing_trial_claims
  where request_id = p_request_id;
  if found then
    if existing_claim.account_id <> p_account_id or existing_claim.user_id <> p_actor_id or existing_claim.state <> 'reserved' then
      raise exception 'The trial reservation request is not reusable';
    end if;
    return jsonb_build_object('eligible', true, 'claim_id', existing_claim.id, 'trial_period_days', existing_claim.trial_period_days);
  end if;

  if exists (
    select 1 from public.billing_trial_claims
    where product_key = 'map.nano'
      and livemode = p_livemode
      and state = 'reserved'
      and (account_id = p_account_id or user_id = p_actor_id)
  ) then
    raise exception 'A MAP-Nano trial checkout is already pending';
  end if;

  insert into public.billing_trial_claims (
    account_id, user_id, product_key, livemode, request_id,
    trial_period_days, reserved_until
  ) values (
    p_account_id, p_actor_id, 'map.nano', p_livemode, p_request_id,
    trial_days, now() + interval '35 minutes'
  ) returning id into claim_id;

  return jsonb_build_object('eligible', true, 'claim_id', claim_id, 'trial_period_days', trial_days);
end;
$$;

revoke all on function public.reserve_map_billing_trial(uuid, uuid, text, text, boolean, uuid) from public, anon, authenticated;
grant execute on function public.reserve_map_billing_trial(uuid, uuid, text, text, boolean, uuid) to service_role;

create or replace function public.attach_map_billing_trial_session(
  p_actor_id uuid,
  p_claim_id uuid,
  p_request_id uuid,
  p_stripe_checkout_session_id text
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  update public.billing_trial_claims
  set stripe_checkout_session_id = p_stripe_checkout_session_id,
      updated_at = now()
  where id = p_claim_id
    and user_id = p_actor_id
    and request_id = p_request_id
    and state = 'reserved';
  if not found then raise exception 'Trial reservation could not be attached to Checkout'; end if;
end;
$$;

revoke all on function public.attach_map_billing_trial_session(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.attach_map_billing_trial_session(uuid, uuid, uuid, text) to service_role;

create or replace function public.release_map_billing_trial(
  p_actor_id uuid,
  p_claim_id uuid,
  p_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  update public.billing_trial_claims
  set state = 'released', released_at = now(), updated_at = now()
  where id = p_claim_id
    and user_id = p_actor_id
    and request_id = p_request_id
    and state = 'reserved'
    and stripe_checkout_session_id is null;
end;
$$;

revoke all on function public.release_map_billing_trial(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.release_map_billing_trial(uuid, uuid, uuid) to service_role;

create or replace function public.release_map_billing_trial_by_session(
  p_stripe_checkout_session_id text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.billing_trial_claims
  set state = 'released', released_at = now(), updated_at = now()
  where stripe_checkout_session_id = p_stripe_checkout_session_id
    and state = 'reserved';
end;
$$;

revoke all on function public.release_map_billing_trial_by_session(text) from public, anon, authenticated;
grant execute on function public.release_map_billing_trial_by_session(text) to service_role;

create or replace function public.redeem_map_billing_trial(
  p_claim_id uuid,
  p_stripe_subscription_id text,
  p_account_id uuid,
  p_user_id uuid,
  p_livemode boolean,
  p_trial_start timestamptz,
  p_trial_end timestamptz
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare existing_claim record;
begin
  select * into existing_claim from public.billing_trial_claims where id = p_claim_id for update;
  if not found then raise exception 'Unknown MAP-Nano trial claim'; end if;
  if existing_claim.state = 'redeemed' and existing_claim.stripe_subscription_id = p_stripe_subscription_id then return; end if;
  if existing_claim.state <> 'reserved'
     or existing_claim.account_id <> p_account_id
     or existing_claim.user_id <> p_user_id
     or existing_claim.product_key <> 'map.nano'
     or existing_claim.livemode <> p_livemode
     or p_trial_start is null
     or p_trial_end is null then
    raise exception 'MAP-Nano trial claim does not match the Stripe subscription';
  end if;

  update public.billing_trial_claims
  set state = 'redeemed',
      stripe_subscription_id = p_stripe_subscription_id,
      trial_start = p_trial_start,
      trial_end = p_trial_end,
      redeemed_at = now(),
      updated_at = now()
  where id = p_claim_id;
end;
$$;

revoke all on function public.redeem_map_billing_trial(uuid, text, uuid, uuid, boolean, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.redeem_map_billing_trial(uuid, text, uuid, uuid, boolean, timestamptz, timestamptz) to service_role;

create or replace function private.get_my_map_billing_dashboard()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'subscription_id', subscription.id,
    'account_id', subscription.account_id,
    'product_key', subscription.product_key,
    'plan_id', subscription.plan_id,
    'commercial_plan_key', plan.commercial_key,
    'plan_name', plan.display_name,
    'license_id', subscription.platform_license_id,
    'status', subscription.status,
    'billing_interval', price.recurring_interval,
    'current_period_start', subscription.current_period_start,
    'current_period_end', subscription.current_period_end,
    'trial_end', trial_claim.trial_end,
    'cancel_at_period_end', subscription.cancel_at_period_end,
    'can_manage_billing', member.member_role in ('owner', 'admin')
  ) order by subscription.updated_at desc), '[]'::jsonb)
  from public.billing_subscriptions subscription
  join public.license_plans plan on plan.id = subscription.plan_id
  join public.billing_price_catalog price
    on price.stripe_price_id = subscription.stripe_price_id
   and price.livemode = subscription.livemode
  join public.license_account_members member on member.account_id = subscription.account_id
  left join public.billing_trial_claims trial_claim
    on trial_claim.stripe_subscription_id = subscription.stripe_subscription_id
   and trial_claim.state = 'redeemed'
  where member.user_id = auth.uid() and member.revoked_at is null;
$$;

revoke all on function private.get_my_map_billing_dashboard() from public, anon, authenticated;
grant execute on function private.get_my_map_billing_dashboard() to authenticated, service_role;

do $$
declare matching_catalog_count integer;
begin
  select count(*) into matching_catalog_count
  from public.billing_price_catalog catalog
  join public.license_plans plan on plan.id = catalog.plan_id
  where plan.product_key = 'map.nano'
    and plan.commercial_key in ('essential', 'professional')
    and catalog.livemode = true
    and catalog.active = true
    and catalog.trial_period_days = 14
    and (
      (plan.commercial_key = 'essential' and catalog.recurring_interval = 'month' and catalog.stripe_price_id = 'price_1U2eO361z0I4dYgKCrV0KcHo' and catalog.unit_amount = 12000)
      or (plan.commercial_key = 'essential' and catalog.recurring_interval = 'year' and catalog.stripe_price_id = 'price_1U2MPQ61z0I4dYgK2XuYLB8N' and catalog.unit_amount = 120000)
      or (plan.commercial_key = 'professional' and catalog.recurring_interval = 'month' and catalog.stripe_price_id = 'price_1U2eOC61z0I4dYgKxmosZL0C' and catalog.unit_amount = 30000)
      or (plan.commercial_key = 'professional' and catalog.recurring_interval = 'year' and catalog.stripe_price_id = 'price_1U2MQ961z0I4dYgKjWKx8ZXl' and catalog.unit_amount = 300000)
    );
  if matching_catalog_count <> 4 then raise exception 'MAP-Nano monthly/annual live catalog verification failed'; end if;
end;
$$;

;
