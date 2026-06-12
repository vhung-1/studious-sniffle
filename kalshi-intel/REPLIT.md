# Running Kalshi Intel on Replit

This guide gets the `kalshi-intel/` dashboard running on [Replit](https://replit.com)
— Next.js 14 + Prisma + PostgreSQL, ingesting live trades from Kalshi's public API.

> The repo also contains a separate Polymarket Express app at the root. The
> `.replit` / `replit.nix` at the repo root are configured to run **this**
> dashboard (`kalshi-intel/`).

---

## 1. Create the Repl

**Import from GitHub:** Replit → *Create Repl* → *Import from GitHub* →
`vhung-1/studious-sniffle`. Replit reads the root `.replit` and targets the
`kalshi-intel/` app automatically.

## 2. Add a PostgreSQL database

Use Replit's built-in Postgres (it's Neon under the hood and persists across
restarts):

1. Open the **Database** tool in the left sidebar → **Create a database** (PostgreSQL).
2. Replit injects a `DATABASE_URL` secret automatically — no copying needed.
3. **Recommended:** in **Secrets**, set a tuned URL so the analytics fan-out
   doesn't exhaust the connection pool. Take the value Replit gave you and
   append pool params:

   ```
   DATABASE_URL = <replit-url>?sslmode=require&connection_limit=21&pool_timeout=30
   ```

   (If the URL already has a `?`, join the extra params with `&` instead.)

> Avoid running a local `postgres` via Nix on Replit — it won't persist reliably.
> The managed database above is the right choice.

## 3. Secrets / environment variables

In the **Secrets** pane (🔒), the only required one is `DATABASE_URL` (step 2).
Optional:

| Secret | Default | Purpose |
| --- | --- | --- |
| `KALSHI_API_BASE` | `https://api.elections.kalshi.com/trade-api/v2` | Kalshi trade API (public, no key) |
| `INGEST_INTERVAL_MS` | `10000` | continuous ingester poll cadence |
| `INGEST_PAGE_LIMIT` | `1000` | trades per page (max 1000) |
| `SEED_PAGES` | `10` | pages pulled by `db:seed` |

## 4. Run the dashboard (one click)

Press **Run**. The root `.replit` runs `kalshi-intel/replit-run.sh`, which is
idempotent and does everything for you:

1. checks `DATABASE_URL` is set (tells you to add a database if not),
2. `npm install` + `npx prisma generate`,
3. `npx prisma migrate deploy` (creates the `trades` + `ingest_state` tables),
4. **seeds** ~10 pages of recent trades the first time (skipped if data exists),
5. starts the **background ingester** (live updates → `/tmp/ingest.log`),
6. launches Next.js on `0.0.0.0:3000` (mapped to the public URL by `[[ports]]`).

First boot takes a minute or two (install + seed); later runs are fast.

### Manual equivalent (fallback)

If you'd rather drive it yourself, or the Run button misbehaves, open the
**Shell** and run the same steps:

```bash
cd kalshi-intel
npm install
npx prisma generate
npx prisma migrate deploy     # creates the trades + ingest_state tables
npm run db:seed               # pulls ~10 pages of recent trades so the UI has data
npx next dev -H 0.0.0.0 -p 3000
```

Binding to `0.0.0.0` is required on Replit so the webview can reach it; port
`3000` is mapped to the public URL by the `[[ports]]` block in `.replit`.

## 5. Keep ingesting live trades

The Run button already starts a background ingester. To run extra/independent
ingestion, open a **second Shell tab** and run:

```bash
cd kalshi-intel && npm run ingest          # continuous; polls every 10s
```

Or pull historical depth on demand:

```bash
cd kalshi-intel && npm run ingest:backfill -- --max-pages=500   # newest -> oldest
```

For an always-on ingester independent of the web Repl, use a **Scheduled
Deployment** (e.g. run `npm run ingest:once` every few minutes) or a separate
**Background Worker** Repl pointed at the same database.

## 6. Deploy (optional)

Replit **Deployments** → *Autoscale* / *Reserved VM*. The root `.replit`
`[deployment]` section already defines:

- **Build:** `cd kalshi-intel && npm install && npx prisma generate && npm run build`
- **Run:** `cd kalshi-intel && npx prisma migrate deploy && npx next start -H 0.0.0.0 -p 3000`

Make sure `DATABASE_URL` is set in the deployment's secrets too.

---

## Troubleshooting

- **Prisma can't find the query engine / OpenSSL error** — `replit.nix` includes
  `openssl`; if you removed it, add `pkgs.openssl` back and reload.
- **`next build` complains about the database** — it shouldn't; all DB access is
  in dynamic routes / client fetches, so the build doesn't need a live DB. Only
  `migrate deploy`, `db:seed`, and runtime need `DATABASE_URL`.
- **Analytics is slow / times out** — that happens only when an enormous number
  of trades is concentrated in a short time span (see the "Performance & scale"
  section in `README.md`). Normal live ingestion spreads data over time and the
  default `24h` window stays fast.
- **Webview blank** — confirm the server is bound to `-H 0.0.0.0` and that
  `[[ports]] localPort = 3000` matches the port you ran on.
