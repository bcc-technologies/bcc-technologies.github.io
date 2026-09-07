// Lexical relevance, deliberately not a semantic or scientific validation model.
export function normalizedWords(value) {
  return String(value || "").toLowerCase().normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

export function containsPhrase(value, phrase) {
  const term = normalizedWords(phrase);
  return Boolean(term && (` ${normalizedWords(value)} `).includes(` ${term} `));
}

export function lexicalMatchScore(values, terms) {
  // Keep fields/sentences separate: unrelated words spread over an abstract
  // or across provider keywords must not assemble a matching phrase.
  const passages = values.filter(Boolean).flatMap(value => String(value).split(/[.!?;\n]+/))
    .map(normalizedWords).filter(Boolean);
  let best = 0;
  for (const term of terms) {
    const words = [...new Set(normalizedWords(term).split(" ").filter(Boolean))];
    for (const passage of passages) {
      if (containsPhrase(passage, term)) best = Math.max(best, 1);
      else if (words.length >= 3) {
        const tokens = passage.split(" ");
        const width = words.length + 3;
        for (let start = 0; start < tokens.length; start++) {
          const window = new Set(tokens.slice(start, start + width));
          const hits = words.filter(word => window.has(word)).length;
          if (hits >= 3 && hits / words.length >= 0.8) best = Math.max(best, 0.5);
        }
      }
    }
  }
  return best;
}

export function scientificMatchValues(item) {
  // CCK-8 is a colorimetric viability assay, not image-based cell counting.
  // Remove only this named assay, preserving independent image-counting claims.
  return [item?.title, item?.abstract, ...(item?.keywords || [])].map(value =>
    String(value || "").replace(/\bcell[\s-]+counting[\s-]+kit[\s-]*8\b/gi, "CCK8 viability assay"));
}

export function configuredTopicTerms(topic) {
  const keywords = (Array.isArray(topic?.keywords) ? topic.keywords : []).filter(value => normalizedWords(value));
  // Portfolio labels are not scientific concepts (e.g. "General" in "AGI").
  const name = String(topic?.name || "");
  return keywords.length ? keywords : /^(general|map[\s-]*(nano|bio|med|ing))$/i.test(name.trim()) ? [] : [name];
}
