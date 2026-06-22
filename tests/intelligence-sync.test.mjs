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
      assert.equal(metrics.itemsFetched, 1);
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
  assert.equal(result.itemsFetched, 1);
  assert.equal(result.itemsDeduped, 1);
  assert.equal(calls.startRun, 1);
  assert.equal(calls.completeRun, 1);
  assert.equal(calls.failRun, 0);
  assert.equal(calls.savePaper, 0);
  assert.equal(calls.saveSignal, 0);
});

test("sync_papers tolerates a rate-limited source when other paper connectors succeed", async () => {
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
      return { id: "run-partial-1" };
    },
    async completeRun(runId, metrics) {
      assert.equal(runId, "run-partial-1");
      assert.equal(metrics.itemsFetched, 1);
      assert.equal(metrics.itemsCreated, 1);
    },
    async failRun() {
      throw new Error("failRun should not be called when at least one source succeeds");
    },
    async savePaper() {
      return { action: "created", record: { id: "paper-ok-1" } };
    },
    async touchSourceSync() {},
    async listPapersForTopicDiagnostics() {
      return [];
    },
    async listSignalInputs() {
      return {
        topics: await this.listEnabledTopics(),
        grants: [],
        patents: [],
        trials: [],
        institutions: [],
        papers: [
          {
            id: "paper-ok-1",
            title: "SEM image analysis workflow",
            abstract: "Manual segmentation challenge in microscopy.",
            topics: ["MAP-Nano"],
            keywords: ["SEM image analysis"],
            publicationDate: "2026-06-15",
            sourceUrl: "https://example.com/paper-ok-1"
          }
        ]
      };
    },
    async saveSignal() {
      return { action: "created", record: { id: "signal-ok-1" } };
    }
  };

  const okConnector = {
    sourceType: "openalex",
    async search() {
      return [
        {
          sourceName: "OpenAlex",
          sourceType: "openalex",
          externalId: "oa-1",
          title: "SEM image analysis workflow",
          abstract: "Manual segmentation challenge in microscopy.",
          keywords: ["SEM image analysis"],
          topics: ["MAP-Nano"],
          sourceUrl: "https://example.com/paper-ok-1",
          publicationDate: "2026-06-15",
          rawData: { source: "openalex" }
        }
      ];
    }
  };

  const failingConnector = {
    sourceType: "semantic_scholar",
    async search() {
      throw new Error("HTTP 429");
    }
  };

  const result = await runIntelligenceSync(
    {
      action: "sync_papers",
      dryRun: false,
      sourceTypes: ["openalex", "semantic_scholar"],
      keywords: ["SEM image analysis"],
      limit: 5
    },
    {
      store,
      connectors: [okConnector, failingConnector],
      logger: { log() {}, warn() {} }
    }
  );

  assert.equal(result.itemsFetched, 1);
  assert.equal(result.itemsCreated, 1);
  assert.equal(result.sourceFailures.length, 1);
  assert.equal(result.sourceFailures[0].sourceType, "semantic_scholar");
});

test("sync_papers fans out topic queries and keeps the strongest paper candidates", async () => {
  const seenQueries = [];
  const savedTitles = [];
  const store = {
    async listEnabledTopics() {
      return [
        { id: "topic-1", name: "MAP-Nano", category: "nano", keywords: ["SEM image analysis", "microstructure analysis"], enabled: true },
        { id: "topic-2", name: "MAP-Bio", category: "bio", keywords: ["cell counting", "cell morphology analysis"], enabled: true }
      ];
    },
    async listSettings() {
      return { max_results_per_source: 30 };
    },
    async ensureSourceRecord(connector) {
      return { id: `source-${connector.sourceType}`, type: connector.sourceType };
    },
    async startRun() {
      return { id: "run-topic-fanout-1" };
    },
    async completeRun() {},
    async failRun() {},
    async savePaper(item) {
      savedTitles.push(item.title);
      return { action: "created", record: { id: `paper-${savedTitles.length}` } };
    },
    async touchSourceSync() {},
    async listPapersForTopicDiagnostics() {
      return [];
    },
    async listSignalInputs() {
      return {
        topics: await this.listEnabledTopics(),
        grants: [],
        patents: [],
        trials: [],
        institutions: [],
        papers: []
      };
    },
    async saveSignal() {
      return { action: "created", record: { id: "signal-1" } };
    }
  };

  const connector = {
    sourceType: "openalex",
    async search(query) {
      seenQueries.push({ text: query.text, keywords: [...(query.keywords || [])], limit: query.limit });
    if (String(query.text).includes("MAP-Nano")) {
        return [
          {
            sourceName: "OpenAlex",
            sourceType: "openalex",
            externalId: "oa-nano-1",
            title: "SEM image analysis workflow for microstructure inspection",
            abstract: "Detailed abstract with microscopy, segmentation and benchmarking context.",
            keywords: ["SEM image analysis", "microstructure analysis"],
            topics: ["MAP-Nano"],
            sourceUrl: "https://example.com/oa-nano-1",
            openAccessUrl: "https://example.com/oa-nano-1.pdf",
            publicationDate: "2026-06-20",
            citationsCount: 14,
            journalOrVenue: "Microscopy Today",
            rawData: {}
          },
          {
            sourceName: "OpenAlex",
            sourceType: "openalex",
            externalId: "oa-nano-2",
            title: "Short note on grain images",
            abstract: "",
            keywords: ["grain boundary detection"],
            topics: ["MAP-Nano"],
            sourceUrl: "https://example.com/oa-nano-2",
            publicationDate: "2021-01-01",
            citationsCount: 0,
            journalOrVenue: "",
            rawData: {}
          },
          ...Array.from({ length: 34 }, (_, index) => ({
            sourceName: "OpenAlex",
            sourceType: "openalex",
            externalId: `oa-nano-low-${index + 1}`,
            title: `Low-signal microscopy note ${index + 1}`,
            abstract: "",
            keywords: ["microscopy"],
            topics: ["MAP-Nano"],
            sourceUrl: `https://example.com/oa-nano-low-${index + 1}`,
            publicationDate: "2020-01-01",
            citationsCount: 0,
            journalOrVenue: "",
            rawData: {}
          }))
        ];
      }
      return [
        {
          sourceName: "OpenAlex",
          sourceType: "openalex",
          externalId: "oa-bio-1",
          title: "Cell morphology analysis for automated counting",
          abstract: "Structured abstract with dataset, use case and open protocol.",
          keywords: ["cell counting", "cell morphology analysis"],
          topics: ["MAP-Bio"],
          sourceUrl: "https://example.com/oa-bio-1",
          openAccessUrl: "https://example.com/oa-bio-1.pdf",
          publicationDate: "2026-06-18",
          citationsCount: 9,
          journalOrVenue: "Bioimage Analysis",
          rawData: {}
        }
      ];
    }
  };

  const result = await runIntelligenceSync(
    {
      action: "fetch_papers",
      dryRun: false,
      sourceTypes: ["openalex"],
      limit: 5
    },
    {
      store,
      connectors: [connector],
      logger: { log() {}, warn() {} }
    }
  );

  assert.equal(seenQueries.length, 2);
  assert.ok(seenQueries.some(query => query.text === "MAP-Nano"));
  assert.ok(seenQueries.some(query => query.text === "MAP-Bio"));
  assert.ok(savedTitles.includes("SEM image analysis workflow for microstructure inspection"));
  assert.ok(savedTitles.includes("Cell morphology analysis for automated counting"));
  assert.equal(savedTitles[0], "SEM image analysis workflow for microstructure inspection");
  assert.equal(result.itemsFetched, 30);
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

test("fetch_trials persists normalized topic names onto studies", async () => {
  const savedTrials = [];
  const store = {
    async listEnabledTopics() {
      return [
        {
          id: "topic-med-1",
          name: "MAP-Med",
          category: "med",
          keywords: ["pathology AI", "cell counting"],
          enabled: true
        }
      ];
    },
    async ensureSourceRecord(connector) {
      return { id: `source-${connector.sourceType}`, type: connector.sourceType };
    },
    async startRun(meta) {
      assert.equal(meta.actionType, "fetch_trials");
      return { id: "run-trials-1" };
    },
    async completeRun(runId, metrics) {
      assert.equal(runId, "run-trials-1");
      assert.equal(metrics.itemsFetched, 1);
    },
    async failRun() {},
    async saveTrial(item) {
      savedTrials.push(item);
      return { action: "created", record: { id: "trial-1" } };
    },
    async touchSourceSync() {}
  };

  const connector = {
    sourceType: "clinicaltrials",
    async search() {
      return [
        {
          sourceName: "ClinicalTrials.gov",
          sourceType: "clinicaltrials",
          externalId: "NCT12345678",
          title: "Pathology AI cell counting study",
          summary: "Evaluates microscopy-assisted cell counting in digital pathology.",
          conditions: ["Cancer"],
          interventions: ["Device: Microscopy AI"],
          studyType: "INTERVENTIONAL",
          sponsor: "Hospital A",
          collaborators: ["University B"],
          startDate: "2026-06-01",
          completionDate: "2027-01-01",
          locations: ["Hospital A, Boston, USA"],
          countries: ["USA"],
          topics: [],
          keywords: ["pathology AI", "cell counting"],
          sourceUrl: "https://clinicaltrials.gov/study/NCT12345678",
          rawData: { source: "clinicaltrials" }
        }
      ];
    }
  };

  const result = await runIntelligenceSync(
    {
      action: "fetch_trials",
      dryRun: false,
      sourceTypes: ["clinicaltrials"],
      keywords: ["pathology AI"],
      limit: 5
    },
    {
      store,
      connectors: [connector],
      logger: { log() {} }
    }
  );

  assert.equal(result.itemsFetched, 1);
  assert.equal(savedTrials.length, 1);
  assert.deepEqual(savedTrials[0].topics, ["MAP-Med"]);
  assert.equal(savedTrials[0].externalId, "NCT12345678");
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
