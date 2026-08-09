-- Cover billing subscription foreign keys used by webhook reconciliation and
-- lifecycle lookups. The initial billing tables are empty at rollout time.

create index if not exists billing_subscriptions_billing_customer_id_idx
  on public.billing_subscriptions (billing_customer_id);

create index if not exists billing_subscriptions_plan_id_idx
  on public.billing_subscriptions (plan_id);

create index if not exists billing_subscriptions_product_key_idx
  on public.billing_subscriptions (product_key);
