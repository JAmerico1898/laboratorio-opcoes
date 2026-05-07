"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MarketData } from "@/types/options";
import { cn, fmtCurrency, fmtPct } from "@/lib/utils";
import { saveSharedInput } from "@/lib/shared-inputs";

const QUICK_TICKERS = ["PETR4", "VALE3", "ITUB4", "BBDC4"];
const PERIODS = [
  { key: "1M", days: 21 },
  { key: "3M", days: 63 },
  { key: "6M", days: 126 },
  { key: "1A", days: 252 },
] as const;
type PeriodKey = (typeof PERIODS)[number]["key"];

const STORAGE_KEY = "opcoes-lab-market";

function pctChange(a: number, b: number): number {
  if (!a) return NaN;
  return (b - a) / a;
}

function fmtDateBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function parseCSV(text: string): { date: string; close: number }[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const header = lines[0].toLowerCase().split(",").map((s) => s.trim());
  const dateIdx = header.indexOf("date");
  const closeIdx = header.indexOf("close");
  if (dateIdx === -1 || closeIdx === -1) return [];
  const out: { date: string; close: number }[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",");
    const date = cells[dateIdx]?.trim();
    const close = parseFloat(cells[closeIdx]);
    if (date && Number.isFinite(close)) out.push({ date, close });
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

export default function MercadoPage() {
  const [ticker, setTicker] = useState("PETR4");
  const [data, setData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodKey>("1A");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as MarketData;
        if (parsed.history?.length) {
          setData(parsed);
          setTicker(parsed.ticker);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  async function load(t: string) {
    const sym = t.trim().toUpperCase();
    if (!sym) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/market?ticker=${encodeURIComponent(sym)}&period=1y`,
        { cache: "no-store" },
      );
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      const md = json as MarketData;
      setData(md);
      setTicker(md.ticker);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(md));
      } catch {
        // quota or unavailable — ignore
      }
      // Carga autoritativa: força a propagação do novo preço aos demais módulos,
      // sobrescrevendo qualquer override anterior do usuário.
      saveSharedInput("S", md.currentPrice);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }

  function handleCSV(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const history = parseCSV(String(reader.result ?? ""));
      if (!history.length) {
        setError("CSV inválido — esperado colunas 'date,close'.");
        return;
      }
      const last = history[history.length - 1];
      const md: MarketData = {
        ticker: ticker.toUpperCase() || "CSV",
        currentPrice: last.close,
        lastUpdated: last.date,
        history,
      };
      setData(md);
      setError(null);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(md));
      } catch {
        // ignore
      }
      saveSharedInput("S", md.currentPrice);
    };
    reader.readAsText(file);
  }

  const summary = useMemo(() => {
    if (!data?.history.length) return null;
    const h = data.history;
    const last = h[h.length - 1];
    const prev = h[h.length - 2] ?? last;
    const idx1m = Math.max(0, h.length - 1 - 21);
    const idx1y = 0;

    const hi52 = Math.max(...h.map((d) => d.close));
    const lo52 = Math.min(...h.map((d) => d.close));

    return {
      price: last.close,
      lastDate: last.date,
      d1: pctChange(prev.close, last.close),
      m1: pctChange(h[idx1m].close, last.close),
      y1: pctChange(h[idx1y].close, last.close),
      hi52,
      lo52,
      tradingDays: h.length,
    };
  }, [data]);

  const chartData = useMemo(() => {
    if (!data?.history.length) return [];
    const days = PERIODS.find((p) => p.key === period)!.days;
    const slice = data.history.slice(-days);
    return slice.map((d) => ({ date: d.date, close: d.close }));
  }, [data, period]);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="text-[11px] uppercase tracking-[0.25em] text-warm-gray">
        Módulo 01
      </div>
      <h1 className="mt-3 text-4xl text-navy">Dados de Mercado</h1>
      <div className="mt-3 h-px w-12 bg-gold" />
      <p className="mt-4 max-w-2xl text-text-secondary">
        Selecione um ativo da B3.
      </p>

      {/* Seletor de ticker */}
      <section className="mt-8 rounded-lg border border-light-border bg-white p-5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            load(ticker);
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <label className="block">
            <div className="text-xs uppercase tracking-wider text-warm-gray">
              Ticker
            </div>
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              className="font-numeric mt-1 w-40 rounded-md border border-light-border bg-white px-3 py-2 text-base uppercase text-text-primary outline-none focus:border-gold"
              placeholder="PETR4"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-navy px-5 py-2 text-sm text-cream transition hover:bg-navy/90 disabled:opacity-50"
          >
            {loading ? "Carregando…" : "Carregar"}
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">Atalhos:</span>
            {QUICK_TICKERS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setTicker(t);
                  load(t);
                }}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs transition",
                  ticker === t
                    ? "border-gold bg-cream text-navy"
                    : "border-light-border text-text-secondary hover:border-gold hover:text-navy",
                )}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="ml-auto">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleCSV(f);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-md border border-light-border px-3 py-1.5 text-xs text-text-secondary hover:border-gold hover:text-navy"
            >
              Upload CSV
            </button>
          </div>
        </form>

        {error && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <strong>Erro:</strong> {error}
            <button
              onClick={() => load(ticker)}
              className="ml-3 underline hover:no-underline"
            >
              Tentar novamente
            </button>
            <span className="ml-2 text-xs text-red-600">
              ou faça upload de CSV (colunas: date, close).
            </span>
          </div>
        )}
      </section>

      {/* Conteúdo */}
      {loading && !data && <Skeleton />}

      {!loading && !data && !error && (
        <div className="mt-10 rounded-lg border border-dashed border-light-border bg-cream/30 p-10 text-center text-text-secondary">
          Carregue um ativo para ver o painel e o gráfico.
        </div>
      )}

      {data && summary && (
        <>
          {/* Cards */}
          <section className="mt-8 grid gap-3 md:grid-cols-4">
            <Card
              label={`Preço — ${data.ticker}`}
              value={fmtCurrency(summary.price, 2)}
              hint={fmtDateBR(summary.lastDate)}
              accent="gold"
            />
            <Card
              label="Variação 1d"
              value={fmtPct(summary.d1)}
              tone={summary.d1}
            />
            <Card
              label="Variação 1m (≈21 d.u.)"
              value={fmtPct(summary.m1)}
              tone={summary.m1}
            />
            <Card
              label="Variação 1a"
              value={fmtPct(summary.y1)}
              tone={summary.y1}
            />
          </section>

          <section className="mt-3 grid gap-3 md:grid-cols-3">
            <Card label="Máximo 52s" value={fmtCurrency(summary.hi52, 2)} />
            <Card label="Mínimo 52s" value={fmtCurrency(summary.lo52, 2)} />
            <Card
              label="Dias com pregão"
              value={summary.tradingDays.toLocaleString("pt-BR")}
            />
          </section>

          {/* Gráfico */}
          <section className="mt-8 rounded-lg border border-light-border bg-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg text-navy">Histórico de fechamento</h3>
                <p className="text-xs text-text-muted">
                  Atualizado em {fmtDateBR(data.lastUpdated)}.
                </p>
              </div>
              <div className="inline-flex rounded-md border border-light-border bg-cream/50 p-1">
                {PERIODS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setPeriod(p.key)}
                    className={cn(
                      "rounded px-3 py-1 text-xs transition",
                      period === p.key
                        ? "bg-navy text-cream"
                        : "text-text-secondary hover:text-navy",
                    )}
                  >
                    {p.key}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 h-80">
              <ResponsiveContainer>
                <LineChart
                  data={chartData}
                  margin={{ left: 8, right: 16, top: 8, bottom: 4 }}
                >
                  <CartesianGrid stroke="#e8e4df" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#6b6460", fontSize: 11 }}
                    tickFormatter={(v: string) => v.slice(5)}
                    minTickGap={32}
                  />
                  <YAxis
                    tick={{ fill: "#6b6460", fontSize: 11 }}
                    domain={["auto", "auto"]}
                    tickFormatter={(v: number) =>
                      v.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                    }
                  />
                  <Tooltip
                    formatter={(v: unknown) => fmtCurrency(Number(v), 2)}
                    labelFormatter={(l: unknown) => fmtDateBR(String(l))}
                    contentStyle={{
                      background: "#faf8f5",
                      border: "1px solid #e8e4df",
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="close"
                    stroke="#b8860b"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Card({
  label,
  value,
  hint,
  accent,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "gold";
  tone?: number;
}) {
  const toneColor =
    tone === undefined || !Number.isFinite(tone)
      ? null
      : tone > 0
        ? "text-b3"
        : tone < 0
          ? "text-red-700"
          : "text-navy";
  return (
    <div className="rounded-lg border border-light-border bg-white p-4">
      <div className="text-[10px] uppercase tracking-wider text-warm-gray">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 font-numeric text-2xl",
          accent === "gold" ? "text-gold" : (toneColor ?? "text-navy"),
        )}
      >
        {value}
      </div>
      {hint && (
        <div className="mt-1 font-numeric text-xs text-text-muted">{hint}</div>
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="mt-8 space-y-3">
      <div className="grid gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-lg border border-light-border bg-cream/40"
          />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-lg border border-light-border bg-cream/40" />
    </div>
  );
}
