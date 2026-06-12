"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnalyticsCards } from "@/components/analytics-cards";
import { DEFAULT_FILTERS, Filters, filtersToTradesQuery, type DashboardFilters } from "@/components/filters";
import { TradeTape } from "@/components/trade-tape";
import { TopLists } from "@/components/top-lists";
import { VolumeChart } from "@/components/volume-chart";
import { ErrorState, RefreshDot } from "@/components/state";
import { Skeleton } from "@/components/ui/skeleton";
import { usePoll } from "@/hooks/use-poll";
import type { AnalyticsResponse } from "@/lib/types";

export default function DashboardPage() {
  const [filters, setFilters] = useState<DashboardFilters>(DEFAULT_FILTERS);

  // Analytics keys off ticker + range (not block/min-size, which scope the tape).
  const analyticsQuery = useMemo(() => {
    const sp = new URLSearchParams();
    if (filters.ticker) sp.set("ticker", filters.ticker);
    sp.set("range", filters.range);
    sp.set("granularity", filters.range === "all" || filters.range === "30d" ? "day" : "hour");
    return sp.toString();
  }, [filters.ticker, filters.range]);

  const tradesQuery = useMemo(() => filtersToTradesQuery(filters), [filters]);

  const { data, error, loading, refreshing } = usePoll<AnalyticsResponse>(`/api/analytics?${analyticsQuery}`);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Market Activity</h1>
          <p className="text-sm text-muted-foreground">Kalshi trade flow, volume &amp; block-trade intelligence</p>
        </div>
        <RefreshDot refreshing={refreshing} />
      </div>

      <Filters value={filters} onChange={setFilters} />

      {error && !data ? <ErrorState message={error} /> : <AnalyticsCards data={data?.overview ?? null} loading={loading} />}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              Volume by {data?.granularity === "day" ? "Day" : "Hour"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-[260px] w-full" /> : <VolumeChart data={data?.volumeSeries ?? []} granularity={data?.granularity ?? "hour"} />}
          </CardContent>
        </Card>
        <div className="lg:col-span-1">
          <TradeTape query={tradesQuery} />
        </div>
      </div>

      {data && (
        <TopLists
          topVolume={data.topVolumeMarkets}
          mostActive={data.mostActiveTickers}
          topBlock={data.topBlockTradeMarkets}
          largest={data.largestTrades}
        />
      )}
    </div>
  );
}
