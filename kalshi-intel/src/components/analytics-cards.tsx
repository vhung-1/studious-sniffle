"use client";

import { Activity, BarChart3, DollarSign, Hash, Layers, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCompact, formatDollars, formatNumber, formatPct } from "@/lib/utils";
import type { Overview } from "@/lib/types";

const ICONS = { Activity, BarChart3, DollarSign, Hash, Layers, TrendingUp };

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: keyof typeof ICONS;
}) {
  const Cmp = ICONS[Icon];
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular">{value}</p>
        </div>
        <Cmp className="h-5 w-5 text-muted-foreground" />
      </CardContent>
    </Card>
  );
}

export function AnalyticsCards({ data, loading }: { data: Overview | null; loading: boolean }) {
  if (loading || !data) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[88px] w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <Stat label="Contracts" value={formatCompact(data.totalContracts)} icon="BarChart3" />
      <Stat label="Dollar Volume" value={formatDollars(data.dollarVolume)} icon="DollarSign" />
      <Stat label="Trades" value={formatCompact(data.tradeCount)} icon="Hash" />
      <Stat label="Active Markets" value={formatNumber(data.activeMarkets)} icon="Layers" />
      <Stat label="Avg Trade Size" value={formatCompact(data.avgTradeSize)} icon="TrendingUp" />
      <Stat label="Block Vol %" value={formatPct(data.blockTradeVolumePct)} icon="Activity" />
    </div>
  );
}
