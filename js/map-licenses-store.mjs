import fs from "fs";
import crypto from "crypto";
import path from "path";

const PRODUCTS = new Set(["MAP-Nano", "MAP-Bio", "MAP-Med", "MAP-Ing"]);
const PLANS = new Set(["Individual", "Equipo", "Enterprise", "Prueba"]);
const PLATFORMS = new Set(["Web", "Desktop", "Web + Desktop"]);
const STATUSES = new Set(["draft", "trial", "active", "grace", "suspended", "expired", "cancelled"]);
const ASSIGNABLE_STATUSES = new Set(["trial", "active", "grace"]);

function cleanText(value, maxLength = 160) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function oneOf(value, allowed, fallback, message) {
  const normalized = cleanText(value || fallback, 40);
  if (!allowed.has(normalized)) throw new Error(message);
  return normalized;
}

function normalizeDate(value, fallback, message) {
  const normalized = String(value || fallback || "");
  if (normalized && !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) throw new Error(message);
  return normalized;
}

function normalizeLicense(input = {}) {
  const organization = cleanText(input.organization, 120);
  const contactEmail = cleanText(input.contactEmail, 254).toLowerCase();
  const requestedProducts = Array.isArray(input.products) ? input.products.map(product => cleanText(product, 32)) : [];
  const products = [...new Set(requestedProducts)];
  const seats = Number(input.seats ?? 1);
  const startsAt = normalizeDate(input.startsAt, new Date().toISOString().slice(0, 10), "La fecha de inicio no es válida.");
  const endsAt = normalizeDate(input.endsAt, "", "La fecha de vencimiento no es válida.");

  if (!organization) throw new Error("La organización es requerida.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) throw new Error("El correo de contacto no es válido.");
  if (!products.length) throw new Error("Selecciona al menos un producto MAP.");
  if (products.some(product => !PRODUCTS.has(product))) throw new Error("El producto MAP no es válido.");
  if (!Number.isInteger(seats) || seats < 1 || seats > 100000) throw new Error("La cantidad de asientos no es válida.");
  if (endsAt && endsAt < startsAt) throw new Error("El vencimiento no puede ser anterior al inicio.");

  return {
    organization,
    contactEmail,
    products,
    plan: oneOf(input.plan, PLANS, "Equipo", "El plan no es válido."),
    seats,
    usedSeats: 0,
    status: oneOf(input.status, STATUSES, "draft", "El estado no es válido."),
    platform: oneOf(input.platform, PLATFORMS, "Web", "La plataforma no es válida."),
    startsAt,
    endsAt
  };
}

export function createMapLicenseStore({ filePath }) {
  function read() {
    try {
      const value = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      return Array.isArray(value) ? value : [];
    } catch (error) {
      if (error?.code === "ENOENT") return [];
      throw error;
    }
  }

  function write(licenses) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const temporaryPath = `${filePath}.${process.pid}.tmp`;
    fs.writeFileSync(temporaryPath, `${JSON.stringify(licenses, null, 2)}\n`, "utf-8");
    fs.renameSync(temporaryPath, filePath);
  }

  function updateLicense(id, update) {
    const licenses = read();
    const index = licenses.findIndex(item => item.id === id);
    if (index < 0) return null;
    const result = update(licenses[index]);
    licenses[index] = result.license;
    write(licenses);
    return result;
  }

  return {
    list() {
      return read().slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    },
    create(input, actorId) {
      const now = new Date().toISOString();
      const license = {
        id: `lic_${crypto.randomUUID()}`,
        organizationId: `org_${crypto.createHash("sha256").update(cleanText(input.organization).toLowerCase()).digest("hex").slice(0, 16)}`,
        ...normalizeLicense(input),
        createdBy: actorId,
        createdAt: now,
        updatedAt: now,
        assignments: [],
        events: [{ type: "license.created", actorId, createdAt: now }]
      };
      const licenses = read();
      licenses.push(license);
      write(licenses);
      return license;
    },
    setStatus(id, status, actorId) {
      if (!STATUSES.has(status)) throw new Error("Estado inválido.");
      return updateLicense(id, license => {
        const now = new Date().toISOString();
        const before = license.status;
        return {
          license: {
            ...license,
            status,
            updatedAt: now,
            events: [
              ...(Array.isArray(license.events) ? license.events : []),
              { type: "license.status_changed", before, after: status, actorId, createdAt: now }
            ]
          }
        };
      })?.license || null;
    },
    listAssignments(id) {
      const license = read().find(item => item.id === id);
      if (!license) return null;
      return (Array.isArray(license.assignments) ? license.assignments : [])
        .filter(assignment => assignment.status === "active")
        .sort((a, b) => String(a.assignedAt).localeCompare(String(b.assignedAt)));
    },
    assign(id, userId, actorId) {
      const cleanUserId = cleanText(userId, 100);
      if (!cleanUserId) throw new Error("Usuario requerido.");
      return updateLicense(id, license => {
        if (!ASSIGNABLE_STATUSES.has(license.status)) throw new Error("La licencia debe estar activa, en prueba o en gracia.");
        const assignments = Array.isArray(license.assignments) ? [...license.assignments] : [];
        const existingIndex = assignments.findIndex(item => item.userId === cleanUserId);
        if (existingIndex >= 0 && assignments[existingIndex].status === "active") {
          throw new Error("El usuario ya tiene un asiento en esta licencia.");
        }
        const usedSeats = Number(license.usedSeats || 0);
        if (usedSeats >= Number(license.seats || 0)) throw new Error("No hay asientos disponibles.");

        const now = new Date().toISOString();
        const assignment = existingIndex >= 0 ? {
          ...assignments[existingIndex],
          status: "active",
          assignedBy: actorId,
          assignedAt: now,
          revokedAt: ""
        } : {
          id: `seat_${crypto.randomUUID()}`,
          userId: cleanUserId,
          status: "active",
          assignedBy: actorId,
          assignedAt: now,
          revokedAt: ""
        };
        if (existingIndex >= 0) assignments[existingIndex] = assignment;
        else assignments.push(assignment);

        return {
          assignment,
          license: {
            ...license,
            assignments,
            usedSeats: usedSeats + 1,
            updatedAt: now,
            events: [
              ...(Array.isArray(license.events) ? license.events : []),
              { type: "license.seat_assigned", userId: cleanUserId, actorId, createdAt: now }
            ]
          }
        };
      });
    },
    revoke(id, userId, actorId) {
      const cleanUserId = cleanText(userId, 100);
      return updateLicense(id, license => {
        const assignments = Array.isArray(license.assignments) ? [...license.assignments] : [];
        const index = assignments.findIndex(item => item.userId === cleanUserId && item.status === "active");
        if (index < 0) throw new Error("Asignación no encontrada.");
        const now = new Date().toISOString();
        assignments[index] = { ...assignments[index], status: "revoked", revokedAt: now };
        return {
          assignment: assignments[index],
          license: {
            ...license,
            assignments,
            usedSeats: Math.max(0, Number(license.usedSeats || 0) - 1),
            updatedAt: now,
            events: [
              ...(Array.isArray(license.events) ? license.events : []),
              { type: "license.seat_revoked", userId: cleanUserId, actorId, createdAt: now }
            ]
          }
        };
      });
    }
  };
}
