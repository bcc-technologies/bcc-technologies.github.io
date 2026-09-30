/* AquaSpecter product page: live logo intro, brand symbols and illustrative EIS charts. */
(function () {
  'use strict';

  const root = document.documentElement;
  const isEnglish = root.lang === 'en';
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function isDark() {
    if (root.dataset.theme === 'dark') return true;
    if (root.dataset.theme === 'light') return false;
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  function whenVisible(el, fn) {
    if (!('IntersectionObserver' in window)) return fn();
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { io.disconnect(); fn(); }
    }, { threshold: 0.25 });
    io.observe(el);
  }

  function onThemeChange(fn) {
    new MutationObserver(fn).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', fn);
  }

  // ---------- Logo: hero intro, step symbols, closing band ----------
  function initLogo() {
    const Logo = window.AquaSpecterLogo;
    if (!Logo) return;
    Logo.ready().then(() => {
      const hero = document.getElementById('aqHeroLogo');
      const replay = document.querySelector('[data-aq-replay]');
      let stop = () => {};
      const play = () => {
        stop();
        stop = Logo.intro(hero, { theme: 'inverse', transparent: true, stage: '3:2' });
      };
      if (hero) {
        Logo.render(hero, { concept: 'gota', theme: 'inverse', transparent: true, stage: '3:2', time: 0 });
        whenVisible(hero, play);
        if (replay) {
          if (reduceMotion) replay.hidden = true;
          replay.addEventListener('click', play);
        }
      }

      const symbols = () => {
        const theme = isDark() ? 'inverse' : 'color';
        document.querySelectorAll('canvas[data-aq-symbol]').forEach((c) => {
          const onBand = c.closest('.aq-band');
          Logo.render(c, { concept: c.dataset.aqSymbol, theme: onBand ? 'inverse' : theme, transparent: true });
        });
      };
      symbols();
      onThemeChange(symbols);
    });
  }

  // ---------- Step 2: the AC excitation signal, flowing ----------
  function initSignal() {
    const c = document.querySelector('canvas[data-aq-signal]');
    if (!c) return;
    const ctx = c.getContext('2d');
    const size = 104, dpr = window.devicePixelRatio || 1;
    c.width = size * dpr; c.height = size * dpr;
    let phase = 0, raf = 0;
    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      ctx.lineCap = 'round';
      ctx.strokeStyle = isDark() ? '#5CC8E4' : '#1497B8';
      ctx.lineWidth = 7;
      ctx.beginPath();
      for (let i = 0; i <= 120; i++) {
        const t = i / 120, x = 10 + t * 84, y = 52 - 13 * Math.sin(Math.PI * 4 * t + phase);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    };
    const loop = () => { phase += 0.045; draw(); raf = requestAnimationFrame(loop); };
    draw();
    onThemeChange(draw);
    if (!reduceMotion) whenVisible(c, () => { raf = requestAnimationFrame(loop); });
  }

  // ---------- Illustrative EIS response: Randles circuit with Warburg ----------
  // Rs + [Rct + Zw] || Cdl. Shape only; not measured AquaSpecter data.
  const RS = 20, RCT = 250, CDL = 20e-6, SIGMA = 40;
  function impedance(f) {
    const w = 2 * Math.PI * f;
    const zwRe = SIGMA / Math.sqrt(w), zwIm = -SIGMA / Math.sqrt(w);
    const aRe = RCT + zwRe, aIm = zwIm;                  // Rct + Zw
    const den = aRe * aRe + aIm * aIm;
    const yRe = aRe / den, yIm = -aIm / den + w * CDL;   // 1/(Rct+Zw) + jωC
    const d2 = yRe * yRe + yIm * yIm;
    return { re: RS + yRe / d2, im: -yIm / d2 };
  }
  const FREQS = Array.from({ length: 80 }, (_, i) => Math.pow(10, 5 - (i * 7) / 79)); // 100 kHz -> 10 mHz

  function chartColors() {
    const dark = isDark();
    return {
      ink: dark ? '#E8F1F7' : '#0B2A4A',
      soft: dark ? '#A9BED0' : '#5B7189',
      grid: dark ? '#1F3346' : '#E3EBF1',
      aqua: dark ? '#5CC8E4' : '#1497B8',
    };
  }

  function setupCanvas(c) {
    const rect = c.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(240, rect.width), h = w * 0.75;
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }

  function axes(ctx, box, col, xLabel, yLabel) {
    ctx.strokeStyle = col.grid; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = box.y + (box.h * i) / 4;
      ctx.beginPath(); ctx.moveTo(box.x, y); ctx.lineTo(box.x + box.w, y); ctx.stroke();
    }
    ctx.strokeStyle = col.soft;
    ctx.beginPath(); ctx.moveTo(box.x, box.y); ctx.lineTo(box.x, box.y + box.h); ctx.lineTo(box.x + box.w, box.y + box.h); ctx.stroke();
    ctx.fillStyle = col.soft;
    ctx.font = '500 11px Sora, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(xLabel, box.x + box.w, box.y + box.h + 18);
    ctx.save();
    ctx.translate(box.x - 10, box.y);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'right';
    ctx.fillText(yLabel, 0, 0);
    ctx.restore();
  }

  function drawNyquist(c, k) {
    const { ctx, w, h } = setupCanvas(c);
    const col = chartColors();
    const box = { x: 30, y: 12, w: w - 44, h: h - 44 };
    axes(ctx, box, col, "Z′ (Ω)", "−Z″ (Ω)");
    const pts = FREQS.map(impedance);
    // Equal Ω-per-pixel on both axes so the semicircle keeps its true shape.
    const ohm = Math.min(box.w / 470, box.h / 300);
    const X = (re) => box.x + re * ohm;
    const Y = (im) => box.y + box.h + im * ohm;
    const n = Math.max(2, Math.round(pts.length * k));
    ctx.strokeStyle = col.aqua; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
    ctx.beginPath();
    pts.slice(0, n).forEach((p, i) => (i ? ctx.lineTo(X(p.re), Y(p.im)) : ctx.moveTo(X(p.re), Y(p.im))));
    ctx.stroke();
    ctx.fillStyle = col.ink;
    pts.slice(0, n).forEach((p, i) => { if (i % 6 === 3) { ctx.beginPath(); ctx.arc(X(p.re), Y(p.im), 2.6, 0, Math.PI * 2); ctx.fill(); } });
  }

  function drawBode(c, k) {
    const { ctx, w, h } = setupCanvas(c);
    const col = chartColors();
    const box = { x: 30, y: 12, w: w - 44, h: h - 44 };
    axes(ctx, box, col, 'log f (Hz)', '');
    const pts = FREQS.map((f) => ({ f, z: impedance(f) })).reverse(); // low -> high f
    const X = (f) => box.x + ((Math.log10(f) + 2) / 7) * box.w;
    const mag = (z) => Math.log10(Math.hypot(z.re, z.im));
    const magMin = Math.log10(15), magMax = Math.log10(1500);
    const YM = (z) => box.y + box.h - ((mag(z) - magMin) / (magMax - magMin)) * box.h;
    const YP = (z) => box.y + box.h - ((-Math.atan2(z.im, z.re) * 180) / Math.PI / 90) * box.h;
    const n = Math.max(2, Math.round(pts.length * k));
    const line = (Y, color, dash) => {
      ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.setLineDash(dash);
      ctx.beginPath();
      pts.slice(0, n).forEach((p, i) => (i ? ctx.lineTo(X(p.f), Y(p.z)) : ctx.moveTo(X(p.f), Y(p.z))));
      ctx.stroke();
      ctx.setLineDash([]);
    };
    line(YM, col.ink, []);
    line(YP, col.aqua, [6, 4]);
    ctx.font = '500 11px Sora, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = col.ink; ctx.fillText('|Z|', box.x + 8, box.y + 14);
    ctx.fillStyle = col.aqua; ctx.fillText(isEnglish ? '−φ (phase)' : '−φ (fase)', box.x + 36, box.y + 14);
  }

  function initCharts() {
    const nyq = document.getElementById('aqNyquist');
    const bode = document.getElementById('aqBode');
    if (!nyq || !bode) return;
    let k = reduceMotion ? 1 : 0;
    const draw = () => { drawNyquist(nyq, k); drawBode(bode, k); };
    draw();
    onThemeChange(draw);
    window.addEventListener('resize', draw);
    if (!reduceMotion) {
      whenVisible(nyq, () => {
        const t0 = performance.now();
        const step = (t) => {
          k = Math.min(1, (t - t0) / 1600);
          draw();
          if (k < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    }
  }

  function init() {
    initLogo();
    initSignal();
    initCharts();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
