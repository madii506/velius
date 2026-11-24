// viewport shots at given scroll anchors: PAGES="/privacy#model,/vault#how" node dev/vshots.cjs <outdir> [m]
const { chromium } = require('playwright');
const { route } = require('./hlmock.cjs');
const fs = require('fs');
(async () => {
  const [out = '/tmp/vs', mob = ''] = process.argv.slice(2);
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await b.newContext(mob ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce', deviceScaleFactor: +(process.env.DSF || 1) } : { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', deviceScaleFactor: +(process.env.DSF || 1) });
  await ctx.addInitScript(() => { try { sessionStorage.setItem('velius:intro', '1'); } catch (e) {} });
  const errs = [];
  let i = 0;
  for (const spec of (process.env.PAGES || '/').split(',')) {
    const [path, anchor] = spec.split('#');
    const p = await ctx.newPage(); await route(p);
    p.on('pageerror', e => errs.push(path + ' pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(path + ' console: ' + m.text()); });
    await p.goto('http://localhost:8855' + path, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(2600);
    if (anchor) { await p.evaluate(a => { const el = document.getElementById(a); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - (a === 'top' ? 0 : 0), behavior: 'instant' }); }, anchor); await p.waitForTimeout(900); }
    if (process.env.ACT && i === 0) { await p.evaluate(process.env.ACT); await p.waitForTimeout(1500); }
    const name = `${String(i++).padStart(2, '0')}-${(path === '/' ? 'home' : path.slice(1).replace(/\W/g, '_'))}${anchor ? '-' + anchor : ''}${mob ? '-m' : ''}.jpg`;
    await p.screenshot({ path: `${out}/${name}`, quality: 82, timeout: 30000 });
    await p.close();
  }
  console.log('errors', errs.length, errs.slice(0, 6));
  await b.close();
})();
