// Four distinct AquaSpecter logo directions, text outlined to paths.
import fs from 'node:fs';
import opentype from 'opentype.js';

const OUT = process.argv[2] || 'concepts';
fs.mkdirSync(OUT, { recursive: true });
const load = (fam, w) => opentype.parse(fs.readFileSync(`node_modules/@fontsource/${fam}/files/${fam}-latin-${w}-normal.woff`).buffer);
const manrope7 = load('manrope', 700), manrope5 = load('manrope', 500), manrope8 = load('manrope', 800);
const sora6 = load('sora', 600), sora3 = load('sora', 300), sora4 = load('sora', 400);

const NAVY = '#0B2A4A', AQUA = '#1497B8';
const r = (n) => Math.round(n * 100) / 100;
// Own serializer: opentype's optimized toPathData can glue numbers ("0.330 0.33").
const pd = (p) => p.commands.map((c) => c.type === 'Z' ? 'Z'
  : c.type + [c.x1, c.y1, c.x2, c.y2, c.x, c.y].filter((v) => v !== undefined).map(r).join(' ')).join('');

function text(font, str, x, y, size, ls = 0) {
  let cx = x, d = '';
  const gs = font.stringToGlyphs(str);
  gs.forEach((g, i) => {
    d += pd(g.getPath(cx, y, size));
    cx += (g.advanceWidth / font.unitsPerEm) * size;
    if (i < gs.length - 1) cx += (font.getKerningValue(g, gs[i + 1]) / font.unitsPerEm) * size + ls * size;
  });
  return { d, w: cx - x };
}
const capH = (font, size) => (font.tables.os2.sCapHeight / font.unitsPerEm) * size;
function stem(font, size) {
  const bb = font.charToGlyph('I').getBoundingBox();
  return ((bb.x2 - bb.x1) / font.unitsPerEm) * size;
}
// One-period-per-2-humps sine using quadratic smooth segments.
function sine(x0, y0, width, amp, halfWaves) {
  const hw = width / halfWaves;
  let d = `M${r(x0)} ${r(y0)}q${r(hw / 2)} ${r(-amp * 2)} ${r(hw)} 0`;
  for (let i = 1; i < halfWaves; i++) d += `t${r(hw)} 0`;
  return d;
}
const svg = (w, h, body, bg = '#fff') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${r(w)} ${r(h)}" width="${r(w)}" height="${r(h)}" role="img"><title>AquaSpecter</title>${bg ? `<rect width="100%" height="100%" fill="${bg}"/>` : ''}${body}</svg>\n`;

// ---------- 1. Q-Onda: wordmark, the Q tail is the AC sine ----------
{
  const size = 72, ls = 0.08, y = 120, x0 = 40;
  const f = manrope7, ch = capH(f, size), sw = stem(f, size);
  const A = text(f, 'A', x0, y, size);
  const qR = ch / 2 + 1.5; // slight overshoot like real round glyphs
  const qx = x0 + A.w + ls * size + qR + 2, qy = y - ch / 2;
  const rest = text(f, 'UASPECTER', qx + qR + 2 + ls * size, y, size, ls);
  const tail = sine(qx + qR * 0.12, qy + qR * 0.66, qR * 1.12, qR * 0.13, 2);
  const W = rest.w + (qx + qR + 2 + ls * size) + 40;
  const tag = text(manrope5, 'MONITOREO ELECTROQUÍMICO DE AGUA', x0 + 2, y + 44, 15.5, 0.32);
  const body = `<path d="${A.d}${rest.d}" fill="${NAVY}"/>
<circle cx="${r(qx)}" cy="${r(qy)}" r="${r(qR - sw / 2)}" fill="none" stroke="${NAVY}" stroke-width="${r(sw)}"/>
<path d="${tail}" fill="none" stroke="${AQUA}" stroke-width="${r(sw * 0.82)}" stroke-linecap="round"/>
<path d="${tag.d}" fill="${AQUA}"/>`;
  fs.writeFileSync(`${OUT}/1-q-onda.svg`, svg(Math.max(W, tag.w + 80), 200, body));
}

// ---------- 2. Monograma: A sin travesaño, la onda AC es el travesaño ----------
{
  const mark = (x, y, s, c1 = NAVY, c2 = AQUA) => `<g transform="translate(${x} ${y}) scale(${s})">
<clipPath id="ft"><rect x="-20" y="-20" width="140" height="116"/></clipPath>
<path clip-path="url(#ft)" d="M2 110 L50 6 L98 110" fill="none" stroke="${c1}" stroke-width="13" stroke-linejoin="miter" stroke-miterlimit="10"/>
<path d="${sine(0, 66, 100, 7.5, 4)}" fill="none" stroke="${c2}" stroke-width="8" stroke-linecap="round"/></g>`;
  const a = text(sora6, 'Aqua', 170, 112, 62, -0.01);
  const b = text(sora3, 'Specter', 170 + a.w, 112, 62, -0.01);
  const t = text(sora4, 'BCC TECHNOLOGIES', 172, 146, 14, 0.3);
  const body = `${mark(40, 42, 1.06)}<path d="${a.d}" fill="${NAVY}"/><path d="${b.d}" fill="${NAVY}"/><path d="${t.d}" fill="${AQUA}"/>`;
  fs.writeFileSync(`${OUT}/2-monograma.svg`, svg(170 + a.w + b.w + 40, 200, body));
}

// ---------- 3. Espectro: gota construida con barras (barrido de frecuencias) ----------
{
  const drop = 'M60 4Q78 40 102 70A50 50 0 1 1 18 70Q42 40 60 4Z';
  let bars = '';
  const n = 9, bw = 8, gap = (110 - n * bw) / (n - 1);
  for (let i = 0; i < n; i++) bars += `<rect x="${r(5 + i * (bw + gap))}" y="0" width="${bw}" height="160" fill="${NAVY}"/>`;
  const markS = 0.98;
  const body0 = `<defs><clipPath id="dp"><path d="${drop}"/></clipPath></defs>
<g transform="translate(40 20) scale(${markS})"><g clip-path="url(#dp)">${bars}<path d="${sine(0, 92, 120, 7, 4)}" fill="none" stroke="#fff" stroke-width="12"/><path d="${sine(0, 92, 120, 7, 4)}" fill="none" stroke="${AQUA}" stroke-width="5.5"/></g></g>`;
  const a = text(manrope8, 'AQUA', 190, 100, 50, 0.04);
  const b = text(manrope5, 'SPECTER', 190 + a.w + 0.04 * 50, 100, 50, 0.04);
  const t = text(manrope5, 'ESPECTROSCOPÍA DE IMPEDANCIA', 192, 134, 13.4, 0.3);
  const body = `${body0}<path d="${a.d}" fill="${NAVY}"/><path d="${b.d}" fill="${AQUA}"/><path d="${t.d}" fill="${NAVY}" opacity=".75"/>`;
  fs.writeFileSync(`${OUT}/3-espectro.svg`, svg(190 + Math.max(a.w + b.w + 2, t.w) + 40, 200, body));
}

// ---------- 4. Sello: emblema circular, electrodos + señal ----------
{
  const C = 150, R0 = 132; // canvas center, outer radius
  function arcText(font, str, radius, centerDeg, size, ls, bottom = false) {
    const gs = font.stringToGlyphs(str);
    const adv = gs.map((g) => (g.advanceWidth / font.unitsPerEm) * size + ls * size);
    const total = adv.reduce((s, v) => s + v, 0) - ls * size;
    let out = '', acc = 0;
    gs.forEach((g, i) => {
      const mid = acc + (adv[i] - ls * size) / 2;
      const ang = (mid - total / 2) / radius; // radians along arc
      const deg = bottom ? centerDeg - (ang * 180) / Math.PI : centerDeg + (ang * 180) / Math.PI;
      const rad = (deg * Math.PI) / 180;
      const px = C + radius * Math.sin(rad), py = C - radius * Math.cos(rad);
      const rot = bottom ? deg + 180 : deg;
      const gw = (g.advanceWidth / font.unitsPerEm) * size;
      const p = pd(g.getPath(-gw / 2, bottom ? capH(font, size) : 0, size));
      out += `<path transform="translate(${r(px)} ${r(py)}) rotate(${r(rot)})" d="${p}"/>`;
      acc += adv[i];
    });
    return out;
  }
  const top = arcText(manrope8, 'AQUASPECTER', 97, 0, 22, 0.2);
  const bot = arcText(manrope5, 'BCC TECHNOLOGIES', 101, 180, 13, 0.3, true);
  const body = `<circle cx="${C}" cy="${C}" r="${R0}" fill="none" stroke="${NAVY}" stroke-width="5"/>
<circle cx="${C}" cy="${C}" r="${R0 - 10}" fill="none" stroke="${NAVY}" stroke-width="1.5"/>
<g fill="${NAVY}">${top}${bot}</g>
<circle cx="${C - 105}" cy="${C + 4}" r="3.5" fill="${AQUA}"/><circle cx="${C + 105}" cy="${C + 4}" r="3.5" fill="${AQUA}"/>
<circle cx="${C}" cy="${C}" r="74" fill="${NAVY}"/>
<clipPath id="in"><circle cx="${C}" cy="${C}" r="74"/></clipPath>
<g clip-path="url(#in)">
  <path d="${sine(C - 90, C + 20, 180, 3.5, 6)}V${C + 90}H${C - 90}Z" fill="${AQUA}"/>
</g>
${Array.from({ length: 9 }, (_, i) => { const a = Math.PI * (1 - i / 8); return `<circle cx="${r(C + 40 * Math.cos(a))}" cy="${r(C + 14 - 40 * Math.sin(a))}" r="${i === 4 ? 6 : 4.6}" fill="#fff"/>`; }).join('')}`;
  fs.writeFileSync(`${OUT}/4-sello.svg`, svg(300, 300, body));
}
console.log(fs.readdirSync(OUT).join(' '));
