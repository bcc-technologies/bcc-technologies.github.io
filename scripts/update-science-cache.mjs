import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "static", "data");

const GROUPS = [
  { id: "physics", query: "physics.*", color: "#2f7dd1" },
  { id: "math", query: "math.*", color: "#16a085" },
  { id: "cs", query: "cs.*", color: "#f39c12" },
  { id: "q-bio", query: "q-bio.*", color: "#e74c3c" },
  { id: "stat", query: "stat.*", color: "#7c5cfa" },
  { id: "q-fin", query: "q-fin.*", color: "#0ea5a6" },
  { id: "eess", query: "eess.*", color: "#64748b" },
  { id: "econ", query: "econ.*", color: "#10b981" }
];

const MAX_RESULTS_PER_GROUP = 300;

function decodeXml(str) {
  return String(str || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function getTag(block, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = block.match(re);
  return m ? decodeXml(m[1]) : "";
}

function getPrimaryCategory(block) {
  const m = block.match(/<arxiv:primary_category[^>]*term=\"([^\"]+)\"/i);
  return m ? decodeXml(m[1]) : "";
}

function parseArxiv(xml) {
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
  return entries.map((entry) => {
    const title = getTag(entry, "title");
    const summary = getTag(entry, "summary");
    const published = getTag(entry, "published");
    const updated = getTag(entry, "updated");
    const id = getTag(entry, "id");
    const primaryCategory = getPrimaryCategory(entry);

    const linkMatch = entry.match(/<link[^>]*rel=\"alternate\"[^>]*href=\"([^\"]+)\"/i);
    const link = linkMatch ? linkMatch[1] : id;

    const authors = Array.from(entry.matchAll(/<author>[\s\S]*?<name>(.*?)<\/name>[\s\S]*?<\/author>/gi))
      .map(m => decodeXml(m[1]));

    const categories = Array.from(entry.matchAll(/<category[^>]*term=\"([^\"]+)\"/gi))
      .map(m => decodeXml(m[1]));

    return {
      id,
      link,
      title,
      summary,
      published,
      updated,
      authors,
      categories,
      primaryCategory
    };
  });
}

function detectGroup(category) {
  const c = String(category || "").toLowerCase();
  if (!c) return "";

  if (c === "physics" || c.startsWith("physics.") || c.startsWith("astro-ph") || c.startsWith("cond-mat") || c.startsWith("gr-qc") || c.startsWith("hep-") || c.startsWith("math-ph") || c.startsWith("nlin") || c.startsWith("nucl-") || c.startsWith("quant-ph")) return "physics";
  if (c === "math" || c.startsWith("math.")) return "math";
  if (c === "cs" || c.startsWith("cs.")) return "cs";
  if (c === "q-bio" || c.startsWith("q-bio.")) return "q-bio";
  if (c === "stat" || c.startsWith("stat.")) return "stat";
  if (c === "q-fin" || c.startsWith("q-fin.")) return "q-fin";
  if (c === "eess" || c.startsWith("eess.")) return "eess";
  if (c === "econ" || c.startsWith("econ.")) return "econ";

  return "";
}

function monthKey(iso) {
  if (!iso) return "";
  return String(iso).slice(0, 7);
}

function buildMonthKeys(endDate, count) {
  const end = new Date(endDate || Date.now());
  end.setDate(1);
  const out = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(end);
    d.setMonth(end.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push(key);
  }
  return out;
}

async function writeJson(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf-8");
}

// arXiv API terms: max 1 request every 3 seconds, single connection.
const ARXIV_DELAY_MS = 3500;
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function warn(msg) {
  // Surfaces as an annotation in GitHub Actions without failing the job.
  console.log(`::warning::${msg}`);
}

async function fetchWithRetry(url, options = {}, { label = url, retries = 4, baseDelayMs = 5000, timeoutMs = 60000 } = {}) {
  for (let attempt = 0; ; attempt += 1) {
    let reason;
    let waitMs = baseDelayMs * 2 ** attempt;
    try {
      const res = await fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
      if (res.ok) return res;
      if (!RETRYABLE.has(res.status)) throw Object.assign(new Error(`${label} HTTP ${res.status}`), { fatal: true });
      reason = `HTTP ${res.status}`;
      const retryAfter = Number(res.headers.get("retry-after"));
      if (Number.isFinite(retryAfter) && retryAfter > 0) waitMs = Math.max(waitMs, retryAfter * 1000);
    } catch (err) {
      if (err.fatal) throw err;
      reason = err.message; // network error / timeout
    }
    if (attempt >= retries) throw new Error(`${label} ${reason} (after ${retries + 1} attempts)`);
    console.log(`${label}: ${reason}, retry ${attempt + 1}/${retries} in ${Math.round(waitMs / 1000)}s`);
    await sleep(waitMs);
  }
}

async function readJson(file) {
  try {
    return JSON.parse(await fs.readFile(file, "utf-8"));
  } catch {
    return null;
  }
}

async function fetchArxivGroup(group) {
  const query = `cat:${group.query}`;
  const url = `https://export.arxiv.org/api/query?search_query=${encodeURIComponent(query)}&start=0&max_results=${MAX_RESULTS_PER_GROUP}&sortBy=lastUpdatedDate&sortOrder=descending`;

  const res = await fetchWithRetry(url, {
    headers: {
      "User-Agent": "BCC-Science/1.0 (contact: info@bcctech.com)"
    }
  }, { label: `ArXiv ${group.id}`, baseDelayMs: 10000 });
  const xml = await res.text();
  return parseArxiv(xml).map((item) => ({ ...item, sourceGroup: group.id }));
}

async function fetchArxiv(previous) {
  // Sequential on purpose: parallel bursts trigger HTTP 429.
  const groupResults = [];
  let failed = 0;
  for (const [i, group] of GROUPS.entries()) {
    if (i > 0) await sleep(ARXIV_DELAY_MS);
    try {
      const items = await fetchArxivGroup(group);
      groupResults.push({ groupId: group.id, items });
    } catch (err) {
      failed += 1;
      const fallback = (previous?.items || []).filter((it) => (it.sourceGroup || it.group) === group.id);
      warn(`ArXiv group "${group.id}" failed (${err.message}); reusing ${fallback.length} cached items.`);
      groupResults.push({ groupId: group.id, items: fallback });
    }
  }
  if (failed === GROUPS.length) throw new Error("ArXiv: all groups failed");

  const merged = new Map();
  groupResults.forEach((res) => {
    res.items.forEach((item) => {
      if (!item.id) return;
      if (merged.has(item.id)) {
        const existing = merged.get(item.id);
        const categories = new Set([...(existing.categories || []), ...(item.categories || [])]);
        existing.categories = Array.from(categories);
        if (!existing.primaryCategory && item.primaryCategory) existing.primaryCategory = item.primaryCategory;
        merged.set(item.id, existing);
      } else {
        merged.set(item.id, item);
      }
    });
  });

  const items = Array.from(merged.values());
  items.forEach((item) => {
    const primary = item.primaryCategory || item.categories?.[0];
    const group = detectGroup(primary) || item.sourceGroup || "";
    item.group = group;
  });

  const months = buildMonthKeys(new Date(), 12);
  const series = {};
  GROUPS.forEach((group) => {
    series[group.id] = Object.fromEntries(months.map((m) => [m, 0]));
  });

  items.forEach((item) => {
    if (!item.group || !series[item.group]) return;
    const key = monthKey(item.updated || item.published);
    if (series[item.group][key] !== undefined) {
      series[item.group][key] += 1;
    }
  });

  return {
    updatedAt: new Date().toISOString(),
    groups: GROUPS.map((g) => ({ id: g.id, color: g.color })),
    months,
    series,
    items
  };
}

async function fetchApod() {
  const apiKey = process.env.NASA_API_KEY || "DEMO_KEY";
  if (apiKey === "DEMO_KEY") warn("NASA_API_KEY secret is empty; using DEMO_KEY (heavily rate-limited).");
  const url = `https://api.nasa.gov/planetary/apod?api_key=${apiKey}`;
  const res = await fetchWithRetry(url, {}, { label: "NASA APOD" });
  const item = await res.json();

  return {
    updatedAt: new Date().toISOString(),
    item
  };
}

async function main() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  const arxivFile = path.join(DATA_DIR, "arxiv.json");
  const apodFile = path.join(DATA_DIR, "nasa-apod.json");
  const previousArxiv = await readJson(arxivFile);

  // Each source is independent: one outage must not block the other.
  const [arxiv, apod] = await Promise.allSettled([
    fetchArxiv(previousArxiv),
    fetchApod()
  ]);

  if (arxiv.status === "fulfilled") {
    await writeJson(arxivFile, arxiv.value);
    console.log("ArXiv cache updated.");
  } else {
    warn(`ArXiv update skipped, keeping previous cache: ${arxiv.reason?.message || arxiv.reason}`);
  }

  if (apod.status === "fulfilled") {
    await writeJson(apodFile, apod.value);
    console.log("NASA APOD cache updated.");
  } else {
    warn(`NASA APOD update skipped, keeping previous cache: ${apod.reason?.message || apod.reason}`);
  }

  if (arxiv.status === "rejected" && apod.status === "rejected") {
    throw new Error("All science sources failed");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
