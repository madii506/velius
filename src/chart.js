// A candlestick chart on one canvas: live candles, volume, a price axis, a crosshair,
// and the trader's own lines (entry, take profit, stop, liquidation), which can be dragged.
import { px, dec } from './fmt.js';

const C = { up: '#2bd38f', down: '#ff4d6a', grid: 'rgba(255,255,255,.045)', axis: '#7f7a96', text: '#d9d4f2', bg: '#07070b' };

export class Chart {
  constructor(canvas, o = {}) {
    this.cv = canvas; this.g = canvas.getContext('2d');
    this.data = []; this.lines = []; this.hover = null; this.drag = null; this.o = { volume: true, axis: true, cross: true, gap: 7, ...o };
    this.onLine = null; this.mark = null;
    new ResizeObserver(() => this.size()).observe(canvas);
    this.size();
    if (this.o.cross) {
      canvas.addEventListener('pointermove', e => this.move(e));
      canvas.addEventListener('pointerleave', () => { this.hover = null; if (!this.drag) this.draw(); });
      canvas.addEventListener('pointerdown', e => this.down(e));
      addEventListener('pointerup', () => { if (this.drag) { this.drag = null; this.cv.style.cursor = ''; } });
    }
  }
  size() {
    const r = this.cv.getBoundingClientRect();
    this.dpr = Math.min(devicePixelRatio || 1, 2);
    this.W = Math.max(10, r.width); this.H = Math.max(10, r.height);
    this.cv.width = Math.round(this.W * this.dpr); this.cv.height = Math.round(this.H * this.dpr);
    this.draw();
  }
  set(data) { this.data = data.slice(); this.draw(); }
  push(k) {
    const last = this.data[this.data.length - 1];
    if (last && last.t === k.t) Object.assign(last, k); else if (!last || k.t > last.t) this.data.push(k);
    if (this.data.length > 1500) this.data.shift();
    this.draw();
  }
  setLines(lines) { this.lines = lines.filter(l => isFinite(l.price) && l.price > 0); this.draw(); }
  setMark(p) { this.mark = p; }

  view() {
    const padR = this.o.axis ? 74 : 8, padT = 12, padB = this.o.axis ? 22 : 6;
    const gap = this.o.gap, n = Math.max(5, Math.floor((this.W - padR - 6) / gap));
    const d = this.data.slice(-n);
    let lo = Infinity, hi = -Infinity;
    for (const k of d) { if (k.l < lo) lo = k.l; if (k.h > hi) hi = k.h; }
    for (const l of this.lines) if (l.fit !== false) { lo = Math.min(lo, l.price); hi = Math.max(hi, l.price); }
    if (!isFinite(lo)) { lo = 0; hi = 1; }
    const pad = (hi - lo) * 0.08 || hi * 0.01 || 1; lo -= pad; hi += pad;
    const volH = this.o.volume ? (this.H - padT - padB) * 0.16 : 0;
    const plotB = this.H - padB - volH;
    const x = i => 4 + (i + 0.5) * gap + (n - d.length) * gap;
    const y = p => padT + (hi - p) / (hi - lo) * (plotB - padT);
    const p = yy => hi - (yy - padT) / (plotB - padT) * (hi - lo);
    return { d, n, gap, lo, hi, x, y, p, padR, padT, padB, plotB, volH };
  }
  move(e) {
    const r = this.cv.getBoundingClientRect(); const mx = e.clientX - r.left, my = e.clientY - r.top;
    const v = this._v || this.view();
    if (this.drag) {
      const l = this.lines.find(q => q.id === this.drag);
      if (l) { l.price = Math.max(1e-12, v.p(my)); this.onLine && this.onLine(l.id, l.price); }
      this.draw(); return;
    }
    this.hover = { x: mx, y: my };
    const near = this.lines.find(l => l.drag && Math.abs(v.y(l.price) - my) < 6);
    this.cv.style.cursor = near ? 'ns-resize' : 'crosshair';
    this.draw();
  }
  down(e) {
    const r = this.cv.getBoundingClientRect(); const my = e.clientY - r.top, v = this._v || this.view();
    const near = this.lines.find(l => l.drag && Math.abs(v.y(l.price) - my) < 7);
    if (near) { this.drag = near.id; this.cv.setPointerCapture && this.cv.setPointerCapture(e.pointerId); e.preventDefault(); }
  }
  draw() {
    const g = this.g; if (!g || !this.W) return;
    const v = this._v = this.view();
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, this.W, this.H);
    const right = this.W - v.padR;
    // grid and price axis
    g.font = '500 10.5px Mono, ui-monospace, monospace'; g.textBaseline = 'middle';
    const steps = 6, d0 = dec((v.hi + v.lo) / 2);
    for (let i = 0; i <= steps; i++) {
      const yy = v.padT + i * (v.plotB - v.padT) / steps;
      g.strokeStyle = C.grid; g.lineWidth = 1; g.beginPath(); g.moveTo(0, Math.round(yy) + .5); g.lineTo(right, Math.round(yy) + .5); g.stroke();
      if (this.o.axis) { g.fillStyle = C.axis; g.fillText(px(v.p(yy), d0), right + 8, yy); }
    }
    if (!v.d.length) { g.fillStyle = C.axis; g.font = '500 12px Text, sans-serif'; g.fillText('Loading candles…', 16, this.H / 2); return; }
    // volume
    if (this.o.volume) {
      const vmax = Math.max(...v.d.map(k => k.v || 0), 1e-9);
      v.d.forEach((k, i) => { const h = (k.v || 0) / vmax * v.volH; g.fillStyle = k.c >= k.o ? 'rgba(43,211,143,.18)' : 'rgba(255,77,106,.18)'; g.fillRect(v.x(i) - v.gap * 0.32, this.H - v.padB - h, Math.max(1, v.gap * 0.64), h); });
    }
    // candles
    const bw = Math.max(1, v.gap * 0.64);
    v.d.forEach((k, i) => {
      const up = k.c >= k.o, xx = Math.round(v.x(i)) + .5;
      g.strokeStyle = g.fillStyle = up ? C.up : C.down;
      g.lineWidth = 1; g.beginPath(); g.moveTo(xx, v.y(k.h)); g.lineTo(xx, v.y(k.l)); g.stroke();
      const y1 = v.y(Math.max(k.o, k.c)), y2 = v.y(Math.min(k.o, k.c));
      g.fillRect(xx - bw / 2, y1, bw, Math.max(1, y2 - y1));
    });
    // the trader's lines: drawn here, on this screen, and nowhere else
    for (const l of this.lines) {
      const yy = Math.round(v.y(l.price)) + .5;
      if (yy < v.padT - 2 || yy > v.plotB + 2) continue;
      g.strokeStyle = l.color; g.lineWidth = l.id === 'entry' ? 1.3 : 1; g.setLineDash(l.dash ? [5, 4] : []);
      g.beginPath(); g.moveTo(0, yy); g.lineTo(right, yy); g.stroke(); g.setLineDash([]);
      const label = l.label + '  ' + px(l.price);
      g.font = '600 10.5px Mono, ui-monospace, monospace';
      const tw = g.measureText(label).width + 14;
      g.fillStyle = 'rgba(10,9,18,.92)'; g.strokeStyle = l.color;
      g.beginPath(); g.roundRect ? g.roundRect(right - tw - 6, yy - 9, tw, 18, 4) : g.rect(right - tw - 6, yy - 9, tw, 18); g.fill(); g.stroke();
      g.fillStyle = l.color; g.fillText(label, right - tw + 1, yy + .5);
    }
    // the last price
    const last = v.d[v.d.length - 1], lp = this.mark || last.c, ly = v.y(lp);
    if (this.o.axis && ly > v.padT - 4 && ly < v.plotB + 4) {
      g.strokeStyle = 'rgba(217,212,242,.35)'; g.setLineDash([2, 3]); g.beginPath(); g.moveTo(0, Math.round(ly) + .5); g.lineTo(right, Math.round(ly) + .5); g.stroke(); g.setLineDash([]);
      g.fillStyle = last.c >= last.o ? C.up : C.down;
      g.beginPath(); g.roundRect ? g.roundRect(right + 2, ly - 9, v.padR - 4, 18, 4) : g.rect(right + 2, ly - 9, v.padR - 4, 18); g.fill();
      g.fillStyle = '#07070b'; g.font = '700 10.5px Mono, ui-monospace, monospace'; g.fillText(px(lp, d0), right + 8, ly + .5);
    }
    // crosshair
    if (this.hover && this.o.cross && !this.drag) {
      const { x: hx, y: hy } = this.hover;
      if (hx < right && hy > v.padT && hy < v.plotB) {
        g.strokeStyle = 'rgba(217,212,242,.28)'; g.setLineDash([3, 3]);
        g.beginPath(); g.moveTo(hx + .5, v.padT); g.lineTo(hx + .5, this.H - v.padB); g.moveTo(0, hy + .5); g.lineTo(right, hy + .5); g.stroke(); g.setLineDash([]);
        g.fillStyle = '#2a2540'; g.beginPath(); g.roundRect ? g.roundRect(right + 2, hy - 9, v.padR - 4, 18, 4) : g.rect(right + 2, hy - 9, v.padR - 4, 18); g.fill();
        g.fillStyle = C.text; g.font = '600 10.5px Mono, ui-monospace, monospace'; g.fillText(px(v.p(hy), d0), right + 8, hy + .5);
        const i = Math.round((hx - 4) / v.gap - 0.5) - (v.n - v.d.length);
        const k = v.d[i];
        if (k && this.o.onHover) this.o.onHover(k);
      } else if (this.o.onHover) this.o.onHover(null);
    }
  }
}
