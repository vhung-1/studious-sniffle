// Helpers for parsing query params consistently across API routes.

export function num(v: string | null, fallback?: number): number | undefined {
  if (v == null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function bool(v: string | null): boolean {
  return v === "1" || v === "true" || v === "yes";
}

/**
 * Resolve a date window. Accepts an explicit `from`/`to` (ISO) or a `range`
 * shortcut: "1h", "24h", "7d", "30d", "all".
 */
export function parseRange(params: URLSearchParams): { from?: Date; to?: Date } {
  const fromRaw = params.get("from");
  const toRaw = params.get("to");
  if (fromRaw || toRaw) {
    return {
      from: fromRaw ? new Date(fromRaw) : undefined,
      to: toRaw ? new Date(toRaw) : undefined,
    };
  }
  const range = params.get("range");
  if (!range || range === "all") return {};
  const m = range.match(/^(\d+)([hd])$/);
  if (!m) return {};
  const n = Number(m[1]);
  const ms = m[2] === "h" ? n * 3_600_000 : n * 86_400_000;
  return { from: new Date(Date.now() - ms) };
}
