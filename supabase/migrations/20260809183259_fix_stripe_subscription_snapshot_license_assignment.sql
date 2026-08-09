create or replace function public.sync_stripe_subscription_snapshot(p_snapshot jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_account_id uuid := (p_snapshot->>'account_id')::uuid;
  purchaser_user_id uuid := nullif(p_snapshot->>'purchaser_user_id', '')::uuid;
  target_plan record;
  customer_id uuid;
  subscription_id uuid;
  target_license_id uuid;
  license_status text;
  subscription_status text := p_snapshot->>'status';
  period_start timestamptz := nullif(p_snapshot->>'current_period_start', '')::timestamptz;
  period_end timestamptz := nullif(p_snapshot->>'current_period_end', '')::timestamptz;
begin
  if subscription_status not in ('incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused') then
    raise exception 'Unsupported Stripe subscription status';
  end if;

  select plan.* into target_plan
  from public.billing_price_catalog price
  join public.license_plans plan on plan.id = price.plan_id
  where price.stripe_price_id = p_snapshot->>'stripe_price_id'
    and price.livemode = (p_snapshot->>'livemode')::boolean
    and plan.product_key = 'map.nano'
    and plan.commercial_key = p_snapshot->>'commercial_plan_key';
  if not found then raise exception 'Stripe price does not match the MAP-Nano plan catalog'; end if;

  insert into public.billing_customers (account_id, stripe_customer_id, livemode, email)
  values (target_account_id, p_snapshot->>'stripe_customer_id', (p_snapshot->>'livemode')::boolean, nullif(p_snapshot->>'customer_email', ''))
  on conflict (account_id, livemode) do update
  set stripe_customer_id = excluded.stripe_customer_id,
      email = coalesce(excluded.email, public.billing_customers.email),
      updated_at = now()
  returning id into customer_id;

  license_status := case
    when subscription_status in ('active', 'trialing') then 'active'
    when subscription_status in ('canceled', 'incomplete_expired') then 'expired'
    else 'suspended'
  end;

  select id into target_license_id from public.platform_licenses
  where external_reference = 'stripe:' || (p_snapshot->>'stripe_subscription_id');

  if target_license_id is null then
    insert into public.platform_licenses (
      account_id, plan_id, status, source, external_reference, seat_limit,
      starts_at, ends_at, issued_by, metadata
    ) values (
      target_account_id, target_plan.id, license_status, 'checkout',
      'stripe:' || (p_snapshot->>'stripe_subscription_id'), target_plan.default_seat_limit,
      coalesce(period_start, now()), period_end, purchaser_user_id,
      jsonb_build_object('stripe_subscription_id', p_snapshot->>'stripe_subscription_id')
    ) returning id into target_license_id;
  else
    update public.platform_licenses
    set account_id = target_account_id,
        plan_id = target_plan.id,
        status = license_status,
        seat_limit = target_plan.default_seat_limit,
        starts_at = coalesce(period_start, starts_at),
        ends_at = period_end,
        metadata = metadata || jsonb_build_object('stripe_subscription_id', p_snapshot->>'stripe_subscription_id'),
        updated_at = now()
    where id = target_license_id;
  end if;

  insert into public.billing_subscriptions (
    account_id, billing_customer_id, plan_id, product_key, platform_license_id,
    stripe_subscription_id, stripe_price_id, status, current_period_start,
    current_period_end, cancel_at_period_end, canceled_at, latest_invoice_id,
    livemode, metadata
  ) values (
    target_account_id, customer_id, target_plan.id, target_plan.product_key, target_license_id,
    p_snapshot->>'stripe_subscription_id', p_snapshot->>'stripe_price_id', subscription_status,
    period_start, period_end, coalesce((p_snapshot->>'cancel_at_period_end')::boolean, false),
    nullif(p_snapshot->>'canceled_at', '')::timestamptz, nullif(p_snapshot->>'latest_invoice_id', ''),
    (p_snapshot->>'livemode')::boolean,
    jsonb_build_object('commercial_plan_key', target_plan.commercial_key)
  )
  on conflict (stripe_subscription_id) do update
  set account_id = excluded.account_id,
      billing_customer_id = excluded.billing_customer_id,
      plan_id = excluded.plan_id,
      product_key = excluded.product_key,
      platform_license_id = excluded.platform_license_id,
      stripe_price_id = excluded.stripe_price_id,
      status = excluded.status,
      current_period_start = excluded.current_period_start,
      current_period_end = excluded.current_period_end,
      cancel_at_period_end = excluded.cancel_at_period_end,
      canceled_at = excluded.canceled_at,
      latest_invoice_id = excluded.latest_invoice_id,
      metadata = excluded.metadata,
      updated_at = now()
  returning id into subscription_id;

  if license_status = 'active' and purchaser_user_id is not null and exists (
    select 1 from public.license_account_members member
    where member.account_id = target_account_id and member.user_id = purchaser_user_id and member.revoked_at is null
  ) then
    insert into public.license_assignments (license_id, user_id, assigned_by)
    values (target_license_id, purchaser_user_id, purchaser_user_id)
    on conflict (license_id, user_id) where unassigned_at is null do nothing;
  end if;

  return jsonb_build_object(
    'subscription_id', subscription_id,
    'license_id', target_license_id,
    'license_status', license_status
  );
end;
$$;

revoke all on function public.sync_stripe_subscription_snapshot(jsonb) from public, anon, authenticated;
grant execute on function public.sync_stripe_subscription_snapshot(jsonb) to service_role;
