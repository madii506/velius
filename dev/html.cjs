// Stamps the shared header into every page, marks the current page, sets the live site URL and asset versions.
// Runs in place and is idempotent: node dev/html.cjs
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const SITE = 'https://velius.vercel.app';
const V = '3';
const PAGES = ['index', 'markets', 'desk', 'privacy', 'vault', 'docs', 'status'];
const head = fs.readFileSync(path.join(__dirname, 'header.html'), 'utf8').trim();
for (const p of PAGES) {
  const f = path.join(ROOT, p + '.html');
  if (!fs.existsSync(f)) { console.log('skip', p); continue; }
  let s = fs.readFileSync(f, 'utf8');
  const key = p === 'index' ? 'home' : p;
  const h = head.replace(/(<a href="[^"]*" data-p="([a-z]+)")/g, (m, a, k) => k === key ? a + ' class="on" aria-current="page"' : a);
  const re = /<!-- header -->[\s\S]*?<!-- \/header -->/;
  if (!re.test(s)) { console.log('no header markers in', p); }
  s = s.replace(re, '<!-- header -->\n' + h + '\n<!-- /header -->');
  s = s.replace(/__SITE__/g, SITE);
  s = s.replace(/(\/assets\/(?:css|js)\/[a-z0-9-]+\.(?:css|js))\?v=\d+/g, '$1?v=' + V);
  fs.writeFileSync(f, s);
  console.log('ok', p);
}
