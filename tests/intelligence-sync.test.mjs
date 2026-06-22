import test from "node:test";
import assert from "node:assert/strict";
import { runIntelligenceSync } from "../scripts/sync-intelligence.mjs";

test("sync dry-run completes without persisting papers or signals", async () => {
  const calls = {
    startRun: 0,
    completeRun: 0,
    failRun: 0,
    savePaper: 0,
    saveSignal: 0
  };

  const store = {
    async findSourceRecord(sourceType) {
      return { id: `source-${sourceType}`, type: sourceType };
    },
    async startRun(meta) {
      calls.startRun += 1;
      assert.equal(meta.dryRun, true);
      return { id: "run-1" };
    },
    async completeRun(runId, metrics) {
      calls.completeRun += 1;
      assert.equal(runId, "run-1");
      assert.equal(metrics.itemsFetched, 2);
    },
    async failRun() {
      calls.failRun += 1;
    },
    async savePaper() {
      calls.savePaper += 1;
      throw new Error("savePaper should not run during dry-run");
    },
    async saveSignal() {
      calls.saveSignal += 1;
      throw new Error("saveSignal should not run during dry-run");
    },
    async listSignalInputs() {
      return {
        topics: [
          {
            id: "topic-1",
            name: "MAP-Nano",
            category: "nano",
            keywords: ["SEM image analysis"],
            enabled: true
          }
        ],
        grants: [],
        patents: [],
        institutions: [],
        papers: []
      };
    }
  };

  const connector = {
    sourceType: "arxiv",
    async search() {
      return [
        {
          sourceName: "arXiv",
          sourceType: "arxiv",
          externalId: "abs-1",
          doi: "10.1000/example",
          title: "SEM image analysis workflow",
          abstract: "Manual segmentation challenge in microscopy.",
          keywords: ["SEM image analysis"],
          topics: ["MAP-Nano"],
          sourceUrl: "https://example.com/paper-1",
          openAccessUrl: "https://example.com/open-1",
          publicationDate: "2026-06-15",
          rawData: { source: 1 }
        },
        {
          sourceName: "arXiv",
          sourceType: "arxiv",
          externalId: "abs-2",
          doi: "https://doi.org/10.1000/example",
          title: "SEM image analysis workflow",
          abstract: "Manual segmentation challenge in microscopy with noisy images.",
          keywords: ["SEM image analysis"],
          topics: ["MAP-Nano"],
          sourceUrl: "https://example.com/paper-2",
          openAccessUrl: "https://example.com/open-2",
          publicationDate: "2026-06-16",
          rawData: { source: 2 }
        }
      ];
    }
  };

  const result = await runIntelligenceSync(
    {
      action: "sync_papers",
      dryRun: true,
      sourceTypes: ["arxiv"],
      keywords: ["SEM image analysis"],
      limit: 5
    },
    {
      store,
      connectors: [connector],
      logger: { log() {} }
    }
  );

  assert.equal(result.action, "sync_papers");
  assert.equal(result.dryRun, true);
  assert.equal(result.itemsFetched, 2);
  assert.equal(result.itemsDeduped, 1);
  assert.equal(calls.startRun, 1);
  assert.equal(calls.completeRun, 1);
  assert.equal(calls.failRun, 0);
  assert.equal(calls.savePaper, 0);
  assert.equal(calls.saveSignal, 0);
});
