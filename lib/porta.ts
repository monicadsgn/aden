// Porta genérica (Fase 3, exceção aprovada em 29/09/2026): outro sistema usa o código pessoal de um sócio
// para ver e mexer nas tarefas desse sócio. O Aden não sabe quem está do outro lado.
// Aqui só a tradução do pedido HTTP para as funções do banco (migration 0021), que conferem o código.

export const STATUS_DA_PORTA = ["a_fazer", "em_producao", "concluida", "publicada", "nao_publicada"] as const;
export type StatusDaPorta = (typeof STATUS_DA_PORTA)[number];

const CAMPOS_TAREFA = [
  "id",
  "titulo",
  "cliente",
  "entrega",
  "quantidade",
  "prioridade",
  "inicio",
  "vencimento",
  "descricao",
  "checklist",
  "legenda",
  "publicarEm",
] as const;

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const PRIORIDADES = ["urgente", "alta", "normal", "baixa"];

export type ChamadaPorta =
  | { funcao: "porta_salvar_tarefa"; args: { p_dados: Record<string, unknown> } }
  | { funcao: "porta_status"; args: { p_id: string; p_status: StatusDaPorta } };

/** Código do cabeçalho "Authorization: Bearer …". */
export function codigoDoPedido(cabecalho: string | null): string | null {
  const c = (cabecalho ?? "").replace(/^Bearer\s+/i, "").trim();
  return /^aden_[0-9a-f]{48}$/.test(c) ? c : null;
}

/** Valida o corpo do POST e diz qual função do banco chamar. Erro com frase simples quando não dá. */
export function chamadaDoPedido(corpo: unknown): ChamadaPorta {
  if (!corpo || typeof corpo !== "object") throw new Error("Mande um JSON com 'acao'.");
  const c = corpo as Record<string, unknown>;
  if (c.acao === "status") {
    if (typeof c.id !== "string" || !c.id) throw new Error("Informe o id da tarefa.");
    if (!STATUS_DA_PORTA.includes(c.status as StatusDaPorta)) throw new Error(`Status deve ser um de: ${STATUS_DA_PORTA.join(", ")}.`);
    return { funcao: "porta_status", args: { p_id: c.id, p_status: c.status as StatusDaPorta } };
  }
  if (c.acao === "salvar") {
    const t = c.tarefa;
    if (!t || typeof t !== "object") throw new Error("Mande a tarefa em 'tarefa'.");
    const dados: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(t as Record<string, unknown>)) {
      if (!(CAMPOS_TAREFA as readonly string[]).includes(k)) throw new Error(`Campo desconhecido: ${k}.`);
      dados[k] = v;
    }
    if (!dados.id && !dados.titulo) throw new Error("Tarefa nova precisa de título.");
    for (const k of ["inicio", "vencimento"])
      if (dados[k] != null && dados[k] !== "" && !DATA.test(String(dados[k]))) throw new Error(`${k} deve ser AAAA-MM-DD.`);
    if (dados.publicarEm != null && dados.publicarEm !== "" && Number.isNaN(Date.parse(String(dados.publicarEm))))
      throw new Error("publicarEm deve ser data e hora ISO (ex.: 2026-10-04T12:00:00-03:00).");
    if (dados.prioridade != null && dados.prioridade !== "" && !PRIORIDADES.includes(String(dados.prioridade)))
      throw new Error(`Prioridade deve ser uma de: ${PRIORIDADES.join(", ")}.`);
    if (dados.quantidade != null && !(Number.isInteger(dados.quantidade) && (dados.quantidade as number) > 0)) throw new Error("Quantidade deve ser inteiro maior que zero.");
    if (dados.checklist != null && !Array.isArray(dados.checklist)) throw new Error("checklist deve ser uma lista de { titulo, feita }.");
    return { funcao: "porta_salvar_tarefa", args: { p_dados: dados } };
  }
  throw new Error("acao deve ser 'salvar' ou 'status'.");
}

/** Texto de ajuda da porta (tela e resposta sem código). */
export const COMO_USAR_PORTA = {
  autenticacao: "Cabeçalho Authorization: Bearer <seu código>",
  ler: "GET /api/porta (?concluidas=1 inclui as concluídas): suas tarefas, os nomes dos clientes e dos tipos de entrega. Cada tarefa traz a etapa da peça (planejado, producao, aguardando, ajuste, aprovada, agendada, publicada, entregue) e, só leitura, enviadaClienteEm, aprovadaEm, agendadaEm, rede e lote.",
  salvar: 'POST /api/porta { "acao": "salvar", "tarefa": { "titulo", "cliente", "entrega", "quantidade", "prioridade", "inicio", "vencimento", "descricao", "checklist", "legenda", "publicarEm" } } (com "id" edita; sem, cria no seu nome).',
  status: 'POST /api/porta { "acao": "status", "id": "…", "status": "a_fazer" | "em_producao" | "concluida" | "publicada" | "nao_publicada" }',
};
