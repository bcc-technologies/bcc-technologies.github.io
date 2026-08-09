import Stripe from "npm:stripe@22.1.1";
import {
  adminClient,
  expandableId,
  requiredEnv,
  stripeClient
} from "../_shared/map-billing.ts";

const HANDLED_EVENTS = new Set([
  "checkout.session.completed",
  "checkout.session.expired",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.trial_will_end",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed"
]);

const cryptoProvider = Stripe.createSubtleCryptoProvider();
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8" }
});

function subscriptionIdForEvent(event: Stripe.Event): string | null {
  const object = event.data.object as unknown as Record<string, unknown>;
  if (event.type.startsWith("customer.subscription.")) return typeof object.id === "string" ? object.id : null;
  if (event.type === "checkout.session.completed") return expandableId(object.subscription);
  if (event.type.startsWith("invoice.")) {
    const direct = expandableId(object.subscription);
    if (direct) return direct;
    const parent = object.parent as Record<string, unknown> | undefined;
    const details = parent?.subscription_details as Record<string, unknown> | undefined;
    return expandableId(details?.subscription);
  }
  return null;
}

function isoFromEpoch(value: unknown): string | null {
  return typeof value === "number" && Number.isFinite(value) ? new Date(value * 1000).toISOString() : null;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const candidate = error as Record<string, unknown>;
    const details = [candidate.message, candidate.code, candidate.details, candidate.hint]
      .filter(value => typeof value === "string" && value.trim())
      .map(value => String(value).trim());
    if (details.length) return details.join(" | ");
    try {
      return JSON.stringify(candidate);
    } catch {
      return "Unknown webhook processing error";
    }
  }
  return String(error);
}

function subscriptionSnapshot(subscription: Stripe.Subscription, livemode: boolean) {
  const raw = subscription as unknown as Record<string, unknown>;
  const firstItem = subscription.items.data[0] as unknown as Record<string, unknown> | undefined;
  const periodStart = raw.current_period_start ?? firstItem?.current_period_start;
  const periodEnd = raw.current_period_end ?? firstItem?.current_period_end;
  return {
    stripe_subscription_id: subscription.id,
    stripe_customer_id: expandableId(subscription.customer),
    stripe_price_id: subscription.items.data[0]?.price?.id || null,
    status: subscription.status,
    current_period_start: isoFromEpoch(periodStart),
    current_period_end: isoFromEpoch(periodEnd),
    trial_start: isoFromEpoch(subscription.trial_start),
    trial_end: isoFromEpoch(subscription.trial_end),
    trial_claim_id: subscription.metadata.map_trial_claim_id || null,
    cancel_at_period_end: subscription.cancel_at_period_end,
    canceled_at: isoFromEpoch(subscription.canceled_at),
    latest_invoice_id: expandableId(subscription.latest_invoice),
    livemode,
    account_id: subscription.metadata.map_account_id,
    commercial_plan_key: subscription.metadata.commercial_plan_key,
    purchaser_user_id: subscription.metadata.purchaser_user_id,
    customer_email: null
  };
}

Deno.serve(async request => {
  if (request.method !== "POST") return response({ error: "Method not allowed" }, 405);
  const signature = request.headers.get("stripe-signature");
  if (!signature) return response({ error: "Missing Stripe signature" }, 400);

  let event: Stripe.Event;
  try {
    event = await stripeClient().webhooks.constructEventAsync(
      await request.text(),
      signature,
      requiredEnv("STRIPE_WEBHOOK_SECRET"),
      undefined,
      cryptoProvider
    );
  } catch (error) {
    console.warn("[stripe-webhook] signature rejected", error);
    return response({ error: "Invalid Stripe signature" }, 400);
  }

  const admin = adminClient();
  const { data: claim, error: claimError } = await admin.rpc("claim_stripe_webhook_event", { p_event: event });
  if (claimError) {
    console.error("[stripe-webhook] claim failed", claimError);
    return response({ error: "Could not claim event" }, 500);
  }
  if (claim === "duplicate") return response({ received: true, duplicate: true });

  if (!HANDLED_EVENTS.has(event.type)) {
    await admin.rpc("complete_stripe_webhook_event", { p_event_id: event.id, p_status: "ignored", p_error: null });
    return response({ received: true, ignored: true });
  }

  try {
    if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      const { error: releaseError } = await admin.rpc("release_map_billing_trial_by_session", {
        p_stripe_checkout_session_id: session.id
      });
      if (releaseError) throw releaseError;
      const { error: completeError } = await admin.rpc("complete_stripe_webhook_event", {
        p_event_id: event.id,
        p_status: "processed",
        p_error: null
      });
      if (completeError) throw completeError;
      return response({ received: true });
    }

    const subscriptionId = subscriptionIdForEvent(event);
    if (!subscriptionId) {
      await admin.rpc("complete_stripe_webhook_event", { p_event_id: event.id, p_status: "ignored", p_error: null });
      return response({ received: true, ignored: true });
    }

    // Always read the current object so delayed or retried events cannot restore stale state.
    const subscription = await stripeClient().subscriptions.retrieve(subscriptionId);
    const snapshot = subscriptionSnapshot(subscription, event.livemode);
    if (!snapshot.stripe_customer_id || !snapshot.stripe_price_id || !snapshot.account_id) {
      throw new Error("Stripe subscription is missing required MAP billing metadata");
    }
    const { error: syncError } = await admin.rpc("sync_stripe_subscription_snapshot", { p_snapshot: snapshot });
    if (syncError) throw syncError;
    if (snapshot.trial_claim_id && snapshot.trial_start && snapshot.trial_end) {
      const { error: trialError } = await admin.rpc("redeem_map_billing_trial", {
        p_claim_id: snapshot.trial_claim_id,
        p_stripe_subscription_id: snapshot.stripe_subscription_id,
        p_account_id: snapshot.account_id,
        p_user_id: snapshot.purchaser_user_id,
        p_livemode: snapshot.livemode,
        p_trial_start: snapshot.trial_start,
        p_trial_end: snapshot.trial_end
      });
      if (trialError) throw trialError;
    }
    const { error: completeError } = await admin.rpc("complete_stripe_webhook_event", {
      p_event_id: event.id,
      p_status: "processed",
      p_error: null
    });
    if (completeError) throw completeError;
    return response({ received: true });
  } catch (error) {
    const message = errorMessage(error);
    console.error("[stripe-webhook] processing failed", { eventId: event.id, eventType: event.type, error });
    await admin.rpc("complete_stripe_webhook_event", { p_event_id: event.id, p_status: "failed", p_error: message });
    return response({ error: "Webhook processing failed" }, 500);
  }
});

