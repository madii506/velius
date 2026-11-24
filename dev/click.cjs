// every control on every page does something, and nothing throws
const { chromium } = require('playwright');
const { route } = require('./hlmock.cjs');
const B = 'http://localhost:8855';
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const res = [], errs = [];
  const ok = (name, v) => res.push((v ? 'ok   ' : 'FAIL ') + name);
  const page = async path => { const p = await ctx.newPage(); await route(p); p.on('pageerror', e => errs.push(path + ' ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push(path + ' ' + m.text()); }); await p.goto(B + path, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2200); return p; };
  const txt = (p, s) => p.textContent(s);
  const n = (p, s) => p.$$eval(s, e => e.length);

  // ---------- home ----------
  let p = await page('/');
  ok('home: intro gone (reduced motion)', await p.$eval('#intro', e => e.classList.contains('gone')));
  ok('home: title VELIUS', (await p.title()) === 'VELIUS');
  ok('home: nav has 6 pages', (await n(p, '.nav a')) === 6);
  await p.click('#wBtn'); ok('home: wallet menu opens', await p.$eval('#wMenu', e => e.classList.contains('open'))); await p.keyboard.press('Escape');
  for (const id of ['ETH', 'SOL', 'HYPE', 'BTC']) { await p.click(`#pubPick [data-c="${id}"]`); await p.waitForTimeout(200); ok('home: book ' + id, (await txt(p, '#pubCoin')) === id && (await n(p, '#pubBook .ob-r.a')) > 3); }
  ok('home: markets rows', (await n(p, '#mkRows .mkr')) === 12);
  ok('home: chips', (await n(p, '#chips .mchip')) === 4);
  ok('home: overview map tiles are links', (await n(p, '#bxMap a.tile')) > 8);
  ok('home: ring count', /\d/.test(await txt(p, '#bxRing')));
  ok('home: status card', /ms/.test(await txt(p, '#bxHl')) && /\d/.test(await txt(p, '#bxSlot')));
  ok('home: vault steps', (await n(p, '#bxSteps i.ok')) === 3);
  await p.selectOption('#cMk', 'ETH'); await p.click('#cSide [data-s="short"]'); await p.fill('#cLev', '5'); await p.dispatchEvent('#cLev', 'input');
  ok('home: calc short 5x', (await txt(p, '#cLevV')) === '5x' && (await txt(p, '#cMove')).startsWith('+'));
  const det = await p.$$('#faq details'); await det[0].click(); ok('home: faq opens', await det[0].evaluate(e => e.open));
  ok('home: rail has 10', (await n(p, '#rail a')) === 10);
  ok('home: funding has digits', /\d/.test(await txt(p, '[data-s="fund"]')) && !/0\.0000%/.test(await txt(p, '[data-s="fund"]')));
  await p.waitForTimeout(1500);
  ok('home: tape prints', (await n(p, '#tapeRows .tp-r')) > 3);
  ok('home: funding board', (await n(p, '#fundPos .fr')) > 0);
  ok('home: og image is absolute', (await p.$eval('meta[property="og:image"]', e => e.content)).startsWith('https://velius.vercel.app/'));
  await p.close();

  // ---------- markets ----------
  p = await page('/markets');
  ok('markets: nav marks Markets', (await txt(p, '.nav a.on')) === 'Markets');
  ok('markets: kpis', /\d/.test(await txt(p, '[data-k="n"]')) && /\$/.test(await txt(p, '[data-k="vol"]')));
  const tiles = await n(p, '#map .tile[data-c]'); ok('markets: map tiles ' + tiles, tiles > 50);
  await p.click('#filters [data-f="watch"]'); await p.waitForTimeout(200); ok('markets: watchlist filter', (await n(p, '#map .tile[data-c]')) === 4);
  await p.click('#filters [data-f="up"]'); await p.waitForTimeout(200); ok('markets: rising filter', (await n(p, '#map .tile[data-c]')) >= 1 && (await n(p, '#map .tile[data-c]')) < 20);
  await p.click('#filters [data-f="all"]'); await p.fill('#q', 'sol'); await p.waitForTimeout(200); ok('markets: search', (await n(p, '#map .tile[data-c="SOL"]')) === 1);
  await p.fill('#q', ''); await p.dispatchEvent('#q', 'input');
  await p.click('#metric [data-m="oi"]'); await p.waitForTimeout(200); ok('markets: size by open interest', (await txt(p, '#lgSize')) === 'open interest');
  await p.click('#map .tile.other'); await p.waitForTimeout(300); ok('markets: more tile opens the table', !(await p.$eval('#tblBox', e => e.hidden)));
  ok('markets: table rows', (await n(p, '#rows .mt-r')) > 150);
  await p.click('#thead [data-s="chg"]'); await p.waitForTimeout(150); const s1 = await p.$eval('#thead [data-s="chg"]', e => e.getAttribute('aria-sort'));
  await p.click('#thead [data-s="chg"]'); await p.waitForTimeout(150); const s2 = await p.$eval('#thead [data-s="chg"]', e => e.getAttribute('aria-sort'));
  ok('markets: sort toggles', s1 && s2 && s1 !== s2);
  await p.click('#rows .mt-r [data-star="DOGE"]'); ok('markets: star', await p.$eval('#rows [data-star="DOGE"]', e => e.classList.contains('on')));
  await p.click('#rows .mt-r [data-star="DOGE"]'); ok('markets: unstar', !(await p.$eval('#rows [data-star="DOGE"]', e => e.classList.contains('on'))));
  await p.click('#rows .mt-r[data-c="ETH"] .nm'); await p.waitForTimeout(900);
  ok('markets: drawer opens', !(await p.$eval('#drawer', e => e.hidden)) && p.url().includes('m=ETH'));
  ok('markets: drawer stats', (await n(p, '#drStats div')) === 12 && (await p.$eval('#drStats', e => e.getBoundingClientRect().height)) > 80);
  ok('markets: drawer book', (await n(p, '#drBook .db')) === 16);
  ok('markets: drawer funding', /average/.test(await txt(p, '#drFundN')));
  ok('markets: drawer liquidation grid', (await n(p, '#drLiq span')) >= 12);
  await p.click('#drTf [data-tf="4h"]'); ok('markets: drawer timeframe', await p.$eval('#drTf [data-tf="4h"]', e => e.classList.contains('on')));
  const was = await p.$eval('#drStar', e => e.classList.contains('on'));
  await p.click('#drStar'); ok('markets: drawer star toggles', (await p.$eval('#drStar', e => e.classList.contains('on'))) !== was);
  await p.click('#drStar');
  await p.keyboard.press('Escape'); ok('markets: Esc closes drawer', await p.$eval('#drawer', e => e.hidden));
  await p.click('#view [data-v="map"]');
  ok('markets: movers', (await n(p, '#mvDn a')) > 0 && (await n(p, '#mvOi a')) === 6);
  await p.click('#mvOi a'); await p.waitForTimeout(500); ok('markets: mover opens drawer', !(await p.$eval('#drawer', e => e.hidden))); await p.click('#drX');
  await p.close();
  p = await page('/markets?m=SOL'); ok('markets: deep link opens drawer', (await txt(p, '#drName')) === 'SOL' && !(await p.$eval('#drawer', e => e.hidden))); await p.close();

  // ---------- desk ----------
  p = await page('/desk');
  ok('desk: nav marks Desk', (await txt(p, '.nav a.on')) === 'Desk');
  for (const tf of ['1m', '5m', '1h', '4h', '1d', '15m']) { await p.click(`#tfs [data-tf="${tf}"]`); await p.waitForTimeout(150); ok('desk: tf ' + tf, await p.$eval(`#tfs [data-tf="${tf}"]`, e => e.classList.contains('on'))); }
  await p.click('#ema [data-n="200"]'); ok('desk: EMA 200 on', await p.$eval('#ema [data-n="200"]', e => e.classList.contains('on')));
  await p.click('#ema [data-n="200"]');
  const gopts = await n(p, '#grp option'); ok('desk: grouping options ' + gopts, gopts >= 3);
  await p.selectOption('#grp', { index: 2 }); await p.waitForTimeout(600); ok('desk: grouped book renders', (await n(p, '#dBook .db-r')) > 6);
  await p.selectOption('#grp', { index: 0 }); await p.waitForTimeout(300);
  ok('desk: watchlist strip', (await n(p, '#wl .wl-c')) === 4);
  await p.click('#wl .wl-c[data-c="ETH"]'); await p.waitForTimeout(500); ok('desk: strip switches market', (await txt(p, '#mktName')) === 'ETH');
  await p.click('#mStar'); ok('desk: star removes', (await n(p, '#wl .wl-c')) === 3); await p.click('#mStar'); ok('desk: star adds back', (await n(p, '#wl .wl-c')) === 4);
  await p.click('#chart'); await p.keyboard.press('s'); ok('desk: key S', await p.$eval('#side .short', e => e.classList.contains('on')));
  await p.keyboard.press('b'); ok('desk: key B', await p.$eval('#side .long', e => e.classList.contains('on')));
  await p.keyboard.press('l'); ok('desk: key L', !(await p.$eval('#pxRow', e => e.hidden)));
  await p.keyboard.press('t'); ok('desk: key T', (await txt(p, '#pxLbl')) === 'Trigger price');
  await p.keyboard.press('m'); ok('desk: key M', await p.$eval('#pxRow', e => e.hidden));
  await p.keyboard.press('4'); await p.waitForTimeout(150); ok('desk: key 4 is 1h', await p.$eval('#tfs [data-tf="1h"]', e => e.classList.contains('on')));
  await p.keyboard.press('g'); await p.waitForTimeout(200); ok('desk: key G groups', (await p.$eval('#grp', e => e.selectedIndex)) === 1);
  await p.keyboard.press('?'); ok('desk: key ? opens the list', !(await p.$eval('#keys', e => e.hidden)) && (await n(p, '#keysL div')) === 16);
  await p.keyboard.press('Escape'); ok('desk: Esc closes the list', await p.$eval('#keys', e => e.hidden));
  await p.keyboard.press(']'); await p.waitForTimeout(300); ok('desk: ] next starred', (await txt(p, '#mktName')) === 'BTC');
  await p.click('#side [data-s="long"]');
  await p.fill('#tSize', '1000'); await p.waitForTimeout(80); ok('desk: margin', (await txt(p, '#uMargin')).startsWith('$'));
  const mk = await p.evaluate(() => +document.querySelector('#uEntry').textContent.replace(/,/g, ''));
  await p.fill('#tSl', String(+(mk * 0.98).toFixed(3))); await p.fill('#tTp', String(+(mk * 1.04).toFixed(3))); await p.waitForTimeout(80);
  ok('desk: loss at stop', !(await p.$eval('#rLoss', e => e.hidden)) && (await txt(p, '#uLoss')).startsWith('-$'));
  ok('desk: reward to risk', /: 1/.test(await txt(p, '#uRR')));
  await p.click('#szMode [data-m="risk"]'); await p.fill('#tSize', '100'); await p.waitForTimeout(80);
  const size = await p.evaluate(() => +document.querySelector('#uSize').textContent.replace(/[$,]/g, ''));
  ok('desk: size by risk ' + size, size > 3000 && size < 5000);
  ok('desk: risk loss equals input', Math.abs(+(await txt(p, '#uLoss')).replace(/[-$,]/g, '') - 100) < 1.5);
  await p.fill('#tSl', String(+(mk * 0.5).toFixed(3))); await p.waitForTimeout(80); ok('desk: warns when liquidation comes first', !(await p.$eval('#tWarn', e => e.hidden)));
  await p.click('#szMode [data-m="usd"]');
  await p.click('#bookTabs [data-t="trades"]'); await p.waitForTimeout(250); ok('desk: trades tab', (await n(p, '#dTrades .dt-r')) > 0);
  await p.click('#bookTabs [data-t="depth"]'); await p.waitForTimeout(300); ok('desk: depth tab', (await txt(p, '#ddL')).includes('bids'));
  await p.click('#bookTabs [data-t="book"]');
  await p.click('.db-r.b'); ok('desk: book click sets limit', !(await p.$eval('#pxRow', e => e.hidden)) && (await p.inputValue('#tPx')).length > 0);
  await p.click('#mktBtn'); ok('desk: picker opens', !(await p.$eval('#picker', e => e.hidden)));
  await p.click('#pkTab [data-t="watch"]'); ok('desk: picker starred tab', (await n(p, '#pkRows .pk-r')) === 4);
  await p.click('#pkTab [data-t="all"]'); await p.fill('#pkQ', 'dog'); await p.waitForTimeout(100);
  await p.click('#pkRows [data-star="DOGE"]'); ok('desk: picker star', (await n(p, '#wl .wl-c')) === 5);
  await p.click('#pkRows .pk-go[data-go="DOGE"]'); await p.waitForTimeout(500); ok('desk: switch to DOGE', (await txt(p, '#mktName')) === 'DOGE' && p.url().includes('m=DOGE'));
  await p.click('#sTabs [data-t="fund"]'); await p.waitForTimeout(700); ok('desk: funding history', (await txt(p, '#fhN')).includes('average'));
  for (const t of ['ord', 'his', 'priv', 'pos']) { await p.click(`#sTabs [data-t="${t}"]`); ok('desk: sealed tab ' + t, !(await p.$eval(`.spane[data-p="${t}"]`, e => e.hidden))); }
  await p.click('#sTabs [data-t="priv"]'); await p.click('#pvDerive'); ok('desk: derive asks to connect', await p.$eval('#wMenu', e => e.classList.contains('open'))); await p.keyboard.press('Escape');
  await p.click('#place'); ok('desk: place asks to connect', await p.$eval('#wMenu', e => e.classList.contains('open')));
  ok('desk: funding shows digits', /\d/.test(await txt(p, '#sFund')) && /%/.test(await txt(p, '#sApr')));
  await p.close();

  // ---------- privacy ----------
  p = await page('/privacy');
  ok('privacy: ring counts', /\d/.test(await txt(p, '#kpis [data-r="hour"]')) && /\d/.test(await txt(p, '#ringBox [data-r="day"]')));
  ok('privacy: ring signatures', (await n(p, '#ringBox .sig')) === 6);
  ok('privacy: programs read', (await txt(p, '.pst[data-p="ring"]')).includes('live'));
  ok('privacy: subnav has 8', (await n(p, '.subnav a')) === 8);
  await p.click('.subnav a[href="#limits"]'); await p.waitForTimeout(500); ok('privacy: subnav scrolls', await p.evaluate(() => Math.abs(document.getElementById('limits').getBoundingClientRect().top) < 200));
  await p.fill('#scanQ', 'not an address'); await p.click('#scanF button'); ok('privacy: scan rejects junk', (await txt(p, '#scanOut')).includes('not a Solana address'));
  await p.fill('#scanQ', 'ring1GaLCuJnkUMVkX2JeZLTTX17wKsV4fZmPVzXANW'); await p.click('#scanF button'); await p.waitForTimeout(700); ok('privacy: scan result', (await n(p, '#scanOut .kv div')) === 6);
  await p.click('#scanMine'); ok('privacy: scan mine asks to connect', await p.$eval('#wMenu', e => e.classList.contains('open'))); await p.keyboard.press('Escape');
  await p.click('#dv [data-d="btn"]'); ok('privacy: derive asks to connect', await p.$eval('#wMenu', e => e.classList.contains('open'))); await p.keyboard.press('Escape');
  await p.close();

  // ---------- vault ----------
  p = await page('/vault');
  ok('vault: state', (await txt(p, '[data-k="state"]')) === 'Closed');
  ok('vault: markets count', /\d+ perps/.test(await txt(p, '[data-k="mk"]')));
  ok('vault: roadmap marks the next step', await p.$eval('#roll [data-r="engine"]', e => e.classList.contains('now')));
  const vd = await p.$$('#faq details'); await vd[1].click(); ok('vault: faq opens', await vd[1].evaluate(e => e.open));
  await p.close();

  // ---------- docs ----------
  p = await page('/docs');
  ok('docs: example on the live mark', /\d/.test(await txt(p, '#exE')) && /\d/.test(await txt(p, '#exL')));
  const l1 = await txt(p, '#exL'); await p.click('#exLev [data-l="20"]'); await p.click('#exSide [data-s="-1"]'); ok('docs: example reacts', (await txt(p, '#exL')) !== l1 && (await txt(p, '#exMv')).startsWith('+'));
  await p.click('#exMk [data-c="ETH"]'); ok('docs: example market', (await txt(p, '#exNote')).startsWith('ETH'));
  ok('docs: keyboard list', (await n(p, '#keysd div')) === 16);
  await p.fill('#dq', 'liquidation'); await p.waitForTimeout(100); ok('docs: search dims sections', (await n(p, '.doc section.miss')) > 3 && (await n(p, '.doc section.miss')) < 12);
  ok('docs: search filters glossary', (await n(p, '#gl dt:not(.hide)')) < 8);
  await p.fill('#dq', 'zzzz'); await p.dispatchEvent('#dq', 'input'); ok('docs: no match message', !(await p.$eval('#dnone', e => e.hidden)));
  await p.fill('#dq', ''); await p.dispatchEvent('#dq', 'input');
  ok('docs: funding now', /BTC pays/.test(await txt(p, '#fNow')));
  await p.close();

  // ---------- status ----------
  p = await page('/status'); await p.waitForTimeout(1200);
  ok('status: all answering', (await txt(p, '#sumT')) === 'Everything is answering');
  ok('status: routes all 200', (await p.$$eval('#rt .a', e => e.filter(x => x.textContent.startsWith('200')).length)) === 4);
  await p.click('#again'); await p.waitForTimeout(1500); ok('status: check again', /\d/.test(await txt(p, '#lastAt')));
  await p.close();

  // ---------- every page links to every page ----------
  p = await page('/vault');
  for (const href of ['/markets', '/desk', '/privacy', '/vault', '/docs', '/status']) { const r = await p.goto(B + href); ok('page ' + href + ' answers', r.status() === 200); }
  const r404 = await p.goto(B + '/nope'); ok('404 page', r404.status() === 404 && (await txt(p, 'h1')).includes('veil'));
  console.log(res.join('\n')); console.log('checks', res.length, 'failed', res.filter(x => x.startsWith('FAIL')).length); console.log('errors', errs.length, errs.slice(0, 8));
  await b.close();
})();
