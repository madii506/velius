// VELIUS desk: Hyperliquid's markets, live; a full ticket; your lines on your screen; your private wallet
import { $, $$, esc, px, pct, usd, usdBig, cls, clock, getJSON, store, dec, short } from './fmt.js';
import { flash, calm } from './fx.js';
import * as H from './hl.js';
import { Chart } from './chart.js';
import { walletMenu, closeMenus, WS, derive, remembered, registered, vaultState } from './shared.js';

const TAKER = 0.00045, MAKER = 0.00015;          // Hyperliquid's base fee tier
const S = { coin: null, tf: store.get('velius:tf', '15m'), side: 'long', type: 'market', lev: 10, vault: { open: false }, book: null, offs: [] };
const chart = new Chart($('#chart'), { gap: 8, onHover: k => ohlc(k) });

// ---------- the market ----------
function pickCoin() {
  const q = new URLSearchParams(location.search).get('m');
  const want = (q || store.get('velius:m', 'BTC'));
  return H.markets.by[want] ? want : 'BTC';
}
async function setCoin(c) {
  if (S.coin === c) return;
  S.offs.forEach(f => f()); S.offs = [];
  S.coin = c; store.set('velius:m', c);
  const m = H.markets.by[c];
  $('#mktName').textContent = c; $('#mktAv').textContent = c.replace(/^k/, '').slice(0, 2);
  document.title = 'VELIUS';
  history.replaceState(null, '', '/desk?m=' + encodeURIComponent(c));
  // leverage: never above 20x, never above what Hyperliquid allows for this market
  const max = Math.min(20, m ? m.maxLev : 20);
  const lev = $('#tLev'); lev.max = max; if (+lev.value > max) lev.value = max; S.lev = +lev.value;
  $('#levMarks').innerHTML = [1, Math.round(max / 4), Math.round(max / 2), Math.round(max * 3 / 4), max].filter((v, i, a) => a.indexOf(v) === i).map(v => `<span>${v}x</span>`).join('');
  $('#tTp').value = ''; $('#tSl').value = ''; $('#tPx').value = '';
  S.book = null; fundFor = null; if (!$('.spane[data-p="fund"]').hidden) setTimeout(() => fundingHistory(true), 50);
  $('#dBook').innerHTML = '<div class="ph">Reading the book…</div>';
  $('#dTrades').innerHTML = '<div class="ph">Waiting for trades…</div>';
  stats(m);
  loadCandles();
  H.book(c).then(d => { if (S.coin === c) drawBook(d); }).catch(() => {});
  H.recentTrades(c).then(a => { if (S.coin === c) { $('#dTrades').innerHTML = ''; a.slice(0, 40).reverse().forEach(t => addTrade(t, false)); } }).catch(() => {});
  S.offs.push(H.subscribe({ type: 'l2Book', coin: c }, d => { if (S.coin === c) drawBook(d); }));
  S.offs.push(H.subscribe({ type: 'trades', coin: c }, a => { if (S.coin === c) a.forEach(t => addTrade(t, true)); }));
  S.offs.push(H.subscribe({ type: 'activeAssetCtx', coin: c }, d => { if (S.coin === c && d.ctx) ctx(d.ctx); }));
  calc();
}

// ---------- the header stats ----------
function stats(m) {
  if (!m) return;
  set('#sMark', px(m.mark)); set('#sOracle', px(m.oracle));
  const ch = $('#sChg'); ch.textContent = pct(m.chg); ch.className = 'mono ' + cls(m.chg);
  set('#sVol', usdBig(m.vol)); set('#sOi', usdBig(m.oi));
  const f = $('#sFund'); f.textContent = (m.funding * 100).toFixed(4) + '%'; f.className = cls(m.funding);
}
function ctx(c) {
  const m = H.markets.by[S.coin]; if (!m) return;
  const mark = +c.markPx, prev = +c.prevDayPx;
  const old = m.mark; m.mark = mark; m.oracle = +c.oraclePx; m.funding = +c.funding; m.oi = +c.openInterest * mark; m.vol = +c.dayNtlVlm; m.prev = prev; m.chg = prev ? (mark / prev - 1) * 100 : m.chg;
  stats(m);
  if (old && old !== mark) flash($('#sMark'), mark - old);
  chart.setMark(mark); calc();
}
const set = (sel, v) => { const e = $(sel); if (e) e.textContent = v; };
setInterval(() => set('#sNext', clock(H.nextFunding() - Date.now())), 1000);

// ---------- the chart ----------
async function loadCandles() {
  const c = S.coin, tf = S.tf;
  chart.set([]);
  try { const d = await H.candles(c, tf, 300); if (S.coin === c && S.tf === tf) { chart.set(d); lines(); ohlc(null); } } catch (e) {}
  const off = H.subscribe({ type: 'candle', coin: c, interval: tf }, k => { if (S.coin === c && S.tf === tf) { chart.push({ t: k.t, o: +k.o, h: +k.h, l: +k.l, c: +k.c, v: +k.v }); if (!hovering) ohlc(null); } });
  S.offs.push(off); S.candleOff && S.candleOff(); S.candleOff = off;
}
let hovering = false;
function ohlc(k) {
  hovering = !!k;
  const d = k || chart.data[chart.data.length - 1]; if (!d) { $('#ohlc').textContent = ''; return; }
  const ch = (d.c / d.o - 1) * 100;
  $('#ohlc').innerHTML = `O<b>${px(d.o)}</b>H<b>${px(d.h)}</b>L<b>${px(d.l)}</b>C<b>${px(d.c)}</b><span class="${cls(ch)}">${pct(ch)}</span>`;
}
$('#tfs').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.dataset.tf === S.tf) return;
  $$('#tfs button').forEach(x => x.classList.toggle('on', x === b));
  S.tf = b.dataset.tf; store.set('velius:tf', S.tf);
  S.candleOff && S.candleOff();
  loadCandles();
});
$$('#tfs button').forEach(x => x.classList.toggle('on', x.dataset.tf === S.tf));

// ---------- the book and the tape ----------
function drawBook(d) {
  S.book = d;
  const [bids, asks] = d.levels; if (!bids.length || !asks.length) return;
  const box = $('#dBook'), N = Math.max(5, Math.min(14, Math.floor((box.clientHeight - 70) / 2 / 19)));
  const A = asks.slice(0, N).reverse(), B = bids.slice(0, N);
  let ca = 0, cb = 0; const cumA = asks.slice(0, N).map(l => (ca += +l.sz)).reverse(), cumB = B.map(l => (cb += +l.sz));
  const mx = Math.max(ca, cb, 1e-9);
  const row = (l, cum, s) => `<div class="db-r ${s}" data-px="${l.px}"><i style="width:${(cum / mx * 100).toFixed(1)}%"></i><span>${px(+l.px)}</span><span>${(+l.sz).toLocaleString('en-US', { maximumFractionDigits: 4 })}</span><span>${cum.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span></div>`;
  const sp = +asks[0].px - +bids[0].px, mid = (+asks[0].px + +bids[0].px) / 2;
  box.innerHTML = `<div class="db-h"><span>Price</span><span>Size</span><span>Total</span></div>` + A.map((l, i) => row(l, cumA[i], 'a')).join('') +
    `<div class="db-sp"><span>Spread ${px(sp, dec(mid))}</span><b>${px(mid)}</b><span>${(sp / mid * 100).toFixed(3)}%</span></div>` + B.map((l, i) => row(l, cumB[i], 'b')).join('');
  $('#dLive').classList.add('on');
  if (S.type === 'market') calc();
  depth();
}
$('#dBook').addEventListener('click', e => {
  const r = e.target.closest('.db-r'); if (!r) return;
  if (S.type === 'market') setType('limit');
  $('#tPx').value = r.dataset.px; calc();
});
function addTrade(t, fresh) {
  const box = $('#dTrades'); const ph = box.querySelector('.ph'); if (ph) ph.remove();
  const el = document.createElement('div');
  el.className = 'dt-r ' + (t.side === 'B' ? 'b' : 's') + (fresh && !calm ? ' new' : '');
  el.innerHTML = `<span>${px(+t.px)}</span><span>${(+t.sz).toLocaleString('en-US', { maximumFractionDigits: 4 })}</span><span>${new Date(t.time).toLocaleTimeString([], { hour12: false })}</span>`;
  box.prepend(el);
  while (box.children.length > 60) box.lastChild.remove();
}
$('#bookTabs').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  $$('#bookTabs button').forEach(x => x.classList.toggle('on', x === b));
  $('#dBook').hidden = b.dataset.t !== 'book'; $('#dTrades').hidden = b.dataset.t !== 'trades'; $('#dDepth').hidden = b.dataset.t !== 'depth';
  if (b.dataset.t === 'depth') depth();
});

// ---------- depth: the book as two cumulative curves around the mid ----------
function depth() {
  const box = $('#dDepth'); if (box.hidden || !S.book) return;
  const cv = $('#depth'), r = cv.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2);
  const W = r.width, Hh = r.height; if (W < 10 || Hh < 10) return;
  cv.width = W * d; cv.height = Hh * d;
  const g = cv.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, W, Hh);
  const [bids, asks] = S.book.levels; if (!bids.length || !asks.length) return;
  let cb = 0, ca = 0;
  const B = bids.map(l => ({ p: +l.px, c: (cb += +l.sz) })), A = asks.map(l => ({ p: +l.px, c: (ca += +l.sz) }));
  const mid = (B[0].p + A[0].p) / 2, span = Math.max(mid - B[B.length - 1].p, A[A.length - 1].p - mid);
  const lo = mid - span, hi = mid + span, top = Math.max(cb, ca) * 1.08, padB = 22;
  const X = p => (p - lo) / (hi - lo) * W, Y = c => Hh - padB - c / top * (Hh - padB - 26);
  const area = (pts, col, fill) => {
    g.beginPath(); g.moveTo(X(pts[0].p), Y(0));
    for (const q of pts) g.lineTo(X(q.p), Y(q.c));
    g.lineTo(X(pts[pts.length - 1].p), Y(0)); g.closePath();
    g.fillStyle = fill; g.fill();
    g.beginPath(); pts.forEach((q, i) => i ? g.lineTo(X(q.p), Y(q.c)) : g.moveTo(X(q.p), Y(q.c))); g.strokeStyle = col; g.lineWidth = 1.5; g.stroke();
  };
  area(B, '#2bd38f', 'rgba(43,211,143,.14)'); area(A, '#ff4d6a', 'rgba(255,77,106,.14)');
  g.strokeStyle = 'rgba(217,212,242,.35)'; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(X(mid), 20); g.lineTo(X(mid), Hh - padB); g.stroke(); g.setLineDash([]);
  g.fillStyle = '#7f7a96'; g.font = '500 10.5px Mono, monospace'; g.textBaseline = 'middle';
  g.fillText(px(lo), 6, Hh - 10); const t = px(hi); g.fillText(t, W - g.measureText(t).width - 6, Hh - 10);
  const m = px(mid); g.fillStyle = '#d9d4f2'; g.fillText(m, X(mid) - g.measureText(m).width / 2, Hh - 10);
  $('#ddL').innerHTML = `bids ${cb.toLocaleString('en-US', { maximumFractionDigits: 2 })} · asks ${ca.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${esc(S.coin)}`;
}

// ---------- funding history: the last seven days, hour by hour ----------
let fundFor = null;
async function fundingHistory(force) {
  const pane = $('.spane[data-p="fund"]'); if (pane.hidden && !force) return;
  const c = S.coin; if (fundFor === c && !force) return; fundFor = c;
  $('#fhN').textContent = 'Reading funding history…';
  let rows = [];
  try { rows = await H.info({ type: 'fundingHistory', coin: c, startTime: Date.now() - 7 * 86400e3 }); } catch (e) { $('#fhN').textContent = 'Funding history could not be read just now.'; fundFor = null; return; }
  if (S.coin !== c) return;
  const r = rows.map(x => ({ t: x.time, f: +x.fundingRate }));
  if (!r.length) { $('#fhN').textContent = 'No funding paid in the last seven days.'; return; }
  const avg = r.reduce((a, x) => a + x.f, 0) / r.length;
  $('#fhN').innerHTML = `${esc(c)} · 7 days · average <b class="${cls(avg)}">${(avg * 100).toFixed(4)}%</b> an hour · <b class="${cls(avg)}">${pct(avg * 24 * 365 * 100, 1)}</b> a year`;
  const cv = $('#fhist'), b = cv.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2);
  cv.width = b.width * d; cv.height = b.height * d;
  const g = cv.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, b.width, b.height);
  // the zero line sits where the data puts it: at the bottom when every hour paid longs to shorts
  const up = Math.max(0, ...r.map(x => x.f)), dn = Math.max(0, ...r.map(x => -x.f)), tot = (up + dn) || 1e-12;
  const pad = 6, hh = b.height - pad * 2, zero = pad + hh * (up / tot), w = b.width / r.length;
  g.strokeStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.moveTo(0, Math.round(zero) + .5); g.lineTo(b.width, Math.round(zero) + .5); g.stroke();
  r.forEach((x, i) => { const h = x.f / tot * hh; g.fillStyle = x.f >= 0 ? 'rgba(43,211,143,.75)' : 'rgba(255,77,106,.75)'; g.fillRect(i * w + w * 0.15, h >= 0 ? zero - h : zero, Math.max(1, w * 0.7), Math.max(1, Math.abs(h))); });
}
H.on('live', s => { if (s !== 'live') $('#dLive').classList.remove('on'); });

// ---------- the ticket ----------
const num = v => { const n = parseFloat(String(v).replace(/,/g, '')); return isFinite(n) && n > 0 ? n : NaN; };
function setType(t) {
  S.type = t;
  $$('#types button').forEach(x => x.classList.toggle('on', x.dataset.o === t));
  $('#pxRow').hidden = t === 'market';
  $('#pxLbl').textContent = t === 'stop' ? 'Trigger price' : 'Limit price';
  if (t !== 'market' && !num($('#tPx').value)) { const m = mark(); if (m) $('#tPx').value = px(m).replace(/,/g, ''); }
  calc();
}
$('#types').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setType(b.dataset.o); });
$('#side').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  S.side = b.dataset.s; $$('#side button').forEach(x => x.classList.toggle('on', x === b)); calc();
});
$('#tLev').addEventListener('input', e => { S.lev = +e.target.value; calc(); });
['#tSize', '#tPx', '#tTp', '#tSl'].forEach(s => $(s).addEventListener('input', calc));
$('#midBtn').addEventListener('click', () => { const m = mark(); if (m) { $('#tPx').value = px(m).replace(/,/g, ''); calc(); } });
const mark = () => { const m = H.markets.by[S.coin]; return H.mids[S.coin] || (m && m.mark); };

// walk the book to price a market order of this size; fall back to the mark
function marketEntry(usdSize) {
  const b = S.book; const m = mark();
  if (!b || !isFinite(usdSize)) return m;
  const lv = S.side === 'long' ? b.levels[1] : b.levels[0];
  let left = usdSize, cost = 0, qty = 0;
  for (const l of lv) { const p = +l.px, q = Math.min(+l.sz, left / p); cost += q * p; qty += q; left -= q * p; if (left <= 1e-9) break; }
  return qty > 0 && left <= 1e-6 ? cost / qty : m;
}
function calc() {
  const m = H.markets.by[S.coin]; if (!m) return;
  const size = num($('#tSize').value), L = S.lev, dir = S.side === 'long' ? 1 : -1;
  $('#tLevV').textContent = L + 'x';
  const entry = S.type === 'market' ? marketEntry(size) : num($('#tPx').value) || mark();
  const mm = 1 / (2 * m.maxLev);
  const liq = dir > 0 ? entry * (1 - 1 / L) / (1 - mm) : entry * (1 + 1 / L) / (1 + mm);
  const coins = size / entry;
  set('#tCoins', isFinite(coins) ? `≈ ${coins.toLocaleString('en-US', { maximumFractionDigits: Math.max(2, m.szDec) })} ${S.coin}` : `in USD, at ${L}x`);
  set('#uEntry', px(entry));
  set('#uMargin', isFinite(size) ? usd(size / L) : '—');
  set('#uLiq', px(liq));
  set('#uFee', isFinite(size) ? usd(size * (S.type === 'limit' ? MAKER : TAKER), 2) : '—');
  for (const [id, out] of [['#tTp', '#tTpP'], ['#tSl', '#tSlP']]) {
    const v = num($(id).value), o = $(out);
    if (!isFinite(v)) { o.textContent = ''; continue; }
    const mv = (v / entry - 1) * 100 * dir, pnl = isFinite(coins) ? (v - entry) * coins * dir : NaN;
    o.textContent = (isFinite(pnl) ? usd(pnl) + ' · ' : '') + pct(mv);
    o.className = 'mono ' + cls(mv);
  }
  lines(entry, liq);
  button();
}
function lines(entry, liq) {
  const m = H.markets.by[S.coin]; if (!m) return;
  if (entry == null) { entry = S.type === 'market' ? mark() : num($('#tPx').value) || mark(); const mm = 1 / (2 * m.maxLev), L = S.lev; liq = S.side === 'long' ? entry * (1 - 1 / L) / (1 - mm) : entry * (1 + 1 / L) / (1 + mm); }
  const L = [];
  if (S.type !== 'market') L.push({ id: 'entry', label: S.type === 'stop' ? 'Trigger' : 'Limit', price: entry, color: '#ece9ff', drag: true });
  const tp = num($('#tTp').value), sl = num($('#tSl').value);
  if (isFinite(tp)) L.push({ id: 'tp', label: 'TP', price: tp, color: '#2bd38f', dash: true, drag: true });
  if (isFinite(sl)) L.push({ id: 'sl', label: 'Stop', price: sl, color: '#ffb347', dash: true, drag: true });
  if (num($('#tSize').value)) L.push({ id: 'liq', label: 'Liq', price: liq, color: '#ff4d6a', dash: true, fit: false });
  chart.setLines(L);
}
chart.onLine = (id, p) => {
  const v = px(p).replace(/,/g, '');
  if (id === 'tp') $('#tTp').value = v; else if (id === 'sl') $('#tSl').value = v; else if (id === 'entry') $('#tPx').value = v;
  calc();
};
function button() {
  const b = $('#place'), st = WS.state();
  b.className = 'btn place';
  if (!st.address) { b.disabled = false; b.textContent = 'Connect a wallet'; b.dataset.do = 'connect'; return; }
  if (!S.vault.open) { b.disabled = true; b.textContent = 'Vault opens soon'; b.dataset.do = ''; return; }
  b.disabled = false; b.classList.add(S.side); b.textContent = (S.side === 'long' ? 'Long ' : 'Short ') + S.coin; b.dataset.do = 'place';
}
$('#place').addEventListener('click', e => {
  e.stopPropagation();
  const b = $('#place');
  if (b.dataset.do === 'connect') { $('#wBtn').click(); return; }
});

// ---------- the market picker ----------
function picker(open) {
  const p = $('#picker'); p.hidden = !open;
  if (open) { $('#pkQ').value = ''; listPicker(''); setTimeout(() => $('#pkQ').focus(), 30); }
}
function listPicker(q) {
  q = q.trim().toUpperCase();
  const list = H.markets.list.filter(m => !q || m.name.toUpperCase().includes(q)).sort((a, b) => b.vol - a.vol).slice(0, 120);
  $('#pkRows').innerHTML = list.map(m => `<button class="pk-r${m.name === S.coin ? ' cur' : ''}" data-c="${esc(m.name)}" type="button"><span class="nm"><span class="av">${esc(m.name.replace(/^k/, '').slice(0, 2))}</span>${esc(m.name)}<em>${Math.min(20, m.maxLev)}x</em></span><span>${px(H.mids[m.name] || m.mark)}</span><span class="${cls(m.chg)}">${pct(m.chg)}</span><span class="hide-s">${usdBig(m.vol)}</span></button>`).join('') || '<div class="ph">No market by that name.</div>';
}
$('#mktBtn').addEventListener('click', () => picker(true));
$('#pkX').addEventListener('click', () => picker(false));
$('#picker').addEventListener('click', e => { if (e.target.id === 'picker') picker(false); const r = e.target.closest('.pk-r[data-c]'); if (r) { picker(false); setCoin(r.dataset.c); } });
$('#pkQ').addEventListener('input', e => listPicker(e.target.value));
addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$('#picker').hidden) picker(false);
  if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !/INPUT|TEXTAREA/.test(document.activeElement.tagName))) { e.preventDefault(); picker(true); }
});

// ---------- the sealed book and the private wallet ----------
$('#sTabs').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  $$('#sTabs button').forEach(x => x.classList.toggle('on', x === b));
  $$('.spane').forEach(p => { p.hidden = p.dataset.p !== b.dataset.t; });
  if (b.dataset.t === 'fund') fundingHistory();
});
if (location.hash === '#wallet') { const b = $('#sTabs [data-t="priv"]'); b && b.click(); }
function privUI() {
  const st = WS.state(), btn = $('#pvDerive'), msg = $('#pvMsg');
  $('#pvOwner').textContent = st.address ? short(st.address) : 'not connected';
  const addr = st.address ? remembered() : null;
  $('#pvAddr').textContent = addr ? short(addr) : '—';
  if (!st.address) { btn.textContent = 'Connect a wallet'; btn.dataset.do = 'connect'; $('#pvReg').textContent = '—'; return; }
  btn.textContent = addr ? 'Derive again' : 'Derive my private wallet'; btn.dataset.do = 'derive';
  registered(st.address).then(j => { $('#pvReg').textContent = j.registered ? 'yes' : 'not yet'; }).catch(() => { $('#pvReg').textContent = 'could not read'; });
}
$('#pvDerive').addEventListener('click', async e => {
  e.stopPropagation();
  const b = e.currentTarget, msg = $('#pvMsg');
  if (b.dataset.do === 'connect') { $('#wBtn').click(); return; }
  b.disabled = true; msg.textContent = 'Sign the message in your wallet…';
  try {
    const addr = await derive();
    $('#pvAddr').textContent = short(addr);
    msg.textContent = 'Derived in this tab. Only the address is remembered here; the keys are not.';
  } catch (err) { msg.textContent = String(err.message || err).slice(0, 120); }
  b.disabled = false;
});

// ---------- go ----------
closeMenus();
walletMenu($('#wBtn'), $('#wMenu'));
WS.onChange(() => { button(); privUI(); });
WS.reconnect().then(() => { button(); privUI(); });
vaultState().then(v => {
  S.vault = v;
  const p = $('#vPill'); p.classList.toggle('open', !!v.open); p.querySelector('span').textContent = v.open ? 'Vault open' : 'Vault closed';
  $('#tnote').textContent = v.open ? 'Orders fill at Hyperliquid\'s price through the vault. Your lines stay on this screen.' : 'The vault opens once it is funded and has passed a live test on mainnet. Everything else on this desk is live.';
  button();
});
H.liveMids();
H.on('mids', () => {
  const m = H.markets.by[S.coin], v = H.mids[S.coin]; if (!m || !v) return;
  if (!$('#picker').hidden) return;
  calc();
});
async function boot() {
  try { await H.loadMarkets(); }
  catch (e) { $('#dBook').innerHTML = '<div class="ph">Hyperliquid could not be read just now. Retrying…</div>'; setTimeout(boot, 4000); return; }
  setCoin(pickCoin());
  privUI();
}
boot();
setInterval(() => { if (!document.hidden) H.loadMarkets().catch(() => {}); }, 60000);
