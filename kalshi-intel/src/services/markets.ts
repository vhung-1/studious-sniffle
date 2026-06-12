import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { recentTrades as recentForTicker } from "./trades";

export interface MarketSummary {
  ticker: string;
  contracts: number;
  dollarVolume: number;
  trades: number;
  blockContracts: number;
  lastPrice: number | null;
  lastTrade: string | null;
}

export type MarketSort = "volume" | "dollar" | "trades" | "recent";

interface MarketRow {
  ticker: string;
  contracts: number;
  dollar_volume: number;
  trades: number;
  block_contracts: number;
  last_price: number | null;
  last_trade: Date | null;
}

const ORDER: Record<MarketSort, Prisma.Sql> = {
  volume: Prisma.sql`contracts DESC`,
  dollar: Prisma.sql`dollar_volume DESC`,
  trades: Prisma.sql`trades DESC`,
  recent: Prisma.sql`last_trade DESC`,
};

function mapRow(r: MarketRow): MarketSummary {
  return {
    ticker: r.ticker,
    contracts: r.contracts,
    dollarVolume: r.dollar_volume,
    trades: r.trades,
    blockContracts: r.block_contracts,
    lastPrice: r.last_price,
    lastTrade: r.last_trade ? r.last_trade.toISOString() : null,
  };
}

/** Market discovery list with search, sort and pagination. */
export async function listMarkets(opts: {
  search?: string;
  sort?: MarketSort;
  limit?: number;
  offset?: number;
}): Promise<{ markets: MarketSummary[]; total: number }> {
  const limit = Math.min(Math.max(opts.limit ?? 25, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);
  const order = ORDER[opts.sort ?? "volume"];
  const filter = opts.search
    ? Prisma.sql`WHERE ticker ILIKE ${"%" + opts.search.toUpperCase() + "%"}`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<MarketRow[]>(Prisma.sql`
    SELECT
      ticker,
      SUM(count_fp)::float8                                            AS contracts,
      SUM(count_fp * yes_price_dollars)::float8                        AS dollar_volume,
      COUNT(*)::int                                                    AS trades,
      COALESCE(SUM(count_fp) FILTER (WHERE is_block_trade), 0)::float8 AS block_contracts,
      (ARRAY_AGG(yes_price_dollars ORDER BY created_time DESC))[1]::float8 AS last_price,
      MAX(created_time)                                               AS last_trade
    FROM trades
    ${filter}
    GROUP BY ticker
    ORDER BY ${order}
    LIMIT ${limit} OFFSET ${offset}
  `);

  const totalRows = await prisma.$queryRaw<{ n: number }[]>(Prisma.sql`
    SELECT COUNT(DISTINCT ticker)::int AS n FROM trades ${filter}
  `);

  return { markets: rows.map(mapRow), total: totalRows[0]?.n ?? 0 };
}

export interface MarketDetail {
  ticker: string;
  summary: MarketSummary | null;
  priceHistory: { bucket: string; price: number; contracts: number }[];
  volumeHistory: { bucket: string; contracts: number; dollarVolume: number }[];
  recentTrades: Awaited<ReturnType<typeof recentForTicker>>;
  largestTrades: { tradeId: string; count: number; yesPrice: number; dollarValue: number; createdTime: string; isBlockTrade: boolean }[];
  blockTrades: { tradeId: string; count: number; yesPrice: number; dollarValue: number; createdTime: string }[];
}

export async function getMarket(
  ticker: string,
  granularity: "hour" | "day" = "hour",
): Promise<MarketDetail> {
  const trunc = granularity === "day" ? "day" : "hour";

  const [summaryRows, history, recent, largest, blocks] = await Promise.all([
    prisma.$queryRaw<MarketRow[]>(Prisma.sql`
      SELECT
        ticker,
        SUM(count_fp)::float8                                            AS contracts,
        SUM(count_fp * yes_price_dollars)::float8                        AS dollar_volume,
        COUNT(*)::int                                                    AS trades,
        COALESCE(SUM(count_fp) FILTER (WHERE is_block_trade), 0)::float8 AS block_contracts,
        (ARRAY_AGG(yes_price_dollars ORDER BY created_time DESC))[1]::float8 AS last_price,
        MAX(created_time)                                               AS last_trade
      FROM trades
      WHERE ticker = ${ticker}
      GROUP BY ticker
    `),
    // Volume-weighted average yes-price + contract volume per time bucket.
    prisma.$queryRaw<{ bucket: Date; price: number; contracts: number; dollar_volume: number }[]>(Prisma.sql`
      SELECT
        date_trunc(${trunc}, created_time)                       AS bucket,
        (SUM(count_fp * yes_price_dollars) / NULLIF(SUM(count_fp), 0))::float8 AS price,
        SUM(count_fp)::float8                                     AS contracts,
        SUM(count_fp * yes_price_dollars)::float8                 AS dollar_volume
      FROM trades
      WHERE ticker = ${ticker}
      GROUP BY 1
      ORDER BY 1 ASC
    `),
    prisma.trade.findMany({
      where: { ticker },
      orderBy: { createdTime: "desc" },
      take: 50,
    }),
    prisma.trade.findMany({
      where: { ticker },
      orderBy: { countFp: "desc" },
      take: 10,
    }),
    prisma.trade.findMany({
      where: { ticker, isBlockTrade: true },
      orderBy: { createdTime: "desc" },
      take: 25,
    }),
  ]);

  const toTrade = (t: (typeof recent)[number]) => {
    const count = t.countFp.toNumber();
    const yesPrice = t.yesPriceDollars.toNumber();
    return {
      tradeId: t.tradeId,
      ticker: t.ticker,
      count,
      yesPrice,
      noPrice: t.noPriceDollars.toNumber(),
      dollarValue: count * yesPrice,
      createdTime: t.createdTime.toISOString(),
      isBlockTrade: t.isBlockTrade,
      takerSide: t.takerSide,
    };
  };

  return {
    ticker,
    summary: summaryRows[0] ? mapRow(summaryRows[0]) : null,
    priceHistory: history.map((h) => ({
      bucket: h.bucket.toISOString(),
      price: h.price,
      contracts: h.contracts,
    })),
    volumeHistory: history.map((h) => ({
      bucket: h.bucket.toISOString(),
      contracts: h.contracts,
      dollarVolume: h.dollar_volume,
    })),
    recentTrades: recent.map(toTrade),
    largestTrades: largest.map((t) => {
      const count = t.countFp.toNumber();
      const yesPrice = t.yesPriceDollars.toNumber();
      return {
        tradeId: t.tradeId,
        count,
        yesPrice,
        dollarValue: count * yesPrice,
        createdTime: t.createdTime.toISOString(),
        isBlockTrade: t.isBlockTrade,
      };
    }),
    blockTrades: blocks.map((t) => {
      const count = t.countFp.toNumber();
      const yesPrice = t.yesPriceDollars.toNumber();
      return {
        tradeId: t.tradeId,
        count,
        yesPrice,
        dollarValue: count * yesPrice,
        createdTime: t.createdTime.toISOString(),
      };
    }),
  };
}
