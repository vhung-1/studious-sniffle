/**
 * Ingestion CLI.
 *
 *   tsx src/ingestion/run.ts                      # continuous daemon (default)
 *   tsx src/ingestion/run.ts --once               # single catch-up pass, then exit
 *   tsx src/ingestion/run.ts --once --max-pages=20
 *   tsx src/ingestion/run.ts --backfill --max-pages=500   # walk history newest->oldest
 *   tsx src/ingestion/run.ts --interval=5000
 */
import { ingestOnce, runContinuous } from "./ingest";
import { prisma } from "@/lib/db/prisma";

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.split("=")[1];
}
const has = (name: string) => process.argv.includes(`--${name}`);

async function main() {
  const maxPages = arg("max-pages") ? Number(arg("max-pages")) : undefined;

  if (has("backfill")) {
    const r = await ingestOnce({ backfill: true, maxPages: maxPages ?? 500 });
    // eslint-disable-next-line no-console
    console.log("[ingest] backfill done:", r);
    await prisma.$disconnect();
    return;
  }

  if (has("once")) {
    const r = await ingestOnce({ maxPages: maxPages ?? 50 });
    // eslint-disable-next-line no-console
    console.log("[ingest] done:", r);
    await prisma.$disconnect();
    return;
  }

  const controller = new AbortController();
  const stop = () => controller.abort();
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  await runContinuous({
    intervalMs: arg("interval") ? Number(arg("interval")) : undefined,
    maxPagesPerCycle: maxPages,
    signal: controller.signal,
  });
  await prisma.$disconnect();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
