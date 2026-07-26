import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../js/workspace/events.js", import.meta.url), "utf8");

class WorkspaceEvent extends Event {
  constructor(type, options = {}) {
    super(type);
    this.detail = options.detail;
  }
}

function loadEvents(target = new EventTarget()) {
  const window = {};
  vm.runInContext(source, vm.createContext({
    window,
    document: target,
    CustomEvent: WorkspaceEvent,
    Object,
    String,
    Boolean,
    Array,
    Error
  }));
  return window.BCCWorkspaceEvents;
}

test("workspace event contracts normalize emitted and subscribed payloads", () => {
  const target = new EventTarget();
  const events = loadEvents(target);
  const received = [];
  const unsubscribe = events.subscribe("tasksChanged", detail => received.push(detail), { target });

  const emitted = events.emit("tasksChanged", { tasks: "invalid", loaded: 1 }, { target });
  assert.deepEqual(Array.from(emitted.tasks), []);
  assert.equal(emitted.loaded, true);
  assert.equal(received.length, 1);
  assert.deepEqual(Array.from(received[0].tasks), []);

  unsubscribe();
  events.emit("tasksChanged", { tasks: [{ id: "task-1" }], loaded: true }, { target });
  assert.equal(received.length, 1);
});

test("workspace event contracts reject unknown event names", () => {
  const events = loadEvents();
  assert.throws(() => events.emit("unknownEvent"), /Contrato de evento desconocido/);
});
