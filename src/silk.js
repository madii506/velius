// Slow silk: thin lines drifting like a veil. Pauses off screen and in a hidden tab; still under reduced motion.
import { calm } from './fx.js';

export function silk(cv, { n = 36, amp = 0.08, speed = 1, alpha = 1, top = 0.1, span = 0.8 } = {}) {
  const g = cv.getContext('2d'); let W = 0, H = 0, raf = 0, on = false;
  const size = () => { const r = cv.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 1.5); W = r.width; H = r.height; cv.width = Math.max(1, W * d); cv.height = Math.max(1, H * d); g.setTransform(d, 0, 0, d, 0, 0); draw(performance.now()); };
  const draw = t => {
    g.clearRect(0, 0, W, H);
    const k = W < 700 ? Math.round(n * 0.6) : n;
    for (let i = 0; i < k; i++) {
      const f = k > 1 ? i / (k - 1) : 0.5, hot = i % 7 === 2;
      g.strokeStyle = `rgba(150,130,255,${(0.05 + 0.4 * Math.pow(Math.max(0, 1 - Math.abs(f - 0.5) * 1.5), 2)) * (hot ? 1 : 0.6) * alpha})`;
      g.lineWidth = hot ? 1.3 : 0.8;
      g.beginPath();
      for (let x = -10; x <= W + 10; x += 10) {
        const u = x / W;
        const y = H * (top + span * f) + Math.sin(u * 3.6 + f * 3 + t * 0.00018 * speed) * H * amp + Math.sin(u * 8 - t * 0.0003 * speed) * H * amp * 0.19;
        x < 0 ? g.moveTo(x, y) : g.lineTo(x, y);
      }
      g.stroke();
    }
  };
  const loop = t => { draw(t); if (on && !calm && !document.hidden) raf = requestAnimationFrame(loop); };
  addEventListener('resize', size, { passive: true });
  new IntersectionObserver(es => { on = es[0].isIntersecting; cancelAnimationFrame(raf); if (on) raf = requestAnimationFrame(loop); }).observe(cv);
  document.addEventListener('visibilitychange', () => { cancelAnimationFrame(raf); if (on && !document.hidden) raf = requestAnimationFrame(loop); });
  size();
}
