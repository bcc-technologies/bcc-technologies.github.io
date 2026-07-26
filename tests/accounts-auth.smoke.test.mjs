import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

test("accounts server registers first admin and protects admin API", async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "bcc-auth-"));
  const port = 3899;
  const child = spawn(process.execPath, ["accounts-server.mjs"], {
    env: { ...process.env, BCC_ACCOUNTS_PORT: String(port), BCC_ACCOUNTS_DATA_DIR: dataDir },
    stdio: "ignore"
  });

  try {
    await waitForServer(`http://127.0.0.1:${port}/api/auth/me`);

    let res = await fetch(`http://127.0.0.1:${port}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Admin Test",
        email: "admin-test@example.com",
        company: "BCC",
        title: "Admin",
        password: "Password123!"
      })
    });
    const cookie = res.headers.get("set-cookie");
    const signup = await res.json();

    assert.equal(res.status, 201);
    assert.equal(signup.user.role, "admin");
    assert.equal(signup.user.displayName, "Admin");
    assert.equal(signup.user.nameParts.firstName, "Admin");
    assert.equal(signup.user.nameParts.firstLastName, "Test");
    assert.match(cookie || "", /bcc_session=/);

    res = await fetch(`http://127.0.0.1:${port}/api/auth/me`, { headers: { cookie } });
    const me = await res.json();
    assert.equal(me.user.email, "admin-test@example.com");
    assert.equal(me.user.emails.length, 1);
    assert.equal(me.user.emails[0].primary, true);
    assert.equal(me.user.emails[0].confirmed, true);

    res = await fetch(`http://127.0.0.1:${port}/api/account/emails`, { headers: { cookie } });
    let emailList = await res.json();
    assert.equal(res.status, 200);
    assert.equal(emailList.emails.length, 1);

    res = await fetch(`http://127.0.0.1:${port}/api/account/emails`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ email: "admin-alt@example.com" })
    });
    const addedEmail = await res.json();
    assert.equal(res.status, 201);
    assert.equal(addedEmail.email.confirmed, false);
    assert.equal(Object.hasOwn(addedEmail, "confirmationToken"), false);
    const storedUser = JSON.parse(fs.readFileSync(path.join(dataDir, "users.json"), "utf-8"))
      .find(user => user.email === "admin-test@example.com");
    const confirmationToken = storedUser.emails.find(item => item.email === "admin-alt@example.com").confirmationToken;
    assert.match(confirmationToken, /.+/);

    res = await fetch(`http://127.0.0.1:${port}/api/account/emails/${addedEmail.email.id}/primary`, {
      method: "PATCH",
      headers: { cookie }
    });
    assert.equal(res.status, 400);

    res = await fetch(`http://127.0.0.1:${port}/api/account/emails/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ email: "admin-alt@example.com", token: confirmationToken })
    });
    emailList = await res.json();
    assert.equal(res.status, 200);
    assert.equal(emailList.emails.find(item => item.email === "admin-alt@example.com").confirmed, true);

    res = await fetch(`http://127.0.0.1:${port}/api/account/emails/${addedEmail.email.id}/primary`, {
      method: "PATCH",
      headers: { cookie }
    });
    const primaryEmail = await res.json();
    assert.equal(res.status, 200);
    assert.equal(primaryEmail.user.email, "admin-alt@example.com");
    assert.equal(primaryEmail.emails.find(item => item.email === "admin-alt@example.com").primary, true);

    const oldEmailId = primaryEmail.emails.find(item => item.email === "admin-test@example.com").id;
    res = await fetch(`http://127.0.0.1:${port}/api/account/emails/${oldEmailId}`, {
      method: "DELETE",
      headers: { cookie }
    });
    emailList = await res.json();
    assert.equal(res.status, 200);
    assert.equal(emailList.emails.some(item => item.email === "admin-test@example.com"), false);

    res = await fetch(`http://127.0.0.1:${port}/api/account/emails/${addedEmail.email.id}`, {
      method: "DELETE",
      headers: { cookie }
    });
    assert.equal(res.status, 400);

    res = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin-alt@example.com", password: "Password123!" })
    });
    const login = await res.json();
    assert.equal(res.status, 200);
    assert.equal(login.user.email, "admin-alt@example.com");

    res = await fetch(`http://127.0.0.1:${port}/api/admin/users`, { headers: { cookie } });
    const users = await res.json();
    assert.equal(res.status, 200);
    assert.equal(users.users.length, 1);

    res = await fetch(`http://127.0.0.1:${port}/api/admin/users/${users.users[0].id}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ role: "staff" })
    });
    const demotion = await res.json();
    assert.equal(res.status, 400);
    assert.match(demotion.error, /propio rol de administrador|administrador activo/);

    res = await fetch(`http://127.0.0.1:${port}/api/auth/profile`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ name: "Admin Updated", company: "BCC Lab", title: "Lead" })
    });
    const profile = await res.json();
    assert.equal(res.status, 200);
    assert.equal(profile.user.name, "Admin Updated");
    assert.equal(profile.user.displayName, "Admin");
    assert.equal(profile.user.company, "BCC Lab");

    res = await fetch(`http://127.0.0.1:${port}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "MAPs Developer",
        email: "maps-developer@example.com",
        company: "BCC",
        title: "Engineer",
        password: "Password123!"
      })
    });
    const mapsDeveloperCookie = res.headers.get("set-cookie");
    const mapsDeveloperSignup = await res.json();
    assert.equal(res.status, 201);

    res = await fetch(`http://127.0.0.1:${port}/api/admin/users/${mapsDeveloperSignup.user.id}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ role: "staff", staffRoles: ["maps_developer"] })
    });
    assert.equal(res.status, 200);

    res = await fetch(`http://127.0.0.1:${port}/api/auth/me`, { headers: { cookie: mapsDeveloperCookie } });
    const mapsDeveloper = await res.json();
    assert.equal(res.status, 200);
    assert.equal(mapsDeveloper.user.permissions.includes("maps:developer:access"), true);
    assert.equal(mapsDeveloper.user.permissions.includes("maps:developer:write"), true);
    assert.equal(mapsDeveloper.user.permissions.includes("maps:developer:release"), false);

    res = await fetch(`http://127.0.0.1:${port}/api/admin/users/${mapsDeveloperSignup.user.id}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ role: "staff", staffRoles: ["maps_developer", "maps_release_manager"] })
    });
    assert.equal(res.status, 200);

    res = await fetch(`http://127.0.0.1:${port}/api/auth/me`, { headers: { cookie: mapsDeveloperCookie } });
    const mapsReleaseManager = await res.json();
    assert.equal(mapsReleaseManager.user.permissions.includes("maps:developer:release"), true);
  } finally {
    child.kill();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test("local CMS stays loopback-only and exposes its explicit local developer session", async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "bcc-auth-cms-"));
  const cmsPort = 3902;
  const cms = spawn(process.execPath, ["admin-local/server.mjs"], {
    env: { ...process.env, BCC_CMS_PORT: String(cmsPort), BCC_CMS_HOST: "127.0.0.1", BCC_ACCOUNTS_DATA_DIR: dataDir },
    stdio: "ignore"
  });

  try {
    const baseUrl = "http://127.0.0.1:" + cmsPort;
    await waitForServer(baseUrl + "/api/health", 200);
    let res = await fetch(baseUrl + "/api/health");
    assert.equal(res.status, 200);

    res = await fetch(baseUrl + "/api/auth/me");
    const session = await res.json();
    assert.equal(res.status, 200);
    assert.equal(session.user.role, "admin");
    assert.equal(session.user.email, "dev" + String.fromCharCode(64) + "localhost");
  } finally {
    cms.kill();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

async function waitForServer(url, expectedStatus = null) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (expectedStatus === null || res.status === expectedStatus) return;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 120));
    }
  }
  throw new Error("server did not reach the expected status: " + url);
}
