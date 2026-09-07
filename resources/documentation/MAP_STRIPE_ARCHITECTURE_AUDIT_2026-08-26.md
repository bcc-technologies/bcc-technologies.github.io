# MAP Stripe payment architecture audit

Date: 2026-08-26
Audited revision: `0536041451a2676e0c5b944d1e40bc2cd4d41869`

## Verdict

The foundation is solid for an early-stage subscription system: hosted Stripe Checkout, Customer Portal, server-side catalog resolution, signed webhooks, service-role-only billing tables, one-time trial reservations, idempotency keys, and subscription projection from the Stripe Price allowlist.

It is not yet a technically finished production payment system. The live acceptance endpoint lifecycle must be fixed before general launch. Restricted-key support, multi-item rejection, input status codes, and an asynchronous webhook boundary should follow.

## Controls that are already solid

- Checkout and Portal require an authenticated Supabase user and an allowed origin.
- Browser assets do not contain Stripe secret keys or webhook signing secrets.
- PostgreSQL, not the browser, resolves the Stripe Price from plan, interval, mode, and active catalog state.
- Session metadata binds the account, purchaser, plan, interval, and optional trial claim.
- Reused Checkout sessions must match ownership and commercial fields and remain open.
- Webhook signatures are checked against the raw request body.
- Webhook projection retrieves current Stripe state, preventing old events from restoring an old snapshot.
- Plans are derived from `billing_price_catalog`, not trusted metadata.
- Billing tables and privileged functions use RLS, explicit revocation, service-role grants, and constrained `search_path`.
- Partial unique indexes prevent simultaneous redeemed or reserved trials for the same account or user.

## Findings

### Resolved — stale `processing` webhook lease

Resolved on 2026-08-26 by migration `20260826102820_reclaim_stale_stripe_webhook_events.sql`. The claim RPC now atomically reclaims `processing` rows after a ten-minute lease, increments attempts, renews `updated_at`, and leaves active, processed, and ignored rows as duplicates. Replayed projection is idempotent because the webhook retrieves current Stripe state and trial redemption accepts the same subscription again.

Longer term, acknowledging verified events after placing them on a durable asynchronous queue remains a scalability improvement.

### P1 — Live zero-dollar acceptance has no retirement control

The endpoint is restricted by authentication, user allowlist, live-mode checks, a product-scoped 100% coupon, expiry, and one redemption per coupon. It can nevertheless create another 100%-forever coupon for a new authorized request. After acceptance, undeploy it or add a disabled-by-default server-side kill switch; remove the allowlist and revoke unconsumed coupons.

### P2 — Key validation forces broad `sk_` credentials

`billingMode()` rejects Stripe restricted keys (`rk_test_` and `rk_live_`). Accept mode-matching restricted keys and document the exact permissions required.

### P2 — Public Checkout lacks `integration_identifier`

The acceptance Checkout supplies the current identifier format, but normal subscription Checkout does not. Add it before adopting Stripe API `2026-03-25.dahlia` or later.

### P2 — Multi-item subscriptions silently use their first Price

The webhook reads `subscription.items.data[0]`. MAP expects exactly one item and should reject unexpected multi-item state.

### P2 — Invalid Checkout fields return HTTP 500

Plan, interval, and UUID validation throw plain `Error` objects. They should produce typed HTTP 400 responses.

### P2 — Webhook processing is synchronous

Signature verification, Stripe retrieval, database projection, trial redemption, and completion happen in one request. This is adequate at low volume but couples retries to external latency.

### P3 — Stripe SDK drift

Edge Functions pin `stripe@22.1.1`; audited current guidance lists `22.4.0`. Upgrade deliberately with API-version compatibility tests.

### P3 — Historical migration mirrors

Five migration pairs differ only in formatting or extra semicolons. Do not rewrite deployed history; the regression test now prevents semantic drift.

## Tax gate

Keep `STRIPE_AUTOMATIC_TAX` disabled until BCC confirms its obligations, registers with the relevant authorities, adds active Stripe Tax registrations, and validates product tax codes and customer addresses.

## Tests and verification

- `map-stripe-domain-behavior.test.mjs`: event references, snapshots, errors, acceptance coupons, and identifiers.
- `map-stripe-architecture-invariants.test.mjs`: trust boundaries, server-side Price selection, metadata, idempotency, reuse, SQL privileges, and secret scanning.
- `map-stripe-migration-mirrors.test.mjs`: semantic equality of historical migration mirrors.
- `map-stripe-webhook-lease.test.mjs`: atomic recovery, state exclusions, diagnostics, privileges, replay idempotency, and duplicate responses.

Results:

- Payment suite: 33 passed, 0 failed.
- Full repository suite: 257 passed, 0 failed.
- Remote migration, function body, ACL, status counts, and Advisors verified after deployment.
- `anon` and `authenticated` cannot execute the claim RPC; `service_role` can.
- No verification rows persisted.

## Remaining verification limit

The Supabase connector applied and read back the production function, but its SQL verification channel is read-only and rejected the transactional mutation test. The exact lease state transitions were therefore verified locally from the SQL contract, while remote checks covered the deployed definition and privileges. A concurrent replay test against an isolated writable database remains desirable.
