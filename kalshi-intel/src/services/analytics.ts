import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export interface AnalyticsFilters {
  from?: Date;
  to?: Date;
  ticker?: string;
}

export interface Overview {
  totalContracts: number;
  dollarVolume: number;
  tradeCount: number;
  activeMarkets: number;
  avgTradeSize: number;
  blockTradeContracts: number;
  blockTradeVolumePct: number;
  largestTradeContracts: number;
}

export interface MarketVolume {
  ticker: string;
  contracts: number;
  dollarVolume: number;
  trades: number;
  blockContracts: number;
  lastTrade: string | null;
}

export interface TimeBucket {
  bucket: string;
  contracts: number;
  dollarVolume: number;
  trades: number;
}

function where(f: AnalyticsFilters, extra?: Prisma.Sql): Prisma.Sql {
  const conds: Prisma.Sql[] = [];
  if (f.from) conds.push(Prisma.sql`created_time >= ${f.from}`);
  if (f.to) conds.push(Prisma.sql`created_time <= ${f.to}`);
  if (f.ticker) conds.push(Prisma.sql`ticker ILIKE ${"%" + f.ticker.toUpperCase() + "%"}`);
  if (extra) conds.push(extra);
  return conds.length ? Prisma.sql`WHERE ${Prisma.join(conds, " AND ")}` : Prisma.empty;
}

export async function getOverview(f: AnalyticsFilters = {}): Promise<Overview> {
  const rows = await prisma.$queryRaw<
    {
      contracts: number;
      dollar_volume: number;
      trade_count: number;
      active_markets: number;
      avg_trade_size: number;
      block_contracts: number;
      largest_trade: number;
    }[]
  >(Prisma.sql`
    SELECT
      COALESCE(SUM(count_fp), 0)::float8                                   AS contracts,
      COALESCE(SUM(count_fp * yes_price_dollars), 0)::float8               AS dollar_volume,
      COUNT(*)::int                                                        AS trade_count,
      COUNT(DISTINCT ticker)::int                                          AS active_markets,
      COALESCE(AVG(count_fp), 0)::float8                                   AS avg_trade_size,
      COALESCE(SUM(count_fp) FILTER (WHERE is_block_trade), 0)::float8     AS block_contracts,
      COALESCE(MAX(count_fp), 0)::float8                                   AS largest_trade
    FROM trades
    ${where(f)}
  `);

  const r = rows[0];
  return {
    totalContracts: r.contracts,
    dollarVolume: r.dollar_volume,
    tradeCount: r.trade_count,
    activeMarkets: r.active_markets,
    avgTradeSize: r.avg_trade_size,
    blockTradeContracts: r.block_contracts,
    blockTradeVolumePct: r.contracts > 0 ? (r.block_contracts / r.contracts) * 100 : 0,
    largestTradeContracts: r.largest_trade,
  };
}

interface MarketRow {
  ticker: string;
  contracts: number;
  dollar_volume: number;
  trades: number;
  block_contracts: number;
  last_trade: Date | null;
}

function mapMarket(r: MarketRow): MarketVolume {
  return {
    ticker: r.ticker,
    contracts: r.contracts,
    dollarVolume: r.dollar_volume,
    trades: r.trades,
    blockContracts: r.block_contracts,
    lastTrade: r.last_trade ? r.last_trade.toISOString() : null,
  };
}

async function marketsBy(
  f: AnalyticsFilters,
  orderBy: Prisma.Sql,
  limit: number,
  extra?: Prisma.Sql,
): Promise<MarketVolume[]> {
  const rows = await prisma.$queryRaw<MarketRow[]>(Prisma.sql`
    SELECT
      ticker,
      SUM(count_fp)::float8                                            AS contracts,
      SUM(count_fp * yes_price_dollars)::float8                        AS dollar_volume,
      COUNT(*)::int                                                    AS trades,
      COALESCE(SUM(count_fp) FILTER (WHERE is_block_trade), 0)::float8 AS block_contracts,
      MAX(created_time)                                                AS last_trade
    FROM trades
    ${where(f, extra)}
    GROUP BY ticker
    ORDER BY ${orderBy}
    LIMIT ${limit}
  `);
  return rows.map(mapMarket);
}

export const topVolumeMarkets = (f: AnalyticsFilters = {}, limit = 10) =>
  marketsBy(f, Prisma.sql`contracts DESC`, limit);

export const mostActiveTickers = (f: AnalyticsFilters = {}, limit = 10) =>
  marketsBy(f, Prisma.sql`trades DESC`, limit);

export const topBlockTradeMarkets = (f: AnalyticsFilters = {}, limit = 10) =>
  marketsBy(f, Prisma.sql`block_contracts DESC`, limit, Prisma.sql`is_block_trade = true`);

export async function largestTrades(f: AnalyticsFilters = {}, limit = 10) {
  const rows = await prisma.trade.findMany({
    where: {
      ...(f.ticker ? { ticker: { contains: f.ticker.toUpperCase(), mode: "insensitive" } } : {}),
      ...(f.from || f.to
        ? { createdTime: { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lte: f.to } : {}) } }
        : {}),
    },
    orderBy: { countFp: "desc" },
    take: Math.min(Math.max(limit, 1), 100),
  });
  return rows.map((t) => {
    const count = t.countFp.toNumber();
    const yesPrice = t.yesPriceDollars.toNumber();
    return {
      tradeId: t.tradeId,
      ticker: t.ticker,
      count,
      yesPrice,
      dollarValue: count * yesPrice,
      createdTime: t.createdTime.toISOString(),
      isBlockTrade: t.isBlockTrade,
    };
  });
}

/** Volume bucketed by hour or day for the activity charts. */
export async function volumeOverTime(
  f: AnalyticsFilters = {},
  granularity: "hour" | "day" = "hour",
): Promise<TimeBucket[]> {
  const trunc = granularity === "day" ? "day" : "hour";
  const rows = await prisma.$queryRaw<
    { bucket: Date; contracts: number; dollar_volume: number; trades: number }[]
  >(Prisma.sql`
    SELECT
      date_trunc(${trunc}, created_time)        AS bucket,
      SUM(count_fp)::float8                      AS contracts,
      SUM(count_fp * yes_price_dollars)::float8  AS dollar_volume,
      COUNT(*)::int                              AS trades
    FROM trades
    ${where(f)}
    GROUP BY 1
    ORDER BY 1 ASC
  `);
  return rows.map((r) => ({
    bucket: r.bucket.toISOString(),
    contracts: r.contracts,
    dollarVolume: r.dollar_volume,
    trades: r.trades,
  }));
}
