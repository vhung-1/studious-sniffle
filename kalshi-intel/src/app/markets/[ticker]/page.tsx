"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PriceChart } from "@/components/price-chart";
import { VolumeChart } from "@/components/volume-chart";
import { TradesTable } from "@/components/trades-table";
import { ErrorState, RefreshDot, TableSkeleton } from "@/components/state";
import { Skeleton } from "@/components/ui/skeleton";
import { usePoll } from "@/hooks/use-poll";
import { cn, formatCompact, formatDollars, formatNumber, formatPrice, formatTime } from "@/lib/utils";
import type { MarketDetailResponse } from "@/lib/types";

export default function MarketDetailPage({ params }: { params: { ticker: string } }) {
  const ticker = decodeURIComponent(params.ticker).toUpperCase();
  const { data, error, loading, refreshing } = usePoll<MarketDetailResponse>(
    `/api/markets/${encodeURIComponent(ticker)}`,
  );

  const s = data?.summary;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/markets"
            aria-label="Back to markets"
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="font-mono text-lg font-semibold">{ticker}</h1>
            <p className="text-sm text-muted-foreground">
              {s ? `${formatNumber(s.trades)} trades · ${formatCompact(s.contracts)} contracts` : "Market detail"}
            </p>
          </div>
        </div>
        <RefreshDot refreshing={refreshing} />
      </div>

      {error && !data ? (
        <ErrorState message={error} />
      ) : loading ? (
        <div className="grid gap-4">
          <Skeleton className="h-[88px] w-full" />
          <Skeleton className="h-[300px] w-full" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Metric label="Last Yes Price" value={formatPrice(s?.lastPrice ?? null)} />
            <Metric label="Contracts" value={formatCompact(s?.contracts ?? 0)} />
            <Metric label="Dollar Volume" value={formatDollars(s?.dollarVolume ?? 0)} />
            <Metric label="Block Contracts" value={formatCompact(s?.blockContracts ?? 0)} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Price History (avg yes)</CardTitle></CardHeader>
              <CardContent><PriceChart data={data?.priceHistory ?? []} granularity="hour" /></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Volume History</CardTitle></CardHeader>
              <CardContent>
                <VolumeChart
                  data={(data?.volumeHistory ?? []).map((v) => ({ ...v, trades: 0 }))}
                  granularity="hour"
                />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Recent Trades</CardTitle></CardHeader>
              <CardContent className="pt-0">
                <div className="max-h-[420px] overflow-auto">
                  <TradesTable trades={data?.recentTrades ?? []} showTicker={false} />
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Largest Trades</CardTitle></CardHeader>
                <CardContent className="pt-0">
                  {(data?.largestTrades.length ?? 0) === 0 ? (
                    <p className="py-4 text-center text-xs text-muted-foreground">No trades.</p>
                  ) : (
                    <Table className="tabular">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Time</TableHead>
                          <TableHead className="text-right">Contracts</TableHead>
                          <TableHead className="text-right">Value</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data!.largestTrades.map((t) => (
                          <TableRow key={t.tradeId}>
                            <TableCell className="text-muted-foreground">{formatTime(t.createdTime)}</TableCell>
                            <TableCell className="text-right">
                              {formatCompact(t.count)} {t.isBlockTrade && <Badge variant="block">block</Badge>}
                            </TableCell>
                            <TableCell className="text-right">{formatDollars(t.dollarValue)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Block Trade Activity</CardTitle></CardHeader>
                <CardContent className="pt-0">
                  {(data?.blockTrades.length ?? 0) === 0 ? (
                    <p className="py-4 text-center text-xs text-muted-foreground">No block trades.</p>
                  ) : (
                    <div className="max-h-[260px] space-y-1 overflow-auto">
                      {data!.blockTrades.map((t) => (
                        <div key={t.tradeId} className="flex items-center justify-between rounded px-2 py-1 text-sm">
                          <span className="text-muted-foreground">{formatTime(t.createdTime)}</span>
                          <span className="tabular">{formatCompact(t.count)} @ {formatPrice(t.yesPrice)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-xl font-semibold tabular">{value}</p>
      </CardContent>
    </Card>
  );
}
