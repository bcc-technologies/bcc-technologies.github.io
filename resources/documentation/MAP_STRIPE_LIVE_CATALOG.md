# MAP-Nano live Stripe catalog

Status as of 2026-08-08: Stripe catalog provisioned and verified; Supabase billing deployment and UI activation pending.

This document supersedes the pre-provisioning catalog guidance in `MAP_STRIPE_BILLING_FOUNDATION.md`. The billing foundation remains disabled and has not been deployed to the remote Supabase project.

## Canonical live catalog

| Plan | Amount | Stripe Product | Stripe Price | Lookup key |
| --- | ---: | --- | --- | --- |
| MAP-Nano Essential | US$1,200/year | `prod_V2RHI0sFqf2G8D` | `price_1U2MPQ61z0I4dYgK2XuYLB8N` | `map_nano_essential_usd_year` |
| MAP-Nano Professional | US$3,000/year | `prod_V2RIFgAK1iL6NV` | `price_1U2MQ961z0I4dYgKjWKx8ZXl` | `map_nano_professional_usd_year` |

Both Products and Prices are active and live. Each Product's `default_price` points to the matching Price. They carry:

- `product_key=map.nano`
- `commercial_plan_key=essential|professional`
- `catalog_version=2026-08`
- `billing_environment=live`
- `managed_by=bcc-maps-billing`

Products use tax code `txcd_10103101`, statement descriptor `BCC MAP NANO`, and unit label `license`. Price tax behavior remains unspecified until BCC confirms its tax registrations and collection policy.

## Replaced placeholders

The legacy Product `prod_TrYfNpAbepHY1Q` and its US$1,490/year and US$49/month Prices are inactive. Metadata records that they were archived placeholders and points to the canonical replacements. They remain visible in Stripe for audit history because Stripe Price amounts are immutable and Price objects are archived rather than deleted.

The account had zero Stripe Customers when the replacement was verified.

## Database registration

`20260809024500_map_nano_live_price_catalog.sql` registers only the two canonical live Price IDs. The migration:

- resolves plans by `product_key` and `commercial_key`, never by pasted plan UUID;
- requires exactly two active annual self-service plans;
- upserts by `(plan_id, livemode)`;
- verifies Price ID, lookup key, currency, amount, interval, and active state;
- fails transactionally if any invariant does not match.

The migration is local only. Do not run it against production until the foundation migration has been reviewed and exercised in staging.

## Remaining activation gates

1. Apply and validate the foundation in a Supabase staging project.
2. Create independent test-mode Products and Prices and register them with `livemode=false`.
3. Deploy Checkout, Portal, and webhook Edge Functions with the documented secrets.
4. Create the webhook only after its production endpoint exists, then install its signing secret in Supabase.
5. Configure Customer Portal policy in Stripe.
6. Exercise successful payment, failure/retry, cancellation, duplicate delivery, and out-of-order webhook scenarios.
7. Run Supabase security and performance advisors and reconcile the Stripe subscription projection with MAP entitlements.
8. Apply the reviewed live migration and complete a controlled live acceptance purchase.
9. Enable `checkoutEnabled`, then `portalEnabled`, only after all earlier gates pass.

No webhook endpoint has been created yet: its remote Edge Function does not exist, and creating it now would produce failed deliveries while exposing a signing secret with nowhere safe to install it.
