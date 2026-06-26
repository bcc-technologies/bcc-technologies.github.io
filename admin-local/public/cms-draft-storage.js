(function (root) {
  function slugifyStorageIdentity(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "anonymous";
  }

  function getCmsStorageNamespace(user = null) {
    const candidate = [
      user?.id,
      user?.user?.id,
      user?.email,
      user?.user?.email,
      user?.name,
      user?.displayName,
      user?.display_name,
      user?.user?.user_metadata?.full_name,
      user?.user?.user_metadata?.name
    ].find(value => String(value || "").trim());

    const resolved = String(candidate || "").trim();
    return resolved ? `bccAdmin:${slugifyStorageIdentity(resolved)}` : "bccAdmin:anonymous";
  }

  function buildCmsStorageKey(prefix, key = "", user = null) {
    const namespace = getCmsStorageNamespace(user);
    const suffix = prefix ? `${prefix}${key}` : String(key || "");
    return `${namespace}:${suffix}`;
  }

  const api = {
    slugifyStorageIdentity,
    getCmsStorageNamespace,
    buildCmsStorageKey
  };

  if (root) {
    root.CmsDraftStorage = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
