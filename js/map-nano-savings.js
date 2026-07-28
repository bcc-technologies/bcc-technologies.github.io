(() => {
  const finite = (value, fallback = 0) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  };

  const nonNegative = (value, fallback = 0) => Math.max(0, finite(value, fallback));
  const percentage = value => Math.min(100, nonNegative(value));

  function normalizeInput(input = {}) {
    const operatingMonths = Math.min(12, Math.max(1, Math.round(finite(input.operatingMonths, 12))));
    return {
      planAnnualPrice: input.planAnnualPrice !== null && input.planAnnualPrice !== "" && Number.isFinite(Number(input.planAnnualPrice)) ? nonNegative(input.planAnnualPrice) : null,
      imagesPerMonth: nonNegative(input.imagesPerMonth, 50),
      operatingMonths,
      currentMinutesPerImage: nonNegative(input.currentMinutesPerImage, 40),
      mapsMinutesPerImage: nonNegative(input.mapsMinutesPerImage, 10),
      hourlyCost: nonNegative(input.hourlyCost, 25),
      annualReplaceableCosts: nonNegative(input.annualReplaceableCosts),
      includeRework: Boolean(input.includeRework),
      currentReworkRate: percentage(input.currentReworkRate),
      mapsReworkRate: percentage(input.mapsReworkRate),
      reworkMinutes: nonNegative(input.reworkMinutes)
    };
  }

  /**
   * Calculates a transparent MAP-Nano savings scenario. Values stay unrounded
   * here; presentation is responsible for practical rounding and formatting.
   */
  function calculate(input = {}) {
    const values = normalizeInput(input);
    const annualImages = values.imagesPerMonth * values.operatingMonths;
    const minutesSavedPerImage = values.currentMinutesPerImage - values.mapsMinutesPerImage;
    const baseHoursSaved = annualImages * minutesSavedPerImage / 60;
    const avoidedReworks = values.includeRework
      ? annualImages * (values.currentReworkRate - values.mapsReworkRate) / 100
      : 0;
    const reworkHoursSaved = values.includeRework ? avoidedReworks * values.reworkMinutes / 60 : 0;
    const annualHoursSaved = baseHoursSaved + reworkHoursSaved;
    const annualTimeValue = annualHoursSaved * values.hourlyCost;
    const annualGrossSavings = annualTimeValue + values.annualReplaceableCosts;
    const annualLicenseCost = values.planAnnualPrice;
    const annualNetSavings = annualLicenseCost === null ? null : annualGrossSavings - annualLicenseCost;
    const roiPercent = annualLicenseCost !== null && annualLicenseCost > 0 && annualNetSavings !== null
      ? annualNetSavings / annualLicenseCost * 100
      : null;
    const monthlyGrossSavings = annualGrossSavings / values.operatingMonths;
    const paybackMonths = annualLicenseCost !== null && annualLicenseCost > 0 && monthlyGrossSavings > 0
      ? annualLicenseCost / monthlyGrossSavings
      : null;
    const perImageValue = ((minutesSavedPerImage / 60) + (values.includeRework
      ? ((values.currentReworkRate - values.mapsReworkRate) / 100) * values.reworkMinutes / 60
      : 0)) * values.hourlyCost;
    const breakEvenImagesPerYear = annualLicenseCost !== null && perImageValue > 0
      ? Math.max(0, (annualLicenseCost - values.annualReplaceableCosts) / perImageValue)
      : null;
    const breakEvenImagesPerMonth = breakEvenImagesPerYear === null
      ? null
      : breakEvenImagesPerYear / values.operatingMonths;

    return Object.freeze({
      ...values,
      annualImages,
      minutesSavedPerImage,
      baseHoursSaved,
      avoidedReworks,
      reworkHoursSaved,
      annualHoursSaved,
      annualTimeValue,
      annualGrossSavings,
      annualLicenseCost,
      annualNetSavings,
      roiPercent,
      paybackMonths,
      breakEvenImagesPerYear,
      breakEvenImagesPerMonth
    });
  }

  function classify(result) {
    if (result.annualLicenseCost === null) return {
      tone: "neutral",
      grade: "quote",
      badge: "Requiere cotización",
      title: "Requiere cotización para estimar el retorno.",
      text: "El tiempo técnico estimado se muestra, pero el ahorro neto, ROI y recuperación dependen del precio institucional acordado."
    };
    if (result.annualNetSavings < 0) return {
      tone: "warning",
      grade: "negative",
      badge: "No se recupera",
      title: "El plan no se recupera con estos supuestos.",
      text: "Con este volumen y costo técnico, el valor económico estimado del tiempo ahorrado no cubre el costo anual de la licencia."
    };
    if (result.roiPercent <= 50) return {
      tone: "success",
      grade: "positive",
      badge: "Retorno positivo",
      title: "El retorno estimado es positivo, con un margen económico moderado.",
      text: "Conviene revisar los supuestos y confirmar que el plan cubra las capacidades operativas necesarias."
    };
    if (result.roiPercent <= 100) return {
      tone: "success",
      grade: "medium",
      badge: "Retorno medio",
      title: "El retorno estimado cubre la licencia con un margen intermedio.",
      text: "El resultado sigue dependiendo del flujo de trabajo real, la revisión técnica y los costos utilizados como supuesto."
    };
    if (result.roiPercent <= 200) return {
      tone: "success",
      grade: "high",
      badge: "Retorno alto",
      title: "El ahorro neto estimado iguala o supera el costo anual de la licencia.",
      text: "Es una estimación basada en el tiempo liberado; no constituye una garantía de ahorro ni de ingresos."
    };
    return {
      tone: "success",
      grade: "very-high",
      badge: "Retorno muy alto",
      title: "El ahorro neto estimado supera ampliamente el costo anual de la licencia.",
      text: "El costo anual es pequeño frente al tiempo técnico estimado, sin sustituir la revisión científica requerida."
    };
  }

  window.BCCMapNanoSavings = Object.freeze({ normalizeInput, calculate, classify });
})();
