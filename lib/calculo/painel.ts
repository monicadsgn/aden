// Painel do cliente: o que o cliente vê e como a resposta dele muda a tarefa.
// Espelha as funções painel_cliente/responder_peca do banco (migration 0016), para o modo
// demonstração e para os testes. Só sai o que é da peça: nada de horas, valores ou sócios.

import type { ClienteBase } from "./tipos";
import type { Tarefa } from "./tarefas";

export interface PecaPainel {
  id: string;
  titulo: string;
  legenda: string | null;
  arquivos: NonNullable<Tarefa["arquivos"]>;
  status: Tarefa["status"];
  vencimento: string | null;
  enviadaEm: string | null;
  rodadas: number;
  feedback: string | null;
  feedbackEm: string | null;
  aprovadaEm: string | null;
  respostas: NonNullable<Tarefa["respostasCliente"]>;
}

const JANELA_DIAS_ENTREGUES = 60; // peças entregues somem do painel depois de um tempo (só organização da tela)

export function montarPainel(cliente: ClienteBase, tarefas: Tarefa[], agora = new Date()) {
  const limite = agora.getTime() - JANELA_DIAS_ENTREGUES * 86400000;
  const recente = (iso: string | null | undefined) => !!iso && new Date(iso).getTime() > limite;
  const pecas: PecaPainel[] = tarefas
    .filter((t) => t.clienteId === cliente.id && t.visivelCliente && (t.status !== "concluida" || recente(t.concluidaEm) || recente(t.clienteAprovouEm)))
    .sort((a, b) => (b.enviadaClienteEm ?? b.criadoEm).localeCompare(a.enviadaClienteEm ?? a.criadoEm))
    .map((t) => ({
      id: t.id,
      titulo: t.titulo,
      legenda: t.legenda || null,
      arquivos: t.arquivos ?? [],
      status: t.status,
      vencimento: t.vencimento,
      enviadaEm: t.enviadaClienteEm ?? null,
      rodadas: t.rodadas ?? 0,
      feedback: t.feedbackCliente ?? null,
      feedbackEm: t.feedbackEm ?? null,
      aprovadaEm: t.clienteAprovouEm ?? null,
      respostas: t.respostasCliente ?? [],
    }));
  return {
    cliente: cliente.nome,
    limiteRodadas: cliente.contrato?.limiteRodadas ?? null,
    prazoAprovacaoDias: cliente.contrato?.prazoAprovacaoDias ?? null,
    pecas,
  };
}

/** Aplica a resposta do cliente. Erro (com frase para o cliente) quando não pode responder. */
export function aplicarResposta(t: Tarefa, decisao: "aprovar" | "ajustar", texto: string, agora = new Date()): Tarefa {
  if (!t.visivelCliente) throw new Error("Peça não encontrada.");
  if (t.status !== "revisao") throw new Error("Esta peça não está esperando aprovação.");
  if (t.clienteAprovouEm) throw new Error("Esta peça já foi aprovada.");
  const txt = texto.trim().slice(0, 4000);
  if (decisao === "ajustar" && !txt) throw new Error("Conte o que precisa ajustar.");
  const em = agora.toISOString();
  const respostas = [...(t.respostasCliente ?? []), { decisao, texto: txt, em }];
  if (decisao === "aprovar") return { ...t, clienteAprovouEm: em, respostasCliente: respostas };
  return { ...t, status: "em_producao", rodadas: (t.rodadas ?? 0) + 1, feedbackCliente: txt, feedbackEm: em, clienteAprovouEm: null, respostasCliente: respostas };
}

/** Prazo para o cliente aprovar: envio + prazo do contrato (em dias). null sem prazo combinado. */
export function aprovarAte(enviadaEm: string | null, prazoDias: number | null): string | null {
  if (!enviadaEm || prazoDias == null) return null;
  const d = new Date(enviadaEm);
  d.setDate(d.getDate() + prazoDias);
  return d.toISOString().slice(0, 10);
}
