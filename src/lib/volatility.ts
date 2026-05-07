import type { VolatilityEstimates } from "@/types/options";

const TRADING_DAYS = 252;

export function logReturns(prices: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    out.push(Math.log(prices[i] / prices[i - 1]));
  }
  return out;
}

export function historicalVol(returns: number[], window: number): number {
  const slice = returns.slice(-Math.min(window, returns.length));
  if (slice.length < 2) return NaN;
  const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
  const variance =
    slice.reduce((a, b) => a + (b - mean) ** 2, 0) / (slice.length - 1);
  return Math.sqrt(variance * TRADING_DAYS);
}

export function rollingHistoricalVol(returns: number[], window: number): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < returns.length; i++) {
    if (i + 1 < window) {
      out.push(null);
      continue;
    }
    const slice = returns.slice(i + 1 - window, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
    const variance =
      slice.reduce((a, b) => a + (b - mean) ** 2, 0) / (slice.length - 1);
    out.push(Math.sqrt(variance * TRADING_DAYS));
  }
  return out;
}

export function moments(returns: number[]): {
  mean: number;
  std: number;
  skew: number;
  kurt: number;
} {
  const n = returns.length;
  const mean = returns.reduce((a, b) => a + b, 0) / n;
  const m2 = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const m3 = returns.reduce((a, b) => a + (b - mean) ** 3, 0) / n;
  const m4 = returns.reduce((a, b) => a + (b - mean) ** 4, 0) / n;
  const std = Math.sqrt(m2);
  const skew = m3 / m2 ** 1.5;
  const kurt = m4 / (m2 * m2) - 3;
  return { mean, std, skew, kurt };
}

// ------------------------------------------------------------
// GARCH(1,1)
// σ²_t = ω + α·ε²_{t-1} + β·σ²_{t-1}, com ε = r − mean(r)
// Estimação por MLE Gaussiana, otimizado por Nelder-Mead.
// ------------------------------------------------------------

export interface GarchFit {
  omega: number;
  alpha: number;
  beta: number;
  loglik: number;
  persistence: number;     // α + β
  longRunVar: number;      // ω / (1 − α − β), variância diária
  longRunSigma: number;    // σ longo prazo, anualizado
  sigmaForecast: number;   // σ 1 passo à frente, anualizado
  sigmaPath: number[];     // série de σ condicional anualizado, mesmo comprimento de returns
  converged: boolean;
  iterations: number;
}

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

export function garch11(returns: number[]): GarchFit | null {
  if (returns.length < 30) return null;

  const n = returns.length;
  const mean = returns.reduce((a, b) => a + b, 0) / n;
  const r = returns.map((x) => x - mean);
  const sampleVar = r.reduce((a, b) => a + b * b, 0) / n;
  if (!isFinite(sampleVar) || sampleVar <= 0) return null;

  // Reparametrização sem restrições:
  //   ω = exp(p0)
  //   α = 0.5 · sigmoid(p1)              ∈ (0, 0.5)
  //   β = (0.999 − α) · sigmoid(p2)      ∈ (0, 0.999 − α)
  // Garante ω>0, α,β>0, α+β<0.999 (estacionariedade).
  const decode = (p: number[]): { omega: number; alpha: number; beta: number } => {
    const omega = Math.exp(p[0]);
    const alpha = 0.5 * sigmoid(p[1]);
    const beta = (0.999 - alpha) * sigmoid(p[2]);
    return { omega, alpha, beta };
  };

  const negLogLik = (p: number[]): number => {
    const { omega, alpha, beta } = decode(p);
    if (!isFinite(omega) || omega <= 0) return 1e12;
    let s2 = sampleVar;
    let nll = 0;
    for (let i = 0; i < n; i++) {
      if (s2 <= 0 || !isFinite(s2)) return 1e12;
      nll += 0.5 * (Math.log(2 * Math.PI * s2) + (r[i] * r[i]) / s2);
      s2 = omega + alpha * r[i] * r[i] + beta * s2;
    }
    return isFinite(nll) ? nll : 1e12;
  };

  // A verossimilhança do GARCH(1,1) tem um canto degenerado em α=β=0
  // (modelo iid Gaussiano com σ²=ω) cuja bacia de atração no espaço
  // reparametrizado é grande. Estratégia robusta:
  //   1) avalia NLL numa grade fixa de (α, β) com ω = (1−α−β)·var amostral
  //   2) refina via Nelder-Mead a partir das K melhores entradas da grade
  //   3) fica com o resultado refinado de menor NLL
  const invSigmoid = (y: number) => Math.log(y / (1 - y));
  const encode = (alpha: number, beta: number, omega: number) => [
    Math.log(omega),
    invSigmoid(Math.min(0.999, Math.max(1e-3, alpha / 0.5))),
    invSigmoid(Math.min(0.999, Math.max(1e-3, beta / (0.999 - alpha)))),
  ];

  const alphaGrid = [0.01, 0.05, 0.08, 0.12, 0.18, 0.25, 0.35, 0.45];
  const betaGrid = [0.20, 0.40, 0.55, 0.70, 0.80, 0.88, 0.94];

  type GridPoint = { alpha: number; beta: number; omega: number; nll: number };
  const gridResults: GridPoint[] = [];
  for (const a of alphaGrid) {
    for (const b of betaGrid) {
      if (a + b >= 0.999) continue;
      // ω escolhido de modo que σ longo prazo = sampleVar
      const omega = (1 - a - b) * sampleVar;
      let s2 = sampleVar;
      let nll = 0;
      for (let i = 0; i < n; i++) {
        if (s2 <= 0) { nll = 1e12; break; }
        nll += 0.5 * (Math.log(2 * Math.PI * s2) + (r[i] * r[i]) / s2);
        s2 = omega + a * r[i] * r[i] + b * s2;
      }
      gridResults.push({ alpha: a, beta: b, omega, nll });
    }
  }
  gridResults.sort((x, y) => x.nll - y.nll);
  const topSeeds = gridResults.slice(0, 6);

  let opt: NMResult | null = null;
  for (const s of topSeeds) {
    const x0 = encode(s.alpha, s.beta, s.omega);
    const res = nelderMead(negLogLik, x0, { maxIter: 2000, tol: 1e-10 });
    if (!opt || res.fx < opt.fx) opt = res;
  }
  if (!opt) return null;
  const { omega, alpha, beta } = decode(opt.x);

  const persistence = alpha + beta;
  const longRunVar = omega / Math.max(1 - persistence, 1e-8);

  // Caminho condicional + forecast 1 passo
  let s2 = sampleVar;
  const sigmaPath: number[] = [];
  for (let i = 0; i < n; i++) {
    sigmaPath.push(Math.sqrt(s2 * TRADING_DAYS));
    s2 = omega + alpha * r[i] * r[i] + beta * s2;
  }
  const sigmaForecast = Math.sqrt(s2 * TRADING_DAYS);
  const longRunSigma = Math.sqrt(longRunVar * TRADING_DAYS);

  return {
    omega,
    alpha,
    beta,
    loglik: -opt.fx,
    persistence,
    longRunVar,
    longRunSigma,
    sigmaForecast,
    sigmaPath,
    converged: opt.converged,
    iterations: opt.iterations,
  };
}

export function estimates(prices: number[], opts: { includeGarch?: boolean } = {}): VolatilityEstimates {
  const r = logReturns(prices);
  const out: VolatilityEstimates = {
    hv21: historicalVol(r, 21),
    hv63: historicalVol(r, 63),
    hv252: historicalVol(r, 252),
  };
  if (opts.includeGarch !== false) {
    try {
      const fit = garch11(r);
      if (fit && isFinite(fit.sigmaForecast)) out.garch = fit.sigmaForecast;
    } catch {
      // silencia: GARCH é opcional
    }
  }
  return out;
}

// ------------------------------------------------------------
// Nelder-Mead simplex (minimização sem gradiente)
// ------------------------------------------------------------

interface NMResult {
  x: number[];
  fx: number;
  converged: boolean;
  iterations: number;
}

function nelderMead(
  f: (x: number[]) => number,
  x0: number[],
  opts: { maxIter?: number; tol?: number } = {},
): NMResult {
  const maxIter = opts.maxIter ?? 1000;
  const tol = opts.tol ?? 1e-8;
  const n = x0.length;
  const A = 1, G = 2, R = 0.5, S = 0.5;

  const simplex: { x: number[]; fx: number }[] = [{ x: [...x0], fx: f(x0) }];
  for (let i = 0; i < n; i++) {
    const xi = [...x0];
    xi[i] = xi[i] !== 0 ? xi[i] * 1.05 + 0.01 : 0.05;
    simplex.push({ x: xi, fx: f(xi) });
  }

  let iter = 0;
  for (; iter < maxIter; iter++) {
    simplex.sort((a, b) => a.fx - b.fx);
    if (simplex[n].fx - simplex[0].fx < tol) {
      return { x: simplex[0].x, fx: simplex[0].fx, converged: true, iterations: iter };
    }

    const c = new Array(n).fill(0);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) c[j] += simplex[i].x[j];
    for (let j = 0; j < n; j++) c[j] /= n;

    const xr = c.map((cj, j) => cj + A * (cj - simplex[n].x[j]));
    const fxr = f(xr);

    if (simplex[0].fx <= fxr && fxr < simplex[n - 1].fx) {
      simplex[n] = { x: xr, fx: fxr };
      continue;
    }
    if (fxr < simplex[0].fx) {
      const xe = c.map((cj, j) => cj + G * (xr[j] - cj));
      const fxe = f(xe);
      simplex[n] = fxe < fxr ? { x: xe, fx: fxe } : { x: xr, fx: fxr };
      continue;
    }
    const xc = c.map((cj, j) => cj + R * (simplex[n].x[j] - cj));
    const fxc = f(xc);
    if (fxc < simplex[n].fx) {
      simplex[n] = { x: xc, fx: fxc };
      continue;
    }
    for (let i = 1; i <= n; i++) {
      const xi = simplex[0].x.map((b, j) => b + S * (simplex[i].x[j] - b));
      simplex[i] = { x: xi, fx: f(xi) };
    }
  }
  simplex.sort((a, b) => a.fx - b.fx);
  return { x: simplex[0].x, fx: simplex[0].fx, converged: false, iterations: iter };
}
