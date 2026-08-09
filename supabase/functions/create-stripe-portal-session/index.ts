import {
  adminClient,
  assertAllowedOrigin,
  authenticatedUser,
  errorResponse,
  isLiveMode,
  jsonBody,
  jsonResponse,
  optionsResponse,
  requirePost,
  siteUrl,
  stripeClient
} from "../_shared/map-billing.ts";

type PortalRequest = { accountId?: string | null };

Deno.serve(async request => {
  if (request.method === "OPTIONS") return optionsResponse(request);
  try {
    requirePost(request);
    assertAllowedOrigin(request);
    const input = await jsonBody<PortalRequest>(request);
    const admin = adminClient();
    const user = await authenticatedUser(request, admin);
    const { data, error } = await admin.rpc("get_map_portal_context", {
      p_actor_id: user.id,
      p_account_id: input.accountId || null,
      p_livemode: isLiveMode()
    });
    if (error) throw error;

    const session = await stripeClient().billingPortal.sessions.create({
      customer: data.stripe_customer_id,
      return_url: `${siteUrl()}/dashboard.html?module=licenses`
    });
    return jsonResponse(request, { url: session.url });
  } catch (error) {
    return errorResponse(request, error);
  }
});

