import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const failures = [];
const excluded = new Set([".git", "node_modules", ".venv", "vendor"]);

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (excluded.has(entry.name)) return [];
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

const files = walk(root);
const sourceFiles = files.filter(file => /\.(?:html|css|js|mjs|json|ya?ml)$/i.test(file));
const runtimeFiles = files.filter(file => /\.(?:js|mjs)$/i.test(file));
const relative = file => path.relative(root, file).replaceAll(path.sep, "/");

for (const file of sourceFiles) {
  const source = fs.readFileSync(file, "utf8");
  if (/^(?:<<<<<<<|=======|>>>>>>>)/m.test(source)) {
    failures.push(`${relative(file)} contiene marcadores de conflicto.`);
  }
}

for (const file of runtimeFiles) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) failures.push(`${relative(file)} no pasa node --check:\n${result.stderr.trim()}`);
}

for (const file of files.filter(file => relative(file).startsWith("js/") && file.endsWith(".js"))) {
  if (relative(file) === "js/supabase-config.js") continue;
  const source = fs.readFileSync(file, "utf8");
  if (/\b(?:window\.)?supabase\.createClient\s*\(/.test(source)) {
    failures.push(`${relative(file)} crea un cliente Supabase fuera del proveedor central.`);
  }
}

const cdnPattern = /https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@([^"'\s<]+)/g;
for (const file of sourceFiles) {
  const source = fs.readFileSync(file, "utf8");
  for (const match of source.matchAll(cdnPattern)) {
    if (match[1] !== "2.110.8") failures.push(`${relative(file)} usa una versión Supabase CDN no aprobada: ${match[1]}.`);
  }
}

if (failures.length) {
  console.error(`Falló la integridad del runtime (${failures.length}):\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log(`Integridad correcta: ${runtimeFiles.length} scripts y ${sourceFiles.length} archivos fuente auditados.`);
