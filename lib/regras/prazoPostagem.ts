// Dia da postagem e prazo da peça de calendário (regra da Moni, 13/10/2026).
//
// Peça de calendário = peça de cliente que veio de um planejamento (tem calendário ou rede) ou que já tem data de ir ao ar.
// 1) Toda peça de calendário tem o DIA DA POSTAGEM ("Vai ao ar em"): o planejamento já nasce com ele.
// 2) O PRAZO da tarefa é pelo menos 1 dia ANTES da postagem (a véspera): a arte precisa estar pronta e aprovada antes de ir ao ar.
// Sem o dia da postagem a peça não sobe para o cliente aprovar. Tela e conector usam este mesmo arquivo.

import { diaDeBrasilia, somarDias } from "../calculo/dia";
import { ehPeca, type Tarefa } from "../calculo/tarefas";

/** Quantos dias antes da postagem o prazo da tarefa vence, no máximo. */
export const DIAS_ANTES_DA_POSTAGEM = 1;

/** Véspera do dia em que a peça vai ao ar (AAAA-MM-DD): o prazo que a tarefa deve ter, no máximo. */
export const vesperaDaPostagem = (publicarEm: string): string => somarDias(diaDeBrasilia(publicarEm), -DIAS_ANTES_DA_POSTAGEM);

/** Peça de calendário: de cliente, com calendário ou rede do planejamento, ou com data de ir ao ar. */
export function ehPostagemPlanejada(t: Pick<Tarefa, "clienteId"> & Partial<Pick<Tarefa, "visivelCliente" | "arquivos" | "legenda" | "textoArte" | "publicarEm" | "publicadaEm" | "agendadaEm" | "lote" | "rede">>): boolean {
  return ehPeca(t) && !!(t.lote || t.rede || t.publicarEm);
}

/** Peça de calendário ainda aberta e sem o dia da postagem: falta preencher "Vai ao ar em". */
export function semDiaDaPostagem(t: Pick<Tarefa, "clienteId" | "status"> & Partial<Pick<Tarefa, "visivelCliente" | "arquivos" | "legenda" | "textoArte" | "publicarEm" | "publicadaEm" | "agendadaEm" | "lote" | "rede">>): boolean {
  return ehPostagemPlanejada(t) && !t.publicarEm && !t.publicadaEm && t.status !== "concluida";
}

export const MENSAGEM_SEM_DIA_DA_POSTAGEM =
  'Falta o dia da postagem ("Vai ao ar em"). Preencha antes de enviar para o cliente: o prazo da tarefa é 1 dia antes dele.';

export interface PrazoDaPeca {
  /** a tarefa como deve ser gravada (prazo na véspera da postagem, se faltava ou passava dela) */
  tarefa: Tarefa;
  /** véspera da postagem; null = a regra não se aplica (sem data de ir ao ar, já publicada ou concluída) */
  vespera: string | null;
  /** "preencheu" = o prazo estava vazio; "antecipou" = o prazo era no dia da postagem ou depois */
  ajuste: "preencheu" | "antecipou" | null;
  /** prazo que a pessoa tinha posto, quando foi antecipado */
  prazoAnterior: string | null;
}

/**
 * Garante o prazo da peça: vazio ou no dia da postagem (ou depois) vira a véspera; prazo mais cedo fica como está.
 * Não mexe em peça já publicada ou concluída (o histórico não se reescreve).
 */
export function conferirPrazoDaPeca(t: Tarefa): PrazoDaPeca {
  const nada: PrazoDaPeca = { tarefa: t, vespera: null, ajuste: null, prazoAnterior: null };
  if (!t.publicarEm || t.publicadaEm || t.status === "concluida") return nada;
  const vespera = vesperaDaPostagem(t.publicarEm);
  if (t.vencimento && t.vencimento <= vespera) return { ...nada, vespera };
  const ajuste = t.vencimento ? "antecipou" : "preencheu";
  // início depois do novo prazo não faz sentido: encosta no prazo
  const inicio = t.inicio && t.inicio > vespera ? vespera : t.inicio;
  return { tarefa: { ...t, vencimento: vespera, inicio }, vespera, ajuste, prazoAnterior: t.vencimento };
}
