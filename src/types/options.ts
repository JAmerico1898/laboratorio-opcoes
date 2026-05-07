export interface MarketData {
  ticker: string;
  currentPrice: number;
  lastUpdated: string;
  history: { date: string; close: number }[];
}

export interface VolatilityEstimates {
  hv21: number;
  hv63: number;
  hv252: number;
  garch?: number;
}

export type OptionType = "call" | "put";

export interface OptionInputs {
  S: number;
  K: number;
  T: number;
  r: number;
  sigma: number;
  type: OptionType;
}

export interface BSResult {
  price: number;
  d1: number;
  d2: number;
}

export interface Greeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
}
