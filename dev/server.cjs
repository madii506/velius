// local dev server: static files + /api. MOCK=1 answers /api from fixtures (the sandbox cannot reach Solana).
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), PORT = +process.env.PORT || 8855, MOCK = process.env.MOCK === '1';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json', '.ico': 'image/x-icon' };
const FIX = {
  status: () => ({ slot: 383112908 + Math.floor((Date.now() / 400) % 100000), vault: false, ring: { address: 'ring1GaLCuJnkUMVkX2JeZLTTX17wKsV4fZmPVzXANW', ok: true, executable: true }, registry: { address: 'regy3WAeRXMYuMYxr5iK3Bf9Arr3PcxGxyzAddbiqDQ', ok: true, executable: true }, tree: { address: '777pvSGe5LaBd9nCczvE2FXEauiwtfGJ5XRpjKyniGor', ok: true } }),
  ring: () => { const now = Math.floor(Date.now() / 1000), A = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'; let seed = 7; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647; const sig = () => Array.from({ length: 88 }, () => A[Math.floor(r() * 58)]).join(''); return { program: 'ring1GaLCuJnkUMVkX2JeZLTTX17wKsV4fZmPVzXANW', hour: 37, day: 812, capped: false, last: [14, 51, 96, 170, 260, 402].map((d, i) => ({ sig: sig(), t: now - d, slot: 383120000 - i * 120 })), at: Date.now() }; },
  vault: () => ({ open: false, address: null, maxLeverage: 20, reason: 'The vault opens once it is funded and has passed a live test on mainnet.', at: Date.now() }),
  config: () => ({ vault: false }),
  scan: () => ({ address: 'x', sol: 3.214, solUsd: 224.7, usd: 4120.55, tokens: 23, top: [{ sym: 'USDC', amount: 1830.2, usd: 1830.2 }, { sym: 'JUP', amount: 2100, usd: 1012.3 }, { sym: 'BONK', amount: 31000000, usd: 556.1 }, { sym: 'WIF', amount: 812, usd: 497.2 }], txs: 1000, txCapped: true, firstSeen: 1667260800, at: Date.now() }),
  registered: () => ({ registered: false, record: '4rqiNrQgfty4Yfy81zrwUANqMsnCQN7NwnXwZUN9ZpX2' }),
};
http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname.startsWith('/api/')) {
    const name = u.pathname.slice(5).replace(/\/$/, '');
    if (MOCK && FIX[name]) { res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify(FIX[name]())); }
    try { return require(path.join(ROOT, 'api', name + '.js'))(req, res); } catch (e) { res.statusCode = 404; return res.end('{}'); }
  }
  let p = u.pathname === '/' ? '/index.html' : u.pathname;
  if (!path.extname(p)) p += '.html';                                 // cleanUrls, like Vercel
  const f = path.join(ROOT, decodeURIComponent(p));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.statusCode = 404; res.setHeader('content-type', TYPES['.html']); return fs.createReadStream(path.join(ROOT, '404.html')).on('error', () => res.end('not found')).pipe(res); }
  res.setHeader('content-type', TYPES[path.extname(f)] || 'application/octet-stream');
  try { for (const h of JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8')).headers[0].headers) res.setHeader(h.key, h.value); } catch (e) {}
  fs.createReadStream(f).pipe(res);
}).listen(PORT, () => console.log('dev on', PORT, MOCK ? '(mock api)' : ''));
