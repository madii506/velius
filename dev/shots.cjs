// node dev/shots.cjs <outdir> [desk|home|intro] [mobile]
const { chromium } = require('playwright');
const { route } = require('./hlmock.cjs');
const fs = require('fs');
(async () => {
  const [out = '/tmp/vshots', what = 'home', mob = ''] = process.argv.slice(2);
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext(mob ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: +(process.env.DSF || 1), isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: +(process.env.DSF || 1) });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  p.on('requestfailed', r => errs.push('failed: ' + r.url() + ' ' + (r.failure() || {}).errorText));
  await route(p);
  const base = 'http://localhost:8855';
  const tag = mob ? 'm' : 'd';
  console.log('nav start');
  if (what === 'intro') {
    await p.goto(base + '/?intro', { waitUntil: 'domcontentloaded' });
    for (const t of [500, 1150, 1700, 2400, 2900, 3700]) { await p.waitForTimeout(t - (p._t || 0)); p._t = t; await p.screenshot({ path: `${out}/intro-${tag}-${t}.jpg`, quality: 85 }); }
  } else if (what === 'home') {
    await p.addInitScript(() => { try { sessionStorage.setItem('velius:intro', '1'); } catch (e) {} });
    await p.goto(base + '/', { waitUntil: 'domcontentloaded' });
    await p.mouse.move(980, 420);
    await p.waitForTimeout(3500);
    await p.mouse.move(1010, 430);
    await p.waitForTimeout(600);
    console.log('hero shot'); await p.screenshot({ path: `${out}/home-${tag}-00-hero.jpg`, quality: 85, timeout: 20000 }); console.log('hero done');
    const ids = ['pulse', 'book', 'tape', 'how', 'order', 'markets', 'funding', 'desk', 'hidden', 'scan', 'derive', 'risk', 'ring', 'vault', 'hood', 'checks', 'faq', 'end'];
    let i = 1;
    for (const id of ids) {
      await p.evaluate(id => { const el = document.getElementById(id); window.scrollTo({ top: el.offsetTop - (id === 'end' ? 0 : 0), behavior: 'instant' }); }, id);
      if (id === 'scan') { await p.fill('#scanQ', 'ring1GaLCuJnkUMVkX2JeZLTTX17wKsV4fZmPVzXANW'); await p.click('#scanF button'); }
      await p.waitForTimeout(1100);
      await p.screenshot({ path: `${out}/home-${tag}-${String(i++).padStart(2, '0')}-${id}.jpg`, quality: 82 });
    }
    // overflow check: any element wider than the viewport
    const over = await p.evaluate(() => { const vw = document.documentElement.clientWidth; return [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.right > vw + 1 || r.left < -1) && getComputedStyle(e).position !== 'fixed' && !e.closest('canvas,.intro,.sheet,.rail'); }).slice(0, 8).map(e => e.tagName + '.' + e.className + ' ' + Math.round(e.getBoundingClientRect().right)); });
    errs.push('overflow: ' + JSON.stringify(over));
  } else if (what === 'desk') {
    await p.goto(base + '/desk', { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(4000);
    await p.mouse.move(500, 380);
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${out}/desk-${tag}-00.jpg`, quality: 85 });
    if (mob) { for (let k = 1; k <= 4; k++) { await p.evaluate(k => window.scrollTo(0, innerHeight * 0.9 * k), k); await p.waitForTimeout(700); await p.screenshot({ path: `${out}/desk-${tag}-0${k}.jpg`, quality: 82 }); } }
  }
  fs.writeFileSync(`${out}/errors-${what}-${tag}.json`, JSON.stringify(errs, null, 1));
  console.log(what, tag, 'errors', errs.length, errs.slice(0, 6));
  await b.close();
})();
