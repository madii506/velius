// Pieces both pages use: the wallet menu, the private wallet, the menu sheet, the vault state, the live Ring.
import * as WS from './wallet.js';
import { $, $$, esc, short, getJSON, store, int, ago } from './fmt.js';

export { WS };

// ---------- the wallet menu: detected wallets first, then install or open-in-app links ----------
export function walletMenu(btn, menu, opts = {}) {
  const render = () => {
    const st = WS.state(), inst = WS.list();
    if (st.address) {
      menu.innerHTML = `<div class="wm-h">Connected · ${esc(st.wallet.name)}</div><div class="wm-a mono">${st.address}</div>
        <button data-a="copy"><span class="ic">⧉</span><span>Copy address</span></button>
        ${opts.privateHref ? `<a href="${opts.privateHref}"><span class="ic">◐</span><span>Your private wallet</span></a>` : ''}
        <button data-a="off"><span class="ic">×</span><span>Disconnect</span></button>`;
    } else {
      const names = new Set(inst.map(w => w.name));
      const rows = inst.map(w => `<button data-w="${esc(w.name)}"><span class="ic">${w.icon ? `<img src="${w.icon}" alt="">` : esc(w.name[0])}</span><span>${esc(w.name)}</span><em>detected</em></button>`);
      for (const k of WS.KNOWN) if (!names.has(k.name)) {
        const deep = /Android|iPhone|iPad/i.test(navigator.userAgent) && k.deep;
        rows.push(`<a href="${deep ? k.deep(location.href) : k.url}" target="_blank" rel="noopener"><span class="ic">${k.name[0]}</span><span>${k.name}</span><em>${deep ? 'open in app' : 'install'}</em></a>`);
      }
      menu.innerHTML = `<div class="wm-h">Connect a Solana wallet</div>${rows.join('')}`;
    }
    btn.classList.toggle('on', !!st.address);
    btn.querySelector('span').textContent = st.address ? short(st.address) : (opts.label || 'Connect');
  };
  btn.addEventListener('click', e => { e.stopPropagation(); render(); $$('.wmenu.open').forEach(m => m !== menu && m.classList.remove('open')); menu.classList.toggle('open'); });
  menu.addEventListener('click', async e => {
    e.stopPropagation();
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.w) {
      b.querySelector('em').textContent = 'connecting…';
      try { await WS.connect(b.dataset.w); menu.classList.remove('open'); }
      catch (err) { b.querySelector('em').textContent = String(err.message || err).slice(0, 36); return; }
    }
    if (b.dataset.a === 'copy') { try { await navigator.clipboard.writeText(WS.state().address); b.lastElementChild.textContent = 'Copied'; } catch (e2) {} return; }
    if (b.dataset.a === 'off') { await WS.disconnect(); menu.classList.remove('open'); }
    render();
  });
  WS.onChange(render); render();
  return render;
}
let wired = false;
export function closeMenus() {
  if (wired) return; wired = true;
  document.addEventListener('click', () => $$('.wmenu.open').forEach(m => m.classList.remove('open')));
  addEventListener('keydown', e => { if (e.key === 'Escape') { $$('.wmenu.open').forEach(m => m.classList.remove('open')); sheet(false); } });
}

// ---------- the small-screen menu ----------
export function sheet(open) {
  const s = $('#sheet'), b = $('#menuBtn'); if (!s || !b) return;
  const on = open ?? !s.classList.contains('open');
  s.classList.toggle('open', on); b.setAttribute('aria-expanded', on); document.body.classList.toggle('lock', on);
}
export function wireSheet() {
  const b = $('#menuBtn'); if (!b) return;
  b.addEventListener('click', e => { e.stopPropagation(); sheet(); });
  $$('#sheet a').forEach(a => a.addEventListener('click', () => sheet(false)));
}

// ---------- the private wallet: one signature derives it, in this tab, with the Privacy Rings SDK ----------
let rings = null;
const RINGS_URL = '/assets/js/rings.js?v=1';          // a variable, so the bundler leaves this 4.5 MB chunk out until it is needed
const loadRings = () => rings || (rings = import(RINGS_URL));
export const priv = { address: null, owner: null };
export async function derive() {
  const st = WS.state(); if (!st.address) throw new Error('Connect a wallet first');
  const R = await loadRings();
  const msg = R.derivationMessage(st.address);
  const sig = await WS.signMessage(msg);
  const addr = await R.derivePrivateWallet(st.address, sig);
  sig.fill && sig.fill(0);
  priv.address = addr; priv.owner = st.address;
  store.set('velius:priv', { owner: st.address, address: addr });      // the address only; the keys are never kept
  return addr;
}
export function remembered() {
  const st = WS.state(), r = store.get('velius:priv', null);
  if (r && st.address && r.owner === st.address) { priv.address = r.address; priv.owner = r.owner; return r.address; }
  return null;
}
export const registered = addr => getJSON('/api/registered?addr=' + encodeURIComponent(addr), 12000);

// ---------- the vault and the Ring, as read from our own routes ----------
export const vaultState = () => getJSON('/api/vault').catch(() => ({ open: false, reason: 'The vault could not be read just now.' }));
export async function ringLive(el) {
  try {
    const j = await getJSON('/api/ring', 12000);
    el.querySelector('[data-r="hour"]').textContent = int(j.hour);
    el.querySelector('[data-r="day"]').textContent = (j.capped ? '1,000+' : int(j.day));
    el.querySelector('[data-r="list"]').innerHTML = (j.last || []).map(s => `<a class="sig mono" href="https://solscan.io/tx/${s.sig}" target="_blank" rel="noopener"><span>${s.sig.slice(0, 10)}…${s.sig.slice(-6)}</span><em>${s.t ? ago(s.t * 1000) + ' ago' : ''}</em></a>`).join('') || '<div class="ph">No transactions read yet.</div>';
    el.classList.remove('off');
    return j;
  } catch (e) {
    el.classList.add('off');
    el.querySelector('[data-r="list"]').innerHTML = '<div class="ph">The Ring could not be read just now. It retries in a minute.</div>';
  }
}

export const HELIUS_RING = `<i class="hring" aria-hidden="true"></i>`;
