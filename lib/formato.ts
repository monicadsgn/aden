// Formatação e leitura de valores em pt-BR. Funções puras, sem estado.

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const num = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const num1 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

export function formatarMoeda(centavos: number | null | undefined): string {
  if (centavos == null || !Number.isFinite(centavos)) return "—";
  return brl.format(Math.round(centavos) / 100);
}

export function formatarNumero(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return num.format(v);
}

export function formatarHoras(h: number | null | undefined): string {
  if (h == null || !Number.isFinite(h)) return "—";
  return `${num1.format(h)} h`;
}

export function formatarPct(p: number | null | undefined): string {
  if (p == null || !Number.isFinite(p)) return "—";
  return `${num.format(p)}%`;
}

/** Converte texto digitado ("1.234,56", "1234.5", "R$ 10") em centavos. Vazio → null. */
export function lerMoeda(texto: string): number | null {
  const n = lerNumero(texto);
  return n == null ? null : Math.round(n * 100);
}

/** Converte texto digitado em número, aceitando vírgula decimal. Vazio → null. */
export function lerNumero(texto: string): number | null {
  let t = texto.replace(/[^\d,.\-]/g, "").trim();
  if (t === "" || t === "-") return null;
  if (t.includes(",")) {
    // formato brasileiro: ponto é milhar, vírgula é decimal
    t = t.replace(/\./g, "").replace(",", ".");
  } else if ((t.match(/\./g) ?? []).length > 1) {
    t = t.replace(/\./g, "");
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Centavos → texto editável ("1234,56"). null → "". */
export function moedaParaTexto(centavos: number | null | undefined): string {
  if (centavos == null) return "";
  return (centavos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function numeroParaTexto(v: number | null | undefined): string {
  if (v == null) return "";
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 4, useGrouping: false });
}

// ─── Tempo em minutos ───────────────────────────────────────────────────────
// A pessoa digita minutos (20 min, 40 min); por dentro o sistema guarda horas.

export function minutosParaHoras(min: number | null): number | null {
  return min == null ? null : min / 60;
}

export function horasParaMinutos(h: number | null | undefined): number | null {
  if (h == null || !Number.isFinite(h)) return null;
  // arredonda para não mostrar 19,99998 min por causa da divisão
  return Math.round(h * 60 * 1000) / 1000;
}

/** "40 min", "1 h 30 min", "2 h". Para tempo por entrega e medições. */
export function formatarDuracao(h: number | null | undefined): string {
  const min = horasParaMinutos(h);
  if (min == null) return "—";
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  const hh = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${hh} h ${r} min` : `${hh} h`;
}
