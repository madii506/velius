// The hero: the live public book of four markets sits under a veil of silk.
// Where your pointer is, the veil lifts and the book shows through. On touch screens the lift drifts by itself.
import { subscribe } from './hl.js';
import { dec } from './fmt.js';
import { calm } from './fx.js';

export function veil(canvas, coins = ['BTC', 'ETH', 'SOL', 'HYPE']) {
  const g = canvas.getContext('2d');
  const book = document.createElement('canvas'), bg = book.getContext('2d');
  const sheet = document.createElement('canvas'), sg = sheet.getContext('2d');
  const levels = {};
  let W = 0, H = 0, dpr = 1, dirty = true, visible = true, t0 = performance.now();
  const touch = matchMedia('(hover: none)').matches;
  const p = { x: -9999, y: -9999, tx: -9999, ty: -9999, r: 0, tr: 0, seen: false };

  function size() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, W > 1200 ? 1.25 : 1.5);
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    for (const c of [canvas, book, sheet]) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    dirty = true;
  }
  addEventListener('resize', size, { passive: true });
  size();

  // the book, drawn only when a level changes
  for (const c of coins) subscribe({ type: 'l2Book', coin: c }, d => { levels[c] = d.levels; dirty = true; });
  const rowH = () => (W < 700 ? 15 : 17);
  function drawBook() {
    bg.setTransform(dpr, 0, 0, dpr, 0, 0);
    bg.clearRect(0, 0, W, H);
    const cols = W < 700 ? 2 : W < 1100 ? 3 : 4;
    const cw = W / cols, rh = rowH(), rows = Math.ceil(H / rh) + 1, half = Math.floor(rows / 2);
    bg.font = `500 ${W < 700 ? 10.5 : 12}px Mono, ui-monospace, monospace`;
    bg.textBaseline = 'middle';
    for (let k = 0; k < cols; k++) {
      const coin = coins[k], L = levels[coin]; if (!L) continue;
      const [bids, asks] = L, x = k * cw + cw * 0.14;
      const d = dec(+(bids[0] || asks[0] || { px: 1 }).px);
      const maxSz = Math.max(...bids.concat(asks).map(l => +l.sz), 1e-9);
      for (let i = 0; i < rows; i++) {
        const y = i * rh + rh / 2;
        let lv, side;
        if (i < half) { lv = asks[half - 1 - i]; side = 'a'; } else if (i === half) { lv = null; side = 'm'; } else { lv = bids[i - half - 1]; side = 'b'; }
        if (side === 'm') {
          bg.fillStyle = 'rgba(212,204,255,.9)';
          bg.fillText(coin + '  ' + (+asks[0].px - +bids[0].px).toFixed(d) + ' spread', x, y);
          continue;
        }
        if (!lv) continue;
        const w = Math.max(6, (+lv.sz / maxSz) ** 0.55 * cw * 0.5);
        bg.fillStyle = side === 'a' ? 'rgba(255,77,106,.16)' : 'rgba(43,211,143,.14)';
        bg.fillRect(x + cw * 0.72 - w, y - rh / 2 + 2, w, rh - 4);
        bg.fillStyle = side === 'a' ? 'rgba(255,120,140,.92)' : 'rgba(90,230,170,.9)';
        bg.fillText((+lv.px).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }), x, y);
        bg.fillStyle = 'rgba(214,210,235,.7)';
        bg.fillText((+lv.sz).toLocaleString('en-US', { maximumFractionDigits: 3 }), x + cw * 0.34, y);
      }
    }
    dirty = false;
  }

  // the veil: dark silk with long folds, lifted around the pointer
  function drawVeil(t) {
    sg.setTransform(dpr, 0, 0, dpr, 0, 0);
    sg.globalCompositeOperation = 'source-over';
    sg.clearRect(0, 0, W, H);
    sg.fillStyle = 'rgba(7,7,11,.965)';
    sg.fillRect(0, 0, W, H);
    const n = W < 700 ? 26 : 44, step = W < 700 ? 10 : 8;
    sg.lineWidth = 1;
    for (let k = 0; k < n; k++) {
      const f = k / (n - 1), hot = k % 8 === 3;
      const a = (0.16 + 0.5 * Math.pow(1 - Math.abs(f - 0.55) * 1.4, 2)) * (hot ? 1 : 0.55);
      sg.strokeStyle = `rgba(150,130,255,${Math.max(0.04, a).toFixed(3)})`;
      sg.lineWidth = hot ? 1.4 : 0.8;
      sg.beginPath();
      for (let x = -20; x <= W + 20; x += step) {
        const u = x / W;
        let y = H * (0.06 + 0.9 * f) + Math.sin(u * 4.4 + f * 2.6 + t * 0.00022) * H * 0.07 + Math.sin(u * 9 - f * 3.2 - t * 0.0004) * H * 0.018;
        // the cloth bulges away from the lifted spot
        if (p.r > 1) { const dx = x - p.x, dy = y - p.y, d2 = dx * dx + dy * dy, R = p.r * 1.6; if (d2 < R * R) { const k2 = 1 - Math.sqrt(d2) / R; y += Math.sign(dy || 1) * k2 * k2 * p.r * 0.5; } }
        x === -20 ? sg.moveTo(x, y) : sg.lineTo(x, y);
      }
      sg.stroke();
    }
    // the lift: a soft hole where the pointer is
    if (p.r > 1) {
      sg.globalCompositeOperation = 'destination-out';
      const rg = sg.createRadialGradient(p.x, p.y, p.r * 0.15, p.x, p.y, p.r);
      rg.addColorStop(0, 'rgba(0,0,0,.94)'); rg.addColorStop(0.55, 'rgba(0,0,0,.62)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
      sg.fillStyle = rg; sg.beginPath(); sg.arc(p.x, p.y, p.r, 0, Math.PI * 2); sg.fill();
    }
  }

  function frame(now) {
    if (!visible || document.hidden) return;
    const t = now - t0;
    if (touch || !p.seen) {                       // the lift drifts on its own until a pointer takes over
      p.tx = W * (0.5 + 0.34 * Math.sin(t * 0.00021)); p.ty = H * (0.5 + 0.26 * Math.sin(t * 0.00033 + 1.3)); p.tr = Math.min(W, H) * (W < 700 ? 0.34 : 0.24);
    }
    p.x += (p.tx - p.x) * 0.14; p.y += (p.ty - p.y) * 0.14; p.r += (p.tr - p.r) * 0.08;
    if (p.x < -999) { p.x = p.tx; p.y = p.ty; }
    if (dirty) drawBook();
    drawVeil(t);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.drawImage(book, 0, 0);
    g.drawImage(sheet, 0, 0);
    if (!calm) raf = requestAnimationFrame(frame);
  }
  let raf = 0;
  const host = canvas.parentElement;
  host.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') return;
    const r = canvas.getBoundingClientRect();
    p.seen = true; p.tx = e.clientX - r.left; p.ty = e.clientY - r.top; p.tr = Math.min(260, Math.max(170, W * 0.13));
  }, { passive: true });
  host.addEventListener('pointerleave', () => { p.seen = false; }, { passive: true });
  if ('IntersectionObserver' in window) new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) { cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); } }).observe(canvas);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && visible) { cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); } });
  raf = requestAnimationFrame(frame);
  if (calm) setInterval(() => { if (dirty) requestAnimationFrame(frame); }, 1000);
  return { levels };
}
