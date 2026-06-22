import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { normalizePaperItem } from "../scripts/intelligence/connectors/base.mjs";
import { dedupeItems } from "../scripts/intelligence/dedupe.mjs";
import { generateStrategicSignals } from "../scripts/intelligence/signals.mjs";

test("normalizes paper payloads into the internal shape", () => {
  const paper = normalizePaperItem({
    sourceName: "OpenAlex",
    sourceType: "openalex",
    externalId: " W123 ",
    doi: "https://doi.org/10.1000/ABC-123 ",
    arxivId: "https://arxiv.org/abs/2401.12345 ",
    title: "  Manual segmentation challenge in SEM images  ",
    abstract: "   Materials characterization workflow with noisy images.   ",
    authors: ["doe, jane", "Jane Doe", "smith, john"],
    institutions: ["dept. of materials, univ. x", "Dept. of Materials, Univ. X", "Institute Y"],
    publicationDate: "2026-06",
    sourceUrl: "http://example.com/paper",
    journalOrVenue: "  Journal of Microscopy ",
    topics: [" MAP-Nano ", "MAP-Nano"],
    keywords: [" SEM image analysis ", "SEM image analysis", "noisy images"],
    citationsCount: "12",
    openAccessUrl: "https://example.com/open",
    rawData: { ok: true }
  });

  assert.equal(paper.kind, "paper");
  assert.equal(paper.doi, "10.1000/ABC-123");
  assert.equal(paper.arxivId, "2401.12345");
  assert.equal(paper.title, "Manual segmentation challenge in SEM images");
  assert.deepEqual(paper.authors, ["Jane Doe", "John Smith"]);
  assert.deepEqual(paper.institutions, ["Department of materials, University x", "Institute Y"]);
  assert.equal(paper.publicationDate, "2026-06-01");
  assert.equal(paper.sourceUrl, "https://example.com/paper");
  assert.deepEqual(paper.topics, ["MAP-Nano"]);
  assert.deepEqual(paper.keywords, ["SEM image analysis", "noisy images"]);
  assert.equal(paper.citationsCount, 12);
  assert.deepEqual(paper.rawData, { ok: true });
});

test("deduplicates papers by DOI", () => {
  const deduped = dedupeItems([
    {
      title: "SEM image analysis for nanoparticle sizing",
      doi: "10.1000/example",
      authors: ["Doe, Jane"],
      sourceType: "openalex",
      externalId: "oa-1"
    },
    {
      title: "SEM image analysis for nanoparticle sizing",
      doi: "https://doi.org/10.1000/example",
      authors: ["Smith, John"],
      sourceType: "crossref",
      externalId: "cr-1"
    }
  ]);

  assert.equal(deduped.length, 1);
  assert.equal(deduped[0].doi, "10.1000/example");
  assert.deepEqual(deduped[0].authors, ["Jane Doe", "John Smith"]);
});

test("deduplicates papers by arXiv ID", () => {
  const deduped = dedupeItems([
    {
      title: "Automated microscopy workflow",
      arxivId: "2401.12345",
      sourceType: "arxiv",
      externalId: "abs-1"
    },
    {
      title: "Automated microscopy workflow",
      arxivId: "arXiv:2401.12345",
      sourceType: "openalex",
      externalId: "oa-2"
    }
  ]);

  assert.equal(deduped.length, 1);
  assert.equal(deduped[0].arxivId, "2401.12345");
});

test("generates strategic signals with evidence when the topic has matching records", () => {
  const signals = generateStrategicSignals({
    topics: [
      {
        id: "topic-1",
        name: "MAP-Nano",
        category: "nano",
        keywords: ["SEM image analysis", "microstructure analysis"],
        enabled: true
      }
    ],
    papers: [
      {
        id: "paper-1",
        title: "Manual SEM image analysis bottleneck in microstructure inspection",
        abstract: "This manual workflow remains time-consuming and suffers from noisy images.",
        publicationDate: "2026-06-10",
        institutions: ["Lab A"],
        topics: ["MAP-Nano"],
        keywords: ["SEM image analysis", "microstructure analysis"],
        sourceUrl: "https://example.com/paper-1",
        openAccessUrl: "https://example.com/open-1"
      },
      {
        id: "paper-2",
        title: "Microstructure analysis for nanoparticle characterization",
        abstract: "Dataset and annotation protocol for SEM images.",
        publicationDate: "2026-06-11",
        institutions: ["Lab B"],
        topics: ["MAP-Nano"],
        keywords: ["SEM image analysis"],
        sourceUrl: "https://example.com/paper-2",
        openAccessUrl: "https://example.com/open-2"
      },
      {
        id: "paper-3",
        title: "Automated SEM segmentation for materials characterization",
        abstract: "Open benchmark for segmentation challenge in nanomaterials microscopy.",
        publicationDate: "2026-06-12",
        institutions: ["Lab C"],
        topics: ["MAP-Nano"],
        keywords: ["microstructure analysis"],
        sourceUrl: "https://example.com/paper-3",
        openAccessUrl: "https://example.com/open-3"
      }
    ],
    grants: [
      {
        id: "grant-1",
        title: "Funding SEM image analysis workflows",
        abstract: "Supports materials characterization automation.",
        agency: "NSF",
        program: "Microscopy",
        institutions: ["Lab A", "Lab C"],
        topics: ["MAP-Nano"],
        sourceUrl: "https://example.com/grant-1"
      }
    ],
    patents: [],
    institutions: [
      { id: "inst-1", name: "Lab A", website: "https://laba.example.com", sourceUrl: "" },
      { id: "inst-2", name: "Lab B", website: "https://labb.example.com", sourceUrl: "" },
      { id: "inst-3", name: "Lab C", website: "https://labc.example.com", sourceUrl: "" }
    ]
  });

  assert.ok(signals.length > 0);
  assert.ok(signals.every(signal => signal.evidenceCount > 0));
  assert.ok(signals.every(signal => Array.isArray(signal.evidenceRefs) && signal.evidenceRefs.length > 0));
  assert.ok(signals.every(signal => signal.scoreBreakdown && typeof signal.scoreBreakdown === "object"));
  assert.ok(signals.every(signal => signal.scoreBreakdown?.opportunity && signal.scoreBreakdown?.actionability));
  assert.ok(signals.some(signal => signal.signalType === "grant_opportunity"));
});

test("does not generate signals when there is no evidence", () => {
  const signals = generateStrategicSignals({
    topics: [
      {
        id: "topic-2",
        name: "MAP-Bio",
        category: "bio",
        keywords: ["cell counting"],
        enabled: true
      }
    ],
    papers: [],
    grants: [],
    patents: [],
    institutions: []
  });

  assert.deepEqual(signals, []);
});

test("OpenAlex connector uses api_key, mailto, and select fields for quota-aware requests", async () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.OPENALEX_API_KEY;
  const originalEmail = process.env.OPENALEX_EMAIL;
  const requests = [];

  process.env.OPENALEX_API_KEY = "test-openalex-key";
  process.env.OPENALEX_EMAIL = "lab@example.com";

  global.fetch = async (url) => {
    requests.push(String(url));
    return {
      ok: true,
      async json() {
        return { results: [] };
      }
    };
  };

  try {
    const moduleUrl = new URL(`${pathToFileURL(path.resolve(process.cwd(), "scripts/intelligence/connectors/openalex.mjs")).href}?test=${Date.now()}`);
    const { default: openalex } = await import(moduleUrl.href);

    assert.equal(openalex.requiresApiKey, true);
    await openalex.search({
      keywords: [
        "SEM image analysis",
        "grain boundary detection",
        "materials characterization",
        "microstructure analysis",
        "nanomaterials microscopy",
        "nanoparticle size distribution",
        "particle segmentation",
        "porosity analysis",
        "surface roughness microscopy",
        "TEM image analysis"
      ],
      limit: 7
    });

    assert.equal(requests.length, 1);
    const requestUrl = new URL(requests[0]);
    assert.equal(requestUrl.searchParams.get("api_key"), "test-openalex-key");
    assert.equal(requestUrl.searchParams.get("mailto"), "lab@example.com");
    assert.equal(requestUrl.searchParams.get("per-page"), "7");
    assert.match(requestUrl.searchParams.get("select") || "", /display_name/);
    assert.ok((requestUrl.searchParams.get("search") || "").length <= 180);
  } finally {
    global.fetch = originalFetch;
    process.env.OPENALEX_API_KEY = originalApiKey;
    process.env.OPENALEX_EMAIL = originalEmail;
  }
});
