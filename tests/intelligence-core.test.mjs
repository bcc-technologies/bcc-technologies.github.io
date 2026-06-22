import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { normalizePaperItem, normalizeTrialItem } from "../scripts/intelligence/connectors/base.mjs";
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

test("normalizes trial payloads into the internal shape", () => {
  const trial = normalizeTrialItem({
    sourceName: "ClinicalTrials.gov",
    sourceType: "clinicaltrials",
    externalId: " NCT01234567 ",
    title: "  Cell counting validation in microscopy workflow  ",
    summary: "   Trial summary for translational validation.   ",
    conditions: [" Cell morphology ", "Cell morphology"],
    interventions: [" Device: AI microscopy ", "Device: AI microscopy"],
    phase: " phase2 ",
    status: " recruiting ",
    studyType: " interventional ",
    sponsor: "dept. of pathology, univ. x",
    collaborators: ["Hospital Y", "hospital y"],
    startDate: "2026-06",
    completionDate: "2027",
    locations: [" Lab 1, City ", "Lab 1, City"],
    countries: [" usa ", "USA"],
    sourceUrl: "http://clinicaltrials.gov/study/NCT01234567",
    topics: [" MAP-Med "],
    keywords: [" pathology AI ", "pathology AI"],
    rawData: { ok: true }
  });

  assert.equal(trial.kind, "trial");
  assert.equal(trial.externalId, "NCT01234567");
  assert.equal(trial.title, "Cell counting validation in microscopy workflow");
  assert.equal(trial.sponsor, "Department of pathology, University x");
  assert.equal(trial.startDate, "2026-06-01");
  assert.equal(trial.completionDate, "2027-01-01");
  assert.equal(trial.sourceUrl, "https://clinicaltrials.gov/study/NCT01234567");
  assert.deepEqual(trial.conditions, ["Cell morphology"]);
  assert.deepEqual(trial.interventions, ["Device: AI microscopy"]);
  assert.deepEqual(trial.topics, ["MAP-Med"]);
  assert.deepEqual(trial.keywords, ["pathology AI"]);
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

test("Semantic Scholar connector works without API key and uses x-api-key when present", async () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.SEMANTIC_SCHOLAR_API_KEY;
  const requests = [];

  process.env.SEMANTIC_SCHOLAR_API_KEY = "test-semantic-key";

  global.fetch = async (url, options = {}) => {
    requests.push({ url: String(url), headers: options.headers || {} });
    return {
      ok: true,
      async json() {
        return { data: [] };
      }
    };
  };

  try {
    const moduleUrl = new URL(`${pathToFileURL(path.resolve(process.cwd(), "scripts/intelligence/connectors/semantic-scholar.mjs")).href}?test=${Date.now()}`);
    const { default: semanticScholar } = await import(moduleUrl.href);

    assert.equal(semanticScholar.requiresApiKey, false);
    await semanticScholar.search({
      keywords: ["cell morphology analysis", "biological image analysis"],
      limit: 5
    });

    assert.equal(requests.length, 1);
    const requestUrl = new URL(requests[0].url);
    assert.equal(requestUrl.searchParams.get("limit"), "5");
    assert.match(requestUrl.searchParams.get("fields") || "", /paperId/);
    assert.equal(requests[0].headers["x-api-key"], "test-semantic-key");
  } finally {
    global.fetch = originalFetch;
    process.env.SEMANTIC_SCHOLAR_API_KEY = originalApiKey;
  }
});

test("ClinicalTrials.gov connector normalizes studies into trial records", async () => {
  const originalFetch = global.fetch;
  const requests = [];

  global.fetch = async (url) => {
    requests.push(String(url));
    return {
      ok: true,
      async json() {
        return {
          studies: [
            {
              protocolSection: {
                identificationModule: {
                  nctId: "NCT09999999",
                  briefTitle: "Cell counting trial for pathology AI"
                },
                statusModule: {
                  overallStatus: "RECRUITING",
                  startDateStruct: { date: "2026-05" },
                  completionDateStruct: { date: "2027-01" }
                },
                sponsorCollaboratorsModule: {
                  leadSponsor: { name: "University Hospital" },
                  collaborators: [{ name: "Cancer Lab" }]
                },
                descriptionModule: {
                  briefSummary: "Validates microscopy-assisted cell counting."
                },
                conditionsModule: {
                  conditions: ["Cancer"],
                  keywords: ["cell counting", "pathology AI"]
                },
                designModule: {
                  studyType: "INTERVENTIONAL",
                  phases: ["PHASE2"]
                },
                armsInterventionsModule: {
                  interventions: [{ type: "DEVICE", name: "Microscopy AI" }]
                },
                contactsLocationsModule: {
                  locations: [{ facility: "Hospital A", city: "Boston", country: "USA" }]
                }
              }
            }
          ]
        };
      }
    };
  };

  try {
    const moduleUrl = new URL(`${pathToFileURL(path.resolve(process.cwd(), "scripts/intelligence/connectors/clinicaltrials.mjs")).href}?test=${Date.now()}`);
    const { default: clinicalTrials } = await import(moduleUrl.href);
    const items = await clinicalTrials.search({
      keywords: ["cell counting", "pathology AI"],
      limit: 3
    });

    assert.equal(requests.length, 1);
    assert.equal(items.length, 1);
    assert.equal(items[0].kind, "trial");
    assert.equal(items[0].externalId, "NCT09999999");
    assert.equal(items[0].studyType, "INTERVENTIONAL");
    assert.equal(items[0].sponsor, "University Hospital");
    assert.deepEqual(items[0].countries, ["USA"]);
  } finally {
    global.fetch = originalFetch;
  }
});

test("PubMed connector uses NCBI api_key and normalizes fetched XML", async () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.NCBI_API_KEY;
  const requests = [];

  process.env.NCBI_API_KEY = "test-ncbi-key";

  global.fetch = async (url) => {
    requests.push(String(url));
    if (String(url).includes("esearch.fcgi")) {
      return {
        ok: true,
        async json() {
          return {
            esearchresult: {
              idlist: ["12345678"]
            }
          };
        }
      };
    }

    return {
      ok: true,
      async text() {
        return `<?xml version="1.0"?>
<PubmedArticleSet>
  <PubmedArticle>
    <MedlineCitation>
      <PMID>12345678</PMID>
      <Article>
        <Journal>
          <Title>Microscopy Journal</Title>
          <JournalIssue>
            <PubDate>
              <Year>2026</Year>
              <Month>Jun</Month>
              <Day>18</Day>
            </PubDate>
          </JournalIssue>
        </Journal>
        <ArticleTitle>Automated microscopy pipeline for cell counting</ArticleTitle>
        <Abstract>
          <AbstractText>Brightfield microscopy workflow for biological image analysis.</AbstractText>
        </Abstract>
        <AuthorList>
          <Author>
            <ForeName>Jane</ForeName>
            <LastName>Doe</LastName>
            <AffiliationInfo>
              <Affiliation>Department of Biology, University X</Affiliation>
            </AffiliationInfo>
          </Author>
        </AuthorList>
      </Article>
      <KeywordList>
        <Keyword>cell counting</Keyword>
      </KeywordList>
      <MeshHeadingList>
        <MeshHeading>
          <DescriptorName>microscopy</DescriptorName>
        </MeshHeading>
      </MeshHeadingList>
    </MedlineCitation>
    <PubmedData>
      <ArticleIdList>
        <ArticleId IdType="doi">10.1000/pubmed-1</ArticleId>
        <ArticleId IdType="pmc">PMC123456</ArticleId>
      </ArticleIdList>
    </PubmedData>
  </PubmedArticle>
</PubmedArticleSet>`;
      }
    };
  };

  try {
    const moduleUrl = new URL(`${pathToFileURL(path.resolve(process.cwd(), "scripts/intelligence/connectors/pubmed.mjs")).href}?test=${Date.now()}`);
    const { default: pubmed } = await import(moduleUrl.href);

    assert.equal(pubmed.requiresApiKey, false);
    const items = await pubmed.search({
      keywords: ["cell counting"],
      limit: 3
    });

    assert.equal(requests.length, 2);
    assert.equal(new URL(requests[0]).searchParams.get("api_key"), "test-ncbi-key");
    assert.equal(new URL(requests[1]).searchParams.get("api_key"), "test-ncbi-key");
    assert.equal(items.length, 1);
    assert.equal(items[0].externalId, "12345678");
    assert.equal(items[0].doi, "10.1000/pubmed-1");
    assert.equal(items[0].publicationDate, "2026-06-18");
    assert.deepEqual(items[0].authors, ["Jane Doe"]);
    assert.ok(items[0].keywords.includes("cell counting"));
  } finally {
    global.fetch = originalFetch;
    process.env.NCBI_API_KEY = originalApiKey;
  }
});

test("NIH RePORTER connector normalizes grant results from the official project search payload", async () => {
  const originalFetch = global.fetch;
  const requests = [];

  global.fetch = async (url, options = {}) => {
    requests.push({
      url: String(url),
      method: options.method || "GET",
      body: options.body || ""
    });
    return {
      ok: true,
      async json() {
        return {
          results: [
            {
              appl_id: 11364092,
              project_title: "Automated image analysis for biomedical microscopy",
              abstract_text: "Cell counting workflow for biological image analysis.",
              agency_ic_admin: {
                abbreviation: "NIBIB",
                name: "National Institute of Biomedical Imaging and Bioengineering"
              },
              funding_mechanism: "Research Projects",
              award_amount: 692085,
              budget_start: "2025-07-01T00:00:00",
              budget_end: "2029-03-31T00:00:00",
              principal_investigators: [
                { full_name: "Georges El Fakhri" }
              ],
              organization: {
                org_name: "YALE UNIVERSITY",
                org_country: "UNITED STATES"
              },
              project_detail_url: "https://reporter.nih.gov/search/example/project-details/11364092",
              terms: "<Cell Counting><Microscopy><Image Analysis>",
              pref_terms: "<Biomedical Imaging>",
              opportunity_number: "PA-20-185",
              fiscal_year: 2026
            }
          ]
        };
      }
    };
  };

  try {
    const moduleUrl = new URL(`${pathToFileURL(path.resolve(process.cwd(), "scripts/intelligence/connectors/nih-reporter.mjs")).href}?test=${Date.now()}`);
    const { default: nihReporter } = await import(moduleUrl.href);

    assert.equal(nihReporter.requiresApiKey, false);
    const items = await nihReporter.search({
      keywords: ["cell counting"],
      limit: 2
    });

    assert.equal(requests.length, 1);
    assert.equal(requests[0].method, "POST");
    const body = JSON.parse(requests[0].body);
    assert.equal(body.limit, 2);
    assert.equal(body.criteria.include_active_projects, true);
    assert.equal(items.length, 1);
    assert.equal(items[0].kind, "grant");
    assert.equal(items[0].externalId, "11364092");
    assert.equal(items[0].agency, "NIBIB");
    assert.equal(items[0].currency, "USD");
    assert.deepEqual(items[0].principalInvestigators, ["Georges El Fakhri"]);
    assert.ok(items[0].topics.includes("Cell Counting"));
  } finally {
    global.fetch = originalFetch;
  }
});

test("NSF Awards connector normalizes grant results from the official award search payload", async () => {
  const originalFetch = global.fetch;
  const requests = [];

  global.fetch = async (url) => {
    requests.push(String(url));
    return {
      ok: true,
      async json() {
        return {
          response: {
            award: [
              {
                id: "2622634",
                title: "Automated microscopy benchmarks for cell counting",
                abstractText: "Biological image analysis workflow for microscopy reproducibility.",
                agency: "NSF",
                fundProgramName: "Cross-BIO Activities",
                fundsObligatedAmt: "195526",
                date: "06/17/2026",
                expDate: "08/31/2027",
                awardeeName: "University of Minnesota-Twin Cities",
                awardeeCountryCode: "US",
                piFirstName: "Joseph",
                piLastName: "Walder",
                pdPIName: "Joseph Walder",
                program: "MCB"
              }
            ]
          }
        };
      }
    };
  };

  try {
    const moduleUrl = new URL(`${pathToFileURL(path.resolve(process.cwd(), "scripts/intelligence/connectors/nsf-awards.mjs")).href}?test=${Date.now()}`);
    const { default: nsfAwards } = await import(moduleUrl.href);

    assert.equal(nsfAwards.requiresApiKey, false);
    const items = await nsfAwards.search({
      keywords: ["cell counting"],
      limit: 2
    });

    assert.equal(requests.length, 1);
    const requestUrl = new URL(requests[0]);
    assert.equal(requestUrl.searchParams.get("keyword"), "cell counting");
    assert.equal(requestUrl.searchParams.get("rpp"), "2");
    assert.equal(items.length, 1);
    assert.equal(items[0].kind, "grant");
    assert.equal(items[0].externalId, "2622634");
    assert.equal(items[0].agency, "NSF");
    assert.equal(items[0].amount, 195526);
    assert.equal(items[0].startDate, "2026-06-17");
    assert.equal(items[0].endDate, "2027-08-31");
    assert.deepEqual(items[0].principalInvestigators, ["Joseph Walder"]);
    assert.ok(items[0].topics.includes("Cross-BIO Activities"));
  } finally {
    global.fetch = originalFetch;
  }
});

test("EPO OPS connector stays disabled until credentials exist", async () => {
  const originalKey = process.env.EPO_OPS_KEY;
  const originalSecret = process.env.EPO_OPS_SECRET;
  delete process.env.EPO_OPS_KEY;
  delete process.env.EPO_OPS_SECRET;

  try {
    const moduleUrl = new URL(`${pathToFileURL(path.resolve(process.cwd(), "scripts/intelligence/connectors/epo-ops.mjs")).href}?test=${Date.now()}`);
    const { default: epoOps } = await import(moduleUrl.href);

    assert.equal(epoOps.requiresApiKey, true);
    assert.equal(epoOps.defaultEnabled, false);
    await assert.rejects(
      () => epoOps.search({ keywords: ["microscopy"], limit: 2 }),
      /EPO_OPS_KEY and EPO_OPS_SECRET/
    );
  } finally {
    process.env.EPO_OPS_KEY = originalKey;
    process.env.EPO_OPS_SECRET = originalSecret;
  }
});

test("USPTO connector remains intentionally inactive with an explicit reason", async () => {
  const moduleUrl = new URL(`${pathToFileURL(path.resolve(process.cwd(), "scripts/intelligence/connectors/uspto.mjs")).href}?test=${Date.now()}`);
  const { default: uspto } = await import(moduleUrl.href);

  assert.equal(uspto.requiresApiKey, true);
  assert.equal(uspto.defaultEnabled, false);
  assert.equal(uspto.enforcedDisabled, true);
  await assert.rejects(
    () => uspto.search({ keywords: ["microscopy"], limit: 2 }),
    /intentionally inactive/
  );
});
