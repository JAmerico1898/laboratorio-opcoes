// Feriados nacionais + B3 para 2025-2028 (datas em ISO YYYY-MM-DD).
// Inclui Carnaval (segunda + terça), Sexta-Feira Santa, Corpus Christi
// — datas variáveis calculadas a partir da Páscoa.
// B3 não opera em feriados nacionais nem nas datas listadas.
const B3_HOLIDAYS: Record<string, true> = Object.fromEntries(
  [
    // 2025
    "2025-01-01", "2025-03-03", "2025-03-04", "2025-04-18", "2025-04-21",
    "2025-05-01", "2025-06-19", "2025-09-07", "2025-10-12", "2025-11-02",
    "2025-11-15", "2025-11-20", "2025-12-24", "2025-12-25", "2025-12-31",
    // 2026
    "2026-01-01", "2026-02-16", "2026-02-17", "2026-04-03", "2026-04-21",
    "2026-05-01", "2026-06-04", "2026-09-07", "2026-10-12", "2026-11-02",
    "2026-11-15", "2026-11-20", "2026-12-24", "2026-12-25", "2026-12-31",
    // 2027
    "2027-01-01", "2027-02-08", "2027-02-09", "2027-03-26", "2027-04-21",
    "2027-05-01", "2027-05-27", "2027-09-07", "2027-10-12", "2027-11-02",
    "2027-11-15", "2027-11-20", "2027-12-24", "2027-12-25", "2027-12-31",
    // 2028
    "2028-01-01", "2028-02-28", "2028-02-29", "2028-04-14", "2028-04-21",
    "2028-05-01", "2028-06-15", "2028-09-07", "2028-10-12", "2028-11-02",
    "2028-11-15", "2028-11-20", "2028-12-25",
  ].map((d) => [d, true as const]),
);

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isBusinessDay(d: Date): boolean {
  const dow = d.getDay(); // 0 = domingo, 6 = sábado
  if (dow === 0 || dow === 6) return false;
  return !B3_HOLIDAYS[toISO(d)];
}

// Conta dias úteis no intervalo (from, to], i.e. excluindo `from` e incluindo `to`.
// Convenção comum em precificação de opções: "T dias úteis até o vencimento"
// significa o vencimento conta como 1 dia útil restante.
// Retorna 0 se to <= from.
export function businessDaysBetween(from: Date, to: Date): number {
  if (to <= from) return 0;
  const cur = new Date(from);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  let count = 0;
  cur.setDate(cur.getDate() + 1);
  while (cur <= end) {
    if (isBusinessDay(cur)) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

export function todayISO(): string {
  return toISO(new Date());
}

// Retorna ISO da data N dias úteis à frente de hoje (ou a partir de `from`).
export function addBusinessDays(from: Date, n: number): Date {
  const cur = new Date(from);
  let added = 0;
  while (added < n) {
    cur.setDate(cur.getDate() + 1);
    if (isBusinessDay(cur)) added++;
  }
  return cur;
}

export function parseISO(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const [, y, mo, d] = m;
  const dt = new Date(Number(y), Number(mo) - 1, Number(d));
  return isNaN(dt.getTime()) ? null : dt;
}
