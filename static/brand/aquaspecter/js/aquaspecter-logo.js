/*
 * AquaSpecter logo — Canvas 2D renderer (sin SVG).
 *
 *   await AquaSpecterLogo.ready();
 *   AquaSpecterLogo.render(canvas, { concept: 'monograma', theme: 'color' });
 *   const stop = AquaSpecterLogo.animate(canvas, { concept: 'sello' });
 *   const png = AquaSpecterLogo.toPNG({ concept: 'monograma', scale: 4 });
 *
 * concept: 'monograma' | 'q-onda' | 'espectro' | 'sello'
 * theme:   'color' | 'inverse' | 'mono'
 */
(function (global) {
  'use strict';

  const NAVY = '#0B2A4A';
  const AQUA = '#1497B8';

  const THEMES = {
    color: { bg: '#FFFFFF', ink: NAVY, accent: AQUA, sub: NAVY, knock: '#FFFFFF' },
    inverse: { bg: NAVY, ink: '#FFFFFF', accent: '#5CC8E4', sub: '#CFE3EE', knock: NAVY },
    mono: { bg: '#FFFFFF', ink: NAVY, accent: NAVY, sub: NAVY, knock: '#FFFFFF' },
  };

  // Local fonts so the logo renders identically offline (event venues).
  const BASE = (function () {
    const s = document.currentScript && document.currentScript.src;
    return s ? s.slice(0, s.lastIndexOf('/') + 1) : '';
  })();
  const FONTS = [
    ['Manrope', 500, 'manrope-latin-500-normal'],
    ['Manrope', 700, 'manrope-latin-700-normal'],
    ['Manrope', 800, 'manrope-latin-800-normal'],
    ['Sora', 300, 'sora-latin-300-normal'],
    ['Sora', 400, 'sora-latin-400-normal'],
    ['Sora', 600, 'sora-latin-600-normal'],
  ];
  let fontsPromise = null;
  function ready() {
    if (!fontsPromise) {
      fontsPromise = Promise.all(
        FONTS.map(([family, weight, file]) => {
          const face = new FontFace(family, `url(${BASE}fonts/${file}.woff2) format("woff2")`, { weight: String(weight) });
          return face.load().then((f) => document.fonts.add(f)).catch(() => null);
        })
      );
    }
    return fontsPromise;
  }

  const font = (weight, size, family) => `${weight} ${size}px ${family}, system-ui, sans-serif`;

  // ---------- helpers ----------
  // Sampled sine: `halfWaves` humps over `width`; first hump goes up. `phase` animates it.
  function sinePath(ctx, x0, y0, width, amp, halfWaves, phase) {
    const steps = Math.max(24, Math.round(width));
    ctx.moveTo(x0, y0 - amp * Math.sin(phase));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      ctx.lineTo(x0 + width * t, y0 - amp * Math.sin(Math.PI * halfWaves * t + phase));
    }
  }

  function spacedWidth(ctx, str, ls) {
    let w = 0;
    for (const ch of str) w += ctx.measureText(ch).width + ls;
    return w - ls;
  }

  function drawSpaced(ctx, str, x, y, ls) {
    for (const ch of str) {
      ctx.fillText(ch, x, y);
      x += ctx.measureText(ch).width + ls;
    }
    return x - ls;
  }

  function capHeight(ctx) {
    return ctx.measureText('H').actualBoundingBoxAscent;
  }

  // ---------- concepts ----------
  // Each concept: (ctx, theme, phase, draw) -> { w, h }. With draw=false it only measures.

  // 1. Q-Onda: wordmark, the Q tail is the AC excitation signal.
  function qOnda(ctx, t, phase, draw) {
    const size = 72, ls = 0.08 * size, x0 = 40, y = 120;
    ctx.font = font(700, size, 'Manrope');
    const cap = capHeight(ctx);
    const iBox = ctx.measureText('I');
    const sw = iBox.actualBoundingBoxLeft + iBox.actualBoundingBoxRight;
    const wA = ctx.measureText('A').width;
    const qR = cap / 2 + 1.5;
    const qx = x0 + wA + ls + qR + 2, qy = y - cap / 2;
    const xRest = qx + qR + 2 + ls;
    const wRest = spacedWidth(ctx, 'UASPECTER', ls);
    ctx.font = font(500, 15.5, 'Manrope');
    const tagLs = 0.32 * 15.5, tag = 'MONITOREO ELECTROQUÍMICO DE AGUA';
    const wTag = spacedWidth(ctx, tag, tagLs);
    const w = Math.max(xRest + wRest, x0 + 2 + wTag) + 40, h = 200;
    if (!draw) return { w, h };

    ctx.fillStyle = t.ink;
    ctx.font = font(700, size, 'Manrope');
    ctx.fillText('A', x0, y);
    drawSpaced(ctx, 'UASPECTER', xRest, y, ls);
    ctx.strokeStyle = t.ink;
    ctx.lineWidth = sw;
    ctx.beginPath();
    ctx.arc(qx, qy, qR - sw / 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = t.accent;
    ctx.lineWidth = sw * 0.82;
    ctx.lineCap = 'round';
    ctx.beginPath();
    sinePath(ctx, qx + qR * 0.12, qy + qR * 0.66, qR * 1.12, qR * 0.13, 2, phase);
    ctx.stroke();
    ctx.fillStyle = t.accent;
    ctx.font = font(500, 15.5, 'Manrope');
    drawSpaced(ctx, tag, x0 + 2, y + 44, tagLs);
    return { w, h };
  }

  // 2. Monograma: an A without crossbar; the wave (water + signal) completes it.
  function monogramMark(ctx, t, phase) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(-20, -20, 140, 116); // flat feet at y = 96
    ctx.clip();
    ctx.strokeStyle = t.ink;
    ctx.lineWidth = 13;
    ctx.lineJoin = 'miter';
    ctx.miterLimit = 10;
    ctx.beginPath();
    ctx.moveTo(2, 110);
    ctx.lineTo(50, 6);
    ctx.lineTo(98, 110);
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = t.accent;
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    sinePath(ctx, 0, 66, 100, 7.5, 4, phase);
    ctx.stroke();
  }

  function monograma(ctx, t, phase, draw) {
    ctx.font = font(600, 62, 'Sora');
    const wAqua = ctx.measureText('Aqua').width;
    ctx.font = font(300, 62, 'Sora');
    const wSpec = ctx.measureText('Specter').width;
    const w = 170 + wAqua + wSpec + 40, h = 200;
    if (!draw) return { w, h };

    ctx.save();
    ctx.translate(40, 42);
    ctx.scale(1.06, 1.06);
    monogramMark(ctx, t, phase);
    ctx.restore();
    ctx.fillStyle = t.ink;
    ctx.font = font(600, 62, 'Sora');
    ctx.fillText('Aqua', 170, 112);
    ctx.font = font(300, 62, 'Sora');
    ctx.fillText('Specter', 170 + wAqua, 112);
    ctx.fillStyle = t.accent;
    ctx.font = font(400, 14, 'Sora');
    drawSpaced(ctx, 'BCC TECHNOLOGIES', 172, 146, 0.3 * 14);
    return { w, h };
  }

  // 3. Espectro: a drop built from bars (frequency sweep) crossed by the signal.
  function dropPath(ctx) {
    const cx = 60, cy = 100, R = 50;
    ctx.moveTo(60, 4);
    ctx.quadraticCurveTo(78, 40, 102, 70);
    ctx.arc(cx, cy, R, Math.atan2(70 - cy, 102 - cx), Math.atan2(70 - cy, 18 - cx), false);
    ctx.quadraticCurveTo(42, 40, 60, 4);
    ctx.closePath();
  }

  function espectro(ctx, t, phase, draw) {
    ctx.font = font(800, 50, 'Manrope');
    const ls = 0.04 * 50;
    const wAqua = spacedWidth(ctx, 'AQUA', ls);
    ctx.font = font(500, 50, 'Manrope');
    const wSpec = spacedWidth(ctx, 'SPECTER', ls);
    ctx.font = font(500, 13.4, 'Manrope');
    const tag = 'ESPECTROSCOPÍA DE IMPEDANCIA', tagLs = 0.3 * 13.4;
    const wTag = spacedWidth(ctx, tag, tagLs);
    const w = 190 + Math.max(wAqua + ls + wSpec, wTag + 2) + 40, h = 200;
    if (!draw) return { w, h };

    ctx.save();
    ctx.translate(40, 20);
    ctx.scale(0.98, 0.98);
    ctx.beginPath();
    dropPath(ctx);
    ctx.clip();
    ctx.fillStyle = t.ink;
    const n = 9, bw = 8, gap = (110 - n * bw) / (n - 1);
    for (let i = 0; i < n; i++) ctx.fillRect(5 + i * (bw + gap), 0, bw, 160);
    ctx.lineCap = 'butt';
    ctx.strokeStyle = t.knock;
    ctx.lineWidth = 12;
    ctx.beginPath();
    sinePath(ctx, 0, 92, 120, 7, 4, phase);
    ctx.stroke();
    ctx.strokeStyle = t.accent;
    ctx.lineWidth = 5.5;
    ctx.beginPath();
    sinePath(ctx, 0, 92, 120, 7, 4, phase);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = t.ink;
    ctx.font = font(800, 50, 'Manrope');
    const end = drawSpaced(ctx, 'AQUA', 190, 100, ls);
    ctx.fillStyle = t.accent;
    ctx.font = font(500, 50, 'Manrope');
    drawSpaced(ctx, 'SPECTER', end + ls, 100, ls);
    ctx.fillStyle = t.sub;
    ctx.globalAlpha = 0.75;
    ctx.font = font(500, 13.4, 'Manrope');
    drawSpaced(ctx, tag, 192, 134, tagLs);
    ctx.globalAlpha = 1;
    return { w, h };
  }

  // 4. Sello: circular emblem; the Nyquist arc rises over the water like a sunrise.
  function arcText(ctx, str, C, radius, ls, bottom) {
    const widths = [...str].map((ch) => ctx.measureText(ch).width);
    const total = widths.reduce((s, v) => s + v + ls, 0) - ls;
    const cap = capHeight(ctx);
    let acc = 0;
    [...str].forEach((ch, i) => {
      const mid = acc + widths[i] / 2;
      const a = (mid - total / 2) / radius;
      const theta = bottom ? Math.PI - a : a;
      ctx.save();
      ctx.translate(C + radius * Math.sin(theta), C - radius * Math.cos(theta));
      ctx.rotate(bottom ? theta + Math.PI : theta);
      ctx.fillText(ch, -widths[i] / 2, bottom ? cap : 0);
      ctx.restore();
      acc += widths[i] + ls;
    });
  }

  function sello(ctx, t, phase, draw) {
    const C = 150, w = 300, h = 300;
    if (!draw) return { w, h };

    ctx.strokeStyle = t.ink;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(C, C, 132, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(C, C, 122, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = t.ink;
    ctx.font = font(800, 22, 'Manrope');
    arcText(ctx, 'AQUASPECTER', C, 97, 0.2 * 22, false);
    ctx.font = font(500, 13, 'Manrope');
    arcText(ctx, 'BCC TECHNOLOGIES', C, 101, 0.3 * 13, true);

    ctx.fillStyle = t.accent;
    for (const dx of [-105, 105]) {
      ctx.beginPath();
      ctx.arc(C + dx, C + 4, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();
    ctx.beginPath();
    ctx.arc(C, C, 74, 0, Math.PI * 2);
    ctx.fillStyle = t.ink;
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = t.accent;
    ctx.beginPath();
    sinePath(ctx, C - 90, C + 20, 180, 3.5, 6, phase);
    ctx.lineTo(C + 90, C + 90);
    ctx.lineTo(C - 90, C + 90);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = t.knock;
    for (let i = 0; i < 9; i++) {
      const a = Math.PI * (1 - i / 8);
      ctx.beginPath();
      ctx.arc(C + 40 * Math.cos(a), C + 14 - 40 * Math.sin(a), i === 4 ? 6 : 4.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return { w, h };
  }

  const CONCEPTS = { 'q-onda': qOnda, monograma, espectro, sello };

  // ---------- public API ----------
  function render(canvas, opts = {}) {
    const concept = CONCEPTS[opts.concept || 'monograma'];
    if (!concept) throw new Error(`Concepto desconocido: ${opts.concept}`);
    const theme = THEMES[opts.theme || 'color'];
    const scale = opts.scale || global.devicePixelRatio || 1;
    const phase = opts.phase || 0;

    const ctx = canvas.getContext('2d');
    const { w, h } = concept(ctx, theme, phase, false);
    const pw = Math.ceil(w * scale), ph = Math.ceil(h * scale);
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }
    if (opts.cssSize !== false) {
      canvas.style.aspectRatio = `${w} / ${h}`;
    }
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (!opts.transparent) {
      ctx.fillStyle = theme.bg;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.textBaseline = 'alphabetic';
    concept(ctx, theme, phase, true);
    return { w, h };
  }

  // Gentle wave motion for screens; honours prefers-reduced-motion. Returns stop().
  function animate(canvas, opts = {}) {
    const reduce = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      render(canvas, opts);
      return () => {};
    }
    const speed = opts.speed || 1.6; // radians per second
    let raf = 0, start = 0;
    const tick = (ts) => {
      if (!start) start = ts;
      render(canvas, { ...opts, phase: ((ts - start) / 1000) * speed });
      raf = global.requestAnimationFrame(tick);
    };
    raf = global.requestAnimationFrame(tick);
    return () => global.cancelAnimationFrame(raf);
  }

  function toPNG(opts = {}) {
    const c = document.createElement('canvas');
    render(c, { ...opts, scale: opts.scale || 4, cssSize: false });
    return c.toDataURL('image/png');
  }

  global.AquaSpecterLogo = { ready, render, animate, toPNG, concepts: Object.keys(CONCEPTS), themes: Object.keys(THEMES) };
})(window);
