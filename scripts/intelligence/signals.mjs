import { cleanText, titleFingerprint } from "./connectors/base.mjs";

const PAIN_TERMS = [
  "manual",
  "limitation",
  "bottleneck",
  "time-consuming",
  "segmentation challenge",
  "annotation",
  "thresholding",
  "low accuracy",
  "noisy images"
];

const LINE_KEYWORDS = {
  "MAP-Nano": ["sem", "tem", "nanoparticle", "microstructure", "grain boundary", "porosity", "surface roughness", "materials characterization", "nanomaterials"],
  "MAP-Bio": ["cell", "diatom", "biological image", "microbial", "brightfield", "phase contrast", "cell counting", "cell tracking"],
  "MAP-Med": ["histopathology", "pathology", "cytology", "tissue segmentation", "diagnostic image", "biomedical image", "medical microscopy"],
  "MAP-Ing": ["concrete", "soil", "cementitious", "crack detection", "corrosion", "coating defect", "materials defects"],
  "General": ["scientific image analysis", "automated microscopy", "computer vision microscopy", "ai for microscopy", "materials informatics", "laboratory automation"]
};

const LINE_SIGNAL_THRESHOLDS = {
  "MAP-Nano": {
    product: { opportunity: 57, proximity: 0.36, match: 0.22 },
    research: { growth: 0.28, minPapers: 2 },
    partnership: { institutions: 2, actionability: 42 },
    content: { contentPotential: 0.48 },
    risk: { minPatents: 1, whiteSpace: 0.62, minPapers: 2 },
    grant: { minGrants: 1 },
    maxSignals: 4
  },
  "MAP-Bio": {
    product: { opportunity: 56, proximity: 0.34, match: 0.2 },
    research: { growth: 0.26, minPapers: 2 },
    partnership: { institutions: 2, actionability: 44 },
    content: { contentPotential: 0.5 },
    risk: { minPatents: 1, whiteSpace: 0.58, minPapers: 2 },
    grant: { minGrants: 1 },
    maxSignals: 4
  },
  "MAP-Med": {
    product: { opportunity: 60, proximity: 0.4, match: 0.22 },
    research: { growth: 0.24, minPapers: 2 },
    partnership: { institutions: 2, actionability: 46 },
    content: { contentPotential: 0.52 },
    risk: { minPatents: 1, whiteSpace: 0.55, minPapers: 2 },
    grant: { minGrants: 1 },
    maxSignals: 4
  },
  "MAP-Ing": {
    product: { opportunity: 58, proximity: 0.36, match: 0.2 },
    research: { growth: 0.28, minPapers: 2 },
    partnership: { institutions: 2, actionability: 42 },
    content: { contentPotential: 0.48 },
    risk: { minPatents: 1, whiteSpace: 0.6, minPapers: 2 },
    grant: { minGrants: 1 },
    maxSignals: 4
  },
  "General": {
    product: { opportunity: 63, proximity: 0.45, match: 0.24 },
    research: { growth: 0.34, minPapers: 3 },
    partnership: { institutions: 3, actionability: 48 },
    content: { contentPotential: 0.58 },
    risk: { minPatents: 1, whiteSpace: 0.5, minPapers: 3 },
    grant: { minGrants: 1 },
    maxSignals: 3
  }
};

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function toScore(value) {
  return Math.round(clamp01(value) * 100);
}

function normalizeText(value) {
  return cleanText(value, 40000)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value) {
  return normalizeText(value).split(/[^a-z0-9]+/).filter(Boolean);
}

function uniqueNormalized(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(normalizeText).filter(Boolean))];
}

function mapTopicToLine(topic) {
  const name = String(topic?.name || "");
  const category = String(topic?.category || "general");
  if (/map-nano/i.test(name) || category === "nano") return "MAP-Nano";
  if (/map-bio/i.test(name) || category === "bio") return "MAP-Bio";
  if (/map-med/i.test(name) || category === "med") return "MAP-Med";
  if (/map-ing/i.test(name) || category === "ing") return "MAP-Ing";
  return "General";
}

function lineThresholds(line) {
  return LINE_SIGNAL_THRESHOLDS[line] || LINE_SIGNAL_THRESHOLDS.General;
}

function evidenceRef(type, item) {
  return {
    type,
    id: String(item?.id || ""),
    title: cleanText(item?.title || item?.name || "", 240),
    sourceUrl: cleanText(item?.sourceUrl || item?.source_url || item?.website || "", 500)
  };
}

function topicKeywords(topic) {
  const relatedLine = mapTopicToLine(topic);
  return uniqueNormalized([
    String(topic?.name || ""),
    ...(Array.isArray(topic?.keywords) ? topic.keywords : []),
    ...(LINE_KEYWORDS[relatedLine] || [])
  ]);
}

function semanticMatchScore(values, terms) {
  const haystack = values.map(normalizeText).filter(Boolean).join(" ");
  if (!haystack || !terms.length) return 0;
  const haystackTokens = new Set(tokenize(haystack));
  let score = 0;
  for (const term of terms) {
    const phrase = normalizeText(term);
    if (!phrase) continue;
    if (haystack.includes(phrase)) {
      score += 1;
      continue;
    }
    const termTokens = tokenize(phrase);
    if (!termTokens.length) continue;
    const overlap = termTokens.filter(token => haystackTokens.has(token)).length;
    const ratio = overlap / termTokens.length;
    if (ratio >= 0.5) {
      score += 0.45 + ratio * 0.4;
    }
  }
  return clamp01(score / Math.max(2, Math.min(6, terms.length)));
}

function explicitTopicMatch(item, topic) {
  const explicit = uniqueNormalized(item?.topics || []);
  const terms = topicKeywords(topic);
  return terms.some(term => explicit.includes(term));
}

function paperTopicScore(paper, topic) {
  if (explicitTopicMatch(paper, topic)) return 1;
  return semanticMatchScore([
    paper?.title,
    paper?.abstract,
    ...(paper?.topics || []),
    ...(paper?.keywords || []),
    ...(paper?.institutions || []),
    ...(paper?.authors || []),
    paper?.journalOrVenue
  ], topicKeywords(topic));
}

function grantTopicScore(grant, topic) {
  if (explicitTopicMatch(grant, topic)) return 1;
  return semanticMatchScore([
    grant?.title,
    grant?.abstract,
    grant?.program,
    grant?.agency,
    ...(grant?.topics || []),
    ...(grant?.institutions || [])
  ], topicKeywords(topic));
}

function patentTopicScore(patent, topic) {
  if (explicitTopicMatch(patent, topic)) return 1;
  return semanticMatchScore([
    patent?.title,
    patent?.abstract,
    ...(patent?.topics || []),
    ...(patent?.assignees || []),
    ...(patent?.inventors || []),
    patent?.jurisdiction,
    patent?.status
  ], topicKeywords(topic));
}

function uniqueInstitutions(papers, grants) {
  return [...new Set([
    ...papers.flatMap(item => Array.isArray(item?.institutions) ? item.institutions : []),
    ...grants.flatMap(item => Array.isArray(item?.institutions) ? item.institutions : [])
  ].map(value => cleanText(value, 200)).filter(Boolean))];
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + (Number(value) || 0), 0) / values.length;
}

function topicGrowth(topicPapers) {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const recent = topicPapers.filter(item => {
    const date = item?.publicationDate ? new Date(item.publicationDate).getTime() : 0;
    return date && (now - date) <= 45 * day;
  }).length;
  const previous = topicPapers.filter(item => {
    const date = item?.publicationDate ? new Date(item.publicationDate).getTime() : 0;
    return date && (now - date) > 45 * day && (now - date) <= 180 * day;
  }).length;
  const baseline = previous > 0 ? (previous / 3) : 0.8;
  return clamp01((recent + (recent >= 3 ? 0.6 : 0)) / (baseline + 1.1));
}

function proximityToBCC(topic, papers) {
  const relatedLine = mapTopicToLine(topic);
  const keywords = uniqueNormalized(LINE_KEYWORDS[relatedLine] || []);
  const haystack = [
    topic?.name,
    topic?.description,
    ...(topic?.keywords || []),
    ...papers.flatMap(item => [item?.title, item?.abstract, ...(item?.topics || []), ...(item?.keywords || [])])
  ];
  return semanticMatchScore(haystack, keywords);
}

function technicalPainDetected(papers) {
  const haystack = papers.map(item => [item?.title, item?.abstract].map(normalizeText).join(" ")).join(" ");
  const matches = PAIN_TERMS.filter(term => haystack.includes(normalizeText(term))).length;
  return clamp01(matches / 3);
}

function fundingPresence(grants) {
  return clamp01(grants.length / 3);
}

function activeInstitutionsScore(papers, grants) {
  return clamp01(uniqueInstitutions(papers, grants).length / 6);
}

function competitiveWhiteSpace(papers, patents) {
  if (!papers.length) return 0;
  const patentPressure = patents.length / Math.max(2, papers.length);
  return clamp01(1 - patentPressure);
}

function openDataAvailability(papers) {
  if (!papers.length) return 0;
  const open = papers.filter(item => item?.openAccessUrl || /dataset|benchmark|open source/i.test(String(item?.abstract || ""))).length;
  return clamp01(open / papers.length);
}

function dataAvailability(papers, grants) {
  const evidenceCount = papers.length + grants.length;
  return clamp01((evidenceCount / 6 + openDataAvailability(papers)) / 2);
}

function clarityOfUseCase(topic, papers, meanPaperMatch) {
  return clamp01(meanPaperMatch * 0.65 + technicalPainDetected(papers) * 0.35);
}

function easeOfContact(papers, grants, institutions) {
  const names = uniqueInstitutions(papers, grants);
  const known = institutions.filter(item => names.includes(cleanText(item?.name || "", 200)));
  const withUrl = known.filter(item => item?.website || item?.sourceUrl).length;
  return clamp01((withUrl + names.length * 0.25) / 4);
}

function compatibilityWithCurrentProduct(topic, papers) {
  return proximityToBCC(topic, papers);
}

function contentPotential(topic, papers, meanPaperMatch) {
  if (!papers.length) return 0;
  const richEvidence = papers.filter(item => item?.abstract && item?.sourceUrl).length;
  return clamp01((richEvidence / papers.length) * 0.45 + meanPaperMatch * 0.25 + clarityOfUseCase(topic, papers, meanPaperMatch) * 0.3);
}

function confidenceScore(opportunityScore, actionabilityScore, evidenceCount, meanMatchScore) {
  return toScore(
    ((opportunityScore / 100) * 0.35)
    + ((actionabilityScore / 100) * 0.3)
    + clamp01(evidenceCount / 6) * 0.2
    + clamp01(meanMatchScore) * 0.15
  );
}

function buildRecommendedAction(signalType, topic, institutions, breakdown) {
  const sampleInstitutions = institutions.slice(0, 3).join(", ");
  if (signalType === "product_opportunity") return `Preparar brief de producto para ${topic.name} y validar pain points con evidencia reciente. Match ${breakdown.matching.paperMeanScore} y proximity ${breakdown.opportunity.proximityToBCC}.`;
  if (signalType === "research_trend") return `Monitorear ${topic.name} semanalmente y priorizar cobertura técnica/comercial. Growth ${breakdown.opportunity.topicGrowth}.`;
  if (signalType === "partnership") return sampleInstitutions
    ? `Explorar acercamiento con ${sampleInstitutions}. Ease of contact ${breakdown.actionability.easeOfContact}.`
    : `Mapear instituciones activas en ${topic.name} para partnership scouting.`;
  if (signalType === "content_idea") return `Convertir ${topic.name} en artículo, demo o briefing comercial con evidencia enlazada. Content potential ${breakdown.actionability.contentPotential}.`;
  if (signalType === "competitive_risk") return `Revisar claims y posicionamiento en ${topic.name}. Patent pressure ${100 - breakdown.opportunity.competitiveWhiteSpace}.`;
  if (signalType === "grant_opportunity") return `Cruzar ${topic.name} con grants activos para detectar ventanas de colaboración y funding. Funding presence ${breakdown.opportunity.fundingPresence}.`;
  return `Revisar la evidencia de ${topic.name} y priorizar siguiente acción.`;
}

function topDrivers(breakdown) {
  const drivers = [
    ["growth", breakdown.opportunity.topicGrowth],
    ["proximity", breakdown.opportunity.proximityToBCC],
    ["funding", breakdown.opportunity.fundingPresence],
    ["pain", breakdown.opportunity.technicalPainDetected],
    ["content", breakdown.actionability.contentPotential],
    ["clarity", breakdown.actionability.clarityOfUseCase]
  ].sort((left, right) => right[1] - left[1]);
  return drivers.slice(0, 2).map(([label]) => label).join(" + ");
}

function buildSummary(signalType, topic, breakdown) {
  const summaries = {
    product_opportunity: `La evidencia reciente en ${topic.name} sugiere una oportunidad de producto alineada a BCC con pain points técnicos visibles.`,
    research_trend: `La actividad reciente en ${topic.name} apunta a una tendencia científica emergente con suficiente densidad de evidencia.`,
    partnership: `Las instituciones activas en ${topic.name} sugieren oportunidades de partnership o colaboración técnica.`,
    content_idea: `El tema ${topic.name} tiene suficiente claridad y evidencia pública para convertirse en contenido técnico o comercial.`,
    competitive_risk: `La actividad detectada en ${topic.name} sugiere vigilar espacio competitivo y claims cercanos al problema.`,
    grant_opportunity: `La presencia de grants vinculados a ${topic.name} sugiere una oportunidad de funding o colaboración.`
  };
  return `${summaries[signalType]} Drivers: ${topDrivers(breakdown)}.`;
}

function buildSignal(title, signalType, topic, relatedLine, evidenceRefs, scores, institutions, scoreBreakdown, priority) {
  return {
    title,
    summary: buildSummary(signalType, topic, scoreBreakdown),
    signalType,
    relatedLine,
    confidenceScore: scores.confidenceScore,
    opportunityScore: scores.opportunityScore,
    actionabilityScore: scores.actionabilityScore,
    evidenceCount: evidenceRefs.length,
    evidenceRefs,
    scoreBreakdown,
    recommendedAction: buildRecommendedAction(signalType, topic, institutions, scoreBreakdown),
    status: "new",
    _priority: priority
  };
}

function rankEvidence(topicPapers, topicGrants, topicPatents) {
  return [
    ...topicPapers.slice(0, 4).map(item => evidenceRef("paper", item)),
    ...topicGrants.slice(0, 2).map(item => evidenceRef("grant", item)),
    ...topicPatents.slice(0, 1).map(item => evidenceRef("patent", item))
  ].filter(item => item.id && item.title).slice(0, 6);
}

function scoreBreakdownForTopic(topic, relatedLine, matches, scores, metrics, thresholds) {
  return {
    topic: {
      name: topic?.name || "",
      line: relatedLine,
      category: topic?.category || "general"
    },
    evidence: {
      papers: matches.papers.length,
      grants: matches.grants.length,
      patents: matches.patents.length,
      institutions: matches.institutions.length
    },
    matching: {
      paperMeanScore: toScore(metrics.meanPaperMatch),
      grantMeanScore: toScore(metrics.meanGrantMatch),
      patentMeanScore: toScore(metrics.meanPatentMatch),
      explicitTopicCoverage: toScore(metrics.explicitTopicCoverage)
    },
    opportunity: {
      topicGrowth: toScore(metrics.topicGrowthValue),
      proximityToBCC: toScore(metrics.proximityValue),
      fundingPresence: toScore(metrics.fundingValue),
      technicalPainDetected: toScore(metrics.painValue),
      activeInstitutions: toScore(metrics.activeInstitutionsValue),
      competitiveWhiteSpace: toScore(metrics.whiteSpaceValue),
      openDataAvailability: toScore(metrics.openDataValue)
    },
    actionability: {
      dataAvailability: toScore(metrics.dataAvailabilityValue),
      clarityOfUseCase: toScore(metrics.clarityValue),
      easeOfContact: toScore(metrics.easeValue),
      compatibilityWithCurrentProduct: toScore(metrics.compatibilityValue),
      contentPotential: toScore(metrics.contentValue)
    },
    totals: {
      opportunityScore: scores.opportunityScore,
      actionabilityScore: scores.actionabilityScore,
      confidenceScore: scores.confidenceScore
    },
    thresholds
  };
}

function explicitTopicCoverage(items, topic) {
  if (!items.length) return 0;
  const count = items.filter(item => explicitTopicMatch(item, topic)).length;
  return count / items.length;
}

function buildSignalsForTopic(topic, context) {
  const relatedLine = mapTopicToLine(topic);
  const thresholds = lineThresholds(relatedLine);

  const paperMatches = context.papers
    .map(item => ({ item, score: paperTopicScore(item, topic) }))
    .filter(entry => entry.score >= thresholds.product.match)
    .sort((left, right) => right.score - left.score);
  const grantMatches = context.grants
    .map(item => ({ item, score: grantTopicScore(item, topic) }))
    .filter(entry => entry.score >= 0.22)
    .sort((left, right) => right.score - left.score);
  const patentMatches = context.patents
    .map(item => ({ item, score: patentTopicScore(item, topic) }))
    .filter(entry => entry.score >= 0.22)
    .sort((left, right) => right.score - left.score);

  const topicPapers = paperMatches.map(entry => entry.item);
  const topicGrants = grantMatches.map(entry => entry.item);
  const topicPatents = patentMatches.map(entry => entry.item);
  const institutions = uniqueInstitutions(topicPapers, topicGrants);
  const evidenceRefs = rankEvidence(topicPapers, topicGrants, topicPatents);
  if (!evidenceRefs.length) return [];

  const meanPaperMatch = average(paperMatches.map(entry => entry.score));
  const meanGrantMatch = average(grantMatches.map(entry => entry.score));
  const meanPatentMatch = average(patentMatches.map(entry => entry.score));
  const topicGrowthValue = topicGrowth(topicPapers);
  const proximityValue = proximityToBCC(topic, topicPapers);
  const fundingValue = fundingPresence(topicGrants);
  const painValue = technicalPainDetected(topicPapers);
  const activeInstitutionsValue = activeInstitutionsScore(topicPapers, topicGrants);
  const whiteSpaceValue = competitiveWhiteSpace(topicPapers, topicPatents);
  const openDataValue = openDataAvailability(topicPapers);
  const dataAvailabilityValue = dataAvailability(topicPapers, topicGrants);
  const clarityValue = clarityOfUseCase(topic, topicPapers, meanPaperMatch);
  const easeValue = easeOfContact(topicPapers, topicGrants, context.institutions);
  const compatibilityValue = compatibilityWithCurrentProduct(topic, topicPapers);
  const contentValue = contentPotential(topic, topicPapers, meanPaperMatch);
  const explicitCoverage = explicitTopicCoverage(topicPapers, topic);

  const opportunityScore = toScore(
    0.25 * topicGrowthValue
    + 0.20 * proximityValue
    + 0.15 * fundingValue
    + 0.15 * painValue
    + 0.10 * activeInstitutionsValue
    + 0.10 * whiteSpaceValue
    + 0.05 * openDataValue
  );

  const actionabilityScore = toScore(
    (dataAvailabilityValue + clarityValue + easeValue + compatibilityValue + contentValue) / 5
  );

  const meanMatchScore = average([meanPaperMatch, meanGrantMatch, meanPatentMatch].filter(Boolean));
  const scores = {
    opportunityScore,
    actionabilityScore,
    confidenceScore: confidenceScore(opportunityScore, actionabilityScore, evidenceRefs.length, meanMatchScore)
  };

  const metrics = {
    meanPaperMatch,
    meanGrantMatch,
    meanPatentMatch,
    explicitTopicCoverage: explicitCoverage,
    topicGrowthValue,
    proximityValue,
    fundingValue,
    painValue,
    activeInstitutionsValue,
    whiteSpaceValue,
    openDataValue,
    dataAvailabilityValue,
    clarityValue,
    easeValue,
    compatibilityValue,
    contentValue
  };

  const breakdown = scoreBreakdownForTopic(topic, relatedLine, {
    papers: topicPapers,
    grants: topicGrants,
    patents: topicPatents,
    institutions
  }, scores, metrics, thresholds);

  const candidates = [];
  const basePriority = opportunityScore * 0.45 + actionabilityScore * 0.35 + scores.confidenceScore * 0.2;

  if (opportunityScore >= thresholds.product.opportunity && proximityValue >= thresholds.product.proximity && meanPaperMatch >= thresholds.product.match) {
    candidates.push(buildSignal(`${topic.name}: Product opportunity`, "product_opportunity", topic, relatedLine, evidenceRefs, scores, institutions, breakdown, basePriority + 14));
  }
  if (topicGrowthValue >= thresholds.research.growth || topicPapers.length >= thresholds.research.minPapers) {
    candidates.push(buildSignal(`${topic.name}: Emerging research trend`, "research_trend", topic, relatedLine, evidenceRefs, scores, institutions, breakdown, basePriority + 10));
  }
  if (institutions.length >= thresholds.partnership.institutions && actionabilityScore >= thresholds.partnership.actionability) {
    candidates.push(buildSignal(`${topic.name}: Partnership candidates`, "partnership", topic, relatedLine, evidenceRefs, scores, institutions, breakdown, basePriority + 8));
  }
  if (contentValue >= thresholds.content.contentPotential) {
    candidates.push(buildSignal(`${topic.name}: Content opportunity`, "content_idea", topic, relatedLine, evidenceRefs, scores, institutions, breakdown, basePriority + 7));
  }
  if (topicPatents.length >= thresholds.risk.minPatents || (topicPapers.length >= thresholds.risk.minPapers && whiteSpaceValue < thresholds.risk.whiteSpace)) {
    candidates.push(buildSignal(`${topic.name}: Competitive watch`, "competitive_risk", topic, relatedLine, evidenceRefs, scores, institutions, breakdown, basePriority + 6));
  }
  if (topicGrants.length >= thresholds.grant.minGrants) {
    candidates.push(buildSignal(`${topic.name}: Grant or collaboration window`, "grant_opportunity", topic, relatedLine, evidenceRefs, scores, institutions, breakdown, basePriority + 9));
  }

  return candidates
    .sort((left, right) => right._priority - left._priority)
    .slice(0, thresholds.maxSignals || 4)
    .filter(signal => Array.isArray(signal.evidenceRefs) && signal.evidenceRefs.length > 0);
}

export function generateStrategicSignals(context = {}) {
  const topics = (Array.isArray(context.topics) ? context.topics : []).filter(item => item?.enabled !== false);
  const papers = Array.isArray(context.papers) ? context.papers : [];
  const grants = Array.isArray(context.grants) ? context.grants : [];
  const patents = Array.isArray(context.patents) ? context.patents : [];
  const institutions = Array.isArray(context.institutions) ? context.institutions : [];

  const signals = topics.flatMap(topic => buildSignalsForTopic(topic, {
    papers,
    grants,
    patents,
    institutions
  }));

  const deduped = new Map();
  for (const signal of signals) {
    const key = `${signal.signalType}|${signal.relatedLine}|${titleFingerprint(signal.title || "")}`;
    if (!key.trim()) continue;
    if (!deduped.has(key)) {
      deduped.set(key, signal);
      continue;
    }
    const current = deduped.get(key);
    const leftPriority = Number(signal._priority || 0) + Number(signal.evidenceCount || 0);
    const rightPriority = Number(current._priority || 0) + Number(current.evidenceCount || 0);
    if (leftPriority > rightPriority) {
      deduped.set(key, signal);
    }
  }

  return [...deduped.values()].map(signal => {
    const { _priority, ...publicSignal } = signal;
    return publicSignal;
  });
}
