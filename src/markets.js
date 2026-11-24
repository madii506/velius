// VELIUS markets: every Hyperliquid perp on one live map, a sortable table, the movers, and a drawer per market
import { $, $$, esc, px, pct, usdBig, cls, clock, fund, apr, store, int, big, sz } from './fmt.js';
import { flash, countTo, calm } from './fx.js';
import * as H from './hl.js';
import { boot } from './page.js';
import { silk } from './silk.js';
import { treemap, mapTip } from './treemap.js';
import { watch, STAR } from './watch.js';
import { columns, fundingHistory } from './widgets.js';
import { Chart } from './chart.js';

boot();
silk($('#silk'), { n: 26, amp: 0.06, alpha: 0.7, top: 0.38, span: 0.56 });

const S = {
  f: 'all', q: '',
  metric: store.get('velius:mk:metric', 'vol'),
  view: store.get('velius:mk:view', 'map'),
  sort: store.get('velius:mk:sort', { k: 'vol', d: -1 }),
};
const live = n => H.mids[n];
const av = n => esc(n.replace(/^k/, '').slice(0, 2));
const lev = m => Math.min(20, m.maxLev);
const prem = m => m.oracle ? (m.mark / m.oracle - 1) * 100 : NaN;
const priceOf = m => live(m.name) || m.mark;

// ---------- the numbers across every market ----------
function kpis() {
  const L = H.markets.list; if (!L.length) return;
  const g = k => $(`[data-k="${k}"]`);
  const vol = L.reduce((a, m) => a + m.vol, 0), oi = L.reduce((a, m) => a + m.oi, 0);
  countTo(g('n'), L.length, v => int(v)); countTo(g('vol'), vol, v => '$' + big(v)); countTo(g('oi'), oi, v => '$' + big(v));
  const up = L.filter(m => m.chg > 0).length, dn = L.filter(m => m.chg < 0).length, t = up + dn || 1;
  g('br').innerHTML = `<span class="up">${up}</span> · <span class="down">${dn}</span>`;
  const [a, b] = g('brb').children; a.style.width = (up / t * 100) + '%'; b.style.width = (dn / t * 100) + '%';
  const fw = oi ? L.reduce((s, m) => s + (m.funding || 0) * m.oi, 0) / oi : NaN;
  const f = g('fw'); f.textContent = fund(fw); f.className = 'mono ' + cls(fw);
  g('fwy').textContent = apr(fw) + ' a year';
}
setInterval(() => {
  const e = $('[data-k="next"]'); if (e) e.textContent = clock(H.nextFunding() - Date.now());
  if (D.coin) { const n = $('#drNext'); if (n) n.textContent = clock(H.nextFunding() - Date.now()); }
}, 1000);

// ---------- one filter row scopes the map, the table and the count ----------
function filtered() {
  const q = S.q.trim().toUpperCase();
  return H.markets.list.filter(m => {
    if (q && !m.name.toUpperCase().includes(q)) return false;
    switch (S.f) {
      case 'watch': return watch.has(m.name);
      case 'up': return m.chg > 0;
      case 'down': return m.chg < 0;
      case 'fpos': return m.funding > 0;
      case 'fneg': return m.funding < 0;
      case 'lev': return m.maxLev >= 20;
      default: return true;
    }
  });
}
const emptyMsg = () => S.f === 'watch' && !S.q ? 'Your watchlist is empty. Star a market in the table or in its drawer.' : 'No market matches.';
function render() {
  const n = filtered().length, all = H.markets.list.length;
  $('#count').textContent = all ? `${n === all ? all : n + ' of ' + all} perps · read ${new Date(H.markets.at).toLocaleTimeString([], { hour12: false })}` : '';
  if (S.view === 'map') drawMap(); else drawTable();
}

// ---------- the map ----------
let tm = null;
function drawMap() {
  const box = $('#map'), list = filtered();
  if (!H.markets.list.length) return;
  if (!list.length) { tm = null; $('#mapBox').classList.add('empty'); box.innerHTML = `<div class="ph">${emptyMsg()}</div>`; return; }
  $('#mapBox').classList.remove('empty');
  tm = treemap(box, list, { metric: S.metric, max: innerWidth < 640 ? 36 : 90, live, onPick: n => n ? openDetail(n) : (sortBy(S.metric, -1), setView('table')) });
  $('#lgLo').textContent = '−' + tm.cap + '%'; $('#lgHi').textContent = '+' + tm.cap + '%';
  $('#lgSize').textContent = S.metric === 'vol' ? '24h volume' : 'open interest';
}
mapTip($('#map'), $('#mapTip'), () => H.markets.by, live);
let rz = 0;
new ResizeObserver(() => { clearTimeout(rz); rz = setTimeout(() => S.view === 'map' && drawMap(), 160); }).observe($('#map'));

// ---------- the table ----------
const COLS = { name: m => m.name, price: priceOf, chg: m => m.chg, vol: m => m.vol, oi: m => m.oi, funding: m => m.funding, apr: m => m.funding, prem, maxLev: m => m.maxLev };
function sortBy(k, d) { S.sort = { k, d }; store.set('velius:mk:sort', S.sort); }
function row(m) {
  const p = prem(m);
  return `<div class="mt-r" data-c="${esc(m.name)}">
    <button class="star${watch.has(m.name) ? ' on' : ''}" type="button" data-star="${esc(m.name)}" aria-label="Watch ${esc(m.name)}" aria-pressed="${watch.has(m.name)}">${STAR}</button>
    <button class="nm" type="button" data-open="${esc(m.name)}"><span class="av">${av(m.name)}</span>${esc(m.name)}<em>${lev(m)}x</em></button>
    <span class="p">${px(priceOf(m))}</span><span class="c ${cls(m.chg)}">${pct(m.chg)}</span>
    <span class="hide-s">${usdBig(m.vol)}</span><span class="hide-s">${usdBig(m.oi)}</span>
    <span class="hide-m ${cls(m.funding)}">${fund(m.funding)}</span><span class="hide-m ${cls(m.funding)}">${apr(m.funding)}</span>
    <span class="hide-m ${cls(p)}">${pct(p, 3)}</span><span class="hide-m lv">${m.maxLev}x</span></div>`;
}
const vis = new Set(); let rio = null;
function drawTable() {
  const list = filtered(), { k, d } = S.sort, f = COLS[k] || COLS.vol;
  list.sort((a, b) => { const x = f(a), y = f(b); if (typeof x === 'string') return x.localeCompare(y) * d; return ((isFinite(x) ? x : -Infinity) - (isFinite(y) ? y : -Infinity)) * d; });
  $$('#thead button').forEach(b => b.dataset.s === k ? b.setAttribute('aria-sort', d > 0 ? 'ascending' : 'descending') : b.removeAttribute('aria-sort'));
  $('#rows').innerHTML = list.map(row).join('') || `<div class="ph">${emptyMsg()}</div>`;
  rio && rio.disconnect(); vis.clear();
  rio = new IntersectionObserver(es => es.forEach(e => e.isIntersecting ? vis.add(e.target) : vis.delete(e.target)));
  $$('#rows .mt-r').forEach(r => rio.observe(r));
}
function tickTable() {
  for (const r of vis) {
    const m = H.markets.by[r.dataset.c]; if (!m) continue;
    const p = r.querySelector('.p'), v = priceOf(m), old = +p.dataset.v;
    if (old !== v) { p.dataset.v = v; p.textContent = px(v); if (old) flash(p, v - old); }
    const c = r.querySelector('.c'); c.textContent = pct(m.chg); c.className = 'c ' + cls(m.chg);
  }
}
$('#thead').addEventListener('click', e => {
  const b = e.target.closest('button[data-s]'); if (!b) return;
  const k = b.dataset.s; sortBy(k, S.sort.k === k ? -S.sort.d : k === 'name' ? 1 : -1); drawTable();
});
$('#rows').addEventListener('click', e => {
  const st = e.target.closest('[data-star]');
  if (st) { e.stopPropagation(); const on = watch.toggle(st.dataset.star); st.classList.toggle('on', on); st.setAttribute('aria-pressed', on); if (S.f === 'watch') render(); return; }
  const r = e.target.closest('.mt-r'); if (r) openDetail(r.dataset.c);
});

// ---------- the controls ----------
function setView(v) {
  S.view = v; store.set('velius:mk:view', v);
  $$('#view button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  $('#mapBox').hidden = v !== 'map'; $('#legend').hidden = v !== 'map'; $('#tblBox').hidden = v !== 'table';
  render();
}
$('#view').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setView(b.dataset.v); });
$('#metric').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  S.metric = b.dataset.m; store.set('velius:mk:metric', S.metric);
  $$('#metric button').forEach(x => x.classList.toggle('on', x === b)); drawMap();
});
$$('#metric button').forEach(x => x.classList.toggle('on', x.dataset.m === S.metric));
$('#filters').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  S.f = b.dataset.f; $$('#filters button').forEach(x => x.classList.toggle('on', x === b)); render();
});
$('#q').addEventListener('input', e => { S.q = e.target.value; render(); });
addEventListener('keydown', e => {
  if (e.key === 'Escape' && D.coin) { closeDetail(); return; }
  if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !D.coin) { e.preventDefault(); $('#q').focus(); }
});

// ---------- movers ----------
function movers() {
  const L = H.markets.list.filter(m => m.vol >= 250000 && isFinite(m.chg));
  if (!L.length) return;
  const a = (m, right, sub) => `<a href="/markets?m=${encodeURIComponent(m.name)}" data-c="${esc(m.name)}"><b><span class="av">${av(m.name)}</span>${esc(m.name)}</b><span>${right}${sub ? `<small>${sub}</small>` : ''}</span></a>`;
  $('#mvUp').innerHTML = L.filter(m => m.chg > 0).sort((x, y) => y.chg - x.chg).slice(0, 6).map(m => a(m, `<span class="up">${pct(m.chg)}</span>`, px(priceOf(m)))).join('') || '<div class="ph">Nothing is up right now.</div>';
  $('#mvDn').innerHTML = L.filter(m => m.chg < 0).sort((x, y) => x.chg - y.chg).slice(0, 6).map(m => a(m, `<span class="down">${pct(m.chg)}</span>`, px(priceOf(m)))).join('') || '<div class="ph">Nothing is down right now.</div>';
  $('#mvOi').innerHTML = H.markets.list.slice().sort((x, y) => y.oi - x.oi).slice(0, 6).map(m => a(m, usdBig(m.oi), `<span class="${cls(m.chg)}">${pct(m.chg)}</span>`)).join('');
  $('#mvF').innerHTML = L.filter(m => m.funding).sort((x, y) => Math.abs(y.funding) - Math.abs(x.funding)).slice(0, 6).map(m => a(m, `<span class="${cls(m.funding)}">${apr(m.funding)}</span>`, fund(m.funding) + ' an hour')).join('');
}
$('#movers').addEventListener('click', e => { const l = e.target.closest('a[data-c]'); if (l) { e.preventDefault(); openDetail(l.dataset.c); } });

// ---------- the drawer: one market, everything live ----------
const D = { coin: null, offs: [], tf: '1h', chart: null, fund: null, back: null, candleOff: null };
function subsOff() { D.offs.forEach(f => f()); D.offs = []; D.candleOff && D.candleOff(); D.candleOff = null; }
function openDetail(c) {
  const m = H.markets.by[c]; if (!m) return;
  if (D.coin !== c) subsOff();
  if (!D.coin) D.back = document.activeElement;
  D.coin = c;
  $('#drawer').hidden = false; $('#drBack').hidden = false; document.body.classList.add('lock');
  history.replaceState(null, '', '/markets?m=' + encodeURIComponent(c));
  $('#drAv').textContent = c.replace(/^k/, '').slice(0, 2); $('#drName').textContent = c;
  $('#drSub').textContent = `Up to ${lev(m)}x on Velius · ${m.maxLev}x on Hyperliquid${m.onlyIso ? ' · isolated only' : ''}`;
  $('#drTrade').href = '/desk?m=' + encodeURIComponent(c);
  starUI(); stats(true); liqGrid();
  if (!D.chart) D.chart = new Chart($('#drChart'), { gap: 6, volume: true });
  loadChart();
  if (!D.fund) D.fund = columns($('#drFund'), { pos: '#2bd38f', neg: '#ff4d6a', fmt: v => fund(v) + ' an hour', label: r => r.label, aria: 'Hourly funding over the last seven days' });
  D.fund.set([]); $('#drFundN').textContent = 'reading…';
  fundingHistory(c).then(rows => {
    if (D.coin !== c) return;
    D.fund.set(rows);
    const avg = rows.reduce((s, x) => s + x.v, 0) / (rows.length || 1);
    $('#drFundN').innerHTML = rows.length ? `average <b class="${cls(avg)}">${fund(avg)}</b> · ${apr(avg)} a year` : 'none paid in 7 days';
  }).catch(() => { $('#drFundN').textContent = 'could not be read just now'; });
  $('#drBook').innerHTML = '<div class="ph">Reading the book…</div>'; $('#drTrades').innerHTML = '<div class="ph">Waiting for trades…</div>'; $('#drLive').classList.remove('on');
  H.book(c).then(d => { if (D.coin === c) drBook(d); }).catch(() => {});
  H.recentTrades(c).then(a => { if (D.coin !== c) return; $('#drTrades').innerHTML = ''; a.slice(0, 17).reverse().forEach(t => drTrade(t, false)); }).catch(() => {});
  D.offs.push(H.subscribe({ type: 'l2Book', coin: c }, d => { if (D.coin === c) drBook(d); }));
  D.offs.push(H.subscribe({ type: 'trades', coin: c }, a => { if (D.coin === c) a.forEach(t => drTrade(t, true)); }));
  D.offs.push(H.subscribe({ type: 'activeAssetCtx', coin: c }, d => {
    if (D.coin !== c || !d.ctx) return; const x = d.ctx, mark = +x.markPx, prev = +x.prevDayPx;
    Object.assign(m, { mark, oracle: +x.oraclePx, funding: +x.funding, oi: +x.openInterest * mark, vol: +x.dayNtlVlm, prev, chg: prev ? (mark / prev - 1) * 100 : m.chg });
    stats(); liqGrid();
  }));
  setTimeout(() => $('#drX').focus(), 30);
}
function closeDetail() {
  if (!D.coin) return;
  subsOff(); D.coin = null;
  $('#drawer').hidden = true; $('#drBack').hidden = true; document.body.classList.remove('lock');
  history.replaceState(null, '', '/markets');
  if (D.back && D.back.focus && document.contains(D.back)) D.back.focus();
}
$('#drX').addEventListener('click', closeDetail);
$('#drBack').addEventListener('click', closeDetail);
document.addEventListener('focusin', e => { if (D.coin && !$('#drawer').contains(e.target)) $('#drX').focus(); });
function starUI() { const b = $('#drStar'), on = watch.has(D.coin); b.innerHTML = STAR; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); b.setAttribute('aria-label', on ? 'Remove from watchlist' : 'Add to watchlist'); }
$('#drStar').addEventListener('click', () => {
  watch.toggle(D.coin); starUI();
  const s = $(`#rows [data-star="${CSS.escape(D.coin)}"]`); if (s) s.classList.toggle('on', watch.has(D.coin));
  if (S.f === 'watch') render();
});
function stats(fresh) {
  const m = H.markets.by[D.coin]; if (!m) return;
  const v = priceOf(m), el = $('#drPx'), old = fresh ? 0 : +el.dataset.v;
  el.dataset.v = v; el.textContent = px(v); if (old && old !== v) flash(el, v - old);
  const ch = $('#drChg'); ch.textContent = pct(m.chg) + ' · 24h'; ch.className = 'mono ' + cls(m.chg);
  const step = 1 / 10 ** m.szDec;
  const cells = [
    ['Mark', px(m.mark)], ['Oracle', px(m.oracle)], ['Mark vs oracle', `<span class="${cls(prem(m))}">${pct(prem(m), 3)}</span>`], ['Funding, 1h', `<span class="${cls(m.funding)}">${fund(m.funding)}</span>`],
    ['Funding, a year', `<span class="${cls(m.funding)}">${apr(m.funding)}</span>`], ['Next funding', `<span id="drNext">${clock(H.nextFunding() - Date.now())}</span>`], ['Open interest', usdBig(m.oi)], ['Volume, 24h', usdBig(m.vol)],
    ['Open interest, coins', big(m.mark ? m.oi / m.mark : NaN)], ['Size step', `${step.toFixed(m.szDec)}`], ['Minimum order', '$10'], ['Max leverage', `${lev(m)}x · HL ${m.maxLev}x`],
  ];
  $('#drStats').innerHTML = cells.map(([k, val]) => `<div><span>${k}</span><b>${val}</b></div>`).join('');
}
function liqGrid() {
  const m = H.markets.by[D.coin]; if (!m) return;
  const E = priceOf(m), mm = 1 / (2 * m.maxLev), max = lev(m);
  const levs = [...new Set([2, 5, 10, 20].map(x => Math.min(x, max)))].filter(x => x > 1);
  const liq = (L, s) => s > 0 ? E * (1 - 1 / L) / (1 - mm) : E * (1 + 1 / L) / (1 + mm);
  const cell = (L, s) => { const p = liq(L, s), mv = (p / E - 1) * 100; return `<span>${px(p)}<small class="${mv < 0 ? 'down' : 'up'}">${pct(mv, 1)}</small></span>`; };
  const box = $('#drLiq'); box.style.setProperty('--n', levs.length);
  box.innerHTML = `<span class="h s">Leverage</span>${levs.map(L => `<span class="h">${L}x</span>`).join('')}<span class="s">Long</span>${levs.map(L => cell(L, 1)).join('')}<span class="s">Short</span>${levs.map(L => cell(L, -1)).join('')}`;
}
function drBook(d) {
  const [bids, asks] = d.levels; if (!bids.length || !asks.length) return;
  const N = 8, A = asks.slice(0, N).reverse(), B = bids.slice(0, N);
  let ca = 0, cb = 0; const cumA = asks.slice(0, N).map(l => (ca += +l.sz)).reverse(), cumB = B.map(l => (cb += +l.sz));
  const mx = Math.max(ca, cb, 1e-9);
  const r = (l, c, s) => `<div class="db ${s}"><i style="width:${(c / mx * 100).toFixed(1)}%"></i><span>${px(+l.px)}</span><span>${sz(+l.sz)}</span></div>`;
  const sp = +asks[0].px - +bids[0].px, mid = (+asks[0].px + +bids[0].px) / 2;
  $('#drBook').innerHTML = A.map((l, i) => r(l, cumA[i], 'a')).join('') + `<div class="db-m"><span>spread ${(sp / mid * 100).toFixed(3)}%</span><b>${px(mid)}</b></div>` + B.map((l, i) => r(l, cumB[i], 'b')).join('');
  $('#drLive').classList.add('on');
}
function drTrade(t, fresh) {
  const box = $('#drTrades'), ph = box.querySelector('.ph'); if (ph) ph.remove();
  const el = document.createElement('div'); el.className = 'dt ' + (t.side === 'B' ? 'b' : 's') + (fresh && !calm ? ' new' : '');
  el.innerHTML = `<span>${px(+t.px)}</span><span>${sz(+t.sz)}</span><span>${new Date(t.time).toLocaleTimeString([], { hour12: false })}</span>`;
  box.prepend(el); while (box.children.length > 17) box.lastChild.remove();
}
function loadChart() {
  const c = D.coin, tf = D.tf; D.chart.set([]);
  $$('#drTf button').forEach(b => b.classList.toggle('on', b.dataset.tf === tf));
  H.candles(c, tf, 200).then(k => { if (D.coin === c && D.tf === tf) D.chart.set(k); }).catch(() => {});
  D.candleOff && D.candleOff();
  D.candleOff = H.subscribe({ type: 'candle', coin: c, interval: tf }, k => { if (D.coin === c && D.tf === tf) D.chart.push({ t: k.t, o: +k.o, h: +k.h, l: +k.l, c: +k.c, v: +k.v }); });
}
$('#drTf').addEventListener('click', e => { const b = e.target.closest('button'); if (!b || b.dataset.tf === D.tf) return; D.tf = b.dataset.tf; loadChart(); });

// ---------- go ----------
H.liveMids();
let last = 0;
H.on('mids', () => {
  const now = Date.now(); if (now - last < 900) return; last = now;
  tm && S.view === 'map' && tm.recolor(H.markets.by);
  S.view === 'table' && tickTable();
  if (D.coin) { stats(); liqGrid(); }
});
H.on('live', s => $('#live').classList.toggle('on', s === 'live'));
H.on('markets', () => { kpis(); render(); movers(); if (D.coin) stats(); });
let opened = false;
async function load() {
  try { await H.loadMarkets(); }
  catch (e) { if (!H.markets.list.length) $('#map').innerHTML = '<div class="ph">Hyperliquid could not be read just now. Retrying…</div>'; setTimeout(load, 5000); return; }
  if (!opened) { opened = true; const want = new URLSearchParams(location.search).get('m'); if (want && H.markets.by[want]) openDetail(want); }
}
setView(S.view);
load();
setInterval(() => { if (!document.hidden) H.loadMarkets().catch(() => {}); }, 30000);
