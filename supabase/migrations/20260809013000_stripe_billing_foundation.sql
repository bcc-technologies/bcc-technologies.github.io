-- MAP commercial billing foundation.
--
-- Stripe is the payment/subscription authority. Platform licenses remain the
-- authorization authority. Only the service role can write billing state;
-- authenticated clients use narrowly scoped RPCs.

alter table public.license_plans
  drop constraint if exists license_plans_product_key_license_type_key_key;

alter table public.license_plans
  add column if not exists commercial_key text,
  add column if not exists billing_model text not null default 'none',
  add column if not exists billing_interval text,
  add column if not exists self_serve_enabled boolean not null default false;

alter table public.license_plans
  drop constraint if exists license_plans_commercial_key_format,
  add constraint license_plans_commercial_key_format
    check (commercial_key is null or commercial_key ~ '^[a-z][a-z0-9_]*$'),
  drop constraint if exists license_plans_billing_model_check,
  add constraint license_plans_billing_model_check
    check (billing_model in ('none', 'subscription', 'quote', 'one_time')),
  drop constraint if exists license_plans_billing_interval_check,
  add constraint license_plans_billing_interval_check
    check (billing_interval is null or billing_interval in ('month', 'year', 'project', 'custom')),
  drop constraint if exists license_plans_billing_consistency,
  add constraint license_plans_billing_consistency check (
    (billing_model = 'none' and billing_interval is null and not self_serve_enabled)
    or (billing_model = 'subscription' and billing_interval in ('month', 'year'))
    or (billing_model = 'quote' and billing_interval in ('year', 'project', 'custom') and not self_serve_enabled)
    or (billing_model = 'one_time' and billing_interval = 'project')
  );

create unique index if not exists license_plans_commercial_key_unique
  on public.license_plans (product_key, commercial_key)
  where commercial_key is not null;

create unique index if not exists license_plans_noncommercial_type_unique
  on public.license_plans (product_key, license_type_key)
  where commercial_key is null;

update public.license_plans
set display_name = 'MAP-Nano Essential',
    commercial_key = 'essential',
    billing_model = 'subscription',
    billing_interval = 'year',
    self_serve_enabled = true,
    default_seat_limit = 1,
    default_duration_days = null,
    updated_at = now()
where product_key = 'map.nano'
  and license_type_key = 'named_user'
  and commercial_key is null;

update public.license_plans
set display_name = 'MAP-Nano Facility',
    commercial_key = 'facility',
    billing_model = 'quote',
    billing_interval = 'year',
    self_serve_enabled = false,
    default_seat_limit = 5,
    default_duration_days = null,
    updated_at = now()
where product_key = 'map.nano'
  and license_type_key = 'organization'
  and commercial_key is null;

insert into public.license_plans (
  product_key, license_type_key, display_name, default_seat_limit,
  default_duration_days, is_active, commercial_key, billing_model,
  billing_interval, self_serve_enabled
)
values
  ('map.nano', 'named_user', 'MAP-Nano Professional', 1, null, true, 'professional', 'subscription', 'year', true),
  ('map.nano', 'organization', 'MAP-Nano Institutional', 1, null, true, 'institutional', 'quote', 'custom', false)
on conflict (product_key, commercial_key) where commercial_key is not null do update
set display_name = excluded.display_name,
    default_seat_limit = excluded.default_seat_limit,
    default_duration_days = excluded.default_duration_days,
    is_active = excluded.is_active,
    billing_model = excluded.billing_model,
    billing_interval = excluded.billing_interval,
    self_serve_enabled = excluded.self_serve_enabled,
    updated_at = now();

insert into public.platform_capabilities (key, product_key, access_kind, description)
values
  ('map.nano.analysis.basic', 'map.nano', 'product', 'Essential quantitative MAP-Nano analysis.'),
  ('map.nano.analysis.advanced', 'map.nano', 'product', 'Professional MAP-Nano analysis modules.'),
  ('map.nano.batch', 'map.nano', 'product', 'Batch image processing.'),
  ('map.nano.pipelines.reuse', 'map.nano', 'product', 'Reusable analysis pipelines.'),
  ('map.nano.pipelines.share', 'map.nano', 'product', 'Shared pipeline library.'),
  ('map.nano.samples.compare', 'map.nano', 'product', 'Cross-sample comparison.'),
  ('map.nano.reports.auto', 'map.nano', 'product', 'Automatic professional reports.'),
  ('map.nano.audit', 'map.nano', 'product', 'Analysis audit trail.'),
  ('map.nano.reports.institutional', 'map.nano', 'product', 'Institutional report templates.'),
  ('map.nano.api', 'map.nano', 'developer', 'MAP-Nano API and integration access.'),
  ('map.nano.support.priority', 'map.nano', 'product', 'Priority MAP-Nano support.')
on conflict (key) do update
set product_key = excluded.product_key,
    access_kind = excluded.access_kind,
    description = excluded.description;

with plan_capabilities(commercial_key, capability_key) as (
  values
    ('essential', 'map.workspace.access'),
    ('essential', 'map.nano.use'),
    ('essential', 'map.nano.analysis.basic'),
    ('professional', 'map.workspace.access'),
    ('professional', 'map.nano.use'),
    ('professional', 'map.nano.analysis.basic'),
    ('professional', 'map.nano.analysis.advanced'),
    ('professional', 'map.nano.batch'),
    ('professional', 'map.nano.pipelines.reuse'),
    ('professional', 'map.nano.samples.compare'),
    ('professional', 'map.nano.reports.auto'),
    ('facility', 'map.workspace.access'),
    ('facility', 'map.nano.use'),
    ('facility', 'map.nano.analysis.basic'),
    ('facility', 'map.nano.analysis.advanced'),
    ('facility', 'map.nano.batch'),
    ('facility', 'map.nano.pipelines.reuse'),
    ('facility', 'map.nano.pipelines.share'),
    ('facility', 'map.nano.samples.compare'),
    ('facility', 'map.nano.reports.auto'),
    ('facility', 'map.nano.audit'),
    ('facility', 'map.nano.reports.institutional'),
    ('facility', 'map.nano.support.priority'),
    ('institutional', 'map.workspace.access'),
    ('institutional', 'map.nano.use'),
    ('institutional', 'map.nano.analysis.basic'),
    ('institutional', 'map.nano.analysis.advanced'),
    ('institutional', 'map.nano.batch'),
    ('institutional', 'map.nano.pipelines.reuse'),
    ('institutional', 'map.nano.pipelines.share'),
    ('institutional', 'map.nano.samples.compare'),
    ('institutional', 'map.nano.reports.auto'),
    ('institutional', 'map.nano.audit'),
    ('institutional', 'map.nano.reports.institutional'),
    ('institutional', 'map.nano.api'),
    ('institutional', 'map.nano.support.priority')
)
insert into public.license_plan_capabilities (plan_id, capability_key)
select plan.id, plan_capabilities.capability_key
from plan_capabilities
join public.license_plans plan
  on plan.product_key = 'map.nano'
 and plan.commercial_key = plan_capabilities.commercial_key
on conflict (plan_id, capability_key) do nothing;

create table if not exists public.billing_price_catalog (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.license_plans(id) on delete restrict,
  livemode boolean not null,
  stripe_price_id text not null check (stripe_price_id ~ '^price_[A-Za-z0-9]+$'),
  lookup_key text,
  currency text not null check (currency ~ '^[a-z]{3}$'),
  unit_amount bigint not null check (unit_amount >= 0),
  recurring_interval text not null check (recurring_interval in ('month', 'year')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (stripe_price_id),
  unique (plan_id, livemode)
);

create table if not exists public.billing_customers (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.license_accounts(id) on delete restrict,
  stripe_customer_id text not null check (stripe_customer_id ~ '^cus_[A-Za-z0-9]+$'),
  livemode boolean not null,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (stripe_customer_id),
  unique (account_id, livemode)
);

create table if not exists public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.license_accounts(id) on delete restrict,
  billing_customer_id uuid not null references public.billing_customers(id) on delete restrict,
  plan_id uuid not null references public.license_plans(id) on delete restrict,
  product_key text not null references public.platform_products(key) on delete restrict,
  platform_license_id uuid unique references public.platform_licenses(id) on delete set null,
  stripe_subscription_id text not null unique check (stripe_subscription_id ~ '^sub_[A-Za-z0-9]+$'),
  stripe_price_id text not null check (stripe_price_id ~ '^price_[A-Za-z0-9]+$'),
  status text not null check (status in ('incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  latest_invoice_id text,
  livemode boolean not null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (current_period_end is null or current_period_start is null or current_period_end > current_period_start)
);

create unique index if not exists billing_subscriptions_one_open_product
  on public.billing_subscriptions (account_id, product_key, livemode)
  where status in ('incomplete', 'trialing', 'active', 'past_due', 'unpaid', 'paused');

create index if not exists billing_subscriptions_account_idx
  on public.billing_subscriptions (account_id, updated_at desc);

create table if not exists public.stripe_webhook_events (
  stripe_event_id text primary key check (stripe_event_id ~ '^evt_[A-Za-z0-9]+$'),
  livemode boolean not null,
  event_type text not null,
  object_id text,
  api_version text,
  event_created_at timestamptz,
  status text not null default 'processing' check (status in ('processing', 'processed', 'failed', 'ignored')),
  attempts integer not null default 1 check (attempts >= 1),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  last_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.billing_price_catalog enable row level security;
alter table public.billing_customers enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.stripe_webhook_events enable row level security;

revoke all on table public.billing_price_catalog from public, anon, authenticated;
revoke all on table public.billing_customers from public, anon, authenticated;
revoke all on table public.billing_subscriptions from public, anon, authenticated;
revoke all on table public.stripe_webhook_events from public, anon, authenticated;

grant select, insert, update, delete on table public.billing_price_catalog to service_role;
grant select, insert, update, delete on table public.billing_customers to service_role;
grant select, insert, update, delete on table public.billing_subscriptions to service_role;
grant select, insert, update, delete on table public.stripe_webhook_events to service_role;

create or replace function private.can_manage_billing_account(p_actor_id uuid, p_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.license_accounts account
    join public.license_account_members member on member.account_id = account.id
    where account.id = p_account_id
      and account.status = 'active'
      and member.user_id = p_actor_id
      and member.member_role in ('owner', 'admin')
      and member.revoked_at is null
  );
$$;

revoke all on function private.can_manage_billing_account(uuid, uuid) from public, anon, authenticated;
grant execute on function private.can_manage_billing_account(uuid, uuid) to service_role;

create or replace function public.get_map_checkout_context(
  p_actor_id uuid,
  p_account_id uuid,
  p_plan_key text,
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
  where plan_id = plan_record.id and livemode = p_livemode and active;
  if not found then raise exception 'No active Stripe price is configured for this plan and mode'; end if;

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
    'stripe_customer_id', customer_record.stripe_customer_id
  );
end;
$$;

revoke all on function public.get_map_checkout_context(uuid, uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.get_map_checkout_context(uuid, uuid, text, boolean) to service_role;

create or replace function public.link_map_billing_customer(
  p_actor_id uuid,
  p_account_id uuid,
  p_stripe_customer_id text,
  p_email text,
  p_livemode boolean
)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare customer_id uuid;
begin
  if not private.can_manage_billing_account(p_actor_id, p_account_id) then
    raise exception 'You cannot manage billing for this account';
  end if;

  insert into public.billing_customers (account_id, stripe_customer_id, livemode, email)
  values (p_account_id, p_stripe_customer_id, p_livemode, nullif(lower(trim(p_email)), ''))
  on conflict (account_id, livemode) do update
  set stripe_customer_id = excluded.stripe_customer_id,
      email = coalesce(excluded.email, public.billing_customers.email),
      updated_at = now()
  returning id into customer_id;
  return customer_id;
end;
$$;

revoke all on function public.link_map_billing_customer(uuid, uuid, text, text, boolean) from public, anon, authenticated;
grant execute on function public.link_map_billing_customer(uuid, uuid, text, text, boolean) to service_role;

create or replace function public.get_map_portal_context(
  p_actor_id uuid,
  p_account_id uuid,
  p_livemode boolean
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare target_account_id uuid := p_account_id; customer_record record;
begin
  if target_account_id is null then
    select member.account_id into target_account_id
    from public.license_account_members member
    join public.billing_customers customer on customer.account_id = member.account_id and customer.livemode = p_livemode
    where member.user_id = p_actor_id and member.revoked_at is null and member.member_role in ('owner', 'admin')
    order by member.added_at
    limit 1;
  end if;
  if target_account_id is null or not private.can_manage_billing_account(p_actor_id, target_account_id) then
    raise exception 'You cannot manage billing for this account';
  end if;
  select * into customer_record from public.billing_customers
  where account_id = target_account_id and livemode = p_livemode;
  if not found then raise exception 'This account does not have a Stripe billing profile'; end if;
  return jsonb_build_object('account_id', target_account_id, 'stripe_customer_id', customer_record.stripe_customer_id);
end;
$$;

revoke all on function public.get_map_portal_context(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.get_map_portal_context(uuid, uuid, boolean) to service_role;

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
    'current_period_start', subscription.current_period_start,
    'current_period_end', subscription.current_period_end,
    'cancel_at_period_end', subscription.cancel_at_period_end,
    'can_manage_billing', member.member_role in ('owner', 'admin')
  ) order by subscription.updated_at desc), '[]'::jsonb)
  from public.billing_subscriptions subscription
  join public.license_plans plan on plan.id = subscription.plan_id
  join public.license_account_members member on member.account_id = subscription.account_id
  where member.user_id = auth.uid() and member.revoked_at is null;
$$;

revoke all on function private.get_my_map_billing_dashboard() from public, anon, authenticated;
grant execute on function private.get_my_map_billing_dashboard() to authenticated, service_role;

create or replace function public.get_my_map_billing_dashboard()
returns jsonb
language sql
stable
security invoker
set search_path = public, private, pg_temp
as $$ select private.get_my_map_billing_dashboard(); $$;

revoke all on function public.get_my_map_billing_dashboard() from public, anon, authenticated;
grant execute on function public.get_my_map_billing_dashboard() to authenticated, service_role;

create or replace function public.claim_stripe_webhook_event(p_event jsonb)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare claimed_id text;
begin
  insert into public.stripe_webhook_events (
    stripe_event_id, livemode, event_type, object_id, api_version,
    event_created_at, status, attempts, payload
  ) values (
    p_event->>'id', coalesce((p_event->>'livemode')::boolean, false), p_event->>'type',
    p_event#>>'{data,object,id}', p_event->>'api_version',
    to_timestamp((p_event->>'created')::double precision), 'processing', 1, p_event
  )
  on conflict (stripe_event_id) do nothing
  returning stripe_event_id into claimed_id;
  if claimed_id is not null then return 'claimed'; end if;

  update public.stripe_webhook_events
  set status = 'processing', attempts = attempts + 1, last_error = null, updated_at = now()
  where stripe_event_id = p_event->>'id' and status = 'failed'
  returning stripe_event_id into claimed_id;
  return case when claimed_id is null then 'duplicate' else 'claimed' end;
end;
$$;

revoke all on function public.claim_stripe_webhook_event(jsonb) from public, anon, authenticated;
grant execute on function public.claim_stripe_webhook_event(jsonb) to service_role;

create or replace function public.complete_stripe_webhook_event(
  p_event_id text,
  p_status text,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_status not in ('processed', 'failed', 'ignored') then raise exception 'Invalid webhook completion status'; end if;
  update public.stripe_webhook_events
  set status = p_status,
      last_error = left(p_error, 2000),
      processed_at = case when p_status in ('processed', 'ignored') then now() else null end,
      updated_at = now()
  where stripe_event_id = p_event_id;
end;
$$;

revoke all on function public.complete_stripe_webhook_event(text, text, text) from public, anon, authenticated;
grant execute on function public.complete_stripe_webhook_event(text, text, text) to service_role;

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
  license_id uuid;
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

  select id into license_id from public.platform_licenses
  where external_reference = 'stripe:' || (p_snapshot->>'stripe_subscription_id');

  if license_id is null then
    insert into public.platform_licenses (
      account_id, plan_id, status, source, external_reference, seat_limit,
      starts_at, ends_at, issued_by, metadata
    ) values (
      target_account_id, target_plan.id, license_status, 'checkout',
      'stripe:' || (p_snapshot->>'stripe_subscription_id'), target_plan.default_seat_limit,
      coalesce(period_start, now()), period_end, purchaser_user_id,
      jsonb_build_object('stripe_subscription_id', p_snapshot->>'stripe_subscription_id')
    ) returning id into license_id;
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
    where id = license_id;
  end if;

  insert into public.billing_subscriptions (
    account_id, billing_customer_id, plan_id, product_key, platform_license_id,
    stripe_subscription_id, stripe_price_id, status, current_period_start,
    current_period_end, cancel_at_period_end, canceled_at, latest_invoice_id,
    livemode, metadata
  ) values (
    target_account_id, customer_id, target_plan.id, target_plan.product_key, license_id,
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
    values (license_id, purchaser_user_id, purchaser_user_id)
    on conflict (license_id, user_id) where unassigned_at is null do nothing;
  end if;

  return jsonb_build_object('subscription_id', subscription_id, 'license_id', license_id, 'license_status', license_status);
end;
$$;

revoke all on function public.sync_stripe_subscription_snapshot(jsonb) from public, anon, authenticated;
grant execute on function public.sync_stripe_subscription_snapshot(jsonb) to service_role;
