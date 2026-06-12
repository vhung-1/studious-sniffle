import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});

const plain = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** 1234567 -> "1.23M" */
export function formatCompact(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return compact.format(n);
}

/** 1234567 -> "1,234,567" */
export function formatNumber(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return plain.format(n);
}

/** Dollar volume with compact suffix, e.g. "$1.2M". */
export function formatDollars(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return "$" + compact.format(n);
}

/** A Kalshi price (0–1 dollars) shown as cents, e.g. 0.995 -> "99.5¢". */
export function formatPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return (n * 100).toFixed(1) + "¢";
}

export function formatPct(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(digits) + "%";
}

export function formatTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
