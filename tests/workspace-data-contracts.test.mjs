import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const modules = [
  "transport",
  "tasks-contracts",
  "tasks-repository",
  "calendar-contracts",
  "calendar-repository",
  "forms-contracts",
  "forms-repository"
];

function runtime(api) {
  const window = {
    BCCAuth: { api },
    setTimeout,
    clearTimeout
  };
  const context = vm.createContext({
    window,
    AbortController,
    Error,
    Object,
    Array,
    Set,
    Date,
    Promise,
    String,
    Number,
    Boolean,
    Math,
    JSON,
    encodeURIComponent
  });
  modules.forEach(name => vm.runInContext(
    read(`js/workspace/${name}.js`),
    context,
    { filename: `${name}.js` }
  ));
  return window;
}

test("workspace repositories own routes, serialization and DTO normalization", async () => {
  const calls = [];
  const window = runtime(async (path, options) => {
    calls.push({ path, options });
    if (path === "/api/workspace/tasks" && options.method === "GET") {
      return { tasks: [{ id: 7, title: null, importance: "5" }] };
    }
    if (path === "/api/workspace/tasks/7") {
      return { task: { id: 7, title: "Revisada", urgency: "4" } };
    }
    if (path === "/api/workspace/events" && options.method === "POST") {
      return { event: { id: 9, title: "Demo", startTime: null } };
    }
    if (path === "/api/workspace/forms/form%2F1/response") {
      return { response: { id: 11, formId: "form/1", answers: { score: "5" } } };
    }
    if (path === "/api/workspace/forms/received") {
      return { forms: [{ id: "form/2", title: "Seguimiento", recipientIds: ["client-1"] }] };
    }
    if (path === "/api/workspace/forms/recipients") {
      return { recipients: [{ id: "client-1", label: "Acme", email: "contact@acme.example" }] };
    }
    throw new Error(`Unexpected request ${path}`);
  });

  const tasks = await window.BCCWorkspaceTaskRepository.list();
  const updated = await window.BCCWorkspaceTaskRepository.update("7", { status: "done" });
  const event = await window.BCCWorkspaceCalendarRepository.create({ title: "Demo" });
  const response = await window.BCCWorkspaceFormRepository.submit("form/1", { score: "5" });
  const received = await window.BCCWorkspaceFormRepository.listReceived();
  const recipients = await window.BCCWorkspaceFormRepository.listRecipients();

  assert.equal(tasks[0].id, "7");
  assert.equal(tasks[0].title, "");
  assert.equal(tasks[0].importance, 5);
  assert.equal(updated.urgency, 4);
  assert.equal(event.id, "9");
  assert.equal(event.startTime, "");
  assert.equal(response.id, "11");
  assert.equal(received[0].id, "form/2");
  assert.deepEqual(Array.from(received[0].recipientIds), ["client-1"]);
  assert.equal(recipients[0].email, "contact@acme.example");
  assert.equal(calls[1].options.body, JSON.stringify({ status: "done" }));
  assert.equal(calls[2].options.body, JSON.stringify({ title: "Demo" }));
  assert.equal(calls[3].path, "/api/workspace/forms/form%2F1/response");
  assert.equal(calls[3].options.body, JSON.stringify({ answers: { score: "5" } }));
  assert.equal(calls[4].path, "/api/workspace/forms/received");
  assert.equal(calls[5].path, "/api/workspace/forms/recipients");
});

test("workspace transport exposes stable network, schema and timeout errors", async () => {
  const networkWindow = runtime(async () => {
    throw new TypeError("NetworkError when attempting to fetch resource.");
  });
  await assert.rejects(
    networkWindow.BCCWorkspaceTaskRepository.list(),
    error => error.code === "network" && error.retryable === true
  );

  const schemaWindow = runtime(async () => {
    throw new Error('relation "workspace_forms" does not exist');
  });
  await assert.rejects(
    schemaWindow.BCCWorkspaceFormRepository.list(),
    error => error.code === "schema_unavailable" && /tablas de formularios/.test(error.message)
  );

  const schemaCacheWindow = runtime(async () => {
    throw Object.assign(
      new Error("Could not find the 'recipient_ids' column of 'workspace_forms' in the schema cache"),
      { code: "PGRST204" }
    );
  });
  await assert.rejects(
    schemaCacheWindow.BCCWorkspaceFormRepository.list(),
    error => error.code === "schema_updating" && error.retryable && /actualizando/.test(error.message)
  );

  const permissionWindow = runtime(async () => {
    throw new Error("permission denied for table workspace_forms");
  });
  await assert.rejects(
    permissionWindow.BCCWorkspaceFormRepository.list(),
    error => error.code === "forbidden" && /permiso/.test(error.message)
  );

  let timeoutSignal = null;
  const timeoutWindow = runtime((path, options) => {
    timeoutSignal = options.signal;
    return new Promise(() => {});
  });
  await assert.rejects(
    timeoutWindow.BCCWorkspaceTransport.request("/slow", { timeoutMs: 5 }),
    error => error.code === "timeout" && error.retryable === true
  );
  assert.equal(timeoutSignal.aborted, true);
});

test("workspace transport honors caller cancellation", async () => {
  const window = runtime(() => new Promise(() => {}));
  const controller = new AbortController();
  const request = window.BCCWorkspaceTransport.request("/slow", {
    signal: controller.signal,
    timeoutMs: 0
  });
  controller.abort();
  await assert.rejects(request, error => error.code === "cancelled");
});

test("Supabase workspace adapter propagates transport signals to query builders", () => {
  const adapter = read("js/auth-workspace-api.js");
  const auth = read("js/auth.js");

  assert.match(adapter, /abortable\(query, signal\)/);
  assert.match(adapter, /\.single\(\), options\.signal\)/);
  assert.match(adapter, /\.order\("created_at", \{ ascending: false \}\), options\.signal\)/);
  assert.match(auth, /loadWorkspaceTaskCollaborators\(supabase, signal = null\)/);
  assert.match(auth, /query\.abortSignal\(signal\)/);
});

test("workspace controllers depend on repositories instead of transport envelopes", () => {
  const controllers = [
    read("js/workspace/productivity.js"),
    read("js/workspace/calendar.js"),
    read("js/workspace/forms.js")
  ].join("\n");
  const registry = read("js/workspace/feature-registry.js");

  assert.doesNotMatch(controllers, /BCCAuth\.api|JSON\.stringify/);
  assert.match(controllers, /BCCWorkspaceTaskRepository/);
  assert.match(controllers, /BCCWorkspaceCalendarRepository/);
  assert.match(controllers, /BCCWorkspaceFormRepository/);
  assert.match(registry, /transport\.js[\s\S]+tasks-contracts\.js[\s\S]+tasks-repository\.js/);
  assert.match(registry, /forms-contracts\.js[\s\S]+forms-repository\.js[\s\S]+auth-workspace-api\.js/);
});


test("workspace query applies the exact transport signal to Supabase", async () => {
  let appliedSignal = null;
  const query = {
    select() { return this; },
    order() { return this; },
    abortSignal(signal) {
      appliedSignal = signal;
      return this;
    },
    then(resolve) {
      resolve({ data: [], error: null });
    }
  };
  const window = {};
  vm.runInContext(
    read("js/auth-workspace-api.js"),
    vm.createContext({ window, Date, JSON, Object, Array, Set, Map, String, Error, decodeURIComponent }),
    { filename: "auth-workspace-api.js" }
  );
  const api = window.BCCAuthWorkspaceApi.createWorkspaceApi({
    supabase: { from() { return query; } },
    publicWorkspaceEvent: value => value,
    columns: { events: "*" }
  });
  const controller = new AbortController();

  const result = await api.handle("/api/workspace/events", {
    method: "GET",
    signal: controller.signal
  });

  assert.equal(result.handled, true);
  assert.equal(result.value.events.length, 0);
  assert.equal(appliedSignal, controller.signal);
});
