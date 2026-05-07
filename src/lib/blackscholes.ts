import type { BSResult, Greeks, OptionInputs, OptionType } from "@/types/options";
import { normCdf, normPdf } from "./stats";

const TRADING_DAYS = 252;

function computeD(inputs: Pick<OptionInputs, "S" | "K" | "T" | "r" | "sigma">) {
  const { S, K, T, r, sigma } = inputs;
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  return { d1, d2, sqrtT };
}

export function blackScholes(inputs: OptionInputs): BSResult {
  const { S, K, T, r, type } = inputs;
  const { d1, d2 } = computeD(inputs);
  const disc = Math.exp(-r * T);

  let price: number;
  if (type === "call") {
    price = S * normCdf(d1) - K * disc * normCdf(d2);
  } else {
    price = K * disc * normCdf(-d2) - S * normCdf(-d1);
  }
  return { price, d1, d2 };
}

export function greeks(inputs: OptionInputs): Greeks {
  const { S, K, T, r, sigma, type } = inputs;
  const { d1, d2, sqrtT } = computeD(inputs);
  const disc = Math.exp(-r * T);
  const nD1 = normPdf(d1);

  const delta = type === "call" ? normCdf(d1) : normCdf(d1) - 1;
  const gamma = nD1 / (S * sigma * sqrtT);

  const thetaShared = -(S * nD1 * sigma) / (2 * sqrtT);
  const thetaAnnual =
    type === "call"
      ? thetaShared - r * K * disc * normCdf(d2)
      : thetaShared + r * K * disc * normCdf(-d2);
  const theta = thetaAnnual / TRADING_DAYS; // por dia útil

  const vega = (S * nD1 * sqrtT) / 100; // por 1% (0.01) em sigma

  const rho =
    type === "call"
      ? (K * T * disc * normCdf(d2)) / 100
      : (-K * T * disc * normCdf(-d2)) / 100;

  return { delta, gamma, theta, vega, rho };
}

// Volatilidade implícita por bisseção. Retorna null se não convergir / inputs inviáveis.
export function impliedVolatility(
  marketPrice: number,
  base: { S: number; K: number; T: number; r: number; type: OptionType },
  opts: { tol?: number; maxIter?: number; lo?: number; hi?: number } = {}
): number | null {
  const tol = opts.tol ?? 1e-6;
  const maxIter = opts.maxIter ?? 100;
  let lo = opts.lo ?? 1e-4;
  let hi = opts.hi ?? 5;

  const priceAt = (sigma: number) =>
    blackScholes({ ...base, sigma }).price;

  const pLo = priceAt(lo);
  const pHi = priceAt(hi);
  if (marketPrice < Math.min(pLo, pHi) - tol) return null;
  if (marketPrice > Math.max(pLo, pHi) + tol) return null;

  for (let i = 0; i < maxIter; i++) {
    const mid = 0.5 * (lo + hi);
    const pm = priceAt(mid);
    if (Math.abs(pm - marketPrice) < tol) return mid;
    if (pm < marketPrice) lo = mid;
    else hi = mid;
  }
  return 0.5 * (lo + hi);
}

export function intrinsicValue(S: number, K: number, type: OptionType): number {
  return type === "call" ? Math.max(S - K, 0) : Math.max(K - S, 0);
}

export function moneyness(S: number, K: number, type: OptionType): {
  state: "ITM" | "ATM" | "OTM";
  pct: number;
} {
  const pct = (S - K) / K;
  if (Math.abs(pct) < 0.01) return { state: "ATM", pct };
  if (type === "call") return { state: pct > 0 ? "ITM" : "OTM", pct };
  return { state: pct < 0 ? "ITM" : "OTM", pct };
}
