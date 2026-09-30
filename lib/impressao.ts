// O que vai para a tela de impressão (PDF). Fica no navegador de quem exporta.

import type { Cenario } from "./calculo/tipos";

const CHAVE = "aden:imprimir";

export type ParaImprimir = { tipo: "proposta"; cenario: Cenario; clienteNome: string; valorCentavos: number };

export function guardarParaImprimir(p: ParaImprimir) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(p));
  } catch {
    // sem armazenamento: a tela de impressão avisa
  }
}

export function lerParaImprimir(): ParaImprimir | null {
  try {
    const t = localStorage.getItem(CHAVE);
    return t ? (JSON.parse(t) as ParaImprimir) : null;
  } catch {
    return null;
  }
}
