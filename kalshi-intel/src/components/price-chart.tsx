"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatPrice } from "@/lib/utils";

export function PriceChart({
  data,
  granularity,
}: {
  data: { bucket: string; price: number }[];
  granularity: "hour" | "day";
}) {
  if (!data.length) {
    return <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">No price history.</div>;
  }

  const fmtX = (iso: string) => {
    const d = new Date(iso);
    return granularity === "day"
      ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : d.toLocaleTimeString("en-US", { hour: "2-digit", hour12: false }) + ":00";
  };

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="price" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
        <XAxis dataKey="bucket" tickFormatter={fmtX} tick={{ fontSize: 11 }} minTickGap={24} stroke="hsl(var(--muted-foreground))" />
        <YAxis
          domain={[0, 1]}
          tickFormatter={(v) => formatPrice(v as number)}
          tick={{ fontSize: 11 }}
          width={48}
          stroke="hsl(var(--muted-foreground))"
        />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelFormatter={(l) => new Date(l as string).toLocaleString()}
          formatter={(value: number) => [formatPrice(value), "Avg Yes"]}
        />
        <Area
          type="monotone"
          dataKey="price"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          fill="url(#price)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
