(() => {
  function scoreSignal(signal = {}, source = {}, institution = {}) {
    // TODO: Replace mock scoring with weighted keyword, sector, institution,
    // procurement value, scientific proximity, recency and actionability signals.
    const base = Number(signal.relevanceScore || 0);
    const sourceBoost = source.strategicValue === "high" ? 8 : source.strategicValue === "medium" ? 4 : 0;
    const institutionBoost = institution.relevanceToBCC === "high" ? 8 : institution.relevanceToBCC === "medium" ? 4 : 0;
    return Math.min(100, Math.round(base + sourceBoost + institutionBoost));
  }

  window.BCCDominicanScoring = { scoreSignal };
})();
