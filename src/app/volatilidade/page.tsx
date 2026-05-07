"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MarketData } from "@/types/options";
import {
  estimates,
  garch11,
  historicalVol,
  logReturns,
  moments,
  rollingHistoricalVol,
} from "@/lib/volatility";
import { normPdf } from "@/lib/stats";
import { addBusinessDays, businessDaysBetween, parseISO } from "@/lib/business-days";
import { EXPIRY_KEY } from "@/lib/use-expiry";
import { saveSharedInput } from "@/lib/shared-inputs";
import { cn, fmtNumber, fmtPct } from "@/lib/utils";

const MARKET_KEY = "opcoes-lab-market";
const SIGMA_KEY = "opcoes-lab-sigma";

type SigmaMethod = "hv21" | "hv63" | "hv252" | "hvCustom" | "garch" | "manual";

interface SigmaSelection {
  method: SigmaMethod;
  value: number; // valor anualizado em decimal (ex: 0.32)
}

const METHOD_LABELS: Record<SigmaMethod, string> = {
  hv21: "HV 21d",
  hv63: "HV 63d",
  hv252: "HV 252d",
  hvCustom: "HV prazo",
  garch: "GARCH(1,1)",
  manual: "Manual",
};

function fmtDateBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function recommendedFor(days: number): SigmaMethod {
  if (days <= 30) return "hv21";
  if (days <= 90) return "hv63";
  return "hv252";
}

export default function VolatilidadePage() {
  const [market, setMarket] = useState<MarketData | null>(null);
  // Vencimento como data; o número de dias úteis é derivado.
  const [expiry, setExpiry] = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = addBusinessDays(today, 45);
    const y = target.getFullYear();
    const m = String(target.getMonth() + 1).padStart(2, "0");
    const d = String(target.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  });
  const [expiryHydrated, setExpiryHydrated] = useState(false);

  // Hidrata vencimento salvo
  useEffect(() => {
    try {
      const raw = localStorage.getItem(EXPIRY_KEY);
      if (raw && parseISO(raw)) setExpiry(raw);
    } catch {}
    setExpiryHydrated(true);
  }, []);

  // Persiste vencimento (somente após hidratar, para não sobrescrever).
  // Também propaga d.u. para shared.Tdays — escolha em /volatilidade é
  // autoritativa e sobrescreve override local de outros módulos.
  useEffect(() => {
    if (!expiryHydrated) return;
    try {
      localStorage.setItem(EXPIRY_KEY, expiry);
    } catch {}
    const exp = parseISO(expiry);
    if (!exp) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const du = Math.max(1, businessDaysBetween(today, exp));
    saveSharedInput("Tdays", du);
  }, [expiry, expiryHydrated]);

  const horizon = useMemo(() => {
    const exp = parseISO(expiry);
    if (!exp) return 45;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.max(1, businessDaysBetween(today, exp));
  }, [expiry]);
  const [bins, setBins] = useState(20);
  const [selection, setSelection] = useState<SigmaSelection>({
    method: "hv63",
    value: 0.3,
  });
  const [manualInput, setManualInput] = useState(0.3);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate market data + sigma selection
  useEffect(() => {
    try {
      const raw = localStorage.getItem(MARKET_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as MarketData;
        if (parsed.history?.length) setMarket(parsed);
      }
    } catch {}
    try {
      const raw = localStorage.getItem(SIGMA_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SigmaSelection;
        if (parsed && Number.isFinite(parsed.value)) {
          setSelection(parsed);
          if (parsed.method === "manual") setManualInput(parsed.value);
        }
      }
    } catch {}
    setHydrated(true);
  }, []);

  // Persist selection — só após hidratar, para não sobrescrever o valor
  // existente com o estado inicial do componente. A escolha em /volatilidade
  // é autoritativa e também sobrescreve qualquer override local de σ nos
  // demais módulos (shared inputs).
  useEffect(() => {
    if (!hydrated || !Number.isFinite(selection.value)) return;
    try {
      localStorage.setItem(SIGMA_KEY, JSON.stringify(selection));
    } catch {}
    saveSharedInput("sigma", selection.value);
  }, [selection, hydrated]);

  const prices = useMemo(
    () => market?.history.map((h) => h.close) ?? [],
    [market]
  );
  const returns = useMemo(() => logReturns(prices), [prices]);
  const est = useMemo(
    () => (prices.length >= 2 ? estimates(prices) : null),
    [prices]
  );

  // GARCH(1,1) — MLE em browser. Roda quando há ≥ 30 retornos.
  const garchFit = useMemo(
    () => (returns.length >= 30 ? garch11(returns) : null),
    [returns]
  );

  // Janelas efetivas (capadas pelo histórico disponível)
  const effective = useMemo(() => {
    const n = returns.length;
    return {
      w21: Math.min(21, n),
      w63: Math.min(63, n),
      w252: Math.min(252, n),
    };
  }, [returns.length]);

  // Rolling vol — alinha por data
  const rollingData = useMemo(() => {
    if (!market || returns.length < 21) return [];
    const r21 = rollingHistoricalVol(returns, 21);
    const r63 = rollingHistoricalVol(returns, 63);
    const r252 = rollingHistoricalVol(returns, 252);
    const gPath = garchFit?.sigmaPath ?? null;
    // returns[i] corresponde a market.history[i+1]
    return returns.map((_, i) => ({
      date: market.history[i + 1]?.date ?? "",
      hv21: r21[i] != null ? (r21[i] as number) * 100 : null,
      hv63: r63[i] != null ? (r63[i] as number) * 100 : null,
      hv252: r252[i] != null ? (r252[i] as number) * 100 : null,
      garch: gPath ? gPath[i] * 100 : null,
    }));
  }, [market, returns, garchFit]);

  // Histograma + curva normal teórica
  const mom = useMemo(
    () => (returns.length >= 2 ? moments(returns) : null),
    [returns]
  );

  const histData = useMemo(() => {
    if (!returns.length || !mom) return [];
    const min = Math.min(...returns);
    const max = Math.max(...returns);
    const width = (max - min) / bins;
    if (width <= 0) return [];
    const counts = new Array(bins).fill(0);
    for (const r of returns) {
      let idx = Math.floor((r - min) / width);
      if (idx >= bins) idx = bins - 1;
      counts[idx]++;
    }
    const N = returns.length;
    const data: {
      bin: string;
      mid: number;
      count: number;
      density: number;
      normal: number;
    }[] = [];
    for (let i = 0; i < bins; i++) {
      const lo = min + i * width;
      const hi = lo + width;
      const mid = (lo + hi) / 2;
      const density = counts[i] / N / width; // densidade empírica
      const z = (mid - mom.mean) / mom.std;
      const normal = normPdf(z) / mom.std; // pdf normal mesma média/dp
      data.push({
        bin: `${(lo * 100).toFixed(2)}%`,
        mid,
        count: counts[i],
        density,
        normal,
      });
    }
    return data;
  }, [returns, mom, bins]);

  // HV exatamente no prazo da opção (janela = horizon d.u.)
  const hvCustomWindow = Math.min(horizon, returns.length);
  const hvCustomValue =
    returns.length >= 2 ? historicalVol(returns, hvCustomWindow) : NaN;
  const hasCustom =
    isFinite(hvCustomValue) &&
    horizon !== 21 &&
    horizon !== 63 &&
    horizon !== 252;
  const recMethod: SigmaMethod = hasCustom ? "hvCustom" : recommendedFor(horizon);

  function pickSigma(method: SigmaMethod, value: number) {
    setSelection({ method, value });
  }

  // Sem dados → banner
  if (!market || !est) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="text-[11px] uppercase tracking-[0.25em] text-warm-gray">
          Módulo 02
        </div>
        <h1 className="mt-3 text-4xl text-navy">Volatilidade</h1>
        <div className="mt-3 h-px w-12 bg-gold" />
        <div className="mt-10 rounded-lg border border-light-border bg-white p-8">
          <h2 className="text-xl text-navy">Sem dados de mercado carregados</h2>
          <p className="mt-3 text-text-secondary">
            Para calcular as estimativas de volatilidade você precisa primeiro
            carregar um ativo no Módulo 1.
          </p>
          <Link
            href="/mercado"
            className="mt-6 inline-flex items-center gap-2 rounded-md bg-navy px-4 py-2 text-sm text-white transition hover:bg-navy-light"
          >
            Ir para Dados de Mercado →
          </Link>
        </div>
      </div>
    );
  }

  const truncated = returns.length < 252;

  const rows: {
    key: SigmaMethod;
    label: string;
    window: string;
    sigma: number;
    use: string;
  }[] = [
    {
      key: "hv21",
      label: "HV Simples",
      window: `${effective.w21} dias`,
      sigma: est.hv21,
      use: "Opções com venc. ~1 mês",
    },
    {
      key: "hv63",
      label: "HV Simples",
      window: `${effective.w63} dias`,
      sigma: est.hv63,
      use: "Opções com venc. ~3 meses",
    },
    {
      key: "hv252",
      label: "HV Simples",
      window: `${effective.w252} dias`,
      sigma: est.hv252,
      use: "Referência histórica",
    },
  ];
  if (
    isFinite(hvCustomValue) &&
    horizon !== 21 &&
    horizon !== 63 &&
    horizon !== 252
  ) {
    rows.push({
      key: "hvCustom",
      label: "HV no prazo",
      window: `${hvCustomWindow} dias`,
      sigma: hvCustomValue,
      use: `Janela exata até o vencimento (${horizon} d.u.)`,
    });
  }
  if (garchFit && isFinite(garchFit.sigmaForecast)) {
    rows.push({
      key: "garch",
      label: "GARCH(1,1)",
      window: `MLE • ${returns.length} obs`,
      sigma: garchFit.sigmaForecast,
      use: "Forecast 1 passo, captura clusters",
    });
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* Header */}
      <div>
        <div className="text-[11px] uppercase tracking-[0.25em] text-warm-gray">
          Módulo 02
        </div>
        <h1 className="mt-3 text-4xl text-navy">Volatilidade</h1>
        <div className="mt-3 h-px w-12 bg-gold" />
        <p className="mt-4 max-w-3xl text-text-secondary">
          A volatilidade não é uma constante — depende do método e da janela.
          Cada escolha gera um preço diferente para a opção. Compare as
          estimativas abaixo e selecione qual σ propagar para os próximos
          módulos.
        </p>
      </div>

      {/* Ativo carregado */}
      <div className="flex flex-wrap items-baseline justify-between gap-4 rounded-lg border border-light-border bg-white px-5 py-4">
        <div className="flex items-baseline gap-6">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-warm-gray">
              Ativo
            </div>
            <div className="mt-0.5 font-mono text-xl text-navy">
              {market.ticker}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-warm-gray">
              Preço
            </div>
            <div className="mt-0.5 font-mono text-xl text-gold">
              R$ {fmtNumber(market.currentPrice, 2)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-warm-gray">
              Pregões
            </div>
            <div className="mt-0.5 font-mono text-xl text-text-secondary">
              {market.history.length}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-warm-gray">
              Atualizado
            </div>
            <div className="mt-0.5 font-mono text-sm text-text-secondary">
              {fmtDateBR(market.lastUpdated.slice(0, 10))}
            </div>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-text-secondary">
          <span>Vencimento:</span>
          <input
            type="date"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
            className="rounded-md border border-light-border bg-white px-2 py-1 font-mono text-sm focus:border-gold focus:outline-none"
          />
          <span className="font-mono text-text-muted">→</span>
          <span className="font-mono text-navy">{horizon} d.u.</span>
        </label>
      </div>

      {truncated && (
        <div className="rounded-md border border-gold/40 bg-gold/5 px-4 py-3 text-sm text-text-secondary">
          ⚠ Histórico de {returns.length} retornos é menor que 252. Janelas
          maiores que o disponível foram calculadas com o máximo possível.
        </div>
      )}

      {/* Linha 1 — tabela + rolling chart */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Tabela */}
        <div className="rounded-lg border border-light-border bg-white">
          <div className="border-b border-light-border px-5 py-3">
            <h2 className="text-sm uppercase tracking-wider text-navy">
              Estimativas de σ
            </h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-light-border text-left text-[11px] uppercase tracking-wider text-warm-gray">
                <th className="px-4 py-2 font-normal">Método</th>
                <th className="px-4 py-2 font-normal">Janela</th>
                <th className="px-4 py-2 text-right font-normal">σ a.a.</th>
                <th className="px-4 py-2 font-normal">Uso recomendado</th>
                <th className="px-4 py-2 font-normal" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isRec = row.key === recMethod;
                const isActive = selection.method === row.key;
                return (
                  <tr
                    key={row.key}
                    className={cn(
                      "border-b border-light-border last:border-0",
                      isRec && "bg-b3-soft/40"
                    )}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-text-secondary">{row.label}</span>
                        {isRec && (
                          <span className="rounded-sm bg-b3 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-white">
                            recomendado
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-text-secondary">
                      {row.window}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-navy">
                      {fmtPct(row.sigma, 1)}
                    </td>
                    <td className="px-4 py-3 text-text-muted">{row.use}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => pickSigma(row.key, row.sigma)}
                        className={cn(
                          "rounded-md border px-3 py-1 text-xs transition",
                          isActive
                            ? "border-gold bg-gold/10 text-gold"
                            : "border-light-border text-text-secondary hover:border-gold hover:text-gold"
                        )}
                      >
                        {isActive ? "Em uso" : "Usar"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {garchFit ? (
            <div className="border-t border-light-border bg-cream/50 px-5 py-3 text-[11px] text-text-muted">
              GARCH estimado por MLE Gaussiano (Nelder-Mead, {garchFit.iterations} iter,{" "}
              {garchFit.converged ? "convergiu" : "não convergiu"}). ω={garchFit.omega.toExponential(2)}, α={garchFit.alpha.toFixed(3)}, β={garchFit.beta.toFixed(3)}.
              Persistência α+β = {garchFit.persistence.toFixed(3)} → σ longo prazo {fmtPct(garchFit.longRunSigma, 1)}.
            </div>
          ) : (
            <div className="border-t border-light-border bg-cream/50 px-5 py-3 text-[11px] text-text-muted">
              GARCH(1,1) requer pelo menos 30 retornos — carregue mais histórico no Módulo 1.
            </div>
          )}
        </div>

        {/* Rolling vol */}
        <div className="rounded-lg border border-light-border bg-white p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm uppercase tracking-wider text-navy">
              Volatilidade em janela móvel
            </h2>
            <div className="flex gap-3 text-[11px] text-text-muted">
              <span className="flex items-center gap-1">
                <span className="h-2 w-3 bg-[#b8860b]" /> HV21
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-3 bg-[#1a2744]" /> HV63
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-3 bg-[#009b3a]" /> HV252
              </span>
              {garchFit && (
                <span className="flex items-center gap-1">
                  <span className="h-2 w-3 bg-[#a3387a]" /> GARCH
                </span>
              )}
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rollingData}>
                <CartesianGrid stroke="#e8e4df" strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "#8a8580" }}
                  tickFormatter={(d: string) => d.slice(5)}
                  minTickGap={40}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#8a8580" }}
                  tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                  width={48}
                />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    border: "1px solid #e8e4df",
                    borderRadius: 6,
                  }}
                  labelFormatter={(d) => fmtDateBR(String(d))}
                  formatter={
                    ((v: unknown) =>
                      v == null
                        ? "—"
                        : `${(v as number).toFixed(1)}%`) as unknown as never
                  }
                />
                <Line
                  type="monotone"
                  dataKey="hv21"
                  stroke="#b8860b"
                  strokeWidth={1.5}
                  dot={false}
                  connectNulls
                  name="HV21"
                />
                <Line
                  type="monotone"
                  dataKey="hv63"
                  stroke="#1a2744"
                  strokeWidth={1.5}
                  dot={false}
                  connectNulls
                  name="HV63"
                />
                <Line
                  type="monotone"
                  dataKey="hv252"
                  stroke="#009b3a"
                  strokeWidth={1.5}
                  dot={false}
                  connectNulls
                  name="HV252"
                />
                {garchFit && (
                  <Line
                    type="monotone"
                    dataKey="garch"
                    stroke="#a3387a"
                    strokeWidth={1.75}
                    strokeDasharray="4 2"
                    dot={false}
                    connectNulls
                    name="GARCH"
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-[11px] text-text-muted">
            Picos sincronizados nas três curvas evidenciam clusters de
            volatilidade — períodos de estresse onde σ realiza muito acima da
            média.
          </p>
        </div>
      </div>

      {/* Histograma */}
      <div className="rounded-lg border border-light-border bg-white p-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-sm uppercase tracking-wider text-navy">
            Distribuição dos retornos diários
          </h2>
          {mom && (
            <div className="flex gap-5 text-[11px] font-mono text-text-secondary">
              <span>
                <span className="text-text-muted">média </span>
                {fmtPct(mom.mean, 3)}
              </span>
              <span>
                <span className="text-text-muted">dp </span>
                {fmtPct(mom.std, 2)}
              </span>
              <span>
                <span className="text-text-muted">assimetria </span>
                {fmtNumber(mom.skew, 3)}
              </span>
              <span>
                <span className="text-text-muted">curtose ex. </span>
                {fmtNumber(mom.kurt, 3)}
              </span>
              <label className="flex items-center gap-1">
                <span className="text-text-muted">bins</span>
                <input
                  type="number"
                  min={5}
                  max={60}
                  value={bins}
                  onChange={(e) =>
                    setBins(
                      Math.max(5, Math.min(60, parseInt(e.target.value) || 20))
                    )
                  }
                  className="w-14 rounded border border-light-border bg-white px-2 py-0.5 text-right text-xs"
                />
              </label>
            </div>
          )}
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={histData}>
              <CartesianGrid stroke="#e8e4df" strokeDasharray="3 3" />
              <XAxis
                dataKey="bin"
                tick={{ fontSize: 10, fill: "#8a8580" }}
                interval={Math.max(0, Math.floor(bins / 8) - 1)}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 10, fill: "#8a8580" }}
                width={48}
              />
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  border: "1px solid #e8e4df",
                  borderRadius: 6,
                }}
                formatter={
                  ((v: unknown, name: unknown) => [
                    typeof v === "number" ? v.toFixed(3) : String(v),
                    String(name),
                  ]) as unknown as never
                }
              />
              <ReferenceLine
                yAxisId="left"
                x={
                  histData.length
                    ? histData.reduce((acc, d) =>
                        Math.abs(d.mid) < Math.abs(acc.mid) ? d : acc
                      ).bin
                    : undefined
                }
                stroke="#6b6460"
                strokeDasharray="2 2"
              />
              <Bar
                yAxisId="left"
                dataKey="density"
                fill="#1a2744"
                opacity={0.75}
                name="Empírica"
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="normal"
                stroke="#b8860b"
                strokeWidth={2}
                dot={false}
                name="Normal teórica"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-[11px] text-text-muted">
          Caudas mais gordas que a normal{" "}
          {mom && mom.kurt > 0.5 ? "(curtose positiva confirma)" : ""} →
          Black-Scholes subestima a probabilidade de movimentos extremos.
        </p>
      </div>

      {/* Seleção de σ */}
      <div className="rounded-lg border-2 border-navy bg-white p-5">
        <h2 className="text-sm uppercase tracking-wider text-navy">
          σ a propagar para o Módulo 3
        </h2>
        <p className="mt-1 text-xs text-text-muted">
          Persiste em <code>localStorage["opcoes-lab-sigma"]</code>.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-6">
          {(["hv21", "hv63", "hv252"] as const).map((m) => {
            const v = m === "hv21" ? est.hv21 : m === "hv63" ? est.hv63 : est.hv252;
            const active = selection.method === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => pickSigma(m, v)}
                className={cn(
                  "rounded-md border px-3 py-3 text-left transition",
                  active
                    ? "border-gold bg-gold/10"
                    : "border-light-border hover:border-gold"
                )}
              >
                <div className="text-[10px] uppercase tracking-wider text-warm-gray">
                  {METHOD_LABELS[m]}
                </div>
                <div
                  className={cn(
                    "mt-1 font-mono text-lg",
                    active ? "text-gold" : "text-navy"
                  )}
                >
                  {fmtPct(v, 1)}
                </div>
              </button>
            );
          })}
          {hasCustom && (
            <button
              type="button"
              onClick={() => pickSigma("hvCustom", hvCustomValue)}
              className={cn(
                "rounded-md border px-3 py-3 text-left transition",
                selection.method === "hvCustom"
                  ? "border-gold bg-gold/10"
                  : "border-light-border hover:border-gold"
              )}
              title={`Janela exata = ${hvCustomWindow} dias úteis (= prazo da opção)`}
            >
              <div className="text-[10px] uppercase tracking-wider text-warm-gray">
                HV {horizon}d
              </div>
              <div
                className={cn(
                  "mt-1 font-mono text-lg",
                  selection.method === "hvCustom" ? "text-gold" : "text-navy"
                )}
              >
                {fmtPct(hvCustomValue, 1)}
              </div>
              <div className="mt-0.5 text-[10px] text-text-muted">
                janela = prazo
              </div>
            </button>
          )}
          {garchFit && isFinite(garchFit.sigmaForecast) ? (
            <button
              type="button"
              onClick={() => pickSigma("garch", garchFit.sigmaForecast)}
              className={cn(
                "rounded-md border px-3 py-3 text-left transition",
                selection.method === "garch"
                  ? "border-gold bg-gold/10"
                  : "border-light-border hover:border-gold"
              )}
              title={`α=${garchFit.alpha.toFixed(3)}, β=${garchFit.beta.toFixed(3)}, persistência ${garchFit.persistence.toFixed(3)}`}
            >
              <div className="text-[10px] uppercase tracking-wider text-warm-gray">
                GARCH(1,1)
              </div>
              <div
                className={cn(
                  "mt-1 font-mono text-lg",
                  selection.method === "garch" ? "text-gold" : "text-navy"
                )}
              >
                {fmtPct(garchFit.sigmaForecast, 1)}
              </div>
              <div className="mt-0.5 text-[10px] text-text-muted">
                forecast 1 passo
              </div>
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="cursor-not-allowed rounded-md border border-dashed border-light-border px-3 py-3 text-left opacity-60"
              title="GARCH precisa de ≥ 30 retornos"
            >
              <div className="text-[10px] uppercase tracking-wider text-warm-gray">
                GARCH(1,1)
              </div>
              <div className="mt-1 font-mono text-lg text-text-muted">—</div>
              <div className="mt-0.5 text-[10px] text-text-muted">
                histórico curto
              </div>
            </button>
          )}
          <div
            className={cn(
              "rounded-md border px-3 py-3",
              selection.method === "manual"
                ? "border-gold bg-gold/10"
                : "border-light-border"
            )}
          >
            <label className="block">
              <div className="text-[10px] uppercase tracking-wider text-warm-gray">
                Manual
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <input
                  type="number"
                  step={0.01}
                  min={0.01}
                  max={5}
                  value={manualInput}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setManualInput(v);
                    if (Number.isFinite(v))
                      setSelection({ method: "manual", value: v });
                  }}
                  onFocus={() => {
                    if (Number.isFinite(manualInput))
                      setSelection({ method: "manual", value: manualInput });
                  }}
                  className="w-full bg-transparent font-mono text-lg text-navy focus:outline-none"
                />
                <span className="text-xs text-text-muted">a.a.</span>
              </div>
              <div className="mt-0.5 text-[10px] text-text-muted">
                {Number.isFinite(manualInput)
                  ? fmtPct(manualInput, 1)
                  : "—"}
              </div>
            </label>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-light-border pt-4">
          <div className="text-sm text-text-secondary">
            Selecionado:{" "}
            <span className="font-mono text-navy">
              {METHOD_LABELS[selection.method]}
            </span>{" "}
            ={" "}
            <span className="font-mono text-gold">
              {fmtPct(selection.value, 2)}
            </span>
          </div>
          <Link
            href="/blackscholes"
            className="inline-flex items-center gap-2 rounded-md bg-navy px-4 py-2 text-sm text-white transition hover:bg-navy-light"
          >
            Ir para Precificação →
          </Link>
        </div>
      </div>

      {/* Notas pedagógicas */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            q: "Por que log-retornos?",
            a: "Aditivos no tempo, simétricos para alta/baixa e mais próximos da normal — propriedades exigidas pela derivação de B&S.",
          },
          {
            q: "Por que 252 dias úteis?",
            a: "É o pregão B3 médio em um ano. σ refere-se ao tempo em que o ativo realiza preço — fins de semana não contam.",
          },
          {
            q: "Clusters de volatilidade",
            a: "Períodos turbulentos atraem mais turbulência. A própria existência desse efeito é o motivo de modelos como GARCH existirem.",
          },
          {
            q: "Por que a normal subestima caudas?",
            a: "Retornos reais têm curtose positiva. B&S, ao assumir log-normalidade, paga menos pelas opções OTM extremas que o mercado.",
          },
        ].map((n) => (
          <div
            key={n.q}
            className="rounded-md border border-light-border bg-white p-4"
          >
            <div className="text-xs font-medium text-navy">{n.q}</div>
            <p className="mt-2 text-[12px] leading-relaxed text-text-secondary">
              {n.a}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
