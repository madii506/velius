// every control does something, and nothing throws
const { chromium } = require('playwright');
const { route } = require('./hlmock.cjs');
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const p = await ctx.newPage(); await route(p);
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const res = [];
  const ok = (name, v) => res.push((v ? 'ok   ' : 'FAIL ') + name);
  await p.goto('http://localhost:8855/', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500);
  ok('intro gone (reduced motion)', await p.$eval('#intro', e => e.classList.contains('gone')));
  ok('title VELIUS', (await p.title()) === 'VELIUS');
  await p.click('#wBtn'); ok('wallet menu opens', await p.$eval('#wMenu', e => e.classList.contains('open'))); await p.keyboard.press('Escape');
  for (const id of ['ETH', 'SOL', 'HYPE', 'BTC']) { await p.click(`#pubPick [data-c="${id}"]`); await p.waitForTimeout(250); ok('book ' + id, (await p.textContent('#pubCoin')) === id && (await p.$$('#pubBook .ob-r.a')).length > 3); }
  ok('markets rows', (await p.$$('#mkRows .mkr')).length >= 10);
  ok('chips', (await p.$$('#chips .mchip')).length === 4);
  await p.selectOption('#cMk', 'ETH'); await p.click('#cSide [data-s="short"]'); await p.fill('#cLev', '5'); await p.dispatchEvent('#cLev', 'input');
  ok('calc short 5x', (await p.textContent('#cLevV')) === '5x' && (await p.textContent('#cMove')).startsWith('+'));
  const det = await p.$$('#faq details'); await det[0].click(); ok('faq opens', await det[0].evaluate(e => e.open));
  for (const a of await p.$$('.nav a')) { const h = await a.getAttribute('href'); await a.click(); await p.waitForTimeout(150); ok('nav ' + h, !!(await p.$(h))); }
  ok('ring list', (await p.$$('#ringBox .sig')).length === 6);
  ok('no line under the name', !(await p.$('.hero .line')) && !(await p.$('.hero .sub')));
  ok('name font is Wide', (await p.$eval('#name', e => getComputedStyle(e).fontFamily)).includes('Wide'));
  ok('pulse numbers', /\$/.test(await p.textContent('[data-s="vol"]')) && /\d/.test(await p.textContent('[data-s="n"]')));
  await p.waitForTimeout(2500);
  ok('tape prints', (await p.$$('#tapeRows .tp-r')).length > 3 && /\d/.test(await p.textContent('#tpN')));
  ok('funding board', (await p.$$('#fundPos .fr')).length > 0);
  await p.fill('#scanQ', 'not an address'); await p.click('#scanF button'); ok('scan rejects junk', (await p.textContent('#scanOut')).includes('not a Solana address'));
  await p.fill('#scanQ', 'ring1GaLCuJnkUMVkX2JeZLTTX17wKsV4fZmPVzXANW'); await p.click('#scanF button'); await p.waitForTimeout(700); ok('scan result', (await p.$$('#scanOut .kv div')).length === 6);
  await p.click('#scanMine'); ok('scan mine asks to connect', await p.$eval('#wMenu', e => e.classList.contains('open'))); await p.keyboard.press('Escape');
  await p.click('#dvBtn'); ok('derive asks to connect (home)', await p.$eval('#wMenu', e => e.classList.contains('open'))); await p.keyboard.press('Escape');
  ok('rail has 17', (await p.$$('#rail a')).length === 17);
  ok('checks slot', /\d/.test(await p.textContent('[data-k="slot"] .v')));
  // desk
  await p.goto('http://localhost:8855/desk', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2000);
  ok('desk title', (await p.title()) === 'VELIUS');
  for (const tf of ['1m', '5m', '1h', '4h', '1d', '15m']) { await p.click(`#tfs [data-tf="${tf}"]`); await p.waitForTimeout(250); ok('tf ' + tf, await p.$eval(`#tfs [data-tf="${tf}"]`, e => e.classList.contains('on'))); }
  await p.click('#bookTabs [data-t="trades"]'); await p.waitForTimeout(300); ok('trades tab', !(await p.$eval('#dTrades', e => e.hidden)) && (await p.$$('#dTrades .dt-r')).length > 0);
  await p.click('#bookTabs [data-t="depth"]'); await p.waitForTimeout(400); ok('depth tab', !(await p.$eval('#dDepth', e => e.hidden)) && (await p.textContent('#ddL')).includes('bids'));
  await p.click('#bookTabs [data-t="book"]');
  await p.click('#side [data-s="short"]'); ok('short side', await p.$eval('#side .short', e => e.classList.contains('on')));
  await p.click('#types [data-o="limit"]'); ok('limit shows price', !(await p.$eval('#pxRow', e => e.hidden)));
  await p.click('#types [data-o="stop"]'); ok('stop label', (await p.textContent('#pxLbl')) === 'Trigger price');
  await p.click('#types [data-o="market"]'); ok('market hides price', await p.$eval('#pxRow', e => e.hidden));
  await p.fill('#tSize', '1000'); await p.waitForTimeout(100); ok('margin', (await p.textContent('#uMargin')).startsWith('$'));
  await p.click('.db-r.b'); ok('book click sets limit', !(await p.$eval('#pxRow', e => e.hidden)) && (await p.inputValue('#tPx')).length > 0);
  await p.click('#mktBtn'); ok('picker opens', !(await p.$eval('#picker', e => e.hidden)));
  await p.fill('#pkQ', 'sol'); await p.waitForTimeout(100); await p.click('#pkRows .pk-r[data-c="SOL"]'); await p.waitForTimeout(600);
  ok('switch to SOL', (await p.textContent('#mktName')) === 'SOL' && p.url().includes('m=SOL'));
  await p.click('#sTabs [data-t="fund"]'); await p.waitForTimeout(700); ok('funding history', (await p.textContent('#fhN')).includes('average'));
  for (const t of ['ord', 'his', 'priv', 'pos']) { await p.click(`#sTabs [data-t="${t}"]`); ok('sealed tab ' + t, !(await p.$eval(`.spane[data-p="${t}"]`, e => e.hidden))); }
  await p.click('#sTabs [data-t="priv"]'); await p.click('#pvDerive'); ok('derive asks to connect', await p.$eval('#wMenu', e => e.classList.contains('open')));
  await p.keyboard.press('Escape');
  await p.click('#place'); ok('place asks to connect', await p.$eval('#wMenu', e => e.classList.contains('open')));
  const r404 = await p.goto('http://localhost:8855/nope'); ok('404 page', r404.status() === 404 && (await p.textContent('h1')).includes('veil'));
  console.log(res.join('\n')); console.log('errors', errs.length, errs.slice(0, 5));
  await b.close();
})();
