import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");

test("CMS creates drafts by default and uses an explicit publish RPC", () => {
  const html = read("admin-local/public/index.html");
  const client = read("admin-local/public/admin.js");
  const migration = read("supabase/migrations/20260728051749_cms_explicit_publication_workflow.sql");

  assert.match(html, /id="postPublished"[^>]*hidden[^>]*disabled/);
  assert.doesNotMatch(html, /id="postPublished"[^>]*checked/);
  assert.match(html, /id="btnPublishPost"/);
  assert.match(client, /rpc\("publish_cms_post", \{ p_post_id: id \}\)/);
  assert.match(client, /setPostPublished\(false\)/);
  assert.match(migration, /new\.is_published := false/);
  assert.match(migration, /Use publish_cms_post to publish a CMS post/);
  assert.match(migration, /cms_post_publication_audit/);
  assert.match(migration, /revoke all on function public\.publish_cms_post\(text\) from public/);
});
