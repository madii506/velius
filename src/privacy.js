// VELIUS privacy: the model, the live Ring hour by hour, the scan, your private wallet, the programs
import { $, $$, int, short, esc, getJSON } from './fmt.js';
import { countTo } from './fx.js';
import { boot } from './page.js';
import { silk } from './silk.js';
import { ringPanel, columns, scanBox, deriveBox } from './widgets.js';
import { WS, registered, vaultState } from './shared.js';

boot();
silk($('#silk'), { n: 26, amp: 0.06, alpha: 0.7, top: 0.38, span: 0.56 });

const cols = columns($('#ringCols'), { pos: '#8d79ff', fmt: v => int(v) + (v === 1 ? ' transaction' : ' transactions'), label: r => r.label, aria: 'Privacy Rings transactions, hour by hour, over the last day' });
async function ring() {
  const j = await ringPanel($('#ringBox'), cols);
  if (!j) return;
  countTo($('#kpis [data-r="hour"]'), j.hour, v => int(v));
  $('#kpis [data-r="day"]').textContent = int(j.day) + (j.capped ? '+' : '');
}
ring(); setInterval(() => { if (!document.hidden) ring(); }, 60000);

scanBox({ form: $('#scanF'), input: $('#scanQ'), mine: $('#scanMine'), out: $('#scanOut') });
deriveBox($('#dv'));

async function programs() {
  try {
    const j = await getJSON('/api/status', 12000);
    for (const k of ['ring', 'registry', 'tree']) {
      const a = j[k] || {}, e = $(`.pst[data-p="${k}"]`);
      e.textContent = a.ok ? (a.executable ? 'live · executable' : 'live') : 'not found'; e.className = 'pst ' + (a.ok ? 'up' : 'down');
    }
    const p = $('[data-k="prog"]'); p.textContent = j.ring && j.ring.ok ? 'Live' : 'Not found'; p.className = j.ring && j.ring.ok ? 'up' : 'down';
    $('[data-k="progs"]').textContent = 'mainnet · slot ' + int(j.slot);
  } catch (e) {
    $$('.pst').forEach(x => { x.textContent = 'could not be read just now'; });
    $('[data-k="prog"]').textContent = 'Offline';
  }
}
programs();

function you() {
  const st = WS.state(), b = $('[data-k="you"]'), s = $('[data-k="yous"]');
  if (!st.address) { b.textContent = 'not connected'; s.textContent = 'connect to check the registry'; return; }
  b.textContent = short(st.address); s.textContent = 'checking the registry…';
  registered(st.address).then(j => { s.textContent = j.registered ? 'on the Privacy Rings registry' : 'not on the registry yet'; }).catch(() => { s.textContent = 'the registry could not be read'; });
}
WS.onChange(you); you();
vaultState().then(v => { if (v.open && v.address) $('#vaultAddr').innerHTML = `<a href="https://solscan.io/account/${esc(v.address)}" target="_blank" rel="noopener">${esc(v.address)} ↗</a>`; });
