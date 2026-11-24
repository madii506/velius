// VELIUS home: the intro, the veil, and every live panel on the page
import { $, $$, esc, px, pct, usd, usdBig, cls, int, getJSON, dec, short, clock, big } from './fmt.js';
import { reveal, flicker, cipher, spotlight, flash, countTo, calm } from './fx.js';
import * as H from './hl.js';
import { veil } from './veil.js';
import { Chart } from './chart.js';
import { walletMenu, closeMenus, wireSheet, WS, ringLive, vaultState, derive, remembered, registered } from './shared.js';

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

// ---------- the bar, the progress line and the section rail ----------
function chrome() {
  const top = $('#top'), bar = $('#progress'), rail = $('#rail'), hero = $('#hero');
  const onScroll = () => {
    const y = scrollY, max = document.documentElement.scrollHeight - innerHeight;
    top.classList.toggle('scrolled', y > 8);
    bar.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
    rail.classList.toggle('show', y > hero.offsetHeight * 0.7);
  };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  const links = $$('#rail a'), nav = $$('.nav a');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      const id = '#' + e.target.id;
      links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === id));
      nav.forEach(a => a.classList.toggle('on', a.getAttribute('href') === id));
    }), { rootMargin: '-45% 0px -50% 0px' });
    $$('main section[id]').forEach(s => s.id !== 'hero' && io.observe(s));
  }
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

// ---------- right now: Hyperliquid in six numbers ----------
function pulse() {
  const g = k => $(`[data-s="${k}"]`);
  const render = () => {
    const L = H.markets.list; if (!L.length) return;
    const vol = L.reduce((a, m) => a + (m.vol || 0), 0), oi = L.reduce((a, m) => a + (m.oi || 0), 0);
    countTo(g('vol'), vol, v => '$' + big(v)); countTo(g('oi'), oi, v => '$' + big(v)); countTo(g('n'), L.length, v => int(v));
    const b = H.markets.by.BTC;
    if (b) { const f = g('fund'); f.textContent = (b.funding * 100).toFixed(4) + '%'; f.className = 'mono ' + cls(b.funding); g('apr').textContent = pct(b.funding * 24 * 365 * 100, 1) + ' a year'; }
  };
  H.on('markets', render);
  setInterval(() => { g('next').textContent = clock(H.nextFunding() - Date.now()); }, 1000);
}

// ---------- the tape: every print on the public book, live ----------
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
  // a steady cadence, so a burst of fills reads as a tape and not a flicker
  setInterval(() => {
    if (!pending.length) return;
    pending.sort((a, b) => a.time - b.time).slice(-8).forEach(add); pending = [];
    const now = Date.now(), last = seen.filter(x => now - x.t <= 60000);
    $('#tpN').textContent = int(last.length);
    $('#tpV').textContent = usdBig(last.reduce((a, x) => a + x.v, 0));
    $('#tpW').textContent = int(last.filter(x => x.v >= 100000).length);
  }, 350);
}

// ---------- funding: who pays the most, both ways ----------
function fundingBoard() {
  const render = () => {
    const L = H.markets.list.filter(m => isFinite(m.funding) && m.vol > 50000);
    if (!L.length) return;
    const apr = m => m.funding * 24 * 365 * 100;
    const pos = L.filter(m => m.funding > 0).sort((a, b) => b.funding - a.funding).slice(0, 8);
    const neg = L.filter(m => m.funding < 0).sort((a, b) => a.funding - b.funding).slice(0, 8);
    const mx = Math.max(...pos.concat(neg).map(m => Math.abs(apr(m))), 1e-9);
    const row = (m, col) => `<div class="fr"><a href="/desk?m=${encodeURIComponent(m.name)}">${esc(m.name)}</a><span class="bar"><i style="width:${(Math.abs(apr(m)) / mx * 100).toFixed(1)}%;background:${col}"></i></span><span class="v ${cls(m.funding)}">${pct(apr(m), 1)}</span></div>`;
    $('#fundPos').innerHTML = pos.map(m => row(m, 'linear-gradient(90deg,rgba(43,211,143,.35),#2bd38f)')).join('') || '<div class="ph">No market pays this way right now.</div>';
    $('#fundNeg').innerHTML = neg.map(m => row(m, 'linear-gradient(90deg,rgba(255,77,106,.35),#ff4d6a)')).join('') || '<div class="ph">No market pays this way right now.</div>';
  };
  H.on('markets', render);
}

// ---------- scan: what the chain already knows about an address ----------
function scan() {
  const out = $('#scanOut');
  const run = async addr => {
    addr = (addr || '').trim();
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr)) { out.innerHTML = '<div class="ph">That is not a Solana address.</div>'; return; }
    out.innerHTML = '<div class="ph scanning">Reading the chain</div>';
    try {
      const j = await getJSON('/api/scan?addr=' + encodeURIComponent(addr), 15000);
      const first = j.firstSeen ? new Date(j.firstSeen * 1000).toISOString().slice(0, 10) : '—';
      out.innerHTML = `<div class="kv">
        <div><span>Visible value</span><b data-c="usd">$0</b></div><div><span>SOL</span><b>${(j.sol || 0).toLocaleString('en-US', { maximumFractionDigits: 3 })}</b></div>
        <div><span>Tokens held</span><b>${int(j.tokens)}</b></div><div><span>Transactions${j.txCapped ? ', last 1,000' : ''}</span><b>${int(j.txs)}</b></div>
        <div><span>Oldest seen</span><b style="font-size:15px">${first}</b></div><div><span>Wallet</span><b style="font-size:15px">${short(addr)}</b></div></div>
        <div class="hold">${(j.top || []).map(t => `<div><span>${esc(t.sym)}</span><span>${big(t.amount)}</span><span>${t.usd != null ? usd(t.usd) : '—'}</span></div>`).join('') || '<div><span>No priced tokens</span><span></span><span></span></div>'}</div>
        <div class="verdict">All of this is public, right now, for anyone. Inside the Ring, balances and transfers are encrypted.</div>`;
      countTo(out.querySelector('[data-c="usd"]'), j.usd || 0, v => '$' + int(v));
    } catch (e) { out.innerHTML = `<div class="ph">Could not read the chain (${esc(String(e.message || e).slice(0, 60))}). Try again.</div>`; }
  };
  $('#scanF').addEventListener('submit', e => { e.preventDefault(); run($('#scanQ').value); });
  $('#scanMine').addEventListener('click', e => {
    e.stopPropagation();
    const a = WS.state().address;
    if (!a) { $('#wBtn').click(); return; }
    $('#scanQ').value = a; run(a);
  });
}

// ---------- your private wallet, derived here ----------
function deriveHome() {
  const btn = $('#dvBtn'), msg = $('#dvMsg');
  const ui = () => {
    const st = WS.state(), addr = st.address ? remembered() : null;
    $('#dv1').classList.toggle('done', !!st.address);
    $('#dv1s').textContent = st.address ? short(st.address) + ' · ' + st.wallet.name : 'Phantom, Solflare or Backpack';
    $('#dv2').classList.toggle('done', !!addr); $('#dv3').classList.toggle('done', !!addr);
    $('#dvAddr').textContent = addr ? addr : 'appears here';
    btn.textContent = !st.address ? 'Connect a wallet' : addr ? 'Derive again' : 'Derive my private wallet';
    btn.dataset.do = st.address ? 'derive' : 'connect';
    if (st.address) registered(st.address).then(j => { $('#dvReg').textContent = j.registered ? 'yes, registered' : 'not yet'; $('#dv4').classList.toggle('done', !!j.registered); }).catch(() => { $('#dvReg').textContent = 'could not read'; });
    else { $('#dvReg').textContent = '—'; $('#dv4').classList.remove('done'); }
  };
  btn.addEventListener('click', async e => {
    e.stopPropagation();
    if (btn.dataset.do === 'connect') { $('#wBtn').click(); return; }
    btn.disabled = true; msg.textContent = 'Sign the message in your wallet…';
    try { await derive(); msg.textContent = 'Derived in this tab. Only the address is remembered; the keys are not.'; }
    catch (err) { msg.textContent = String(err.message || err).slice(0, 120); }
    btn.disabled = false; ui();
  });
  WS.onChange(ui); ui();
}

// ---------- 01: the public book ----------
function publicBook() {
  const box = $('#pubBook'), liveEl = $('#pubLive'), coinEl = $('#pubCoin');
  let coin = 'BTC', off = null;
  const draw = d => {
    const [bids, asks] = d.levels; const N = innerWidth < 640 ? 6 : 8;
    const A = asks.slice(0, N).reverse(), B = bids.slice(0, N);
    const all = A.concat(B), mx = Math.max(...all.map(l => +l.sz), 1e-9);
    const row = (l, s) => `<div class="ob-r ${s}"><i style="width:${Math.max(4, (+l.sz / mx) ** 0.6 * 100).toFixed(1)}%"></i><span>${px(+l.px)}</span><span>${(+l.sz).toLocaleString('en-US', { maximumFractionDigits: 4 })}</span><span>${l.n}</span></div>`;
    const spread = asks[0] && bids[0] ? +asks[0].px - +bids[0].px : NaN;
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

// ---------- 04: the markets table ----------
function marketsTable() {
  const rows = $('#mkRows'), count = $('#mkCount');
  const render = () => {
    const list = H.markets.list.slice().sort((a, b) => b.vol - a.vol).slice(0, 12);
    if (!list.length) return;
    rows.innerHTML = list.map(m => `<a class="mkr" href="/desk?m=${encodeURIComponent(m.name)}" data-c="${esc(m.name)}">
      <span class="sym"><span class="av">${esc(m.name.replace(/^k/, '').slice(0, 2))}</span>${esc(m.name)}<span class="lev">${Math.min(20, m.maxLev)}x</span></span>
      <span class="p">${px(H.mids[m.name] || m.mark)}</span><span class="${cls(m.chg)}">${pct(m.chg)}</span>
      <span class="hide-s ${cls(m.funding)}">${(m.funding * 100).toFixed(4)}%</span><span class="hide-s">${usdBig(m.oi)}</span><span class="hide-m">${usdBig(m.vol)}</span></a>`).join('');
    count.textContent = `${H.markets.list.length} perps on Hyperliquid · read ${new Date(H.markets.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
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

// ---------- 05: the mini chart ----------
function mini() {
  const ch = new Chart($('#mini'), { gap: 6, volume: true });
  const pEl = $('#miniPx'), cEl = $('#miniChg');
  H.candles('BTC', '15m', 140).then(d => ch.set(d)).catch(() => {});
  H.subscribe({ type: 'candle', coin: 'BTC', interval: '15m' }, k => ch.push({ t: k.t, o: +k.o, h: +k.h, l: +k.l, c: +k.c, v: +k.v }));
  const upd = () => { const m = H.markets.by.BTC; const v = H.mids.BTC || (m && m.mark); if (v) { pEl.textContent = px(v); ch.setMark(v); } if (m) { cEl.textContent = pct(m.chg); cEl.className = 'mono ' + cls(m.chg); } };
  H.on('mids', upd); H.on('markets', upd);
}

// ---------- 07: the liquidation calculator, on the live mark ----------
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

// ---------- 09 + 11: the vault and the live checks ----------
async function vault() {
  const v = await vaultState();
  $('#vaultWord').textContent = v.open ? 'is open.' : 'opens soon.';
  if (v.open) { $('#rollVault').classList.add('ok'); $('#rollOpen').classList.add('ok'); $('#rollVault span').textContent = 'Done'; $('#rollOpen span').textContent = 'Open'; }
  setCheck('vault', v.open ? 'open' : 'closed', v.open ? 'ok' : 'wait', v.open ? 'taking deposits' : 'opens once funded and tested live');
}
function setCheck(k, txt, c, small) {
  const el = $(`[data-k="${k}"]`); if (!el) return;
  const v = el.querySelector('.v'); v.textContent = txt; v.className = 'v mono ' + (c || '');
  if (small != null) el.querySelector('small').textContent = small;
}
async function checks() {
  const t0 = performance.now();
  try { await H.info({ type: 'allMids' }); setCheck('hl', Math.round(performance.now() - t0) + ' ms', 'ok'); }
  catch (e) { setCheck('hl', 'unreachable', 'bad', 'retrying'); }
  try {
    const j = await getJSON('/api/status', 12000);
    const s = $('[data-k="slot"] .v'); s.className = 'v mono ok'; countTo(s, j.slot, n => int(n), 1400);
    for (const k of ['ring', 'registry']) { const a = j[k] || {}; setCheck(k, a.ok ? 'live' : 'not found', a.ok ? 'ok' : 'bad', a.address ? a.address.slice(0, 6) + '…' + a.address.slice(-4) : ''); }
  } catch (e) { for (const k of ['slot', 'ring', 'registry']) setCheck(k, 'offline', 'bad', 'retrying'); }
}
H.on('live', s => setCheck('ws', s === 'live' ? 'streaming' : s === 'connecting' ? 'connecting' : 'reconnecting', s === 'live' ? 'ok' : 'wait'));

// ---------- the end: the same silk, slower ----------
function endSilk() {
  const cv = $('#endSilk'), g = cv.getContext('2d'); let W, H2, raf = 0, on = false;
  const size = () => { const r = cv.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 1.5); W = r.width; H2 = r.height; cv.width = W * d; cv.height = H2 * d; g.setTransform(d, 0, 0, d, 0, 0); };
  addEventListener('resize', size, { passive: true }); size();
  const draw = t => {
    g.clearRect(0, 0, W, H2);
    const n = W < 700 ? 22 : 36;
    for (let k = 0; k < n; k++) {
      const f = k / (n - 1), hot = k % 7 === 2;
      g.strokeStyle = `rgba(150,130,255,${(0.05 + 0.4 * Math.pow(1 - Math.abs(f - 0.5) * 1.5, 2)) * (hot ? 1 : 0.6)})`; g.lineWidth = hot ? 1.3 : 0.8;
      g.beginPath();
      for (let x = -10; x <= W + 10; x += 10) { const u = x / W; const y = H2 * (0.1 + 0.8 * f) + Math.sin(u * 3.6 + f * 3 + t * 0.00018) * H2 * 0.08 + Math.sin(u * 8 - t * 0.0003) * H2 * 0.015; x < 0 ? g.moveTo(x, y) : g.lineTo(x, y); }
      g.stroke();
    }
    if (on && !calm) raf = requestAnimationFrame(draw);
  };
  new IntersectionObserver(es => { on = es[0].isIntersecting; cancelAnimationFrame(raf); if (on) raf = requestAnimationFrame(draw); }).observe(cv);
  draw(0);
}

// ---------- go ----------
intro();
chrome();
closeMenus(); wireSheet();
walletMenu($('#wBtn'), $('#wMenu'), { privateHref: '/desk#wallet' });
WS.reconnect();
reveal(); spotlight();
$$('[data-cipher]').forEach(el => cipher(el, +el.dataset.cipher));
veil($('#veil'));
chips(); pulse(); publicBook(); tape(); marketsTable(); fundingBoard(); mini(); calc(); scan(); deriveHome();
H.liveMids();
const loadAll = () => H.loadMarkets().catch(() => { $('#mkRows').innerHTML = '<div class="ph">Hyperliquid could not be read just now. Retrying…</div>'; });
loadAll(); setInterval(() => { if (!document.hidden) loadAll(); }, 30000);
const ring = () => ringLive($('#ringBox')).then(j => { if (j) countTo($('[data-s="ring"]'), j.hour, v => int(v)); });
ring(); setInterval(() => { if (!document.hidden) ring(); }, 60000);
vault(); checks(); setInterval(() => { if (!document.hidden) checks(); }, 45000);
endSilk();
