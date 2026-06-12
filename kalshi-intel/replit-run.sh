#!/usr/bin/env bash
# Replit bootstrap for the Kalshi Intel dashboard.
# Idempotent: safe to run on every click of the Run button.
set -euo pipefail
cd "$(dirname "$0")"

echo "▶ Kalshi Intel — Replit bootstrap"

# 1. A PostgreSQL database must be attached. Replit injects DATABASE_URL when you
#    create one from the Database tool in the left sidebar.
if [ -z "${DATABASE_URL:-}" ]; then
  echo ""
  echo "✗ DATABASE_URL is not set."
  echo "  Open the 'Database' tool in the left sidebar, click 'Create a database'"
  echo "  (PostgreSQL), then press Run again. Replit will inject DATABASE_URL for you."
  echo ""
  exit 1
fi

# 2. Dependencies + Prisma client.
[ -d node_modules ] || npm install
npx prisma generate

# 3. Apply the schema (creates tables/indexes; no-op if already applied).
npx prisma migrate deploy

# 4. Seed a batch of recent trades the first time, so the dashboard isn't empty.
COUNT=$(node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.trade.count().then(c=>{console.log(c)}).catch(()=>console.log(0)).finally(()=>p.\$disconnect())")
if [ "${COUNT:-0}" = "0" ]; then
  echo "▶ Empty database — seeding recent trades from Kalshi…"
  npm run db:seed || echo "  (seed failed; continuing — the ingester will backfill)"
else
  echo "▶ Database already has ${COUNT} trades — skipping seed."
fi

# 5. Keep ingesting live trades in the background so the tape stays fresh.
echo "▶ Starting background ingester (logs: /tmp/ingest.log)"
( npm run ingest >/tmp/ingest.log 2>&1 & )

# 6. Launch the dashboard.
echo "▶ Starting Next.js on 0.0.0.0:3000"
exec npx next dev -H 0.0.0.0 -p 3000
