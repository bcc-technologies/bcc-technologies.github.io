const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 450;

export class HttpError extends Error {
  constructor(message, { status = 0, body = "", url = "" } = {}) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.body = body;
    this.url = url;
  }
}

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

export function createRateLimiter(minIntervalMs = 0) {
  let nextStartAt = 0;

  return async function limit() {
    const now = Date.now();
    const waitMs = Math.max(0, nextStartAt - now);
    if (waitMs > 0) await sleep(waitMs);
    nextStartAt = Date.now() + Math.max(0, Number(minIntervalMs) || 0);
  };
}

async function readErrorBody(response) {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

async function request(url, {
  method = "GET",
  headers = {},
  body,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  retries = DEFAULT_RETRIES,
  retryDelayMs = DEFAULT_RETRY_DELAY_MS
} = {}) {
  const maxAttempts = Math.max(0, Number(retries) || 0);

  for (let attempt = 0; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.max(1000, Number(timeoutMs) || DEFAULT_TIMEOUT_MS));

    try {
      const response = await fetch(url, {
        method,
        headers,
        body,
        signal: controller.signal
      });
      if (!response.ok) {
        const error = new HttpError(`HTTP ${response.status} for ${url}`, {
          status: response.status,
          body: await readErrorBody(response),
          url
        });
        if (attempt < maxAttempts && [408, 425, 429, 500, 502, 503, 504].includes(response.status)) {
          await sleep((Number(retryDelayMs) || DEFAULT_RETRY_DELAY_MS) * (attempt + 1));
          continue;
        }
        throw error;
      }
      return response;
    } catch (error) {
      if (error?.name === "AbortError") {
        if (attempt < maxAttempts) {
          await sleep((Number(retryDelayMs) || DEFAULT_RETRY_DELAY_MS) * (attempt + 1));
          continue;
        }
        throw new HttpError(`Request timed out for ${url}`, { url });
      }
      if (attempt < maxAttempts && !(error instanceof HttpError)) {
        await sleep((Number(retryDelayMs) || DEFAULT_RETRY_DELAY_MS) * (attempt + 1));
        continue;
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new HttpError(`Request failed for ${url}`, { url });
}

export async function requestJson(url, options = {}) {
  const response = await request(url, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.headers || {})
    }
  });
  return response.json();
}

export async function requestText(url, options = {}) {
  const response = await request(url, {
    ...options,
    headers: {
      Accept: "text/plain, application/xml, text/xml, application/atom+xml",
      ...(options.headers || {})
    }
  });
  return response.text();
}
