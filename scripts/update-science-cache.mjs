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

async function fetchArxivGroup(group) {
  const query = `cat:${group.query}`;
  const url = `https://export.arxiv.org/api/query?search_query=${encodeURIComponent(query)}&start=0&max_results=${MAX_RESULTS_PER_GROUP}&sortBy=lastUpdatedDate&sortOrder=descending`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "BCC-Science/1.0 (contact: info@bcctech.com)"
    }
  });
  if (!res.ok) throw new Error(`ArXiv HTTP ${res.status}`);
  const xml = await res.text();
  return parseArxiv(xml).map((item) => ({ ...item, sourceGroup: group.id }));
}

async function fetchArxiv() {
  const groupResults = await Promise.all(GROUPS.map(async (group) => {
    const items = await fetchArxivGroup(group);
    return { groupId: group.id, items };
  }));

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
  const url = `https://api.nasa.gov/planetary/apod?api_key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`NASA APOD HTTP ${res.status}`);
  const item = await res.json();

  return {
    updatedAt: new Date().toISOString(),
    item
  };
}

async function main() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  const [arxiv, apod] = await Promise.all([
    fetchArxiv(),
    fetchApod()
  ]);

  await writeJson(path.join(DATA_DIR, "arxiv.json"), arxiv);
  await writeJson(path.join(DATA_DIR, "nasa-apod.json"), apod);

  console.log("Science cache updated.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
