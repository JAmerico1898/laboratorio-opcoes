"use client";

import { useEffect, useState } from "react";
import { businessDaysBetween, parseISO } from "./business-days";

export const EXPIRY_KEY = "opcoes-lab-expiry";

// Hook compartilhado: lê o vencimento persistido pelo Módulo 2 e devolve o
// número de dias úteis até essa data. O callback `onResolve` é chamado uma
// vez no mount com o `du` calculado — quem usa pode pré-preencher seu Tdays
// local. Edições subsequentes no Tdays daquele módulo são overrides locais.
export function useExpiry(onResolve?: (du: number, expiryISO: string) => void) {
  const [info, setInfo] = useState<{ expiry: string; du: number } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(EXPIRY_KEY);
      if (!raw) return;
      const exp = parseISO(raw);
      if (!exp) return;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const du = Math.max(1, businessDaysBetween(today, exp));
      setInfo({ expiry: raw, du });
      onResolve?.(du, raw);
    } catch {}
    // captura inicial; mudanças posteriores em outras abas não disparam refetch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return info;
}
