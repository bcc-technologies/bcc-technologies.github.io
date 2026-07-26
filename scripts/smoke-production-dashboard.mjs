const baseUrl = String(process.env.BCC_SMOKE_BASE_URL || "https://bcctechnologies.com.do").replace(/\/$/, "");
const expectedAssets = [
  "/login.html",
  "/staff-dashboard.html",
  "/js/supabase-config.js",
  "/js/auth.js",
  "/js/workspace/navigation.js",
  "/js/workspace/router.js"
];

async function getText(path) {
  const response = await fetch(`${baseUrl}${path}`, { redirect: "follow" });
  if (!response.ok) throw new Error(`${path} respondió HTTP ${response.status}.`);
  return response.text();
}

const contents = new Map();
for (const asset of expectedAssets) contents.set(asset, await getText(asset));

for (const [asset, source] of contents) {
  if (/^(?:<<<<<<<|=======|>>>>>>>)/m.test(source)) throw new Error(`${asset} contiene marcadores de conflicto.`);
}

const dashboard = contents.get("/staff-dashboard.html");
const navigation = contents.get("/js/workspace/navigation.js");
const configSource = contents.get("/js/supabase-config.js");
if (!dashboard.includes('id="maps-licensing"') || !dashboard.includes("data-workspace-view")) {
  throw new Error("El dashboard publicado no contiene la vista canónica de licencias.");
}
if (!navigation.includes('"licencias-maps": "maps-licensing"') || !navigation.includes("#maps-licensing")) {
  throw new Error("La navegación publicada no contiene la ruta MAP ni su alias legado.");
}
if (!configSource.includes("window.BCCSupabaseErrors") || !configSource.includes("allowLocalAccountFallback")) {
  throw new Error("El proveedor Supabase publicado no contiene el contrato runtime esperado.");
}

const supabaseUrl = process.env.BCC_SUPABASE_URL;
const publishableKey = process.env.BCC_SUPABASE_PUBLISHABLE_KEY;
const email = process.env.BCC_SMOKE_EMAIL;
const password = process.env.BCC_SMOKE_PASSWORD;
const authConfigured = [supabaseUrl, publishableKey, email, password].every(Boolean);

if (authConfigured) {
  const loginResponse = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: publishableKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  const login = await loginResponse.json().catch(() => null);
  if (!loginResponse.ok || !login?.access_token) throw new Error(`Auth smoke falló con HTTP ${loginResponse.status}.`);

  const profileResponse = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/profiles?select=id,role&limit=1`, {
    headers: { apikey: publishableKey, Authorization: `Bearer ${login.access_token}` }
  });
  if (!profileResponse.ok) throw new Error(`Query smoke falló con HTTP ${profileResponse.status}.`);

  await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/logout`, {
    method: "POST",
    headers: { apikey: publishableKey, Authorization: `Bearer ${login.access_token}` }
  });
  console.log("Smoke de producción: assets, navegación, Auth y consulta correctos.");
} else {
  console.log("Smoke de producción: assets y navegación correctos; Auth/consulta omitidos porque no hay secretos configurados.");
}
