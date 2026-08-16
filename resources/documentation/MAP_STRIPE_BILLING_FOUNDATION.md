# MAP Stripe billing foundation

Status: implemented locally, disabled, not deployed.

## Authority boundaries

- Stripe owns customers, Checkout Sessions, subscriptions, invoices, payment attempts, refunds, disputes, and the Customer Portal.
- Supabase owns the account-to-customer mapping, the normalized subscription projection, webhook idempotency, and MAP authorization.
- `platform_licenses` and `license_assignments` remain the only technical access authority. A Stripe object never grants browser access by itself.
- Evaluation access remains a Supabase-managed workflow. It is not a Stripe trial.

## Commercial rollout

| Plan | Catalog price | Initial sales path |
| --- | ---: | --- |
| MAP-Nano Essential | US$1,200/year | Stripe Checkout |
| MAP-Nano Professional | US$3,000/year | Stripe Checkout |
| MAP-Nano Facility | US$6,000/year | Sales-led quote |
| MAP-Nano Institutional | From US$10,000/year | Sales-led quote |
| MAP-Nano Project | US$300–500/project | Sales-led scope |

The current live BCC Stripe product must not be connected as-is. Its US$1,490 annual Price does not match any approved MAP-Nano tier, and the US$49 monthly Price introduces a monthly offer that the product catalog does not advertise. Create new Prices with stable lookup keys and metadata, then register only the approved Price IDs in `billing_price_catalog`.

Recommended lookup keys:

- `map_nano_essential_usd_year`
- `map_nano_professional_usd_year`

Recommended Product/Price metadata:

- `product_key=map.nano`
- `commercial_plan_key=essential|professional`
- `catalog_version=2026-08`

## Required secrets

Set these only in Supabase Edge Function secrets:

```text
STRIPE_MODE=test
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
BCC_SITE_URL=https://bcc-technologies.github.io
BCC_BILLING_ALLOWED_ORIGINS=https://bcc-technologies.github.io
STRIPE_AUTOMATIC_TAX=false
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are supplied by the Edge Function environment. Never add any Stripe secret or the Supabase service-role key to browser JavaScript.

Keep `STRIPE_AUTOMATIC_TAX=false` until the responsible entity has confirmed its tax obligations and created the required Stripe Tax registrations. Stripe Tax being enabled on the account is not the same as being registered to collect in a jurisdiction.

## Test-mode activation sequence

1. Apply `20260809013000_stripe_billing_foundation.sql` to a staging or linked test project.
2. Run Supabase database security/performance advisors. Resolve any new finding before proceeding.
3. Create test-mode annual Prices for Essential and Professional with the exact approved amounts and metadata.
4. Insert those test Price IDs into `billing_price_catalog` with `livemode=false`; verify currency, amount, interval, and plan twice.
5. Configure a Stripe Customer Portal configuration that allows payment-method and billing-address updates. Decide explicitly whether plan switching or cancellation is customer-controlled before enabling either.
6. Deploy `create-map-checkout-session` and `create-stripe-portal-session` with JWT verification enabled.
7. Deploy `stripe-webhook` with JWT verification disabled; its security boundary is the raw-body Stripe signature.
8. Register the webhook endpoint for:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
9. Exercise successful payment, failed payment, retry recovery, cancellation-at-period-end, immediate cancellation, duplicate webhook delivery, and out-of-order update scenarios.
10. Confirm every successful lifecycle transition updates `billing_subscriptions`, the linked `platform_licenses` row, and effective access as expected.
11. Turn on `checkoutEnabled` in a non-production build. Turn on `portalEnabled` only after Portal testing passes.
12. Repeat the catalog registration and full acceptance suite in live mode before enabling production UI.

## Price catalog registration template

Resolve the plan by stable commercial key; do not paste plan UUIDs into application code.

```sql
insert into public.billing_price_catalog (
  plan_id, livemode, stripe_price_id, lookup_key,
  currency, unit_amount, recurring_interval, active
)
select id, false, 'price_REPLACE_ME', 'map_nano_essential_usd_year',
       'usd', 120000, 'year', true
from public.license_plans
where product_key = 'map.nano' and commercial_key = 'essential';
```

Repeat for Professional with `unit_amount=300000`. Live and test IDs are separate rows because `(plan_id, livemode)` is unique.

## Operational alerts

Alert on failed `stripe_webhook_events`, webhook delivery failures in Stripe, subscriptions in `past_due`/`unpaid`, and drift between `billing_subscriptions.status` and the linked `platform_licenses.status`. A webhook handler returns HTTP 500 on processing failure so Stripe retries; processed and ignored event IDs are idempotently acknowledged.

Before production, complete Stripe branding, create the applicable tax registrations, clean the legacy Price lookup keys, and address Stripe account identity requirements that are currently only eventually due.
