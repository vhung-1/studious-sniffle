"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCompact, formatNumber, formatPrice } from "@/lib/utils";
import type { LargeTrade, MarketVolume } from "@/lib/types";

function MarketList({
  title,
  markets,
  metric,
}: {
  title: string;
  markets: MarketVolume[];
  metric: (m: MarketVolume) => string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {markets.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">No data.</p>}
        {markets.map((m, i) => (
          <Link
            key={m.ticker}
            href={`/markets/${encodeURIComponent(m.ticker)}`}
            className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent"
          >
            <span className="flex items-center gap-2 truncate">
              <span className="w-4 text-right text-xs text-muted-foreground">{i + 1}</span>
              <span className="truncate font-medium">{m.ticker}</span>
            </span>
            <span className="tabular text-muted-foreground">{metric(m)}</span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

export function TopLists({
  topVolume,
  mostActive,
  topBlock,
  largest,
}: {
  topVolume: MarketVolume[];
  mostActive: MarketVolume[];
  topBlock: MarketVolume[];
  largest: LargeTrade[];
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <MarketList title="Top Volume Markets" markets={topVolume} metric={(m) => formatCompact(m.contracts)} />
      <MarketList title="Most Active Tickers" markets={mostActive} metric={(m) => `${formatNumber(m.trades)} trades`} />
      <MarketList title="Top Block-Trade Markets" markets={topBlock} metric={(m) => formatCompact(m.blockContracts)} />
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Largest Trades</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {largest.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">No data.</p>}
          {largest.map((t) => (
            <Link
              key={t.tradeId}
              href={`/markets/${encodeURIComponent(t.ticker)}`}
              className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate font-medium">{t.ticker}</span>
                {t.isBlockTrade && <Badge variant="block">block</Badge>}
              </span>
              <span className="tabular text-muted-foreground">
                {formatCompact(t.count)} @ {formatPrice(t.yesPrice)}
              </span>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
