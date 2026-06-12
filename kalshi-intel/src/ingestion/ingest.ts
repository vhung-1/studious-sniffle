import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { kalshi } from "@/lib/kalshi/client";
import type { KalshiTrade } from "@/lib/kalshi/types";

const PAGE_LIMIT = Number(process.env.INGEST_PAGE_LIMIT ?? 1000);
const OVERLAP_SEC = Number(process.env.INGEST_OVERLAP_SEC ?? 120);

export interface IngestResult {
  pages: number;
  fetched: number;
  inserted: number;
  latestCreatedTime: Date | null;
  oldestCreatedTime: Date | null;
  durationMs: number;
}

function toRow(t: KalshiTrade): Prisma.TradeCreateManyInput {
  return {
    tradeId: t.trade_id,
    ticker: t.ticker,
    countFp: new Prisma.Decimal(t.count_fp),
    yesPriceDollars: new Prisma.Decimal(t.yes_price_dollars),
    noPriceDollars: new Prisma.Decimal(t.no_price_dollars),
    createdTime: new Date(t.created_time),
    isBlockTrade: Boolean(t.is_block_trade),
    takerSide: t.taker_side ?? null,
  };
}

/**
 * Run one ingestion pass. Resumes from the last seen trade timestamp (minus a
 * small overlap window) and walks the cursor pages, upserting via
 * createMany+skipDuplicates so re-scanned trades are deduped by trade_id.
 *
 * @param maxPages cap on pages fetched this pass (protects the first run on an
 *                 empty DB from walking the entire history unintentionally).
 */
export async function ingestOnce(
  opts: { maxPages?: number; backfill?: boolean } = {},
): Promise<IngestResult> {
  const started = Date.now();
  const state = await prisma.ingestState.findUnique({ where: { id: 1 } });

  // Incremental mode resumes from the last seen timestamp (with overlap).
  // Backfill mode walks newest -> oldest via the cursor to pull historical
  // trades; it resumes from the OLDEST trade already stored (via max_ts) so it
  // never re-scans the region we already have. Dedup by trade_id PK keeps it
  // idempotent and the forward-only `latest` tracking never regresses state.
  let minTs: number | undefined;
  let maxTs: number | undefined;
  if (opts.backfill) {
    const oldest = await prisma.trade.findFirst({
      orderBy: { createdTime: "asc" },
      select: { createdTime: true },
    });
    // +1s overlap at the boundary; duplicates are skipped on insert.
    if (oldest) maxTs = Math.floor(oldest.createdTime.getTime() / 1000) + 1;
  } else if (state?.lastCreatedTime) {
    minTs = Math.floor(state.lastCreatedTime.getTime() / 1000) - OVERLAP_SEC;
  }

  let pages = 0;
  let fetched = 0;
  let inserted = 0;
  let latest: Date | null = state?.lastCreatedTime ?? null;
  let oldest: Date | null = null;

  for await (const trades of kalshi.iterateTrades(
    { minTs, maxTs, limit: PAGE_LIMIT },
    { maxPages: opts.maxPages },
  )) {
    pages += 1;
    fetched += trades.length;

    const rows = trades.map(toRow);
    const res = await prisma.trade.createMany({ data: rows, skipDuplicates: true });
    inserted += res.count;

    for (const t of trades) {
      const ct = new Date(t.created_time);
      if (!latest || ct > latest) latest = ct;
      if (!oldest || ct < oldest) oldest = ct;
    }
  }

  await prisma.ingestState.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      lastCreatedTime: latest,
      totalIngested: BigInt(inserted),
    },
    update: {
      lastCreatedTime: latest ?? undefined,
      totalIngested: { increment: BigInt(inserted) },
    },
  });

  return {
    pages,
    fetched,
    inserted,
    latestCreatedTime: latest,
    oldestCreatedTime: oldest,
    durationMs: Date.now() - started,
  };
}

/**
 * Continuously ingest trades. Each cycle catches up from the last timestamp,
 * then sleeps for `intervalMs`. Errors are logged and retried next cycle so a
 * transient API blip never kills the daemon.
 */
export async function runContinuous(opts: {
  intervalMs?: number;
  maxPagesPerCycle?: number;
  signal?: AbortSignal;
} = {}): Promise<void> {
  const interval = opts.intervalMs ?? Number(process.env.INGEST_INTERVAL_MS ?? 10_000);
  const maxPages = opts.maxPagesPerCycle ?? 50;

  // eslint-disable-next-line no-console
  console.log(`[ingest] continuous mode — interval ${interval}ms, up to ${maxPages} pages/cycle`);

  while (!opts.signal?.aborted) {
    try {
      const r = await ingestOnce({ maxPages });
      // eslint-disable-next-line no-console
      console.log(
        `[ingest] +${r.inserted} new of ${r.fetched} fetched across ${r.pages} pages` +
          ` (${r.durationMs}ms), latest ${r.latestCreatedTime?.toISOString() ?? "—"}`,
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[ingest] cycle failed, will retry:", err);
    }
    await new Promise((r) => setTimeout(r, interval));
  }
}
