// Briefing único no perfil do cliente (Fase 5, passo 2, aprovado em 30/09/2026).
// O cliente não preenche nada: o Áleff responde na reunião dele e a Moni completa na dela, sem repetir pergunta.
// As perguntas vêm da lista em Configurações (texto aprovado pelos sócios); cada uma vale para todos os serviços
// ou só para um. Cada resposta guarda quem respondeu e o texto da pergunta naquele momento.

import type { Configuracao, Id } from "./tipos";

export interface PerguntaBriefing {
  id: Id;
  secao: string;
  pergunta: string;
  ajuda: string | null;
  /** vazio = vale para todos os serviços */
  servicoId: Id | null;
  ordem: number;
  ativo: boolean;
}

export interface RespostaBriefing {
  id: Id;
  clienteId: Id;
  perguntaId: Id;
  /** texto da pergunta quando foi respondida */
  perguntaTexto: string;
  resposta: string | null;
  respondidoPorNome: string | null;
  respondidoEm: string | null;
}

/** Serviços que o cliente contratou, pelo escopo guardado (tipos de entrega → serviço). */
export function servicosDoCliente(config: Configuracao, clienteId: Id): Set<Id> {
  const c = config.clientes.find((x) => x.id === clienteId);
  const ids = new Set<Id>();
  for (const e of c?.escopo?.entregas ?? []) {
    if (!(e.quantidade ?? 0)) continue;
    const s = config.tiposEntrega.find((t) => t.id === e.tipoEntregaId)?.servicoId;
    if (s) ids.add(s);
  }
  return ids;
}

/**
 * Perguntas que valem para o cliente, agrupadas por seção, com a resposta de cada uma.
 * Sem escopo guardado, entram todas (melhor perguntar a mais do que faltar).
 */
export function montarBriefing(perguntas: PerguntaBriefing[], respostas: RespostaBriefing[], servicos: Set<Id>) {
  const valem = perguntas
    .filter((p) => p.ativo && (!p.servicoId || servicos.size === 0 || servicos.has(p.servicoId)))
    .sort((a, b) => a.ordem - b.ordem || a.pergunta.localeCompare(b.pergunta));
  const secoes: { secao: string; itens: { pergunta: PerguntaBriefing; resposta: RespostaBriefing | null }[] }[] = [];
  for (const p of valem) {
    let s = secoes.find((x) => x.secao === p.secao);
    if (!s) secoes.push((s = { secao: p.secao, itens: [] }));
    s.itens.push({ pergunta: p, resposta: respostas.find((r) => r.perguntaId === p.id) ?? null });
  }
  const total = valem.length;
  const respondidas = valem.filter((p) => respostas.some((r) => r.perguntaId === p.id && r.resposta?.trim())).length;
  return { secoes, total, respondidas, completo: total > 0 && respondidas === total };
}
