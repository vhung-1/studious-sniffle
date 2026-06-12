"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCompact, formatDollars } from "@/lib/utils";
import type { TimeBucket } from "@/lib/types";

export function VolumeChart({
  data,
  granularity,
}: {
  data: TimeBucket[];
  granularity: "hour" | "day";
}) {
  if (!data.length) {
    return <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">No volume in range.</div>;
  }

  const fmtX = (iso: string) => {
    const d = new Date(iso);
    return granularity === "day"
      ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : d.toLocaleTimeString("en-US", { hour: "2-digit", hour12: false }) + ":00";
  };

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
        <XAxis dataKey="bucket" tickFormatter={fmtX} tick={{ fontSize: 11 }} minTickGap={24} stroke="hsl(var(--muted-foreground))" />
        <YAxis tickFormatter={(v) => formatCompact(v as number)} tick={{ fontSize: 11 }} width={48} stroke="hsl(var(--muted-foreground))" />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelFormatter={(l) => new Date(l as string).toLocaleString()}
          formatter={(value: number, name) =>
            name === "dollarVolume"
              ? [formatDollars(value), "Dollar Vol"]
              : [formatCompact(value), "Contracts"]
          }
        />
        <Bar dataKey="contracts" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
