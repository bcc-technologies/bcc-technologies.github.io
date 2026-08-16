# MAP-Nano live zero-dollar acceptance

Status: operational function; self-manages its own Coupon; no manually
provisioned Coupon ID required.

The acceptance flow is intentionally separate from public MAP Checkout. It
creates a live MAP-Nano Essential subscription using the canonical
US$120/month Price and a backend-applied 100% Coupon. It is not a free plan,
trial, public promotion, or proof of real card charging.

As of the `Rotate MAP live acceptance coupons safely` and
`Keep MAP acceptance coupon IDs bounded` changes, the function no longer reads
a Coupon ID from a secret. It finds a matching Coupon by metadata at
invocation time and creates one if none matches, so the flow can be re-run
without an operator manually rotating Stripe objects between runs. Any
Coupon(s) referencing the older `acceptance_scope=map.nano.live.zero` /
`duration=once` shape (created before this redesign) are ignored — the
matcher only accepts `acceptance_scope=map.nano.live.zero.recurring`,
`duration=forever`. Retire those older Coupons in Stripe; they are inert but
not automatically deleted by this flow.

## Security boundary

The `create-map-live-acceptance-session` Edge Function fails closed unless all conditions hold:

- `STRIPE_MODE=live` and the configured Stripe key is live;
- the caller has a valid Supabase user session;
- the caller can manage the selected billing account through `get_map_checkout_context`;
- the caller's immutable Supabase user ID appears in `BCC_BILLING_ACCEPTANCE_USER_IDS`;
- the plan resolves to the canonical live Essential monthly Price, and that Price's Stripe Product is live;
- at most one live Coupon matches `acceptance_scope=map.nano.live.zero.recurring`, 100% off, `duration=forever`, `max_redemptions=1`, unused, unexpired, and restricted to the Essential Product; if more than one matches, or the Coupon listing has more than 100 entries, the request fails closed instead of guessing;
- when no matching Coupon exists, the function creates one itself (`redeem_by` = now + 48h, `duration=forever`, `max_redemptions=1`, `percent_off=100`, scoped to the Essential Product) so the invariants above always hold for the Coupon it uses;
- the request includes a UUIDv4 idempotency key (`requestId`), used both as the Stripe Checkout idempotency key and, deterministically, as the Coupon idempotency key so retries cannot create duplicate Coupons.

The Coupon is applied server-side through `discounts`. `allow_promotion_codes` remains false, so Checkout exposes no customer-entered promotion field. The session expires after 60 minutes and requests a payment method only if Stripe requires one (`payment_method_collection: "if_required"`).

## Required function secrets

In addition to the normal MAP billing secrets:

```text
BCC_BILLING_ACCEPTANCE_USER_IDS=<internal-supabase-user-uuid>
```

`STRIPE_LIVE_ACCEPTANCE_COUPON_ID` is no longer read by this function — do not
set it; if it is still present in an existing deployment's secrets, it is
inert and safe to remove. Never store `BCC_BILLING_ACCEPTANCE_USER_IDS` in
browser configuration.

## Execution order

1. Deploy and verify the billing migrations and normal Edge Functions first.
2. Install and verify the Stripe webhook signing secret.
3. Set `BCC_BILLING_ACCEPTANCE_USER_IDS` and deploy `create-map-live-acceptance-session` with JWT verification enabled. No Coupon needs to be pre-created — the function creates or reuses one on first invocation.
4. Invoke it once as the allowlisted internal billing owner and complete hosted Checkout.
5. Verify `checkout.session.completed`, the zero invoice, active subscription projection, webhook idempotency, MAP license assignment, and Portal access.
6. Remove the acceptance secret and delete the operational Edge Function after evidence is captured. Leave the Coupon Stripe created — it is now redeemed and serves as audit history; do not broaden or reuse it for another account.

## What this does not prove

It does not exercise card collection, SCA/3DS, PaymentIntent success or failure, Stripe fees, refunds, disputes, or movement of funds. Those scenarios must pass in Stripe test mode. A future live non-zero transaction is the only proof of the real funds path.
