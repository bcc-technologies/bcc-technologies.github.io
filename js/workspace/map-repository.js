(() => {
  const contracts = window.BCCWorkspaceMapContracts;
  if (!contracts) throw new Error("MAP contracts must load before the repository.");

  async function rpc(name, parameters) {
    try {
      const supabase = await window.BCCAuth.loadSupabaseClient();
      const args = parameters && Object.keys(parameters).length ? parameters : undefined;
      const { data, error } = await supabase.rpc(name, args);
      if (error) throw error;
      return data;
    } catch (error) {
      throw contracts.toError(error);
    }
  }

  async function invokeFunction(name, body) {
    try {
      const supabase = await window.BCCAuth.loadSupabaseClient();
      const { data, error } = await supabase.functions.invoke(name, { body });
      if (error) throw error;
      if (!data || typeof data !== "object") throw new Error("The MAP service returned an invalid response.");
      return data;
    } catch (error) {
      throw contracts.toError(error);
    }
  }

  // error.code === "invalid_response" is the reliable signal: map-contracts.js
  // sets it from PostgREST's own PGRST error codes, not from message text. The
  // message regex below is only a fallback for the rare case that code gets
  // lost in transit, so it must stay tied to PostgREST's fixed "missing
  // function" wording (RPC name + "schema cache" together) rather than the
  // bare word "function", which a real business-rule exception could also
  // contain and would otherwise be silently swallowed as "not deployed yet".
  function isMissingRpc(error, rpcName) {
    if (error?.code === "invalid_response") return true;
    const message = error?.message || "";
    return new RegExp(`${rpcName}[\\s\\S]*schema cache`, "i").test(message);
  }

  async function activateEvaluationMemberships() {
    try {
      return Number(await rpc("activate_my_evaluation_memberships")) || 0;
    } catch (error) {
      if (isMissingRpc(error, "activate_my_evaluation_memberships")) return 0;
      throw error;
    }
  }

  async function getTrialOffer() {
    try {
      return contracts.normalizeTrialOffer(await rpc("get_current_map_trial_offer"));
    } catch (error) {
      if (isMissingRpc(error, "get_current_map_trial_offer")) return contracts.TRIAL_OFFER_FALLBACK;
      throw error;
    }
  }

  function isMissingCommercialRequestRpc(error) {
    return isMissingRpc(error, "map_nano_commercial_request");
  }

  async function getCommercialRequests() {
    try {
      return {
        available: true,
        requests: contracts.normalizeCommercialRequests(await rpc("get_my_map_nano_commercial_requests"))
      };
    } catch (error) {
      if (isMissingCommercialRequestRpc(error)) return { available: false, requests: [] };
      throw error;
    }
  }

  async function getCommercialRequestQueue() {
    try {
      return {
        available: true,
        requests: contracts.normalizeCommercialRequestQueue(await rpc("get_my_map_nano_commercial_request_queue"))
      };
    } catch (error) {
      if (isMissingCommercialRequestRpc(error)) return { available: false, requests: [] };
      throw error;
    }
  }

  async function getBillingSubscriptions() {
    try {
      const rows = await rpc("get_my_map_billing_dashboard");
      return { available: true, subscriptions: contracts.rows(rows) };
    } catch (error) {
      if (isMissingRpc(error, "get_my_map_billing_dashboard")) return { available: false, subscriptions: [] };
      throw error;
    }
  }

  async function getClientDashboard() {
    await activateEvaluationMemberships();
    const [dashboard, access, entitlements, trialOffer, commercialRequestState, billingState] = await Promise.all([
      rpc("get_my_license_overview"),
      rpc("get_my_platform_access"),
      rpc("get_my_internal_entitlements"),
      getTrialOffer(),
      getCommercialRequests(),
      getBillingSubscriptions()
    ]);
    return {
      dashboard: contracts.normalizeClientDashboard(dashboard),
      platformAccess: contracts.normalizePlatformAccess(access),
      effectiveAccess: contracts.normalizeEffectiveAccess(access),
      entitlements: contracts.normalizeEntitlements(entitlements),
      trialOffer,
      commercialRequests: commercialRequestState.requests,
      commercialRequestsAvailable: commercialRequestState.available,
      billingSubscriptions: billingState.subscriptions,
      billingAvailable: billingState.available
    };
  }

  async function getAdminDashboard(options = {}) {
    const [payload, trialOffer] = await Promise.all([
      rpc("get_my_platform_admin_dashboard", {
        p_include_evaluations: Boolean(options.includeEvaluations),
        p_include_access: Boolean(options.includeAccess)
      }),
      getTrialOffer()
    ]);
    return { ...contracts.normalizeAdminDashboard(payload), trialOffer };
  }

  const client = Object.freeze({
    getDashboard: getClientDashboard,
    getSeatManagement: (licenseId, query = "") => rpc("get_my_license_seat_management", {
      p_license_id: licenseId,
      p_query: query || null,
      p_limit: 50
    }),
    assignSeat: (licenseId, userId) => rpc("assign_my_account_license", {
      p_license_id: licenseId,
      p_user_id: userId
    }),
    releaseSeat: assignmentId => rpc("release_my_license_assignment", {
      p_assignment_id: assignmentId
    }),
    getCommercialRequests,
    getBillingSubscriptions,
    createCheckoutSession: values => invokeFunction("create-map-checkout-session", {
      accountId: values.accountId || null,
      planKey: values.planKey,
      billingInterval: values.billingInterval,
      requestId: values.requestId
    }),
    createBillingPortalSession: accountId => invokeFunction("create-stripe-portal-session", {
      accountId: accountId || null
    }),
    createCommercialRequest: values => rpc("create_my_map_nano_commercial_request", {
      p_plan_key: values.planKey,
      p_request_type: values.requestType,
      p_contact_name: values.contactName,
      p_contact_email: values.contactEmail,
      p_organization_name: values.organizationName,
      p_country: values.country,
      p_estimated_users: Number(values.estimatedUsers),
      p_analysis_volume: values.analysisVolume,
      p_message: values.message || null,
      p_account_id: values.accountId || null
    }),
    cancelCommercialRequest: (requestId, cancellationNote = null) => rpc("cancel_my_map_nano_commercial_request", {
      p_request_id: requestId,
      p_cancellation_note: cancellationNote
    })
  });

  const staff = Object.freeze({
    getDashboard: getAdminDashboard,
    getCommercialRequestQueue,
    reviewCommercialRequest: values => rpc("review_my_map_nano_commercial_request", {
      p_request_id: values.requestId,
      p_status: values.status,
      p_resolution_note: values.resolutionNote || null
    }),
    issueLicense: values => rpc("issue_my_platform_license", {
      p_account_id: values.accountId,
      p_plan_id: values.planId,
      p_seat_limit: Number(values.seatLimit),
      p_starts_at: values.startsAt,
      p_ends_at: values.endsAt || null
    }),
    assignSeat: (licenseId, userId) => rpc("assign_my_platform_license", {
      p_license_id: licenseId,
      p_user_id: userId
    }),
    createInstitution: values => rpc("create_my_institution", {
      p_display_name: values.displayName,
      p_domain: values.domain || null
    }),
    createEvaluationCohort: values => rpc("create_my_access_program_cohort", {
      p_account_id: values.institutionId,
      p_product_key: values.productKey,
      p_name: values.name,
      p_purpose: values.purpose,
      p_starts_at: values.startsAt,
      p_ends_at: values.endsAt,
      p_program_type: values.programType || "standard_evaluation",
      p_grant_reason: values.grantReason || "",
      p_review_at: values.reviewAt || null,
      p_max_renewals: Number(values.maxRenewals || 0)
    }),
    provisionTesterAccess: values => invokeFunction("invite-map-evaluation-participant", {
      institutionId: values.institutionId || null,
      cohortId: values.cohortId || null,
      email: values.email,
      fullName: values.fullName || "",
      productKey: values.productKey || null,
      startsAt: values.startsAt || null,
      endsAt: values.endsAt || null,
      grantReason: values.grantReason || "",
      reviewAt: values.reviewAt || null
    }),
    inviteEvaluationParticipant: (cohortId, email, fullName = "") => invokeFunction("invite-map-evaluation-participant", {
      cohortId,
      email,
      fullName
    }),
    listEvaluationParticipants: cohortId => rpc("list_my_evaluation_cohort_participants", {
      p_cohort_id: cohortId
    }).then(contracts.rows),
    revokeEvaluationParticipant: (cohortId, userId) => rpc("revoke_my_evaluation_participant", {
      p_cohort_id: cohortId,
      p_user_id: userId,
      p_reason: "Revocado desde staff dashboard"
    }),
    revokeLicense: licenseId => rpc("revoke_my_platform_license", {
      p_license_id: licenseId,
      p_reason: "Revocada desde staff dashboard"
    })
  });

  window.BCCWorkspaceMapRepository = Object.freeze({ rpc, client, staff });
})();
