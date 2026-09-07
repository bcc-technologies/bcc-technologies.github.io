import { lexicalMatchScore, containsPhrase, configuredTopicTerms } from "./matching.mjs";
import { cleanText, titleFingerprint } from "./connectors/base.mjs";
import { paperRelevance } from "./relevance.mjs";

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
    publicationDate: item?.publicationDate || item?.startDate || "",
    excerpt: cleanText(item?.abstract || item?.summary || "", 700),
    relevance: item?.relevance || null,
    sourceUrl: cleanText(item?.sourceUrl || item?.source_url || item?.website || "", 500)
  };
}

function topicKeywords(topic) {
  return uniqueNormalized(configuredTopicTerms(topic));
}

const semanticMatchScore = lexicalMatchScore;

function explicitTopicMatch(item, topic) {
  const explicit = uniqueNormalized(item?.topics || []);
  const terms = topicKeywords(topic);
  return terms.some(term => explicit.includes(term));
}

function paperTopicScore(paper, topic) {
  return paperRelevance(paper, topic).score;
}

function grantTopicScore(grant, topic) {
  return semanticMatchScore([
    grant?.title,
    grant?.abstract,
    grant?.program,
    grant?.agency,
  ], topicKeywords(topic));
}

function patentTopicScore(patent, topic) {
  return semanticMatchScore([
    patent?.title,
    patent?.abstract,
    patent?.jurisdiction,
    patent?.status
  ], topicKeywords(topic));
}

function trialTopicScore(trial, topic) {
  return semanticMatchScore([
    trial?.title,
    trial?.summary,
    ...(trial?.keywords || []),
    ...(trial?.conditions || []),
    ...(trial?.interventions || []),
    trial?.phase,
    trial?.status,
    trial?.studyType,
    trial?.sponsor
  ], topicKeywords(topic));
}

function uniqueInstitutions(papers, grants, trials = []) {
  return [...new Set([
    ...papers.flatMap(item => Array.isArray(item?.institutions) ? item.institutions : []),
    ...grants.flatMap(item => Array.isArray(item?.institutions) ? item.institutions : []),
    ...trials.flatMap(item => [
      item?.sponsor || "",
      ...(Array.isArray(item?.collaborators) ? item.collaborators : [])
    ])
  ].map(value => cleanText(value, 200)).filter(Boolean))];
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + (Number(value) || 0), 0) / values.length;
}

export function measureTopicGrowth(papers, now = Date.now()) {
  const day = 86400000;
  const ages = papers.map(item => (now - Date.parse(item.publicationDate || "")) / day);
  const recent = ages.filter(age => age >= 0 && age <= 45).length;
  const previous = ages.filter(age => age > 45 && age <= 90).length;
  // Equal windows; absence of a baseline cannot establish growth.
  const sufficient = recent >= 3 && previous >= 3;
  return { recent, previous, windowDays: 45, sufficient,
    score: sufficient ? clamp01((recent - previous) / previous) : null };
}

function proximityToBCC(topic, papers) {
  const keywords = uniqueNormalized(LINE_KEYWORDS[mapTopicToLine(topic)] || []);
  return average(papers.map(item => semanticMatchScore([item.title, item.abstract, ...(item.keywords || [])], keywords)));
}

function technicalPainDetected(papers) {
  // Volume must not turn a few generic words into universal evidence of pain.
  return average(papers.map(item => {
    const text = [item.title, item.abstract].join(" ");
    return clamp01(PAIN_TERMS.filter(term => containsPhrase(text, term)).length / 3);
  }));
}

function fundingPresence(grants, trials) {
  return clamp01(grants.length / 3);
}

function activeInstitutionsScore(papers, grants, trials) {
  return clamp01(uniqueInstitutions(papers, grants, trials).length / 6);
}

function competitiveWhiteSpace() {
  // Neither missing patents nor a small search result measures market whitespace.
  return null;
}

function openDataAvailability(papers) {
  if (!papers.length) return 0;
  return papers.filter(item => /^https?:\/\//i.test(item.datasetUrl || "")).length / papers.length;
}

function dataAvailability(papers, grants, trials) {
  const evidenceCount = papers.length + grants.length + trials.length;
  return clamp01((evidenceCount / 6 + openDataAvailability(papers)) / 2);
}

function clarityOfUseCase(topic, papers, meanPaperMatch) {
  return clamp01(meanPaperMatch * 0.65 + technicalPainDetected(papers) * 0.35);
}

function easeOfContact(papers, grants, trials, institutions) {
  const names = uniqueInstitutions(papers, grants, trials);
  const known = institutions.filter(item => names.includes(cleanText(item?.name || "", 200)));
  const withUrl = known.filter(item => item?.website || item?.sourceUrl).length;
  return clamp01(withUrl / 4);
}

function compatibilityWithCurrentProduct(topic, papers) {
  return proximityToBCC(topic, papers);
}

function contentPotential(topic, papers, meanPaperMatch) {
  if (!papers.length) return 0;
  const richEvidence = papers.filter(item => item?.abstract && item?.sourceUrl).length;
  return clamp01((richEvidence / papers.length) * 0.45 + meanPaperMatch * 0.25 + clarityOfUseCase(topic, papers, meanPaperMatch) * 0.3);
}

function confidenceScore(items, meanMatchScore) {
  if (!items.length) return 0;
  const linked = items.filter(item => /^https?:\/\//i.test(item.sourceUrl || "")).length / items.length;
  const described = items.filter(item => (item.abstract || item.summary || "").length >= 120).length / items.length;
  // Evidence completeness, independent of opportunity; not probability of success.
  return toScore(0.4 * meanMatchScore + 0.3 * linked + 0.3 * described);
}

function buildRecommendedAction(signalType, topic, institutions, breakdown) {
  const sampleInstitutions = institutions.slice(0, 3).join(", ");
  if (signalType === "product_opportunity") return `Preparar brief de producto para ${topic.name} y validar pain points con evidencia reciente. Match ${breakdown.matching.paperMeanScore} y proximity ${breakdown.opportunity.proximityToBCC}.`;
  if (signalType === "research_trend") return `Monitorear ${topic.name} semanalmente y priorizar cobertura técnica/comercial. Growth ${breakdown.opportunity.topicGrowth}.`;
  if (signalType === "partnership") return sampleInstitutions
    ? `Explorar acercamiento con ${sampleInstitutions}. Ease of contact ${breakdown.actionability.easeOfContact}.`
    : `Mapear instituciones activas en ${topic.name} para partnership scouting.`;
  if (signalType === "content_idea") return `Convertir ${topic.name} en artículo, demo o briefing comercial con evidencia enlazada. Content potential ${breakdown.actionability.contentPotential}.`;
  if (signalType === "competitive_risk") return `Revisar claims y posicionamiento en ${topic.name}. Validar alcance, vigencia y claims en la fuente primaria; no se ha medido presión de mercado.`;
  if (signalType === "grant_opportunity") return `Cruzar ${topic.name} con grants y estudios activos para detectar ventanas de colaboración, funding y validación. Funding presence ${breakdown.opportunity.fundingPresence}.`;
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
    grant_opportunity: `La presencia de grants o estudios vinculados a ${topic.name} sugiere una oportunidad de funding, validación o colaboración.`
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

function rankEvidence(topicPapers, topicGrants, topicPatents, topicTrials) {
  return [
    ...topicPapers.slice(0, 4).map(item => evidenceRef("paper", item)),
    ...topicGrants.slice(0, 2).map(item => evidenceRef("grant", item)),
    ...topicPatents.slice(0, 1).map(item => evidenceRef("patent", item)),
    ...topicTrials.slice(0, 2).map(item => evidenceRef("trial", item))
  ].filter(item => item.id && item.title).slice(0, 8);
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
      trials: matches.trials.length,
      institutions: matches.institutions.length
    },
    matching: {
      paperMeanScore: toScore(metrics.meanPaperMatch),
      grantMeanScore: toScore(metrics.meanGrantMatch),
      patentMeanScore: toScore(metrics.meanPatentMatch),
      trialMeanScore: toScore(metrics.meanTrialMatch),
      explicitTopicCoverage: toScore(metrics.explicitTopicCoverage)
    },
    opportunity: {
      topicGrowth: toScore(metrics.topicGrowthValue),
      proximityToBCC: toScore(metrics.proximityValue),
      fundingPresence: toScore(metrics.fundingValue),
      technicalPainDetected: toScore(metrics.painValue),
      activeInstitutions: toScore(metrics.activeInstitutionsValue),
      competitiveWhiteSpace: metrics.whiteSpaceValue === null ? null : toScore(metrics.whiteSpaceValue),
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
    .filter(item => item.id && /^https?:\/\//i.test(item.sourceUrl || ""))
    .filter(item => { const age = context.now - Date.parse(item.publicationDate || ""); return age >= 0 && age <= 365 * 86400000; })
    .map(item => ({ item, score: paperTopicScore(item, topic) }))
    .filter(entry => entry.score >= thresholds.product.match)
    .sort((left, right) => right.score - left.score);
  const grantMatches = context.grants.filter(item => item.id && /^https?:\/\//i.test(item.sourceUrl || ""))
    .map(item => ({ item, score: grantTopicScore(item, topic) }))
    .filter(entry => entry.score >= 0.22)
    .sort((left, right) => right.score - left.score);
  const patentMatches = context.patents.filter(item => item.id && /^https?:\/\//i.test(item.sourceUrl || ""))
    .map(item => ({ item, score: patentTopicScore(item, topic) }))
    .filter(entry => entry.score >= 0.22)
    .sort((left, right) => right.score - left.score);
  const trialMatches = context.trials.filter(item => item.id && /^https?:\/\//i.test(item.sourceUrl || ""))
    .map(item => ({ item, score: trialTopicScore(item, topic) }))
    .filter(entry => entry.score >= 0.24)
    .sort((left, right) => right.score - left.score);

  const topicPapers = paperMatches.map(entry => ({ ...entry.item, relevance: paperRelevance(entry.item, topic) }));
  const topicGrants = grantMatches.map(entry => entry.item);
  const topicPatents = patentMatches.map(entry => entry.item);
  const topicTrials = trialMatches.map(entry => entry.item);
  const institutions = uniqueInstitutions(topicPapers, topicGrants, topicTrials);
  const evidenceRefs = rankEvidence(topicPapers, topicGrants, topicPatents, topicTrials);
  if (!evidenceRefs.length) return [];

  const meanPaperMatch = average(paperMatches.map(entry => entry.score));
  const meanGrantMatch = average(grantMatches.map(entry => entry.score));
  const meanPatentMatch = average(patentMatches.map(entry => entry.score));
  const meanTrialMatch = average(trialMatches.map(entry => entry.score));
  const growth = measureTopicGrowth(topicPapers, context.now);
  if (context.coverage?.temporallyRepresentative === false || context.coverage?.atLimit?.includes("papers")) {
    growth.sufficient = false;
    growth.score = null;
    growth.reason = "Muestra temporal incompleta o estratificada; no permite estimar crecimiento.";
  }
  const topicGrowthValue = growth.score || 0;
  const proximityValue = proximityToBCC(topic, topicPapers);
  const fundingValue = fundingPresence(topicGrants, topicTrials);
  const painValue = technicalPainDetected(topicPapers);
  const activeInstitutionsValue = activeInstitutionsScore(topicPapers, topicGrants, topicTrials);
  const whiteSpaceValue = competitiveWhiteSpace(topicPapers, topicPatents);
  const openDataValue = openDataAvailability(topicPapers);
  const dataAvailabilityValue = dataAvailability(topicPapers, topicGrants, topicTrials);
  const clarityValue = clarityOfUseCase(topic, topicPapers, meanPaperMatch);
  const easeValue = easeOfContact(topicPapers, topicGrants, topicTrials, context.institutions);
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

  const meanMatchScore = average([meanPaperMatch, meanGrantMatch, meanPatentMatch, meanTrialMatch].filter(Boolean));
  const scores = {
    opportunityScore,
    actionabilityScore,
    confidenceScore: confidenceScore([...topicPapers, ...topicGrants, ...topicPatents, ...topicTrials], meanMatchScore)
  };

  const metrics = {
    meanPaperMatch,
    meanGrantMatch,
    meanPatentMatch,
    meanTrialMatch,
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
    trials: topicTrials,
    institutions
  }, scores, metrics, thresholds);

  breakdown.methodology = {
    version: "2.1", evaluatedAt: new Date(context.now).toISOString(),
    confidenceMeaning: "Completitud y coincidencia léxica de evidencia; no probabilidad de éxito.",
    growth,
    coverage: context.coverage || { bounded: true, limits: null },
    limitations: [
      "Muestra de fuentes indexadas; no mide el mercado completo ni valida científicamente los resultados.",
      "Cobertura competitiva desconocida; ausencia de patentes no demuestra espacio libre.",
      "Acceso abierto al artículo no demuestra disponibilidad de datasets ni licencia de reutilización.",
      ...(topicPapers.some(item => item.relevance.basis === "title-method-candidate") ? ["Incluye candidatas por método en el título; confirmar aplicación concreta y demanda antes de priorizar producto."] : []),
      ...(topicGrants.length ? ["Proyectos ya financiados; no son convocatorias abiertas ni confirman elegibilidad de BCC."] : []),
      ...(!growth.sufficient ? [growth.reason || "Crecimiento no establecido: faltan al menos 3 publicaciones en cada ventana de 45 días."] : [])
    ]
  };
  const candidates = [];
  const basePriority = opportunityScore * 0.45 + actionabilityScore * 0.35 + scores.confidenceScore * 0.2;

  if (topicPapers.length >= 2 && painValue >= 0.2 && opportunityScore >= thresholds.product.opportunity && proximityValue >= thresholds.product.proximity && meanPaperMatch >= thresholds.product.match) {
    candidates.push(buildSignal(`${topic.name}: Product opportunity`, "product_opportunity", topic, relatedLine, evidenceRefs, scores, institutions, breakdown, basePriority + 14));
  }
  if (growth.sufficient && topicGrowthValue >= thresholds.research.growth) {
    candidates.push(buildSignal(`${topic.name}: Emerging research trend`, "research_trend", topic, relatedLine, evidenceRefs, scores, institutions, breakdown, basePriority + 10));
  }
  if ((institutions.length >= thresholds.partnership.institutions || topicTrials.length || topicGrants.length) && actionabilityScore >= thresholds.partnership.actionability) {
    candidates.push(buildSignal(`${topic.name}: Partnership candidates`, "partnership", topic, relatedLine, evidenceRefs, scores, institutions, breakdown, basePriority + 8));
  }
  if (contentValue >= thresholds.content.contentPotential) {
    candidates.push(buildSignal(`${topic.name}: Content opportunity`, "content_idea", topic, relatedLine, evidenceRefs, scores, institutions, breakdown, basePriority + 7));
  }
  if (topicPatents.length >= thresholds.risk.minPatents) {
    candidates.push(buildSignal(`${topic.name}: Competitive watch`, "competitive_risk", topic, relatedLine, topicPatents.slice(0, 8).map(item => evidenceRef("patent", item)), scores, institutions, breakdown, basePriority + 6));
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
  const trials = Array.isArray(context.trials) ? context.trials : [];
  const institutions = Array.isArray(context.institutions) ? context.institutions : [];

  const signals = topics.flatMap(topic => buildSignalsForTopic(topic, {
    papers,
    grants,
    patents,
    trials,
    institutions,
    coverage: context.coverage,
    now: Number.isFinite(context.now) ? context.now : Date.now()
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
