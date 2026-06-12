import { NextResponse } from "next/server";
import { listTrades, type TradeFilters } from "@/services/trades";
import { bool, num, parseRange } from "@/lib/params";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const { from, to } = parseRange(sp);
    const filters: TradeFilters = {
      ticker: sp.get("ticker") ?? undefined,
      from,
      to,
      blockOnly: bool(sp.get("blockOnly")),
      minSize: num(sp.get("minSize")),
      limit: num(sp.get("limit"), 50),
      offset: num(sp.get("offset"), 0),
      sort: (sp.get("sort") as TradeFilters["sort"]) ?? "time",
      order: (sp.get("order") as TradeFilters["order"]) ?? "desc",
    };
    const data = await listTrades(filters);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load trades" },
      { status: 500 },
    );
  }
}
