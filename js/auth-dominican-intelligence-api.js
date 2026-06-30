(() => {
  const TABLES = {
    sources: "dominican_sources",
    resources: "dominican_source_resources",
    datasets: "dominican_datasets",
    institutions: "dominican_institutions",
    procurementRecords: "dominican_procurement_records",
    economicIndicators: "dominican_economic_indicators",
    geoLayers: "dominican_geo_layers",
    policyDocuments: "dominican_policy_documents",
    signals: "dominican_signals",
    syncRuns: "dominican_sync_runs"
  };

  function handled(value) {
    return { handled: true, value };
  }

  function unhandled() {
    return { handled: false };
  }

  function normalizePath(path) {
    return String(path || "")
      .replace("/api/admin/dominican intelligence/", "/api/admin/dominican-intelligence/")
      .replace("/api/admin/dominican%20intelligence/", "/api/admin/dominican-intelligence/");
  }

  function normalizeJsonArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function normalizeJsonObject(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function source(row = {}) {
    return {
      id: row.id,
      name: row.name || "",
      institution: row.institution || "",
      section: row.section || "data_sources",
      category: row.category || "open_data",
      sourceType: row.source_type || "manual",
      url: row.url || "",
      status: row.status || "unknown",
      strategicValue: row.strategic_value || "medium",
      bccRelevance: normalizeJsonArray(row.bcc_relevance_json),
      connectorKey: row.connector_key || "",
      notes: row.notes || "",
      lastCheckedAt: row.last_checked_at || "",
      createdAt: row.created_at || "",
      updatedAt: row.updated_at || ""
    };
  }

  function resource(row = {}) {
    return {
      id: row.id,
      sourceId: row.source_id || "",
      externalId: row.external_id || "",
      name: row.name || "",
      format: row.format || "",
      url: row.url || "",
      resourceType: row.resource_type || "",
      description: row.description || "",
      metadataJson: normalizeJsonObject(row.metadata_json),
      lastModified: row.last_modified || "",
      createdAt: row.created_at || "",
      updatedAt: row.updated_at || ""
    };
  }

  function dataset(row = {}) {
    return {
      id: row.id,
      sourceId: row.source_id || "",
      externalId: row.external_id || "",
      title: row.title || "",
      name: row.name || "",
      organization: row.organization || "",
      section: row.section || "data_sources",
      category: row.category || "open_data",
      notes: row.notes || "",
      tags: normalizeJsonArray(row.tags_json),
      resources: normalizeJsonArray(row.resources_json),
      metadataJson: normalizeJsonObject(row.metadata_json),
      relevanceScore: Number(row.relevance_score || 0),
      lastModified: row.last_modified || "",
      createdAt: row.created_at || "",
      updatedAt: row.updated_at || ""
    };
  }

  function institution(row = {}) {
    return {
      id: row.id,
      name: row.name || "",
      kind: row.kind || "agency",
      sector: row.sector || "",
      sourceId: row.source_id || "",
      relevanceToBCC: row.relevance_to_bcc || "medium",
      notes: row.notes || "",
      metadataJson: normalizeJsonObject(row.metadata_json),
      createdAt: row.created_at || "",
      updatedAt: row.updated_at || ""
    };
  }

  function procurementRecord(row = {}) {
    return {
      id: row.id,
      sourceId: row.source_id || "",
      externalId: row.external_id || "",
      title: row.title || "",
      institution: row.institution || "",
      procedureType: row.procedure_type || "",
      status: row.status || "",
      amount: row.amount === null || typeof row.amount === "undefined" ? null : Number(row.amount),
      currency: row.currency || "",
      publicationDate: row.publication_date || "",
      category: row.category || "",
      rawJson: normalizeJsonObject(row.raw_json),
      relevanceScore: Number(row.relevance_score || 0),
      createdAt: row.created_at || "",
      updatedAt: row.updated_at || ""
    };
  }

  function economicIndicator(row = {}) {
    return {
      id: row.id,
      sourceId: row.source_id || "",
      indicatorName: row.indicator_name || "",
      indicatorCode: row.indicator_code || "",
      value: row.value === null || typeof row.value === "undefined" ? null : Number(row.value),
      unit: row.unit || "",
      period: row.period || "",
      category: row.category || "",
      rawJson: normalizeJsonObject(row.raw_json),
      createdAt: row.created_at || "",
      updatedAt: row.updated_at || ""
    };
  }

  function geoLayer(row = {}) {
    return {
      id: row.id,
      sourceId: row.source_id || "",
      name: row.name || "",
      layerType: row.layer_type || "",
      serviceType: row.service_type || "",
      serviceUrl: row.service_url || "",
      category: row.category || "",
      description: row.description || "",
      metadataJson: normalizeJsonObject(row.metadata_json),
      createdAt: row.created_at || "",
      updatedAt: row.updated_at || ""
    };
  }

  function policyDocument(row = {}) {
    return {
      id: row.id,
      sourceId: row.source_id || "",
      title: row.title || "",
      institution: row.institution || "",
      documentType: row.document_type || "",
      publicationDate: row.publication_date || "",
      url: row.url || "",
      summary: row.summary || "",
      rawText: row.raw_text || "",
      metadataJson: normalizeJsonObject(row.metadata_json),
      relevanceScore: Number(row.relevance_score || 0),
      createdAt: row.created_at || "",
      updatedAt: row.updated_at || ""
    };
  }

  function signal(row = {}) {
    return {
      id: row.id,
      sourceId: row.source_id || "",
      section: row.section || "radar",
      category: row.category || "dataset",
      title: row.title || "",
      summary: row.summary || "",
      whyFlagged: row.why_flagged || "",
      relevanceScore: Number(row.relevance_score || 0),
      urgency: row.urgency || "low",
      entityName: row.entity_name || "",
      entityType: row.entity_type || "",
      suggestedAction: row.suggested_action || "",
      rawJson: normalizeJsonObject(row.raw_json),
      detectedAt: row.detected_at || "",
      createdAt: row.created_at || "",
      updatedAt: row.updated_at || ""
    };
  }

  function syncRun(row = {}) {
    return {
      id: row.id,
      sourceId: row.source_id || "",
      connectorKey: row.connector_key || "",
      status: row.status || "running",
      startedAt: row.started_at || "",
      finishedAt: row.finished_at || "",
      recordsFound: Number(row.records_found || 0),
      recordsCreated: Number(row.records_created || 0),
      recordsUpdated: Number(row.records_updated || 0),
      errorMessage: row.error_message || "",
      metadataJson: normalizeJsonObject(row.metadata_json)
    };
  }

  function createDominicanIntelligenceApi(deps) {
    async function requireAccess() {
      const me = await deps.authorizedUser();
      if (!deps.canManageSignalWorkspace(me)) throw new Error("Permiso insuficiente.");
      return me;
    }

    async function loadDashboard(supabase) {
      const [
        sources,
        resources,
        datasets,
        institutions,
        procurementRecords,
        economicIndicators,
        geoLayers,
        policyDocuments,
        signals,
        syncRuns
      ] = await Promise.all([
        supabase.from(TABLES.sources).select("*").order("section", { ascending: true }).order("updated_at", { ascending: false }).limit(200),
        supabase.from(TABLES.resources).select("*").order("updated_at", { ascending: false }).limit(500),
        supabase.from(TABLES.datasets).select("*").order("relevance_score", { ascending: false }).order("updated_at", { ascending: false }).limit(500),
        supabase.from(TABLES.institutions).select("*").order("relevance_to_bcc", { ascending: true }).order("name", { ascending: true }).limit(300),
        supabase.from(TABLES.procurementRecords).select("*").order("relevance_score", { ascending: false }).order("updated_at", { ascending: false }).limit(250),
        supabase.from(TABLES.economicIndicators).select("*").order("updated_at", { ascending: false }).limit(250),
        supabase.from(TABLES.geoLayers).select("*").order("updated_at", { ascending: false }).limit(250),
        supabase.from(TABLES.policyDocuments).select("*").order("relevance_score", { ascending: false }).order("updated_at", { ascending: false }).limit(250),
        supabase.from(TABLES.signals).select("*").order("relevance_score", { ascending: false }).order("detected_at", { ascending: false }).limit(300),
        supabase.from(TABLES.syncRuns).select("*").order("started_at", { ascending: false }).limit(50)
      ]);

      const results = [sources, resources, datasets, institutions, procurementRecords, economicIndicators, geoLayers, policyDocuments, signals, syncRuns];
      const failed = results.find(result => result.error);
      if (failed?.error) throw failed.error;

      return {
        sources: (sources.data || []).map(source),
        resources: (resources.data || []).map(resource),
        datasets: (datasets.data || []).map(dataset),
        institutions: (institutions.data || []).map(institution),
        procurementRecords: (procurementRecords.data || []).map(procurementRecord),
        economicIndicators: (economicIndicators.data || []).map(economicIndicator),
        geoLayers: (geoLayers.data || []).map(geoLayer),
        policyDocuments: (policyDocuments.data || []).map(policyDocument),
        signals: (signals.data || []).map(signal),
        syncRuns: (syncRuns.data || []).map(syncRun)
      };
    }

    async function handle(rawPath, options = {}) {
      const path = normalizePath(rawPath);
      if (!path.startsWith("/api/admin/dominican-intelligence/")) return unhandled();

      const { supabase } = deps;
      await requireAccess();

      if (path === "/api/admin/dominican-intelligence/dashboard" && (!options.method || options.method === "GET")) {
        return handled({ ok: true, dashboard: await loadDashboard(supabase) });
      }

      if (path === "/api/admin/dominican-intelligence/sync" && options.method === "POST") {
        const body = JSON.parse(options.body || "{}");
        try {
          const { data, error } = await supabase.functions.invoke("run-dominican-intelligence-sync", {
            body: {
              target: body.target || "all",
              limit: body.limit || 50,
              limitPerTerm: body.limitPerTerm || 8
            }
          });
          if (error) throw error;
          if (data?.dashboard) return handled(data);
        } catch (_error) {
          // Production can still render persisted snapshots while the Edge sync is not deployed.
        }
        const dashboard = await loadDashboard(supabase);
        return handled({
          ok: true,
          snapshotOnly: true,
          dashboard,
          summary: {
            datasets: dashboard.datasets.length,
            resources: dashboard.resources.length,
            geoLayers: dashboard.geoLayers.length,
            signals: dashboard.signals.length
          },
          errors: [{
            message: "Live connector sync is not deployed for the static site yet; refreshed persisted Dominican Intelligence snapshot."
          }]
        });
      }

      return unhandled();
    }

    return { handle };
  }

  window.BCCAuthDominicanIntelligenceApi = { createDominicanIntelligenceApi };
})();
