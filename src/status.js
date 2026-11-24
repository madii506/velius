// VELIUS status: every source, checked from this browser, with round-trip times
import { $, $$, int, getJSON } from './fmt.js';
import { countTo } from './fx.js';
import * as H from './hl.js';
import { boot } from './page.js';
import { silk } from './silk.js';
import { timed } from './widgets.js';

boot();
silk($('#silk'), { n: 26, amp: 0.06, alpha: 0.7, top: 0.38, span: 0.56 });

const R = {};
function setCheck(k, txt, c, small) {
  const el = $(`[data-k="${k}"]`); if (!el) return;
  const v = el.querySelector('.v'); v.textContent = txt; v.className = 'v mono ' + (c || '');
  if (small != null) el.querySelector('small').textContent = small;
  R[k] = c;
  summary();
}
function summary() {
  const vals = Object.entries(R).filter(([k]) => k !== 'vault');
  const bad = vals.filter(([, c]) => c === 'bad').length, wait = vals.filter(([, c]) => c === 'wait').length;
  const box = $('#sumLine');
  box.className = 'sum-line ' + (bad ? 'bad' : wait ? 'warn' : vals.length >= 7 ? 'ok' : '');
  $('#sumT').textContent = bad ? `${bad} source${bad > 1 ? 's' : ''} not answering` : wait ? 'Connecting…' : vals.length >= 7 ? 'Everything is answering' : 'Checking…';
  $('#sumS').textContent = vals.length ? `${vals.length - bad - wait} of ${vals.length} answering` : '';
}
async function routes() {
  await Promise.all($$('#rt [data-r]').map(async row => {
    const t0 = performance.now();
    try {
      const r = await fetch(row.dataset.r, { cache: 'no-store' }); const ms = Math.round(performance.now() - t0);
      const a = row.querySelector('.a'); a.textContent = r.status + (r.ok ? ' ok' : ''); a.className = 'a mono ' + (r.ok ? 'ok' : 'bad');
      row.querySelector('.t').textContent = ms + ' ms';
    } catch (e) { const a = row.querySelector('.a'); a.textContent = 'no answer'; a.className = 'a mono bad'; row.querySelector('.t').textContent = '—'; }
  }));
}
async function run() {
  $('#again').disabled = true;
  const hl = await timed(() => H.info({ type: 'allMids' }));
  setCheck('hl', hl.ok ? hl.ms + ' ms' : 'unreachable', hl.ok ? 'ok' : 'bad', hl.ok ? 'info, round trip from this page' : 'retrying');
  H.loadMarkets().then(m => { setCheck('mk', int(m.list.length), 'ok', 'on Hyperliquid, read just now'); }).catch(() => setCheck('mk', 'unread', 'bad', 'Hyperliquid did not answer'));
  try {
    const j = await getJSON('/api/status', 12000);
    const s = $('[data-k="slot"] .v'); s.className = 'v mono ok'; countTo(s, j.slot, n => int(n), 1200); R.slot = 'ok';
    for (const k of ['ring', 'registry', 'tree']) { const a = j[k] || {}; setCheck(k, a.ok ? 'live' : 'not found', a.ok ? 'ok' : 'bad', a.address ? a.address.slice(0, 6) + '…' + a.address.slice(-4) : ''); }
  } catch (e) { for (const k of ['slot', 'ring', 'registry', 'tree']) setCheck(k, 'offline', 'bad', 'retrying'); }
  try { const j = await getJSON('/api/ring', 25000); setCheck('ringtx', int(j.hour), 'ok', 'transactions, last hour'); } catch (e) { setCheck('ringtx', 'unread', 'bad', 'the Ring could not be read'); }
  try { const v = await getJSON('/api/vault', 9000); setCheck('vault', v.open ? 'open' : 'closed', v.open ? 'ok' : 'wait', v.open ? 'taking deposits' : 'opens once funded and tested live'); } catch (e) { setCheck('vault', 'unread', 'bad', ''); }
  await routes();
  $('#lastAt').textContent = new Date().toLocaleTimeString([], { hour12: false });
  $('#again').disabled = false;
}
H.on('live', s => setCheck('ws', s === 'live' ? 'streaming' : s === 'connecting' ? 'connecting' : 'reconnecting', s === 'live' ? 'ok' : 'wait'));
H.liveMids();
$('#again').addEventListener('click', run);
run(); setInterval(() => { if (!document.hidden) run(); }, 45000);
