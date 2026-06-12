# Kalshi Intel — Market Activity Dashboard

A lightweight, Bloomberg-style market-intelligence dashboard for [Kalshi](https://kalshi.com),
focused on **trade flow, volume analytics, block trades, and market discovery**.
It continuously ingests raw trades from the public Kalshi API into PostgreSQL and
serves real-time analytics through a Next.js dashboard.

## Stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** + **shadcn/ui**-style components
- **Recharts** for price/volume charts
- **Prisma** + **PostgreSQL**

## Features

- **Live Trade Tape** — auto-refreshing stream of the latest trades (ticker,
  time, contracts, yes/no price, value, block-trade flag), new rows flash.
- **Market Analytics** — total contracts, dollar volume, trade count, active
  markets, average trade size, block-trade volume %.
- **Volume chart** — contracts by hour/day.
- **Top lists** — top volume markets, most active tickers, top block-trade
  markets, largest trades.
- **Market Detail** — price history (volume-weighted avg yes price), volume
  history, recent trades, largest trades, block-trade activity.
- **Market Discovery** — searchable, sortable table of every market with activity.
- **Filters** — ticker search, time range, block-trade-only toggle, minimum
  trade size.
- **UX** — 10-second auto-refresh, responsive layout, loading & error states,
  dark mode (default).

## Architecture

```
src/
  lib/kalshi/      Kalshi API client (cursor pagination + retry/backoff)
  lib/db/          Prisma client singleton
  services/        Query/aggregation layer (trades, markets, analytics)
  ingestion/       Incremental, idempotent trade ingester (+ CLI)
  app/api/         Route handlers: /trades /markets /markets/[ticker] /analytics
  app/             Dashboard, markets list, market detail pages
  components/      UI primitives + dashboard widgets + Recharts charts
  hooks/           usePoll (auto-refresh), useInterval
prisma/            schema.prisma, seed.ts
```

**Ingestion** walks the Kalshi `GET /markets/trades` cursor pages, storing every
trade keyed by `trade_id`. Because `trade_id` is the primary key and inserts use
`createMany({ skipDuplicates: true })`, ingestion is fully idempotent. Each pass
resumes from the last seen `created_time` (minus a small overlap window) so no
trades are missed and none are double-counted. The loop retries transient API
failures with exponential backoff and never dies on a single bad cycle.

**Derived metrics** (computed in SQL):

| Metric | Definition |
| --- | --- |
| Contracts Volume | `SUM(count_fp)` |
| Dollar Volume | `SUM(count_fp × yes_price_dollars)` |
| Average Trade Size | `AVG(count_fp)` |
| Block Trade Volume % | block contracts ÷ total contracts |
| Trade Count | `COUNT(*)` |
| Volume by Market | `GROUP BY ticker` |
| Volume by Hour/Day | `date_trunc('hour'|'day', created_time)` |

## Database schema

`trades` — one row per Kalshi trade:
`trade_id` (PK), `ticker`, `count_fp`, `yes_price_dollars`, `no_price_dollars`,
`created_time`, `is_block_trade` (+ `taker_side`, `ingested_at`). Indexes on
`ticker`, `created_time`, `is_block_trade`, and composites `(ticker, created_time)`
and `(created_time, is_block_trade)`.

## Quick start (local)

Prerequisites: Node 18+ and a PostgreSQL instance.

```bash
cd kalshi-intel
cp .env.example .env          # adjust DATABASE_URL if needed
npm install
npm run prisma:migrate        # create the schema (dev migration)
npm run db:seed               # pull recent trades so the UI has data
npm run dev                   # http://localhost:3000

# In another terminal, keep ingesting live trades:
npm run ingest                # continuous; Ctrl-C to stop
# or a single catch-up pass:
npm run ingest:once
```

### Backfilling history

`ingest`/`ingest:once` are **forward-only** — they resume from the latest stored
`created_time`. To pull *older* history, use backfill mode, which walks the
Kalshi cursor newest → oldest:

```bash
npm run ingest:backfill -- --max-pages=800   # up to 800 pages × 1000 trades
```

Backfill is idempotent (deduped by `trade_id`) and never regresses the
incremental cursor, so it's safe to run alongside or repeatedly to go deeper.
Kalshi is very high-volume, so each 1000-trade page typically spans only a short
wall-clock window — raise `--max-pages` to reach further back.

## Quick start (Docker)

```bash
docker compose up --build
# db + migrate + web (http://localhost:3000) + continuous ingester
```

## Environment variables

| Variable | Purpose | Default |
| --- | --- | --- |
| `DATABASE_URL` | Postgres connection string | — (required) |
| `KALSHI_API_BASE` | Kalshi trade API base URL | `https://api.elections.kalshi.com/trade-api/v2` |
| `INGEST_INTERVAL_MS` | Continuous poll cadence | `10000` |
| `INGEST_PAGE_LIMIT` | Trades per Kalshi page (max 1000) | `1000` |
| `INGEST_OVERLAP_SEC` | Re-scan window to avoid edge gaps | `120` |
| `SEED_PAGES` | Pages pulled by `db:seed` | `10` |

## API

| Endpoint | Description |
| --- | --- |
| `GET /api/trades` | Filtered trades. Params: `ticker, range, from, to, blockOnly, minSize, limit, offset, sort, order` |
| `GET /api/markets` | Market discovery list. Params: `search, sort, limit, offset` |
| `GET /api/markets/[ticker]` | Market detail (summary, price/volume history, trades). Param: `granularity` |
| `GET /api/analytics` | Overview + top lists + volume series. Params: `ticker, range, granularity` |

`range` accepts `1h`, `24h`, `7d`, `30d`, `all` (or explicit `from`/`to` ISO timestamps).

> The Kalshi trades endpoint is public — no API key required.
