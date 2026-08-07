import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

function createClassList() {
  const tokens = new Set();
  return {
    add(...names) {
      names.forEach(name => tokens.add(name));
    },
    remove(...names) {
      names.forEach(name => tokens.delete(name));
    },
    toggle(name, force) {
      const next = force === undefined ? !tokens.has(name) : Boolean(force);
      if (next) tokens.add(name);
      else tokens.delete(name);
      return next;
    },
    contains(name) {
      return tokens.has(name);
    }
  };
}

function matchesDataSelector(dataset, selector) {
  const match = String(selector || "").match(/^\[data-([a-z-]+)(?:="([^"]*)")?\]$/);
  if (!match) return false;
  const key = match[1].replace(/-([a-z])/g, (_, char) => char.toUpperCase());
  if (!(key in dataset)) return false;
  return match[2] === undefined || dataset[key] === match[2];
}

function createElementStub(dataset = {}) {
  const listeners = new Map();
  return {
    dataset: { ...dataset },
    classList: createClassList(),
    innerHTML: "",
    textContent: "",
    value: "",
    checked: false,
    disabled: false,
    hidden: false,
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(handler);
    },
    // Test-only helper (not part of the DOM API) so handleClick/handleChange/
    // handleSubmit -- which nothing else in this suite exercises, since
    // addEventListener above is otherwise a no-op -- can be driven directly.
    dispatch(type, event) {
      (listeners.get(type) || new Set()).forEach(handler => handler(event));
    },
    matches(selector) {
      return matchesDataSelector(this.dataset, selector);
    },
    closest(selector) {
      return this.matches(selector) ? this : null;
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    }
  };
}

function createWorkspaceRoot() {
  const message = createElementStub({ intelligenceMessage: "" });
  const action = createElementStub({ intelligenceAction: "" });
  const dryRun = createElementStub({ intelligenceDryRun: "" });
  const refresh = createElementStub({ intelligenceRefresh: "" });
  const run = createElementStub({ intelligenceRun: "" });
  const panels = new Map([
    ["overview", createElementStub({ intelligencePanel: "overview" })],
    ["signals", createElementStub({ intelligencePanel: "signals" })],
    ["papers", createElementStub({ intelligencePanel: "papers" })],
    ["grants", createElementStub({ intelligencePanel: "grants" })],
    ["patents", createElementStub({ intelligencePanel: "patents" })],
    ["trials", createElementStub({ intelligencePanel: "trials" })],
    ["institutions", createElementStub({ intelligencePanel: "institutions" })],
    ["topics", createElementStub({ intelligencePanel: "topics" })],
    ["sources", createElementStub({ intelligencePanel: "sources" })],
    ["settings", createElementStub({ intelligencePanel: "settings" })]
  ]);
  const chips = ["overview", "signals", "papers", "grants", "patents", "trials", "institutions", "topics", "sources", "settings"]
    .map(name => createElementStub({ panelTarget: name }));

  const root = createElementStub({ intelligenceWorkspace: "" });
  root.querySelector = selector => {
    if (selector === "[data-intelligence-message]") return message;
    if (selector === "[data-intelligence-action]") return action;
    if (selector === "[data-intelligence-dry-run]") return dryRun;
    if (selector === "[data-intelligence-refresh]") return refresh;
    if (selector === "[data-intelligence-run]") return run;
    const panelMatch = selector.match(/^\[data-intelligence-panel="([^"]+)"\]$/);
    if (panelMatch) return panels.get(panelMatch[1]) || null;
    return null;
  };
  root.querySelectorAll = selector => {
    if (selector === "[data-panel-target]") return chips;
    return [];
  };

  return { root, panels, message, action, dryRun, run, chips };
}

function readWorkspaceFile(relativePath) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

async function loadWorkspaceModule(dashboardOverrides = {}) {
  // Mirrors the load order declared in feature-registry.js for the
  // "intelligence" feature: transport.js first (intelligence.api.js reads
  // window.BCCWorkspaceTransport at load time), then constants, then the
  // api repository, then the state/view layers, then the controller itself.
  const transportCode = readWorkspaceFile("js/workspace/transport.js");
  const constantsCode = readWorkspaceFile("js/workspace/intelligence.constants.js");
  const apiCode = readWorkspaceFile("js/workspace/intelligence.api.js");
  const stateCode = readWorkspaceFile("js/workspace/intelligence.state.js");
  const viewCode = readWorkspaceFile("js/workspace/intelligence.view.js");
  const code = readWorkspaceFile("js/workspace/intelligence.js");
  const { root, panels, message, action, dryRun, run, chips } = createWorkspaceRoot();

  const documentStub = {
    querySelector(selector) {
      if (selector === "[data-intelligence-workspace]") return root;
      return null;
    }
  };

  const dashboard = {
    overview: {
      papersTracked: 0,
      totalGrants: 0,
      totalPatents: 0,
      priorityTopics: 0,
      newSignals: 0
    },
    sources: [],
    papers: [],
    grants: [],
    patents: [],
    institutions: [],
    topics: [],
    signals: [],
    runs: [],
    settings: {
      id: "",
      maxResultsPerSource: 20,
      defaultDateRangeDays: 90,
      suggestedFrequency: "daily",
      defaultDryRun: false,
      scoringThresholds: { opportunity: 60, actionability: 50, confidence: 50 },
      monitoredLines: ["MAP-Nano", "MAP-Bio", "MAP-Med", "MAP-Ing", "MAPs", "General"]
    },
    ...dashboardOverrides
  };

  const context = {
    window: {
      document: documentStub,
      location: { origin: "https://example.com" },
      setTimeout,
      clearTimeout,
      BCCWorkspaceUtils: {
        escapeHtml: String,
        escapeAttr: String,
        formatDate: String,
        formatDateTime: String,
        refreshIcons() {},
        renderMessageBlock(target, text, tone) { target.textContent = String(text || ""); target.dataset.tone = tone; },
        async withTimeout(promise) { return promise; }
      },
      BCCAuth: {
        async api(path, options = {}) {
          const signalMatch = String(path || "").match(/^\/api\/admin\/intelligence\/signals\/([^/]+)$/);
          if (signalMatch && options.method === "PATCH") {
            const id = decodeURIComponent(signalMatch[1]);
            const body = options.body ? JSON.parse(options.body) : {};
            const existing = dashboard.signals.find(item => item.id === id) || {};
            return { ok: true, signal: { ...existing, id, ...body } };
          }
          return { ok: true, dashboard };
        }
      }
    },
    document: documentStub,
    console,
    URL,
    Date,
    Math,
    Number,
    String,
    Array,
    Object,
    Set,
    Map,
    RegExp,
    JSON,
    parseInt,
    parseFloat,
    setTimeout,
    clearTimeout,
    AbortController
  };

  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(transportCode, context, { filename: "workspace/transport.js" });
  vm.runInContext(constantsCode, context, { filename: "workspace/intelligence.constants.js" });
  vm.runInContext(apiCode, context, { filename: "workspace/intelligence.api.js" });
  vm.runInContext(stateCode, context, { filename: "workspace/intelligence.state.js" });
  vm.runInContext(viewCode, context, { filename: "workspace/intelligence.view.js" });
  vm.runInContext(code, context, { filename: "workspace/intelligence.js" });

  context.window.BCCWorkspaceIntelligence.init({ id: "admin-1" });
  await new Promise(resolve => setTimeout(resolve, 0));
  await new Promise(resolve => setTimeout(resolve, 0));

  return {
    panels,
    message,
    root,
    action,
    dryRun,
    run,
    chips,
    State: context.window.BCCWorkspaceIntelligenceState,
    View: context.window.BCCWorkspaceIntelligenceView
  };
}

test("intelligence overview renders usable empty states when there is no data", async () => {
  const { panels, message } = await loadWorkspaceModule();

  assert.match(message.textContent, /Intelligence científica y tecnológica/i);
  assert.match(panels.get("overview").innerHTML, /Total papers/);
  assert.match(panels.get("signals").innerHTML, /Todavía no hay señales estratégicas generadas\./);
  assert.match(panels.get("papers").innerHTML, /Todavía no hay papers sincronizados\./);
  assert.match(panels.get("topics").innerHTML, /No hay topics configurados\./);
  assert.match(panels.get("sources").innerHTML, /No hay fuentes de intelligence configuradas\./);
});

test("topic hit counts match papers/signals correctly through the memoized index", async () => {
  const { panels } = await loadWorkspaceModule({
    topics: [
      { id: "topic-nano", name: "MAP-Nano", category: "nano", description: "", keywords: ["quantum"], enabled: true }
    ],
    papers: [
      { id: "paper-1", title: "Quantum paper", abstract: "", authors: [], institutions: [], topics: ["MAP-Nano"], keywords: [], citationsCount: 0 },
      { id: "paper-2", title: "Unrelated paper", abstract: "", authors: [], institutions: [], topics: [], keywords: [], citationsCount: 0 }
    ],
    signals: [
      {
        id: "signal-1",
        title: "Signal A",
        summary: "",
        signalType: "research_trend",
        relatedLine: "MAP-Nano",
        status: "new",
        opportunityScore: 50,
        actionabilityScore: 50,
        confidenceScore: 50,
        evidenceRefs: []
      }
    ]
  });

  const topicsHtml = panels.get("topics").innerHTML;
  assert.match(topicsHtml, /<span>Papers<\/span><strong>1<\/strong>/);
  assert.match(topicsHtml, /<span>Señales<\/span><strong>1<\/strong>/);
  assert.match(topicsHtml, /<span>Activos<\/span><strong>2<\/strong>/);

  const overviewHtml = panels.get("overview").innerHTML;
  assert.match(overviewHtml, /MAP-Nano/);
});

test("papers and grants panels paginate instead of rendering every match at once", async () => {
  const today = new Date().toISOString().slice(0, 10);
  const papers = Array.from({ length: 25 }, (_, index) => ({
    id: `paper-${index}`,
    title: `Paper title ${index}`,
    abstract: "",
    authors: [],
    institutions: [],
    topics: [],
    keywords: [],
    citationsCount: 0,
    publicationDate: today
  }));
  const grants = Array.from({ length: 55 }, (_, index) => ({
    id: `grant-${index}`,
    title: `Grant title ${index}`,
    abstract: "",
    agency: "",
    program: "",
    principalInvestigators: [],
    institutions: [],
    topics: [],
    sourceUrl: "",
    startDate: today
  }));

  const { panels } = await loadWorkspaceModule({ papers, grants });

  const papersHtml = panels.get("papers").innerHTML;
  const renderedPaperTitles = papersHtml.match(/Paper title \d+/g) || [];
  assert.equal(renderedPaperTitles.length, 20, "papers panel should only render one page of cards");
  assert.match(papersHtml, /Mostrando 20 de 25/);
  assert.match(papersHtml, /data-research-load-more="papers"/);

  const grantsHtml = panels.get("grants").innerHTML;
  const renderedGrantTitles = grantsHtml.match(/Grant title \d+/g) || [];
  assert.equal(renderedGrantTitles.length, 50, "grants panel should only render one page of rows");
  assert.match(grantsHtml, /Mostrando 50 de 55/);
  assert.match(grantsHtml, /data-research-load-more="grants"/);
});

test("overview shows a copy-error button only when the latest run failed", async () => {
  const { panels } = await loadWorkspaceModule({
    runs: [
      {
        id: "run-failed-1",
        status: "failed",
        actionType: "sync_papers",
        dryRun: false,
        startedAt: "2026-08-05T00:00:00.000Z",
        finishedAt: "2026-08-05T00:05:00.000Z",
        itemsFetched: 0,
        itemsCreated: 0,
        itemsUpdated: 0,
        signalsGenerated: 0,
        errorMessage: "Supabase timed out"
      }
    ]
  });

  const overviewHtml = panels.get("overview").innerHTML;
  assert.match(overviewHtml, /data-intelligence-copy-error="run-failed-1"/);
  assert.match(overviewHtml, />Copiar detalle</);
});

test("overview omits the copy-error button when the latest run succeeded", async () => {
  const { panels } = await loadWorkspaceModule({
    runs: [
      {
        id: "run-ok-1",
        status: "completed",
        actionType: "sync_papers",
        dryRun: false,
        startedAt: "2026-08-05T00:00:00.000Z",
        finishedAt: "2026-08-05T00:05:00.000Z",
        itemsFetched: 3,
        itemsCreated: 3,
        itemsUpdated: 0,
        signalsGenerated: 0,
        errorMessage: ""
      }
    ]
  });

  const overviewHtml = panels.get("overview").innerHTML;
  assert.doesNotMatch(overviewHtml, /data-intelligence-copy-error/);
});

test("grants empty state accurately describes that fetching is implemented", async () => {
  const { panels } = await loadWorkspaceModule();
  const grantsHtml = panels.get("grants").innerHTML;
  assert.doesNotMatch(grantsHtml, /pendiente de implementaci/i);
  assert.match(grantsHtml, /ya está implementada/);
});

test("patents empty state accurately describes that fetching is implemented", async () => {
  const { panels } = await loadWorkspaceModule();
  const patentsHtml = panels.get("patents").innerHTML;
  assert.doesNotMatch(patentsHtml, /pendiente de implementaci/i);
  assert.match(patentsHtml, /ya está implementada/);
});

test("grants/patents/trials tables flag possible duplicates and can filter down to only them", async () => {
  const today = new Date().toISOString().slice(0, 10);
  const { panels } = await loadWorkspaceModule({
    grants: [
      { id: "grant-1", title: "Grant A", abstract: "", agency: "", program: "", principalInvestigators: [], institutions: [], topics: [], sourceUrl: "", startDate: today, possibleDuplicate: true },
      { id: "grant-2", title: "Grant B", abstract: "", agency: "", program: "", principalInvestigators: [], institutions: [], topics: [], sourceUrl: "", startDate: today, possibleDuplicate: false }
    ],
    patents: [
      { id: "patent-1", title: "Patent A", abstract: "", inventors: [], assignees: [], topics: [], sourceUrl: "", publicationDate: today, possibleDuplicate: true }
    ],
    trials: [
      { id: "trial-1", title: "Trial A", summary: "", interventions: [], locations: [], topics: [], sourceUrl: "", startDate: today, possibleDuplicate: true }
    ]
  });

  const grantsHtml = panels.get("grants").innerHTML;
  assert.match(grantsHtml, /Posible duplicado/);
  assert.match(grantsHtml, /1 posibles duplicados/);
  assert.match(grantsHtml, /data-filter-field="duplicatesOnly"/);

  assert.match(panels.get("patents").innerHTML, /Posible duplicado/);
  assert.match(panels.get("trials").innerHTML, /Posible duplicado/);
});

// The tests below exercise handleClick/handleChange, the event-delegation
// paths the split into intelligence.state.js/intelligence.view.js/
// intelligence.js touched the most (every mutation site had to move from a
// bare closure variable to an IntelligenceState.xxx accessor). Nothing above
// this point actually dispatches a DOM event -- addEventListener was a no-op
// until createElementStub grew dispatch()/matches()/closest() support -- so
// these are the first tests to run that code at all.
test("clicking a nav chip switches the current panel and re-renders it as visible", async () => {
  const { root, panels, State } = await loadWorkspaceModule();

  assert.equal(State.currentPanel, "overview");
  root.dispatch("click", { target: createElementStub({ panelTarget: "topics" }) });

  assert.equal(State.currentPanel, "topics");
  assert.equal(panels.get("topics").classList.contains("is-hidden"), false);
  assert.equal(panels.get("overview").classList.contains("is-hidden"), true);
});

test("selecting a topic updates selectedTopicId and re-renders only the topics panel", async () => {
  const { root, panels, State } = await loadWorkspaceModule({
    topics: [{ id: "topic-1", name: "MAP-Nano", category: "nano", description: "", keywords: [], enabled: true }]
  });

  root.dispatch("click", { target: createElementStub({ topicSelect: "topic-1" }) });

  assert.equal(State.selectedTopicId, "topic-1");
  assert.match(panels.get("topics").innerHTML, /is-active/);

  root.dispatch("click", { target: createElementStub({ topicReset: "" }) });
  assert.equal(State.selectedTopicId, "");
});

test("resetting the papers filters restores defaults and the default page size", async () => {
  const { root, State } = await loadWorkspaceModule();

  State.filters.papers.topic = "MAP-Nano";
  State.filters.papers.keyword = "quantum";
  State.visibleCounts.papers = 40;

  root.dispatch("click", { target: createElementStub({ papersReset: "" }) });

  assert.equal(State.filters.papers.topic, "");
  assert.equal(State.filters.papers.keyword, "");
  assert.equal(State.visibleCounts.papers, 20);
});

test("clicking load-more increases the visible count for that panel only", async () => {
  const { root, State } = await loadWorkspaceModule();
  const before = State.visibleCounts.grants;

  root.dispatch("click", { target: createElementStub({ researchLoadMore: "grants" }) });

  assert.equal(State.visibleCounts.grants, before + 50);
  assert.equal(State.visibleCounts.patents, 50);
});

test("changing the sync action select and dry-run checkbox updates state", async () => {
  const { root, State } = await loadWorkspaceModule();

  root.dispatch("change", { target: { matches: selector => selector === "[data-intelligence-action]", value: "fetch_grants" } });
  assert.equal(State.currentAction, "fetch_grants");

  root.dispatch("change", { target: { matches: selector => selector === "[data-intelligence-dry-run]", checked: true } });
  assert.equal(State.syncDryRun, true);
});

test("changing a research filter field updates nested state and resets that panel's page size", async () => {
  const { root, State } = await loadWorkspaceModule();
  State.visibleCounts.grants = 100;

  const filterInput = {
    matches: selector => selector === "[data-intelligence-filter-panel]",
    dataset: { intelligenceFilterPanel: "grants", filterField: "keyword" },
    type: "text",
    value: "battery"
  };
  root.dispatch("change", { target: filterInput });

  assert.equal(State.filters.grants.keyword, "battery");
  assert.equal(State.visibleCounts.grants, 50);
});

test("checking a signal's bulk checkbox shows the bulk toolbar with a matching count", async () => {
  const { root, panels, State } = await loadWorkspaceModule({
    signals: [
      { id: "signal-1", title: "Signal A", summary: "", signalType: "research_trend", relatedLine: "MAP-Nano", status: "new", opportunityScore: 50, actionabilityScore: 50, confidenceScore: 50, evidenceRefs: [] },
      { id: "signal-2", title: "Signal B", summary: "", signalType: "research_trend", relatedLine: "MAP-Bio", status: "new", opportunityScore: 50, actionabilityScore: 50, confidenceScore: 50, evidenceRefs: [] }
    ]
  });

  assert.doesNotMatch(panels.get("signals").innerHTML, /intelligence-bulk-toolbar/);

  root.dispatch("change", { target: { matches: selector => selector === "[data-signal-bulk-toggle]", dataset: { signalBulkToggle: "signal-1" }, checked: true } });
  assert.deepEqual([...State.selectedBulkSignalIds], ["signal-1"]);
  assert.match(panels.get("signals").innerHTML, /1 seleccionadas/);

  root.dispatch("change", { target: { matches: selector => selector === "[data-signal-bulk-toggle]", dataset: { signalBulkToggle: "signal-2" }, checked: true } });
  assert.match(panels.get("signals").innerHTML, /2 seleccionadas/);

  root.dispatch("click", { target: createElementStub({ signalBulkClear: "" }) });
  assert.equal(State.selectedBulkSignalIds.size, 0);
  assert.doesNotMatch(panels.get("signals").innerHTML, /intelligence-bulk-toolbar/);
});

test("a bulk status action updates every selected signal and clears the selection on success", async () => {
  const { root, panels, State } = await loadWorkspaceModule({
    signals: [
      { id: "signal-1", title: "Signal A", summary: "", signalType: "research_trend", relatedLine: "MAP-Nano", status: "new", opportunityScore: 50, actionabilityScore: 50, confidenceScore: 50, evidenceRefs: [] },
      { id: "signal-2", title: "Signal B", summary: "", signalType: "research_trend", relatedLine: "MAP-Bio", status: "new", opportunityScore: 50, actionabilityScore: 50, confidenceScore: 50, evidenceRefs: [] }
    ]
  });

  State.selectedBulkSignalIds.add("signal-1");
  State.selectedBulkSignalIds.add("signal-2");

  root.dispatch("click", { target: createElementStub({ signalBulkStatus: "archived" }) });
  await new Promise(resolve => setTimeout(resolve, 0));
  await new Promise(resolve => setTimeout(resolve, 0));

  assert.equal(State.selectedBulkSignalIds.size, 0);
  assert.equal(State.dashboard.signals.find(item => item.id === "signal-1").status, "archived");
  assert.equal(State.dashboard.signals.find(item => item.id === "signal-2").status, "archived");
  assert.match(panels.get("overview").innerHTML, /./, "overview should have re-rendered");
});

test("an auto-archived signal is badged distinctly from a manually archived one", async () => {
  const { panels } = await loadWorkspaceModule({
    signals: [
      { id: "signal-1", title: "Auto archived signal", summary: "", signalType: "research_trend", relatedLine: "MAP-Nano", status: "archived", autoArchived: true, opportunityScore: 40, actionabilityScore: 40, confidenceScore: 40, evidenceRefs: [] },
      { id: "signal-2", title: "Manually archived signal", summary: "", signalType: "research_trend", relatedLine: "MAP-Bio", status: "archived", autoArchived: false, opportunityScore: 40, actionabilityScore: 40, confidenceScore: 40, evidenceRefs: [] }
    ]
  });

  const signalsHtml = panels.get("signals").innerHTML;
  const autoIndex = signalsHtml.indexOf("Auto archived signal");
  const manualIndex = signalsHtml.indexOf("Manually archived signal");
  const badgeIndex = signalsHtml.indexOf("Auto-archivada");
  assert.ok(autoIndex !== -1 && manualIndex !== -1 && badgeIndex !== -1);
  assert.ok(badgeIndex > autoIndex && badgeIndex < manualIndex, "the badge should only appear next to the auto-archived signal");
});
