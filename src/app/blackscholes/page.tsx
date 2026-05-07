"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  blackScholes,
  greeks,
  intrinsicValue,
  moneyness,
} from "@/lib/blackscholes";
import type { MarketData, OptionInputs, OptionType } from "@/types/options";
import { cn, fmtCurrency, fmtNumber, fmtPct } from "@/lib/utils";
import { PriceRefreshButton } from "@/components/shared/price-refresh-button";
import { useSelic } from "@/lib/use-selic";
import { useExpiry } from "@/lib/use-expiry";
import { loadSharedInputs, saveSharedInput } from "@/lib/shared-inputs";
import { normCdf } from "@/lib/stats";
import { estimates } from "@/lib/volatility";

const MARKET_KEY = "opcoes-lab-market";
const SIGMA_KEY = "opcoes-lab-sigma";

type SigmaMethod = "hv21" | "hv63" | "hv252" | "hvCustom" | "garch" | "manual";

// Fallback quando o Módulo 1/2 ainda não rodou.
const FALLBACK_SIGMAS = [
  { key: "hv21" as const, label: "HV 21d", value: 0.324 },
  { key: "hv63" as const, label: "HV 63d", value: 0.351 },
  { key: "hv252" as const, label: "HV 252d", value: 0.388 },
];

const TRADING_DAYS = 252;

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

export default function BlackScholesPage() {
  const [S, setS] = useState(38.42);
  const [K, setK] = useState(38);
  const [Tdays, setTdays] = useState(45); // dias úteis
  const [r, setR] = useState(0.1075);
  const [sigma, setSigma] = useState(0.351);
  const [type, setType] = useState<OptionType>("call");
  const [sigmaSource, setSigmaSource] = useState<{
    method: SigmaMethod;
    sigmas: { key: SigmaMethod; label: string; value: number }[];
    ticker?: string;
  }>({ method: "hv63", sigmas: FALLBACK_SIGMAS });
  const [hydrated, setHydrated] = useState(false);

  // Hidrata Selic + Vencimento — só aplica se usuário não tiver override salvo.
  const selicMeta = useSelic((rate) => {
    if (loadSharedInputs().r == null) setR(rate);
  });
  const expiryInfo = useExpiry((du) => {
    if (loadSharedInputs().Tdays == null) setTdays(du);
  });

  // Hidratação principal: shared inputs > market/sigma keys > defaults
  useEffect(() => {
    const shared = loadSharedInputs();

    let nextSigmas = FALLBACK_SIGMAS as {
      key: SigmaMethod;
      label: string;
      value: number;
    }[];
    let ticker: string | undefined;
    let mdCurrentPrice: number | undefined;
    try {
      const raw = localStorage.getItem(MARKET_KEY);
      if (raw) {
        const md = JSON.parse(raw) as MarketData;
        if (md.history?.length >= 2) {
          const prices = md.history.map((h) => h.close);
          const est = estimates(prices);
          nextSigmas = [
            { key: "hv21", label: "HV 21d", value: est.hv21 },
            { key: "hv63", label: "HV 63d", value: est.hv63 },
            { key: "hv252", label: "HV 252d", value: est.hv252 },
          ];
          if (est.garch != null && isFinite(est.garch)) {
            nextSigmas.push({ key: "garch", label: "GARCH(1,1)", value: est.garch });
          }
          ticker = md.ticker;
          mdCurrentPrice = md.currentPrice;
        }
      }
    } catch {}

    let method: SigmaMethod = "hv63";
    let sigmaFromKey: number | null = null;
    try {
      const raw = localStorage.getItem(SIGMA_KEY);
      if (raw) {
        const sel = JSON.parse(raw) as { method: SigmaMethod; value: number };
        if (sel && Number.isFinite(sel.value)) {
          method = sel.method;
          sigmaFromKey = sel.value;
        }
      }
    } catch {}
    const sigmaFallback =
      sigmaFromKey ??
      nextSigmas.find((s) => s.key === method)?.value ??
      nextSigmas[1].value;

    setSigmaSource({ method, sigmas: nextSigmas, ticker });
    if (shared.S != null) setS(shared.S);
    else if (mdCurrentPrice != null) setS(mdCurrentPrice);
    if (shared.K != null) setK(shared.K);
    if (shared.Tdays != null) setTdays(shared.Tdays);
    if (shared.type != null) setType(shared.type);
    if (shared.r != null) setR(shared.r);
    if (shared.sigma != null) setSigma(shared.sigma);
    else setSigma(sigmaFallback);

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
  const VI = intrinsicValue(S, K, type);
  const VT = bs.price - VI;
  const m = moneyness(S, K, type);

  // Tabela por σ
  const sigmaRows = sigmaSource.sigmas.map((row) => {
    const callR = blackScholes({ ...inputs, sigma: row.value, type: "call" });
    const putR = blackScholes({ ...inputs, sigma: row.value, type: "put" });
    return {
      ...row,
      call: callR.price,
      put: putR.price,
      d1: callR.d1,
      d2: callR.d2,
      Nd2: normCdf(callR.d2),
    };
  });

  // Payoff chart: payoff vencimento, valor B&S hoje, valor B&S em T/2
  const payoffData = useMemo(() => {
    const lo = K * 0.5;
    const hi = K * 1.5;
    const N = 60;
    const data = [];
    for (let i = 0; i <= N; i++) {
      const s = lo + ((hi - lo) * i) / N;
      const payoff =
        type === "call" ? Math.max(s - K, 0) : Math.max(K - s, 0);
      const today = blackScholes({ ...inputs, S: s }).price;
      const half = blackScholes({ ...inputs, S: s, T: T / 2 }).price;
      data.push({
        s: Number(s.toFixed(2)),
        payoff,
        today,
        half,
      });
    }
    return data;
  }, [inputs, K, T, type]);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="text-[11px] uppercase tracking-[0.25em] text-warm-gray">Módulo 03</div>
      <h1 className="mt-3 text-4xl text-navy">Precificação Black-Scholes</h1>
      <div className="mt-3 h-px w-12 bg-gold" />
      <p className="mt-4 max-w-2xl text-text-secondary">
        Mesma opção, σ diferentes — preços diferentes. O mercado &ldquo;resolve&rdquo; isso pela volatilidade implícita.
      </p>

      <div className="mt-10 grid gap-8 lg:grid-cols-[320px_1fr]">
        {/* INPUTS */}
        <section className="space-y-5 rounded-lg border border-light-border bg-white p-6">
          <h2 className="text-2xl text-navy">Inputs</h2>
          <NumberField
            label="S — Preço atual"
            value={S}
            onChange={setS}
            step={0.01}
            suffix="R$"
            hint={
              <PriceRefreshButton ticker={sigmaSource.ticker} onPrice={setS} />
            }
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
        </section>

        {/* RESULTADOS */}
        <section className="space-y-8">
          {/* Cards principais */}
          <div className="grid gap-3 md:grid-cols-4">
            <Card label="Preço B&S" value={fmtCurrency(bs.price, 4)} accent="gold" />
            <Card label="Valor Intrínseco" value={fmtCurrency(VI, 4)} />
            <Card label="Valor Temporal" value={fmtCurrency(VT, 4)} />
            <Card
              label="Moneyness"
              value={m.state}
              hint={`${m.pct >= 0 ? "+" : ""}${(m.pct * 100).toFixed(2)}%`}
            />
          </div>

          {/* Tabela por σ */}
          <div className="overflow-hidden rounded-lg border border-light-border bg-white">
            <div className="border-b border-light-border bg-cream/50 px-5 py-3">
              <h3 className="text-lg text-navy">Preço por estimativa de σ</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-cream/30 text-xs uppercase tracking-wider text-warm-gray">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">σ</th>
                    <th className="px-4 py-2 text-right font-medium">Valor</th>
                    <th className="px-4 py-2 text-right font-medium">Call</th>
                    <th className="px-4 py-2 text-right font-medium">Put</th>
                    <th className="px-4 py-2 text-right font-medium">d1</th>
                    <th className="px-4 py-2 text-right font-medium">d2</th>
                    <th className="px-4 py-2 text-right font-medium">N(d2)</th>
                  </tr>
                </thead>
                <tbody className="font-numeric">
                  {sigmaRows.map((row) => {
                    const isSelected = Math.abs(row.value - sigma) < 1e-6;
                    return (
                      <tr
                        key={row.key}
                        className={cn(
                          "border-t border-light-border",
                          isSelected && "bg-b3-soft"
                        )}
                      >
                        <td className="px-4 py-2 text-left font-sans text-text-secondary">
                          {row.label}
                          {isSelected && (
                            <span className="ml-2 rounded bg-b3 px-1.5 py-0.5 text-[10px] font-semibold text-white font-sans">
                              ATIVO
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right">{fmtPct(row.value)}</td>
                        <td className="px-4 py-2 text-right">{fmtCurrency(row.call, 4)}</td>
                        <td className="px-4 py-2 text-right">{fmtCurrency(row.put, 4)}</td>
                        <td className="px-4 py-2 text-right text-text-secondary">
                          {fmtNumber(row.d1, 3)}
                        </td>
                        <td className="px-4 py-2 text-right text-text-secondary">
                          {fmtNumber(row.d2, 3)}
                        </td>
                        <td className="px-4 py-2 text-right">{fmtPct(row.Nd2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="border-t border-light-border bg-cream/30 px-5 py-2 text-xs text-text-muted">
              N(d2) = probabilidade risk-neutral de exercício da call.
            </p>
          </div>

          {/* Payoff chart */}
          <div className="rounded-lg border border-light-border bg-white p-5">
            <h3 className="text-lg text-navy">Payoff &amp; Valor B&amp;S</h3>
            <p className="text-xs text-text-muted">
              Vermelho = payoff no vencimento. Dourado = valor hoje. Cinza = T/2.
            </p>
            <div className="mt-4 h-72">
              <ResponsiveContainer>
                <LineChart data={payoffData} margin={{ left: 8, right: 16, top: 24, bottom: 4 }}>
                  <CartesianGrid stroke="#e8e4df" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="s"
                    type="number"
                    domain={["dataMin", "dataMax"]}
                    tick={{ fill: "#6b6460", fontSize: 11 }}
                    label={{ value: "S no vencimento (R$)", position: "insideBottom", offset: -2, fill: "#6b6460", fontSize: 11 }}
                  />
                  <YAxis tick={{ fill: "#6b6460", fontSize: 11 }} />
                  <Tooltip
                    formatter={(v: unknown) => fmtCurrency(Number(v), 2)}
                    labelFormatter={(l: unknown) => `S = ${fmtCurrency(Number(l), 2)}`}
                    contentStyle={{ background: "#faf8f5", border: "1px solid #e8e4df", fontSize: 12 }}
                  />
                  <ReferenceLine x={S} stroke="#1a2744" strokeDasharray="4 4" label={{ value: "S atual", fill: "#1a2744", fontSize: 11, position: "insideTop", offset: 8 }} />
                  <Line type="monotone" dataKey="payoff" name="Payoff" stroke="#b91c1c" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="today" name="Hoje" stroke="#b8860b" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="half" name="T/2" stroke="#8a8580" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Calculadora Interativa */}
          <div className="rounded-lg border border-light-border bg-white p-6">
            <h3 className="text-lg text-navy">Calculadora interativa</h3>
            <p className="text-xs text-text-muted">Mova os sliders — preço e gregas atualizam em tempo real.</p>

            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <Slider label="S" value={S} min={S * 0.5 || 0.5} max={S * 1.5 || 100} step={0.01}
                onChange={setS} fmt={(v) => fmtCurrency(v, 2)} />
              <Slider label="K" value={K} min={K * 0.5 || 0.5} max={K * 1.5 || 100} step={0.5}
                onChange={setK} fmt={(v) => fmtCurrency(v, 2)} />
              <Slider label="T (dias úteis)" value={Tdays} min={1} max={365} step={1}
                onChange={setTdays} fmt={(v) => `${v.toFixed(0)} d.u.`} />
              <Slider label="σ" value={sigma * 100} min={5} max={100} step={0.01}
                onChange={(v) => setSigma(v / 100)} fmt={(v) => `${v.toFixed(2)}%`} />
              <Slider label="r" value={r * 100} min={0} max={20} step={0.05}
                onChange={(v) => setR(v / 100)} fmt={(v) => `${v.toFixed(2)}%`} />
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-5 font-numeric">
              <Mini label="Preço" value={fmtCurrency(bs.price, 4)} />
              <Mini label="Δ" value={fmtNumber(g.delta, 4)} />
              <Mini label="Γ" value={fmtNumber(g.gamma, 4)} />
              <Mini label="θ /dia" value={fmtNumber(g.theta, 4)} />
              <Mini label="ν / 1%" value={fmtNumber(g.vega, 4)} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Card({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "gold";
}) {
  return (
    <div className="rounded-lg border border-light-border bg-white p-4">
      <div className="text-[10px] uppercase tracking-wider text-warm-gray">{label}</div>
      <div
        className={cn(
          "mt-1 text-2xl font-numeric",
          accent === "gold" ? "text-gold" : "text-navy"
        )}
      >
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-text-muted font-numeric">{hint}</div>}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-light-border bg-cream/40 px-3 py-2 text-center">
      <div className="text-[10px] uppercase tracking-wider text-warm-gray">{label}</div>
      <div className="text-base text-navy">{value}</div>
    </div>
  );
}
