// motion: reveal on scroll, decoding text, sealed ciphers, a neon flicker for the name, count-ups, card spotlights
import { $$ } from './fmt.js';
export const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function reveal(root = document) {
  const els = $$('.rv', root);
  if (calm || !('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('shown')); return; }
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target; io.unobserve(el);
    el.classList.add('shown');
    $$('[data-decode]', el).forEach((d, i) => setTimeout(() => decode(d), 120 + i * 90));
  }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  els.forEach(e => io.observe(e));
  setTimeout(() => els.forEach(e => e.classList.add('shown')), 6000);       // backstop: nothing stays hidden
}

const GLYPHS = '0123456789abcdef#%&*+=<>/\\';
export function decode(el, ms = 700) {
  const target = el.dataset.text || el.textContent;
  el.dataset.text = target;
  if (calm) { el.textContent = target; return; }
  const start = performance.now();
  const step = now => {
    const t = Math.min(1, (now - start) / ms);
    const n = Math.floor(target.length * t);
    let s = target.slice(0, n);
    for (let i = n; i < target.length; i++) s += target[i] === ' ' ? ' ' : GLYPHS[(Math.random() * GLYPHS.length) | 0];
    el.textContent = s;
    if (t < 1) requestAnimationFrame(step); else el.textContent = target;
  };
  requestAnimationFrame(step);
}

// a sealed value: hex that keeps rolling, never the number
export function cipher(el, len = 10) {
  const H = '0123456789abcdef';
  const roll = () => { let s = ''; for (let i = 0; i < len; i++) s += H[(Math.random() * 16) | 0]; el.textContent = s; };
  roll();
  if (calm) return;
  setInterval(() => { if (!document.hidden) roll(); }, 140 + Math.random() * 160);
}

// the name flickers like a tube that is almost, but not quite, steady
export function flicker(el) {
  const text = el.textContent;
  el.setAttribute('aria-label', text);
  el.innerHTML = [...text].map(c => `<span aria-hidden="true">${c}</span>`).join('');
  if (calm) return;
  const spans = [...el.children];
  const seq = [[0, .12], [40, 1], [80, .3], [130, 1], [190, .55], [240, 1]];
  const one = s => seq.forEach(([t, o]) => setTimeout(() => { s.style.opacity = o; }, t));
  const loop = () => {
    if (!document.hidden) {
      const r = Math.random();
      if (r < 0.62) one(spans[(Math.random() * spans.length) | 0]);
      else if (r < 0.9) { one(spans[(Math.random() * spans.length) | 0]); setTimeout(() => one(spans[(Math.random() * spans.length) | 0]), 160); }
      else {
        el.classList.add('glitch');
        spans.forEach((s, i) => setTimeout(() => one(s), i * 30));
        setTimeout(() => el.classList.remove('glitch'), 260);
      }
    }
    setTimeout(loop, 900 + Math.random() * 2600);
  };
  setTimeout(loop, 1400);
}

export function countTo(el, to, f = v => Math.round(v).toLocaleString('en-US'), ms = 1100) {
  const from = +(el.dataset.v || 0);
  el.dataset.v = to;
  if (calm || !isFinite(from) || from === to) { el.textContent = f(to); return; }
  const start = performance.now();
  const step = now => { const t = Math.min(1, (now - start) / ms), e = 1 - Math.pow(1 - t, 3); el.textContent = f(from + (to - from) * e); if (t < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

// cards light up under the pointer
export function spotlight(root = document) {
  if (calm || matchMedia('(hover: none)').matches) return;
  root.addEventListener('pointermove', e => {
    const c = e.target.closest && e.target.closest('.spot'); if (!c) return;
    const r = c.getBoundingClientRect();
    c.style.setProperty('--mx', (e.clientX - r.left) + 'px'); c.style.setProperty('--my', (e.clientY - r.top) + 'px');
  }, { passive: true });
}

// a value that just changed flashes in its direction
export function flash(el, dir) {
  if (!el || calm) return;
  el.classList.remove('fl-up', 'fl-down'); void el.offsetWidth;
  el.classList.add(dir > 0 ? 'fl-up' : 'fl-down');
}
