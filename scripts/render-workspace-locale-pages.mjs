import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pages = [
  ["dashboard.html", "en/dashboard.html", "My account - BCC"],
  ["staff-dashboard.html", "en/staff-dashboard.html", "Staff workspace - BCC"]
];

for (const [sourcePath, targetPath, title] of pages) {
  const source = fs.readFileSync(path.join(root, sourcePath), "utf8");
  const localized = source
    .replace('<html lang="es">', '<html lang="en">')
    .replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
    .replace('<meta charset="UTF-8" />', '<meta charset="UTF-8" />\n  <base href="/" />')
    .replace(/<link rel="alternate" hreflang="es"[^>]*>/, match => `${match}\n  <link rel="canonical" href="/${targetPath}" />`);
  fs.writeFileSync(path.join(root, targetPath), localized);
}
