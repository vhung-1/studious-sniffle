import { NextResponse } from "next/server";
import { listMarkets, type MarketSort } from "@/services/markets";
import { num } from "@/lib/params";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const data = await listMarkets({
      search: sp.get("search") ?? undefined,
      sort: (sp.get("sort") as MarketSort) ?? "volume",
      limit: num(sp.get("limit"), 25),
      offset: num(sp.get("offset"), 0),
    });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load markets" },
      { status: 500 },
    );
  }
}
