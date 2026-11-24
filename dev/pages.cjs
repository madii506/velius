// full-page review shots of every page: node dev/pages.cjs <outdir> [m]
const { chromium } = require('playwright');
const { route } = require('./hlmock.cjs');
const fs = require('fs');
(async () => {
  const [out = '/tmp/vp', mob = ''] = process.argv.slice(2);
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await b.newContext(mob ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' } : { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const report = {};
  for (const path of (process.env.PAGES || '/,/markets,/desk,/privacy,/vault,/docs,/status').split(',')) {
    const p = await ctx.newPage(); await route(p);
    const errs = []; p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
    await p.goto('http://localhost:8855' + path, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(3200);
    const name = path === '/' ? 'home' : path.slice(1).replace(/\W/g, '_');
    await p.screenshot({ path: `${out}/${name}${mob ? '-m' : ''}.jpg`, quality: 70, fullPage: true, timeout: 30000 });
    const over = await p.evaluate(() => { const vw = document.documentElement.clientWidth; return [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.right > vw + 1 || r.left < -1) && getComputedStyle(e).position !== 'fixed' && !e.closest('canvas,.intro,.sheet,.rail,.drawer,.tmap,.stats,.wl,.subnav,.mk-f,.tip,#toc,.mk-map'); }).slice(0, 6).map(e => e.tagName + '.' + e.className + ' ' + Math.round(e.getBoundingClientRect().left) + '..' + Math.round(e.getBoundingClientRect().right)); });
    report[name] = { errs, over, docW: await p.evaluate(() => document.documentElement.scrollWidth), h: await p.evaluate(() => document.documentElement.scrollHeight) };
    await p.close();
  }
  console.log(JSON.stringify(report, null, 1));
  await b.close();
})();
