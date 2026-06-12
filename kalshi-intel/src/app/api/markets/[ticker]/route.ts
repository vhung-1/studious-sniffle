import { NextResponse } from "next/server";
import { getMarket } from "@/services/markets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: { ticker: string } },
) {
  try {
    const ticker = decodeURIComponent(params.ticker).toUpperCase();
    const granularity =
      new URL(req.url).searchParams.get("granularity") === "day" ? "day" : "hour";
    const data = await getMarket(ticker, granularity);
    if (!data.summary) {
      return NextResponse.json({ error: "Market not found", ...data }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load market" },
      { status: 500 },
    );
  }
}
