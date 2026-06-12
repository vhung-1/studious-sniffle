"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useInterval } from "./use-interval";

export interface PollState<T> {
  data: T | null;
  error: string | null;
  loading: boolean; // true only on the very first load
  refreshing: boolean; // true on background refreshes
  lastUpdated: Date | null;
  refresh: () => void;
}

/**
 * Fetch `url` and re-fetch every `intervalMs` (default 10s). Distinguishes the
 * initial load (skeletons) from background refreshes (subtle indicator), and
 * surfaces errors without dropping the last good data.
 */
export function usePoll<T>(url: string | null, intervalMs = 10_000): PollState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const hasData = useRef(false);

  const run = useCallback(async () => {
    if (!url) return;
    if (hasData.current) setRefreshing(true);
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }
      const json = (await res.json()) as T;
      setData(json);
      setError(null);
      setLastUpdated(new Date());
      hasData.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [url]);

  // Reset to loading state when the URL (filters) changes.
  useEffect(() => {
    hasData.current = false;
    setLoading(true);
    run();
  }, [run]);

  useInterval(run, url ? intervalMs : null);

  return { data, error, loading, refreshing, lastUpdated, refresh: run };
}
