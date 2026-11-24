// VELIUS desk: Hyperliquid's markets, live; a full ticket with risk sizing; your lines on your screen; your private wallet
import { $, $$, esc, px, pct, usd, usdBig, cls, clock, store, dec, short, fund, apr, sz } from './fmt.js';
import { flash, calm } from './fx.js';
import * as H from './hl.js';
import { Chart } from './chart.js';
import { WS, derive, remembered, registered, vaultState } from './shared.js';
import { boot } from './page.js';
import { watch, STAR } from './watch.js';
import { columns, fundingHistory } from './widgets.js';

boot();
const TAKER = 0.00045, MAKER = 0.00015;          // Hyperliquid's base fee tier
const EMA_C = { 20: '#3987e5', 50: '#d95926', 200: '#9085e9' };
const S = {
  coin: null, tf: store.get('velius:tf', '15m'), side: 'long', type: 'market', lev: 10, vault: { open: false }, book: null, offs: [], bookOff: null,
  grp: null, szMode: store.get('velius:szmode', 'usd'), emas: store.get('velius:ema', [20, 50]),
};
const chart = new Chart($('#chart'), { gap: 8, onHover: k => ohlc(k) });

// ---------- the market ----------
function pickCoin() {
  const q = new URLSearchParams(location.search).get('m');
  const want = (q || store.get('velius:m', 'BTC'));
  return H.markets.by[want] ? want : 'BTC';
}
async function setCoin(c) {
  if (S.coin === c) return;
  S.offs.forEach(f => f()); S.offs = []; S.bookOff && S.bookOff(); S.bookOff = null;
  S.coin = c; store.set('velius:m', c);
  const m = H.markets.by[c];
  $('#mktName').textContent = c; $('#mktAv').textContent = c.replace(/^k/, '').slice(0, 2);
  history.replaceState(null, '', '/desk?m=' + encodeURIComponent(c) + location.hash);
  // leverage: never above 20x, never above what Hyperliquid allows for this market
  const max = Math.min(20, m ? m.maxLev : 20);
  const lev = $('#tLev'); lev.max = max; if (+lev.value > max) lev.value = max; S.lev = +lev.value;
  $('#levMarks').innerHTML = [1, Math.round(max / 4), Math.round(max / 2), Math.round(max * 3 / 4), max].filter((v, i, a) => v >= 1 && a.indexOf(v) === i).map(v => `<span>${v}x</span>`).join('');
  $('#tTp').value = ''; $('#tSl').value = ''; $('#tPx').value = '';
  S.book = null; fundFor = null; if (!$('.spane[data-p="fund"]').hidden) setTimeout(() => fundingTab(true), 50);
  $('#dTrades').innerHTML = '<div class="ph">Waiting for trades…</div>';
  starUI(); wl(); groups(m); stats(m);
  loadCandles();
  bookSub();
  H.recentTrades(c).then(a => { if (S.coin === c) { $('#dTrades').innerHTML = ''; a.slice(0, 40).reverse().forEach(t => addTrade(t, false)); } }).catch(() => {});
  S.offs.push(H.subscribe({ type: 'trades', coin: c }, a => { if (S.coin === c) a.forEach(t => addTrade(t, true)); }));
  S.offs.push(H.subscribe({ type: 'activeAssetCtx', coin: c }, d => { if (S.coin === c && d.ctx) ctx(d.ctx); }));
  calc();
}

// ---------- the bar ----------
function stats(m) {
  if (!m) return;
  set('#sMark', px(m.mark)); set('#sOracle', px(m.oracle));
  const ch = $('#sChg'); ch.textContent = pct(m.chg); ch.className = 'mono ' + cls(m.chg);
  set('#sVol', usdBig(m.vol)); set('#sOi', usdBig(m.oi));
  const f = $('#sFund'); f.textContent = fund(m.funding); f.className = cls(m.funding);
  const y = $('#sApr'); y.textContent = apr(m.funding); y.className = cls(m.funding);
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

// ---------- the watchlist: starred markets, one tap away ----------
function starUI() {
  const b = $('#mStar'), on = watch.has(S.coin);
  b.innerHTML = STAR; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on);
  b.setAttribute('aria-label', on ? 'Remove from watchlist' : 'Add to watchlist');
}
function wl() {
  const box = $('#wl'), list = watch.all().filter(c => H.markets.by[c]);
  if (!list.length) { box.innerHTML = '<span class="wl-e">Star a market to keep it here.</span>'; return; }
  box.innerHTML = list.map(c => `<button class="wl-c${c === S.coin ? ' cur' : ''}" type="button" data-c="${esc(c)}"><b>${esc(c)}</b><span class="p"></span><span class="c"></span></button>`).join('');
  wlTick();
}
function wlTick() {
  for (const b of $$('#wl .wl-c')) {
    const m = H.markets.by[b.dataset.c]; if (!m) continue;
    const v = H.mids[m.name] || m.mark, p = b.querySelector('.p'), old = +p.dataset.v;
    if (old !== v) { p.dataset.v = v; p.textContent = px(v); if (old) flash(p, v - old); }
    const c = b.querySelector('.c'); c.textContent = pct(m.chg); c.className = 'c ' + cls(m.chg);
  }
}
$('#wl').addEventListener('click', e => { const b = e.target.closest('.wl-c'); if (b) setCoin(b.dataset.c); });
$('#mStar').addEventListener('click', () => { watch.toggle(S.coin); });
watch.on(() => { starUI(); wl(); if (!$('#picker').hidden) listPicker($('#pkQ').value); });
function stepWatch(d) {
  const list = watch.all().filter(c => H.markets.by[c]); if (!list.length) return;
  const i = list.indexOf(S.coin), n = list[(i + d + list.length) % list.length];
  if (i < 0) setCoin(list[d > 0 ? 0 : list.length - 1]); else setCoin(n);
}

// ---------- the chart ----------
async function loadCandles() {
  const c = S.coin, tf = S.tf;
  chart.set([]);
  try { const d = await H.candles(c, tf, 300); if (S.coin === c && S.tf === tf) { chart.set(d); lines(); ohlc(null); emaLabels(); } } catch (e) {}
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
function setTf(tf) {
  if (!tf || tf === S.tf) return;
  $$('#tfs button').forEach(x => x.classList.toggle('on', x.dataset.tf === tf));
  S.tf = tf; store.set('velius:tf', S.tf);
  S.candleOff && S.candleOff();
  loadCandles();
}
$('#tfs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setTf(b.dataset.tf); });
$$('#tfs button').forEach(x => x.classList.toggle('on', x.dataset.tf === S.tf));
// moving averages
function emas() {
  $$('#ema button').forEach(b => { const on = S.emas.includes(+b.dataset.n); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  chart.setEMAs(S.emas.map(n => ({ n, color: EMA_C[n] })));
  store.set('velius:ema', S.emas); emaLabels();
}
function emaLabels() {
  $$('#ema button').forEach(b => {
    const n = +b.dataset.n, v = S.emas.includes(n) ? chart.emaLast(n) : null;
    b.title = v != null ? `EMA ${n}: ${px(v)}` : `EMA ${n}`;
  });
}
$('#ema').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return; const n = +b.dataset.n;
  S.emas = S.emas.includes(n) ? S.emas.filter(x => x !== n) : S.emas.concat(n).sort((a, b2) => a - b2); emas();
});
emas();

// ---------- the book: grouped to the tick you choose ----------
function groups(m) {
  const sel = $('#grp'); if (!m) return;
  const mark = H.mids[m.name] || m.mark, mag = Math.floor(Math.log10(mark));
  const full = Math.max(10 ** -(6 - m.szDec), 10 ** (mag - 4));
  const opts = [{ n: 0, t: full }].concat([4, 3, 2].map(n => ({ n, t: 10 ** (mag + 1 - n) })).filter(o => o.t > full * 1.0001));
  const tick = t => t >= 1 ? t.toLocaleString('en-US') : t.toFixed(Math.min(10, Math.max(0, Math.round(-Math.log10(t)))));
  sel.innerHTML = opts.map(o => `<option value="${o.n}">${tick(o.t)}</option>`).join('');
  S.grp = null; sel.value = '0';
}
function bookSub() {
  const c = S.coin, n = S.grp;
  S.bookOff && S.bookOff(); S.book = null;
  $('#dBook').innerHTML = '<div class="ph">Reading the book…</div>';
  H.book(c, n || undefined).then(d => { if (S.coin === c && S.grp === n) drawBook(d); }).catch(() => {});
  S.bookOff = H.subscribe(n ? { type: 'l2Book', coin: c, nSigFigs: n } : { type: 'l2Book', coin: c }, d => { if (S.coin === c && S.grp === n) drawBook(d); });
}
$('#grp').addEventListener('change', e => { S.grp = +e.target.value || null; bookSub(); });
function cycleGroup() { const s = $('#grp'); if (s.options.length < 2) return; s.selectedIndex = (s.selectedIndex + 1) % s.options.length; s.dispatchEvent(new Event('change')); }
function drawBook(d) {
  S.book = d;
  const [bids, asks] = d.levels; if (!bids.length || !asks.length) return;
  const box = $('#dBook'), N = Math.max(5, Math.min(14, Math.floor((box.clientHeight - 70) / 2 / 19)));
  const A = asks.slice(0, N).reverse(), B = bids.slice(0, N);
  let ca = 0, cb = 0; const cumA = asks.slice(0, N).map(l => (ca += +l.sz)).reverse(), cumB = B.map(l => (cb += +l.sz));
  const mx = Math.max(ca, cb, 1e-9);
  const row = (l, cum, s) => `<div class="db-r ${s}" data-px="${l.px}"><i style="width:${(cum / mx * 100).toFixed(1)}%"></i><span>${px(+l.px)}</span><span>${sz(+l.sz)}</span><span>${cum.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span></div>`;
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
  el.innerHTML = `<span>${px(+t.px)}</span><span>${sz(+t.sz)}</span><span>${new Date(t.time).toLocaleTimeString([], { hour12: false })}</span>`;
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
    g.beginPath(); pts.forEach((q, i) => i ? g.lineTo(X(q.p), Y(q.c)) : g.moveTo(X(q.p), Y(q.c))); g.strokeStyle = col; g.lineWidth = 2; g.lineJoin = 'round'; g.stroke();
  };
  area(B, '#2bd38f', 'rgba(43,211,143,.1)'); area(A, '#ff4d6a', 'rgba(255,77,106,.1)');
  g.fillStyle = 'rgba(217,212,242,.3)'; g.fillRect(Math.round(X(mid)), 20, 1, Hh - padB - 20);
  g.fillStyle = '#7f7a96'; g.font = '500 10.5px Mono, monospace'; g.textBaseline = 'middle';
  g.fillText(px(lo), 6, Hh - 10); const t = px(hi); g.fillText(t, W - g.measureText(t).width - 6, Hh - 10);
  const m = px(mid); g.fillStyle = '#d9d4f2'; g.fillText(m, X(mid) - g.measureText(m).width / 2, Hh - 10);
  $('#ddL').innerHTML = `bids ${cb.toLocaleString('en-US', { maximumFractionDigits: 2 })} · asks ${ca.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${esc(S.coin)}`;
}

// ---------- funding history: the last seven days, hour by hour ----------
let fundFor = null, fchart = null;
async function fundingTab(force) {
  const pane = $('.spane[data-p="fund"]'); if (pane.hidden && !force) return;
  const c = S.coin; if (fundFor === c && !force) return; fundFor = c;
  if (!fchart) fchart = columns($('#fhist'), { pos: '#2bd38f', neg: '#ff4d6a', fmt: v => fund(v) + ' an hour', label: r => r.label, aria: 'Hourly funding over the last seven days' });
  $('#fhN').textContent = 'Reading funding history…'; fchart.set([]);
  let rows = [];
  try { rows = await fundingHistory(c); } catch (e) { $('#fhN').textContent = 'Funding history could not be read just now.'; fundFor = null; return; }
  if (S.coin !== c) return;
  if (!rows.length) { $('#fhN').textContent = 'No funding paid in the last seven days.'; return; }
  const avg = rows.reduce((a, x) => a + x.v, 0) / rows.length;
  $('#fhN').innerHTML = `${esc(c)} · 7 days · average <b class="${cls(avg)}">${fund(avg)}</b> an hour · <b class="${cls(avg)}">${apr(avg)}</b> a year`;
  fchart.set(rows);
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
function setSide(s) { S.side = s; $$('#side button').forEach(x => x.classList.toggle('on', x.dataset.s === s)); calc(); }
function setSzMode(m) {
  S.szMode = m; store.set('velius:szmode', m);
  $$('#szMode button').forEach(x => x.classList.toggle('on', x.dataset.m === m));
  $('#szLbl').textContent = m === 'risk' ? 'Risk, the most you lose at your stop' : 'Size';
  $('#tSize').placeholder = m === 'risk' ? 'max loss' : '0.00';
  calc();
}
$('#types').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setType(b.dataset.o); });
$('#side').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setSide(b.dataset.s); });
$('#szMode').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setSzMode(b.dataset.m); });
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
  const L = S.lev, dir = S.side === 'long' ? 1 : -1, input = num($('#tSize').value), sl = num($('#tSl').value), tp = num($('#tTp').value);
  const feeRate = S.type === 'limit' ? MAKER : TAKER;
  $('#tLevV').textContent = L + 'x';
  // risk mode: the size whose loss at the stop, fees in and out included, equals what you typed
  let entry = S.type === 'market' ? marketEntry(S.szMode === 'usd' ? input : NaN) : num($('#tPx').value) || mark();
  let size = NaN, note = '';
  if (S.szMode === 'risk') {
    const dist = isFinite(sl) ? dir * (entry - sl) / entry : NaN;
    if (!isFinite(input)) note = 'Type the most you would lose at your stop.';
    else if (!isFinite(sl)) note = 'Set a stop to size by risk.';
    else if (!(dist > 0)) note = 'Your stop is on the wrong side of your entry.';
    else { size = input / (dist + feeRate + TAKER); if (S.type === 'market') { entry = marketEntry(size); size = input / (Math.max(1e-9, dir * (entry - sl) / entry) + feeRate + TAKER); } }
  } else size = input;
  const mm = 1 / (2 * m.maxLev);
  const liq = dir > 0 ? entry * (1 - 1 / L) / (1 - mm) : entry * (1 + 1 / L) / (1 + mm);
  const coins = size / entry;
  const cd = Math.max(2, m.szDec);
  set('#tCoins', note || (isFinite(coins) ? `≈ ${coins.toLocaleString('en-US', { maximumFractionDigits: cd })} ${S.coin}${S.szMode === 'risk' ? ' · ' + usd(size, 0) + ' size' : ''}` : S.szMode === 'risk' ? 'the most you would lose at your stop, fees included' : `in USD, at ${L}x`));
  set('#uEntry', px(entry));
  set('#uSize', isFinite(size) ? usd(size, 2) : '—');
  set('#uMargin', isFinite(size) ? usd(size / L) : '—');
  set('#uLiq', px(liq));
  set('#uFee', isFinite(size) ? usd(size * feeRate, 2) : '—');
  for (const [id, out] of [['#tTp', '#tTpP'], ['#tSl', '#tSlP']]) {
    const v = num($(id).value), o = $(out);
    if (!isFinite(v)) { o.textContent = ''; continue; }
    const mv = (v / entry - 1) * 100 * dir, pnl = isFinite(coins) ? (v - entry) * coins * dir : NaN;
    o.textContent = (isFinite(pnl) ? usd(pnl) + ' · ' : '') + pct(mv);
    o.className = 'mono ' + cls(mv);
  }
  // what the stop costs, what the target pays, and whether liquidation comes first
  const loss = isFinite(sl) && isFinite(coins) ? Math.max(0, dir * (entry - sl) * coins) + size * (feeRate + TAKER) : NaN;
  const gain = isFinite(tp) && isFinite(coins) ? dir * (tp - entry) * coins - size * (feeRate + TAKER) : NaN;
  $('#rLoss').hidden = !isFinite(loss); set('#uLoss', isFinite(loss) ? usd(-loss) : '—');
  $('#rRR').hidden = !(isFinite(loss) && isFinite(gain) && loss > 0); set('#uRR', isFinite(gain) && loss > 0 ? (gain / loss).toFixed(2) + ' : 1' : '—');
  const w = $('#tWarn'); let warn = '';
  if (isFinite(sl) && (dir > 0 ? sl <= liq : sl >= liq)) warn = 'Liquidation comes before your stop. Lower the leverage or move the stop.';
  else if (isFinite(tp) && dir * (tp - entry) <= 0) warn = 'Your take profit is on the wrong side of your entry.';
  else if (isFinite(size) && size < 10) warn = 'Hyperliquid takes orders of $10 or more.';
  w.hidden = !warn; w.textContent = warn;
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
  if ($('#place').dataset.do === 'connect') $('#wBtn').click();
});

// ---------- the market picker ----------
let pkTab = 'all';
function picker(open) {
  const p = $('#picker'); p.hidden = !open;
  if (open) { $('#pkQ').value = ''; listPicker(''); setTimeout(() => $('#pkQ').focus(), 30); }
}
function listPicker(q) {
  q = q.trim().toUpperCase();
  const list = H.markets.list.filter(m => (!q || m.name.toUpperCase().includes(q)) && (pkTab === 'all' || watch.has(m.name))).sort((a, b) => b.vol - a.vol).slice(0, 150);
  $('#pkRows').innerHTML = list.map(m => `<div class="pk-r${m.name === S.coin ? ' cur' : ''}" data-c="${esc(m.name)}"><span class="nm"><button class="star${watch.has(m.name) ? ' on' : ''}" type="button" data-star="${esc(m.name)}" aria-label="Star ${esc(m.name)}">${STAR}</button><button class="pk-go" type="button" data-go="${esc(m.name)}"><span class="av">${esc(m.name.replace(/^k/, '').slice(0, 2))}</span>${esc(m.name)}<em>${Math.min(20, m.maxLev)}x</em></button></span><span>${px(H.mids[m.name] || m.mark)}</span><span class="${cls(m.chg)}">${pct(m.chg)}</span><span class="hide-s">${usdBig(m.vol)}</span></div>`).join('')
    || `<div class="ph">${pkTab === 'watch' && !q ? 'No starred markets yet.' : 'No market by that name.'}</div>`;
}
$('#mktBtn').addEventListener('click', () => picker(true));
$('#pkX').addEventListener('click', () => picker(false));
$('#pkTab').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; pkTab = b.dataset.t; $$('#pkTab button').forEach(x => x.classList.toggle('on', x === b)); listPicker($('#pkQ').value); });
$('#picker').addEventListener('click', e => {
  if (e.target.id === 'picker') { picker(false); return; }
  const st = e.target.closest('[data-star]'); if (st) { watch.toggle(st.dataset.star); return; }
  const r = e.target.closest('.pk-r[data-c]'); if (r) { picker(false); setCoin(r.dataset.c); }
});
$('#pkQ').addEventListener('input', e => listPicker(e.target.value));
$('#pkQ').addEventListener('keydown', e => { if (e.key === 'Enter') { const r = $('#pkRows .pk-r[data-c]'); if (r) { picker(false); setCoin(r.dataset.c); } } });

// ---------- keyboard ----------
const KEYS = [['/', 'Find a market'], ['Ctrl K', 'Find a market'], ['B', 'Long'], ['S', 'Short'], ['M', 'Market order'], ['L', 'Limit order'], ['T', 'Stop order'], ['1 – 6', 'Timeframe, 1m to 1D'], ['G', 'Group the book'], ['E', 'Moving averages on or off'], ['W', 'Star this market'], ['[  ]', 'Previous or next starred market'], ['F', 'Type a size'], ['R', 'Size by USD or by risk'], ['?', 'This list'], ['Esc', 'Close']];
$('#keysL').innerHTML = KEYS.map(([k, v]) => `<div><span>${k.split(' ').filter(Boolean).map(x => x === '–' ? '–' : `<kbd>${esc(x)}</kbd>`).join(' ')}</span><em>${esc(v)}</em></div>`).join('');
const keys = open => { $('#keys').hidden = !open; };
$('#keysBtn').addEventListener('click', () => keys(true));
$('#keysX').addEventListener('click', () => keys(false));
$('#keys').addEventListener('click', e => { if (e.target.id === 'keys') keys(false); });
const TFK = { 1: '1m', 2: '5m', 3: '15m', 4: '1h', 5: '4h', 6: '1d' };
addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (!$('#picker').hidden) picker(false); if (!$('#keys').hidden) keys(false); return; }
  if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); picker(true); return; }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || !$('#picker').hidden) return;
  const k = e.key;
  const act = {
    '/': () => picker(true), '?': () => keys($('#keys').hidden),
    b: () => setSide('long'), s: () => setSide('short'), m: () => setType('market'), l: () => setType('limit'), t: () => setType('stop'),
    g: cycleGroup, e: () => { S.emas = S.emas.length ? [] : [20, 50]; emas(); }, w: () => watch.toggle(S.coin),
    '[': () => stepWatch(-1), ']': () => stepWatch(1), f: () => $('#tSize').focus(), r: () => setSzMode(S.szMode === 'usd' ? 'risk' : 'usd'),
  }[k.length === 1 ? k.toLowerCase() : k] || (TFK[k] && (() => setTf(TFK[k])));
  if (act) { e.preventDefault(); act(); }
});

// ---------- the sealed book and the private wallet ----------
$('#sTabs').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  $$('#sTabs button').forEach(x => x.classList.toggle('on', x === b));
  $$('.spane').forEach(p => { p.hidden = p.dataset.p !== b.dataset.t; });
  if (b.dataset.t === 'fund') fundingTab();
});
if (location.hash === '#wallet') { const b = $('#sTabs [data-t="priv"]'); b && b.click(); }
function privUI() {
  const st = WS.state(), btn = $('#pvDerive');
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
WS.onChange(() => { button(); privUI(); });
vaultState().then(v => {
  S.vault = v;
  const p = $('#vPill'); p.classList.toggle('open', !!v.open); p.querySelector('span').textContent = v.open ? 'Vault open' : 'Vault closed';
  $('#tnote').textContent = v.open ? 'Orders fill at Hyperliquid\'s price through the vault. Your lines stay on this screen.' : 'The vault opens once it is funded and has passed a live test on mainnet. Everything else on this desk is live.';
  button();
});
setSzMode(S.szMode);
H.liveMids();
let lastTick = 0;
H.on('mids', () => {
  const now = Date.now(); if (now - lastTick < 700) return; lastTick = now;
  wlTick();
  const m = H.markets.by[S.coin], v = H.mids[S.coin]; if (!m || !v) return;
  if (!$('#picker').hidden) return;
  calc(); emaLabels();
});
async function boot2() {
  try { await H.loadMarkets(); }
  catch (e) { $('#dBook').innerHTML = '<div class="ph">Hyperliquid could not be read just now. Retrying…</div>'; setTimeout(boot2, 4000); return; }
  setCoin(pickCoin());
  privUI(); button();
}
boot2();
setInterval(() => { if (!document.hidden) H.loadMarkets().catch(() => {}); }, 60000);
