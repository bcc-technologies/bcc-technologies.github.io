/*
 * AquaSpecter logo — Canvas 2D renderer (sin SVG).
 *
 *   await AquaSpecterLogo.ready();
 *   AquaSpecterLogo.render(canvas, { concept: 'monograma', theme: 'color' });
 *   const stop = AquaSpecterLogo.animate(canvas, { concept: 'sello' });
 *   const png = AquaSpecterLogo.toPNG({ concept: 'monograma', scale: 4 });
 *
 *   const stop2 = AquaSpecterLogo.intro(canvas, { stage: '16:9', loop: true });
 *
 * concept: 'firma' | 'gota' | 'monograma' | 'q-onda' | 'espectro' | 'sello'
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

  // ---------- 5. Firma: gota -> A, "quaSpecter" sale de detrás de la A ----------
  // Geometry lives in "A units": feet on y = 96, apex on top, x roughly 0..100.
  const N_PTS = 240;
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const easeOut = (x) => 1 - Math.pow(1 - x, 3);
  const clamp01 = (x) => Math.min(1, Math.max(0, x));
  const lerp = (a, b, k) => a + (b - a) * k;
  const seg = (time, t0, t1) => clamp01((time - t0) / (t1 - t0));

  // Λ outline (an A without crossbar is a simple polygon, so it morphs cleanly).
  function lambdaPolygon(sw) {
    const P0 = [2, 110], Q = [50, 6], P1 = [98, 110], FOOT = 96;
    const len = Math.hypot(48, 104);
    const dL = [48 / len, -104 / len], dR = [-48 / len, -104 / len];
    const nL = [dL[1], -dL[0]], nR = [-dR[1], dR[0]];
    const pL = (o) => [P0[0] + o * nL[0], P0[1] + o * nL[1]];
    const pR = (o) => [P1[0] + o * nR[0], P1[1] + o * nR[1]];
    const apex = (o) => {
      // Symmetric: apex sits on x = 50, on the offset left line.
      const p = pL(o), k = (50 - p[0]) / dL[0];
      return [50, p[1] + k * dL[1]];
    };
    const foot = (p, d) => { const k = (FOOT - p[1]) / d[1]; return [p[0] + k * d[0], FOOT]; };
    const o = sw / 2;
    return [apex(o), foot(pR(o), dR), foot(pR(-o), dR), apex(-o), foot(pL(-o), dL), foot(pL(o), dL)];
  }

  // Same Λ with its crotch moved to height y (y = 96 gives a solid triangle).
  function withCrotch(poly, y) {
    return poly.map((p, i) => (i === 3 ? [50, y] : p));
  }

  // Arc-length samples expressed as (edge, fraction), so the same point can be
  // re-evaluated on the Λ while its crotch moves (no sliding along the outline).
  function resampleParams(poly, n) {
    const m = poly.length, lens = [];
    for (let j = 0; j < m; j++) {
      const a = poly[j], b = poly[(j + 1) % m];
      lens.push(Math.hypot(b[0] - a[0], b[1] - a[1]));
    }
    const total = lens.reduce((x, y) => x + y, 0), out = [];
    let j = 0, acc = 0;
    for (let i = 0; i < n; i++) {
      const d = (i / n) * total;
      while (acc + lens[j] < d) { acc += lens[j]; j++; }
      out.push([j, (d - acc) / (lens[j] || 1)]);
    }
    return out;
  }
  function pointOnEdge(poly, [j, f]) {
    const a = poly[j], b = poly[(j + 1) % poly.length];
    return [lerp(a[0], b[0], f), lerp(a[1], b[1], f)];
  }

  function resample(poly, n) {
    const pts = [...poly, poly[0]];
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const total = cum[cum.length - 1], out = [];
    let j = 1;
    for (let i = 0; i < n; i++) {
      const d = (i / n) * total;
      while (cum[j] < d) j++;
      const k = (d - cum[j - 1]) / (cum[j] - cum[j - 1] || 1);
      out.push([lerp(pts[j - 1][0], pts[j][0], k), lerp(pts[j - 1][1], pts[j][1], k)]);
    }
    return out;
  }

  // Same drop as concept 3, as a dense polyline mapped into A units (tip = apex).
  function dropPolygon(apexY) {
    const k = (96 - apexY) / 146;
    const map = ([x, y]) => [50 + (x - 60) * k, apexY + (y - 4) * k];
    const quad = (p0, c, p1, out) => {
      for (let i = 0; i < 40; i++) {
        const t = i / 40, u = 1 - t;
        out.push([u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]]);
      }
    };
    const pts = [];
    quad([60, 4], [78, 40], [102, 70], pts);
    const a0 = Math.atan2(-30, 42), sweep = Math.PI + 2 * Math.atan2(30, 42);
    for (let i = 0; i <= 80; i++) {
      const a = a0 + (sweep * i) / 80;
      pts.push([60 + 50 * Math.cos(a), 100 + 50 * Math.sin(a)]);
    }
    quad([18, 70], [42, 40], [60, 4], pts);
    return { pts: pts.map(map), k };
  }

  function firmaLayout(ctx, opts) {
    const size = 72, pad = 40;
    ctx.font = font(600, size, 'Sora');
    const cap = capHeight(ctx);
    const iBox = ctx.measureText('I');
    const stem = iBox.actualBoundingBoxLeft + iBox.actualBoundingBoxRight;
    const wQua = ctx.measureText('qua').width;
    ctx.font = font(300, size, 'Sora');
    const wSpec = ctx.measureText('Specter').width;

    // Solve scale so the A matches cap height (+3% overshoot, like a pointed glyph).
    let s = 0.55, sw = 16, poly;
    for (let i = 0; i < 4; i++) {
      sw = stem / s;
      poly = lambdaPolygon(sw);
      s = (cap * 1.03) / (96 - poly[0][1]);
    }
    const apexY = poly[0][1];
    const waveW = sw * 0.46;
    const rightEdge = Math.max(poly[1][0], 100 + waveW / 2);
    const markX = pad + waveW / 2 * s;
    const baseline = pad + cap * 1.03;
    const textX = markX + rightEdge * s + size * 0.035;
    const textW = wQua + wSpec;
    const lockW = textX + textW + pad, lockH = baseline + 34 + 14 + pad - 6;

    let W = lockW, H = lockH;
    if (opts.stage === '16:9') { W = lockW * 1.4; H = (W * 9) / 16; }
    const ox = (W - lockW) / 2, oy = (H - lockH) / 2;

    const drop = dropPolygon(apexY);
    return {
      W, H, s, sw, cap, stem, size, apexY, waveW,
      markX: markX + ox, baseline: baseline + oy, textX: textX + ox, wQua, textW,
      rightFootX: poly[1][0],
      poly, D: resample(drop.pts, N_PTS), k: drop.k,
      Tri: resample(withCrotch(poly, 96), N_PTS),
      TriP: resampleParams(withCrotch(poly, 96), N_PTS),
      aBox: [poly[5][0], poly[1][0]],
    };
  }

  // Timeline (seconds).
  const T = {
    fall: [0, 0.85],        // drop falls, stretched
    settle: 0.85,           // impact: squash + damped wobble, ripples
    morph: [1.45, 3.35],    // starts inside the wobble: drop -> triangle -> A, top to bottom
    split: 0.52,            // share of each point's path spent reaching the triangle
    stagger: 0.38,          // how far behind the base follows the tip
    camera: [2.55, 4.05],   // overlaps the legs settling
    text: [3.55, 4.6],      // starts before the mark has fully landed
    tag: [4.35, 5.05],
    end: 5.1,
  };
  const easeSine = (x) => -(Math.cos(Math.PI * x) - 1) / 2;
  const easeIn2 = (x) => x * x;

  // Legs open with a small overshoot that settles (derivative 1 at w = 0: no speed jump).
  const settleIn = (w) => w + 0.6 * Math.sin(Math.PI * w) * w * w;

  function drawMark(mctx, L, t, u, phase, time) {
    // u: eased global morph progress. Each outline point runs its own path
    // drop -> triangle -> Λ, delayed by its height so the change flows downward.
    const k = L.k, span = 96 - L.apexY, crotchY = L.poly[3][1];
    const m1 = clamp01(u / T.split);
    const shape = L.D.map((p, i) => {
      const down = clamp01((p[1] - L.apexY) / span);
      const ui = clamp01((u - down * T.stagger) / (1 - T.stagger));
      if (ui <= T.split) {
        const a = ui / T.split, q = L.Tri[i];
        return [lerp(p[0], q[0], a), lerp(p[1], q[1], a)];
      }
      const w = settleIn((ui - T.split) / (1 - T.split));
      return pointOnEdge(withCrotch(L.poly, lerp(96, crotchY, w)), L.TriP[i]);
    });
    mctx.save();
    mctx.beginPath();
    shape.forEach(([x, y], i) => (i ? mctx.lineTo(x, y) : mctx.moveTo(x, y)));
    mctx.closePath();
    mctx.fillStyle = t.ink;
    if (m1 >= 0.999) {
      mctx.fill();
    } else {
      mctx.clip();
      const x0 = lerp(50 - 55 * k, L.aBox[0] - 2, m1), x1 = lerp(50 + 55 * k, L.aBox[1] + 2, m1);
      const n = 9, pitch = (x1 - x0) / n, base = 8 / 12.75;
      const alive = 1 - m1; // spectrum shimmer fades out as the stripes fill
      for (let i = 0; i < n; i++) {
        const dist = Math.abs(i - 4) / 4;
        const shimmer = 0.16 * alive * Math.sin(time * 3.2 + i * 0.9);
        const fillK = easeSine(clamp01(m1 * 1.7 - dist * 0.7));
        const f = Math.min(1.06, lerp(base * (1 + shimmer), 1.06, fillK));
        mctx.fillRect(x0 + (i + 0.5) * pitch - (f * pitch) / 2, -40, f * pitch, 200);
      }
    }
    mctx.restore();

    // Wave: knock a gap out of the mark, then draw it (clean on transparent exports).
    const m = u;
    const wx = lerp(50 - 49 * k, 0, m), ww = lerp(98 * k, 100, m);
    const wy = lerp(L.apexY + 88 * k, 65, m), amp = lerp(7 * k, 6.5, m);
    const stroke = lerp(5.5 * k * 1.25, L.waveW, m);
    const knock = stroke + lerp(6.5 * k * 1.25, L.sw * 0.26, m);
    const wave = () => { mctx.beginPath(); sinePath(mctx, wx, wy, ww, amp, 4, phase); };
    mctx.lineCap = 'round';
    mctx.globalCompositeOperation = 'destination-out';
    mctx.lineWidth = knock;
    wave();
    mctx.stroke();
    mctx.globalCompositeOperation = 'source-over';
    mctx.strokeStyle = t.accent;
    mctx.lineWidth = stroke;
    wave();
    mctx.stroke();
  }

  let layer = null;
  function drawFirma(ctx, L, t, time, phase) {
    // A single easing over the whole morph keeps speed up through the triangle (no pause).
    const u = easeSine(seg(time, ...T.morph));
    const cam = easeSine(seg(time, ...T.camera));

    // Camera: big and centred -> final lockup position.
    const markH = 96 - L.apexY, midY = L.apexY + markH / 2;
    const s0 = (L.H * 0.58) / markH;
    const cx0 = L.W / 2 - 50 * s0, cy0 = L.H / 2 - midY * s0;
    const s1 = L.s, cx1 = L.markX, cy1 = L.baseline - 96 * s1;
    const sc = lerp(s0, s1, cam);
    let tx = lerp(cx0, cx1, cam), ty = lerp(cy0, cy1, cam);

    // Life: fall (gravity + stretch), then impact squash with a damped wobble.
    let sx = 1, sy = 1, alpha = 1;
    const fk = seg(time, ...T.fall);
    if (time < T.fall[1]) {
      const g = easeIn2(fk);
      ty -= (1 - g) * (L.H * 0.9);
      sy = lerp(1.0, 1.22, g); sx = lerp(1.0, 0.86, g);
      alpha = clamp01(fk * 5);
    } else {
      const d = time - T.settle;
      const q = 0.2 * Math.exp(-d * 4.2) * Math.cos(d * 13);
      sy = 1 - q; sx = 1 + q * 0.75;
    }
    // Scale about the drop's base while it lands, so it squashes onto the ground.
    const pivotX = 50, pivotY = 96;

    // Ripples on impact.
    const rd = time - T.settle;
    if (rd > 0 && rd < 1.4) {
      ctx.save();
      ctx.strokeStyle = t.accent;
      for (const delay of [0, 0.22]) {
        const p = clamp01((rd - delay) / 1.15);
        if (p <= 0 || p >= 1) continue;
        const rx = lerp(30, 118, easeOut(p)) * sc;
        ctx.globalAlpha = 0.45 * (1 - p);
        ctx.lineWidth = lerp(3, 0.8, p) * sc;
        ctx.beginPath();
        ctx.ellipse(tx + 50 * sc, ty + 97 * sc, rx, rx * 0.16, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Text slides out from behind the A (drawn first, clipped to the right of the A).
    const tk = seg(time, ...T.text);
    if (tk > 0) {
      const e = easeOut(tk);
      // Anchor to the A where it is now, so the text travels with it while it lands.
      const edge = tx + L.rightFootX * sc;
      const follow = edge - (L.markX + L.rightFootX * L.s);
      const by = (ty + 96 * sc) - L.baseline;
      ctx.save();
      ctx.translate(0, by);
      ctx.beginPath();
      ctx.rect(edge, -by, L.W - edge, L.H);
      ctx.clip();
      ctx.globalAlpha = clamp01(tk * 2.5);
      ctx.fillStyle = t.ink;
      const dx = lerp(-L.textW * 0.55, 0, e) + follow;
      ctx.font = font(600, L.size, 'Sora');
      ctx.fillText('qua', L.textX + dx, L.baseline);
      ctx.font = font(300, L.size, 'Sora');
      ctx.fillText('Specter', L.textX + L.wQua + dx, L.baseline);
      ctx.restore();
    }
    const gk = seg(time, ...T.tag);
    if (gk > 0) {
      ctx.save();
      ctx.globalAlpha = easeOut(gk);
      ctx.fillStyle = t.accent;
      ctx.font = font(400, 14, 'Sora');
      drawSpaced(ctx, 'BCC TECHNOLOGIES', L.markX + 2, L.baseline + 34 + lerp(6, 0, easeOut(gk)), 0.3 * 14);
      ctx.restore();
    }

    // Mark on its own layer so the wave knockout never punches the background.
    const cw = ctx.canvas.width, ch = ctx.canvas.height;
    if (!layer) layer = document.createElement('canvas');
    if (layer.width !== cw || layer.height !== ch) { layer.width = cw; layer.height = ch; }
    const mctx = layer.getContext('2d');
    mctx.setTransform(1, 0, 0, 1, 0, 0);
    mctx.clearRect(0, 0, cw, ch);
    mctx.setTransform(ctx.getTransform());
    mctx.translate(tx, ty);
    mctx.scale(sc, sc);
    mctx.translate(pivotX, pivotY);
    mctx.scale(sx, sy);
    mctx.translate(-pivotX, -pivotY);
    drawMark(mctx, L, t, u, phase, time);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = alpha;
    ctx.drawImage(layer, 0, 0);
    ctx.restore();
  }

  function firmaConcept(time) {
    return (ctx, t, phase, draw, opts) => {
      const L = firmaLayout(ctx, opts || {});
      if (draw) drawFirma(ctx, L, t, opts && opts.time != null ? opts.time : time, phase);
      return { w: L.W, h: L.H };
    };
  }

  const CONCEPTS = { firma: firmaConcept(T.end), gota: firmaConcept(1.4), 'q-onda': qOnda, monograma, espectro, sello };

  // ---------- public API ----------
  function render(canvas, opts = {}) {
    const concept = CONCEPTS[opts.concept || 'monograma'];
    if (!concept) throw new Error(`Concepto desconocido: ${opts.concept}`);
    const theme = THEMES[opts.theme || 'color'];
    const scale = opts.scale || global.devicePixelRatio || 1;
    const phase = opts.phase || 0;

    const ctx = canvas.getContext('2d');
    const { w, h } = concept(ctx, theme, phase, false, opts);
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
    concept(ctx, theme, phase, true, opts);
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

  // Intro: drop -> A -> "quaSpecter" slides out. Wave keeps flowing after the intro
  // unless opts.flow === false. opts.loop restarts it after opts.hold seconds.
  function intro(canvas, opts = {}) {
    const reduce = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const base = { ...opts, concept: 'firma' };
    if (reduce) {
      render(canvas, { ...base, time: T.end });
      return () => {};
    }
    const speed = opts.speed || 1.6, hold = opts.hold != null ? opts.hold : 3;
    let raf = 0, start = 0, done = false;
    const tick = (ts) => {
      if (!start) start = ts;
      let time = (ts - start) / 1000;
      if (opts.loop && time > T.end + hold) { start = ts; time = 0; }
      const flowing = opts.flow !== false || time < T.end;
      render(canvas, { ...base, time, phase: flowing ? time * speed : T.end * speed });
      if (!done && time >= T.end) { done = true; if (opts.onDone) opts.onDone(); }
      if (flowing || opts.loop || time < T.end) raf = global.requestAnimationFrame(tick);
    };
    raf = global.requestAnimationFrame(tick);
    return () => global.cancelAnimationFrame(raf);
  }

  function toPNG(opts = {}) {
    const c = document.createElement('canvas');
    render(c, { ...opts, scale: opts.scale || 4, cssSize: false });
    return c.toDataURL('image/png');
  }

  global.AquaSpecterLogo = { ready, render, animate, intro, toPNG, timeline: T, concepts: Object.keys(CONCEPTS), themes: Object.keys(THEMES) };
})(window);
