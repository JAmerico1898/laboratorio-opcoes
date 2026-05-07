import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();

type Quote = {
  date: Date;
  close: number | null;
  volume: number | null;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Period = "1mo" | "3mo" | "6mo" | "1y" | "2y" | "5y";

const PERIOD_TO_DAYS: Record<Period, number> = {
  "1mo": 31,
  "3mo": 93,
  "6mo": 186,
  "1y": 372,
  "2y": 744,
  "5y": 1860,
};

function normalizeSymbol(raw: string): string {
  const t = raw.trim().toUpperCase();
  if (!t) return t;
  if (t.includes(".")) return t;
  return `${t}.SA`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tickerRaw = searchParams.get("ticker") ?? "PETR4";
  const period = (searchParams.get("period") ?? "1y") as Period;

  const symbol = normalizeSymbol(tickerRaw);
  const days = PERIOD_TO_DAYS[period] ?? 372;
  const period1 = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    const result = (await yahooFinance.chart(symbol, {
      period1,
      interval: "1d",
    })) as { quotes?: Quote[] };

    const quotes: Quote[] = result.quotes ?? [];
    const history = quotes
      .filter(
        (q) =>
          q.date instanceof Date &&
          typeof q.close === "number" &&
          Number.isFinite(q.close) &&
          (q.volume ?? 0) > 0,
      )
      .map((q) => ({
        date: q.date.toISOString().slice(0, 10),
        close: Number((q.close as number).toFixed(4)),
      }));

    if (history.length === 0) {
      return NextResponse.json(
        { error: `Sem dados para ${tickerRaw}.` },
        { status: 404 },
      );
    }

    const last = history[history.length - 1];

    return NextResponse.json({
      ticker: tickerRaw.toUpperCase(),
      currentPrice: last.close,
      lastUpdated: last.date,
      history,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Erro ao consultar Yahoo Finance.";
    return NextResponse.json(
      { error: message, ticker: tickerRaw.toUpperCase() },
      { status: 502 },
    );
  }
}
