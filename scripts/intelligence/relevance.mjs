import { configuredTopicTerms, containsPhrase, lexicalMatchScore, scientificMatchValues } from "./matching.mjs";

// Narrow title-level fallbacks retain discovery leads whose terminology differs
// from configured search phrases. They do not establish product demand.
const TITLE_METHODS = {
  nano: ["scanning electron microscopy", "transmission electron microscopy", "SEM image", "TEM image", "surface morphology analysis", "microstructure analysis", "particle size analysis", "porosity analysis", "grain boundary detection"],
  bio: ["cell counting", "cell tracking", "cell segmentation", "diatom classification", "biological image analysis"],
  med: ["histopathology image analysis", "tissue segmentation", "cytology image analysis", "blood smear analysis"],
  ing: ["crack detection", "porosity analysis", "surface morphology analysis", "fractal analysis", "fractal technology"],
  general: ["automated microscopy", "laboratory automation", "scientific image analysis"]
};

export function paperRelevance(item, topic) {
  const values = scientificMatchValues(item);
  const terms = configuredTopicTerms(topic);
  const score = lexicalMatchScore(values, terms);
  if (score) return { score, basis: "configured-term", terms: terms.filter(term => lexicalMatchScore(values, [term])) };
  const category = String(topic?.category || "general").toLowerCase();
  const title = values[0];
  const matches = (TITLE_METHODS[category] || []).filter(term => containsPhrase(title, term));
  // Fractal methods in unrelated domains do not become engineering leads.
  const engineeringContext = category !== "ing" || ["concrete", "cement", "cementitious", "soil", "coating", "corrosion", "material"]
    .some(term => containsPhrase(title, term));
  if (matches.length && engineeringContext) return { score: 0.5, basis: "title-method-candidate", terms: matches };
  return { score: 0, basis: "no-supported-match", terms: [] };
}
