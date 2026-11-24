// Playwright routes for Hyperliquid (dev only): info calls and the websocket, from dev/fixtures.json
const fs = require('fs'), path = require('path');
const F = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures.json'), 'utf8'));
const MID = Object.fromEntries(F.mk.map(([n, sd, p]) => [n, p]));
const step = p => p >= 10000 ? 1 : p >= 1000 ? 0.1 : p >= 100 ? 0.01 : p >= 10 ? 0.001 : p >= 1 ? 0.0001 : p >= 0.1 ? 0.00001 : 0.000001;
function book(coin) {
  if (coin === 'BTC') return { coin, time: Date.now(), levels: [F.btcBook.bids.map(([p, s]) => ({ px: String(p), sz: String(+(s * (0.8 + Math.random() * 0.4)).toFixed(5)), n: 1 + (Math.random() * 6 | 0) })), F.btcBook.asks.map(([p, s]) => ({ px: String(p), sz: String(+(s * (0.8 + Math.random() * 0.4)).toFixed(5)), n: 1 + (Math.random() * 6 | 0) }))] };
  const m = MID[coin] || 1, st = step(m);
  const lv = side => Array.from({ length: 20 }, (_, i) => ({ px: String(+(m + (side * (i + 1) * st * (1 + (i % 3)))).toFixed(8)), sz: String(+(Math.random() * 400 / Math.sqrt(m) + 0.01).toFixed(3)), n: 1 + (Math.random() * 9 | 0) }));
  return { coin, time: Date.now(), levels: [lv(-1), lv(1)] };
}
function candles(coin, interval, start, end) {
  const ms = { '1m': 60e3, '5m': 300e3, '15m': 900e3, '1h': 3600e3, '4h': 14400e3, '1d': 86400e3 }[interval] || 3600e3;
  if (coin === 'BTC' && interval === '1h') return F.btc1h.map(([t, o, h, l, c]) => ({ t, T: t + ms - 1, s: coin, i: interval, o: String(o), h: String(h), l: String(l), c: String(c), v: String((Math.random() * 900 + 100).toFixed(2)), n: 100 }));
  const n = Math.min(500, Math.floor((end - start) / ms)); const out = []; let p = MID[coin] || 1; const t0 = Math.floor(end / ms) * ms - (n - 1) * ms;
  const vol = interval === '1d' ? 0.03 : interval === '4h' ? 0.012 : interval === '1h' ? 0.006 : 0.002;
  const arr = []; for (let i = 0; i < n; i++) { arr.push(p); p = p * (1 + (Math.random() - 0.5) * vol * 2); }
  const scale = (MID[coin] || 1) / arr[arr.length - 1];
  for (let i = 0; i < n; i++) { const o = arr[i] * scale, c = (arr[i + 1] || arr[i]) * scale, h = Math.max(o, c) * (1 + Math.random() * vol * 0.6), l = Math.min(o, c) * (1 - Math.random() * vol * 0.6); out.push({ t: t0 + i * ms, T: t0 + (i + 1) * ms - 1, s: coin, i: interval, o: String(o), h: String(h), l: String(l), c: String(c), v: String((Math.random() * 500).toFixed(2)), n: 50 }); }
  return out;
}
async function route(page) {
  await page.route('https://api.hyperliquid.xyz/info', async r => {
    const b = JSON.parse(r.request().postData() || '{}');
    let body = {};
    if (b.type === 'metaAndAssetCtxs') body = F.meta;
    else if (b.type === 'allMids') body = Object.fromEntries(Object.entries(MID).map(([k, v]) => [k, String(v)]));
    else if (b.type === 'l2Book') body = book(b.coin);
    else if (b.type === 'candleSnapshot') body = candles(b.req.coin, b.req.interval, b.req.startTime, b.req.endTime);
    else if (b.type === 'fundingHistory') body = Array.from({ length: 168 }, (_, i) => ({ coin: b.coin, fundingRate: String((0.0000125 + Math.sin(i / 9) * 0.000008 + (Math.random() - 0.5) * 0.000006).toFixed(8)), premium: '0.0001', time: Date.now() - (168 - i) * 3600e3 }));
    else if (b.type === 'recentTrades') body = Array.from({ length: 30 }, (_, i) => ({ coin: b.coin, side: Math.random() < 0.5 ? 'B' : 'A', px: String(MID[b.coin] || 1), sz: String((Math.random() * 2).toFixed(4)), time: Date.now() - i * 1500, hash: '0x' + i }));
    await r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
  });
  if (page.routeWebSocket) await page.routeWebSocket('wss://api.hyperliquid.xyz/ws', ws => {
    const timers = [];
    ws.onMessage(msg => {
      const m = JSON.parse(String(msg));
      if (m.method === 'ping') return ws.send(JSON.stringify({ channel: 'pong' }));
      if (m.method !== 'subscribe') return;
      const s = m.subscription;
      ws.send(JSON.stringify({ channel: 'subscriptionResponse', data: m }));
      const send = () => {
        if (s.type === 'allMids') { for (const k in MID) MID[k] = +(MID[k] * (1 + (Math.random() - 0.5) * 0.0006)).toPrecision(6); ws.send(JSON.stringify({ channel: 'allMids', data: { mids: Object.fromEntries(Object.entries(MID).map(([k, v]) => [k, String(v)])) } })); }
        if (s.type === 'l2Book') ws.send(JSON.stringify({ channel: 'l2Book', data: book(s.coin) }));
        if (s.type === 'trades') { const k = Math.random() < 0.08 ? 40 : 1; ws.send(JSON.stringify({ channel: 'trades', data: [{ coin: s.coin, side: Math.random() < 0.5 ? 'B' : 'A', px: String(MID[s.coin]), sz: String((Math.random() * 1.5 * k * 60000 / MID[s.coin] / 20).toFixed(4)), time: Date.now(), hash: '0x' + Date.now() }] })); }
        if (s.type === 'candle') { const c = candles(s.coin, s.interval, Date.now() - 3600e3, Date.now()).slice(-1)[0]; ws.send(JSON.stringify({ channel: 'candle', data: c })); }
        if (s.type === 'activeAssetCtx') { const i = F.mk.findIndex(x => x[0] === s.coin); ws.send(JSON.stringify({ channel: 'activeAssetCtx', data: { coin: s.coin, ctx: { ...F.meta[1][i], markPx: String(MID[s.coin]), midPx: String(MID[s.coin]) } } })); }
      };
      send(); timers.push(setInterval(send, 900 + Math.random() * 600));
    });
    ws.onClose(() => timers.forEach(clearInterval));
  });
}
module.exports = { route, F };
