"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { blackScholes, greeks } from "@/lib/blackscholes";
import { estimates } from "@/lib/volatility";
import type { MarketData, OptionInputs, OptionType } from "@/types/options";
import { cn, fmtCurrency, fmtNumber, fmtPct } from "@/lib/utils";
import { PriceRefreshButton } from "@/components/shared/price-refresh-button";
import { useSelic } from "@/lib/use-selic";
import { useExpiry } from "@/lib/use-expiry";
import { loadSharedInputs, saveSharedInput } from "@/lib/shared-inputs";

const MARKET_KEY = "opcoes-lab-market";
const SIGMA_KEY = "opcoes-lab-sigma";
const TRADING_DAYS = 252;

type GreekKey = "delta" | "gamma" | "theta" | "vega" | "rho";

const GREEK_META: Record<
  GreekKey,
  {
    symbol: string;
    name: string;
    color: string;
    bg: string;
    sentence: (g: ReturnType<typeof greeks>, S: number) => string;
    extra?: (g: ReturnType<typeof greeks>) => string;
    fmt: (v: number) => string;
  }
> = {
  delta: {
    symbol: "Δ",
    name: "Delta",
    color: "#1d4ed8",
    bg: "rgba(29,78,216,0.08)",
    sentence: (g) =>
      `Por R$ 1 de alta no ativo, o prêmio muda ${fmtCurrency(g.delta, 4)}.`,
    extra: (g) =>
      `Hedge: ${fmtNumber(Math.abs(g.delta) * 1000, 1)} ações por 1.000 opções.`,
    fmt: (v) => fmtNumber(v, 4),
  },
  gamma: {
    symbol: "Γ",
    name: "Gamma",
    color: "#7c3aed",
    bg: "rgba(124,58,237,0.08)",
    sentence: (g) =>
      `Por R$ 1 de alta no ativo, o Delta muda ${fmtNumber(g.gamma, 4)}.`,
    fmt: (v) => fmtNumber(v, 4),
  },
  theta: {
    symbol: "θ",
    name: "Theta",
    color: "#b91c1c",
    bg: "rgba(185,28,28,0.08)",
    sentence: (g) =>
      `Por dia que passa, o prêmio muda ${fmtCurrency(g.theta, 4)}.`,
    fmt: (v) => fmtNumber(v, 4),
  },
  vega: {
    symbol: "ν",
    name: "Vega",
    color: "#009b3a",
    bg: "rgba(0,155,58,0.08)",
    sentence: (g) =>
      `Por 1% de alta na volatilidade, o prêmio muda ${fmtCurrency(g.vega, 4)}.`,
    fmt: (v) => fmtNumber(v, 4),
  },
  rho: {
    symbol: "ρ",
    name: "Rho",
    color: "#6b6460",
    bg: "rgba(107,100,96,0.08)",
    sentence: (g) =>
      `Por 1% de alta na Selic, o prêmio muda ${fmtCurrency(g.rho, 4)}.`,
    fmt: (v) => fmtNumber(v, 4),
  },
};

function NumberField({
  label,
  value,
  onChange,
  step = 0.01,
  suffix,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  suffix?: string;
  hint?: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs uppercase tracking-wider text-warm-gray">{label}</span>
        {hint && <span className="text-[10px] text-text-muted">{hint}</span>}
      </div>
      <div className="mt-1 flex items-center rounded-md border border-light-border bg-white focus-within:border-gold">
        <input
          type="number"
          value={Number.isFinite(value) ? value : ""}
          step={step}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="font-numeric w-full bg-transparent px-3 py-2 text-base text-text-primary outline-none"
        />
        {suffix && <span className="pr-3 text-sm text-text-muted">{suffix}</span>}
      </div>
    </label>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  fmt,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  fmt: (v: number) => string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-xs uppercase tracking-wider text-warm-gray">{label}</span>
        <span className="font-numeric text-sm text-navy">{fmt(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="mt-2 w-full accent-[var(--gold)]"
      />
    </div>
  );
}

type Scenario = "spot+5" | "vol+3" | "time+7" | "selic+50";

const SCENARIOS: { key: Scenario; label: string }[] = [
  { key: "spot+5", label: "Ativo sobe 5% amanhã" },
  { key: "vol+3", label: "Volatilidade implícita sobe 3 pontos" },
  { key: "time+7", label: "Passam 7 dias corridos (5 d.u.)" },
  { key: "selic+50", label: "Selic sobe 50 bps" },
];

function applyScenario(
  base: OptionInputs,
  Tdays: number,
  s: Scenario
): { next: OptionInputs; nextTdays: number; deltaS: number; deltaSigma: number; deltaT_days: number; deltaR: number } {
  let next = { ...base };
  let nextTdays = Tdays;
  let deltaS = 0;
  let deltaSigma = 0;
  let deltaT_days = 0;
  let deltaR = 0;
  if (s === "spot+5") {
    deltaS = base.S * 0.05;
    next.S = base.S + deltaS;
  } else if (s === "vol+3") {
    deltaSigma = 0.03;
    next.sigma = base.sigma + deltaSigma;
  } else if (s === "time+7") {
    deltaT_days = -5; // 5 d.u. perdidos
    nextTdays = Math.max(1, Tdays + deltaT_days);
    next.T = nextTdays / TRADING_DAYS;
  } else if (s === "selic+50") {
    deltaR = 0.005;
    next.r = base.r + deltaR;
  }
  return { next, nextTdays, deltaS, deltaSigma, deltaT_days, deltaR };
}

export default function GregasPage() {
  const [S, setS] = useState(38.42);
  const [K, setK] = useState(38);
  const [Tdays, setTdays] = useState(45);
  const [r, setR] = useState(0.1075);
  const [sigma, setSigma] = useState(0.351);
  const [type, setType] = useState<OptionType>("call");
  const [ticker, setTicker] = useState<string | undefined>();

  const [scenario, setScenario] = useState<Scenario>("spot+5");

  const [hydrated, setHydrated] = useState(false);

  const selicMeta = useSelic((rate) => {
    if (loadSharedInputs().r == null) setR(rate);
  });
  const expiryInfo = useExpiry((du) => {
    if (loadSharedInputs().Tdays == null) setTdays(du);
  });
  const [hedgeQty, setHedgeQty] = useState(1000);
  const [hedgeMovePct, setHedgeMovePct] = useState(2);

  // Hidrata σ e S a partir dos Módulos 1, 2 e do override compartilhado
  useEffect(() => {
    const shared = loadSharedInputs();

    let sigmaFromSelection: number | null = null;
    try {
      const rawSig = localStorage.getItem(SIGMA_KEY);
      if (rawSig) {
        const sel = JSON.parse(rawSig) as { method: string; value: number };
        if (sel && Number.isFinite(sel.value)) sigmaFromSelection = sel.value;
      }
    } catch {}

    let mdCurrentPrice: number | undefined;
    let estHv63: number | undefined;
    try {
      const raw = localStorage.getItem(MARKET_KEY);
      if (raw) {
        const md = JSON.parse(raw) as MarketData;
        if (md.history?.length >= 2) {
          setTicker(md.ticker);
          mdCurrentPrice = md.currentPrice;
          estHv63 = estimates(md.history.map((h) => h.close)).hv63;
        }
      }
    } catch {}

    if (shared.S != null) setS(shared.S);
    else if (mdCurrentPrice != null) setS(mdCurrentPrice);
    if (shared.K != null) setK(shared.K);
    if (shared.Tdays != null) setTdays(shared.Tdays);
    if (shared.type != null) setType(shared.type);
    if (shared.r != null) setR(shared.r);
    if (shared.sigma != null) setSigma(shared.sigma);
    else if (sigmaFromSelection != null) setSigma(sigmaFromSelection);
    else if (estHv63 != null) setSigma(estHv63);

    setHydrated(true);
  }, []);

  // Persiste cada campo após hidratação
  useEffect(() => { if (hydrated) saveSharedInput("S", S); }, [S, hydrated]);
  useEffect(() => { if (hydrated) saveSharedInput("K", K); }, [K, hydrated]);
  useEffect(() => { if (hydrated) saveSharedInput("Tdays", Tdays); }, [Tdays, hydrated]);
  useEffect(() => { if (hydrated) saveSharedInput("type", type); }, [type, hydrated]);
  useEffect(() => { if (hydrated) saveSharedInput("r", r); }, [r, hydrated]);
  useEffect(() => { if (hydrated) saveSharedInput("sigma", sigma); }, [sigma, hydrated]);

  const T = Tdays / TRADING_DAYS;
  const inputs: OptionInputs = { S, K, T, r, sigma, type };
  const bs = useMemo(() => blackScholes(inputs), [inputs]);
  const g = useMemo(() => greeks(inputs), [inputs]);

  // Grid 2×3 de gráficos: cada um varia S de 0.6×S até 1.4×S
  const gridData = useMemo(() => {
    const lo = S * 0.6;
    const hi = S * 1.4;
    const N = 80;
    const data: {
      s: number;
      price: number;
      payoff: number;
      delta: number;
      gamma: number;
      theta: number;
      vega: number;
      rho: number;
    }[] = [];
    for (let i = 0; i <= N; i++) {
      const s = lo + ((hi - lo) * i) / N;
      const ins: OptionInputs = { ...inputs, S: s };
      const b = blackScholes(ins);
      const gg = greeks(ins);
      data.push({
        s: Number(s.toFixed(2)),
        price: b.price,
        payoff: type === "call" ? Math.max(s - K, 0) : Math.max(K - s, 0),
        delta: gg.delta,
        gamma: gg.gamma,
        theta: gg.theta,
        vega: gg.vega,
        rho: gg.rho,
      });
    }
    return data;
  }, [S, K, T, r, sigma, type, inputs]);

  // Decaimento temporal: hoje (T), T/2, T/10
  const decayData = useMemo(() => {
    const lo = S * 0.6;
    const hi = S * 1.4;
    const N = 60;
    const fracHalf = 0.5;
    const fracNear = 0.1;
    const data: { s: number; today: number; half: number; near: number; payoff: number }[] = [];
    for (let i = 0; i <= N; i++) {
      const s = lo + ((hi - lo) * i) / N;
      const today = blackScholes({ ...inputs, S: s }).price;
      const half = blackScholes({ ...inputs, S: s, T: T * fracHalf }).price;
      const near = blackScholes({ ...inputs, S: s, T: T * fracNear }).price;
      data.push({
        s: Number(s.toFixed(2)),
        today,
        half,
        near,
        payoff: type === "call" ? Math.max(s - K, 0) : Math.max(K - s, 0),
      });
    }
    return data;
  }, [inputs, S, K, T, type]);

  // Cenário "E se...?"
  const sim = useMemo(() => {
    const { next, nextTdays, deltaS, deltaSigma, deltaT_days, deltaR } = applyScenario(
      inputs,
      Tdays,
      scenario
    );
    const newPrice = blackScholes(next).price;
    const total = newPrice - bs.price;

    // Decomposição grega (1ª e 2ª ordem em S)
    const cDelta = g.delta * deltaS;
    const cGamma = 0.5 * g.gamma * deltaS * deltaS;
    const cTheta = g.theta * Math.abs(deltaT_days);
    const cVega = (g.vega * deltaSigma) / 0.01; // vega é por 1%
    const cRho = (g.rho * deltaR) / 0.01;
    const cThetaSigned = deltaT_days < 0 ? cTheta : -cTheta; // perda de tempo => negativo
    const approx = cDelta + cGamma + cThetaSigned + cVega + cRho;

    return {
      next,
      nextTdays,
      newPrice,
      total,
      approx,
      diff: total - approx,
      contrib: {
        delta: cDelta,
        gamma: cGamma,
        theta: cThetaSigned,
        vega: cVega,
        rho: cRho,
      },
      labels: {
        deltaS,
        deltaSigma,
        deltaT_days,
        deltaR,
      },
    };
  }, [inputs, Tdays, scenario, bs.price, g]);

  // Delta hedge interativo
  const hedge = useMemo(() => {
    const sharesToShort = g.delta * hedgeQty; // call: vende ações; put: delta<0 → compra
    const move = (hedgeMovePct / 100) * S;
    const Sup = S + move;
    const Sdown = S - move;
    const priceUp = blackScholes({ ...inputs, S: Sup }).price;
    const priceDown = blackScholes({ ...inputs, S: Sdown }).price;

    // Posição: long hedgeQty opções; short sharesToShort ações
    const pnlOptUp = (priceUp - bs.price) * hedgeQty;
    const pnlOptDown = (priceDown - bs.price) * hedgeQty;
    const pnlStockUp = -(Sup - S) * sharesToShort;
    const pnlStockDown = -(Sdown - S) * sharesToShort;

    return {
      sharesToShort,
      move,
      hedgedUp: pnlOptUp + pnlStockUp,
      hedgedDown: pnlOptDown + pnlStockDown,
      naiveUp: pnlOptUp,
      naiveDown: pnlOptDown,
    };
  }, [g.delta, hedgeQty, hedgeMovePct, S, bs.price, inputs]);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="text-[11px] uppercase tracking-[0.25em] text-warm-gray">Módulo 04</div>
      <h1 className="mt-3 text-4xl text-navy">Gregas</h1>
      <div className="mt-3 h-px w-12 bg-gold" />
      <p className="mt-4 max-w-2xl text-text-secondary">
        As gregas medem como o prêmio reage a cada variável. Mexa nos sliders e observe
        como Δ Γ θ ν ρ se modificam — depois, no simulador, veja a decomposição da P&amp;L.
      </p>

      <div className="mt-10 grid gap-8 lg:grid-cols-[320px_1fr]">
        {/* INPUTS */}
        <section className="space-y-5 rounded-lg border border-light-border bg-white p-6 lg:sticky lg:top-6 lg:self-start">
          <h2 className="text-2xl text-navy">Inputs</h2>
          <NumberField
            label="S — Preço atual"
            value={S}
            onChange={setS}
            step={0.01}
            suffix="R$"
            hint={<PriceRefreshButton ticker={ticker} onPrice={setS} />}
          />
          <NumberField label="K — Strike" value={K} onChange={setK} step={0.5} suffix="R$" />
          <NumberField
            label="T — Vencimento"
            value={Tdays}
            onChange={setTdays}
            step={1}
            suffix="d.u."
            hint={
              expiryInfo
                ? `${expiryInfo.expiry.split("-").reverse().join("/")} • ${T.toFixed(4)} ano`
                : `${T.toFixed(4)} ano`
            }
          />
          <NumberField
            label="r — Selic"
            value={Math.round(r * 10000) / 100}
            onChange={(v) => setR(v / 100)}
            step={0.05}
            suffix="%"
            hint={selicMeta ? `BCB ${selicMeta.date}` : undefined}
          />
          <NumberField
            label="σ — Volatilidade"
            value={Math.round(sigma * 10000) / 100}
            onChange={(v) => setSigma(v / 100)}
            step={0.01}
            suffix="%"
          />
          <div>
            <div className="text-xs uppercase tracking-wider text-warm-gray">Tipo</div>
            <div className="mt-2 inline-flex rounded-md border border-light-border bg-cream p-1">
              {(["call", "put"] as OptionType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={cn(
                    "px-4 py-1.5 text-sm rounded transition",
                    type === t ? "bg-navy text-cream" : "text-text-secondary hover:text-navy"
                  )}
                >
                  {t === "call" ? "Call" : "Put"}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-light-border pt-4">
            <div className="text-[10px] uppercase tracking-wider text-warm-gray">Preço B&amp;S</div>
            <div className="mt-1 text-2xl text-gold font-numeric">{fmtCurrency(bs.price, 4)}</div>
          </div>
        </section>

        {/* RESULTADOS */}
        <section className="space-y-10">
          {/* Cards de gregas */}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {(Object.keys(GREEK_META) as GreekKey[]).map((k) => {
              const meta = GREEK_META[k];
              const value = g[k];
              return (
                <div
                  key={k}
                  className="rounded-lg border border-light-border bg-white p-4"
                  style={{ borderTop: `3px solid ${meta.color}` }}
                >
                  <div className="flex items-baseline gap-2">
                    <span
                      className="text-2xl font-numeric"
                      style={{ color: meta.color }}
                    >
                      {meta.symbol}
                    </span>
                    <span className="text-xs uppercase tracking-wider text-warm-gray">
                      {meta.name}
                    </span>
                  </div>
                  <div className="mt-2 text-2xl text-navy font-numeric">
                    {meta.fmt(value)}
                  </div>
                  <div className="mt-3 h-px bg-light-border" />
                  <p className="mt-3 text-xs leading-relaxed text-text-secondary">
                    &ldquo;{meta.sentence(g, S)}&rdquo;
                  </p>
                  {meta.extra && (
                    <p className="mt-2 text-[11px] text-text-muted font-numeric">
                      {meta.extra(g)}
                    </p>
                  )}
                  {k === "delta" &&
                    Math.abs(g.delta) > 0.3 &&
                    Math.abs(g.delta) < 0.7 && (
                      <span className="mt-2 inline-block rounded bg-cream px-1.5 py-0.5 text-[10px] text-navy">
                        ≈ prob. risk-neutral de exercício
                      </span>
                    )}
                </div>
              );
            })}
          </div>

          {/* Grid 2×3 de gráficos */}
          <div className="rounded-lg border border-light-border bg-white p-5">
            <h3 className="text-lg text-navy">Gregas em função de S</h3>
            <p className="text-xs text-text-muted">
              Linha vertical em S atual. Ponto destaca o valor corrente.
            </p>
            <div className="mt-5 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              <SmallChart
                title="Preço &amp; Payoff"
                data={gridData}
                series={[
                  { key: "payoff", color: "#b91c1c", name: "Payoff", dashed: true },
                  { key: "price", color: "#b8860b", name: "B&S", strokeWidth: 2.5 },
                ]}
                S={S}
                pointKey="price"
                pointValue={bs.price}
                fmtY={(v) => fmtCurrency(v, 2)}
              />
              <SmallChart
                title="Delta vs S"
                data={gridData}
                series={[{ key: "delta", color: GREEK_META.delta.color, name: "Δ" }]}
                S={S}
                pointKey="delta"
                pointValue={g.delta}
                fmtY={(v) => fmtNumber(v, 3)}
              />
              <SmallChart
                title="Gamma vs S"
                data={gridData}
                series={[{ key: "gamma", color: GREEK_META.gamma.color, name: "Γ" }]}
                S={S}
                pointKey="gamma"
                pointValue={g.gamma}
                fmtY={(v) => fmtNumber(v, 4)}
              />
              <SmallChart
                title="Theta vs S (por dia)"
                data={gridData}
                series={[{ key: "theta", color: GREEK_META.theta.color, name: "θ" }]}
                S={S}
                pointKey="theta"
                pointValue={g.theta}
                fmtY={(v) => fmtNumber(v, 4)}
              />
              <SmallChart
                title="Vega vs S (por 1%)"
                data={gridData}
                series={[{ key: "vega", color: GREEK_META.vega.color, name: "ν" }]}
                S={S}
                pointKey="vega"
                pointValue={g.vega}
                fmtY={(v) => fmtNumber(v, 4)}
              />
              <SmallChart
                title="Rho vs S (por 1%)"
                data={gridData}
                series={[{ key: "rho", color: GREEK_META.rho.color, name: "ρ" }]}
                S={S}
                pointKey="rho"
                pointValue={g.rho}
                fmtY={(v) => fmtNumber(v, 4)}
              />
            </div>
          </div>

          {/* Decaimento temporal */}
          <div className="rounded-lg border border-light-border bg-white p-5">
            <h3 className="text-lg text-navy">Decaimento temporal (θ)</h3>
            <p className="text-xs text-text-muted">
              Mesma opção em três horizontes — o decaimento acelera perto do vencimento.
            </p>
            <div className="mt-4 h-72">
              <ResponsiveContainer>
                <LineChart data={decayData} margin={{ left: 8, right: 16, top: 8, bottom: 4 }}>
                  <CartesianGrid stroke="#e8e4df" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="s"
                    type="number"
                    domain={["dataMin", "dataMax"]}
                    tick={{ fill: "#6b6460", fontSize: 11 }}
                    label={{
                      value: "S (R$)",
                      position: "insideBottom",
                      offset: -2,
                      fill: "#6b6460",
                      fontSize: 11,
                    }}
                  />
                  <YAxis tick={{ fill: "#6b6460", fontSize: 11 }} />
                  <Tooltip
                    formatter={(v: unknown) => fmtCurrency(Number(v), 2)}
                    labelFormatter={(l: unknown) => `S = ${fmtCurrency(Number(l), 2)}`}
                    contentStyle={{
                      background: "#faf8f5",
                      border: "1px solid #e8e4df",
                      fontSize: 12,
                    }}
                  />
                  <ReferenceLine x={S} stroke="#1a2744" strokeDasharray="4 4" />
                  <Line
                    type="monotone"
                    dataKey="payoff"
                    name="Payoff (T=0)"
                    stroke="#b91c1c"
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="today"
                    name={`Hoje (${Tdays} d.u.)`}
                    stroke="#b8860b"
                    strokeWidth={2.5}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="half"
                    name={`T/2 (${Math.round(Tdays / 2)} d.u.)`}
                    stroke="#1a2744"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="near"
                    name={`T/10 (${Math.max(1, Math.round(Tdays / 10))} d.u.)`}
                    stroke="#8a8580"
                    strokeWidth={1.5}
                    strokeDasharray="4 2"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Simulador "E se...?" */}
          <div className="rounded-lg border border-light-border bg-white p-6">
            <h3 className="text-lg text-navy">Simulador &ldquo;E se...?&rdquo;</h3>
            <p className="text-xs text-text-muted">
              Decomposição da variação do prêmio em contribuições de cada grega.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {SCENARIOS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setScenario(s.key)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs transition",
                    scenario === s.key
                      ? "border-gold bg-gold text-white"
                      : "border-light-border bg-white text-text-secondary hover:border-gold"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <div className="rounded-md border border-light-border bg-cream/40 p-4">
                <div className="text-[10px] uppercase tracking-wider text-warm-gray">Antes</div>
                <div className="mt-1 text-xl text-navy font-numeric">
                  {fmtCurrency(bs.price, 4)}
                </div>
                <div className="mt-3 space-y-1 text-xs text-text-secondary font-numeric">
                  <div>S = {fmtCurrency(S, 2)}</div>
                  <div>σ = {fmtPct(sigma)}</div>
                  <div>T = {Tdays} d.u.</div>
                  <div>r = {fmtPct(r)}</div>
                </div>
              </div>
              <div className="rounded-md border border-light-border bg-cream/40 p-4">
                <div className="text-[10px] uppercase tracking-wider text-warm-gray">Depois</div>
                <div className="mt-1 text-xl text-navy font-numeric">
                  {fmtCurrency(sim.newPrice, 4)}
                </div>
                <div className="mt-3 space-y-1 text-xs text-text-secondary font-numeric">
                  <div>S = {fmtCurrency(sim.next.S, 2)}</div>
                  <div>σ = {fmtPct(sim.next.sigma)}</div>
                  <div>T = {sim.nextTdays} d.u.</div>
                  <div>r = {fmtPct(sim.next.r)}</div>
                </div>
              </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-md border border-light-border">
              <table className="w-full text-sm">
                <tbody className="font-numeric">
                  <ContribRow
                    label="Δ Delta"
                    color={GREEK_META.delta.color}
                    value={sim.contrib.delta}
                  />
                  <ContribRow
                    label="Γ Gamma"
                    color={GREEK_META.gamma.color}
                    value={sim.contrib.gamma}
                  />
                  <ContribRow
                    label="θ Theta"
                    color={GREEK_META.theta.color}
                    value={sim.contrib.theta}
                  />
                  <ContribRow
                    label="ν Vega"
                    color={GREEK_META.vega.color}
                    value={sim.contrib.vega}
                  />
                  <ContribRow
                    label="ρ Rho"
                    color={GREEK_META.rho.color}
                    value={sim.contrib.rho}
                  />
                  <tr className="border-t-2 border-navy/20 bg-cream/50">
                    <td className="px-4 py-2 text-left">Total aproximado</td>
                    <td className="px-4 py-2 text-right text-navy">
                      {sim.approx >= 0 ? "+" : ""}
                      {fmtCurrency(sim.approx, 4)}
                    </td>
                  </tr>
                  <tr className="bg-cream/30">
                    <td className="px-4 py-2 text-left">B&amp;S recalculado</td>
                    <td className="px-4 py-2 text-right text-gold">
                      {sim.total >= 0 ? "+" : ""}
                      {fmtCurrency(sim.total, 4)}
                    </td>
                  </tr>
                  <tr className="text-text-muted">
                    <td className="px-4 py-2 text-left text-xs">Diferença (efeitos de 2ª ordem)</td>
                    <td className="px-4 py-2 text-right text-xs">
                      {fmtCurrency(sim.diff, 4)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Delta Hedge */}
          <div className="rounded-lg border border-light-border bg-white p-6">
            <h3 className="text-lg text-navy">Delta hedge interativo</h3>
            <p className="text-xs text-text-muted">
              Compre opções, venda Δ × Q ações, e o portfólio fica delta-neutro — até S mexer.
            </p>

            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <NumberField
                label="Quantidade de opções compradas"
                value={hedgeQty}
                onChange={setHedgeQty}
                step={100}
                suffix="opções"
              />
              <Slider
                label="Movimento simulado em S"
                value={hedgeMovePct}
                min={0.5}
                max={20}
                step={0.5}
                onChange={setHedgeMovePct}
                fmt={(v) => `±${v.toFixed(1)}%`}
              />
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <div className="rounded-md border border-light-border bg-cream/40 p-4">
                <div className="text-[10px] uppercase tracking-wider text-warm-gray">
                  Ações para hedge
                </div>
                <div className="mt-1 text-xl text-navy font-numeric">
                  {fmtNumber(hedge.sharesToShort, 1)}
                </div>
                <div className="mt-1 text-[11px] text-text-muted">
                  {hedge.sharesToShort >= 0 ? "vender" : "comprar"} ações para neutralizar Δ
                </div>
              </div>
              <div className="rounded-md border border-light-border bg-cream/40 p-4">
                <div className="text-[10px] uppercase tracking-wider text-warm-gray">
                  S sobe {hedgeMovePct.toFixed(1)}%
                </div>
                <div className="mt-1 grid grid-cols-2 gap-2 text-sm font-numeric">
                  <div>
                    <div className="text-[10px] text-text-muted">P&amp;L sem hedge</div>
                    <div className={cn(hedge.naiveUp >= 0 ? "text-b3" : "text-red-700")}>
                      {fmtCurrency(hedge.naiveUp, 2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-text-muted">P&amp;L hedgeado</div>
                    <div className={cn(hedge.hedgedUp >= 0 ? "text-b3" : "text-red-700")}>
                      {fmtCurrency(hedge.hedgedUp, 2)}
                    </div>
                  </div>
                </div>
              </div>
              <div className="rounded-md border border-light-border bg-cream/40 p-4">
                <div className="text-[10px] uppercase tracking-wider text-warm-gray">
                  S cai {hedgeMovePct.toFixed(1)}%
                </div>
                <div className="mt-1 grid grid-cols-2 gap-2 text-sm font-numeric">
                  <div>
                    <div className="text-[10px] text-text-muted">P&amp;L sem hedge</div>
                    <div className={cn(hedge.naiveDown >= 0 ? "text-b3" : "text-red-700")}>
                      {fmtCurrency(hedge.naiveDown, 2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-text-muted">P&amp;L hedgeado</div>
                    <div className={cn(hedge.hedgedDown >= 0 ? "text-b3" : "text-red-700")}>
                      {fmtCurrency(hedge.hedgedDown, 2)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <p className="mt-4 text-xs text-text-muted">
              O hedge precisa ser refeito quando S muda — esse rebalanceamento contínuo é o
              custo do Gamma. O comprador da opção lucra com a convexidade; o vendedor paga.
            </p>
          </div>

          {/* Notas pedagógicas */}
          <div className="grid gap-3 md:grid-cols-2">
            <Note title="Delta ≈ probabilidade">
              Próximo de ATM, Δ ≈ probabilidade risk-neutral de exercício — não é a probabilidade
              real, é a sob a medida que torna o ativo descontado um martingale.
            </Note>
            <Note title="Convexidade do comprador">
              Comprador de opção tem Γ &gt; 0 — em movimentos grandes, ganha mais do que perderia
              se o ativo voltasse simétrico. É o que justifica o prêmio.
            </Note>
            <Note title="Theta–Vega tradeoff">
              Comprador tem θ &lt; 0 e ν &gt; 0 — está pagando tempo para apostar que a vol realizada
              vai superar a implícita.
            </Note>
            <Note title="Rho é pequeno em curto prazo">
              Para opções de poucos meses, Rho é desprezível. Em opções longas (LEAPS), passa a
              ter peso similar a Vega.
            </Note>
          </div>
        </section>
      </div>
    </div>
  );
}

function SmallChart({
  title,
  data,
  series,
  S,
  pointKey,
  pointValue,
  fmtY,
}: {
  title: string;
  data: Array<Record<string, number>>;
  series: { key: string; color: string; name: string; strokeWidth?: number; dashed?: boolean }[];
  S: number;
  pointKey: string;
  pointValue: number;
  fmtY: (v: number) => string;
}) {
  return (
    <div>
      <div
        className="text-xs uppercase tracking-wider text-warm-gray"
        dangerouslySetInnerHTML={{ __html: title }}
      />
      <div className="mt-2 h-44">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ left: 4, right: 8, top: 6, bottom: 4 }}>
            <CartesianGrid stroke="#e8e4df" strokeDasharray="3 3" />
            <XAxis
              dataKey="s"
              type="number"
              domain={["dataMin", "dataMax"]}
              tick={{ fill: "#6b6460", fontSize: 10 }}
            />
            <YAxis tick={{ fill: "#6b6460", fontSize: 10 }} width={48} tickFormatter={fmtY} />
            <Tooltip
              formatter={(v: unknown) => fmtY(Number(v))}
              labelFormatter={(l: unknown) => `S = ${fmtCurrency(Number(l), 2)}`}
              contentStyle={{
                background: "#faf8f5",
                border: "1px solid #e8e4df",
                fontSize: 11,
              }}
            />
            <ReferenceLine x={S} stroke="#1a2744" strokeDasharray="3 3" />
            <ReferenceDot x={S} y={pointValue} r={4} fill="#1a2744" stroke="#faf8f5" strokeWidth={2} />
            {series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stroke={s.color}
                strokeWidth={s.strokeWidth ?? 2}
                strokeDasharray={s.dashed ? "4 3" : undefined}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ContribRow({
  label,
  color,
  value,
}: {
  label: string;
  color: string;
  value: number;
}) {
  return (
    <tr className="border-t border-light-border">
      <td className="px-4 py-2 text-left">
        <span style={{ color }}>{label}</span>
      </td>
      <td className="px-4 py-2 text-right text-text-secondary">
        {value >= 0 ? "+" : ""}
        {fmtCurrency(value, 4)}
      </td>
    </tr>
  );
}

function Note({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-light-border bg-cream/40 p-4">
      <div className="text-xs uppercase tracking-wider text-warm-gray">{title}</div>
      <p className="mt-2 text-sm text-text-secondary leading-relaxed">{children}</p>
    </div>
  );
}
