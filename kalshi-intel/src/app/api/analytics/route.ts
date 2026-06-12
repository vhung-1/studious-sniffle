import { NextResponse } from "next/server";
import {
  getOverview,
  largestTrades,
  mostActiveTickers,
  topBlockTradeMarkets,
  topVolumeMarkets,
  volumeOverTime,
  type AnalyticsFilters,
} from "@/services/analytics";
import { parseRange } from "@/lib/params";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const { from, to } = parseRange(sp);
    const f: AnalyticsFilters = { from, to, ticker: sp.get("ticker") ?? undefined };
    const granularity = sp.get("granularity") === "day" ? "day" : "hour";

    const [overview, topVolume, mostActive, topBlock, largest, volumeSeries] =
      await Promise.all([
        getOverview(f),
        topVolumeMarkets(f, 10),
        mostActiveTickers(f, 10),
        topBlockTradeMarkets(f, 10),
        largestTrades(f, 10),
        volumeOverTime(f, granularity),
      ]);

    return NextResponse.json({
      overview,
      topVolumeMarkets: topVolume,
      mostActiveTickers: mostActive,
      topBlockTradeMarkets: topBlock,
      largestTrades: largest,
      volumeSeries,
      granularity,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load analytics" },
      { status: 500 },
    );
  }
}
