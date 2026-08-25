-- Reuse an exact actor/account trial reservation so returning from Stripe
-- Checkout does not block the user behind the duplicate-trial guard.

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
  where product_key = 'map.nano'
    and livemode = p_livemode
    and state = 'reserved'
    and account_id = p_account_id
    and user_id = p_actor_id
  order by created_at desc
  limit 1;
  if found then
    return jsonb_build_object(
      'eligible', true,
      'reused', true,
      'claim_id', existing_claim.id,
      'stripe_checkout_session_id', existing_claim.stripe_checkout_session_id,
      'trial_period_days', existing_claim.trial_period_days
    );
  end if;

  if exists (
    select 1 from public.billing_trial_claims
    where product_key = 'map.nano'
      and livemode = p_livemode
      and state = 'reserved'
      and (account_id = p_account_id or user_id = p_actor_id)
  ) then
    raise exception 'A MAP-Nano trial checkout is already pending for this account or user';
  end if;

  insert into public.billing_trial_claims (
    account_id, user_id, product_key, livemode, request_id,
    trial_period_days, reserved_until
  ) values (
    p_account_id, p_actor_id, 'map.nano', p_livemode, p_request_id,
    trial_days, now() + interval '35 minutes'
  ) returning id into claim_id;

  return jsonb_build_object(
    'eligible', true,
    'reused', false,
    'claim_id', claim_id,
    'stripe_checkout_session_id', null,
    'trial_period_days', trial_days
  );
end;
$$;

revoke all on function public.reserve_map_billing_trial(uuid, uuid, text, text, boolean, uuid) from public, anon, authenticated;
grant execute on function public.reserve_map_billing_trial(uuid, uuid, text, text, boolean, uuid) to service_role;

;
