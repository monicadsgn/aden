// Visão do dia: o que cada pessoa tem para resolver.
//
// "De quem": as tarefas do próprio login (padrão), de outro sócio (sócios podem ver as
// pendências um do outro quando quiserem) ou de todos.

import type { Id } from "./tipos";
import type { Tarefa } from "./tarefas";

export const hojeISO = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function somarDias(iso: string, n: number): string {
  const [a, m, d] = iso.split("-").map(Number);
  return hojeISO(new Date(a, m - 1, d + n));
}

export interface VisaoDoDia {
  /** vencem hoje (abertas) */
  hoje: Tarefa[];
  /** venceram e não foram concluídas */
  atrasadas: Tarefa[];
  /** vencem nos próximos 7 dias (sem contar hoje) */
  semana: Tarefa[];
  /** em produção agora, sem prazo */
  /** sem prazo: em produção, ou pedidas por outra pessoa (G4: o pedido sem data não some do dia de quem recebeu) */
  emAndamento: Tarefa[];
  /** paradas em "com o cliente" (esperando a aprovação dele) */
  emAprovacao: Tarefa[];
  /** abertas sem ninguém responsável (só aparece em "todos") */
  semResponsavel: Tarefa[];
  concluidasHoje: Tarefa[];
}

/** pessoaId: de quem é a visão; null = todo mundo. */
export function montarVisaoDoDia(tarefas: Tarefa[], pessoaId: Id | null, hoje: string): VisaoDoDia {
  const minhas = pessoaId ? tarefas.filter((t) => t.responsavelId === pessoaId) : tarefas;
  const abertas = minhas.filter((t) => t.status !== "concluida");
  const fimSemana = somarDias(hoje, 7);
  const porPrazo = (a: Tarefa, b: Tarefa) => (a.vencimento ?? "").localeCompare(b.vencimento ?? "") || a.criadoEm.localeCompare(b.criadoEm);
  return {
    hoje: abertas.filter((t) => t.vencimento === hoje),
    atrasadas: abertas.filter((t) => t.vencimento != null && t.vencimento < hoje).sort(porPrazo),
    semana: abertas.filter((t) => t.vencimento != null && t.vencimento > hoje && t.vencimento <= fimSemana).sort(porPrazo),
    emAndamento: abertas.filter((t) => !t.vencimento && (t.status === "em_producao" || (t.status === "a_fazer" && !!t.pedidaPorNome))),
    emAprovacao: abertas.filter((t) => t.status === "revisao"),
    semResponsavel: pessoaId ? [] : tarefas.filter((t) => t.status !== "concluida" && !t.responsavelId),
    concluidasHoje: minhas.filter((t) => t.status === "concluida" && t.concluidaEm != null && hojeISO(new Date(t.concluidaEm)) === hoje),
  };
}

/** Tarefas que aparecem num dia do calendário: do início ao vencimento (ou só no vencimento). */
export function tarefasDoDia(tarefas: Tarefa[], dia: string): Tarefa[] {
  return tarefas.filter((t) => {
    const fim = t.vencimento ?? t.inicio;
    const ini = t.inicio ?? t.vencimento;
    return ini != null && fim != null && ini <= dia && dia <= fim;
  });
}

/** Dias da grade do mês (semanas completas, começando no domingo). */
export function diasDaGrade(ano: number, mes0: number): string[] {
  const primeiro = new Date(ano, mes0, 1);
  const inicio = new Date(ano, mes0, 1 - primeiro.getDay());
  const ultimo = new Date(ano, mes0 + 1, 0);
  const fim = new Date(ano, mes0, ultimo.getDate() + (6 - ultimo.getDay()));
  const out: string[] = [];
  for (const d = new Date(inicio); d <= fim; d.setDate(d.getDate() + 1)) out.push(hojeISO(d));
  return out;
}

// ─── Avisos de publicação (Fase 3) ────────────────────────────────────────

export interface AvisosPublicacao {
  /** peças com data para ir ao ar hoje (ou que passaram do dia e ainda não foram publicadas) */
  irAoAr: { t: Tarefa; atrasada: boolean }[];
  /** esperando o cliente além do prazo de aprovação do contrato */
  aprovacaoVencida: { t: Tarefa; ate: string }[];
}

/**
 * prazoAprovacao: dias para o cliente aprovar, do contrato de cada cliente (vazio = sem prazo, sem aviso).
 * pessoaId: de quem é a visão; null = todo mundo.
 */
export function avisosDePublicacao(tarefas: Tarefa[], prazoAprovacao: (clienteId: Id | null) => number | null, pessoaId: Id | null, hoje: string): AvisosPublicacao {
  const minhas = pessoaId ? tarefas.filter((t) => t.responsavelId === pessoaId) : tarefas;
  const irAoAr = minhas
    .filter((t) => t.publicarEm && !t.publicadaEm && t.status !== "concluida")
    .map((t) => ({ t, dia: hojeISO(new Date(t.publicarEm!)) }))
    .filter((x) => x.dia <= hoje)
    .sort((a, b) => a.t.publicarEm!.localeCompare(b.t.publicarEm!))
    .map((x) => ({ t: x.t, atrasada: x.dia < hoje }));
  const aprovacaoVencida = minhas
    .filter((t) => t.status === "revisao" && t.enviadaClienteEm && !t.clienteAprovouEm)
    .map((t) => {
      const dias = prazoAprovacao(t.clienteId);
      return { t, ate: dias == null ? null : somarDias(hojeISO(new Date(t.enviadaClienteEm!)), dias) };
    })
    .filter((x): x is { t: Tarefa; ate: string } => x.ate != null && x.ate < hoje);
  return { irAoAr, aprovacaoVencida };
}
