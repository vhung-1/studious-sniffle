/**
 * Seed the database with a batch of recent Kalshi trades so the dashboard has
 * data immediately. Idempotent — safe to run repeatedly (deduped by trade_id).
 *
 *   npm run db:seed
 *   SEED_PAGES=25 npm run db:seed   # pull more history
 */
import { ingestOnce } from "@/ingestion/ingest";
import { prisma } from "@/lib/db/prisma";

async function main() {
  const pages = Number(process.env.SEED_PAGES ?? 10);
  // eslint-disable-next-line no-console
  console.log(`[seed] pulling up to ${pages} pages of recent trades from Kalshi…`);
  const r = await ingestOnce({ maxPages: pages });
  // eslint-disable-next-line no-console
  console.log(`[seed] inserted ${r.inserted} trades (${r.fetched} fetched across ${r.pages} pages).`);
  const total = await prisma.trade.count();
  // eslint-disable-next-line no-console
  console.log(`[seed] trades table now holds ${total} rows.`);
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
