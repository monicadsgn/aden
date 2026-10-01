// Prazo mínimo de tarefa pedida ao outro sócio (regra da Moni, 01/10/2026).
//
// Tarefa pedida a outro sócio (principalmente criativo) tem prazo mínimo em dias úteis, contados a partir do pedido
// (o número vem da configuração: Limites → prazo mínimo de pedido; vazio = sem regra). Sem prazo, a tarefa entra
// sozinha com o prazo mínimo. Prazo menor só como urgência: quem pede confirma e a tarefa ganha o selo "urgente".
// Espelho da migration 0037 (o banco faz a mesma conta e barra o prazo curto sem "urgente").

import { somarDias } from "../calculo/dia";
import type { Tarefa } from "../calculo/tarefas";
import type { Configuracao, Id } from "../calculo/tipos";

/** Soma n dias úteis (segunda a sexta) a uma data AAAA-MM-DD. Sábado + 2 dias úteis = terça. */
export function somarDiasUteis(iso: string, n: number): string {
  let d = iso;
  let contados = 0;
  while (contados < n) {
    d = somarDias(d, 1);
    const [a, m, dia] = d.split("-").map(Number);
    const semana = new Date(a, m - 1, dia).getDay();
    if (semana !== 0 && semana !== 6) contados++;
  }
  return d;
}

export interface PrazoDoPedido {
  /** a tarefa como deve ser gravada (com o prazo mínimo, se veio sem data) */
  tarefa: Tarefa;
  /** prazo mínimo deste pedido; null = a regra não se aplica */
  minimo: string | null;
  dias: number | null;
  /** o prazo veio vazio e entrou o mínimo */
  preencheu: boolean;
  /** o prazo é menor que o mínimo e a tarefa não está marcada como urgente: precisa confirmar */
  pedeUrgencia: boolean;
}

/**
 * Confere o prazo de uma tarefa pedida ao outro sócio. Vale quando a tarefa é criada ou passada para outro sócio,
 * ou quando quem pediu muda o prazo. Quem faz a tarefa mexe no próprio prazo à vontade.
 */
export function conferirPrazoDoPedido(args: {
  config: Pick<Configuracao, "pessoas" | "empresa">;
  antes: Tarefa | null | undefined;
  depois: Tarefa;
  /** quem está pedindo (pessoa do login ou dono do código do conector) */
  eu: Id | null | undefined;
  hoje: string;
}): PrazoDoPedido {
  const { config, antes, depois, eu, hoje } = args;
  const dias = config.empresa.prazoMinimoPedidoDiasUteis ?? null;
  const nada: PrazoDoPedido = { tarefa: depois, minimo: null, dias, preencheu: false, pedeUrgencia: false };
  const resp = depois.responsavelId;
  if (!dias || !eu || !resp || resp === eu) return nada;
  if (!config.pessoas.some((p) => p.id === resp && p.socio)) return nada;
  const novoPedido = !antes || antes.responsavelId !== resp;
  const mudouPrazo = !!antes && antes.vencimento !== depois.vencimento;
  if (!novoPedido && !mudouPrazo) return nada;
  const minimo = somarDiasUteis(hoje, dias);
  if (!depois.vencimento) return { tarefa: { ...depois, vencimento: minimo }, minimo, dias, preencheu: true, pedeUrgencia: false };
  const curto = depois.vencimento < minimo && depois.prioridade !== "urgente";
  return { tarefa: depois, minimo, dias, preencheu: false, pedeUrgencia: curto };
}
