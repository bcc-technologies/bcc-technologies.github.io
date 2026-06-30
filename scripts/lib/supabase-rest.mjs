function cleanText(value, limit = 6000) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

export function redactSensitiveText(value, secrets = []) {
  let text = cleanText(value, 6000)
    .replace(/Bearer\s+[A-Za-z0-9._\-+/=]+/gi, "Bearer [redacted]")
    .replace(/apikey[:=]\s*[A-Za-z0-9._\-+/=]+/gi, "apikey=[redacted]")
    .replace(/token[:=]\s*[A-Za-z0-9._\-+/=]+/gi, "token=[redacted]");
  for (const secret of secrets.filter(Boolean)) {
    if (String(secret).length >= 6) text = text.split(String(secret)).join("[redacted]");
  }
  return text;
}

export function supabaseRestUrl(baseUrl, pathname, params = {}) {
  const url = new URL(`/rest/v1/${pathname}`, baseUrl);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && typeof value !== "undefined" && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  return url;
}

export async function supabaseRestFetch(baseUrl, serviceKey, pathname, {
  method = "GET",
  params = {},
  body,
  prefer,
  knownSecrets = [serviceKey]
} = {}) {
  const response = await fetch(supabaseRestUrl(baseUrl, pathname, params), {
    method,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Accept: "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });

  if (!response.ok) {
    const details = redactSensitiveText(await response.text(), knownSecrets);
    throw new Error(`Supabase ${method} ${pathname} failed with ${response.status}: ${details}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

export function createSupabaseRestClient({ baseUrl, serviceKey, knownSecrets = [serviceKey] }) {
  return {
    fetch(pathname, options = {}) {
      return supabaseRestFetch(baseUrl, serviceKey, pathname, { ...options, knownSecrets });
    }
  };
}
