# Live acceptance object register

Recorded: 2026-08-09 UTC.

**Superseded.** The `Rotate MAP live acceptance coupons safely` and
`Keep MAP acceptance coupon IDs bounded` changes (2026-08-11) removed
`STRIPE_LIVE_ACCEPTANCE_COUPON_ID` and made `create-map-live-acceptance-session`
find-or-create its own Coupon by metadata (`acceptance_scope=map.nano.live.zero.recurring`,
`duration=forever`) instead of reading a single pre-provisioned Coupon ID. The
Coupon recorded below used the retired `acceptance_scope=map.nano.live.zero` /
`duration=once` shape and its `redeem_by` has passed, so the current matcher
in `create-map-live-acceptance-session` ignores it — it is inert, kept only
for audit history, and should not be reused, extended, or treated as
operational guidance. See
[`MAP_STRIPE_LIVE_ACCEPTANCE.md`](MAP_STRIPE_LIVE_ACCEPTANCE.md) for the
current flow.

| Object | Value |
| --- | --- |
| Coupon ID | `map_nano_live_acceptance_202608` |
| Mode | Live |
| Discount | 100% |
| Subscription duration | Once |
| Maximum redemptions | 1 |
| Redeemed | 0 |
| Valid when read | Yes |
| Redeem by | `2026-08-16T02:50:29Z` |
| Intended Product | `prod_V2RHI0sFqf2G8D` — MAP-Nano Essential |
| Acceptance scope | `map.nano.live.zero` |

The Coupon was created through the Stripe API with `applies_to.products=[prod_V2RHI0sFqf2G8D]`. The Stripe connector's Coupon read response omits `applies_to`, so that field could not be independently confirmed from its returned representation. Browser verification was also unavailable because the Windows sandbox helper terminated the browser runtime during startup.

This is a verification limitation, not an authorization bypass. `create-map-live-acceptance-session` retrieves the Coupon and Essential Price directly from Stripe at invocation time and refuses to create a Checkout Session unless `coupon.applies_to.products` contains the Price's Product ID. If Stripe did not persist the restriction, the acceptance flow fails closed before creating a Customer or Checkout Session.

Do not recreate or broaden this Coupon. If it expires unused, delete it and create a new short-lived, single-redemption Coupon through the same reviewed procedure.
