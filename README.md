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
- **Kalshi indicator** (optional) — a "Prediction Markets (Kalshi)" panel fed by
  [Dune Analytics](https://dune.com): monthly trade activity rolled up into
  average daily volume (ADV) with month-over-month and year-over-year changes.
  Hidden automatically unless a Dune key is configured.

## How it works

The browser never calls Polymarket directly. A small Express server
(`server.js`) proxies and **caches** two upstream APIs, normalizing their
quirks (prices/outcomes arrive as JSON-encoded strings) into a stable shape:

| Endpoint | Upstream | Purpose |
| --- | --- | --- |
| `GET /api/markets` | Gamma `/markets` | trending / searched / sorted markets |
| `GET /api/markets/by-ids` | Gamma `/markets` | refresh watchlisted markets |
| `GET /api/history` | CLOB `/prices-history` | price series for sparklines |
| `GET /api/kalshi` | Dune `/query/5741350/results/csv` | monthly Kalshi ADV / MoM / YoY |
| `GET /api/kalshi/daily` | Dune `/query/5741350/results/csv` | daily trade counts + rolling-average stats |

A 20–60s in-memory TTL cache keeps us well within Polymarket's rate limits even
with multiple viewers. The Kalshi/Dune result is cached for an hour (the
underlying query refreshes roughly daily).

### Kalshi indicator (Dune Analytics)

The `/api/kalshi` route pulls Dune query **#5741350** ("daily Kalshi trades":
`date, Trades, Cumulative Trades`), rolls the daily counts into monthly totals,
and derives **ADV** (contracts ÷ calendar days — the trailing partial month is
measured over days elapsed), plus **MoM** and **YoY** change on ADV.

By default it returns the **full history back to inception** (June 2021) along
with a `summary` (first/last month, month count, all-time contracts). Pass
`?months=N` to limit the window, e.g. `/api/kalshi?months=13`. Because the data
is computed live from Dune on each (cached) fetch, the entire history is always
available — there's no database to backfill.

It's opt-in. Set the key in the environment — never commit it:

```bash
export DUNE_API_KEY=your_dune_key
# optional: point at a different Dune query
export KALSHI_DUNE_QUERY_ID=5741350
npm start
```

Without `DUNE_API_KEY`, `/api/kalshi` returns `503` and the panel hides itself —
the rest of the dashboard is unaffected. To swap the metric, change
`KALSHI_DUNE_QUERY_ID` (or edit the default in `server.js`); the frontend
contract is unchanged.

#### Daily dashboard

A dedicated daily view lives at **`/kalshi.html`** (linked from the Kalshi panel
on the main page). It charts every daily trade count back to inception with an
interactive hover tooltip, a range selector (30D / 90D / 1Y / All), a cumulative
chart, and stat cards (latest day, 7- and 30-day averages, 30-day total, peak
day, all-time total). It's powered by `GET /api/kalshi/daily?range=30d|90d|1y|all`.

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

The live market data uses Polymarket's **public, key-less** Gamma and CLOB APIs,
which are reachable without authentication. The optional Kalshi indicator uses
[Dune Analytics](https://dune.com) and requires `DUNE_API_KEY` (see above). The
key is read from the environment and is never stored in the repo.

## Project layout

```
server.js          Express proxy + cache, serves the static UI
public/index.html  dashboard markup
public/styles.css  dark theme
public/app.js      data fetching, rendering, watchlist, sparklines
```

## License

MIT
