// quick look at one page: node dev/peek.cjs <path> <out.jpg> [mobile] [action]
const { chromium } = require('playwright');
const { route } = require('./hlmock.cjs');
(async () => {
  const [path = '/', out = '/tmp/peek.jpg', mob = '', act = ''] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await b.newContext(mob === 'm' ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage(); await route(p);
  const errs = []; p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.addInitScript(() => { try { sessionStorage.setItem('velius:intro', '1'); } catch (e) {} });
  await p.goto('http://localhost:8855' + path, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2500);
  if (act) { await p.evaluate(act); await p.waitForTimeout(1800); }
  await p.screenshot({ path: out, quality: 80, fullPage: process.env.FULL === '1' });
  const over = await p.evaluate(() => { const vw = document.documentElement.clientWidth; return [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.right > vw + 1 || r.left < -1) && getComputedStyle(e).position !== 'fixed' && !e.closest('canvas,.intro,.sheet,.rail,.drawer,.tmap,.stats,.wl,.subnav,.mk-f'); }).slice(0, 8).map(e => e.tagName + '.' + e.className + ' ' + Math.round(e.getBoundingClientRect().right)); });
  console.log(JSON.stringify({ errs, over, docW: await p.evaluate(() => document.documentElement.scrollWidth) }));
  await b.close();
})();
