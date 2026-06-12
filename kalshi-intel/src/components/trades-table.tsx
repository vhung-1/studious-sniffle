"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn, formatNumber, formatPrice, formatTime, formatDollars } from "@/lib/utils";
import type { Trade } from "@/lib/types";

/** Presentational trades table. Flashes rows that are new since last render. */
export function TradesTable({
  trades,
  showTicker = true,
}: {
  trades: Trade[];
  showTicker?: boolean;
}) {
  const seen = useRef<Set<string>>(new Set());
  const isFirst = useRef(true);

  // Track which ids we've already shown so only genuinely-new rows flash.
  const flashing = new Set<string>();
  for (const t of trades) {
    if (!seen.current.has(t.tradeId) && !isFirst.current) flashing.add(t.tradeId);
  }
  useEffect(() => {
    for (const t of trades) seen.current.add(t.tradeId);
    isFirst.current = false;
    // bound memory
    if (seen.current.size > 5000) seen.current = new Set(trades.map((t) => t.tradeId));
  });

  if (trades.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No trades match these filters.</p>;
  }

  return (
    <Table className="tabular">
      <TableHeader>
        <TableRow>
          <TableHead className="w-[88px]">Time</TableHead>
          {showTicker && <TableHead>Ticker</TableHead>}
          <TableHead className="text-right">Contracts</TableHead>
          <TableHead className="text-right">Yes</TableHead>
          <TableHead className="text-right">No</TableHead>
          <TableHead className="text-right">Value</TableHead>
          <TableHead className="text-right">Type</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {trades.map((t) => (
          <TableRow key={t.tradeId} className={cn(flashing.has(t.tradeId) && "animate-flash")}>
            <TableCell className="text-muted-foreground">{formatTime(t.createdTime)}</TableCell>
            {showTicker && (
              <TableCell className="font-medium">
                <Link href={`/markets/${encodeURIComponent(t.ticker)}`} className="hover:text-primary hover:underline">
                  {t.ticker}
                </Link>
              </TableCell>
            )}
            <TableCell className="text-right">{formatNumber(t.count)}</TableCell>
            <TableCell className="text-right text-bull">{formatPrice(t.yesPrice)}</TableCell>
            <TableCell className="text-right text-bear">{formatPrice(t.noPrice)}</TableCell>
            <TableCell className="text-right">{formatDollars(t.dollarValue)}</TableCell>
            <TableCell className="text-right">
              {t.isBlockTrade ? (
                <Badge variant="block">block</Badge>
              ) : (
                <span className="text-xs text-muted-foreground">{t.takerSide ?? "—"}</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
