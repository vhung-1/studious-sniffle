# 📈 Prediction Market Tracker

A lightweight dashboard for tracking live prediction markets. It pulls real-time
odds, volume, and liquidity from [Polymarket](https://polymarket.com)'s public
API, renders price-history sparklines, and lets you keep a personal watchlist.

![interface](https://img.shields.io/badge/stack-Node%20%2B%20Express%20%2B%20vanilla%20JS-3b82f6)

## Features

- **Live markets** — trending markets sorted by 24h volume, total volume,
  liquidity, or soonest to resolve.
- **Search** — filter markets by question text.
- **Probabilities at a glance** — each outcome shown as a bar with its implied
  percentage; multi-outcome markets show the top contenders.
- **Price history** — expandable sparkline per market (1D / 1W / 1M / All),
  with the point-change since the start of the window.
- **Watchlist** — star any market; it persists in your browser (`localStorage`)
  and refreshes on its own tab.
- **Auto-refresh** — the dashboard quietly updates every 30 seconds.

## How it works

The browser never calls Polymarket directly. A small Express server
(`server.js`) proxies and **caches** two upstream APIs, normalizing their
quirks (prices/outcomes arrive as JSON-encoded strings) into a stable shape:

| Endpoint | Upstream | Purpose |
| --- | --- | --- |
| `GET /api/markets` | Gamma `/markets` | trending / searched / sorted markets |
| `GET /api/markets/by-ids` | Gamma `/markets` | refresh watchlisted markets |
| `GET /api/history` | CLOB `/prices-history` | price series for sparklines |

A 20–60s in-memory TTL cache keeps us well within Polymarket's rate limits even
with multiple viewers.

## Running it

```bash
npm install
npm start
# open http://localhost:3000
```

Use `npm run dev` for auto-restart on file changes. Set `PORT` to change the
port (default `3000`).

> Requires Node 18+ (uses the built-in global `fetch`).

## Data source notes

This tracker uses Polymarket's **public, key-less** Gamma and CLOB APIs, which
are reachable without authentication. If you later want on-chain aggregates
(e.g. cross-venue volume from [Dune Analytics](https://dune.com)), add a
`DUNE_API_KEY` env var and a new route in `server.js` that queries Dune's
`/api/v1` endpoints — the frontend's `/api/*` contract stays the same.

## Project layout

```
server.js          Express proxy + cache, serves the static UI
public/index.html  dashboard markup
public/styles.css  dark theme
public/app.js      data fetching, rendering, watchlist, sparklines
```

## License

MIT
