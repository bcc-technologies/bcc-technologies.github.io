import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(root, "shared", "access-contracts.json");
const browserPath = path.join(root, "js", "access-contracts.js");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const check = process.argv.includes("--check");

const browserSource = `/* Generated from shared/access-contracts.json. Do not edit directly. */
(() => {
  const manifest = ${JSON.stringify(manifest, null, 2)};

  const permissionsFor = records => Object.fromEntries(
    Object.entries(records).map(([key, value]) => [key, Object.freeze([...value.permissions])])
  );
  const hierarchyFor = records => Object.fromEntries(
    Object.entries(records).map(([key, value]) => [key, Number(value.hierarchy ?? manifest.defaultCustomRoleHierarchy)])
  );
  const labelsFor = records => Object.fromEntries(
    Object.entries(records).map(([key, value]) => [key, value.label])
  );
  const optionsFor = records => Object.entries(records).map(([value, definition]) => ({
    value,
    label: definition.label
  }));
  const deepFreeze = value => {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.values(value).forEach(deepFreeze);
    return Object.freeze(value);
  };

  const ROLE_PERMISSIONS = permissionsFor(manifest.baseRoles);
  const STAFF_ROLE_PERMISSIONS = permissionsFor(manifest.staffRoles);
  const DEPARTMENT_PERMISSIONS = permissionsFor(manifest.departments);
  const ROLE_LABELS = {
    ...labelsFor(manifest.baseRoles),
    ...labelsFor(manifest.staffRoles),
    ...labelsFor(manifest.departments)
  };

  window.BCCAccessContracts = deepFreeze({
    manifest,
    ROLE_PERMISSIONS,
    STAFF_ROLE_PERMISSIONS,
    DEPARTMENT_PERMISSIONS,
    BASE_ROLE_HIERARCHY: hierarchyFor(manifest.baseRoles),
    STAFF_ROLE_HIERARCHY: hierarchyFor(manifest.staffRoles),
    DEFAULT_CUSTOM_ROLE_HIERARCHY: Number(manifest.defaultCustomRoleHierarchy),
    STAFF_ROLES: Object.keys(manifest.staffRoles),
    DEPARTMENTS: Object.keys(manifest.departments),
    PERMISSION_LABELS: { ...manifest.permissionLabels },
    WORKSPACE_PERMISSION_LABELS: { ...manifest.workspacePermissionLabels },
    ROLE_LABELS,
    BASE_ROLE_OPTIONS: optionsFor(manifest.baseRoles),
    STAFF_ROLE_OPTIONS: Object.entries(manifest.staffRoles).map(([value, definition]) => ({
      value,
      label: manifest.workspaceStaffRoleLabels?.[value] || definition.label
    })),
    DEPARTMENT_OPTIONS: optionsFor(manifest.departments),
    canAccess(user, permission) {
      if (!permission) return true;
      return user?.role === "admin"
        || (Array.isArray(user?.permissions) && user.permissions.includes(permission));
    }
  });
})();
`;

if (check) {
  const current = fs.existsSync(browserPath) ? fs.readFileSync(browserPath, "utf8") : "";
  if (current !== browserSource) {
    console.error("js/access-contracts.js no coincide con shared/access-contracts.json.");
    process.exitCode = 1;
  }
} else {
  fs.writeFileSync(browserPath, browserSource);
}
