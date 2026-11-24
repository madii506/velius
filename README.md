# VELIUS

Trade perps behind a veil. Hyperliquid's markets from Solana, built on Helius Privacy Rings.

- `/` home: intro, the live veil (four real order books under it), twelve sections with live data.
- `/desk` the desk: live chart, book, trades, funding, a full ticket, your lines on your screen, your private wallet.

Run locally: `MOCK=1 node dev/server.cjs`, then http://localhost:8855 (dev/hlmock.cjs stands in for Hyperliquid in tests).
Rebuild scripts after editing `src/`: `sh build.sh` (rings.js, the Privacy Rings SDK chunk, only with `sh build.sh --rings`).
Tests: `node dev/click.cjs` (every control), `node dev/shots.cjs <dir> home|desk|intro [m]`.

Deploy: Vercel, static + `api/*.js`. Replace `__SITE__` in the og/twitter tags with the live URL.

Environment (all optional; without them the vault stays closed and says so):
- `HELIUS_API_KEY` Helius RPC and Privacy Rings services
- `RPC_URL` a mainnet RPC (falls back to public endpoints)
- `VAULT_ADDRESS`, `VAULT_OPEN=1` only after the vault is funded and has passed a live mainnet test
