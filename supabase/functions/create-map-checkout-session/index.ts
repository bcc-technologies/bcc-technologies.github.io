import Stripe from "npm:stripe@22.1.1";
import {
  adminClient,
  assertAllowedOrigin,
  authenticatedUser,
  automaticTaxEnabled,
  errorResponse,
  isLiveMode,
  jsonBody,
  jsonResponse,
  optionsResponse,
  requirePost,
  siteUrl,
  stripeClient
} from "../_shared/map-billing.ts";

type CheckoutRequest = { accountId?: string | null; planKey?: string; billingInterval?: string; requestId?: string };
type CheckoutContext = {
  account_id: string;
  plan_key: string;
  plan_name: string;
  stripe_price_id: string;
  currency: string;
  unit_amount: number;
  recurring_interval: "month" | "year";
  trial_period_days: number;
  stripe_customer_id?: string | null;
};
type TrialReservation = {
  eligible: boolean;
  claim_id?: string;
  reused?: boolean;
  stripe_checkout_session_id?: string | null;
  trial_period_days: number;
};

Deno.serve(async request => {
  if (request.method === "OPTIONS") return optionsResponse(request);
  try {
    requirePost(request);
    assertAllowedOrigin(request);
    const input = await jsonBody<CheckoutRequest>(request);
    const planKey = String(input.planKey || "").trim().toLowerCase();
    const billingInterval = String(input.billingInterval || "").trim().toLowerCase();
    const requestId = String(input.requestId || "").trim().toLowerCase();
    if (!/^(essential|professional)$/.test(planKey)) throw new Error("Invalid self-service MAP-Nano plan");
    if (!/^(month|year)$/.test(billingInterval)) throw new Error("Invalid MAP-Nano billing interval");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(requestId)) {
      throw new Error("A UUIDv4 requestId is required");
    }

    const admin = adminClient();
    const user = await authenticatedUser(request, admin);
    const livemode = isLiveMode();
    const { data, error } = await admin.rpc("get_map_checkout_context", {
      p_actor_id: user.id,
      p_account_id: input.accountId || null,
      p_plan_key: planKey,
      p_billing_interval: billingInterval,
      p_livemode: livemode
    });
    if (error) throw error;
    const context = data as CheckoutContext;
    const stripe = stripeClient();

    let customerId = context.stripe_customer_id || null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        name: user.user_metadata?.full_name || user.user_metadata?.name || undefined,
        metadata: { map_account_id: context.account_id, created_by_user_id: user.id }
      }, { idempotencyKey: `map-customer-${livemode ? "live" : "test"}-${context.account_id}` });
      customerId = customer.id;
      const { error: linkError } = await admin.rpc("link_map_billing_customer", {
        p_actor_id: user.id,
        p_account_id: context.account_id,
        p_stripe_customer_id: customer.id,
        p_email: user.email || null,
        p_livemode: livemode
      });
      if (linkError) throw linkError;
    }

    const reserveTrial = async () => {
      const { data: trialData, error: trialError } = await admin.rpc("reserve_map_billing_trial", {
        p_actor_id: user.id,
        p_account_id: context.account_id,
        p_plan_key: context.plan_key,
        p_billing_interval: context.recurring_interval,
        p_livemode: livemode,
        p_request_id: requestId
      });
      if (trialError) throw trialError;
      return trialData as TrialReservation;
    };

    let trial = await reserveTrial();
    if (trial.reused) {
      if (!trial.claim_id || !trial.stripe_checkout_session_id) {
        throw new Error("Your secure Checkout is still being prepared. Try again in a moment.");
      }
      const previousSession = await stripe.checkout.sessions.retrieve(trial.stripe_checkout_session_id);
      const sameCheckout = previousSession.livemode === livemode
        && previousSession.client_reference_id === context.account_id
        && previousSession.metadata.map_account_id === context.account_id
        && previousSession.metadata.purchaser_user_id === user.id
        && previousSession.metadata.commercial_plan_key === context.plan_key
        && previousSession.metadata.billing_interval === context.recurring_interval
        && previousSession.metadata.map_trial_claim_id === trial.claim_id;
      const stillOpen = previousSession.status === "open"
        && Number(previousSession.expires_at) > Math.floor(Date.now() / 1000) + 5;

      if (sameCheckout && stillOpen && previousSession.url) {
        return jsonResponse(request, {
          url: previousSession.url,
          sessionId: previousSession.id,
          billingInterval: context.recurring_interval,
          currency: context.currency,
          unitAmount: context.unit_amount,
          trialDays: Number(trial.trial_period_days),
          reused: true
        });
      }
      if (previousSession.status === "complete") {
        throw new Error("This Checkout was already completed. Refresh the dashboard to see your MAP-Nano access.");
      }
      if (previousSession.status === "open") {
        await stripe.checkout.sessions.expire(previousSession.id);
      }
      const { error: releaseError } = await admin.rpc("release_map_billing_trial_by_session", {
        p_stripe_checkout_session_id: previousSession.id
      });
      if (releaseError) throw releaseError;
      trial = await reserveTrial();
    }
    const trialClaimId = trial.eligible && trial.claim_id ? trial.claim_id : null;
    const trialDays = trialClaimId ? Number(trial.trial_period_days) : 0;
    if (trialClaimId && (!Number.isInteger(trialDays) || trialDays < 1 || trialDays > 90)) {
      throw new Error("Invalid MAP-Nano trial reservation");
    }

    const billingMetadata: Record<string, string> = {
      map_account_id: context.account_id,
      commercial_plan_key: context.plan_key,
      billing_interval: context.recurring_interval,
      purchaser_user_id: user.id
    };
    if (trialClaimId) billingMetadata.map_trial_claim_id = trialClaimId;

    const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData = {
      metadata: billingMetadata
    };
    if (trialClaimId) {
      subscriptionData.trial_period_days = trialDays;
      subscriptionData.trial_settings = { end_behavior: { missing_payment_method: "cancel" } };
    }

    const baseUrl = siteUrl();
    let session: Stripe.Checkout.Session | null = null;
    try {
      session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        client_reference_id: context.account_id,
        line_items: [{ price: context.stripe_price_id, quantity: 1 }],
        success_url: `${baseUrl}/dashboard.html?module=licenses&billing=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/dashboard.html?module=licenses&billing=cancelled`,
        expires_at: Math.floor(Date.now() / 1000) + (30 * 60),
        allow_promotion_codes: false,
        payment_method_collection: "always",
        billing_address_collection: "auto",
        automatic_tax: { enabled: automaticTaxEnabled() },
        customer_update: { address: "auto", name: "auto" },
        metadata: billingMetadata,
        subscription_data: subscriptionData
      }, { idempotencyKey: `map-checkout-${livemode ? "live" : "test"}-${requestId}` });

      if (!session.url) throw new Error("Stripe Checkout did not return a hosted URL");
      if (trialClaimId) {
        const { error: attachError } = await admin.rpc("attach_map_billing_trial_session", {
          p_actor_id: user.id,
          p_claim_id: trialClaimId,
          p_request_id: requestId,
          p_stripe_checkout_session_id: session.id
        });
        if (attachError) throw attachError;
      }
    } catch (error) {
      if (session?.id) {
        try {
          await stripe.checkout.sessions.expire(session.id);
        } catch (expireError) {
          console.error("[map-billing] Could not expire failed Checkout Session", expireError);
        }
      }
      if (trialClaimId) {
        const { error: releaseError } = await admin.rpc("release_map_billing_trial", {
          p_actor_id: user.id,
          p_claim_id: trialClaimId,
          p_request_id: requestId
        });
        if (releaseError) console.error("[map-billing] Could not release trial reservation", releaseError);
      }
      throw error;
    }

    return jsonResponse(request, {
      url: session.url,
      sessionId: session.id,
      billingInterval: context.recurring_interval,
      currency: context.currency,
      unitAmount: context.unit_amount,
      trialDays
    });
  } catch (error) {
    return errorResponse(request, error);
  }
});

