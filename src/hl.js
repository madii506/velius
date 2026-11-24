// Hyperliquid's public market data, read straight from its API and its websocket.
// Nothing about the visitor is sent: these are the same public reads any chart makes.
export const HL = 'https://api.hyperliquid.xyz';
const WS_URL = 'wss://api.hyperliquid.xyz/ws';

export async function info(body, ms = 10000) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(HL + '/info', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: c.signal });
    if (!r.ok) throw new Error('Hyperliquid ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}

// ---------- every perp market, with its live context ----------
export const markets = { list: [], by: {}, at: 0 };
const listeners = new Map();
export function on(ev, f) { if (!listeners.has(ev)) listeners.set(ev, new Set()); listeners.get(ev).add(f); return () => listeners.get(ev).delete(f); }
function emit(ev, d) { (listeners.get(ev) || []).forEach(f => { try { f(d); } catch (e) { console.error(e); } }); }

export async function loadMarkets() {
  const [meta, ctx] = await info({ type: 'metaAndAssetCtxs' });
  const list = meta.universe.map((u, i) => {
    const c = ctx[i] || {};
    const mark = +c.markPx, prev = +c.prevDayPx;
    return {
      name: u.name, idx: i, szDec: u.szDecimals, maxLev: u.maxLeverage, onlyIso: !!u.onlyIsolated, delisted: !!u.isDelisted,
      mark, mid: +c.midPx || mark, oracle: +c.oraclePx, prev, chg: prev ? (mark / prev - 1) * 100 : null,
      funding: +c.funding, premium: +c.premium, oi: (+c.openInterest || 0) * mark, vol: +c.dayNtlVlm || 0,
    };
  }).filter(m => !m.delisted && isFinite(m.mark) && m.mark > 0);
  markets.list = list; markets.by = Object.fromEntries(list.map(m => [m.name, m])); markets.at = Date.now();
  emit('markets', markets);
  return markets;
}

export const candles = (coin, interval, n = 200) => {
  const ms = { '1m': 60e3, '5m': 300e3, '15m': 900e3, '1h': 3600e3, '4h': 14400e3, '1d': 86400e3 }[interval] || 3600e3;
  const end = Date.now();
  return info({ type: 'candleSnapshot', req: { coin, interval, startTime: end - ms * n, endTime: end } })
    .then(a => a.map(k => ({ t: k.t, o: +k.o, h: +k.h, l: +k.l, c: +k.c, v: +k.v })));
};
export const book = (coin, nSigFigs) => info(nSigFigs ? { type: 'l2Book', coin, nSigFigs } : { type: 'l2Book', coin });
export const recentTrades = coin => info({ type: 'recentTrades', coin });

// ---------- one websocket, shared by every panel; reconnects quietly and falls back to polling ----------
const subs = new Map();          // key -> { sub, handlers:Set }
let sock = null, open = false, tries = 0, pingT = null;
export const live = { state: 'idle' };
const keyOf = s => JSON.stringify(Object.keys(s).sort().reduce((o, k) => (o[k] = s[k], o), {}));
function connect() {
  if (sock) return;
  live.state = 'connecting'; emit('live', live.state);
  try { sock = new WebSocket(WS_URL); } catch (e) { sock = null; live.state = 'down'; emit('live', live.state); return; }
  sock.onopen = () => {
    open = true; tries = 0; live.state = 'live'; emit('live', live.state);
    for (const { sub } of subs.values()) sock.send(JSON.stringify({ method: 'subscribe', subscription: sub }));
    clearInterval(pingT); pingT = setInterval(() => { if (open) sock.send(JSON.stringify({ method: 'ping' })); }, 45000);
  };
  sock.onmessage = e => {
    let m; try { m = JSON.parse(e.data); } catch (err) { return; }
    const ch = m.channel; if (!ch || ch === 'subscriptionResponse' || ch === 'pong') return;
    for (const [k, s] of subs) {
      if (s.sub.type !== ch) continue;
      if (s.sub.coin) {
        const coin = Array.isArray(m.data) ? (m.data[0] && m.data[0].coin) : (m.data && (m.data.coin || m.data.s));
        if (coin !== s.sub.coin) continue;
        if (ch === 'candle' && m.data.i !== s.sub.interval) continue;
      }
      s.handlers.forEach(f => { try { f(m.data); } catch (err) { console.error(err); } });
    }
  };
  sock.onclose = () => {
    open = false; sock = null; clearInterval(pingT);
    live.state = 'down'; emit('live', live.state);
    if (tries++ < 30) setTimeout(connect, Math.min(20000, 800 * 2 ** Math.min(tries, 5)));
  };
  sock.onerror = () => { try { sock && sock.close(); } catch (e) {} };
}
export function subscribe(sub, f) {
  const k = keyOf(sub);
  let s = subs.get(k);
  if (!s) { s = { sub, handlers: new Set() }; subs.set(k, s); if (open) sock.send(JSON.stringify({ method: 'subscribe', subscription: sub })); }
  s.handlers.add(f);
  connect();
  return () => {
    s.handlers.delete(f);
    if (!s.handlers.size) { subs.delete(k); if (open) sock.send(JSON.stringify({ method: 'unsubscribe', subscription: sub })); }
  };
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && !sock) connect(); });

// mids for every market, merged into the market list as they arrive
export const mids = {};
let midsOn = false;
export function liveMids() {
  if (midsOn) return; midsOn = true;
  subscribe({ type: 'allMids' }, d => {
    for (const [k, v] of Object.entries(d.mids || {})) {
      const p = +v; mids[k] = p;
      const m = markets.by[k]; if (m) { m.mid = p; m.chg = m.prev ? (p / m.prev - 1) * 100 : m.chg; }
    }
    emit('mids', mids);
  });
}

// the next funding payment: Hyperliquid pays funding every hour, on the hour
export const nextFunding = () => { const d = new Date(); d.setUTCMinutes(60, 0, 0); return d.getTime(); };
