// Shapes returned by the Kalshi public trade API.
// See https://docs.kalshi.com/api-reference/market/get-trades

export interface KalshiTrade {
  trade_id: string;
  ticker: string;
  count_fp: string; // contracts traded, fixed-point decimal string e.g. "8.00"
  yes_price_dollars: string; // e.g. "0.9950"
  no_price_dollars: string; // e.g. "0.0050"
  created_time: string; // ISO-8601
  is_block_trade: boolean;
  taker_side?: "yes" | "no" | string;
  taker_book_side?: string;
  taker_outcome_side?: string;
}

export interface GetTradesResponse {
  trades: KalshiTrade[];
  cursor?: string;
}

export interface GetTradesParams {
  ticker?: string;
  limit?: number; // max 1000
  cursor?: string;
  /** Unix seconds — only trades at or after this time. */
  minTs?: number;
  /** Unix seconds — only trades at or before this time. */
  maxTs?: number;
}
