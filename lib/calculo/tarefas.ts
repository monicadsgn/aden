// Tarefas com o cronômetro dentro (como o "Rastrear tempo" do ClickUp).
//
// Cada tarefa tem no máximo UMA medição. Start liga (ou retoma) o relógio, Pausar
// para sem perder o tempo, e concluir a tarefa encerra a medição. A medição vale
// por `quantidade` entregas: a calibragem divide o tempo por elas.

import { iniciarMedicao, pararMedicao, pausarMedicao, retomarMedicao, segundosDaMedicao, type Medicao } from "./calibragem";
import type { Configuracao, Id } from "./tipos";

export type StatusTarefa = "a_fazer" | "em_producao" | "revisao" | "concluida";
export type Prioridade = "urgente" | "alta" | "normal" | "baixa";

export interface EtapaTarefa {
  id: Id;
  titulo: string;
  feita: boolean;
}

export interface Tarefa {
  id: Id;
  titulo: string;
  clienteId: Id | null;
  tipoEntregaId: Id | null;
  /** quantas entregas do tipo esta tarefa produz (ex.: 12 posts do calendário) */
  quantidade: number;
  status: StatusTarefa;
  prioridade: Prioridade | null;
  responsavelId: Id | null;
  /** "AAAA-MM-DD" */
  inicio: string | null;
  vencimento: string | null;
  descricao: string;
  etapas: EtapaTarefa[];
  criadoEm: string;
  concluidaEm: string | null;
  // ─── painel do cliente ───
  /** aparece no painel do cliente */
  visivelCliente?: boolean;
  /** texto que vai junto com a peça (legenda do post) */
  legenda?: string;
  /** artes da peça (endereços no Storage) */
  arquivos?: ArquivoPeca[];
  /** quando foi enviada para o cliente aprovar (as respostas abaixo são do cliente: só o banco escreve) */
  enviadaClienteEm?: string | null;
  rodadas?: number;
  feedbackCliente?: string | null;
  feedbackEm?: string | null;
  clienteAprovouEm?: string | null;
  respostasCliente?: RespostaCliente[];
}

export interface ArquivoPeca {
  url: string;
  nome: string;
  tipo: string;
}

export interface RespostaCliente {
  decisao: "aprovar" | "ajustar";
  texto: string;
  em: string;
}

/** Situação da peça para o cliente. */
export type SituacaoPeca = "producao" | "aguardando" | "aprovada" | "ajuste" | "entregue";

export function situacaoPeca(t: Pick<Tarefa, "status" | "clienteAprovouEm" | "feedbackEm" | "enviadaClienteEm">): SituacaoPeca {
  if (t.clienteAprovouEm) return "aprovada";
  if (t.status === "revisao") return "aguardando";
  if (t.status === "concluida") return "entregue";
  // voltou para produção depois de um pedido de ajuste do cliente
  if (t.feedbackEm && (!t.enviadaClienteEm || t.feedbackEm > t.enviadaClienteEm)) return "ajuste";
  return "producao";
}

export const STATUS: { valor: StatusTarefa; rotulo: string }[] = [
  { valor: "a_fazer", rotulo: "A fazer" },
  { valor: "em_producao", rotulo: "Em produção" },
  { valor: "revisao", rotulo: "Com o cliente" },
  { valor: "concluida", rotulo: "Concluída" },
];
export const rotuloStatus = (s: StatusTarefa) => STATUS.find((x) => x.valor === s)?.rotulo ?? s;

export const PRIORIDADES: { valor: Prioridade; rotulo: string }[] = [
  { valor: "urgente", rotulo: "Urgente" },
  { valor: "alta", rotulo: "Alta" },
  { valor: "normal", rotulo: "Normal" },
  { valor: "baixa", rotulo: "Baixa" },
];

export function novaTarefa(id: Id, titulo: string, base: Partial<Tarefa> = {}, agora = new Date()): Tarefa {
  return {
    id,
    titulo,
    clienteId: null,
    tipoEntregaId: null,
    quantidade: 1,
    status: "a_fazer",
    prioridade: null,
    responsavelId: null,
    inicio: null,
    vencimento: null,
    descricao: "",
    etapas: [],
    criadoEm: agora.toISOString(),
    concluidaEm: null,
    ...base,
  };
}

/** Estimativa de tempo (em horas) = tempo por entrega × quantidade. null se o tipo não tem tempo. */
export function estimativaHoras(t: Tarefa, config: Configuracao): number | null {
  const tipo = config.tiposEntrega.find((x) => x.id === t.tipoEntregaId);
  if (!tipo || tipo.audiovisual || tipo.horasPorUnidade == null) return null;
  return tipo.horasPorUnidade * Math.max(1, t.quantidade);
}

/** Audiovisual é feito por terceiro: não tem horas dos sócios, então não tem cronômetro. */
export function temCronometro(t: Tarefa, config: Configuracao): boolean {
  const tipo = config.tiposEntrega.find((x) => x.id === t.tipoEntregaId);
  return !!tipo && !tipo.audiovisual;
}

export const medicaoDaTarefa = (t: Tarefa, medicoes: Medicao[]) => medicoes.find((m) => m.tarefaId === t.id) ?? null;

/** Start: cria a medição da tarefa ou retoma a que estava pausada. Tarefa "a fazer" passa a "em produção". */
export function darStart(t: Tarefa, m: Medicao | null, pessoaId: Id | null, novoIdMedicao: Id, agora: Date): { tarefa: Tarefa; medicao: Medicao } | null {
  if (!t.tipoEntregaId) return null;
  const tarefa = t.status === "a_fazer" ? { ...t, status: "em_producao" as const } : t;
  if (!m)
    return {
      tarefa,
      medicao: iniciarMedicao({ id: novoIdMedicao, clienteId: t.clienteId, tipoEntregaId: t.tipoEntregaId, pessoaId, tarefaId: t.id, unidades: Math.max(1, t.quantidade) }, agora),
    };
  // medição concluída volta a contar se a tarefa foi reaberta
  const aberta = m.estado === "concluido" ? { ...m, estado: "pausado" as const, fim: null } : m;
  return { tarefa, medicao: retomarMedicao(aberta, agora) };
}

export const pausar = (m: Medicao, agora: Date) => pausarMedicao(m, agora);

/** Mudar o status: concluir encerra o relógio; reabrir deixa a medição pausada. */
export function mudarStatus(t: Tarefa, status: StatusTarefa, m: Medicao | null, agora: Date): { tarefa: Tarefa; medicao: Medicao | null } {
  const tarefa: Tarefa = { ...t, status, concluidaEm: status === "concluida" ? (t.concluidaEm ?? agora.toISOString()) : null };
  if (!m) return { tarefa, medicao: null };
  if (status === "concluida") return { tarefa, medicao: pararMedicao({ ...m, unidades: Math.max(1, t.quantidade) }, agora) };
  if (m.estado === "concluido") return { tarefa, medicao: { ...m, estado: "pausado", fim: null } };
  return { tarefa, medicao: m };
}

export const tempoGasto = (m: Medicao | null, agora: Date) => (m ? segundosDaMedicao(m, agora) : 0);

// ─── Agrupamento da lista (como no SoftMoni: por prazo) ──────────────────────

export type GrupoPrazo = "atrasadas" | "hoje" | "semana" | "depois" | "sem_prazo" | "concluidas";
export const ROTULO_GRUPO: Record<GrupoPrazo, string> = {
  atrasadas: "Atrasadas",
  hoje: "Hoje",
  semana: "Próximos 7 dias",
  depois: "Mais pra frente",
  sem_prazo: "Sem prazo",
  concluidas: "Concluídas",
};

const dia = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function grupoDaTarefa(t: Tarefa, hoje: Date): GrupoPrazo {
  if (t.status === "concluida") return "concluidas";
  if (!t.vencimento) return "sem_prazo";
  const h = dia(hoje);
  if (t.vencimento < h) return "atrasadas";
  if (t.vencimento === h) return "hoje";
  const semana = new Date(hoje);
  semana.setDate(semana.getDate() + 7);
  return t.vencimento <= dia(semana) ? "semana" : "depois";
}

const PESO_PRIORIDADE: Record<Prioridade, number> = { urgente: 0, alta: 1, normal: 2, baixa: 3 };

export function agruparPorPrazo(tarefas: Tarefa[], hoje: Date): { grupo: GrupoPrazo; tarefas: Tarefa[] }[] {
  const ordem: GrupoPrazo[] = ["atrasadas", "hoje", "semana", "depois", "sem_prazo", "concluidas"];
  const cmp = (a: Tarefa, b: Tarefa) =>
    (a.prioridade ? PESO_PRIORIDADE[a.prioridade] : 2.5) - (b.prioridade ? PESO_PRIORIDADE[b.prioridade] : 2.5) ||
    (a.vencimento ?? "9999").localeCompare(b.vencimento ?? "9999") ||
    a.criadoEm.localeCompare(b.criadoEm);
  return ordem
    .map((grupo) => ({ grupo, tarefas: tarefas.filter((t) => grupoDaTarefa(t, hoje) === grupo).sort(cmp) }))
    .filter((g) => g.tarefas.length > 0);
}

export function relogio(seg: number): string {
  const s = Math.floor(seg);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return `${h > 0 ? `${h}:` : ""}${String(m).padStart(h > 0 ? 2 : 1, "0")}:${String(r).padStart(2, "0")}`;
}
