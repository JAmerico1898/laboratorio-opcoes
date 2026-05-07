"use client";

import { useState } from "react";
import type { MarketData } from "@/types/options";

const MARKET_KEY = "opcoes-lab-market";

interface Props {
  ticker?: string;
  onPrice: (price: number) => void;
  className?: string;
}

// Botão de refresh manual: busca a cotação mais recente via /api/market,
// atualiza o estado do consumidor e re-grava `currentPrice` + `lastUpdated`
// no localStorage preservando o histórico já carregado.
export function PriceRefreshButton({ ticker, onPrice, className }: Props) {
  const [busy, setBusy] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!ticker) return null;

  async function refresh() {
    if (!ticker || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/market?ticker=${encodeURIComponent(ticker)}&period=5d`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as MarketData;
      if (!isFinite(data.currentPrice)) throw new Error("preço inválido");
      onPrice(data.currentPrice);
      try {
        const raw = localStorage.getItem(MARKET_KEY);
        if (raw) {
          const stored = JSON.parse(raw) as MarketData;
          if (stored.ticker === data.ticker) {
            stored.currentPrice = data.currentPrice;
            stored.lastUpdated = data.lastUpdated;
            localStorage.setItem(MARKET_KEY, JSON.stringify(stored));
          } else {
            localStorage.setItem(MARKET_KEY, JSON.stringify(data));
          }
        } else {
          localStorage.setItem(MARKET_KEY, JSON.stringify(data));
        }
      } catch {}
      const now = new Date();
      setUpdatedAt(
        `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "erro");
    } finally {
      setBusy(false);
    }
  }

  const title = error
    ? `Erro: ${error}`
    : updatedAt
      ? `Última atualização ${updatedAt} • clique para buscar de novo`
      : `Buscar preço atual de ${ticker} (Yahoo Finance, ~15min de atraso)`;

  return (
    <button
      type="button"
      onClick={refresh}
      disabled={busy}
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-md border border-light-border bg-white px-2 py-1 text-[10px] uppercase tracking-wider text-text-secondary transition hover:border-gold hover:text-gold disabled:opacity-50 ${className ?? ""}`}
    >
      <span
        className={busy ? "inline-block animate-spin" : "inline-block"}
        aria-hidden
      >
        ↻
      </span>
      <span className="font-mono normal-case tracking-normal">
        {busy ? "..." : error ? "erro" : updatedAt ?? "atualizar"}
      </span>
    </button>
  );
}
