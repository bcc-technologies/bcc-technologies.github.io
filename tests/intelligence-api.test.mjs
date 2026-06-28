import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { webcrypto } from "node:crypto";

function nowIso() {
  return "2026-06-21T00:00:00.000Z";
}

function createDb(role = "admin") {
  return {
    profiles: [
      {
        id: "user-1",
        email: "user@example.com",
        full_name: "BCC User",
        display_name: "BCC",
        role,
        staff_roles: [],
        departments: [],
        created_at: nowIso()
      }
    ],
    intelligence_topics: [
      {
        id: "topic-1",
        name: "MAP-Nano",
        description: "Existing topic",
        category: "nano",
        keywords: ["SEM image analysis"],
        enabled: true,
        created_at: nowIso(),
        updated_at: nowIso()
      }
    ],
    intelligence_sources: [
      {
        id: "source-1",
        name: "arXiv",
        type: "arxiv",
        base_url: "https://arxiv.org",
        enabled: true,
        requires_api_key: false,
        rate_limit_notes: "",
        last_sync_at: "",
        created_at: nowIso(),
        updated_at: nowIso()
      }
    ],
    intelligence_settings: [],
    intelligence_signals: [],
    intelligence_papers: [],
    intelligence_grants: [],
    intelligence_patents: [],
    intelligence_institutions: [],
    intelligence_runs: []
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createQuery(db, tableName) {
  const state = {
    mode: "select",
    filters: [],
    limit: null,
    order: [],
    payload: null
  };

  function applyFilters(rows) {
    return rows.filter(row => state.filters.every(filter => filter(row)));
  }

  function applyOrder(rows) {
    let next = rows.slice();
    for (let index = state.order.length - 1; index >= 0; index -= 1) {
      const rule = state.order[index];
      next.sort((left, right) => {
        const a = left?.[rule.column];
        const b = right?.[rule.column];
        if (a === b) return 0;
        if (a === null || typeof a === "undefined" || a === "") return rule.nullsFirst ? -1 : 1;
        if (b === null || typeof b === "undefined" || b === "") return rule.nullsFirst ? 1 : -1;
        if (a < b) return rule.ascending ? -1 : 1;
        return rule.ascending ? 1 : -1;
      });
    }
    return next;
  }

  function normalizeRows(rows) {
    const limited = state.limit === null ? rows : rows.slice(0, state.limit);
    return limited.map(row => clone(row));
  }

  async function execute() {
    const table = db[tableName];
    if (!Array.isArray(table)) {
      return { data: null, error: new Error(`Unknown table ${tableName}`) };
    }

    if (state.mode === "insert") {
      const records = (Array.isArray(state.payload) ? state.payload : [state.payload]).map((row, index) => ({
        id: row.id || `${tableName}-${table.length + index + 1}`,
        created_at: row.created_at || nowIso(),
        updated_at: row.updated_at || nowIso(),
        ...clone(row)
      }));
      table.push(...records);
      return { data: normalizeRows(records), error: null };
    }

    const filtered = applyFilters(table);

    if (state.mode === "update") {
      filtered.forEach(row => Object.assign(row, clone(state.payload)));
      return { data: normalizeRows(filtered), error: null };
    }

    if (state.mode === "delete") {
      const deleted = filtered.map(row => clone(row));
      db[tableName] = table.filter(row => !filtered.includes(row));
      return { data: normalizeRows(deleted), error: null };
    }

    return { data: normalizeRows(applyOrder(filtered)), error: null };
  }

  return {
    select() {
      return this;
    },
    insert(payload) {
      state.mode = "insert";
      state.payload = payload;
      return this;
    },
    update(payload) {
      state.mode = "update";
      state.payload = payload;
      return this;
    },
    delete() {
      state.mode = "delete";
      return this;
    },
    eq(column, value) {
      state.filters.push(row => row?.[column] === value);
      return this;
    },
    contains(column, values) {
      state.filters.push(row => values.every(value => Array.isArray(row?.[column]) && row[column].includes(value)));
      return this;
    },
    gte(column, value) {
      state.filters.push(row => String(row?.[column] || "") >= String(value));
      return this;
    },
    lte(column, value) {
      state.filters.push(row => String(row?.[column] || "") <= String(value));
      return this;
    },
    ilike(column, pattern) {
      const needle = String(pattern || "").replaceAll("%", "").toLowerCase();
      state.filters.push(row => String(row?.[column] || "").toLowerCase().includes(needle));
      return this;
    },
    in(column, values) {
      state.filters.push(row => values.includes(row?.[column]));
      return this;
    },
    order(column, config = {}) {
      state.order.push({
        column,
        ascending: config.ascending !== false,
        nullsFirst: Boolean(config.nullsFirst)
      });
      return this;
    },
    limit(value) {
      state.limit = Number(value);
      return this;
    },
    async single() {
      const { data, error } = await execute();
      if (error) return { data: null, error };
      return { data: data[0] || null, error: data[0] ? null : new Error("Row not found") };
    },
    async maybeSingle() {
      const { data, error } = await execute();
      if (error) return { data: null, error };
      return { data: data[0] || null, error: null };
    },
    then(resolve, reject) {
      return execute().then(resolve, reject);
    }
  };
}

function loadAuthHarness(role = "admin") {
  const code = fs.readFileSync(path.resolve(process.cwd(), "js/auth.js"), "utf8");
  const db = createDb(role);
  const supabaseClient = {
    auth: {
      async getUser() {
        return {
          data: {
            user: {
              id: "user-1",
              email: "user@example.com",
              user_metadata: { full_name: "BCC User" },
              created_at: nowIso(),
              last_sign_in_at: nowIso()
            }
          },
          error: null
        };
      },
      async signOut() {
        return { error: null };
      }
    },
    from(tableName) {
      return createQuery(db, tableName);
    },
    functions: {
      async invoke() {
        return { data: { ok: true }, error: null };
      }
    },
    async rpc() {
      return { data: null, error: null };
    }
  };

  const documentStub = {
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => ({ setAttribute() {}, appendChild() {} }),
    addEventListener() {},
    head: { appendChild() {} }
  };

  const context = {
    window: {
      location: {
        origin: "https://example.com",
        pathname: "/staff-dashboard.html",
        search: "",
        hash: "",
        replace() {},
        assign() {}
      },
      history: { replaceState() {} },
      BCC_SUPABASE: {
        url: "https://example.supabase.co",
        anonKey: "anon-key"
      },
      supabase: {
        createClient() {
          return supabaseClient;
        }
      }
    },
    document: documentStub,
    console,
    crypto: webcrypto,
    URL,
    URLSearchParams,
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

  context.window.document = documentStub;
  context.window.history = context.window.history || { replaceState() {} };
  context.location = context.window.location;
  context.history = context.window.history;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(code, context, { filename: "auth.js" });

  return { api: context.window.BCCAuth.api, db };
}

test("intelligence admin endpoints reject non-admin users", async () => {
  const { api } = loadAuthHarness("client");

  await assert.rejects(
    api("/api/admin/intelligence/overview"),
    /Permiso insuficiente/
  );
});

test("intelligence topics CRUD works for admin users", async () => {
  const { api } = loadAuthHarness("admin");

  const created = await api("/api/admin/intelligence/topics", {
    method: "POST",
    body: JSON.stringify({
      name: "MAP-Bio",
      description: "Bio topic",
      category: "bio",
      keywords: ["cell counting"],
      enabled: true
    })
  });
  assert.equal(created.ok, true);
  assert.equal(created.topic.name, "MAP-Bio");
  assert.deepEqual(created.topic.keywords, ["cell counting"]);

  const listed = await api("/api/admin/intelligence/topics");
  assert.equal(listed.topics.length, 2);

  const updated = await api(`/api/admin/intelligence/topics/${created.topic.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      description: "Updated bio topic",
      enabled: false
    })
  });
  assert.equal(updated.topic.enabled, false);
  assert.equal(updated.topic.description, "Updated bio topic");

  const removed = await api(`/api/admin/intelligence/topics/${created.topic.id}`, {
    method: "DELETE"
  });
  assert.equal(removed.topic.id, created.topic.id);

  const afterDelete = await api("/api/admin/intelligence/topics");
  assert.equal(afterDelete.topics.length, 1);
});

test("intelligence sources can be enabled and disabled", async () => {
  const { api } = loadAuthHarness("admin");

  const updated = await api("/api/admin/intelligence/sources/source-1", {
    method: "PATCH",
    body: JSON.stringify({
      enabled: false,
      rateLimitNotes: "Paused for maintenance"
    })
  });

  assert.equal(updated.ok, true);
  assert.equal(updated.source.enabled, false);
  assert.equal(updated.source.rateLimitNotes, "Paused for maintenance");

  const listed = await api("/api/admin/intelligence/sources?enabled=false");
  assert.equal(listed.sources.length, 1);
  assert.equal(listed.sources[0].id, "source-1");
});
