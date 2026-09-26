// CRM: leads no funil.
//
// Etapas (as do SoftMoni, referência da Moni): lead recebido → contato feito → proposta
// enviada → ganho ou perdido. "Parado" só acende se os sócios configurarem quantos dias
// (Configurações → Limites e avisos); vazio = nunca acende.

import { hojeISO } from "./dia";
import type { Id } from "./tipos";

export type EtapaLead = "lead_recebido" | "contato_feito" | "proposta_enviada" | "ganho" | "perdido";
export type TipoInteracao = "nota" | "ligacao" | "whatsapp" | "reuniao" | "email" | "proposta";

export interface Lead {
  id: Id;
  nome: string;
  /** pessoa de contato */
  contato: string;
  telefone: string;
  email: string;
  instagram: string;
  /** como chegou (indicação, Instagram…) */
  origem: string;
  etapa: EtapaLead;
  entrouNaEtapaEm: string;
  pacoteId: Id | null;
  simulacaoId: Id | null;
  valorEstimadoCentavos: number | null;
  responsavelId: Id | null;
  /** "AAAA-MM-DD" */
  proximoContato: string | null;
  proximaAcao: string;
  observacoes: string;
  motivoPerda: string;
  /** cliente criado quando o lead foi ganho */
  clienteId: Id | null;
  criadoEm: string;
  fechadoEm: string | null;
}

export interface InteracaoLead {
  id: Id;
  leadId: Id;
  tipo: TipoInteracao;
  texto: string;
  em: string;
  autorNome: string | null;
}

export const ETAPAS: { valor: EtapaLead; rotulo: string; aberta: boolean }[] = [
  { valor: "lead_recebido", rotulo: "Lead recebido", aberta: true },
  { valor: "contato_feito", rotulo: "Contato feito", aberta: true },
  { valor: "proposta_enviada", rotulo: "Proposta enviada", aberta: true },
  { valor: "ganho", rotulo: "Ganho", aberta: false },
  { valor: "perdido", rotulo: "Perdido", aberta: false },
];
export const rotuloEtapa = (e: EtapaLead) => ETAPAS.find((x) => x.valor === e)?.rotulo ?? e;
export const etapaAberta = (e: EtapaLead) => ETAPAS.find((x) => x.valor === e)?.aberta ?? false;

export const TIPOS_INTERACAO: { valor: TipoInteracao; rotulo: string }[] = [
  { valor: "nota", rotulo: "Nota" },
  { valor: "whatsapp", rotulo: "WhatsApp" },
  { valor: "ligacao", rotulo: "Ligação" },
  { valor: "reuniao", rotulo: "Reunião" },
  { valor: "email", rotulo: "E-mail" },
  { valor: "proposta", rotulo: "Proposta" },
];

export function novoLead(id: Id, nome: string, base: Partial<Lead> = {}, agora = new Date()): Lead {
  const iso = agora.toISOString();
  return {
    id,
    nome,
    contato: "",
    telefone: "",
    email: "",
    instagram: "",
    origem: "",
    etapa: "lead_recebido",
    entrouNaEtapaEm: iso,
    pacoteId: null,
    simulacaoId: null,
    valorEstimadoCentavos: null,
    responsavelId: null,
    proximoContato: null,
    proximaAcao: "",
    observacoes: "",
    motivoPerda: "",
    clienteId: null,
    criadoEm: iso,
    fechadoEm: null,
    ...base,
  };
}

/** Muda de etapa: guarda quando entrou; ganho/perdido marcam a data de fechamento. */
export function moverLead(l: Lead, etapa: EtapaLead, agora = new Date()): Lead {
  if (l.etapa === etapa) return l;
  const iso = agora.toISOString();
  return { ...l, etapa, entrouNaEtapaEm: iso, fechadoEm: etapaAberta(etapa) ? null : iso, motivoPerda: etapa === "perdido" ? l.motivoPerda : "" };
}

export const diasNaEtapa = (l: Lead, agora = new Date()) => Math.max(0, Math.floor((agora.getTime() - new Date(l.entrouNaEtapaEm).getTime()) / 86400000));

/** Parado na etapa há mais dias que o configurado (sem configuração: nunca). */
export const leadParado = (l: Lead, diasLimite: number | null | undefined, agora = new Date()) =>
  etapaAberta(l.etapa) && diasLimite != null && diasLimite > 0 && diasNaEtapa(l, agora) >= diasLimite;

/** Contatos a fazer: leads abertos com próximo contato até hoje (de uma pessoa, ou de todos). */
export function contatosParaHoje(leads: Lead[], pessoaId: Id | null, hoje = hojeISO()): Lead[] {
  return leads
    .filter((l) => etapaAberta(l.etapa) && l.proximoContato != null && l.proximoContato <= hoje && (!pessoaId || l.responsavelId === pessoaId))
    .sort((a, b) => a.proximoContato!.localeCompare(b.proximoContato!));
}

export interface ResumoFunil {
  abertos: number;
  /** soma do valor estimado dos leads em aberto */
  valorEmAbertoCentavos: number;
  /** leads abertos sem valor estimado (não entram na soma) */
  semValor: number;
  ganhosNoMes: number;
  valorGanhoNoMesCentavos: number;
  /** ganhos ÷ (ganhos + perdidos), de todos os tempos; null sem nenhum fechado */
  taxaGanhoPct: number | null;
}

export function resumoFunil(leads: Lead[], hoje = hojeISO()): ResumoFunil {
  const abertos = leads.filter((l) => etapaAberta(l.etapa));
  const mes = hoje.slice(0, 7);
  const ganhos = leads.filter((l) => l.etapa === "ganho");
  const perdidos = leads.filter((l) => l.etapa === "perdido");
  const doMes = ganhos.filter((l) => l.fechadoEm && hojeISO(new Date(l.fechadoEm)).startsWith(mes));
  return {
    abertos: abertos.length,
    valorEmAbertoCentavos: abertos.reduce((a, l) => a + (l.valorEstimadoCentavos ?? 0), 0),
    semValor: abertos.filter((l) => l.valorEstimadoCentavos == null).length,
    ganhosNoMes: doMes.length,
    valorGanhoNoMesCentavos: doMes.reduce((a, l) => a + (l.valorEstimadoCentavos ?? 0), 0),
    taxaGanhoPct: ganhos.length + perdidos.length ? (ganhos.length / (ganhos.length + perdidos.length)) * 100 : null,
  };
}
