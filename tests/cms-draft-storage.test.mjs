import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

const helperPath = path.resolve(process.cwd(), "admin-local/public/cms-draft-storage.js");
const helperSource = await fs.readFile(helperPath, "utf8");

function loadHelper() {
  const sandbox = { console, globalThis: {} };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(helperSource, sandbox, { filename: helperPath });
  return sandbox.CmsDraftStorage || sandbox.globalThis.CmsDraftStorage;
}

const { buildCmsStorageKey, getCmsStorageNamespace } = loadHelper();

test("scopes editor drafts by authenticated user identity", () => {
  const alice = { id: "user-123", email: "alice@bcc.test" };
  const bob = { id: "user-456", email: "bob@bcc.test" };

  assert.equal(getCmsStorageNamespace(alice), "bccAdmin:user-123");
  assert.equal(getCmsStorageNamespace(bob), "bccAdmin:user-456");
  assert.equal(
    buildCmsStorageKey("bccAdmin.draft.", "draft-1", alice),
    "bccAdmin:user-123:bccAdmin.draft.draft-1"
  );
  assert.equal(
    buildCmsStorageKey("bccAdmin.draft.", "draft-1", bob),
    "bccAdmin:user-456:bccAdmin.draft.draft-1"
  );
  assert.equal(
    buildCmsStorageKey("bccAdmin.draft.", "draft-1", { email: "Alice Example@Site.com" }),
    "bccAdmin:alice-example-site-com:bccAdmin.draft.draft-1"
  );
});
