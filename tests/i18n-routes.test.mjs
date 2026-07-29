import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { WORKSPACE_DASHBOARD_ASSETS } from "../scripts/workspace-assets.manifest.mjs";

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

function loadI18n(pathname = "/en/dashboard.html", lang = "en") {
  const context = {
    window: {},
    document: { documentElement: { lang } },
    location: { pathname }
  };
  vm.createContext(context);
  vm.runInContext(read("js/i18n.js"), context, { filename: "i18n.js" });
  return context.window.BCCI18n;
}

function loadMapNanoLocale(lang = "en") {
  const context = { window: {}, document: { documentElement: { lang } } };
  vm.createContext(context);
  vm.runInContext(read("js/map-nano-pricing-locale.js"), context, { filename: "map-nano-pricing-locale.js" });
  return context.window.BCCMapNanoLocale;
}

function loadMapNanoPlans(lang = "en") {
  const context = { window: {}, document: { documentElement: { lang } }, URLSearchParams, Intl };
  vm.createContext(context);
  vm.runInContext(read("js/map-nano-plans.js"), context, { filename: "map-nano-plans.js" });
  return context.window.BCCMapNanoPlans;
}

function loadWorkspaceLocale(lang = "en") {
  const context = {
    window: {},
    document: { documentElement: { lang }, addEventListener() {} }
  };
  vm.createContext(context);
  vm.runInContext(read("js/workspace/i18n.js"), context, { filename: "workspace-i18n.js" });
  return context.window.BCCWorkspaceI18n;
}

function loadMapContracts(lang = "en") {
  const context = { window: {}, document: { documentElement: { lang } } };
  vm.createContext(context);
  vm.runInContext(read("js/workspace/map-contracts.js"), context, { filename: "map-contracts.js" });
  return context.window.BCCWorkspaceMapContracts;
}

test("locale registry resolves only declared workspace and MAP-Nano counterparts", () => {
  const i18n = loadI18n();
  assert.equal(i18n.route("workspace.client", "en"), "/en/dashboard.html");
  assert.equal(i18n.route("workspace.staff", "en"), "/en/staff-dashboard.html");
  assert.equal(i18n.route("maps.nano.pricing", "en"), "/en/map-nano-pricing.html");
  assert.equal(i18n.routeForPath("/dashboard.html", "en"), "/en/dashboard.html");
  assert.equal(i18n.routeForPath("/en/staff-dashboard.html", "es"), "/staff-dashboard.html");
  assert.equal(i18n.routeForPath("/unknown.html", "en"), null);
});

test("English workspace and pricing entries are concrete, linked pages", () => {
  const client = read("en/dashboard.html");
  const staff = read("en/staff-dashboard.html");
  const pricing = read("en/map-nano-pricing.html");
  const product = read("en/product_maps_nano.html");

  [pricing].forEach(page => {
    assert.match(page, /<html lang="en">/);
    assert.match(page, /<base href="\/" \/>/);
    assert.match(page, /js\/i18n\.js/);
  });
  [client, staff].forEach(page => {
    assert.match(page, /<html lang="en">/);
    assert.match(page, /<base href="\/" \/>/);
  });
  assert.match(client, new RegExp(`${WORKSPACE_DASHBOARD_ASSETS.client.cssFile.replaceAll("/", "\\/").replaceAll(".", "\\.")}\\?v=[a-f0-9]{16}`));
  assert.match(staff, new RegExp(`${WORKSPACE_DASHBOARD_ASSETS.staff.cssFile.replaceAll("/", "\\/").replaceAll(".", "\\.")}\\?v=[a-f0-9]{16}`));
  assert.match(read(WORKSPACE_DASHBOARD_ASSETS.client.scriptFile), /\/\* Source: js\/i18n\.js \*\//);
  assert.match(read(WORKSPACE_DASHBOARD_ASSETS.staff.scriptFile), /\/\* Source: js\/i18n\.js \*\//);
  assert.match(pricing, /data-map-nano-pricing/);
  assert.match(pricing, /js\/map-nano-pricing-locale\.js/);
  assert.match(product, /href="\/en\/map-nano-pricing\.html"/);
});

test("authentication and language preference use the route registry for workspace entries", () => {
  const [auth, prefs, client, staff, pricing, englishLogin] = [
    read("js/auth.js"), read("js/prefs.js"), read("dashboard.html"), read("staff-dashboard.html"), read("map-nano-pricing.html"), read("en/login.html")
  ];
  assert.match(auth, /BCCI18n\?\.workspaceRouteForUser/);
  assert.match(prefs, /BCCI18n\?\.routeForPath/);
  [client, staff, pricing].forEach(page => {
    assert.match(page, /hreflang="en"/);
    assert.match(page, /name="bcc-lang-targets" content="es,en"/);
  });
  assert.ok(englishLogin.indexOf("/js/i18n.js") < englishLogin.indexOf("/js/auth.js"));
});

test("client and staff dashboards expose a route-aware language switch", () => {
  const pages = ["dashboard.html", "staff-dashboard.html", "en/dashboard.html", "en/staff-dashboard.html"].map(read);
  pages.forEach(page => assert.match(page, /data-language-switch/));

  const prefs = read("js/prefs.js");
  assert.match(prefs, /function updateLanguageSwitches\(\)/);
  assert.match(prefs, /resolveLangTarget\(target\)/);
  assert.match(prefs, /window\.location\.search\}\$\{window\.location\.hash\}/);
});

test("legacy MAP routes delegate to the canonical localized MAP-Nano pricing surface", () => {
  const spanish = read("MAP.html");
  const english = read("en/MAP.html");
  const redirect = read("js/legacy-route.js");

  assert.match(spanish, /data-bcc-legacy-route="maps\.nano\.pricing"/);
  assert.match(spanish, /url=\/map-nano-pricing\.html/);
  assert.match(english, /data-bcc-legacy-route="maps\.nano\.pricing"/);
  assert.match(english, /url=\/en\/map-nano-pricing\.html/);
  assert.doesNotMatch(english, /Licencia Estándar|Preguntas Frecuentes/);
  assert.match(redirect, /BCCI18n\?\.route\?\.\(routeId, locale\)/);
  assert.match(redirect, /window\.location\.replace\(next\)/);
});

test("MAP-Nano English pricing covers calculator, return copy, plan details, and contact routing", () => {
  const locale = loadMapNanoLocale();
  const Spanish = [
    "Calcula el retorno según tu flujo de trabajo",
    "Muestras analizadas por mes",
    "Costos anuales realmente sustituibles (USD)",
    "Una estimación, no una promesa",
    "En laboratorios con flujo regular de análisis, el ahorro de tiempo técnico puede compensar total o parcialmente el costo de la licencia. El resultado depende del volumen de imágenes, los procedimientos actuales y el nivel de revisión requerido.",
    "MAP-Nano no reemplaza el microscopio ni elimina la revisión técnica. Reduce trabajo repetitivo y ayuda a estandarizar el análisis.",
    "Todo lo incluido en Professional",
    "Licencias flotantes y varios departamentos o sedes",
    "necesitan registros de auditoría"
  ];
  const translated = locale.markup(Spanish.join("\n"));

  assert.match(translated, /Calculate the return for your workflow/);
  assert.match(translated, /Samples analysed per month/);
  assert.match(translated, /Truly replaceable annual costs/);
  assert.match(translated, /An estimate, not a promise/);
  assert.match(translated, /technical time savings can partially or fully offset the license cost/);
  assert.match(translated, /does not replace the microscope or eliminate technical review/);
  assert.match(translated, /Everything included in Professional/);
  assert.match(translated, /Floating licenses across departments or sites/);
  assert.match(translated, /audit logs are needed/);

  assert.match(loadMapNanoPlans().requestUrl("essential"), /^\/en\/contactUs\.html\?/);
  assert.match(loadMapNanoPlans("es").requestUrl("essential"), /^\/contactUs\.html\?/);
});

test("English staff workspace covers static, deferred, operational, and error copy", () => {
  const locale = loadWorkspaceLocale();
  const Spanish = [
    "Activar notificaciones",
    "Vista como",
    "Crear rol personalizado",
    "Sin actividad medible todavía",
    "MAP-Nano · gestión comercial",
    "Guardar revisión",
    "Último contacto",
    "No tienes permiso para realizar esta acción.",
    "La cola está ordenada para revisión humana. Empieza por señales con mejor combinación de oportunidad, actionability y confidence."
  ];
  const translated = locale.markup(Spanish.join("\n"));

  assert.match(translated, /Enable notifications/);
  assert.match(translated, /View as/);
  assert.match(translated, /Create custom role/);
  assert.match(translated, /No measurable activity yet/);
  assert.match(translated, /MAP-Nano · commercial management/);
  assert.match(translated, /Save review/);
  assert.match(translated, /Last contact/);
  assert.match(translated, /do not have permission to perform this action/);
  assert.match(translated, /ordered for human review/);
});

test("MAP platform CTAs use localized contact context rather than dead links or self-loops", () => {
  const spanish = read("product_maps.html");
  const english = read("en/product_maps.html");
  const contactContext = read("js/contact-context.js");

  [spanish, english].forEach(page => {
    assert.doesNotMatch(page, /contactUs-demo=1/);
    assert.doesNotMatch(page, /product_maps(?:\.html)?#map-(?:bio|ing|med)/);
  });
  assert.match(spanish, /href="\/contactUs\.html\?product=map-nano&amp;intent=evaluation&amp;license_type=evaluation">Solicitar evaluación<\/a>/);
  assert.match(english, /href="\/en\/contactUs\.html\?product=map-nano&amp;intent=evaluation&amp;license_type=evaluation">Request an evaluation<\/a>/);
  assert.match(spanish, /href="\/contactUs\.html\?product=map-bio&amp;intent=demo"/);
  assert.match(english, /href="\/en\/contactUs\.html\?product=map-med&amp;intent=demo"/);
  assert.match(contactContext, /"map-ing": "MAP-Ing"/);
});

test("MAP license catalogs, states, links, and dynamic workspace copy are native English", () => {
  const plans = loadMapNanoPlans();
  const contracts = loadMapContracts();
  const locale = loadWorkspaceLocale();
  const module = read("js/workspace/client-map-licenses.js");
  const renderedCopy = locale.markup([
    "Sin acceso vigente",
    "Planes de MAP-Nano",
    "Comparar planes en detalle",
    "Capacidades habilitadas",
    "Gestionar plazas",
    "Solicitud comercial",
    "Solicitar un nuevo miembro"
  ].join("\n"));

  assert.equal(plans.planById("essential").description, "For individual research and small laboratories with moderate use.");
  assert.equal(plans.planById("professional").badge, "Recommended");
  assert.equal(plans.priceLabel(plans.planById("essential")), "US$1,200/year");
  assert.match(plans.projectPriceLabel(), /per project/);
  assert.equal(contracts.licenseType("evaluation").label, "Guided evaluation");
  assert.equal(contracts.productCatalog("map.nano").productHref, "/en/product_maps_nano.html");
  assert.equal(contracts.productCatalog("map.bio").requestHref, "/en/contactUs.html?product=map-bio&intent=license");
  assert.equal(contracts.toLicenseViewModel({ product_key: "map.nano", license_status: "active" }).statusMeta.label, "Active");
  assert.equal(contracts.platformAccessLabel("platform.licenses.manage"), "License management");
  assert.match(renderedCopy, /No active access/);
  assert.match(renderedCopy, /MAP-Nano plans/);
  assert.match(renderedCopy, /Compare plans in detail/);
  assert.match(renderedCopy, /Enabled capabilities/);
  assert.match(renderedCopy, /Manage seats/);
  assert.match(renderedCopy, /Commercial request/);
  assert.match(renderedCopy, /Request a new member/);
  assert.doesNotMatch(renderedCopy, /vigente|Licencias|solicitud/i);
  assert.match(module, /No active access/);
  assert.match(module, /\/en\/map-nano-pricing\.html/);
});

test("MAP-Nano English copy covers comparison capabilities and every FAQ", () => {
  const locale = loadMapNanoLocale();
  const Spanish = [
    "Tamaño, distribución, porosidad, forma, geometría y calibración de escala.",
    "Genera informes y exportaciones profesionales.",
    "¿La licencia se factura mensualmente o anualmente?",
    "¿Los datos permanecen bajo control del laboratorio?",
    "¿Facility e Institutional pueden comprarse directamente?"
  ];
  const translated = locale.markup(Spanish.join("\n"));

  assert.match(translated, /Size, distribution, porosity, shape, geometry, and scale calibration\./);
  assert.match(translated, /Generate professional reports and exports\./);
  assert.match(translated, /Is the license billed monthly or annually\?/);
  assert.match(translated, /Do the data remain under the laboratory's control\?/);
  assert.match(translated, /Can Facility and Institutional be purchased directly\?/);
  assert.doesNotMatch(translated, /Tamaño, distribución|¿La licencia se factura|¿Los datos permanecen/);
});
