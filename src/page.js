// What every page shares: the bar, the progress line, the wallet menu, the small-screen sheet,
// reveal-on-scroll, card spotlights, the flickering brand word and the sticky in-page tabs.
import { $, $$ } from './fmt.js';
import { reveal, spotlight, flicker } from './fx.js';
import { walletMenu, closeMenus, wireSheet, WS } from './shared.js';

export function chrome({ rail = null, hero = null } = {}) {
  const top = $('#top'), bar = $('#progress');
  const onScroll = () => {
    const y = scrollY, max = document.documentElement.scrollHeight - innerHeight;
    top && top.classList.toggle('scrolled', y > 8);
    if (bar) bar.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
    if (rail && hero) rail.classList.toggle('show', y > hero.offsetHeight * 0.7);
  };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
}

// marks the link whose section is in the middle of the screen; keeps the active tab in view on small screens
export function spy(links, box) {
  if (!('IntersectionObserver' in window) || !links.length) return;
  const map = new Map(links.map(a => [a.getAttribute('href').slice(1), a]));
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const a = map.get(e.target.id); if (!a) return;
    links.forEach(x => x.classList.toggle('on', x === a));
    if (box && box.scrollWidth > box.clientWidth) {
      const l = a.offsetLeft - box.clientWidth / 2 + a.offsetWidth / 2;
      box.scrollTo({ left: Math.max(0, l), behavior: 'smooth' });
    }
  }), { rootMargin: '-42% 0px -52% 0px' });
  for (const id of map.keys()) { const s = document.getElementById(id); if (s) io.observe(s); }
}

export function boot({ flick = true, rail = null, hero = null } = {}) {
  chrome({ rail, hero });
  closeMenus(); wireSheet();
  walletMenu($('#wBtn'), $('#wMenu'), { privateHref: '/privacy#wallet' });
  WS.reconnect();
  reveal(); spotlight();
  if (flick && $('#brandWord')) flicker($('#brandWord'));
  const sub = $('.subnav');
  if (sub) { document.documentElement.classList.add('has-sub'); spy($$('.subnav a'), $('.subnav .wrap')); }
}
