// Generates AquaSpecter logo SVGs with outlined (font-independent) text.
import fs from 'node:fs';
import path from 'node:path';
import opentype from 'opentype.js';

const OUT = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });

const F = (w) => opentype.parse(fs.readFileSync(`node_modules/@fontsource/montserrat/files/montserrat-latin-${w}-normal.woff`).buffer);
const bold = F(700), regular = F(400), medium = F(500);

const C = {
  navy: '#0B2A4A',
  deep: '#0E5E8C',
  aqua: '#1FA3C6',
  light: '#7FD3EA',
  white: '#FFFFFF',
};

const r = (n) => Math.round(n * 100) / 100;

// Text -> path, returns {d, width}. letterSpacing in em.
function textPath(font, str, x, y, size, ls = 0) {
  let cx = x, d = '';
  const glyphs = font.stringToGlyphs(str);
  glyphs.forEach((g, i) => {
    d += g.getPath(cx, y, size).toPathData(2);
    cx += (g.advanceWidth / font.unitsPerEm) * size;
    if (i < glyphs.length - 1) {
      cx += (font.getKerningValue(g, glyphs[i + 1]) / font.unitsPerEm) * size;
      cx += ls * size;
    }
  });
  return { d, width: cx - x };
}

// ---------- Isotipo: gota + arco de Nyquist (Randles) + cola de Warburg ----------
// Drop: tip (60,6), circle center (60,100) r=50. Tangent points computed exactly.
function dropPath(cx = 60, cy = 100, R = 50, tipY = 6) {
  const d = cy - tipY;
  const th = Math.acos(R / d);
  const tx = R * Math.sin(th), ty = cy - R * Math.cos(th);
  // Slightly curved flanks (quadratic) for a more organic drop.
  const qx = r(tx * 0.42), qy = r((tipY + ty) / 2 + 6);
  return `M${cx} ${tipY}Q${r(cx + qx)} ${qy} ${r(cx + tx)} ${r(ty)}A${R} ${R} 0 1 1 ${r(cx - tx)} ${r(ty)}Q${r(cx - qx)} ${qy} ${cx} ${tipY}Z`;
}

function markContent({ fill, ink, accent }) {
  // Nyquist semicircle (bulk response of the sample) over the real-impedance axis,
  // excited by the AC sine above: the EIS measurement in one glyph.
  const axisY = 118, ccx = 60, cr = 27;
  const N = 7;
  const dots = [];
  for (let i = 0; i < N; i++) {
    const a = Math.PI * (0.92 - (0.84 * i) / (N - 1));
    dots.push(`<circle cx="${r(ccx + cr * Math.cos(a))}" cy="${r(axisY - cr * Math.sin(a))}" r="${i === 3 ? 4.4 : 3.4}"/>`);
  }
  return `
    <path d="${dropPath()}" fill="${fill}"/>
    <path d="M24 ${axisY}H96" stroke="${ink}" stroke-width="2.6" stroke-linecap="round" opacity=".6"/>
    <path d="M${ccx - cr} ${axisY}A${cr} ${cr} 0 0 1 ${ccx + cr} ${axisY}" fill="none" stroke="${ink}" stroke-width="2.4" stroke-linecap="round" opacity=".85"/>
    <g fill="${accent}">${dots.join('')}</g>
    <path d="M35 64c5.5-8.5 11-8.5 16.5 0s11 8.5 16.5 0 11-8.5 16.5 0" fill="none" stroke="${ink}" stroke-width="3.2" stroke-linecap="round"/>`;
}

const gradDefs = (id) => `
  <defs>
    <linearGradient id="${id}" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0" stop-color="${C.aqua}"/>
      <stop offset="1" stop-color="${C.deep}"/>
    </linearGradient>
  </defs>`;

const THEMES = {
  color: { mark: { fill: 'url(#aqg)', ink: C.white, accent: C.white }, grad: true, aqua: C.navy, specter: C.aqua, sub: C.navy, bg: null },
  inverse: { mark: { fill: 'url(#aqg)', ink: C.white, accent: C.white }, grad: true, aqua: C.white, specter: C.light, sub: C.light, bg: C.navy },
  mono: { mark: { fill: C.navy, ink: C.white, accent: C.white }, grad: false, aqua: C.navy, specter: C.navy, sub: C.navy, bg: null },
  monoWhite: { mark: { fill: C.white, ink: C.navy, accent: C.navy }, grad: false, aqua: C.white, specter: C.white, sub: C.white, bg: C.navy },
};

function svg(w, h, body, title, bg) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${r(w)} ${r(h)}" width="${r(w)}" height="${r(h)}" role="img" aria-labelledby="t">
  <title id="t">${title}</title>${bg ? `\n  <rect width="100%" height="100%" fill="${bg}"/>` : ''}${body}
</svg>
`;
}

function mark(t, tx = 0, ty = 0, s = 1) {
  return `${t.grad ? gradDefs('aqg') : ''}
  <g transform="translate(${r(tx)} ${r(ty)}) scale(${s})">${markContent(t.mark)}
  </g>`;
}

// Horizontal lockup
function horizontal(name, t, withTag = true) {
  const pad = 24, markH = 150, markW = 120;
  const x0 = pad + markW + 34;
  const a = textPath(bold, 'Aqua', x0, 104, 66, -0.01);
  const s = textPath(regular, 'Specter', x0 + a.width, 104, 66, -0.01);
  const wordW = a.width + s.width;
  let tag = '', rule = '', tagW = 0;
  if (withTag) {
    const t1 = textPath(medium, 'ESPECTROSCOPÍA DE IMPEDANCIA', x0 + 2, 146, 12.4, 0.12);
    const bx = x0 + 2 + t1.width + 14;
    const t2 = textPath(medium, 'BCC TECHNOLOGIES', bx + 14, 146, 12.4, 0.12);
    tagW = bx + 14 + t2.width - x0;
    tag = `<path d="${t1.d}${t2.d}" fill="${t.sub}" opacity=".85"/><circle cx="${r(bx)}" cy="141.6" r="2" fill="${t.specter}"/>`;
    rule = `<path d="M${x0 + 2} 124H${r(x0 + Math.max(wordW, tagW))}" stroke="${t.specter}" stroke-width="1.4" opacity=".6"/>`;
  }
  const w = x0 + Math.max(wordW, tagW) + pad;
  const h = markH + pad * 2 - 6;
  const body = `${mark(t, pad, pad - 4)}
  <path d="${a.d}" fill="${t.aqua}"/>
  <path d="${s.d}" fill="${t.specter}"/>
  ${rule}${tag}`;
  fs.writeFileSync(path.join(OUT, `${name}.svg`), svg(w, h, body, 'AquaSpecter', t.bg));
}

// Stacked lockup
function stacked(name, t) {
  const W = 520, markS = 1.5;
  const a = textPath(bold, 'Aqua', 0, 0, 64);
  const s = textPath(regular, 'Specter', 0, 0, 64);
  const ww = a.width + s.width;
  const tx = (W - ww) / 2, ty = 300;
  const a2 = textPath(bold, 'Aqua', tx, ty, 64);
  const s2 = textPath(regular, 'Specter', tx + a2.width, ty, 64);
  const tgStr = 'ESPECTROSCOPÍA DE IMPEDANCIA ELECTROQUÍMICA';
  const tw = textPath(medium, tgStr, 0, 0, 13, 0.16).width;
  const tg = textPath(medium, tgStr, (W - tw) / 2, 336, 13, 0.16);
  const body = `${mark(t, (W - 120 * markS) / 2, 18, markS)}
  <path d="${a2.d}" fill="${t.aqua}"/>
  <path d="${s2.d}" fill="${t.specter}"/>
  <path d="${tg.d}" fill="${t.sub}" opacity=".85"/>`;
  fs.writeFileSync(path.join(OUT, `${name}.svg`), svg(W, 364, body, 'AquaSpecter', t.bg));
}

// Isotipo solo (square, for avatars / favicon / lanyard)
function icon(name, t, bg) {
  const body = `${mark(t, 20, 8, 1)}`;
  fs.writeFileSync(path.join(OUT, `${name}.svg`), svg(160, 170, body, 'AquaSpecter', bg ?? t.bg));
}

horizontal('aquaspecter-horizontal', THEMES.color);
horizontal('aquaspecter-horizontal-inverse', THEMES.inverse);
horizontal('aquaspecter-horizontal-mono', THEMES.mono);
horizontal('aquaspecter-horizontal-mono-white', THEMES.monoWhite);
horizontal('aquaspecter-horizontal-compact', THEMES.color, false);
stacked('aquaspecter-stacked', THEMES.color);
stacked('aquaspecter-stacked-inverse', THEMES.inverse);
icon('aquaspecter-isotipo', THEMES.color);
icon('aquaspecter-isotipo-mono', THEMES.mono);
console.log(fs.readdirSync(OUT).join('\n'));
