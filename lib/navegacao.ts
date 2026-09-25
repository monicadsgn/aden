// Para onde leva o botão de cada aviso.

import type { DestinoAlerta, SecaoConfig } from "./calculo/tipos";

export function linkConfig(secao: SecaoConfig, campo?: string): string {
  return `/configuracoes?secao=${secao}${campo ? `&campo=${campo}` : ""}`;
}

/** Link do destino; null quando o destino é um bloco da própria tela (cenário). */
export function linkDoDestino(d: DestinoAlerta): string | null {
  return d.tipo === "config" ? linkConfig(d.secao, d.campo) : null;
}

/** Leva até um bloco do editor de cenário (os blocos têm id "cenario-<bloco>"). */
export function irParaBloco(bloco: string) {
  const el = document.getElementById(`cenario-${bloco}`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  el.classList.add("destaque-alvo");
  setTimeout(() => el.classList.remove("destaque-alvo"), 1800);
}

// ─── Passar um cenário de uma tela para outra (calculadora ↔ apresentação ↔ saúde) ──

const CHAVE_CENARIO = "aden:abrir-cenario";

export interface CenarioEmTransito {
  origem: "saude" | "apresentacao" | "calculadora";
  nome: string;
  cenarios: import("./calculo/tipos").Cenario[];
}

export function enviarCenario(c: CenarioEmTransito) {
  try {
    sessionStorage.setItem(CHAVE_CENARIO, JSON.stringify(c));
  } catch {
    // sem armazenamento: a outra tela abre vazia
  }
}

export function receberCenario(): CenarioEmTransito | null {
  try {
    const t = sessionStorage.getItem(CHAVE_CENARIO);
    if (!t) return null;
    sessionStorage.removeItem(CHAVE_CENARIO);
    return JSON.parse(t) as CenarioEmTransito;
  } catch {
    return null;
  }
}
