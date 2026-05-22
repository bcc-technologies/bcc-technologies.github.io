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
    await waitForServer(`http://localhost:${port}/api/auth/me`);

    let res = await fetch(`http://localhost:${port}/api/auth/signup`, {
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

    res = await fetch(`http://localhost:${port}/api/auth/me`, { headers: { cookie } });
    const me = await res.json();
    assert.equal(me.user.email, "admin-test@example.com");

    res = await fetch(`http://localhost:${port}/api/admin/users`, { headers: { cookie } });
    const users = await res.json();
    assert.equal(res.status, 200);
    assert.equal(users.users.length, 1);

    res = await fetch(`http://localhost:${port}/api/admin/users/${users.users[0].id}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ role: "staff" })
    });
    const demotion = await res.json();
    assert.equal(res.status, 400);
    assert.match(demotion.error, /propio rol de administrador|administrador activo/);

    res = await fetch(`http://localhost:${port}/api/auth/profile`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ name: "Admin Updated", company: "BCC Lab", title: "Lead" })
    });
    const profile = await res.json();
    assert.equal(res.status, 200);
    assert.equal(profile.user.name, "Admin Updated");
    assert.equal(profile.user.displayName, "Admin");
    assert.equal(profile.user.company, "BCC Lab");
  } finally {
    child.kill();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test("local CMS requires admin or authorized staff account session", async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "bcc-auth-cms-"));
  const accountsPort = 3901;
  const cmsPort = 3902;
  const accounts = spawn(process.execPath, ["accounts-server.mjs"], {
    env: { ...process.env, BCC_ACCOUNTS_PORT: String(accountsPort), BCC_ACCOUNTS_DATA_DIR: dataDir },
    stdio: "ignore"
  });
  const cms = spawn(process.execPath, ["admin-local/server.mjs"], {
    env: {
      ...process.env,
      BCC_CMS_PORT: String(cmsPort),
      BCC_ACCOUNTS_DATA_DIR: dataDir,
      BCC_ACCOUNTS_LOGIN_URL: `http://localhost:${accountsPort}/login.html`
    },
    stdio: "ignore"
  });

  try {
    await waitForServer(`http://localhost:${accountsPort}/api/auth/me`);

    let res = await fetch(`http://localhost:${accountsPort}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "CMS Admin",
        email: "cms-admin@example.com",
        company: "BCC",
        title: "Admin",
        password: "Password123!"
      })
    });
    const cookie = res.headers.get("set-cookie");
    assert.equal(res.status, 201);

    res = await fetch(`http://localhost:${accountsPort}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "CMS Staff",
        email: "cms-staff@example.com",
        company: "BCC",
        title: "Staff",
        password: "Password123!"
      })
    });
    const staffCookie = res.headers.get("set-cookie");
    const staffSignup = await res.json();
    assert.equal(res.status, 201);

    res = await fetch(`http://localhost:${accountsPort}/api/admin/users/${staffSignup.user.id}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ role: "staff" })
    });
    assert.equal(res.status, 200);

    await waitForServer(`http://localhost:${cmsPort}/api/health`, 401);

    res = await fetch(`http://localhost:${cmsPort}/api/health`);
    assert.equal(res.status, 401);

    res = await fetch(`http://localhost:${cmsPort}/api/health`, { headers: { cookie } });
    const health = await res.json();
    assert.equal(res.status, 200);
    assert.equal(health.ok, true);

    res = await fetch(`http://localhost:${cmsPort}/api/health`, { headers: { cookie: staffCookie } });
    assert.equal(res.status, 403);

    res = await fetch(`http://localhost:${accountsPort}/api/admin/users/${staffSignup.user.id}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ role: "staff", staffRoles: ["author"], departments: ["marketing"] })
    });
    assert.equal(res.status, 200);
    const audit = JSON.parse(fs.readFileSync(path.join(dataDir, "access-audit.json"), "utf-8"));
    assert.equal(audit.length, 2);
    assert.equal(audit[1].targetEmail, "cms-staff@example.com");
    assert.deepEqual(audit[1].after.staffRoles, ["author"]);

    res = await fetch(`http://localhost:${accountsPort}/api/admin/access-audit`, { headers: { cookie } });
    const auditResponse = await res.json();
    assert.equal(res.status, 200);
    assert.equal(auditResponse.logs.length, 2);
    assert.equal(auditResponse.logs[0].targetEmail, "cms-staff@example.com");
    assert.deepEqual(auditResponse.logs[0].afterAccess.staffRoles, ["author"]);

    res = await fetch(`http://localhost:${accountsPort}/api/admin/access-audit`, { headers: { cookie: staffCookie } });
    assert.equal(res.status, 403);

    res = await fetch(`http://localhost:${cmsPort}/api/health`, { headers: { cookie: staffCookie } });
    assert.equal(res.status, 200);

    res = await fetch(`http://localhost:${cmsPort}/api/auth/me`, { headers: { cookie } });
    const cmsUser = await res.json();
    assert.equal(res.status, 200);
    assert.equal(cmsUser.user.displayName, "CMS");

    res = await fetch(`http://localhost:${accountsPort}/api/auth/me`, { headers: { cookie } });
    assert.equal(res.status, 200);

    res = await fetch(`http://localhost:${cmsPort}/api/auth/logout`, { method: "POST", headers: { cookie } });
    assert.equal(res.status, 200);

    res = await fetch(`http://localhost:${cmsPort}/api/health`, { headers: { cookie } });
    assert.equal(res.status, 401);
  } finally {
    accounts.kill();
    cms.kill();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

async function waitForServer(url, expectedStatus = null) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (expectedStatus === null || res.status === expectedStatus) return;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 120));
    }
  }
  throw new Error("accounts server did not start");
}
