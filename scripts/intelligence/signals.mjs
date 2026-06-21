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

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function toScore(value) {
  return Math.round(clamp01(value) * 100);
}

function normalizeText(value) {
  return cleanText(value, 40000).toLowerCase();
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

function evidenceRef(type, item) {
  return {
    type,
    id: String(item?.id || ""),
    title: cleanText(item?.title || item?.name || "", 240),
    sourceUrl: cleanText(item?.sourceUrl || item?.source_url || item?.website || "", 500)
  };
}

function topicKeywords(topic) {
  return [
    String(topic?.name || ""),
    ...(Array.isArray(topic?.keywords) ? topic.keywords : [])
  ].map(value => normalizeText(value)).filter(Boolean);
}

function paperMatchesTopic(paper, topic) {
  const haystack = [
    paper?.title,
    paper?.abstract,
    ...(paper?.topics || []),
    ...(paper?.keywords || [])
  ].map(normalizeText).join(" ");
  return topicKeywords(topic).some(keyword => keyword && haystack.includes(keyword));
}

function grantMatchesTopic(grant, topic) {
  const haystack = [
    grant?.title,
    grant?.abstract,
    grant?.program,
    grant?.agency,
    ...(grant?.topics || [])
  ].map(normalizeText).join(" ");
  return topicKeywords(topic).some(keyword => keyword && haystack.includes(keyword));
}

function patentMatchesTopic(patent, topic) {
  const haystack = [
    patent?.title,
    patent?.abstract,
    ...(patent?.topics || [])
  ].map(normalizeText).join(" ");
  return topicKeywords(topic).some(keyword => keyword && haystack.includes(keyword));
}

function uniqueInstitutions(papers, grants) {
  return [...new Set([
    ...papers.flatMap(item => Array.isArray(item?.institutions) ? item.institutions : []),
    ...grants.flatMap(item => Array.isArray(item?.institutions) ? item.institutions : [])
  ].map(value => cleanText(value, 200)).filter(Boolean))];
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
  const baseline = (previous / 3) || 1;
  return clamp01(recent / (baseline + 1));
}

function proximityToBCC(topic, papers) {
  const relatedLine = mapTopicToLine(topic);
  const keywords = LINE_KEYWORDS[relatedLine] || [];
  const haystack = [
    topic?.name,
    topic?.description,
    ...(topic?.keywords || []),
    ...papers.flatMap(item => [item?.title, item?.abstract, ...(item?.topics || []), ...(item?.keywords || [])])
  ].map(normalizeText).join(" ");
  const matches = keywords.filter(keyword => haystack.includes(normalizeText(keyword))).length;
  return clamp01(matches / Math.max(3, keywords.length));
}

function technicalPainDetected(papers) {
  const haystack = papers.map(item => [item?.title, item?.abstract].map(normalizeText).join(" ")).join(" ");
  const matches = PAIN_TERMS.filter(term => haystack.includes(term)).length;
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
  return clamp01(1 - (patents.length / Math.max(3, papers.length)));
}

function openDataAvailability(papers) {
  if (!papers.length) return 0;
  const open = papers.filter(item => item?.openAccessUrl || /dataset/i.test(String(item?.abstract || ""))).length;
  return clamp01(open / papers.length);
}

function dataAvailability(papers, grants) {
  const evidenceCount = papers.length + grants.length;
  return clamp01((evidenceCount / 6 + openDataAvailability(papers)) / 2);
}

function clarityOfUseCase(topic, papers) {
  const keywordHits = papers.filter(item => paperMatchesTopic(item, topic)).length;
  return clamp01((keywordHits / Math.max(1, papers.length)) * 0.7 + technicalPainDetected(papers) * 0.3);
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

function contentPotential(topic, papers) {
  if (!papers.length) return 0;
  const richEvidence = papers.filter(item => item?.abstract && item?.sourceUrl).length;
  return clamp01((richEvidence / papers.length) * 0.6 + clarityOfUseCase(topic, papers) * 0.4);
}

function confidenceScore(opportunityScore, actionabilityScore, evidenceCount) {
  return toScore(((opportunityScore / 100) * 0.45) + ((actionabilityScore / 100) * 0.35) + clamp01(evidenceCount / 6) * 0.20);
}

function buildRecommendedAction(signalType, topic, institutions) {
  const sampleInstitutions = institutions.slice(0, 3).join(", ");
  if (signalType === "product_opportunity") return `Preparar brief de producto para ${topic.name} y validar pain points con evidencia reciente.`;
  if (signalType === "research_trend") return `Monitorear ${topic.name} semanalmente y priorizar cobertura técnica/comercial.`;
  if (signalType === "partnership") return sampleInstitutions
    ? `Explorar acercamiento con ${sampleInstitutions} para colaboración o co-desarrollo.`
    : `Mapear instituciones activas en ${topic.name} para partnership scouting.`;
  if (signalType === "content_idea") return `Convertir ${topic.name} en artículo, demo o briefing comercial con evidencia enlazada.`;
  if (signalType === "competitive_risk") return `Revisar claims y posicionamiento en ${topic.name} frente a actividad competitiva detectada.`;
  if (signalType === "grant_opportunity") return `Cruzar ${topic.name} con grants activos para detectar ventanas de colaboración y funding.`;
  return `Revisar la evidencia de ${topic.name} y priorizar siguiente acción.`;
}

function buildSummary(signalType, topic, metrics) {
  const summaries = {
    product_opportunity: `La evidencia reciente en ${topic.name} sugiere una oportunidad de producto alineada a BCC con pain points técnicos visibles.`,
    research_trend: `La actividad reciente en ${topic.name} apunta a una tendencia científica emergente con suficiente densidad de evidencia.`,
    partnership: `Las instituciones activas en ${topic.name} sugieren oportunidades de partnership o colaboración técnica.`,
    content_idea: `El tema ${topic.name} tiene suficiente claridad y evidencia pública para convertirse en contenido técnico o comercial.`,
    competitive_risk: `La actividad detectada en ${topic.name} sugiere vigilar espacio competitivo y claims cercanos al problema.`,
    grant_opportunity: `La presencia de grants vinculados a ${topic.name} sugiere una oportunidad de funding o colaboración.`
  };
  return `${summaries[signalType]} Growth ${metrics.topicGrowthScore}, proximity ${metrics.proximityScore}, actionability ${metrics.actionabilityScore}.`;
}

function buildSignal(title, signalType, topic, relatedLine, evidenceRefs, scores, institutions) {
  return {
    title,
    summary: buildSummary(signalType, topic, scores),
    signalType,
    relatedLine,
    confidenceScore: scores.confidenceScore,
    opportunityScore: scores.opportunityScore,
    actionabilityScore: scores.actionabilityScore,
    evidenceCount: evidenceRefs.length,
    evidenceRefs,
    recommendedAction: buildRecommendedAction(signalType, topic, institutions),
    status: "new"
  };
}

function rankEvidence(topicPapers, topicGrants, topicPatents) {
  return [
    ...topicPapers.slice(0, 4).map(item => evidenceRef("paper", item)),
    ...topicGrants.slice(0, 2).map(item => evidenceRef("grant", item)),
    ...topicPatents.slice(0, 1).map(item => evidenceRef("patent", item))
  ].filter(item => item.id && item.title).slice(0, 6);
}

function buildSignalsForTopic(topic, context) {
  const topicPapers = context.papers.filter(item => paperMatchesTopic(item, topic));
  const topicGrants = context.grants.filter(item => grantMatchesTopic(item, topic));
  const topicPatents = context.patents.filter(item => patentMatchesTopic(item, topic));
  const institutions = uniqueInstitutions(topicPapers, topicGrants);
  const evidenceRefs = rankEvidence(topicPapers, topicGrants, topicPatents);
  if (!evidenceRefs.length) return [];

  const topicGrowthValue = topicGrowth(topicPapers);
  const proximityValue = proximityToBCC(topic, topicPapers);
  const fundingValue = fundingPresence(topicGrants);
  const painValue = technicalPainDetected(topicPapers);
  const activeInstitutionsValue = activeInstitutionsScore(topicPapers, topicGrants);
  const whiteSpaceValue = competitiveWhiteSpace(topicPapers, topicPatents);
  const openDataValue = openDataAvailability(topicPapers);
  const opportunityScore = toScore(
    0.25 * topicGrowthValue
    + 0.20 * proximityValue
    + 0.15 * fundingValue
    + 0.15 * painValue
    + 0.10 * activeInstitutionsValue
    + 0.10 * whiteSpaceValue
    + 0.05 * openDataValue
  );

  const dataAvailabilityValue = dataAvailability(topicPapers, topicGrants);
  const clarityValue = clarityOfUseCase(topic, topicPapers);
  const easeValue = easeOfContact(topicPapers, topicGrants, context.institutions);
  const compatibilityValue = compatibilityWithCurrentProduct(topic, topicPapers);
  const contentValue = contentPotential(topic, topicPapers);
  const actionabilityScore = toScore(
    (dataAvailabilityValue + clarityValue + easeValue + compatibilityValue + contentValue) / 5
  );

  const scores = {
    topicGrowthScore: toScore(topicGrowthValue),
    proximityScore: toScore(proximityValue),
    opportunityScore,
    actionabilityScore,
    confidenceScore: confidenceScore(opportunityScore, actionabilityScore, evidenceRefs.length)
  };

  const relatedLine = mapTopicToLine(topic);
  const signals = [];

  if (opportunityScore >= 60 && proximityValue >= 0.45) {
    signals.push(buildSignal(`${topic.name}: Product opportunity`, "product_opportunity", topic, relatedLine, evidenceRefs, scores, institutions));
  }
  if (topicGrowthValue >= 0.45 || topicPapers.length >= 3) {
    signals.push(buildSignal(`${topic.name}: Emerging research trend`, "research_trend", topic, relatedLine, evidenceRefs, scores, institutions));
  }
  if (institutions.length >= 3 && actionabilityScore >= 45) {
    signals.push(buildSignal(`${topic.name}: Partnership candidates`, "partnership", topic, relatedLine, evidenceRefs, scores, institutions));
  }
  if (contentValue >= 0.55) {
    signals.push(buildSignal(`${topic.name}: Content opportunity`, "content_idea", topic, relatedLine, evidenceRefs, scores, institutions));
  }
  if (topicPatents.length > 0 || (topicPapers.length >= 3 && whiteSpaceValue < 0.5)) {
    signals.push(buildSignal(`${topic.name}: Competitive watch`, "competitive_risk", topic, relatedLine, evidenceRefs, scores, institutions));
  }
  if (topicGrants.length > 0) {
    signals.push(buildSignal(`${topic.name}: Grant or collaboration window`, "grant_opportunity", topic, relatedLine, evidenceRefs, scores, institutions));
  }

  return signals.filter(signal => Array.isArray(signal.evidenceRefs) && signal.evidenceRefs.length > 0);
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
    if ((signal.opportunityScore + signal.actionabilityScore) > (current.opportunityScore + current.actionabilityScore)) {
      deduped.set(key, signal);
    }
  }

  return [...deduped.values()];
}
