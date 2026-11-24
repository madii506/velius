// Live panels used on more than one page: a column chart with a hover readout, the Ring, the scan,
// the private-wallet box and the live checks.
import { $, esc, int, ago, short, usd, big, getJSON, fund } from './fmt.js';
import { countTo } from './fx.js';
import * as H from './hl.js';
import { WS, derive, remembered, registered } from './shared.js';

// ---------- columns: thin bars from one baseline, rounded at the data end, a readout on hover and focus ----------
export function columns(box, { pos = '#8d79ff', neg = '#ff4d6a', fmt = v => String(v), label = r => r.label || '', aria = '' } = {}) {
  const cv = box.querySelector('canvas'), tip = box.querySelector('.tip');
  const g = cv.getContext('2d');
  let rows = [], hot = -1, geo = null;
  cv.tabIndex = 0; cv.setAttribute('role', 'img'); if (aria) cv.setAttribute('aria-label', aria);
  const draw = () => {
    const r = cv.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2);
    const W = r.width, Hh = r.height; if (W < 4 || Hh < 4) return;
    cv.width = W * d; cv.height = Hh * d; g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, W, Hh);
    if (!rows.length) return;
    const vals = rows.map(x => x.v).filter(v => v != null && isFinite(v));
    const up = Math.max(0, ...vals), dn = Math.max(0, ...vals.map(v => -v)), tot = (up + dn) || 1;
    const pad = 4, hh = Hh - pad * 2, zero = pad + hh * (up / tot);
    const slot = W / rows.length, gap = Math.min(2, slot * 0.4), bw = Math.min(24, Math.max(1, slot - gap));
    geo = { slot, W, Hh };
    g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(0, Math.round(zero), W, 1);
    rows.forEach((x, i) => {
      const cx = i * slot + (slot - bw) / 2;
      if (x.v == null || !isFinite(x.v)) { g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(cx, zero - 1, bw, 2); return; }
      const h = Math.max(1, Math.abs(x.v) / tot * hh), rad = Math.min(4, bw / 2, h);
      g.fillStyle = x.v >= 0 ? pos : neg; g.globalAlpha = hot < 0 || hot === i ? 1 : 0.55;
      g.beginPath();
      if (x.v >= 0) { const y = zero - h; g.moveTo(cx, zero); g.lineTo(cx, y + rad); g.quadraticCurveTo(cx, y, cx + rad, y); g.lineTo(cx + bw - rad, y); g.quadraticCurveTo(cx + bw, y, cx + bw, y + rad); g.lineTo(cx + bw, zero); }
      else { const y = zero + h; g.moveTo(cx, zero + 1); g.lineTo(cx, y - rad); g.quadraticCurveTo(cx, y, cx + rad, y); g.lineTo(cx + bw - rad, y); g.quadraticCurveTo(cx + bw, y, cx + bw, y - rad); g.lineTo(cx + bw, zero + 1); }
      g.closePath(); g.fill(); g.globalAlpha = 1;
    });
  };
  const show = (i, x, y) => {
    if (!tip || i < 0 || i >= rows.length) return;
    const r = rows[i];
    tip.innerHTML = `<b>${r.v == null ? '—' : esc(fmt(r.v))}</b>${esc(label(r))}`;
    tip.style.left = Math.min(geo.W - 70, Math.max(70, x)) + 'px'; tip.style.top = Math.max(30, y) + 'px';
    tip.classList.add('on');
  };
  const hide = () => { hot = -1; tip && tip.classList.remove('on'); draw(); };
  cv.addEventListener('pointermove', e => {
    if (!geo) return; const b = cv.getBoundingClientRect(), x = e.clientX - b.left;
    const i = Math.max(0, Math.min(rows.length - 1, Math.floor(x / geo.slot)));
    if (i !== hot) { hot = i; draw(); }
    show(i, x, e.clientY - b.top);
  });
  cv.addEventListener('pointerleave', hide);
  cv.addEventListener('blur', hide);
  cv.addEventListener('keydown', e => {
    if (!rows.length || !/Arrow(Left|Right)/.test(e.key)) return;
    e.preventDefault(); hot = hot < 0 ? rows.length - 1 : Math.max(0, Math.min(rows.length - 1, hot + (e.key === 'ArrowRight' ? 1 : -1)));
    draw(); show(hot, (hot + 0.5) * geo.slot, 40);
  });
  new ResizeObserver(draw).observe(cv);
  return { set(r) { rows = r; draw(); }, get rows() { return rows; } };
}

// ---------- funding history for one market: seven days, hour by hour ----------
export async function fundingHistory(coin, days = 7) {
  const rows = await H.info({ type: 'fundingHistory', coin, startTime: Date.now() - days * 86400e3 });
  return rows.map(x => ({ t: x.time, v: +x.fundingRate, label: new Date(x.time).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }) }));
}

// ---------- the Ring: counts, the latest signatures, and its activity hour by hour ----------
export async function ringPanel(el, chart) {
  try {
    const j = await getJSON('/api/ring', 12000);
    const q = k => el.querySelector(`[data-r="${k}"]`);
    q('hour') && countTo(q('hour'), j.hour, v => int(v));
    q('day') && (q('day').textContent = int(j.day) + (j.capped ? '+' : ''));
    q('list') && (q('list').innerHTML = (j.last || []).map(s => `<a class="sig mono" href="https://solscan.io/tx/${esc(s.sig)}" target="_blank" rel="noopener"><span>${esc(s.sig.slice(0, 10))}…${esc(s.sig.slice(-6))}</span><em>${s.t ? ago(s.t * 1000) + ' ago' : ''}</em></a>`).join('') || '<div class="ph">No transactions read yet.</div>');
    if (chart && Array.isArray(j.perHour)) {
      const now = Date.now();
      chart.set(j.perHour.map((v, i) => { const a = 23 - i, t = new Date(now - (a + 1) * 3600e3), hm = d => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }); return { v, label: `${a === 0 ? 'the last 60 minutes' : a + ' to ' + (a + 1) + ' hours ago'} · ${hm(t)}–${hm(new Date(t.getTime() + 3600e3))}${v == null ? ' · not covered by the read' : ''}` }; }));
    }
    el.classList.remove('off');
    return j;
  } catch (e) {
    el.classList.add('off');
    const l = el.querySelector('[data-r="list"]'); if (l) l.innerHTML = '<div class="ph">The Ring could not be read just now. It retries in a minute.</div>';
    return null;
  }
}

// ---------- scan: what the chain already knows about an address ----------
export function scanBox({ form, input, mine, out }) {
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
  form.addEventListener('submit', e => { e.preventDefault(); run(input.value); });
  mine && mine.addEventListener('click', e => {
    e.stopPropagation();
    const a = WS.state().address;
    if (!a) { $('#wBtn').click(); return; }
    input.value = a; run(a);
  });
  return run;
}

// ---------- your private wallet, derived in this tab ----------
export function deriveBox(root) {
  const q = k => root.querySelector(`[data-d="${k}"]`);
  const btn = q('btn'), msg = q('msg');
  const ui = () => {
    const st = WS.state(), addr = st.address ? remembered() : null;
    q('s1').classList.toggle('done', !!st.address);
    q('who').textContent = st.address ? short(st.address) + ' · ' + st.wallet.name : 'Phantom, Solflare or Backpack';
    q('s2').classList.toggle('done', !!addr); q('s3').classList.toggle('done', !!addr);
    q('addr').textContent = addr ? addr : 'appears here';
    btn.textContent = !st.address ? 'Connect a wallet' : addr ? 'Derive again' : 'Derive my private wallet';
    btn.dataset.do = st.address ? 'derive' : 'connect';
    if (st.address) registered(st.address).then(j => { q('reg').textContent = j.registered ? 'yes, registered' : 'not yet'; q('s4').classList.toggle('done', !!j.registered); }).catch(() => { q('reg').textContent = 'could not read'; });
    else { q('reg').textContent = '—'; q('s4').classList.remove('done'); }
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

// ---------- live checks, each timed from this page ----------
export async function timed(f) { const t0 = performance.now(); try { const v = await f(); return { ok: true, ms: Math.round(performance.now() - t0), v }; } catch (e) { return { ok: false, ms: Math.round(performance.now() - t0), err: String(e.message || e) }; } }
export const checkHL = () => timed(() => H.info({ type: 'allMids' }));
export const checkStatus = () => timed(() => getJSON('/api/status', 12000));
export { fund };
