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

/** Só a primeira letra maiúscula ("sábado, 26 de setembro" → "Sábado, 26 de setembro"). */
export const primeiraMaiuscula = (t: string) => (t ? t[0].toUpperCase() + t.slice(1) : t);

/** CPF (11 dígitos) → 000.000.000-00; CNPJ (14) → 00.000.000/0000-00; outro formato fica como foi digitado. */
export function formatarDocumento(doc: string | null | undefined): string {
  const t = (doc ?? "").trim();
  const d = t.replace(/\D/g, "");
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  return t;
}

/** "cpf", "cnpj" ou null pelo número de dígitos. */
export function tipoDocumento(doc: string | null | undefined): "cpf" | "cnpj" | null {
  const n = (doc ?? "").replace(/\D/g, "").length;
  return n === 11 ? "cpf" : n === 14 ? "cnpj" : null;
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "2026-09-30" → "30 de setembro de 2026" */
export function dataPorExtenso(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} de ${MESES[m - 1]} de ${a}`;
}

const UNIDADES = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "catorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CENTENAS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

function ate999(n: number): string {
  if (n === 100) return "cem";
  const c = Math.floor(n / 100);
  const r = n % 100;
  const partes: string[] = [];
  if (c) partes.push(CENTENAS[c]);
  if (r) partes.push(r < 20 ? UNIDADES[r] : [DEZENAS[Math.floor(r / 10)], UNIDADES[r % 10]].filter(Boolean).join(" e "));
  return partes.join(" e ");
}

function inteiroPorExtenso(n: number): string {
  if (n === 0) return "zero";
  const grupos = [
    { valor: Math.floor(n / 1_000_000) % 1000, um: "um milhão", varios: "milhões" },
    { valor: Math.floor(n / 1000) % 1000, um: "mil", varios: "mil" },
    { valor: n % 1000, um: "um", varios: "" },
  ];
  const partes = grupos
    .filter((g) => g.valor)
    .map((g) => (g.valor === 1 && g.varios !== "" ? g.um : `${ate999(g.valor)}${g.varios ? ` ${g.varios}` : ""}`));
  // "mil e cem", "dois mil e trinta"; "mil duzentos e trinta"
  const ultimo = n % 1000;
  if (partes.length > 1 && ultimo && (ultimo < 100 || ultimo % 100 === 0)) return `${partes.slice(0, -1).join(", ")} e ${partes.at(-1)}`;
  return partes.join(" ");
}

/** 150000 centavos → "mil e quinhentos reais" */
export function valorPorExtenso(centavos: number): string {
  const reais = Math.floor(centavos / 100);
  const cent = Math.round(centavos % 100);
  const partes: string[] = [];
  if (reais) partes.push(`${inteiroPorExtenso(reais)}${reais % 1_000_000 === 0 ? " de" : ""} ${reais === 1 ? "real" : "reais"}`);
  if (cent) partes.push(`${inteiroPorExtenso(cent)} ${cent === 1 ? "centavo" : "centavos"}`);
  return partes.join(" e ") || "zero reais";
}
