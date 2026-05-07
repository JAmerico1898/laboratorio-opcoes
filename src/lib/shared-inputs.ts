"use client";

// Persistência de inputs editados pelo usuário (S, K, Tdays, type, r, σ).
// Vale como override sobre as hidratações automáticas (market, expiry, selic, sigma).
// Permanece até ser sobrescrito ou removido manualmente do localStorage.
export const INPUTS_KEY = "opcoes-lab-inputs";

export interface SharedInputs {
  S?: number;
  K?: number;
  Tdays?: number;
  type?: "call" | "put";
  r?: number;
  sigma?: number;
}

export function loadSharedInputs(): SharedInputs {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(INPUTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed as SharedInputs;
    }
  } catch {}
  return {};
}

export function saveSharedInput<K extends keyof SharedInputs>(
  key: K,
  value: SharedInputs[K],
): void {
  if (typeof window === "undefined") return;
  try {
    const current = loadSharedInputs();
    if (value === undefined || value === null || (typeof value === "number" && !isFinite(value))) {
      delete current[key];
    } else {
      current[key] = value;
    }
    localStorage.setItem(INPUTS_KEY, JSON.stringify(current));
  } catch {}
}
