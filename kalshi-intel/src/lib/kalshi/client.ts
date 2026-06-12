import type { GetTradesParams, GetTradesResponse, KalshiTrade } from "./types";

const BASE =
  process.env.KALSHI_API_BASE ?? "https://api.elections.kalshi.com/trade-api/v2";

const MAX_RETRIES = 5;
const BASE_BACKOFF_MS = 500;

export class KalshiApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "KalshiApiError";
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * GET helper with retry + exponential backoff. Retries on network failures,
 * 429 (rate limit) and 5xx; gives up on other 4xx (caller bug).
 */
async function getJson<T>(path: string, params: Record<string, string | number | undefined>): Promise<T> {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }

  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });

      if (res.ok) return (await res.json()) as T;

      // Non-retryable client errors (except 429) — fail fast.
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        throw new KalshiApiError(
          `Kalshi API ${res.status}: ${await res.text().catch(() => "")}`.slice(0, 300),
          res.status,
        );
      }

      lastErr = new KalshiApiError(`Kalshi API ${res.status}`, res.status);
      // Honor Retry-After when present.
      const retryAfter = Number(res.headers.get("retry-after"));
      const wait = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : BASE_BACKOFF_MS * 2 ** attempt;
      if (attempt < MAX_RETRIES) await sleep(wait + Math.random() * 250);
    } catch (err) {
      if (err instanceof KalshiApiError && err.status && err.status < 500 && err.status !== 429) {
        throw err; // don't retry genuine client errors
      }
      lastErr = err;
      if (attempt < MAX_RETRIES) {
        await sleep(BASE_BACKOFF_MS * 2 ** attempt + Math.random() * 250);
      }
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new KalshiApiError("Kalshi request failed after retries");
}

export const kalshi = {
  /** Fetch a single page of trades. */
  async getTrades(params: GetTradesParams = {}): Promise<GetTradesResponse> {
    return getJson<GetTradesResponse>("/markets/trades", {
      ticker: params.ticker,
      limit: params.limit ?? 1000,
      cursor: params.cursor,
      min_ts: params.minTs,
      max_ts: params.maxTs,
    });
  },

  /**
   * Async generator that walks the cursor pagination, yielding each page of
   * trades until the API stops returning a cursor or an empty page.
   */
  async *iterateTrades(
    params: GetTradesParams = {},
    opts: { maxPages?: number } = {},
  ): AsyncGenerator<KalshiTrade[]> {
    let cursor = params.cursor;
    let pages = 0;
    const maxPages = opts.maxPages ?? Infinity;
    while (pages < maxPages) {
      const page = await this.getTrades({ ...params, cursor });
      if (!page.trades.length) return;
      yield page.trades;
      pages += 1;
      if (!page.cursor || page.cursor === cursor) return;
      cursor = page.cursor;
    }
  },
};
