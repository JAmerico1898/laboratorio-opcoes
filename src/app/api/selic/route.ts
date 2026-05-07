import { NextResponse } from "next/server";

// BCB SGS série 432 = Meta da Selic (taxa básica anualizada, em % a.a.)
// Endpoint público, sem autenticação, JSON.
// Doc: https://www3.bcb.gov.br/sgspub/JSP/sgsgeral/FachadaSGSPMS.jsp
const SGS_URL = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json";

// Cache no edge — Selic não muda no intra-dia.
export const revalidate = 3600; // 1h

export async function GET() {
  try {
    const res = await fetch(SGS_URL, {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `BCB SGS retornou ${res.status}` },
        { status: 502 },
      );
    }
    const arr = (await res.json()) as { data: string; valor: string }[];
    if (!Array.isArray(arr) || arr.length === 0) {
      return NextResponse.json({ error: "Resposta vazia do BCB" }, { status: 502 });
    }
    const last = arr[arr.length - 1];
    const valor = parseFloat(last.valor);
    if (!isFinite(valor)) {
      return NextResponse.json({ error: "Valor inválido" }, { status: 502 });
    }
    return NextResponse.json({
      rate: valor / 100,        // decimal anualizado (0.1500)
      ratePercent: valor,        // % anualizado (15.00)
      date: last.data,           // DD/MM/YYYY
      source: "BCB SGS 432 (Meta Selic)",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha ao buscar Selic" },
      { status: 502 },
    );
  }
}
