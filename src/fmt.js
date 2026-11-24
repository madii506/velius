// number formats for a trading desk: prices keep Hyperliquid's precision, money stays readable
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function dec(p) {
  if (!isFinite(p) || p === 0) return 2;
  const a = Math.abs(p);
  if (a >= 10000) return 0; if (a >= 1000) return 1; if (a >= 100) return 2; if (a >= 10) return 3; if (a >= 1) return 4;
  return Math.min(8, 4 - Math.floor(Math.log10(a)));
}
export const px = (p, d) => isFinite(p) ? (+p).toLocaleString('en-US', { minimumFractionDigits: d ?? dec(p), maximumFractionDigits: d ?? dec(p) }) : '—';
export const usd = (n, d = 2) => isFinite(n) ? (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
export function big(n) {
  if (!isFinite(n)) return '—';
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (a >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (a >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toFixed(a >= 100 ? 0 : 2);
}
export const usdBig = n => isFinite(n) ? '$' + big(n) : '—';
export const pct = (n, d = 2) => isFinite(n) ? (n > 0 ? '+' : '') + n.toFixed(d) + '%' : '—';
export const sz = (n, d = 4) => isFinite(n) ? (+n).toLocaleString('en-US', { maximumFractionDigits: d }) : '—';
export const short = a => a ? a.slice(0, 4) + '…' + a.slice(-4) : '';
export const int = n => isFinite(n) ? Math.round(n).toLocaleString('en-US') : '—';
export const clock = ms => { const s = Math.max(0, Math.floor(ms / 1000)); const m = Math.floor(s / 60), r = s % 60; return String(m).padStart(2, '0') + ':' + String(r).padStart(2, '0'); };
export const ago = t => { const s = Math.max(0, Math.floor((Date.now() - t) / 1000)); return s < 60 ? s + 's' : s < 3600 ? Math.floor(s / 60) + 'm' : Math.floor(s / 3600) + 'h'; };
export const cls = n => n > 0 ? 'up' : n < 0 ? 'down' : '';

export async function getJSON(url, ms = 9000) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(url, { signal: c.signal }); const j = await r.json(); if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status); return j; }
  finally { clearTimeout(t); }
}
export const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
};
