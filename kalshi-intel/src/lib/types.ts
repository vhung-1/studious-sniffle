// Plain DTO shapes shared by client components (kept free of server imports so
// Prisma never leaks into the client bundle). These mirror the API responses.

export interface Trade {
  tradeId: string;
  ticker: string;
  count: number;
  yesPrice: number;
  noPrice: number;
  dollarValue: number;
  createdTime: string;
  isBlockTrade: boolean;
  takerSide: string | null;
}

export interface TradesResponse {
  trades: Trade[];
  total: number;
}

export interface MarketSummary {
  ticker: string;
  contracts: number;
  dollarVolume: number;
  trades: number;
  blockContracts: number;
  lastPrice: number | null;
  lastTrade: string | null;
}

export interface MarketsResponse {
  markets: MarketSummary[];
  total: number;
}

export interface Overview {
  totalContracts: number;
  dollarVolume: number;
  tradeCount: number;
  activeMarkets: number;
  avgTradeSize: number;
  blockTradeContracts: number;
  blockTradeVolumePct: number;
  largestTradeContracts: number;
}

export interface MarketVolume {
  ticker: string;
  contracts: number;
  dollarVolume: number;
  trades: number;
  blockContracts: number;
  lastTrade: string | null;
}

export interface LargeTrade {
  tradeId: string;
  ticker: string;
  count: number;
  yesPrice: number;
  dollarValue: number;
  createdTime: string;
  isBlockTrade: boolean;
}

export interface TimeBucket {
  bucket: string;
  contracts: number;
  dollarVolume: number;
  trades: number;
}

export interface AnalyticsResponse {
  overview: Overview;
  topVolumeMarkets: MarketVolume[];
  mostActiveTickers: MarketVolume[];
  topBlockTradeMarkets: MarketVolume[];
  largestTrades: LargeTrade[];
  volumeSeries: TimeBucket[];
  granularity: "hour" | "day";
}

export interface MarketDetailResponse {
  ticker: string;
  summary: MarketSummary | null;
  priceHistory: { bucket: string; price: number; contracts: number }[];
  volumeHistory: { bucket: string; contracts: number; dollarVolume: number }[];
  recentTrades: Trade[];
  largestTrades: LargeTrade[];
  blockTrades: { tradeId: string; count: number; yesPrice: number; dollarValue: number; createdTime: string }[];
  error?: string;
}
