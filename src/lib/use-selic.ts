"use client";

import { useEffect, useState } from "react";

const SELIC_KEY = "opcoes-lab-selic";

interface SelicData {
  rate: number;        // decimal anualizado (ex: 0.15)
  ratePercent: number; // % anualizado (ex: 15.0)
  date: string;        // DD/MM/YYYY
  fetchedAt: number;   // epoch ms
}

// Hook compartilhado: busca a Meta Selic atual via /api/selic uma vez por
// sessão, mantém em localStorage por 24h para hidratação instantânea entre
// rotas e devolve `{ rate, date }` quando disponível.
export function useSelic(onResolve?: (rate: number) => void) {
  const [selic, setSelic] = useState<{ rate: number; date: string } | null>(null);

  useEffect(() => {
    let cancel = false;

    function apply(data: SelicData) {
      if (cancel || !isFinite(data.rate)) return;
      setSelic({ rate: data.rate, date: data.date });
      onResolve?.(data.rate);
    }

    try {
      const raw = localStorage.getItem(SELIC_KEY);
      if (raw) {
        const cached = JSON.parse(raw) as SelicData;
        const fresh = Date.now() - cached.fetchedAt < 24 * 60 * 60 * 1000;
        if (fresh && isFinite(cached.rate)) {
          apply(cached);
          return; // ainda fresca — sem refetch
        }
      }
    } catch {}

    fetch("/api/selic")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data || !isFinite(data.rate)) return;
        const stored: SelicData = {
          rate: data.rate,
          ratePercent: data.ratePercent,
          date: data.date,
          fetchedAt: Date.now(),
        };
        try {
          localStorage.setItem(SELIC_KEY, JSON.stringify(stored));
        } catch {}
        apply(stored);
      })
      .catch(() => {});

    return () => { cancel = true; };
    // onResolve é capturado no primeiro render — propósito proposital: queremos
    // um único disparo no mount. Quem precisar reagir a mudanças usa `selic`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return selic;
}
