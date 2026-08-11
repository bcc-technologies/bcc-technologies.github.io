# MAP-Nano live zero-dollar acceptance

Status: operational function prepared locally; not deployed; no Coupon consumed.

The acceptance flow is intentionally separate from public MAP Checkout. It creates a live MAP-Nano Essential subscription using the canonical US$1,200/year Price and a backend-applied 100% Coupon. It is not a free plan, trial, public promotion, or proof of real card charging.

## Security boundary

The `create-map-live-acceptance-session` Edge Function fails closed unless all conditions hold:

- `STRIPE_MODE=live` and the configured Stripe key is live;
- the caller has a valid Supabase user session;
- the caller can manage the selected billing account through `get_map_checkout_context`;
- the caller's immutable Supabase user ID appears in `BCC_BILLING_ACCEPTANCE_USER_IDS`;
- the plan resolves to the canonical live Essential Price;
- the Coupon is live, valid, unused, 100% off, `duration=once`, `max_redemptions=1`, unexpired, tagged `acceptance_scope=map.nano.live.zero`, and restricted to the Essential Product;
- the request includes a UUIDv4 idempotency key.

The Coupon is applied server-side through `discounts`. `allow_promotion_codes` remains false, so Checkout exposes no customer-entered promotion field. The session expires after 60 minutes and requests a payment method only if Stripe requires one.

## Required function secrets

In addition to the normal MAP billing secrets:

```text
BCC_BILLING_ACCEPTANCE_USER_IDS=<internal-supabase-user-uuid>
STRIPE_LIVE_ACCEPTANCE_COUPON_ID=<live-single-use-coupon-id>
```

Never store either value in browser configuration. The Coupon ID is not a credential, but keeping it server-side prevents accidental coupling and simplifies removal.

## Execution order

1. Deploy and verify the billing migrations and normal Edge Functions first.
2. Install and verify the Stripe webhook signing secret.
3. Create the live Coupon with a short `redeem_by`, `duration=once`, `max_redemptions=1`, `percent_off=100`, `applies_to.products=[Essential Product]`, and the required metadata.
4. Set the two acceptance secrets and deploy `create-map-live-acceptance-session` with JWT verification enabled.
5. Invoke it once as the allowlisted internal billing owner and complete hosted Checkout.
6. Verify `checkout.session.completed`, the zero invoice, active subscription projection, webhook idempotency, MAP license assignment, and Portal access.
7. Remove the two acceptance secrets and delete the operational Edge Function after evidence is captured. Delete an unused Coupon or leave a redeemed Coupon immutable for audit history.

## What this does not prove

It does not exercise card collection, SCA/3DS, PaymentIntent success or failure, Stripe fees, refunds, disputes, or movement of funds. Those scenarios must pass in Stripe test mode. A future live non-zero transaction is the only proof of the real funds path.
