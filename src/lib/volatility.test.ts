import { describe, it, expect } from "vitest";
import { garch11, logReturns, historicalVol, estimates } from "./volatility";

// PRNG determinístico para testes reprodutíveis
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rng: () => number): number {
  const u = Math.max(rng(), 1e-12);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Simula GARCH(1,1) com parâmetros conhecidos
function simulateGarch(n: number, omega: number, alpha: number, beta: number, seed: number) {
  const rng = mulberry32(seed);
  const lr = omega / (1 - alpha - beta);
  let s2 = lr;
  const r: number[] = [];
  for (let i = 0; i < n; i++) {
    const z = gaussian(rng);
    const eps = Math.sqrt(s2) * z;
    r.push(eps);
    s2 = omega + alpha * eps * eps + beta * s2;
  }
  return r;
}

describe("garch11", () => {
  it("retorna null para amostras curtas", () => {
    expect(garch11([0.01, -0.01])).toBeNull();
  });

  it("estima persistência α+β < 1 (estacionário)", () => {
    const r = simulateGarch(800, 1e-6, 0.08, 0.9, 42);
    const fit = garch11(r);
    expect(fit).not.toBeNull();
    expect(fit!.persistence).toBeGreaterThan(0);
    expect(fit!.persistence).toBeLessThan(1);
  });

  it("σ longo prazo aproxima dp da amostra (ruído branco)", () => {
    // Para retornos iid Normal(0, σ²=1e-4), o GARCH deve convergir para σ próximo de
    // sqrt(1e-4 * 252) ≈ 0.1587
    const rng = mulberry32(7);
    const r = Array.from({ length: 600 }, () => 0.01 * gaussian(rng));
    const fit = garch11(r);
    expect(fit).not.toBeNull();
    const expectedSigma = Math.sqrt(1e-4 * 252);
    // tolerância ampla — MLE em série finita tem variabilidade
    expect(fit!.longRunSigma).toBeGreaterThan(expectedSigma * 0.6);
    expect(fit!.longRunSigma).toBeLessThan(expectedSigma * 1.6);
  });

  it("recupera parâmetros aproximadamente em série simulada longa", () => {
    const omega = 5e-6;
    const alpha = 0.1;
    const beta = 0.85;
    const r = simulateGarch(1500, omega, alpha, beta, 123);
    const fit = garch11(r);
    expect(fit).not.toBeNull();
    // Persistência é o que mais importa para forecast — deve ficar perto de 0.95
    expect(fit!.persistence).toBeGreaterThan(0.85);
    expect(fit!.persistence).toBeLessThan(0.99);
  });

  it("sigmaPath tem mesmo comprimento e valores positivos finitos", () => {
    const r = simulateGarch(400, 1e-6, 0.05, 0.9, 99);
    const fit = garch11(r)!;
    expect(fit.sigmaPath.length).toBe(r.length);
    for (const s of fit.sigmaPath) {
      expect(s).toBeGreaterThan(0);
      expect(isFinite(s)).toBe(true);
    }
    expect(isFinite(fit.sigmaForecast)).toBe(true);
    expect(fit.sigmaForecast).toBeGreaterThan(0);
  });
});

describe("estimates() com GARCH", () => {
  it("inclui campo garch quando há dados suficientes", () => {
    // ~ 300 fechamentos sintéticos
    const rng = mulberry32(2026);
    const prices: number[] = [100];
    for (let i = 0; i < 300; i++) {
      prices.push(prices[i] * Math.exp(0.012 * gaussian(rng)));
    }
    const est = estimates(prices);
    expect(est.hv21).toBeGreaterThan(0);
    expect(est.garch).toBeDefined();
    expect(est.garch!).toBeGreaterThan(0);
  });

  it("respeita opt-out de GARCH", () => {
    const rng = mulberry32(11);
    const prices: number[] = [50];
    for (let i = 0; i < 100; i++) prices.push(prices[i] * Math.exp(0.01 * gaussian(rng)));
    const est = estimates(prices, { includeGarch: false });
    expect(est.garch).toBeUndefined();
  });
});

describe("sanidade auxiliar", () => {
  it("logReturns/historicalVol continuam funcionando", () => {
    const prices = [100, 101, 99, 102, 100];
    const r = logReturns(prices);
    expect(r.length).toBe(4);
    expect(historicalVol(r, 4)).toBeGreaterThan(0);
  });
});
