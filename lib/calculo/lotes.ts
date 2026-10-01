// Peças do mesmo calendário (lote do planejamento) juntas num card só (G2 da auditoria, 01/10/2026).
// Só organização da tela: não muda status nem relógio.

import type { Tarefa } from "./tarefas";

export type GrupoLista = { tipo: "tarefa"; tarefa: Tarefa } | { tipo: "calendario"; chave: string; lote: string; tarefas: Tarefa[] };

const chaveDe = (t: Tarefa) => (t.lote?.trim() ? `${t.clienteId ?? ""}|${t.lote.trim()}` : null);

/** Mantém a ordem da lista; o card do calendário entra no lugar da primeira peça dele. Sozinha no calendário = linha. */
export function agruparPorCalendario(tarefas: Tarefa[]): GrupoLista[] {
  const porChave = new Map<string, Tarefa[]>();
  for (const t of tarefas) {
    const k = chaveDe(t);
    if (k) porChave.set(k, [...(porChave.get(k) ?? []), t]);
  }
  const out: GrupoLista[] = [];
  const feitos = new Set<string>();
  for (const t of tarefas) {
    const k = chaveDe(t);
    const grupo = k ? porChave.get(k)! : null;
    if (!k || !grupo || grupo.length < 2) {
      out.push({ tipo: "tarefa", tarefa: t });
      continue;
    }
    if (feitos.has(k)) continue;
    feitos.add(k);
    out.push({ tipo: "calendario", chave: k, lote: t.lote!.trim(), tarefas: grupo });
  }
  return out;
}

/** Peça pronta = concluída, publicada ou aprovada pelo cliente. Conta o calendário inteiro, não só o que está na lista. */
export const pecaPronta = (t: Tarefa) => t.status === "concluida" || !!t.publicadaEm || !!t.clienteAprovouEm;

export function prontasDoCalendario(todas: Tarefa[], exemplo: Tarefa): { prontas: number; total: number } {
  const k = chaveDe(exemplo);
  const doCalendario = todas.filter((t) => chaveDe(t) === k);
  return { prontas: doCalendario.filter(pecaPronta).length, total: doCalendario.length };
}
