import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

function loadSavings() {
  const context = { window: {}, Number, Math, Object, Boolean, String, Infinity };
  vm.createContext(context);
  vm.runInContext(read("js/map-nano-savings.js"), context, { filename: "map-nano-savings.js" });
  return context.window.BCCMapNanoSavings;
}

function loadCatalog() {
  const context = { window: {}, Intl, URLSearchParams, Object, Number, String, Array, Date, RegExp };
  vm.createContext(context);
  vm.runInContext(read("js/map-nano-plans.js"), context, { filename: "map-nano-plans.js" });
  return context.window.BCCMapNanoPlans;
}

const professionalScenario = (catalog = loadCatalog()) => ({
  planAnnualPrice: catalog.planById("professional").annualPrice,
  imagesPerMonth: 50,
  operatingMonths: 12,
  currentMinutesPerImage: 40,
  mapsMinutesPerImage: 10,
  hourlyCost: 25
});

test("Professional baseline derives the documented, unrounded savings scenario", () => {
  const result = loadSavings().calculate(professionalScenario());
  assert.equal(result.annualImages, 600);
  assert.equal(result.minutesSavedPerImage, 30);
  assert.equal(result.annualHoursSaved, 300);
  assert.equal(result.annualGrossSavings, 7500);
  assert.equal(result.annualLicenseCost, 3000);
  assert.equal(result.annualNetSavings, 4500);
  assert.equal(result.roiPercent, 150);
  assert.equal(result.paybackMonths, 4.8);
  assert.equal(result.breakEvenImagesPerYear, 240);
  assert.equal(result.breakEvenImagesPerMonth, 20);
});

test("zero volume and no time difference remain valid negative scenarios without NaN", () => {
  const savings = loadSavings();
  const zeroVolume = savings.calculate({ ...professionalScenario(), imagesPerMonth: 0 });
  assert.equal(zeroVolume.annualGrossSavings, 0);
  assert.equal(zeroVolume.annualNetSavings, -3000);
  assert.equal(zeroVolume.paybackMonths, null);
  assert.equal(zeroVolume.breakEvenImagesPerMonth, 20);

  const noDifference = savings.calculate({ ...professionalScenario(), mapsMinutesPerImage: 40 });
  assert.equal(noDifference.annualGrossSavings, 0);
  assert.equal(noDifference.roiPercent, -100);
  assert.equal(noDifference.paybackMonths, null);
  assert.equal(noDifference.breakEvenImagesPerMonth, null);
});

test("slower MAP-Nano and zero hourly cost are represented honestly", () => {
  const savings = loadSavings();
  const slower = savings.calculate({ ...professionalScenario(), mapsMinutesPerImage: 50 });
  assert.equal(slower.annualHoursSaved, -100);
  assert.equal(slower.annualNetSavings, -5500);
  assert.equal(slower.paybackMonths, null);
  assert.equal(savings.classify(slower).tone, "warning");
  assert.equal(savings.classify(slower).grade, "negative");

  const zeroCost = savings.calculate({ ...professionalScenario(), hourlyCost: 0 });
  assert.equal(zeroCost.annualGrossSavings, 0);
  assert.equal(zeroCost.paybackMonths, null);
  assert.equal(zeroCost.breakEvenImagesPerMonth, null);
});

test("diagnostic grades follow the defined positive, medium, high, and very-high return scale", () => {
  const { classify } = loadSavings();
  assert.equal(classify({ annualLicenseCost: null }).grade, "quote");
  assert.equal(classify({ annualLicenseCost: 1000, annualNetSavings: 100, roiPercent: 10 }).grade, "positive");
  assert.equal(classify({ annualLicenseCost: 1000, annualNetSavings: 750, roiPercent: 75 }).grade, "medium");
  assert.equal(classify({ annualLicenseCost: 1000, annualNetSavings: 1500, roiPercent: 150 }).grade, "high");
  assert.equal(classify({ annualLicenseCost: 1000, annualNetSavings: 3000, roiPercent: 300 }).grade, "very-high");
});

test("prices are supplied by the centralized plan catalog and Institutional remains quote-based", () => {
  const savings = loadSavings();
  const catalog = loadCatalog();
  const essential = savings.calculate({ ...professionalScenario(catalog), planAnnualPrice: catalog.planById("essential").annualPrice });
  const facility = savings.calculate({ ...professionalScenario(catalog), planAnnualPrice: catalog.planById("facility").annualPrice });
  const institutional = savings.calculate({ ...professionalScenario(catalog), planAnnualPrice: null });
  assert.equal(essential.annualLicenseCost, 1200);
  assert.equal(facility.annualLicenseCost, 6000);
  assert.equal(institutional.annualLicenseCost, null);
  assert.equal(institutional.annualNetSavings, null);
  assert.equal(institutional.roiPercent, null);
  assert.equal(institutional.paybackMonths, null);
});

test("optional rework and replaceable costs only contribute when explicitly enabled or entered", () => {
  const savings = loadSavings();
  const ignored = savings.calculate({ ...professionalScenario(), currentReworkRate: 20, mapsReworkRate: 5, reworkMinutes: 30 });
  assert.equal(ignored.reworkHoursSaved, 0);
  const included = savings.calculate({ ...professionalScenario(), includeRework: true, currentReworkRate: 20, mapsReworkRate: 5, reworkMinutes: 30, annualReplaceableCosts: 500 });
  assert.equal(included.avoidedReworks, 90);
  assert.equal(included.reworkHoursSaved, 45);
  assert.equal(included.annualGrossSavings, 9125);
  assert.equal(included.annualNetSavings, 6125);
});

test("public calculator integrates the shared domain module, commercial context, and accessible controls", () => {
  const [page, pricing, calculator, contact, styles, components] = [
    read("map-nano-pricing.html"), read("js/map-nano-pricing.js"), read("js/map-nano-savings-calculator.js"), read("js/contact-context.js"), read("css/pages/map-nano-pricing.css"), read("css/03-components.css")
  ];
  assert.match(page, /js\/map-nano-savings\.js/);
  assert.match(page, /js\/map-nano-savings-calculator\.js/);
  assert.match(pricing, /data-map-nano-savings-calculator/);
  assert.match(pricing, /savings-calculator/);
  assert.doesNotMatch(pricing, /map-pricing-faq-disclaimer/);
  assert.match(calculator, /map-savings-estimate-note/);
  assert.match(calculator, /data-savings-diagnostics/);
  assert.match(calculator, /data-savings-diagnostic-badges/);
  assert.match(calculator, /function capacityRecommendation/);
  assert.match(calculator, /evaluatedPlanName/);
  assert.match(calculator, /data-savings-use-recommendation/);
  assert.match(calculator, /savings_calculator_recommended_plan_selected/);
  assert.match(calculator, /Puedes recalcular este escenario con ese nivel antes de solicitarlo/);
  assert.match(calculator, /Solicitar \$\{plan\?\.name\.replace/);
  assert.match(calculator, /data-savings-advanced="assumptions"/);
  assert.match(calculator, /data-savings-advanced="operations"/);
  assert.match(calculator, /catalog\.PLANS/);
  assert.match(calculator, /savings_calculator_result_generated/);
  assert.match(calculator, /savings_calculator_quote_requested/);
  assert.match(calculator, /savings_calculator_shared/);
  assert.match(calculator, /type="number"/);
  assert.match(calculator, /aria-live="polite"/);
  assert.match(calculator, /class="map-savings-help"/);
  assert.match(calculator, /role="tooltip"/);
  assert.match(calculator, /const resultMetric/);
  assert.match(contact, /savings_estimate_source/);
  assert.match(styles, /\.map-savings-calculator/);
  assert.match(styles, /\.map-savings-layout\{[\s\S]*?gap: 0;[\s\S]*?border: 1px solid var\(--line\);/);
  assert.match(styles, /\.map-savings-results\{[\s\S]*?border-left: 1px solid var\(--line\);/);
  assert.match(styles, /\.map-savings-form\{[\s\S]*?border: 0;/);
  assert.match(styles, /\.map-savings-advanced\[open\]\{/);
  assert.match(styles, /\.map-savings-advanced > summary::before/);
  assert.match(styles, /\.map-savings-result-grid article\{[\s\S]*?border: 0;[\s\S]*?background: transparent;/);
  assert.match(styles, /\.map-savings-result-grid article:nth-child\(even\)\{/);
  assert.match(styles, /\.map-savings-diagnostic-badge\.is-very-high/);
  assert.match(styles, /\.map-savings-diagnostics-body/);
  assert.match(styles, /\.map-savings-help-tooltip/);
  assert.match(components, /\.btn-primary:hover\{\s*color: var\(--accent-ink\);/);
  assert.match(styles, /@media \(max-width: 720px\)/);
});
