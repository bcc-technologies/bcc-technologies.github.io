import test from "node:test";
import assert from "node:assert/strict";
import { containsPhrase, lexicalMatchScore } from "../scripts/intelligence/matching.mjs";
import { generateStrategicSignals, measureTopicGrowth } from "../scripts/intelligence/signals.mjs";
import { buildPaperQueryPlans } from "../scripts/sync-intelligence.mjs";
import { paperRelevance } from "../scripts/intelligence/relevance.mjs";

const now = Date.parse("2026-09-07T12:00:00Z");
const topic = { name: "MAP-Nano", category: "nano", keywords: ["SEM image analysis"], enabled: true };
const paper = (id, age = 10) => ({ id, title: "SEM image analysis of microstructure",
  abstract: "A reproducible segmentation benchmark with manual annotation and a time-consuming workflow. ".repeat(2),
  publicationDate: new Date(now - age * 86400000).toISOString(), sourceUrl: `https://example.org/${id}`,
  openAccessUrl: `https://example.org/open/${id}`, institutions: ["Lab A"], topics: ["MAP-Nano"] });

test("short tokens do not match substrings and half a phrase cannot confer relevance", () => {
  assert.equal(containsPhrase("system semiconductor assembly", "TEM"), false);
  assert.equal(containsPhrase("SEM image analysis.", "sem image analysis"), true);
  assert.equal(lexicalMatchScore(["Cell injury and nanoparticle therapy"], ["cell counting", "nanoparticle size distribution"]), 0);
});

test("stored topic labels alone do not manufacture relevant evidence", () => {
  const unrelated = { ...paper("x"), title: "Drug discovery", abstract: "Cell growth inhibition", keywords: [] };
  assert.deepEqual(generateStrategicSignals({ now, topics: [topic], papers: [unrelated] }), []);
});

test("future papers, missing dates and absent history cannot establish growth", () => {
  const growth = measureTopicGrowth([paper("future", -10), paper("now"), { publicationDate: "" }], now);
  assert.equal(growth.recent, 1);
  assert.equal(growth.score, null);
  const context = { now, topics: [topic], papers: [paper("future", -10)] };
  assert.deepEqual(generateStrategicSignals(context), []);
});

test("growth compares equal windows and requires observations in both", () => {
  const previous = Array.from({ length: 3 }, (_, i) => paper(`old-${i}`, 60));
  const recent = Array.from({ length: 6 }, (_, i) => paper(`new-${i}`, 10));
  assert.equal(measureTopicGrowth([...previous, ...recent], now).score, 1);
  assert.equal(measureTopicGrowth([...previous, ...recent.slice(0, 3)], now).score, 0);
});

test("OA and no patents never claim datasets or competitive whitespace; source snapshots are retained", () => {
  const signals = generateStrategicSignals({ now, topics: [topic], papers: [paper("one"), paper("two")] });
  assert.ok(signals.length > 0);
  for (const signal of signals) {
    assert.equal(signal.scoreBreakdown.opportunity.competitiveWhiteSpace, null);
    assert.equal(signal.scoreBreakdown.opportunity.openDataAvailability, 0);
    assert.equal(signal.scoreBreakdown.methodology.version, "2.1");
    assert.ok(signal.evidenceRefs.every(ref => ref.excerpt && ref.publicationDate));
  }
  assert.ok(signals.every(signal => signal.signalType !== "research_trend" && signal.signalType !== "grant_opportunity"));
});

test("queries rotate over all enabled topics, including those beyond the former first eight", () => {
  const topics = Array.from({ length: 11 }, (_, i) => ({ id: String(i), name: `Topic ${i}`, keywords: [`keyword ${i}`] }));
  const seen = new Set();
  for (let day = 0; day < 11; day++) {
    const { plans } = buildPaperQueryPlans({ keywords: [], limit: 20 }, topics, { sourceType: "semantic_scholar" }, null, now + day * 86400000);
    plans.forEach(plan => seen.add(plan.label));
  }
  assert.equal(seen.size, 11);
});

test("scientific phrases cannot be assembled across fields or distant sentences", () => {
  assert.equal(lexicalMatchScore(["Scientific training", "image analysis"], ["scientific image analysis"]), 0);
  assert.equal(lexicalMatchScore(["Scientific training uses cameras to monitor athletes in motion and provide feedback after analysis of each image."], ["scientific image analysis"]), 0);
  assert.equal(lexicalMatchScore(["Analysis of scientific microscope image data"], ["scientific image analysis"]), 0.5);
});

test("a generic portfolio name cannot promote an unrelated general-intelligence claim", () => {
  const item = { ...paper("agi"), title: "General intelligence architecture", abstract: "A general platform for robotics." };
  const general = { name: "General", category: "general", keywords: ["laboratory automation"] };
  assert.equal(paperRelevance(item, general).score, 0);
});

test("CCK-8 alone is not image counting, while independent image counting is preserved", () => {
  const bio = { name: "MAP-Bio", category: "bio", keywords: ["cell counting"] };
  const assay = { title: "Cancer signaling mechanism", abstract: "Cell Counting Kit-8 was used to measure proliferation." };
  assert.equal(paperRelevance(assay, bio).score, 0);
  assert.ok(paperRelevance({ ...assay, abstract: assay.abstract + " We also benchmark image-based cell counting." }, bio).score > 0);
});

test("title-level microscopy and materials methods remain candidates with explicit provenance", () => {
  const microscopy = paperRelevance({ title: "Electron microscopy applications: scanning electron microscopy in industry" }, topic);
  assert.equal(microscopy.basis, "title-method-candidate");
  const ing = { name: "MAP-Ing", category: "ing", keywords: ["concrete microstructure"] };
  assert.equal(paperRelevance({ title: "Fractal analysis of cementitious materials" }, ing).basis, "title-method-candidate");
  assert.equal(paperRelevance({ title: "Fractal analysis of stock prices" }, ing).score, 0);
});

test("a time-stratified or truncated sample never produces a growth claim", () => {
  const papers = [...Array.from({ length: 6 }, (_, i) => paper(`recent-${i}`, 10)), ...Array.from({ length: 3 }, (_, i) => paper(`previous-${i}`, 60))];
  for (const coverage of [{ temporallyRepresentative: false }, { atLimit: ["papers"] }]) {
    const signals = generateStrategicSignals({ now, topics: [topic], papers, coverage });
    assert.ok(signals.length > 0);
    assert.ok(signals.every(signal => signal.signalType !== "research_trend"));
    assert.ok(signals.every(signal => signal.scoreBreakdown.methodology.growth.score === null));
  }
});
