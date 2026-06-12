"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export interface DashboardFilters {
  ticker: string;
  range: string;
  blockOnly: boolean;
  minSize: string;
}

export const DEFAULT_FILTERS: DashboardFilters = {
  ticker: "",
  range: "24h",
  blockOnly: false,
  minSize: "",
};

export function Filters({
  value,
  onChange,
}: {
  value: DashboardFilters;
  onChange: (next: DashboardFilters) => void;
}) {
  const set = <K extends keyof DashboardFilters>(key: K, v: DashboardFilters[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
      <div className="relative flex-1 min-w-[180px]">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value.ticker}
          onChange={(e) => set("ticker", e.target.value)}
          placeholder="Search ticker…"
          className="pl-8 uppercase"
        />
      </div>

      <Select value={value.range} onChange={(e) => set("range", e.target.value)} aria-label="Time range">
        <option value="1h">Last hour</option>
        <option value="24h">Last 24h</option>
        <option value="7d">Last 7d</option>
        <option value="30d">Last 30d</option>
        <option value="all">All time</option>
      </Select>

      <Input
        type="number"
        min={0}
        value={value.minSize}
        onChange={(e) => set("minSize", e.target.value)}
        placeholder="Min size"
        className="w-28"
      />

      <label className="flex items-center gap-2 text-sm">
        <Switch checked={value.blockOnly} onCheckedChange={(c) => set("blockOnly", c)} id="block-only" />
        Block only
      </label>
    </div>
  );
}

/** Serialize filters into a query string for the trades API. */
export function filtersToTradesQuery(f: DashboardFilters, extra: Record<string, string> = {}): string {
  const sp = new URLSearchParams();
  if (f.ticker) sp.set("ticker", f.ticker);
  if (f.range) sp.set("range", f.range);
  if (f.blockOnly) sp.set("blockOnly", "1");
  if (f.minSize) sp.set("minSize", f.minSize);
  for (const [k, v] of Object.entries(extra)) sp.set(k, v);
  return sp.toString();
}
