import {
  cleanArray,
  cleanText,
  normalizeArxivId,
  normalizeInstitutionName,
  normalizePersonName,
  normalizeTag,
  normalizeTitle,
  safeUrl,
  stripDoiUrl,
  titleFingerprint
} from "./connectors/base.mjs";

const POSSIBLE_DUPLICATE_THRESHOLD = 0.88;

function dedupeKey(item) {
  const doi = stripDoiUrl(item?.doi || "");
  if (doi) return `doi:${doi.toLowerCase()}`;

  const arxivId = normalizeArxivId(item?.arxivId || "");
  if (arxivId) return `arxiv:${arxivId.toLowerCase()}`;

  const sourceType = cleanText(item?.sourceType || "", 80).toLowerCase();
  const externalId = cleanText(item?.externalId || "", 200).toLowerCase();
  if (sourceType && externalId) return `external:${sourceType}:${externalId}`;

  return "";
}

function tokenSet(text) {
  return new Set(titleFingerprint(text).split(" ").filter(Boolean));
}

function titleSimilarity(left, right) {
  const leftKey = titleFingerprint(left);
  const rightKey = titleFingerprint(right);
  if (!leftKey || !rightKey) return 0;
  if (leftKey === rightKey) return 1;

  const leftTokens = tokenSet(leftKey);
  const rightTokens = tokenSet(rightKey);
  if (!leftTokens.size || !rightTokens.size) return 0;

  let intersection = 0;
  leftTokens.forEach(token => {
    if (rightTokens.has(token)) intersection += 1;
  });
  const union = new Set([...leftTokens, ...rightTokens]).size || 1;
  return intersection / union;
}

function normalizePaperForMerge(item) {
  return {
    ...item,
    doi: stripDoiUrl(item?.doi || ""),
    arxivId: normalizeArxivId(item?.arxivId || ""),
    title: normalizeTitle(item?.title || "", 600),
    authors: cleanArray((item?.authors || []).map(author => normalizePersonName(author, 200)), 128, 200),
    institutions: cleanArray((item?.institutions || []).map(institution => normalizeInstitutionName(institution, 200)), 128, 200),
    topics: cleanArray((item?.topics || []).map(topic => normalizeTag(topic, 120)), 64, 120),
    keywords: cleanArray((item?.keywords || []).map(keyword => normalizeTag(keyword, 120)), 128, 120),
    sourceUrl: safeUrl(item?.sourceUrl || "", 500),
    openAccessUrl: safeUrl(item?.openAccessUrl || "", 500)
  };
}

function mergeItems(baseItem, nextItem) {
  const base = normalizePaperForMerge(baseItem);
  const next = normalizePaperForMerge(nextItem);

  return {
    ...base,
    ...next,
    doi: base.doi || next.doi || "",
    arxivId: base.arxivId || next.arxivId || "",
    title: base.title || next.title || "",
    abstract: cleanText(
      String(base.abstract || "").length >= String(next.abstract || "").length
        ? base.abstract
        : next.abstract,
      40000
    ),
    authors: cleanArray([...(base.authors || []), ...(next.authors || [])], 128, 200),
    institutions: cleanArray([...(base.institutions || []), ...(next.institutions || [])], 128, 200),
    topics: cleanArray([...(base.topics || []), ...(next.topics || [])], 64, 120),
    keywords: cleanArray([...(base.keywords || []), ...(next.keywords || [])], 128, 120),
    citationsCount: Math.max(Number(base.citationsCount) || 0, Number(next.citationsCount) || 0),
    sourceUrl: base.sourceUrl || next.sourceUrl || "",
    openAccessUrl: base.openAccessUrl || next.openAccessUrl || "",
    rawData: {
      merged: true,
      sources: cleanArray(
        [
          base.sourceName || "",
          next.sourceName || "",
          ...(base.rawData?.sources || []),
          ...(next.rawData?.sources || [])
        ],
        16,
        120
      ),
      records: [
        ...(Array.isArray(base.rawData?.records) ? base.rawData.records : [base.rawData || {}]),
        ...(Array.isArray(next.rawData?.records) ? next.rawData.records : [next.rawData || {}])
      ].slice(0, 8)
    }
  };
}

function possibleDuplicatePayload(item, candidate, similarity) {
  return {
    externalId: cleanText(candidate?.externalId || "", 200),
    sourceType: cleanText(candidate?.sourceType || "", 80),
    title: cleanText(candidate?.title || "", 600),
    similarity: Number(similarity.toFixed(3)),
    reason: similarity === 1 ? "normalized_title_exact_match" : "normalized_title_near_match"
  };
}

export function dedupeItems(items = []) {
  const merged = new Map();
  const passthrough = [];

  for (const original of Array.isArray(items) ? items : []) {
    const item = normalizePaperForMerge(original);
    const key = dedupeKey(item);
    if (!key) {
      passthrough.push(item);
      continue;
    }
    if (!merged.has(key)) {
      merged.set(key, item);
      continue;
    }
    merged.set(key, mergeItems(merged.get(key), item));
  }

  return [...merged.values(), ...passthrough].filter(item => cleanText(item?.title || "", 600));
}

export function annotatePossibleDuplicates(items = []) {
  const list = (Array.isArray(items) ? items : []).map(item => ({
    ...normalizePaperForMerge(item),
    possibleDuplicates: Array.isArray(item?.possibleDuplicates) ? item.possibleDuplicates.slice(0, 8) : []
  }));

  for (let index = 0; index < list.length; index += 1) {
    const current = list[index];
    const currentKey = titleFingerprint(current.title || "");
    if (!currentKey) continue;

    for (let compareIndex = index + 1; compareIndex < list.length; compareIndex += 1) {
      const candidate = list[compareIndex];
      const similarity = titleSimilarity(current.title || "", candidate.title || "");
      if (similarity < POSSIBLE_DUPLICATE_THRESHOLD) continue;

      const currentDuplicate = possibleDuplicatePayload(current, candidate, similarity);
      const candidateDuplicate = possibleDuplicatePayload(candidate, current, similarity);

      current.possibleDuplicates = cleanArrayPayloads([...(current.possibleDuplicates || []), currentDuplicate], 8);
      candidate.possibleDuplicates = cleanArrayPayloads([...(candidate.possibleDuplicates || []), candidateDuplicate], 8);
      list[index] = current;
      list[compareIndex] = candidate;
    }
  }

  return list;
}

function cleanArrayPayloads(values, maxItems = 8) {
  const seen = new Set();
  const items = [];
  for (const value of Array.isArray(values) ? values : []) {
    const payload = value && typeof value === "object" ? value : {};
    const key = [
      cleanText(payload.sourceType || "", 80).toLowerCase(),
      cleanText(payload.externalId || "", 200).toLowerCase(),
      titleFingerprint(payload.title || "")
    ].join("|");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    items.push(payload);
    if (items.length >= maxItems) break;
  }
  return items;
}

export function findPossibleDuplicateCandidates(item, candidates = []) {
  const normalized = normalizePaperForMerge(item);
  return cleanArrayPayloads(
    (Array.isArray(candidates) ? candidates : [])
      .map(candidate => {
        const similarity = titleSimilarity(normalized.title || "", candidate?.title || "");
        if (similarity < POSSIBLE_DUPLICATE_THRESHOLD) return null;
        return possibleDuplicatePayload(normalized, candidate, similarity);
      })
      .filter(Boolean),
    8
  );
}
