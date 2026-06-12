"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePoll } from "@/hooks/use-poll";
import { ErrorState, RefreshDot, TableSkeleton } from "@/components/state";
import { TradesTable } from "@/components/trades-table";
import type { TradesResponse } from "@/lib/types";

export function TradeTape({ query }: { query: string }) {
  const { data, error, loading, refreshing } = usePoll<TradesResponse>(
    `/api/trades?${query}&sort=time&order=desc&limit=60`,
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm">
          Live Trade Tape
          {data ? <span className="ml-2 text-xs font-normal text-muted-foreground">{data.total.toLocaleString()} in range</span> : null}
        </CardTitle>
        <RefreshDot refreshing={refreshing} />
      </CardHeader>
      <CardContent className="pt-0">
        {error && !data ? (
          <ErrorState message={error} />
        ) : loading ? (
          <TableSkeleton rows={8} />
        ) : (
          <div className="max-h-[560px] overflow-auto">
            <TradesTable trades={data?.trades ?? []} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
