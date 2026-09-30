// Painel do cliente: o que o cliente vê e como a resposta dele muda a tarefa.
// Espelha as funções painel_cliente/responder_peca do banco (migration 0016), para o modo
// demonstração e para os testes. Só sai o que é da peça: nada de horas, valores ou sócios.

import type { ClienteBase, TipoEntrega } from "./tipos";
import { situacaoPeca, type SituacaoPeca, type Tarefa } from "./tarefas";

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
  publicarEm: string | null;
  publicadaEm: string | null;
  /** formato da peça (nome do tipo de entrega, ex.: Reels) */
  tipo: string | null;
  /** o que vai escrito dentro da arte */
  textoArte: string | null;
  /** quando a equipe programou o post */
  agendadaEm: string | null;
}

/**
 * Título como o cliente vê: sem a etiqueta interna de organização no começo ("[CLIENTE] - …") e sem o
 * "Tráfego:" dos criativos. Dentro do sistema o título continua igual. Espelhada no banco (painel_cliente,
 * migration 0026): mudou aqui, muda lá.
 */
export function tituloParaCliente(titulo: string): string {
  const limpo = titulo
    .replace(/^\s*\[[^\]]*\]\s*[-–—:]?\s*/, "")
    .replace(/^\s*tr[aá]fego\s*:\s*/i, "")
    .trim();
  if (!limpo) return titulo.trim();
  return limpo.charAt(0).toLocaleUpperCase("pt-BR") + limpo.slice(1);
}

/** Nome do tipo de entrega no painel: o "como o cliente vê" do tipo, se preenchido (ex.: "Post"); se não, o nome. */
export function nomeDoTipoParaCliente(t: Pick<TipoEntrega, "nome" | "nomeCliente"> | undefined): string | null {
  if (!t) return null;
  return t.nomeCliente?.trim() || t.nome;
}

const JANELA_DIAS_ENTREGUES = 60; // peças entregues somem do painel depois de um tempo (só organização da tela)

export function montarPainel(cliente: ClienteBase, tarefas: Tarefa[], agora = new Date(), tipos: Pick<TipoEntrega, "id" | "nome" | "nomeCliente">[] = []) {
  const limite = agora.getTime() - JANELA_DIAS_ENTREGUES * 86400000;
  const recente = (iso: string | null | undefined) => !!iso && new Date(iso).getTime() > limite;
  const pecas: PecaPainel[] = tarefas
    .filter((t) => t.clienteId === cliente.id && t.visivelCliente && (t.status !== "concluida" || recente(t.concluidaEm) || recente(t.clienteAprovouEm)))
    .sort((a, b) => (b.enviadaClienteEm ?? b.criadoEm).localeCompare(a.enviadaClienteEm ?? a.criadoEm))
    .map((t) => ({
      id: t.id,
      titulo: tituloParaCliente(t.titulo),
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
      publicarEm: t.publicarEm ?? null,
      publicadaEm: t.publicadaEm ?? null,
      tipo: nomeDoTipoParaCliente(tipos.find((x) => x.id === t.tipoEntregaId)),
      textoArte: t.textoArte || null,
      agendadaEm: t.agendadaEm ?? null,
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

// ─── Quadro do painel: colunas que deslizam para o lado ──────────────────────

/** O mínimo de uma peça do painel que o quadro precisa (serve para a peça vinda do banco). */
export type PecaDoQuadro = Pick<PecaPainel, "id" | "status" | "aprovadaEm" | "feedbackEm" | "enviadaEm" | "respostas"> & {
  publicarEm?: string | null;
  publicadaEm?: string | null;
  agendadaEm?: string | null;
  tipo?: string | null;
};

export type ColunaDoQuadro = "planejado" | "producao" | "aguardando" | "aprovada" | "agendada" | "publicada";

/** Quantas publicadas o quadro mostra (só organização da tela: as mais recentes). */
export const PUBLICADAS_NO_QUADRO = 7;

/** Ordem das colunas. "Aguardando" e "Publicado" sempre aparecem; as outras só com peça. */
export const COLUNAS_DO_QUADRO: { id: ColunaDoQuadro; titulo: string; sempre: boolean; vazio: string }[] = [
  { id: "planejado", titulo: "Vem por aí", sempre: false, vazio: "" },
  { id: "producao", titulo: "Em produção", sempre: false, vazio: "" },
  { id: "aguardando", titulo: "Aguardando sua aprovação", sempre: true, vazio: "Nada esperando aprovação agora." },
  { id: "aprovada", titulo: "Aprovada", sempre: false, vazio: "" },
  { id: "agendada", titulo: "Agendada", sempre: false, vazio: "" },
  { id: "publicada", titulo: "Publicado recentemente", sempre: true, vazio: "Nada publicado ainda." },
];

const COLUNA_DA_SITUACAO: Record<SituacaoPeca, ColunaDoQuadro> = {
  planejado: "planejado",
  producao: "producao",
  // o ajuste pedido volta para a produção (com a marca de ajuste no card)
  ajuste: "producao",
  aguardando: "aguardando",
  aprovada: "aprovada",
  agendada: "agendada",
  publicada: "publicada",
  entregue: "publicada",
};

export const situacaoDaPecaPainel = (p: PecaDoQuadro): SituacaoPeca =>
  situacaoPeca({
    status: p.status,
    clienteAprovouEm: p.aprovadaEm,
    feedbackEm: p.feedbackEm,
    enviadaClienteEm: p.enviadaEm,
    publicarEm: p.publicarEm,
    publicadaEm: p.publicadaEm,
    agendadaEm: p.agendadaEm,
  });

/**
 * Monta as colunas na ordem do quadro. Dentro de cada coluna: as próximas a entrar primeiro;
 * em "Publicado recentemente", as mais novas primeiro.
 */
export function montarQuadro<P extends PecaDoQuadro>(pecas: P[]): { id: ColunaDoQuadro; titulo: string; vazio: string; pecas: P[] }[] {
  const data = (p: P) => p.publicadaEm ?? p.publicarEm ?? p.enviadaEm ?? "";
  return COLUNAS_DO_QUADRO.map((c) => {
    const lista = pecas.filter((p) => COLUNA_DA_SITUACAO[situacaoDaPecaPainel(p)] === c.id);
    lista.sort((a, b) => (c.id === "publicada" ? data(b).localeCompare(data(a)) : (data(a) || "9").localeCompare(data(b) || "9")));
    return { id: c.id, titulo: c.titulo, vazio: c.vazio, pecas: c.id === "publicada" ? lista.slice(0, PUBLICADAS_NO_QUADRO) : lista };
  }).filter((c) => c.pecas.length > 0 || COLUNAS_DO_QUADRO.find((x) => x.id === c.id)!.sempre);
}

export interface ResumoDoMes {
  publicados: number;
  agendados: number;
  emAndamento: number;
  ajustesPedidos: number;
  /** publicados e agendados do mês, por formato */
  porTipo: { tipo: string; quantidade: number }[];
}

/** Resumo do mês para o cliente ("AAAA-MM"): o que já foi, o que está agendado e o que está andando. */
export function resumoDoMes(pecas: PecaDoQuadro[], mes: string): ResumoDoMes {
  const noMes = (iso: string | null | undefined) => !!iso && iso.slice(0, 7) === mes;
  let publicados = 0;
  let agendados = 0;
  let emAndamento = 0;
  let ajustesPedidos = 0;
  const porTipo = new Map<string, number>();
  for (const p of pecas) {
    const s = situacaoDaPecaPainel(p);
    const conta = (s === "publicada" && noMes(p.publicadaEm)) || (s === "agendada" && noMes(p.publicarEm));
    if (s === "publicada" && noMes(p.publicadaEm)) publicados++;
    if (s === "agendada" && noMes(p.publicarEm)) agendados++;
    if (s === "producao" || s === "ajuste" || s === "aguardando") emAndamento++;
    ajustesPedidos += p.respostas.filter((r) => r.decisao === "ajustar" && noMes(r.em)).length;
    if (conta) porTipo.set(p.tipo ?? "Outros", (porTipo.get(p.tipo ?? "Outros") ?? 0) + 1);
  }
  return {
    publicados,
    agendados,
    emAndamento,
    ajustesPedidos,
    porTipo: [...porTipo.entries()].map(([tipo, quantidade]) => ({ tipo, quantidade })).sort((a, b) => b.quantidade - a.quantidade),
  };
}
