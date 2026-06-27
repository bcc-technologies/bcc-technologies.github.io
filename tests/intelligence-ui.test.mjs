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

function createElementStub(dataset = {}) {
  return {
    dataset: { ...dataset },
    classList: createClassList(),
    innerHTML: "",
    textContent: "",
    value: "",
    checked: false,
    hidden: false,
    addEventListener() {},
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
    ["institutions", createElementStub({ intelligencePanel: "institutions" })],
    ["topics", createElementStub({ intelligencePanel: "topics" })],
    ["sources", createElementStub({ intelligencePanel: "sources" })],
    ["settings", createElementStub({ intelligencePanel: "settings" })]
  ]);
  const chips = ["overview", "signals", "papers", "grants", "patents", "institutions", "topics", "sources", "settings"]
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

  return { root, panels, message };
}

async function loadWorkspaceModule() {
  const code = fs.readFileSync(path.resolve(process.cwd(), "js/workspace/intelligence.js"), "utf8");
  const { root, panels, message } = createWorkspaceRoot();

  const documentStub = {
    querySelector(selector) {
      if (selector === "[data-intelligence-workspace]") return root;
      return null;
    }
  };

  const context = {
    window: {
      document: documentStub,
      location: { origin: "https://example.com" },
      setTimeout,
      clearTimeout,
      BCCAuth: {
        async api() {
          return {
            ok: true,
            dashboard: {
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
              }
            }
          };
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
    clearTimeout
  };

  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(code, context, { filename: "workspace/intelligence.js" });

  context.window.BCCWorkspaceIntelligence.init({ id: "admin-1" });
  await new Promise(resolve => setTimeout(resolve, 0));
  await new Promise(resolve => setTimeout(resolve, 0));

  return { panels, message };
}

test("intelligence overview renders usable empty states when there is no data", async () => {
  const { panels, message } = await loadWorkspaceModule();

  assert.match(message.textContent, /Scientific & technology intelligence/i);
  assert.match(panels.get("overview").innerHTML, /Total papers/);
  assert.match(panels.get("signals").innerHTML, /No strategic signals generated yet\./);
  assert.match(panels.get("papers").innerHTML, /No papers synced yet\./);
  assert.match(panels.get("topics").innerHTML, /No topics configured\./);
  assert.match(panels.get("sources").innerHTML, /No intelligence sources configured\./);
});
