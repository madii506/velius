// VELIUS docs: the contents follow your scroll, search narrows the docs and the glossary,
// and the worked example runs on Hyperliquid's live mark
import { $, $$, esc, px, pct, usd, fund, apr, int, cls } from './fmt.js';
import * as H from './hl.js';
import { boot, spy } from './page.js';
import { vaultState } from './shared.js';

boot();
spy($$('#toc a'), $('#toc'));

// ---------- keyboard list, the same one the desk shows ----------
const KEYS = [['/', 'Find a market'], ['Ctrl K', 'Find a market'], ['B', 'Long'], ['S', 'Short'], ['M', 'Market order'], ['L', 'Limit order'], ['T', 'Stop order'], ['1 – 6', 'Timeframe, 1m to 1D'], ['G', 'Group the book'], ['E', 'Moving averages on or off'], ['W', 'Star this market'], ['[  ]', 'Previous or next starred market'], ['F', 'Type a size'], ['R', 'Size by USD or by risk'], ['?', 'The list of keys'], ['Esc', 'Close']];
$('#keysd').innerHTML = KEYS.map(([k, v]) => `<div><span>${k.split(' ').filter(Boolean).map(x => x === '–' ? '–' : `<kbd>${esc(x)}</kbd>`).join(' ')}</span><em>${esc(v)}</em></div>`).join('');

// ---------- search ----------
const secs = $$('.doc section');
const index = secs.map(s => ({ s, id: s.id, t: (s.dataset.t + ' ' + s.textContent).toLowerCase() }));
const gl = $$('#gl dt').map(dt => ({ dt, dd: dt.nextElementSibling, t: (dt.textContent + ' ' + dt.nextElementSibling.textContent).toLowerCase() }));
function search(q) {
  q = q.trim().toLowerCase();
  let first = null, any = false;
  for (const { s, id, t } of index) {
    const hit = !q || q.split(/\s+/).every(w => t.includes(w));
    s.classList.toggle('miss', !!q && !hit);
    const a = $(`#toc a[href="#${id}"]`); if (a) a.classList.toggle('dim', !!q && !hit);
    if (hit && q) { any = true; first = first || s; }
  }
  for (const g of gl) { const hit = !q || q.split(/\s+/).every(w => g.t.includes(w)); g.dt.classList.toggle('hide', !hit); g.dd.classList.toggle('hide', !hit); }
  $('#dnone').hidden = !q || any;
  return first;
}
$('#dq').addEventListener('input', e => search(e.target.value));
$('#dq').addEventListener('keydown', e => { if (e.key === 'Enter') { const f = search(e.target.value); if (f) f.scrollIntoView({ behavior: 'smooth', block: 'start' }); } if (e.key === 'Escape') { e.target.value = ''; search(''); } });
addEventListener('keydown', e => { if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); $('#dq').focus(); } });

// ---------- the worked example, on the live mark ----------
const EX = { c: 'BTC', s: 1, L: 10, size: 10000 };
const segs = (id, key, conv) => $(id).addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $$(id + ' button').forEach(x => x.classList.toggle('on', x === b)); EX[key] = conv(b.dataset[Object.keys(b.dataset)[0]]); run(); });
segs('#exMk', 'c', String); segs('#exSide', 's', Number); segs('#exLev', 'L', Number);
function run() {
  const m = H.markets.by[EX.c]; if (!m) return;
  const E = H.mids[m.name] || m.mark, L = Math.min(EX.L, m.maxLev), mm = 1 / (2 * m.maxLev);
  const liq = EX.s > 0 ? E * (1 - 1 / L) / (1 - mm) : E * (1 + 1 / L) / (1 + mm);
  const q = EX.size / E, fee = EX.size * 0.00045 * 2, fu = q * (m.oracle || E) * m.funding * EX.s;
  $('#exNote').textContent = `${EX.c} · ${EX.s > 0 ? 'long' : 'short'} · $10,000 at ${L}x${L < EX.L ? ' (the market allows ' + m.maxLev + 'x)' : ''}`;
  $('#exE').textContent = px(E);
  $('#exQ').textContent = q.toLocaleString('en-US', { maximumFractionDigits: Math.max(2, m.szDec) });
  $('#exM').textContent = usd(EX.size / L);
  $('#exL').textContent = px(liq);
  const mv = (liq / E - 1) * 100, mvEl = $('#exMv'); mvEl.textContent = pct(mv); mvEl.className = mv < 0 ? 'down' : 'up';
  $('#exF').textContent = usd(fee);
  const fuEl = $('#exFu'); fuEl.textContent = (fu > 0 ? 'you pay ' : fu < 0 ? 'you get ' : '') + usd(Math.abs(fu), 4); fuEl.className = fu > 0 ? 'down' : fu < 0 ? 'up' : '';
  $('#exMm').textContent = (mm * 100).toFixed(3) + '%';
  const sgn = EX.s > 0 ? '−' : '+';
  $('#exFx').innerHTML = `m = 1 ÷ (2 × ${m.maxLev}) = ${mm.toFixed(5)}<br>liquidation = ${esc(px(E))} × (1 ${sgn} 1/${L}) ÷ (1 ${sgn} ${mm.toFixed(5)}) = <b>${esc(px(liq))}</b><br>funding this hour = ${esc(q.toPrecision(5))} × ${esc(px(m.oracle || E))} × ${esc(fund(m.funding))} = ${esc(usd(Math.abs(fu), 4))}`;
}
function fundingNow() {
  const b = H.markets.by.BTC; if (!b) return;
  $('#fNow').innerHTML = `Right now: BTC pays <b class="${cls(b.funding)}">${fund(b.funding)}</b> an hour, ${apr(b.funding)} a year at that pace. ${b.funding >= 0 ? 'Longs pay shorts.' : 'Shorts pay longs.'}`;
}
async function load() {
  try { await H.loadMarkets(); } catch (e) { $('#exNote').textContent = 'Hyperliquid could not be read just now. Retrying…'; $('#fNow').textContent = 'Funding could not be read just now.'; setTimeout(load, 5000); return; }
  $('#fMk').textContent = int(H.markets.list.length) + ' Hyperliquid perps';
  run(); fundingNow();
}
H.liveMids();
let last = 0; H.on('mids', () => { if (Date.now() - last > 1000) { last = Date.now(); run(); } });
load(); setInterval(() => { if (!document.hidden) H.loadMarkets().then(fundingNow).catch(() => {}); }, 60000);
vaultState().then(v => { $('#fVault').textContent = v.open ? 'open' : 'open with the vault'; });
