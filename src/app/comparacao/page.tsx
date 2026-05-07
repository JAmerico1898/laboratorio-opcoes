"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  blackScholes,
  impliedVolatility,
} from "@/lib/blackscholes";
import { estimates, historicalVol, logReturns } from "@/lib/volatility";
import type { MarketData, OptionType } from "@/types/options";
import { cn, fmtCurrency, fmtPct } from "@/lib/utils";
import { PriceRefreshButton } from "@/components/shared/price-refresh-button";
import { useSelic } from "@/lib/use-selic";
import { useExpiry } from "@/lib/use-expiry";
import { loadSharedInputs, saveSharedInput } from "@/lib/shared-inputs";

const MARKET_KEY = "opcoes-lab-market";
const SIGMA_KEY = "opcoes-lab-sigma";

type UserSigmaMethod = "hv21" | "hv63" | "hv252" | "hvCustom" | "garch" | "manual";
const USER_SIGMA_LABELS: Record<UserSigmaMethod, string> = {
  hv21: "HV 21d",
  hv63: "HV 63d",
  hv252: "HV 252d",
  hvCustom: "HV prazo",
  garch: "GARCH(1,1)",
  manual: "σ manual",
};
const TRADING_DAYS = 252;

const CALL_MONTHS = "ABCDEFGHIJKL";
const PUT_MONTHS = "MNOPQRSTUVWX";
const MONTH_NAMES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

type ParsedCode = {
  underlying: string;
  type: OptionType;
  monthIndex: number;
  monthName: string;
  strike: number;
};

function parseOptionCode(code: string): ParsedCode | null {
  const c = code.trim().toUpperCase();
  // [LETRAS][LETRA-MES][DIGITOS](opcional ,/. + dígitos)
  const m = c.match(/^([A-Z]+?)([A-Z])(\d+(?:[.,]\d+)?)$/);
  if (!m) return null;
  const [, prefix, monthLetter, strikeRaw] = m;
  let type: OptionType;
  let monthIndex: number;
  if (CALL_MONTHS.includes(monthLetter)) {
    type = "call";
    monthIndex = CALL_MONTHS.indexOf(monthLetter);
  } else if (PUT_MONTHS.includes(monthLetter)) {
    type = "put";
    monthIndex = PUT_MONTHS.indexOf(monthLetter);
  } else {
    return null;
  }
  let strike: number;
  if (strikeRaw.includes(",") || strikeRaw.includes(".")) {
    strike = parseFloat(strikeRaw.replace(",", "."));
  } else {
    const n = parseInt(strikeRaw, 10);
    // convenção B3: 3+ dígitos → divide por 10 (ex.: 280 → 28,00)
    strike = strikeRaw.length >= 3 ? n / 10 : n;
  }
  return {
    underlying: prefix,
    type,
    monthIndex,
    monthName: MONTH_NAMES[monthIndex],
    strike,
  };
}

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
          step={step}
          value={Number.isFinite(value) ? value : ""}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full bg-transparent px-3 py-2 font-mono text-sm text-navy outline-none"
        />
        {suffix && (
          <span className="pr-3 font-mono text-xs text-text-muted">{suffix}</span>
        )}
      </div>
    </label>
  );
}

type SmileRow = {
  id: string;
  strike: number;
  type: OptionType;
  premium: number;
};

type SigmaRow = {
  key: "hv21" | "hv63" | "hv252" | "hvCustom" | "garch" | "iv";
  label: string;
  value: number | null;
  highlight?: boolean;
};

function diffColor(diff: number) {
  if (Math.abs(diff) < 1e-6) return "text-warm-gray";
  return diff > 0 ? "text-b3" : "text-[color:var(--danger)]";
}

function Gauge({
  iv,
  refSigma,
  max = 0.8,
}: {
  iv: number | null;
  refSigma: number | null;
  max?: number;
}) {
  const hv63 = refSigma;
  const W = 280;
  const H = 170;
  const cx = W / 2;
  const cy = 150;
  const r = 110;

  const angleFor = (v: number) => {
    const t = Math.max(0, Math.min(1, v / max));
    return Math.PI - t * Math.PI; // 180° (esq) → 0° (dir)
  };

  const pointOnArc = (v: number, radius = r) => {
    const a = angleFor(v);
    return { x: cx + radius * Math.cos(a), y: cy - radius * Math.sin(a) };
  };

  const arcPath = (vStart: number, vEnd: number, radius = r) => {
    const p1 = pointOnArc(vStart, radius);
    const p2 = pointOnArc(vEnd, radius);
    const large = 0;
    const sweep = vEnd > vStart ? 0 : 1; // arc desenha esq→dir conforme v cresce
    return `M ${p1.x} ${p1.y} A ${radius} ${radius} 0 ${large} ${sweep} ${p2.x} ${p2.y}`;
  };

  const ticks = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8];

  const ivAngle = iv != null && Number.isFinite(iv) ? angleFor(iv) : null;
  const needleEnd = ivAngle != null
    ? { x: cx + (r - 10) * Math.cos(ivAngle), y: cy - (r - 10) * Math.sin(ivAngle) }
    : null;

  const greenLo = hv63 != null ? Math.max(0, hv63 - 0.05) : null;
  const greenHi = hv63 != null ? Math.min(max, hv63 + 0.05) : null;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block">
      {/* arco base */}
      <path
        d={arcPath(0, max)}
        fill="none"
        stroke="#e8e4df"
        strokeWidth={14}
        strokeLinecap="round"
      />
      {/* zona verde HV63 ± 5pp */}
      {greenLo != null && greenHi != null && greenHi > greenLo && (
        <path
          d={arcPath(greenLo, greenHi)}
          fill="none"
          stroke="#009b3a"
          strokeOpacity={0.35}
          strokeWidth={14}
          strokeLinecap="butt"
        />
      )}
      {/* ticks */}
      {ticks.map((t) => {
        const inner = pointOnArc(t, r - 10);
        const outer = pointOnArc(t, r + 4);
        const label = pointOnArc(t, r + 18);
        return (
          <g key={t}>
            <line
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke="#8a8580"
              strokeWidth={1}
            />
            <text
              x={label.x}
              y={label.y}
              fontSize={9}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#6b6460"
              fontFamily="JetBrains Mono, monospace"
            >
              {Math.round(t * 100)}
            </text>
          </g>
        );
      })}
      {/* agulha */}
      {needleEnd && (
        <g>
          <line
            x1={cx}
            y1={cy}
            x2={needleEnd.x}
            y2={needleEnd.y}
            stroke="#b8860b"
            strokeWidth={3}
            strokeLinecap="round"
          />
          <circle cx={cx} cy={cy} r={6} fill="#1a2744" />
        </g>
      )}
      {/* valor central */}
      <text
        x={cx}
        y={cy - 20}
        fontSize={20}
        textAnchor="middle"
        fill="#1a2744"
        fontFamily="JetBrains Mono, monospace"
        fontWeight={600}
      >
        {iv != null && Number.isFinite(iv) ? `${(iv * 100).toFixed(1)}%` : "—"}
      </text>
      <text
        x={cx}
        y={cy - 4}
        fontSize={9}
        textAnchor="middle"
        fill="#6b6460"
        letterSpacing={1.5}
      >
        VOL IMPLÍCITA
      </text>
    </svg>
  );
}

export default function ComparacaoPage() {
  // Inputs
  const [code, setCode] = useState("PETRG28");
  const [type, setType] = useState<OptionType>("call");
  const [K, setK] = useState(28);
  const [TDays, setTDays] = useState(45);
  const [r, setR] = useState(0.105);
  const [S, setS] = useState(30);
  const [marketPrice, setMarketPrice] = useState(2.15);

  // Hidratação
  const [market, setMarket] = useState<MarketData | null>(null);
  const [parseHint, setParseHint] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [userSigma, setUserSigma] = useState<{ value: number; method: UserSigmaMethod } | null>(null);
  const selicMeta = useSelic((rate) => {
    if (loadSharedInputs().r == null) setR(rate);
  });
  const expiryInfo = useExpiry((du) => {
    if (loadSharedInputs().Tdays == null) setTDays(du);
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const shared = loadSharedInputs();
    let mdCurrentPrice: number | undefined;
    try {
      const raw = localStorage.getItem(MARKET_KEY);
      if (raw) {
        const md = JSON.parse(raw) as MarketData;
        setMarket(md);
        mdCurrentPrice = md.currentPrice;
      }
    } catch {
      /* ignore */
    }
    if (shared.S != null) setS(shared.S);
    else if (mdCurrentPrice != null) setS(mdCurrentPrice);
    if (shared.K != null) setK(shared.K);
    if (shared.Tdays != null) setTDays(shared.Tdays);
    if (shared.type != null) setType(shared.type);
    if (shared.r != null) setR(shared.r);
    try {
      const rawSig = localStorage.getItem(SIGMA_KEY);
      if (rawSig) {
        const sel = JSON.parse(rawSig);
        if (sel && typeof sel.value === "number" && typeof sel.method === "string") {
          setUserSigma({ value: sel.value, method: sel.method as UserSigmaMethod });
        }
      }
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== SIGMA_KEY || !e.newValue) return;
      try {
        const sel = JSON.parse(e.newValue);
        if (sel && typeof sel.value === "number" && typeof sel.method === "string") {
          setUserSigma({ value: sel.value, method: sel.method as UserSigmaMethod });
        }
      } catch {}
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => { if (hydrated) saveSharedInput("S", S); }, [S, hydrated]);
  useEffect(() => { if (hydrated) saveSharedInput("K", K); }, [K, hydrated]);
  useEffect(() => { if (hydrated) saveSharedInput("Tdays", TDays); }, [TDays, hydrated]);
  useEffect(() => { if (hydrated) saveSharedInput("type", type); }, [type, hydrated]);
  useEffect(() => { if (hydrated) saveSharedInput("r", r); }, [r, hydrated]);

  const T = TDays / TRADING_DAYS;

  const closes = useMemo(
    () => (market?.history ?? []).map((p) => p.close),
    [market]
  );
  const hv = useMemo(() => {
    if (closes.length < 22) return null;
    return estimates(closes);
  }, [closes]);

  const ivBase = useMemo(
    () => ({ S, K, T, r, type }),
    [S, K, T, r, type]
  );

  const iv = useMemo(() => {
    if (!Number.isFinite(marketPrice) || marketPrice <= 0) return null;
    return impliedVolatility(marketPrice, ivBase);
  }, [marketPrice, ivBase]);

  function priceAt(sigma: number) {
    return blackScholes({ ...ivBase, sigma }).price;
  }

  const garchSigma: number | null =
    hv?.garch != null && isFinite(hv.garch) ? hv.garch : null;

  // HV exatamente no prazo da opção (janela = TDays)
  const hvCustomSigma: number | null = useMemo(() => {
    if (closes.length < 22 || TDays < 2) return null;
    const r = logReturns(closes);
    const w = Math.min(TDays, r.length);
    const v = historicalVol(r, w);
    return isFinite(v) ? v : null;
  }, [closes, TDays]);

  const sigmaRows: SigmaRow[] = useMemo(() => {
    const rows: SigmaRow[] = [];
    const push = (
      key: SigmaRow["key"],
      label: string,
      value: number | null
    ) => rows.push({ key, label, value });
    push("hv21", "HV 21d", hv?.hv21 ?? null);
    push("hv63", "HV 63d", hv?.hv63 ?? null);
    push("hv252", "HV 252d", hv?.hv252 ?? null);
    if (TDays !== 21 && TDays !== 63 && TDays !== 252) {
      push("hvCustom", `HV ${TDays}d (prazo)`, hvCustomSigma);
    }
    push("garch", "GARCH(1,1)", garchSigma);
    push("iv", "Vol Implícita", iv);
    return rows;
  }, [hv, iv, garchSigma, hvCustomSigma, TDays]);

  const handleParse = () => {
    const parsed = parseOptionCode(code);
    if (!parsed) {
      setParseHint("Código não reconhecido. Use formato B3 (ex.: PETRG28, VALEM52).");
      return;
    }
    setType(parsed.type);
    setK(parsed.strike);
    setParseHint(
      `Detectado: ${parsed.underlying} • ${parsed.type === "call" ? "Call" : "Put"} • venc. ${parsed.monthName} • strike ${fmtCurrency(parsed.strike)}.`
    );
  };

  // Scatter / curva B&S σ vs preço
  const curveData = useMemo(() => {
    const out: { sigma: number; price: number }[] = [];
    const sMax = 1.0;
    const steps = 60;
    for (let i = 0; i <= steps; i++) {
      const sigma = (i / steps) * sMax;
      if (sigma <= 0) continue;
      out.push({ sigma, price: priceAt(sigma) });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [S, K, T, r, type]);

  const scatterMethods = useMemo(() => {
    const pts: { sigma: number; price: number; label: string }[] = [];
    if (hv?.hv21) pts.push({ sigma: hv.hv21, price: priceAt(hv.hv21), label: "HV 21d" });
    if (hv?.hv63) pts.push({ sigma: hv.hv63, price: priceAt(hv.hv63), label: "HV 63d" });
    if (hv?.hv252) pts.push({ sigma: hv.hv252, price: priceAt(hv.hv252), label: "HV 252d" });
    if (garchSigma) pts.push({ sigma: garchSigma, price: priceAt(garchSigma), label: "GARCH" });
    return pts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hv, S, K, T, r, type]);

  const ivPoint = iv != null && Number.isFinite(iv)
    ? [{ sigma: iv, price: marketPrice, label: "IV" }]
    : [];

  // Smile multi-strike
  const [smile, setSmile] = useState<SmileRow[]>([
    { id: crypto.randomUUID(), strike: 28, type: "call", premium: 2.15 },
  ]);

  const smileRows = useMemo(() => {
    return smile.map((row) => {
      const rowIv = impliedVolatility(row.premium, {
        S,
        K: row.strike,
        T,
        r,
        type: row.type,
      });
      return { ...row, iv: rowIv };
    });
  }, [smile, S, T, r]);

  const smileChartData = useMemo(
    () =>
      smileRows
        .filter((row) => row.iv != null && Number.isFinite(row.iv))
        .sort((a, b) => a.strike - b.strike)
        .map((row) => ({ strike: row.strike, iv: (row.iv as number) * 100 })),
    [smileRows]
  );

  // Análise auto-gerada — escolhe a HV de janela mais próxima do prazo da opção.
  const analysis = useMemo(() => {
    if (iv == null || !hv) return null;

    // Janela recomendada conforme prazo (mesma lógica do Módulo 2)
    const ref =
      TDays <= 30
        ? { key: "HV21" as const, days: 21, value: hv.hv21 }
        : TDays <= 90
          ? { key: "HV63" as const, days: 63, value: hv.hv63 }
          : { key: "HV252" as const, days: 252, value: hv.hv252 };

    if (ref.value == null || !isFinite(ref.value)) return null;

    const ivPct = iv * 100;
    const hvPct = ref.value * 100;
    const diff = ivPct - hvPct;
    const direction = diff > 0 ? "acima" : "abaixo";

    const bsHv = priceAt(ref.value);
    const priceDiff = marketPrice - bsHv;
    const priceDiffPct = (priceDiff / bsHv) * 100;

    const interpretations: string[] = [];
    if (Math.abs(diff) < 2) {
      interpretations.push(
        `A IV está próxima da ${ref.key} — mercado e modelo estão razoavelmente alinhados.`,
      );
    } else if (diff > 5) {
      interpretations.push("O mercado antecipa volatilidade futura maior que a histórica recente.");
      interpretations.push("Pode haver evento esperado próximo ao vencimento (resultado, dividendo, decisão regulatória).");
      interpretations.push("Há possivelmente um prêmio de risco embutido.");
    } else if (diff < -5) {
      interpretations.push("O mercado precifica volatilidade abaixo da histórica — ambiente de baixa vol ou complacência.");
      interpretations.push("Pode haver pouca demanda por proteção / hedge no momento.");
    } else {
      interpretations.push("Pequeno desvio entre IV e HV — ruído de mercado ou ajuste fino de prêmio de risco.");
    }

    return {
      ivPct,
      hvPct,
      hvKey: ref.key,
      hvDays: ref.days,
      diff,
      direction,
      bsHv,
      priceDiff,
      priceDiffPct,
      interpretations,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iv, hv, marketPrice, S, K, T, r, type, TDays]);

  return (
    <div className="mx-auto max-w-7xl">
      <div className="text-[11px] uppercase tracking-[0.25em] text-warm-gray">Módulo 05</div>
      <h1 className="mt-3 text-4xl text-navy">Comparação com o Mercado</h1>
      <div className="mt-3 h-px w-12 bg-gold" />
      <p className="mt-4 max-w-3xl text-sm text-text-secondary">
        Compare o preço observado no home-broker com os preços teóricos de B&amp;S
        sob diferentes σ. A diferença revela como o mercado está precificando a incerteza.
      </p>

      {/* INPUTS */}
      <section className="mt-8 rounded-lg border border-light-border bg-white p-6 shadow-sm">
        <h2 className="text-sm uppercase tracking-wider text-warm-gray">Dados da opção</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs uppercase tracking-wider text-warm-gray">Código B3</span>
              <span className="text-[10px] text-text-muted">ex.: PETRG28, VALEM52</span>
            </div>
            <div className="mt-1 flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleParse();
                }}
                className="w-full rounded-md border border-light-border bg-white px-3 py-2 font-mono text-sm uppercase text-navy outline-none focus:border-gold"
              />
              <button
                onClick={handleParse}
                className="rounded-md bg-navy px-4 py-2 text-xs uppercase tracking-wider text-cream hover:bg-navy-light"
              >
                Parse
              </button>
            </div>
            {parseHint && (
              <p className="mt-2 text-[11px] text-text-muted">{parseHint}</p>
            )}
          </div>
          <NumberField label="Strike (K)" value={K} onChange={setK} suffix="R$" />
          <NumberField
            label="Vencimento"
            value={TDays}
            onChange={setTDays}
            step={1}
            suffix="d.u."
            hint={
              expiryInfo
                ? expiryInfo.expiry.split("-").reverse().join("/")
                : "dias úteis"
            }
          />
          <NumberField
            label="Prêmio observado"
            value={marketPrice}
            onChange={setMarketPrice}
            suffix="R$"
            hint="home-broker"
          />
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr_1fr_1fr]">
          <div>
            <div className="text-xs uppercase tracking-wider text-warm-gray">Tipo</div>
            <div className="mt-1 flex rounded-md border border-light-border bg-white p-1">
              {(["call", "put"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={cn(
                    "flex-1 rounded px-3 py-1.5 text-xs uppercase tracking-wider transition-colors",
                    type === t ? "bg-navy text-cream" : "text-text-secondary hover:text-navy"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <NumberField
            label="S (ativo)"
            value={S}
            onChange={setS}
            suffix="R$"
            hint={
              market ? (
                <PriceRefreshButton ticker={market.ticker} onPrice={setS} />
              ) : (
                "manual"
              )
            }
          />
          <NumberField
            label="r (taxa livre)"
            value={r}
            onChange={setR}
            step={0.001}
            suffix="a.a."
            hint={selicMeta ? `BCB ${selicMeta.date}` : undefined}
          />
          <div className="flex flex-col justify-end">
            <div className="text-[11px] text-text-muted">
              {market
                ? `${market.ticker} carregado em ${new Date(market.lastUpdated).toLocaleDateString("pt-BR")}`
                : "Sem dados de mercado — carregue um ticker no Módulo 1."}
            </div>
          </div>
        </div>
      </section>

      {/* TABELA DE COMPARAÇÃO */}
      <section className="mt-8 rounded-lg border border-light-border bg-white p-6 shadow-sm">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm uppercase tracking-wider text-warm-gray">
            Comparação: σ × preço teórico × mercado
          </h2>
          {iv != null && Number.isFinite(iv) && (
            <div className="font-mono text-sm text-navy">
              IV = <span className="text-gold">{fmtPct(iv)}</span>
            </div>
          )}
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-light-border text-left text-[11px] uppercase tracking-wider text-text-muted">
                <th className="py-2 pr-4">Método σ</th>
                <th className="py-2 pr-4">σ usado</th>
                <th className="py-2 pr-4">Preço teórico</th>
                <th className="py-2 pr-4">Preço mercado</th>
                <th className="py-2 pr-4">Δ R$</th>
                <th className="py-2 pr-4">Δ %</th>
              </tr>
            </thead>
            <tbody className="font-mono text-navy">
              {sigmaRows.map((row) => {
                const isIv = row.key === "iv";
                const sigma = row.value;
                const teorico =
                  sigma != null && Number.isFinite(sigma) ? priceAt(sigma) : null;
                const diff =
                  teorico != null ? marketPrice - teorico : null;
                const diffPct =
                  diff != null && teorico ? (diff / teorico) * 100 : null;
                const unavailable = sigma == null;
                return (
                  <tr
                    key={row.key}
                    className={cn(
                      "border-b border-light-border/60",
                      isIv && "bg-[color:var(--b3-green-soft)] font-semibold"
                    )}
                  >
                    <td className="py-2 pr-4">
                      {row.label}
                      {row.key === "garch" && unavailable && (
                        <span className="ml-2 rounded bg-light-border px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-text-muted">
                          n/d
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      {unavailable ? "—" : fmtPct(sigma!)}
                    </td>
                    <td className="py-2 pr-4">
                      {teorico == null ? "—" : fmtCurrency(teorico, 4)}
                    </td>
                    <td className="py-2 pr-4">{fmtCurrency(marketPrice, 4)}</td>
                    <td className={cn("py-2 pr-4", diff != null && diffColor(diff))}>
                      {diff == null ? "—" : `${diff > 0 ? "+" : ""}${fmtCurrency(diff, 4)}`}
                    </td>
                    <td className={cn("py-2 pr-4", diffPct != null && diffColor(diffPct))}>
                      {diffPct == null ? "—" : `${diffPct > 0 ? "+" : ""}${diffPct.toFixed(2)}%`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!hv && (
          <p className="mt-3 text-[11px] text-text-muted">
            Sem histórico carregado — vá ao <span className="text-navy">Módulo 1</span> para
            obter HV21/HV63/HV252 reais.
          </p>
        )}
      </section>

      {/* GAUGE + SCATTER */}
      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-light-border bg-white p-6 shadow-sm">
          <h2 className="text-sm uppercase tracking-wider text-warm-gray">
            Gauge de volatilidade
          </h2>
          <div className="mt-4 flex justify-center">
            <Gauge iv={iv} refSigma={userSigma?.value ?? null} />
          </div>
          {iv != null && userSigma != null && (
            <p className="mt-3 text-center text-xs text-text-secondary">
              Mercado precificando σ de{" "}
              <span className="font-mono text-navy">{fmtPct(iv)}</span> —{" "}
              {iv > userSigma.value ? "acima" : "abaixo"} da {USER_SIGMA_LABELS[userSigma.method]} ({fmtPct(userSigma.value)}).
            </p>
          )}
          {userSigma != null && (
            <div className="mt-2 text-center text-[10px] text-text-muted">
              Zona verde = {USER_SIGMA_LABELS[userSigma.method]} ± 5 p.p.
            </div>
          )}
        </div>

        <div className="rounded-lg border border-light-border bg-white p-6 shadow-sm">
          <h2 className="text-sm uppercase tracking-wider text-warm-gray">
            σ vs prêmio (curva B&amp;S)
          </h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={curveData} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8e4df" />
                <XAxis
                  type="number"
                  dataKey="sigma"
                  domain={[0, 1]}
                  tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                  tick={{ fontSize: 10, fill: "#6b6460" }}
                  label={{ value: "σ", position: "insideBottom", offset: -2, fontSize: 10, fill: "#6b6460" }}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#6b6460" }}
                  tickFormatter={(v) => `R$ ${Number(v).toFixed(2)}`}
                />
                <Tooltip
                  formatter={(v: unknown) => [fmtCurrency(v as number, 4), "Preço B&S"]}
                  labelFormatter={(v) => `σ = ${((v as number) * 100).toFixed(1)}%`}
                />
                <ReferenceLine
                  y={marketPrice}
                  stroke="#b91c1c"
                  strokeDasharray="4 4"
                  label={{ value: "Preço mercado", position: "right", fontSize: 10, fill: "#b91c1c" }}
                />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke="#1a2744"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
                <Scatter data={scatterMethods} fill="#1d4ed8" shape="circle" />
                <Scatter data={ivPoint} fill="#b8860b" shape="diamond" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-text-muted">
            <span><span className="inline-block h-2 w-2 rounded-full bg-[#1d4ed8]" /> Estimativas históricas</span>
            <span><span className="inline-block h-2 w-2 rotate-45 bg-gold" /> Vol implícita</span>
            <span>—— curva B&amp;S</span>
          </div>
        </div>
      </section>

      {/* ANÁLISE */}
      {analysis && (
        <section className="mt-8 rounded-lg border border-light-border bg-cream p-6 shadow-sm">
          <h2 className="text-sm uppercase tracking-wider text-warm-gray">
            Análise de divergência
          </h2>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-text-secondary">
            <p>
              O preço de mercado de{" "}
              <span className="font-mono text-navy">{fmtCurrency(marketPrice, 2)}</span> está{" "}
              <span className="font-mono text-navy">
                {analysis.priceDiffPct >= 0 ? "+" : ""}
                {analysis.priceDiffPct.toFixed(1)}%
              </span>{" "}
              em relação ao preço teórico calculado com {analysis.hvKey} ({fmtCurrency(analysis.bsHv, 2)})
              — janela escolhida por ser a mais próxima do prazo de {TDays} d.u. até o vencimento.
            </p>
            <p>
              A volatilidade implícita é{" "}
              <span className="font-mono text-gold">{analysis.ivPct.toFixed(1)}%</span>,
              enquanto a volatilidade histórica de {analysis.hvDays} dias é{" "}
              <span className="font-mono text-navy">{analysis.hvPct.toFixed(1)}%</span> — uma
              diferença de{" "}
              <span className="font-mono text-navy">
                {analysis.diff >= 0 ? "+" : ""}
                {analysis.diff.toFixed(1)} p.p.
              </span>{" "}
              ({analysis.direction} da histórica).
            </p>
            <div>
              <div className="mb-1 text-xs uppercase tracking-wider text-warm-gray">
                Possíveis interpretações
              </div>
              <ul className="ml-5 list-disc space-y-1">
                {analysis.interpretations.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* SMILE */}
      <section className="mt-8 rounded-lg border border-light-border bg-white p-6 shadow-sm">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm uppercase tracking-wider text-warm-gray">
            Avançado: smile de volatilidade
          </h2>
          <button
            onClick={() =>
              setSmile((rows) => [
                ...rows,
                {
                  id: crypto.randomUUID(),
                  strike: K,
                  type,
                  premium: marketPrice,
                },
              ])
            }
            className="rounded-md border border-light-border px-3 py-1.5 text-[11px] uppercase tracking-wider text-navy hover:border-gold hover:text-gold"
          >
            + adicionar strike
          </button>
        </div>
        <p className="mt-2 text-xs text-text-muted">
          Insira vários prêmios observados para o mesmo vencimento. A IV de cada
          strike revela o smile/skew — B&amp;S pressupõe σ constante; o mercado revela o contrário.
        </p>

        <div className="mt-4 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-light-border text-left text-[11px] uppercase tracking-wider text-text-muted">
                  <th className="py-2 pr-2">Strike</th>
                  <th className="py-2 pr-2">Tipo</th>
                  <th className="py-2 pr-2">Prêmio</th>
                  <th className="py-2 pr-2">IV</th>
                  <th className="py-2 pr-2"></th>
                </tr>
              </thead>
              <tbody className="font-mono text-navy">
                {smileRows.map((row) => (
                  <tr key={row.id} className="border-b border-light-border/60">
                    <td className="py-1 pr-2">
                      <input
                        type="number"
                        step={0.5}
                        value={row.strike}
                        onChange={(e) =>
                          setSmile((rows) =>
                            rows.map((r) =>
                              r.id === row.id
                                ? { ...r, strike: parseFloat(e.target.value) }
                                : r
                            )
                          )
                        }
                        className="w-24 rounded border border-light-border bg-white px-2 py-1 text-sm outline-none focus:border-gold"
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <select
                        value={row.type}
                        onChange={(e) =>
                          setSmile((rows) =>
                            rows.map((r) =>
                              r.id === row.id
                                ? { ...r, type: e.target.value as OptionType }
                                : r
                            )
                          )
                        }
                        className="rounded border border-light-border bg-white px-2 py-1 text-sm outline-none focus:border-gold"
                      >
                        <option value="call">Call</option>
                        <option value="put">Put</option>
                      </select>
                    </td>
                    <td className="py-1 pr-2">
                      <input
                        type="number"
                        step={0.01}
                        value={row.premium}
                        onChange={(e) =>
                          setSmile((rows) =>
                            rows.map((r) =>
                              r.id === row.id
                                ? { ...r, premium: parseFloat(e.target.value) }
                                : r
                            )
                          )
                        }
                        className="w-24 rounded border border-light-border bg-white px-2 py-1 text-sm outline-none focus:border-gold"
                      />
                    </td>
                    <td className="py-1 pr-2">
                      {row.iv == null || !Number.isFinite(row.iv)
                        ? "—"
                        : fmtPct(row.iv)}
                    </td>
                    <td className="py-1 pr-2">
                      <button
                        onClick={() =>
                          setSmile((rows) => rows.filter((r) => r.id !== row.id))
                        }
                        className="text-[11px] text-text-muted hover:text-[color:var(--danger)]"
                      >
                        remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="h-72">
            {smileChartData.length >= 2 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={smileChartData} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8e4df" />
                  <XAxis
                    dataKey="strike"
                    type="number"
                    domain={["dataMin", "dataMax"]}
                    tick={{ fontSize: 10, fill: "#6b6460" }}
                    label={{ value: "Strike (R$)", position: "insideBottom", offset: -2, fontSize: 10, fill: "#6b6460" }}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#6b6460" }}
                    tickFormatter={(v) => `${Number(v).toFixed(0)}%`}
                    label={{ value: "IV", angle: -90, position: "insideLeft", fontSize: 10, fill: "#6b6460" }}
                  />
                  <Tooltip
                    formatter={(v: unknown) => [`${(v as number).toFixed(2)}%`, "IV"]}
                    labelFormatter={(v) => `K = ${fmtCurrency(v as number, 2)}`}
                  />
                  <ReferenceLine
                    x={S}
                    stroke="#b8860b"
                    strokeDasharray="4 4"
                    label={{ value: "S", position: "top", fontSize: 10, fill: "#b8860b" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="iv"
                    stroke="#1a2744"
                    strokeWidth={2}
                    dot={{ r: 4, fill: "#b8860b" }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded-md border border-dashed border-light-border text-xs text-text-muted">
                Adicione 2+ strikes para visualizar o smile.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* NOTAS PEDAGÓGICAS */}
      <section className="mt-8 grid gap-4 md:grid-cols-3">
        {[
          {
            title: "IV é consenso, não previsão",
            body:
              "A volatilidade implícita é o σ que faz B&S igualar o preço de mercado — ela reflete o que o mercado está pagando, não uma previsão pontual.",
          },
          {
            title: "Smile = medo assimétrico",
            body:
              "Strikes OTM (proteção) tendem a ter IV maior. O mercado cobra mais por hedge contra eventos extremos — algo que B&S não captura.",
          },
          {
            title: "IV > HV ≠ opção cara",
            body:
              "Pode refletir risco evento (resultado, decisão regulatória) ainda não capturado pelo histórico. Antes de operar, investigue o catalisador.",
          },
        ].map((n) => (
          <div key={n.title} className="rounded-lg border border-light-border bg-white p-5 shadow-sm">
            <div className="text-xs uppercase tracking-wider text-gold">{n.title}</div>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">{n.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
