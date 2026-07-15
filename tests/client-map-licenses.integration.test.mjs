import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("client dashboard exposes the MAP license self-service view", async () => {
  const [html, navigation, dashboard] = await Promise.all([
    read("dashboard.html"),
    read("js/workspace/navigation.js"),
    read("js/dashboard.js")
  ]);

  assert.match(html, /data-client-map-licenses/);
  assert.match(html, /js\/workspace\/client-map-licenses\.js/);
  assert.match(navigation, /href:\s*"#licencias"/);
  assert.match(dashboard, /BCCWorkspaceClientMapLicenses\?\.init\(user\)/);
});

test("client license module only uses scoped self-service RPCs", async () => {
  const source = await read("js/workspace/client-map-licenses.js");

  assert.match(source, /rpc\("get_my_license_dashboard"\)/);
  assert.match(source, /rpc\("assign_my_account_license"/);
  assert.match(source, /rpc\("release_my_license_assignment"/);
  assert.doesNotMatch(source, /\.from\("(?:platform_licenses|license_assignments|license_account_members)"\)/);
  assert.doesNotMatch(source, /service[_-]?role/i);
});

test("client license migration preserves least privilege", async () => {
  const sql = await read("supabase/migrations/20260715044124_client_license_self_service.sql");

  assert.match(sql, /enable row level security/i);
  assert.match(sql, /security definer/i);
  assert.match(sql, /current_user_id uuid := \(select auth\.uid\(\)\)/i);
  assert.match(sql, /member_role in \('owner', 'admin'\)/i);
  assert.match(sql, /revoke all on table[\s\S]*from anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.get_my_license_dashboard\(\) to authenticated, service_role/i);
  assert.match(sql, /Evaluation access is managed by BCC staff/i);
});
