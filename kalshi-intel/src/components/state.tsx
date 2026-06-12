import { AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-1">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </div>
  );
}

export function RefreshDot({ refreshing }: { refreshing: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        className={`h-2 w-2 rounded-full ${refreshing ? "bg-amber-500" : "bg-bull"} ${
          refreshing ? "animate-pulse" : ""
        }`}
      />
      {refreshing ? "updating" : "live"}
    </span>
  );
}
