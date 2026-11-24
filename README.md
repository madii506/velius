# VELIUS

Trade perps behind a veil. Hyperliquid's markets from Solana, built on Helius Privacy Rings.

Pages (one shared header, stamped in by `dev/html.cjs`):
- `/` home: intro, the live veil, and an overview of every page with live previews.
- `/markets` every Hyperliquid perp: a live map, a sortable table, filters, a watchlist, movers, and a drawer per market (chart, funding, book, trades, liquidation grid).
- `/desk` the desk: chart with moving averages, grouped book, trades, depth, a ticket that sizes by risk, keyboard shortcuts, watchlist strip, sealed book, private wallet.
- `/privacy` the model, who sees what, the Ring hour by hour, the scan, your private wallet, limits, programs.
- `/vault` how it works, one order, rules, keys, solvency, risks, roadmap, questions.
- `/docs` getting started to the glossary, with the trading math worked on the live mark.
- `/status` every source, checked live from the browser.

Run locally: `MOCK=1 node dev/server.cjs`, then http://localhost:8855 (dev/hlmock.cjs stands in for Hyperliquid in tests, from a recorded snapshot).
Rebuild after editing `src/` or `dev/header.html`: `sh build.sh` (rings.js, the Privacy Rings SDK chunk, only with `sh build.sh --rings`).
Tests: `node dev/click.cjs` (every control on every page), `node dev/pages.cjs <dir> [m]` (errors and overflow), `PAGES="/markets#explore" node dev/vshots.cjs <dir> [m]`.

Deploy: Vercel, static + `api/*.js`.

Environment (all optional; without them the vault stays closed and says so):
- `HELIUS_API_KEY` Helius RPC and Privacy Rings services
- `RPC_URL` a mainnet RPC (falls back to public endpoints)
- `VAULT_ADDRESS`, `VAULT_OPEN=1` only after the vault is funded and has passed a live mainnet test
