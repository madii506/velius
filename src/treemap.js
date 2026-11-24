// A live heatmap of the market: each tile's area is a market's share (volume or open interest),
// its colour is the 24h move on a diverging scale with a neutral middle, and its label carries the signed number,
// so colour is never the only way to read it. Tiles are real links and buttons, reachable by keyboard.
import { esc, px, pct, usdBig, fund } from './fmt.js';

// squarified layout (Bruls, Huizing, van Wijk): rows that keep tiles as close to square as possible
export function squarify(items, x, y, w, h) {
  const out = [], total = items.reduce((a, b) => a + b.v, 0);
  if (!total || w <= 0 || h <= 0) return out;
  const scale = (w * h) / total;
  let rest = items.map(it => ({ it, a: it.v * scale }));
  let rx = x, ry = y, rw = w, rh = h;
  while (rest.length) {
    const side = Math.min(rw, rh);
    let row = [], best = Infinity, i = 0, sum = 0, mx = 0, mn = Infinity;
    while (i < rest.length) {
      const a = rest[i].a, s = sum + a, M = Math.max(mx, a), m = Math.min(mn, a);
      const worst = Math.max((side * side * M) / (s * s), (s * s) / (side * side * m));
      if (row.length && worst > best) break;
      best = worst; row.push(rest[i]); sum = s; mx = M; mn = m; i++;
    }
    if (rw >= rh) {
      const cw = sum / rh; let cy = ry;
      for (const r of row) { const ch = r.a / cw; out.push({ it: r.it, x: rx, y: cy, w: cw, h: ch }); cy += ch; }
      rx += cw; rw -= cw;
    } else {
      const ch = sum / rw; let cx = rx;
      for (const r of row) { const cw = r.a / ch; out.push({ it: r.it, x: cx, y: ry, w: cw, h: ch }); cx += cw; }
      ry += ch; rh -= ch;
    }
    rest = rest.slice(row.length);
  }
  return out;
}

// diverging scale: red ← neutral grey → green, equal steps per arm, eased so small moves still read
const NEU = [36, 35, 46], UP = [18, 140, 94], DN = [186, 50, 74];
export function tone(chg, cap) {
  if (!isFinite(chg)) return `rgb(${NEU.join(',')})`;
  const t = Math.min(1, Math.abs(chg) / cap) ** 0.72, to = chg >= 0 ? UP : DN;
  return `rgb(${NEU.map((v, i) => Math.round(v + (to[i] - v) * t)).join(',')})`;
}
export function capOf(list) {
  const a = list.map(m => Math.abs(m.chg)).filter(isFinite).sort((x, y) => x - y);
  if (!a.length) return 5;
  const p = a[Math.floor(a.length * 0.85)] || a[a.length - 1];
  return Math.max(2, Math.min(15, Math.ceil(p)));
}

// draw (or redraw) the map into a box; returns { recolor } for live price updates without a relayout
export function treemap(box, list, { metric = 'vol', max = 80, href = null, otherHref = null, onPick = null, live = () => null } = {}) {
  const W = box.clientWidth, H = box.clientHeight;
  const sorted = list.filter(m => m[metric] > 0).sort((a, b) => b[metric] - a[metric]);
  const top = sorted.slice(0, max), tail = sorted.slice(max);
  const items = top.map(m => ({ m, v: m[metric] }));
  if (tail.length) items.push({ other: tail, v: tail.reduce((a, m) => a + m[metric], 0) });
  const cap = capOf(top);
  const rects = squarify(items, 0, 0, W, H);
  box.dataset.cap = cap;
  box.innerHTML = rects.map((r, i) => {
    const w = Math.max(0, r.w - 2), h = Math.max(0, r.h - 2), st = `left:${(r.x + 1).toFixed(1)}px;top:${(r.y + 1).toFixed(1)}px;width:${w.toFixed(1)}px;height:${h.toFixed(1)}px`;
    if (r.it.other) {
      const n = r.it.other.length;
      const inner = `<span class="tn">+${n}</span>${h > 36 && w > 60 ? `<span class="tc">more</span>` : ''}`;
      return otherHref ? `<a class="tile other" href="${otherHref}" data-other="1" style="${st}" aria-label="${n} more markets">${inner}</a>` : `<button class="tile other" type="button" data-other="1" style="${st}" aria-label="${n} more markets">${inner}</button>`;
    }
    const m = r.it.m, name = esc(m.name);
    const area = w * h, big = area > 16000 && h > 70, show = w > 34 && h > 22;
    const fs = Math.max(10, Math.min(big ? 30 : 18, w / Math.max(3, m.name.length * 0.66), h / (big ? 3.2 : 2.3)));
    const label = `${m.name}, ${pct(m.chg)} over 24 hours, ${usdBig(m[metric])} ${metric === 'vol' ? 'volume' : 'open interest'}`;
    const inner = show ? `<span class="tn" style="font-size:${fs.toFixed(1)}px">${name}</span><span class="tc" style="font-size:${Math.max(9.5, fs * 0.56).toFixed(1)}px">${pct(m.chg)}</span>${big ? `<span class="tp">${px(live(m.name) || m.mark)}</span>` : ''}` : '';
    const tag = href ? `a href="${href(m)}"` : 'button type="button"';
    return `<${tag} class="tile" data-c="${name}" style="${st};background:${tone(m.chg, cap)}" aria-label="${esc(label)}">${inner}</${href ? 'a' : 'button'}>`;
  }).join('');
  const byName = new Map([...box.querySelectorAll('.tile[data-c]')].map(t => [t.dataset.c, t]));
  if (onPick) box.onclick = e => { const t = e.target.closest('.tile'); if (!t) return; if (!href) e.preventDefault(); onPick(t.dataset.other ? null : t.dataset.c); };
  return {
    cap,
    recolor(by) {
      for (const [n, t] of byName) {
        const m = by[n]; if (!m) continue;
        t.style.background = tone(m.chg, cap);
        const c = t.querySelector('.tc'); if (c) c.textContent = pct(m.chg);
        const p = t.querySelector('.tp'); if (p) p.textContent = px(live(n) || m.mark);
      }
    },
  };
}

// one tooltip for the whole map, positioned by the pointer; the same facts are in each tile's label and in the table
export function mapTip(box, tip, by, live = () => null) {
  const hide = () => tip.classList.remove('on');
  box.addEventListener('pointermove', e => {
    const t = e.target.closest('.tile[data-c]'); if (!t) return hide();
    const m = by()[t.dataset.c]; if (!m) return hide();
    tip.innerHTML = `<b>${esc(m.name)} <em class="${m.chg >= 0 ? 'up' : 'down'}">${pct(m.chg)}</em></b><span>${px(live(m.name) || m.mark)}</span><span>Volume ${usdBig(m.vol)}</span><span>Open interest ${usdBig(m.oi)}</span><span>Funding ${fund(m.funding)} an hour</span>`;
    const r = box.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    tip.style.left = Math.min(r.width - 90, Math.max(90, x)) + 'px'; tip.style.top = y + 'px';
    tip.classList.add('on');
  });
  box.addEventListener('pointerleave', hide);
}
