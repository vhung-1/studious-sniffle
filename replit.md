# Project context for Replit Agent

**Before doing anything, read these two files — they are the source of truth:**

1. [`kalshi-intel/README.md`](kalshi-intel/README.md) — what the app is, its
   architecture, data model, API, and how everything fits together.
2. [`kalshi-intel/REPLIT.md`](kalshi-intel/REPLIT.md) — the exact, Replit-specific
   build/run/deploy steps. Follow this for setup.

Do not infer the build from guesswork; the READMEs above are authoritative.

## What this repo is

A monorepo with two apps:

- **`kalshi-intel/`** — the primary app: a **Kalshi market-intelligence
  dashboard** (Next.js 14 + TypeScript + Tailwind + Prisma + PostgreSQL). It
  ingests live trades from Kalshi's public API and shows a live trade tape,
  volume analytics, block trades, and market discovery. **This is what Replit
  runs.**
- **root (`server.js`, `public/`)** — a separate, older Polymarket tracker
  (Express + vanilla JS). Not run by Replit. It also contains a standalone
  `public/robinhood-vs-kalshi.html` volume-comparison chart.

## How to build and run (summary — see REPLIT.md for detail)

1. The app needs **PostgreSQL**. Create one via Replit's **Database** tool; it
   injects `DATABASE_URL`. (Or set `DATABASE_URL` as a Secret for an external DB.)
2. Press **Run**. The root `.replit` runs `kalshi-intel/replit-run.sh`, which
   installs deps, runs `prisma generate` + `prisma migrate deploy`, seeds recent
   trades on first boot, starts the background ingester, and launches Next.js on
   `0.0.0.0:3000`.

Equivalent manual commands (run from `kalshi-intel/`):

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run db:seed
npx next dev -H 0.0.0.0 -p 3000
```

## Guardrails for the Agent

- The only required secret/env var is **`DATABASE_URL`**. The Kalshi trades API
  is public — **no API key**. Do not invent keys or add auth.
- Always bind the web server to `-H 0.0.0.0 -p 3000` (Replit webview + `[[ports]]`).
- All DB access is in dynamic routes / client fetches, so `next build` does **not**
  need a live database — only migrate/seed/runtime do.
- If asked to "make it work" and there's no database, the fix is to create the
  PostgreSQL database (step 1), not to change the code.
- Schema/migrations live in `kalshi-intel/prisma/`. Change the schema there and
  run a migration; never hand-edit the database.
- Don't run a local `postgres` via Nix — use Replit's managed database.
