// VELIUS vault: its live state, the markets it can mirror, and the roadmap
import { $, int } from './fmt.js';
import { countTo } from './fx.js';
import * as H from './hl.js';
import { boot } from './page.js';
import { silk } from './silk.js';
import { vaultState } from './shared.js';

boot();
silk($('#silk'), { n: 26, amp: 0.06, alpha: 0.7, top: 0.38, span: 0.56 });

vaultState().then(v => {
  const s = $('[data-k="state"]'), w = $('[data-k="why"]');
  s.textContent = v.open ? 'Open' : 'Closed'; s.className = 'mono ' + (v.open ? 'up' : '');
  s.style.color = v.open ? '' : 'var(--warn)';
  w.textContent = v.open ? 'taking deposits' : 'opens once funded and tested live';
  if (v.maxLeverage) $('[data-k="lev"]').textContent = 'up to ' + v.maxLeverage + 'x';
  if (v.open) {
    $('#vaultWord').textContent = 'is open.';
    $('#vaultLede').textContent = 'The vault is funded, has passed its live test on mainnet, and is taking deposits.';
    for (const k of ['engine', 'test', 'open']) { const li = $(`#roll [data-r="${k}"]`); li.classList.add('ok'); li.querySelector('span').textContent = 'Done'; }
    $('#hlAcct').textContent = 'live'; $('#hlAcct').className = 'v mono ok';
    if (v.address) $('#hlAcctS').textContent = 'vault ' + v.address.slice(0, 6) + '…' + v.address.slice(-4);
  } else {
    const li = $('#roll [data-r="engine"]'); li.classList.add('now');
  }
});

H.loadMarkets().then(m => countTo($('[data-k="mk"]'), m.list.length, v => int(v) + ' perps')).catch(() => { $('[data-k="mk"]').textContent = '—'; });
