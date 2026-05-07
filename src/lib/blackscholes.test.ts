import { describe, expect, it } from "vitest";
import { blackScholes, greeks, impliedVolatility } from "./blackscholes";
import { normCdf } from "./stats";

describe("normCdf", () => {
  it("matches known values", () => {
    expect(normCdf(0)).toBeCloseTo(0.5, 6);
    expect(normCdf(1.96)).toBeCloseTo(0.975, 4);
    expect(normCdf(-1.96)).toBeCloseTo(0.025, 4);
  });
});

describe("blackScholes", () => {
  it("ATM call (S=K=100, T=1, r=5%, σ=20%) ≈ 10.4506", () => {
    const { price } = blackScholes({
      S: 100,
      K: 100,
      T: 1,
      r: 0.05,
      sigma: 0.2,
      type: "call",
    });
    expect(price).toBeCloseTo(10.4506, 3);
  });

  it("ATM put (mesmos params) ≈ 5.5735", () => {
    const { price } = blackScholes({
      S: 100,
      K: 100,
      T: 1,
      r: 0.05,
      sigma: 0.2,
      type: "put",
    });
    expect(price).toBeCloseTo(5.5735, 3);
  });

  it("respeita put-call parity: C - P = S - K e^(-rT)", () => {
    const base = { S: 95, K: 100, T: 0.5, r: 0.04, sigma: 0.25 } as const;
    const c = blackScholes({ ...base, type: "call" }).price;
    const p = blackScholes({ ...base, type: "put" }).price;
    const parity = base.S - base.K * Math.exp(-base.r * base.T);
    expect(c - p).toBeCloseTo(parity, 8);
  });
});

describe("greeks", () => {
  it("ATM call delta ~ 0.6368 (params clássicos)", () => {
    const g = greeks({ S: 100, K: 100, T: 1, r: 0.05, sigma: 0.2, type: "call" });
    expect(g.delta).toBeCloseTo(0.6368, 3);
    expect(g.gamma).toBeGreaterThan(0);
    expect(g.theta).toBeLessThan(0); // call comprada perde valor com o tempo
    expect(g.vega).toBeGreaterThan(0);
    expect(g.rho).toBeGreaterThan(0);
  });

  it("put delta = call delta - 1", () => {
    const base = { S: 100, K: 100, T: 1, r: 0.05, sigma: 0.2 } as const;
    const c = greeks({ ...base, type: "call" });
    const p = greeks({ ...base, type: "put" });
    expect(p.delta).toBeCloseTo(c.delta - 1, 8);
    expect(p.gamma).toBeCloseTo(c.gamma, 8);
    expect(p.vega).toBeCloseTo(c.vega, 8);
  });
});

describe("impliedVolatility", () => {
  it("recupera σ a partir do preço B&S", () => {
    const base = { S: 100, K: 105, T: 0.5, r: 0.05, type: "call" as const };
    const truePrice = blackScholes({ ...base, sigma: 0.32 }).price;
    const iv = impliedVolatility(truePrice, base);
    expect(iv).not.toBeNull();
    expect(iv!).toBeCloseTo(0.32, 4);
  });
});
