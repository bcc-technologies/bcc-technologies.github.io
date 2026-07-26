(() => {
  const LICENSE_TYPES = {
    named_user: "usuario individual",
    organization: "equipo u organización",
    evaluation: "evaluación guiada"
  };

  const PRODUCTS = {
    "map.nano": "MAP Nano",
    "map-nano": "MAP Nano",
    "map.bio": "MAP Bio",
    "map-bio": "MAP Bio",
    "map.med": "MAP Med",
    "map-med": "MAP Med"
  };

  function init() {
    const params = new URLSearchParams(window.location.search);
    const productKey = params.get("product") || "";
    const intent = params.get("intent") || "";
    const licenseType = params.get("license_type") || "";
    if (!productKey && !intent && !licenseType) return;

    const form = document.querySelector('form[action*="formspree.io"]');
    if (!form) return;

    const isEnglish = window.location.pathname.startsWith("/en/");
    const product = PRODUCTS[productKey] || productKey.replace(/[._-]+/g, " ").trim();
    const licenseTypeLabel = LICENSE_TYPES[licenseType] || licenseType.replace(/[_-]+/g, " ").trim();
    const subject = form.querySelector('select[name="subject"]');
    const message = form.querySelector('textarea[name="message"]');

    addHiddenField(form, "intent", intent || "contact");
    if (product) addHiddenField(form, "product", product);
    if (licenseType) addHiddenField(form, "license_type", licenseType);

    if (subject && product) {
      const option = document.createElement("option");
      option.value = `License request: ${product}${licenseTypeLabel ? ` · ${licenseTypeLabel}` : ""}`;
      option.textContent = isEnglish
        ? `License for ${product}${licenseTypeLabel ? ` · ${licenseTypeLabel}` : ""}`
        : `Licencia para ${product}${licenseTypeLabel ? ` · ${licenseTypeLabel}` : ""}`;
      option.selected = true;
      subject.append(option);
    }

    if (message && product && !message.value.trim()) {
      message.value = isEnglish
        ? `I would like information about licensing ${product}${licenseTypeLabel ? ` (${licenseTypeLabel})` : ""}.`
        : `Me gustaría recibir información sobre una licencia de ${product}${licenseTypeLabel ? ` (${licenseTypeLabel})` : ""}.`;
    }
  }

  function addHiddenField(form, name, value) {
    if (!value || form.elements.namedItem(name)) return;
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.append(input);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
