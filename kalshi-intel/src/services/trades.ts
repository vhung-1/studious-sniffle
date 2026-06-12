import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export interface TradeFilters {
  ticker?: string;
  from?: Date;
  to?: Date;
  blockOnly?: boolean;
  minSize?: number;
  limit?: number;
  offset?: number;
  sort?: "time" | "size" | "price";
  order?: "asc" | "desc";
}

export interface TradeDTO {
  tradeId: string;
  ticker: string;
  count: number;
  yesPrice: number;
  noPrice: number;
  dollarValue: number;
  createdTime: string;
  isBlockTrade: boolean;
  takerSide: string | null;
}

export function buildTradeWhere(f: TradeFilters): Prisma.TradeWhereInput {
  const where: Prisma.TradeWhereInput = {};
  if (f.ticker) where.ticker = { contains: f.ticker.toUpperCase(), mode: "insensitive" };
  if (f.blockOnly) where.isBlockTrade = true;
  if (f.minSize != null) where.countFp = { gte: new Prisma.Decimal(f.minSize) };
  if (f.from || f.to) {
    where.createdTime = {};
    if (f.from) where.createdTime.gte = f.from;
    if (f.to) where.createdTime.lte = f.to;
  }
  return where;
}

function toDTO(t: {
  tradeId: string;
  ticker: string;
  countFp: Prisma.Decimal;
  yesPriceDollars: Prisma.Decimal;
  noPriceDollars: Prisma.Decimal;
  createdTime: Date;
  isBlockTrade: boolean;
  takerSide: string | null;
}): TradeDTO {
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
}

export async function listTrades(f: TradeFilters): Promise<{ trades: TradeDTO[]; total: number }> {
  const where = buildTradeWhere(f);
  const limit = Math.min(Math.max(f.limit ?? 50, 1), 500);
  const offset = Math.max(f.offset ?? 0, 0);

  const sortField =
    f.sort === "size" ? "countFp" : f.sort === "price" ? "yesPriceDollars" : "createdTime";
  const order = f.order ?? "desc";

  const [rows, total] = await Promise.all([
    prisma.trade.findMany({
      where,
      orderBy: { [sortField]: order },
      take: limit,
      skip: offset,
    }),
    prisma.trade.count({ where }),
  ]);

  return { trades: rows.map(toDTO), total };
}

/** Most recent trades for the live tape. */
export async function recentTrades(limit = 50): Promise<TradeDTO[]> {
  const rows = await prisma.trade.findMany({
    orderBy: { createdTime: "desc" },
    take: Math.min(Math.max(limit, 1), 200),
  });
  return rows.map(toDTO);
}
