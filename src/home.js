// VELIUS home: the intro, the veil, and a live overview of every page
import { $, $$, esc, px, pct, usdBig, cls, int, getJSON, dec, clock, big, fund, apr } from './fmt.js';
import { flicker, cipher, flash, countTo, calm } from './fx.js';
import * as H from './hl.js';
import { veil } from './veil.js';
import { Chart } from './chart.js';
import { boot } from './page.js';
import { silk } from './silk.js';
import { vaultState } from './shared.js';
import { treemap } from './treemap.js';
import { timed } from './widgets.js';

// ---------- the intro: once a session (?intro plays it again) ----------
function intro() {
  const el = $('#intro');
  const force = new URLSearchParams(location.search).has('intro');
  let seen = false; try { seen = sessionStorage.getItem('velius:intro') === '1'; } catch (e) {}
  const done = () => { el.classList.add('gone'); document.body.classList.remove('lock'); startName(); };
  if (calm || (seen && !force)) { done(); return; }
  try { sessionStorage.setItem('velius:intro', '1'); } catch (e) {}
  document.body.classList.add('lock');
  scrollTo(0, 0);
  let lifted = false;
  const lift = () => { if (lifted) return; lifted = true; el.classList.add('lift'); setTimeout(startName, 380); setTimeout(() => { el.classList.add('gone'); document.body.classList.remove('lock'); }, 1100); };
  requestAnimationFrame(() => el.classList.add('go'));
  const t = setTimeout(lift, 2550);
  el.addEventListener('click', () => { clearTimeout(t); lift(); });
  addEventListener('keydown', function k() { removeEventListener('keydown', k); clearTimeout(t); lift(); });
  setTimeout(() => { if (!el.classList.contains('gone')) done(); }, 6000);   // backstop
}
let named = false;
function startName() {
  if (named) return; named = true;
  const n = $('#name');
  if (!calm) { n.style.opacity = 0; n.style.transition = 'opacity .9s ease'; requestAnimationFrame(() => { n.style.opacity = 1; }); }
  flicker(n);
  flicker($('#brandWord'));
}
function railSpy() {
  const links = $$('#rail a');
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const id = '#' + e.target.id;
    links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === id));
  }), { rootMargin: '-45% 0px -50% 0px' });
  $$('main section[id]').forEach(s => s.id !== 'hero' && io.observe(s));
}

// ---------- live market chips under the name ----------
const CHIP_COINS = ['BTC', 'ETH', 'SOL', 'HYPE'];
function chips() {
  const box = $('#chips');
  const render = () => {
    const by = H.markets.by;
    if (!CHIP_COINS.some(c => by[c])) return;
    if (!box.children.length) box.innerHTML = CHIP_COINS.filter(c => by[c]).map(c => `<a class="mchip" href="/desk?m=${c}" data-c="${c}"><b>${c}</b><span class="p"></span><span class="c"></span></a>`).join('');
    for (const a of box.children) {
      const m = by[a.dataset.c]; if (!m) continue;
      const p = a.querySelector('.p'), c = a.querySelector('.c'), v = H.mids[m.name] || m.mark;
      const old = +p.dataset.v; p.dataset.v = v;
      p.textContent = px(v); c.textContent = pct(m.chg); c.className = 'c ' + cls(m.chg);
      if (old && old !== v) flash(p, v - old);
    }
  };
  H.on('markets', render); H.on('mids', render);
}

// ---------- 01: Hyperliquid in six numbers ----------
function pulse() {
  const g = k => $(`[data-s="${k}"]`);
  const render = () => {
    const L = H.markets.list; if (!L.length) return;
    const vol = L.reduce((a, m) => a + (m.vol || 0), 0), oi = L.reduce((a, m) => a + (m.oi || 0), 0);
    countTo(g('vol'), vol, v => '$' + big(v)); countTo(g('oi'), oi, v => '$' + big(v)); countTo(g('n'), L.length, v => int(v));
    const b = H.markets.by.BTC;
    if (b) { const f = g('fund'); f.textContent = fund(b.funding); f.className = 'mono ' + cls(b.funding); g('apr').textContent = apr(b.funding) + ' a year'; }
  };
  H.on('markets', render);
  setInterval(() => { g('next').textContent = clock(H.nextFunding() - Date.now()); }, 1000);
}

// ---------- 02: the public book ----------
function publicBook() {
  const box = $('#pubBook'), liveEl = $('#pubLive'), coinEl = $('#pubCoin');
  let coin = 'BTC', off = null;
  const draw = d => {
    const [bids, asks] = d.levels; const N = innerWidth < 640 ? 6 : 8;
    if (!bids.length || !asks.length) return;
    const A = asks.slice(0, N).reverse(), B = bids.slice(0, N);
    const all = A.concat(B), mx = Math.max(...all.map(l => +l.sz), 1e-9);
    const row = (l, s) => `<div class="ob-r ${s}"><i style="width:${Math.max(4, (+l.sz / mx) ** 0.6 * 100).toFixed(1)}%"></i><span>${px(+l.px)}</span><span>${(+l.sz).toLocaleString('en-US', { maximumFractionDigits: 4 })}</span><span>${l.n}</span></div>`;
    const spread = +asks[0].px - +bids[0].px;
    box.innerHTML = `<div class="ob-r" style="color:var(--faint);font-size:11px"><span>Price</span><span>Size</span><span>Orders</span></div>` + A.map(l => row(l, 'a')).join('') +
      `<div class="ob-sp"><span>Spread</span><b>${px(spread, dec(+asks[0].px))}</b><span>${((spread / +asks[0].px) * 100).toFixed(3)}%</span></div>` + B.map(l => row(l, 'b')).join('');
    liveEl.classList.add('on');
  };
  const set = c => {
    coin = c; coinEl.textContent = c; off && off();
    box.innerHTML = '<div class="ph">Reading the book…</div>';
    H.book(c).then(d => { if (coin === c) draw(d); }).catch(() => {});
    off = H.subscribe({ type: 'l2Book', coin: c }, d => { if (coin === c) draw(d); });
  };
  $('#pubPick').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $$('#pubPick button').forEach(x => x.classList.toggle('on', x === b)); set(b.dataset.c); });
  H.on('live', s => { if (s !== 'live') liveEl.classList.remove('on'); });
  set(coin);
}

// ---------- 03: the tape, every print on the public book ----------
const TAPE = ['BTC', 'ETH', 'SOL', 'HYPE'];
function tape() {
  const box = $('#tapeRows'); const seen = [];
  const add = t => {
    const v = +t.px * +t.sz, now = Date.now();
    seen.push({ t: now, v }); while (seen.length && now - seen[0].t > 60000) seen.shift();
    const ph = box.querySelector('.ph'); if (ph) ph.remove();
    const el = document.createElement('div');
    el.className = 'tp-r' + (v >= 100000 ? ' big' : '') + (calm ? '' : ' new');
    el.innerHTML = `<b>${esc(t.coin)}</b><span class="${t.side === 'B' ? 'b' : 's'}">${t.side === 'B' ? 'buy' : 'sell'}</span><span>${px(+t.px)}</span><span>${usdBig(v)}</span><span>${new Date(t.time).toLocaleTimeString([], { hour12: false })}</span>`;
    box.prepend(el);
    while (box.children.length > 26) box.lastChild.remove();
  };
  let pending = [];
  for (const c of TAPE) H.subscribe({ type: 'trades', coin: c }, a => { pending.push(...a); });
  setInterval(() => {
    if (!pending.length) return;
    pending.sort((a, b) => a.time - b.time).slice(-8).forEach(add); pending = [];
    const now = Date.now(), last = seen.filter(x => now - x.t <= 60000);
    $('#tpN').textContent = int(last.length);
    $('#tpV').textContent = usdBig(last.reduce((a, x) => a + x.v, 0));
    $('#tpW').textContent = int(last.filter(x => x.v >= 100000).length);
  }, 350);
}

// ---------- 05: the site, one live card per page ----------
let bmap = null;
function siteMap() {
  const box = $('#bxMap'); if (!box || !H.markets.list.length) return;
  bmap = treemap(box, H.markets.list, { metric: 'vol', max: innerWidth < 640 ? 14 : 24, live: n => H.mids[n], href: m => '/markets?m=' + encodeURIComponent(m.name), otherHref: '/markets' });
  $('#bxMkP').textContent = `All ${H.markets.list.length} of Hyperliquid's perps, sized by volume, coloured by the day's move.`;
}
let rz = 0;
new ResizeObserver(() => { clearTimeout(rz); rz = setTimeout(siteMap, 200); }).observe($('#bxMap'));
function mini() {
  const ch = new Chart($('#mini'), { gap: 5, volume: false, axis: false, cross: false });
  H.candles('BTC', '15m', 120).then(d => ch.set(d)).catch(() => {});
  H.subscribe({ type: 'candle', coin: 'BTC', interval: '15m' }, k => ch.push({ t: k.t, o: +k.o, h: +k.h, l: +k.l, c: +k.c, v: +k.v }));
  const upd = () => {
    const m = H.markets.by.BTC, v = H.mids.BTC || (m && m.mark), p = $('#bxPx');
    if (v) { const old = +p.dataset.v; p.dataset.v = v; p.textContent = px(v); if (old && old !== v) flash(p, v - old); ch.setMark(v); }
    if (m) { const c = $('#bxChg'); c.textContent = pct(m.chg); c.className = cls(m.chg); }
  };
  H.on('mids', upd); H.on('markets', upd);
}
async function siteChecks() {
  const hl = await timed(() => H.info({ type: 'allMids' }));
  const e = $('#bxHl'); e.textContent = hl.ok ? hl.ms + ' ms' : 'unreachable'; e.className = hl.ok ? 'up' : 'down';
  try { const j = await getJSON('/api/status', 12000); const s = $('#bxSlot'); s.className = 'up'; countTo(s, j.slot, n => int(n), 1200); }
  catch (err) { $('#bxSlot').textContent = 'offline'; $('#bxSlot').className = 'down'; }
}
H.on('live', s => { const w = $('#bxWs'); w.textContent = s === 'live' ? 'streaming' : s === 'connecting' ? 'connecting' : 'reconnecting'; w.className = s === 'live' ? 'up' : ''; });
async function ring() {
  try { const j = await getJSON('/api/ring', 25000); countTo($('#bxRing'), j.hour, v => int(v)); countTo($('[data-s="ring"]'), j.hour, v => int(v)); }
  catch (e) { $('#bxRing').textContent = '—'; }
}
async function vault() {
  const v = await vaultState();
  if (v.open) {
    $('#bxVault').textContent = 'Open, and taking deposits.';
    $$('#bxSteps i').forEach((i, k) => i.classList.toggle('ok', k < 6));
  } else { const s = $$('#bxSteps i'); if (s[3]) s[3].classList.add('now'); }
}

// ---------- 06: the markets table ----------
function marketsTable() {
  const rows = $('#mkRows'), count = $('#mkCount');
  const render = () => {
    const list = H.markets.list.slice().sort((a, b) => b.vol - a.vol).slice(0, 12);
    if (!list.length) return;
    rows.innerHTML = list.map(m => `<a class="mkr" href="/markets?m=${encodeURIComponent(m.name)}" data-c="${esc(m.name)}">
      <span class="sym"><span class="av">${esc(m.name.replace(/^k/, '').slice(0, 2))}</span>${esc(m.name)}<span class="lev">${Math.min(20, m.maxLev)}x</span></span>
      <span class="p">${px(H.mids[m.name] || m.mark)}</span><span class="${cls(m.chg)}">${pct(m.chg)}</span>
      <span class="hide-s ${cls(m.funding)}">${fund(m.funding)}</span><span class="hide-s">${usdBig(m.oi)}</span><span class="hide-m">${usdBig(m.vol)}</span></a>`).join('');
    count.textContent = `12 of ${H.markets.list.length} perps on Hyperliquid · read ${new Date(H.markets.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}`;
    $('#mkAll').textContent = `All ${H.markets.list.length} markets, on one map →`;
  };
  const tick = () => {
    for (const a of rows.children) {
      const m = H.markets.by[a.dataset.c]; if (!m) continue;
      const p = a.querySelector('.p'), v = H.mids[m.name]; if (!v) continue;
      const old = +p.dataset.v; p.dataset.v = v;
      if (old !== v) { p.textContent = px(v); if (old) flash(p, v - old); }
    }
  };
  H.on('markets', render); H.on('mids', tick);
}

// ---------- 07: funding, who pays the most, both ways ----------
function fundingBoard() {
  const render = () => {
    const L = H.markets.list.filter(m => isFinite(m.funding) && m.vol > 50000);
    if (!L.length) return;
    const yr = m => m.funding * 24 * 365 * 100;
    const pos = L.filter(m => m.funding > 0).sort((a, b) => b.funding - a.funding).slice(0, 8);
    const neg = L.filter(m => m.funding < 0).sort((a, b) => a.funding - b.funding).slice(0, 8);
    const mx = Math.max(...pos.concat(neg).map(m => Math.abs(yr(m))), 1e-9);
    const row = (m, col) => `<div class="fr"><a href="/markets?m=${encodeURIComponent(m.name)}">${esc(m.name)}</a><span class="bar"><i style="width:${(Math.abs(yr(m)) / mx * 100).toFixed(1)}%;background:${col}"></i></span><span class="v ${cls(m.funding)}">${apr(m.funding)}</span></div>`;
    $('#fundPos').innerHTML = pos.map(m => row(m, 'var(--up)')).join('') || '<div class="ph">No market pays this way right now.</div>';
    $('#fundNeg').innerHTML = neg.map(m => row(m, 'var(--down)')).join('') || '<div class="ph">No market pays this way right now.</div>';
  };
  H.on('markets', render);
}

// ---------- 09: the liquidation calculator, on the live mark ----------
function calc() {
  const mk = $('#cMk'), lev = $('#cLev'), levV = $('#cLevV');
  let side = 'long';
  const run = () => {
    const m = H.markets.by[mk.value]; if (!m) return;
    const max = Math.min(20, m.maxLev); lev.max = max; if (+lev.value > max) lev.value = max;
    const L = +lev.value, E = H.mids[m.name] || m.mark, mm = 1 / (2 * m.maxLev);
    levV.textContent = L + 'x';
    const liq = side === 'long' ? E * (1 - 1 / L) / (1 - mm) : E * (1 + 1 / L) / (1 + mm);
    $('#cEntry').textContent = px(E);
    $('#cLiq').textContent = px(liq);
    const mv = (liq / E - 1) * 100; const el = $('#cMove'); el.textContent = pct(mv); el.className = 'mono ' + (mv < 0 ? 'down' : 'up');
  };
  mk.addEventListener('change', run); lev.addEventListener('input', run);
  $('#cSide').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; side = b.dataset.s; $$('#cSide button').forEach(x => x.classList.toggle('on', x === b)); run(); });
  H.on('markets', run);
  let last = 0; H.on('mids', () => { if (Date.now() - last > 1000) { last = Date.now(); run(); } });
}

// ---------- go ----------
intro();
boot({ flick: false, rail: $('#rail'), hero: $('#hero') });
railSpy();
$$('[data-cipher]').forEach(el => cipher(el, +el.dataset.cipher));
veil($('#veil'));
chips(); pulse(); publicBook(); tape(); marketsTable(); fundingBoard(); mini(); calc();
H.liveMids();
let lastMap = 0;
H.on('markets', siteMap);
H.on('mids', () => { if (bmap && Date.now() - lastMap > 1500) { lastMap = Date.now(); bmap.recolor(H.markets.by); } });
const loadAll = () => H.loadMarkets().catch(() => { $('#mkRows').innerHTML = '<div class="ph">Hyperliquid could not be read just now. Retrying…</div>'; });
loadAll(); setInterval(() => { if (!document.hidden) loadAll(); }, 30000);
ring(); setInterval(() => { if (!document.hidden) ring(); }, 60000);
vault(); siteChecks(); setInterval(() => { if (!document.hidden) siteChecks(); }, 45000);
silk($('#endSilk'));
