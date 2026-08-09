-- Register the canonical live Stripe prices created for MAP-Nano.
-- Stripe Price amounts are immutable; replacing either amount requires a new
-- migration with the replacement Price ID rather than editing Stripe in place.

do $$
declare
  matching_plan_count integer;
begin
  select count(*)
  into matching_plan_count
  from public.license_plans
  where product_key = 'map.nano'
    and is_active = true
    and billing_model = 'subscription'
    and billing_interval = 'year'
    and self_serve_enabled = true
    and commercial_key in ('essential', 'professional');

  if matching_plan_count <> 2 then
    raise exception
      'Expected exactly two active annual self-service MAP-Nano plans; found %',
      matching_plan_count;
  end if;
end
$$;

with live_catalog(commercial_key, stripe_price_id, lookup_key, unit_amount) as (
  values
    (
      'essential',
      'price_1U2MPQ61z0I4dYgK2XuYLB8N',
      'map_nano_essential_usd_year',
      120000::bigint
    ),
    (
      'professional',
      'price_1U2MQ961z0I4dYgKjWKx8ZXl',
      'map_nano_professional_usd_year',
      300000::bigint
    )
)
insert into public.billing_price_catalog (
  plan_id,
  livemode,
  stripe_price_id,
  lookup_key,
  currency,
  unit_amount,
  recurring_interval,
  active
)
select
  plan.id,
  true,
  catalog.stripe_price_id,
  catalog.lookup_key,
  'usd',
  catalog.unit_amount,
  'year',
  true
from live_catalog catalog
join public.license_plans plan
  on plan.product_key = 'map.nano'
 and plan.commercial_key = catalog.commercial_key
on conflict (plan_id, livemode) do update
set stripe_price_id = excluded.stripe_price_id,
    lookup_key = excluded.lookup_key,
    currency = excluded.currency,
    unit_amount = excluded.unit_amount,
    recurring_interval = excluded.recurring_interval,
    active = excluded.active,
    updated_at = now();

do $$
declare
  matching_catalog_count integer;
begin
  select count(*)
  into matching_catalog_count
  from public.billing_price_catalog catalog
  join public.license_plans plan on plan.id = catalog.plan_id
  where plan.product_key = 'map.nano'
    and catalog.livemode = true
    and catalog.active = true
    and (
      (
        plan.commercial_key = 'essential'
        and catalog.stripe_price_id = 'price_1U2MPQ61z0I4dYgK2XuYLB8N'
        and catalog.lookup_key = 'map_nano_essential_usd_year'
        and catalog.currency = 'usd'
        and catalog.unit_amount = 120000
        and catalog.recurring_interval = 'year'
      )
      or
      (
        plan.commercial_key = 'professional'
        and catalog.stripe_price_id = 'price_1U2MQ961z0I4dYgKjWKx8ZXl'
        and catalog.lookup_key = 'map_nano_professional_usd_year'
        and catalog.currency = 'usd'
        and catalog.unit_amount = 300000
        and catalog.recurring_interval = 'year'
      )
    );

  if matching_catalog_count <> 2 then
    raise exception
      'Live MAP-Nano Stripe catalog verification failed; matched % of 2 rows',
      matching_catalog_count;
  end if;
end
$$;
