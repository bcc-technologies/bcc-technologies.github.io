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

  async function getTrialOffer() {
    try {
      return contracts.normalizeTrialOffer(await rpc("get_current_map_trial_offer"));
    } catch (error) {
      if (error?.code === "invalid_response" || /get_current_map_trial_offer|schema cache|function/i.test(error?.message || "")) {
        return contracts.TRIAL_OFFER_FALLBACK;
      }
      throw error;
    }
  }

  function isMissingCommercialRequestRpc(error) {
    return error?.code === "invalid_response"
      || /map_nano_commercial_request|schema cache|function/i.test(error?.message || "");
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

  async function getClientDashboard() {
    const [dashboard, access, entitlements, trialOffer, commercialRequestState] = await Promise.all([
      rpc("get_my_license_dashboard"),
      rpc("get_my_platform_access"),
      rpc("get_my_internal_entitlements"),
      getTrialOffer(),
      getCommercialRequests()
    ]);
    return {
      dashboard: contracts.normalizeClientDashboard(dashboard),
      platformAccess: contracts.normalizePlatformAccess(access),
      effectiveAccess: contracts.normalizeEffectiveAccess(access),
      entitlements: contracts.normalizeEntitlements(entitlements),
      trialOffer,
      commercialRequests: commercialRequestState.requests,
      commercialRequestsAvailable: commercialRequestState.available
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
    assignSeat: (licenseId, userId) => rpc("assign_my_account_license", {
      p_license_id: licenseId,
      p_user_id: userId
    }),
    releaseSeat: assignmentId => rpc("release_my_license_assignment", {
      p_assignment_id: assignmentId
    }),
    getCommercialRequests,
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
    createEvaluationAccount: displayName => rpc("create_my_evaluation_account", { p_display_name: displayName }),
    createEvaluationCohort: values => rpc("create_my_evaluation_cohort", {
      p_account_id: values.accountId,
      p_product_key: values.productKey,
      p_name: values.name,
      p_purpose: values.purpose,
      p_starts_at: values.startsAt,
      p_ends_at: values.endsAt
    }),
    inviteEvaluationParticipant: (cohortId, email) => rpc("provision_my_evaluation_participant", {
      p_cohort_id: cohortId,
      p_email: email
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
