const { chromium } = require('playwright');
const { route } = require('./hlmock.cjs');
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage(); await route(p);
  await p.goto('http://localhost:8855' + (process.argv[2] || '/desk'), { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500);
  console.log(await p.evaluate(() => { const vw = document.documentElement.clientWidth; return [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.right > vw + 1 || r.left < -1); }).slice(0, 12).map(e => { const path = []; let x = e; for (let i = 0; i < 4 && x; i++) { path.push(x.tagName + (x.id ? '#' + x.id : '') + (x.className && typeof x.className === 'string' ? '.' + x.className.split(' ').join('.') : '')); x = x.parentElement; } return path.join(' < ') + ' ' + Math.round(e.getBoundingClientRect().right); }); }));
  await b.close();
})();
