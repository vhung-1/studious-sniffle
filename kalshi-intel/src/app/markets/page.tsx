"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ErrorState, RefreshDot, TableSkeleton } from "@/components/state";
import { usePoll } from "@/hooks/use-poll";
import { formatCompact, formatDollars, formatNumber, formatPrice, formatTime } from "@/lib/utils";
import type { MarketsResponse, MarketSummary } from "@/lib/types";

type Sort = "volume" | "dollar" | "trades" | "recent";

export default function MarketsPage() {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("volume");

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    if (search) sp.set("search", search);
    sp.set("sort", sort);
    sp.set("limit", "100");
    return sp.toString();
  }, [search, sort]);

  const { data, error, loading, refreshing } = usePoll<MarketsResponse>(`/api/markets?${query}`);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Market Discovery</h1>
          <p className="text-sm text-muted-foreground">
            {data ? `${formatNumber(data.total)} markets with trade activity` : "Browse markets by activity"}
          </p>
        </div>
        <RefreshDot refreshing={refreshing} />
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search ticker…"
          className="max-w-xs uppercase"
        />
        <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort by">
          <option value="volume">Sort: Contract volume</option>
          <option value="dollar">Sort: Dollar volume</option>
          <option value="trades">Sort: Trade count</option>
          <option value="recent">Sort: Most recent</option>
        </Select>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Markets</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {error && !data ? (
            <ErrorState message={error} />
          ) : loading ? (
            <TableSkeleton rows={10} />
          ) : (
            <MarketsTable markets={data?.markets ?? []} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MarketsTable({ markets }: { markets: MarketSummary[] }) {
  if (markets.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No markets match.</p>;
  }
  return (
    <Table className="tabular">
      <TableHeader>
        <TableRow>
          <TableHead>Ticker</TableHead>
          <TableHead className="text-right">Last</TableHead>
          <TableHead className="text-right">Contracts</TableHead>
          <TableHead className="text-right">Dollar Vol</TableHead>
          <TableHead className="text-right">Trades</TableHead>
          <TableHead className="text-right">Block</TableHead>
          <TableHead className="text-right">Last Trade</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {markets.map((m) => (
          <TableRow key={m.ticker}>
            <TableCell className="font-medium">
              <Link href={`/markets/${encodeURIComponent(m.ticker)}`} className="hover:text-primary hover:underline">
                {m.ticker}
              </Link>
            </TableCell>
            <TableCell className="text-right">{formatPrice(m.lastPrice)}</TableCell>
            <TableCell className="text-right">{formatCompact(m.contracts)}</TableCell>
            <TableCell className="text-right">{formatDollars(m.dollarVolume)}</TableCell>
            <TableCell className="text-right">{formatNumber(m.trades)}</TableCell>
            <TableCell className="text-right">
              {m.blockContracts > 0 ? <Badge variant="block">{formatCompact(m.blockContracts)}</Badge> : <span className="text-muted-foreground">—</span>}
            </TableCell>
            <TableCell className="text-right text-muted-foreground">
              {m.lastTrade ? formatTime(m.lastTrade) : "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
