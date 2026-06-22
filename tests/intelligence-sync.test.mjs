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
    async listEnabledTopics() {
      return [
        {
          id: "topic-1",
          name: "MAP-Nano",
          category: "nano",
          keywords: ["SEM image analysis"],
          enabled: true
        }
      ];
    },
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

test("sync persists detected topic names onto papers before saving", async () => {
  const savedTopics = [];
  const store = {
    async listEnabledTopics() {
      return [
        {
          id: "topic-1",
          name: "MAP-Nano",
          category: "nano",
          keywords: ["SEM image analysis", "microstructure analysis"],
          enabled: true
        }
      ];
    },
    async ensureSourceRecord(connector) {
      return { id: `source-${connector.sourceType}`, type: connector.sourceType };
    },
    async startRun() {
      return { id: "run-2" };
    },
    async completeRun() {},
    async failRun() {},
    async savePaper(item) {
      savedTopics.push(item.topics);
      return { action: "created", record: { id: "paper-1" } };
    },
    async touchSourceSync() {},
    async listSignalInputs() {
      return {
        topics: await this.listEnabledTopics(),
        grants: [],
        patents: [],
        institutions: [],
        papers: []
      };
    },
    async saveSignal() {
      return { action: "created", record: { id: "signal-1" } };
    }
  };

  const connector = {
    sourceType: "arxiv",
    async search() {
      return [
        {
          sourceName: "arXiv",
          sourceType: "arxiv",
          externalId: "abs-topic-1",
          title: "Manual SEM image analysis workflow for microstructure inspection",
          abstract: "This microscopy pipeline remains time-consuming for materials teams.",
          keywords: ["segmentation challenge"],
          topics: [],
          sourceUrl: "https://example.com/paper-topic-1",
          publicationDate: "2026-06-18",
          rawData: { source: "arxiv" }
        }
      ];
    }
  };

  const result = await runIntelligenceSync(
    {
      action: "fetch_papers",
      dryRun: false,
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

  assert.equal(result.itemsFetched, 1);
  assert.equal(savedTopics.length, 1);
  assert.deepEqual(savedTopics[0], ["MAP-Nano"]);
});

test("sync diagnostics repair existing papers with missing topic names", async () => {
  const savedPapers = [];
  const store = {
    async listEnabledTopics() {
      return [
        {
          id: "topic-1",
          name: "MAP-Nano",
          category: "nano",
          keywords: ["SEM image analysis"],
          enabled: true
        }
      ];
    },
    async ensureSourceRecord(connector) {
      return { id: `source-${connector.sourceType}`, type: connector.sourceType };
    },
    async startRun() {
      return { id: "run-3" };
    },
    async completeRun() {},
    async failRun() {},
    async savePaper(item) {
      savedPapers.push({
        title: item.title,
        topics: item.topics
      });
      return { action: savedPapers.length === 1 ? "created" : "updated", record: { id: `paper-${savedPapers.length}` } };
    },
    async touchSourceSync() {},
    async listPapersForTopicDiagnostics() {
      return [
        {
          id: "existing-1",
          sourceId: "source-arxiv",
          externalId: "existing-abs-1",
          doi: "",
          arxivId: "",
          title: "SEM image analysis benchmark for particle segmentation",
          abstract: "Historical paper already in DB but missing explicit topic names.",
          authors: [],
          institutions: [],
          publicationDate: "2026-04-01",
          sourceName: "arXiv",
          sourceUrl: "https://example.com/existing-paper",
          journalOrVenue: "",
          topics: [],
          keywords: ["particle segmentation"],
          citationsCount: 0,
          openAccessUrl: "",
          rawData: {}
        }
      ];
    },
    async listSignalInputs() {
      return {
        topics: await this.listEnabledTopics(),
        grants: [],
        patents: [],
        institutions: [],
        papers: []
      };
    },
    async saveSignal() {
      return { action: "created", record: { id: "signal-3" } };
    }
  };

  const connector = {
    sourceType: "arxiv",
    async search() {
      return [
        {
          sourceName: "arXiv",
          sourceType: "arxiv",
          externalId: "new-abs-1",
          title: "SEM image analysis workflow",
          abstract: "Fresh paper from connector.",
          keywords: ["SEM image analysis"],
          topics: [],
          sourceUrl: "https://example.com/new-paper",
          publicationDate: "2026-06-18",
          rawData: {}
        }
      ];
    }
  };

  const result = await runIntelligenceSync(
    {
      action: "fetch_papers",
      dryRun: false,
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

  assert.equal(result.diagnostics.repaired, 1);
  assert.equal(result.itemsUpdated, 1);
  assert.deepEqual(savedPapers[1].topics, ["MAP-Nano"]);
});

test("fetch_grants persists normalized grants and updates run metrics", async () => {
  const savedGrants = [];
  const store = {
    async listEnabledTopics() {
      return [
        {
          id: "topic-2",
          name: "MAP-Bio",
          category: "bio",
          keywords: ["cell counting", "biological image analysis"],
          enabled: true
        }
      ];
    },
    async ensureSourceRecord(connector) {
      return { id: `source-${connector.sourceType}`, type: connector.sourceType };
    },
    async listEnabledSources() {
      return [{ id: "source-nih", type: "nih_reporter", enabled: true }];
    },
    async startRun(meta) {
      assert.equal(meta.actionType, "fetch_grants");
      return { id: "run-grants-1" };
    },
    async completeRun(runId, metrics) {
      assert.equal(runId, "run-grants-1");
      assert.equal(metrics.itemsFetched, 1);
      assert.equal(metrics.itemsCreated, 1);
      assert.equal(metrics.itemsUpdated, 0);
    },
    async failRun() {
      throw new Error("failRun should not execute in successful fetch_grants test");
    },
    async saveGrant(item) {
      savedGrants.push(item);
      return { action: "created", record: { id: "grant-1" } };
    },
    async touchSourceSync() {}
  };

  const connector = {
    sourceType: "nih_reporter",
    async search() {
      return [
        {
          kind: "grant",
          sourceName: "NIH RePORTER",
          sourceType: "nih_reporter",
          externalId: "11364092",
          title: "Automated image analysis for biomedical microscopy",
          abstract: "Cell counting workflow for biological image analysis.",
          agency: "NIBIB",
          program: "Research Projects",
          amount: 692085,
          currency: "USD",
          startDate: "2025-07-01",
          endDate: "2029-03-31",
          principalInvestigators: ["Georges El Fakhri"],
          institutions: ["YALE UNIVERSITY"],
          country: "UNITED STATES",
          sourceUrl: "https://reporter.nih.gov/project-details/11364092",
          topics: [],
          rawData: {}
        }
      ];
    }
  };

  const result = await runIntelligenceSync(
    {
      action: "fetch_grants",
      dryRun: false,
      sourceTypes: ["nih_reporter"],
      keywords: ["cell counting"],
      limit: 5
    },
    {
      store,
      connectors: [connector],
      logger: { log() {} }
    }
  );

  assert.equal(result.action, "fetch_grants");
  assert.equal(result.itemsFetched, 1);
  assert.equal(result.itemsCreated, 1);
  assert.equal(savedGrants.length, 1);
  assert.deepEqual(savedGrants[0].topics, ["MAP-Bio"]);
});

test("fetch_grants also persists NSF grants through the grant pipeline", async () => {
  const savedGrants = [];
  const store = {
    async listEnabledTopics() {
      return [
        {
          id: "topic-3",
          name: "MAP-Bio",
          category: "bio",
          keywords: ["cell counting", "microscopy reproducibility"],
          enabled: true
        }
      ];
    },
    async ensureSourceRecord(connector) {
      return { id: `source-${connector.sourceType}`, type: connector.sourceType };
    },
    async listEnabledSources() {
      return [{ id: "source-nsf", type: "nsf", enabled: true }];
    },
    async startRun() {
      return { id: "run-grants-2" };
    },
    async completeRun(runId, metrics) {
      assert.equal(runId, "run-grants-2");
      assert.equal(metrics.itemsFetched, 1);
      assert.equal(metrics.itemsCreated, 1);
      assert.equal(metrics.itemsUpdated, 0);
    },
    async failRun() {
      throw new Error("failRun should not execute in successful NSF fetch_grants test");
    },
    async saveGrant(item) {
      savedGrants.push(item);
      return { action: "created", record: { id: "grant-nsf-1" } };
    },
    async touchSourceSync() {}
  };

  const connector = {
    sourceType: "nsf",
    async search() {
      return [
        {
          kind: "grant",
          sourceName: "NSF Awards",
          sourceType: "nsf",
          externalId: "2622634",
          title: "Automated microscopy benchmarks for cell counting",
          abstract: "Biological image analysis workflow for microscopy reproducibility.",
          agency: "NSF",
          program: "Cross-BIO Activities",
          amount: 195526,
          currency: "USD",
          startDate: "2026-06-17",
          endDate: "2027-08-31",
          principalInvestigators: ["Joseph Walder"],
          institutions: ["University of Minnesota-Twin Cities"],
          country: "US",
          sourceUrl: "https://www.nsf.gov/awardsearch/showAward?AWD_ID=2622634",
          topics: [],
          rawData: {}
        }
      ];
    }
  };

  const result = await runIntelligenceSync(
    {
      action: "fetch_grants",
      dryRun: false,
      sourceTypes: ["nsf"],
      keywords: ["cell counting"],
      limit: 5
    },
    {
      store,
      connectors: [connector],
      logger: { log() {} }
    }
  );

  assert.equal(result.action, "fetch_grants");
  assert.equal(result.itemsFetched, 1);
  assert.equal(result.itemsCreated, 1);
  assert.equal(savedGrants.length, 1);
  assert.deepEqual(savedGrants[0].topics, ["MAP-Bio"]);
});

test("fetch_patents persists patents through the patent pipeline", async () => {
  const savedPatents = [];
  const store = {
    async listEnabledTopics() {
      return [
        {
          id: "topic-4",
          name: "MAP-Med",
          category: "med",
          keywords: ["diagnostic image analysis", "microscopy"],
          enabled: true
        }
      ];
    },
    async ensureSourceRecord(connector) {
      return { id: `source-${connector.sourceType}`, type: connector.sourceType };
    },
    async listEnabledSources() {
      return [{ id: "source-epo", type: "epo_ops", enabled: true }];
    },
    async startRun(meta) {
      assert.equal(meta.actionType, "fetch_patents");
      return { id: "run-patents-1" };
    },
    async completeRun(runId, metrics) {
      assert.equal(runId, "run-patents-1");
      assert.equal(metrics.itemsFetched, 1);
      assert.equal(metrics.itemsCreated, 1);
      assert.equal(metrics.itemsUpdated, 0);
    },
    async failRun() {
      throw new Error("failRun should not execute in successful fetch_patents test");
    },
    async savePatent(item) {
      savedPatents.push(item);
      return { action: "created", record: { id: "patent-1" } };
    },
    async touchSourceSync() {}
  };

  const connector = {
    sourceType: "epo_ops",
    async search() {
      return [
        {
          kind: "patent",
          sourceName: "EPO OPS",
          sourceType: "epo_ops",
          externalId: "EP1234567A1",
          title: "Diagnostic microscopy system for automated tissue segmentation",
          abstract: "Patent record for biomedical microscopy classification.",
          inventors: ["Jane Doe"],
          assignees: ["MedVision Labs"],
          publicationDate: "2026-06-20",
          filingDate: "2025-02-14",
          jurisdiction: "EP",
          status: "published",
          sourceUrl: "https://worldwide.espacenet.com/patent/search/family/EP1234567A1",
          topics: [],
          rawData: {}
        }
      ];
    }
  };

  const result = await runIntelligenceSync(
    {
      action: "fetch_patents",
      dryRun: false,
      sourceTypes: ["epo_ops"],
      keywords: ["diagnostic image analysis"],
      limit: 5
    },
    {
      store,
      connectors: [connector],
      logger: { log() {} }
    }
  );

  assert.equal(result.action, "fetch_patents");
  assert.equal(result.itemsFetched, 1);
  assert.equal(result.itemsCreated, 1);
  assert.equal(savedPatents.length, 1);
  assert.deepEqual(savedPatents[0].topics, ["MAP-Med"]);
});
