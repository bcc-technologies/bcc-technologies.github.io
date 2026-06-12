import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG_PATH = path.join(ROOT, "js", "supabase-config.js");
const TEMPLATE_ES = path.join(ROOT, "admin-local", "templates", "blog-post.es.html");
const TEMPLATE_EN = path.join(ROOT, "admin-local", "templates", "blog-post.en.html");
const BLOG_ES_DIR = path.join(ROOT, "blog");
const BLOG_EN_DIR = path.join(ROOT, "en", "blog");
const GENERATED_MARKER = "BCC-GENERATED: supabase-cms-post";
const SITE_ORIGIN = process.env.BCC_SITE_ORIGIN || "https://bcctechnologies.com.do";
const CMS_POST_COLUMNS = [
  "id",
  "title",
  "date",
  "section",
  "lang",
  "translation_id",
  "tags",
  "excerpt",
  "cover",
  "body_markdown",
  "is_published",
  "published_at",
  "updated_at"
].join(",");

function readSupabaseConfig() {
  const source = fs.readFileSync(CONFIG_PATH, "utf-8");
  const url = source.match(/url:\s*"([^"]+)"/)?.[1] || "";
  const anonKey = source.match(/anonKey:\s*"([^"]+)"/)?.[1] || "";
  if (!url || !anonKey) throw new Error("Missing Supabase url or anonKey in js/supabase-config.js");
  return { url, anonKey };
}

async function fetchPublishedPosts() {
  const { url, anonKey } = readSupabaseConfig();
  const endpoint = new URL(`${url}/rest/v1/cms_posts`);
  endpoint.searchParams.set("select", CMS_POST_COLUMNS);
  endpoint.searchParams.set("is_published", "eq.true");
  endpoint.searchParams.set("order", "date.desc.nullslast,published_at.desc.nullslast");

  const res = await fetch(endpoint, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      Accept: "application/json"
    }
  });

  if (!res.ok) {
    throw new Error(`Supabase returned HTTP ${res.status}: ${await res.text()}`);
  }

  const rows = await res.json();
  return Array.isArray(rows) ? rows : [];
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function stripMarkdown(value) {
  return String(value || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/[#>*_`-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function descriptionFor(post) {
  const raw = post.excerpt || stripMarkdown(post.body_markdown || "");
  return raw.slice(0, 180);
}

function countWords(value) {
  try {
    return (String(value || "").match(/\b[\p{L}\p{N}']+\b/gu) || []).length;
  } catch {
    return String(value || "").trim().split(/\s+/).filter(Boolean).length;
  }
}

function readTime(value, lang) {
  const minutes = Math.max(1, Math.round(countWords(value) / 220));
  return lang === "en" ? `${minutes} min read` : `${minutes} min`;
}

function formatDate(value, lang) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(lang === "en" ? "en" : "es", {
    year: "numeric",
    month: "short",
    day: "2-digit"
  }).toUpperCase();
}

function postPath(post) {
  return post.lang === "en" ? `/en/blog/${encodeURIComponent(post.id)}.html` : `/blog/${encodeURIComponent(post.id)}.html`;
}

function absoluteUrl(pathname) {
  return new URL(pathname, SITE_ORIGIN).toString();
}

function findTranslation(post, posts) {
  const translationId = String(post.translation_id || "").trim();
  return posts.find(candidate => {
    if (candidate.id === post.id || candidate.lang === post.lang) return false;
    return candidate.id === translationId || candidate.translation_id === post.id || (translationId && candidate.translation_id === translationId);
  }) || null;
}

function mdInline(value) {
  let output = escapeHtml(value);
  output = output.replace(/!\[([^\]]*)]\(([^)]+)\)/g, (_match, alt, url) => {
    const cleanUrl = String(url || "").trim().replace(/^<|>$/g, "");
    const cleanAlt = String(alt || "").trim();
    return `<figure class="md-figure"><img src="${escapeAttr(cleanUrl)}" alt="${escapeAttr(cleanAlt)}" loading="lazy" />${cleanAlt ? `<figcaption>${escapeHtml(cleanAlt)}</figcaption>` : ""}</figure>`;
  });
  output = output.replace(/\[([^\]]+)]\(([^)]+)\)/g, (_match, text, url) => {
    const cleanUrl = String(url || "").trim().replace(/^<|>$/g, "");
    return `<a href="${escapeAttr(cleanUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`;
  });
  output = output.replace(/`([^`]+)`/g, (_match, code) => `<code>${escapeHtml(code)}</code>`);
  output = output.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  output = output.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return output;
}

function markdownToHtml(markdown) {
  const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
  let html = "";
  let inCode = false;
  let code = [];
  let inUl = false;
  let inOl = false;

  const closeLists = () => {
    if (inUl) {
      html += "</ul>";
      inUl = false;
    }
    if (inOl) {
      html += "</ol>";
      inOl = false;
    }
  };

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      if (!inCode) {
        closeLists();
        inCode = true;
        code = [];
      } else {
        inCode = false;
        html += `<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`;
      }
      continue;
    }

    if (inCode) {
      code.push(line);
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      closeLists();
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      closeLists();
      const level = heading[1].length;
      html += `<h${level}>${mdInline(heading[2])}</h${level}>`;
      continue;
    }

    if (trimmed.startsWith(">")) {
      closeLists();
      html += `<blockquote>${mdInline(trimmed.replace(/^>\s?/, ""))}</blockquote>`;
      continue;
    }

    const unordered = trimmed.match(/^[-*+]\s+(.*)$/);
    if (unordered) {
      if (!inUl) {
        closeLists();
        html += "<ul>";
        inUl = true;
      }
      html += `<li>${mdInline(unordered[1])}</li>`;
      continue;
    }

    const ordered = trimmed.match(/^\d+\.\s+(.*)$/);
    if (ordered) {
      if (!inOl) {
        closeLists();
        html += "<ol>";
        inOl = true;
      }
      html += `<li>${mdInline(ordered[1])}</li>`;
      continue;
    }

    closeLists();
    html += `<p>${mdInline(trimmed)}</p>`;
  }

  if (inCode) html += `<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`;
  closeLists();
  return html || "<p></p>";
}

function tagsBlock(post, lang) {
  const tags = Array.isArray(post.tags) ? post.tags.filter(Boolean) : [];
  if (!tags.length && !post.section) return "";
  const items = [...new Set([post.section, ...tags].filter(Boolean))];
  const title = lang === "en" ? "Topics" : "Temas";
  return `<section class="post-tags"><h2>${title}</h2><div class="tagrow">${items.map(tag => `<span class="tagchip">${escapeHtml(tag)}</span>`).join("")}</div></section>`;
}

function coverHtml(post) {
  if (!post.cover) return "";
  return `<figure class="post-cover"><img src="${escapeAttr(post.cover)}" alt="${escapeAttr(post.title)}" loading="lazy" /></figure>`;
}

function renderPost(post, posts) {
  const lang = post.lang === "en" ? "en" : "es";
  const template = fs.readFileSync(lang === "en" ? TEMPLATE_EN : TEMPLATE_ES, "utf-8");
  const translation = findTranslation(post, posts);
  const canonicalPath = postPath(post);
  const translationPath = translation ? postPath(translation) : "";
  const description = descriptionFor(post);
  const date = post.date || post.published_at || post.updated_at || "";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description,
    datePublished: date ? new Date(date).toISOString() : undefined,
    mainEntityOfPage: absoluteUrl(canonicalPath),
    author: [{ "@type": "Organization", name: "BCC Technologies" }]
  };

  const replacements = {
    TITLE: `${post.title} | BCC Blog`,
    DESCRIPTION: description,
    LANG_TARGETS: translation ? "es,en" : lang,
    GEN_MARKER: GENERATED_MARKER,
    CANONICAL: absoluteUrl(canonicalPath),
    HREFLANG_ES: lang === "es"
      ? `<link rel="alternate" hreflang="es" href="${absoluteUrl(canonicalPath)}">`
      : (translation ? `<link rel="alternate" hreflang="es" href="${absoluteUrl(translationPath)}">` : ""),
    HREFLANG_EN: lang === "en"
      ? `<link rel="alternate" hreflang="en" href="${absoluteUrl(canonicalPath)}">`
      : (translation ? `<link rel="alternate" hreflang="en" href="${absoluteUrl(translationPath)}">` : ""),
    OG_TITLE: post.title,
    OG_DESC: description,
    OG_URL: absoluteUrl(canonicalPath),
    OG_IMAGE_META: post.cover ? `<meta property="og:image" content="${escapeAttr(post.cover)}" />` : "",
    ARTICLE_META: date ? `<meta property="article:published_time" content="${new Date(date).toISOString()}" />` : "",
    JSON_LD: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
    LANG_SWITCH_HREF: translation ? translationPath : (lang === "en" ? "/blog.html" : "/en/blog.html"),
    POST_HERO_TITLE: escapeHtml(post.title),
    POST_DEK: description ? `<p class="post-dek">${escapeHtml(description)}</p>` : "",
    POST_DATE: formatDate(date, lang),
    POST_READTIME: readTime(post.body_markdown, lang),
    POST_COVER: coverHtml(post),
    POST_BODY: markdownToHtml(post.body_markdown),
    POST_AUTHORS: "",
    POST_TAGS_BLOCK: tagsBlock(post, lang),
    POST_RECOMMENDED_POSTS: "",
    POST_RESOURCES_JSON: "[]"
  };

  return template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_match, key) => replacements[key] ?? "");
}

function removeStaleGeneratedFiles(dir, nextIds) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".html")) continue;
    const fullPath = path.join(dir, entry.name);
    const content = fs.readFileSync(fullPath, "utf-8");
    if (!content.includes(GENERATED_MARKER)) continue;
    const id = entry.name.replace(/\.html$/, "");
    if (!nextIds.has(id)) fs.unlinkSync(fullPath);
  }
}

function writePost(post, posts) {
  const dir = post.lang === "en" ? BLOG_EN_DIR : BLOG_ES_DIR;
  fs.mkdirSync(dir, { recursive: true });
  const outputPath = path.join(dir, `${post.id}.html`);
  fs.writeFileSync(outputPath, renderPost(post, posts), "utf-8");
  return path.relative(ROOT, outputPath);
}

function listHtmlFiles(dir, publicPrefix) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith(".html"))
    .map(entry => {
      const fullPath = path.join(dir, entry.name);
      return {
        loc: absoluteUrl(`${publicPrefix}/${encodeURIComponent(entry.name)}`),
        lastmod: fs.statSync(fullPath).mtime.toISOString().slice(0, 10)
      };
    });
}

function writeSitemap() {
  const urls = [
    { loc: absoluteUrl("/blog.html"), lastmod: new Date().toISOString().slice(0, 10) },
    { loc: absoluteUrl("/en/blog.html"), lastmod: new Date().toISOString().slice(0, 10) },
    ...listHtmlFiles(BLOG_ES_DIR, "/blog"),
    ...listHtmlFiles(BLOG_EN_DIR, "/en/blog")
  ];
  const seen = new Set();
  const entries = urls
    .filter(item => {
      if (seen.has(item.loc)) return false;
      seen.add(item.loc);
      return true;
    })
    .map(item => `  <url>\n    <loc>${escapeHtml(item.loc)}</loc>\n    <lastmod>${item.lastmod}</lastmod>\n  </url>`)
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
  fs.writeFileSync(path.join(ROOT, "sitemap.xml"), xml, "utf-8");
}

async function main() {
  const posts = await fetchPublishedPosts();
  const esIds = new Set(posts.filter(post => post.lang !== "en").map(post => post.id));
  const enIds = new Set(posts.filter(post => post.lang === "en").map(post => post.id));

  removeStaleGeneratedFiles(BLOG_ES_DIR, esIds);
  removeStaleGeneratedFiles(BLOG_EN_DIR, enIds);

  const written = posts.map(post => writePost(post, posts));
  writeSitemap();
  console.log(`Generated ${written.length} Supabase blog page(s).`);
  written.forEach(file => console.log(`- ${file}`));
  console.log("- sitemap.xml");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
