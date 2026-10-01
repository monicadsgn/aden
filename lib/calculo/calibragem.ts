// Cronômetro e calibragem das horas.
//
// Regra de 01/10/2026: vale o tempo médio cadastrado em cada tipo de entrega. O cronômetro é opcional:
// nunca liga sozinho e o sistema não pede medições. Serve para quando não se sabe quanto uma entrega leva:
// com medição, a Calibragem mostra a média e sugere atualizar o tempo cadastrado (campo protegido: só muda
// se alguém aceitar a sugestão e o sócio afetado aprovar). A média medida nunca entra sozinha nas contas.

import { formatarDuracao } from "../formato";
import type { Configuracao, Id, TipoEntrega } from "./tipos";

export type EstadoMedicao = "rodando" | "pausado" | "concluido";

/** Uma medição = o tempo de UMA entrega (uma unidade do tipo). */
export interface Medicao {
  id: Id;
  clienteId: Id | null;
  tipoEntregaId: Id;
  pessoaId: Id | null;
  estado: EstadoMedicao;
  /** segundos acumulados até a última pausa */
  acumuladoSegundos: number;
  /** quando o cronômetro foi (re)iniciado pela última vez; null se pausado ou concluído */
  retomadoEm: string | null;
  /** quando foi parado (concluído) */
  fim: string | null;
  criadoEm: string;
  /** tarefa em que o relógio foi ligado (null = medição avulsa) */
  tarefaId?: Id | null;
  /** quantas entregas esse tempo cobre (padrão 1): a média divide por elas */
  unidades?: number;
}

const unidadesDe = (m: Medicao) => Math.max(1, m.unidades ?? 1);

/** Segundos totais de uma medição, contando o trecho que ainda está rodando. */
export function segundosDaMedicao(m: Medicao, agora: Date = new Date()): number {
  const rodando = m.estado === "rodando" && m.retomadoEm ? Math.max(0, (agora.getTime() - new Date(m.retomadoEm).getTime()) / 1000) : 0;
  return m.acumuladoSegundos + rodando;
}

export function iniciarMedicao(base: Omit<Medicao, "estado" | "acumuladoSegundos" | "retomadoEm" | "fim" | "criadoEm">, agora: Date): Medicao {
  const iso = agora.toISOString();
  return { ...base, estado: "rodando", acumuladoSegundos: 0, retomadoEm: iso, fim: null, criadoEm: iso };
}

export function pausarMedicao(m: Medicao, agora: Date): Medicao {
  if (m.estado !== "rodando") return m;
  return { ...m, estado: "pausado", acumuladoSegundos: segundosDaMedicao(m, agora), retomadoEm: null };
}

export function retomarMedicao(m: Medicao, agora: Date): Medicao {
  if (m.estado !== "pausado") return m;
  return { ...m, estado: "rodando", retomadoEm: agora.toISOString() };
}

export function pararMedicao(m: Medicao, agora: Date): Medicao {
  if (m.estado === "concluido") return m;
  return { ...m, estado: "concluido", acumuladoSegundos: segundosDaMedicao(m, agora), retomadoEm: null, fim: agora.toISOString() };
}

/** Cronômetro opcional (01/10/2026): não há mais número de medições pedido. Com uma medição já existe média. */
export type SituacaoCalibragem = "sem_medicao" | "medido";

export interface CalibragemTipo {
  tipoEntregaId: Id;
  nome: string;
  /** entregas medidas que contam (depois de "calibrar desde"); uma tarefa de 12 posts conta 12 */
  medicoes: number;
  situacao: SituacaoCalibragem;
  mediaMinutos: number | null;
  padraoMinutos: number | null;
  /** (média − padrão) ÷ padrão × 100 */
  diferencaPct: number | null;
  /** calibrado e a média difere do padrão o bastante para sugerir atualizar */
  sugerirAtualizar: boolean;
  /** frase pronta para a tela */
  sugestao: string | null;
}

const minutos = (h: number | null) => (h == null ? null : h * 60);

export const formatarMinutos = (min: number | null | undefined) => formatarDuracao(min == null ? null : min / 60);

/** Medições concluídas de um tipo que contam para a calibragem. */
export function medicoesQueContam(tipo: TipoEntrega, medicoes: Medicao[]): Medicao[] {
  const desde = tipo.calibrarDesde ? new Date(tipo.calibrarDesde).getTime() : null;
  return medicoes.filter(
    (m) => m.tipoEntregaId === tipo.id && m.estado === "concluido" && m.acumuladoSegundos > 0 && (desde == null || new Date(m.fim ?? m.criadoEm).getTime() >= desde),
  );
}

export function calcularCalibragem(config: Configuracao, medicoes: Medicao[]): CalibragemTipo[] {
  const limiar = config.empresa.diferencaSugerirPct ?? null;
  return config.tiposEntrega
    .filter((t) => t.ativo && !t.audiovisual)
    .map((t) => {
      const ms = medicoesQueContam(t, medicoes);
      const n = ms.reduce((a, m) => a + unidadesDe(m), 0);
      const media = n ? ms.reduce((a, m) => a + m.acumuladoSegundos, 0) / n / 60 : null;
      const padrao = minutos(t.horasPorUnidade);
      const situacao: SituacaoCalibragem = n === 0 ? "sem_medicao" : "medido";
      const dif = media != null && padrao != null && padrao > 0 ? ((media - padrao) / padrao) * 100 : null;
      // diferença de menos de 1 minuto é arredondamento, nunca vira sugestão
      const diferente = media != null && (padrao == null || Math.abs(media - padrao) >= 1);
      const passaLimiar = limiar == null || dif == null || Math.abs(dif) >= limiar;
      const sugerir = situacao === "medido" && diferente && passaLimiar;
      return {
        tipoEntregaId: t.id,
        nome: t.nome,
        medicoes: n,
        situacao,
        mediaMinutos: media,
        padraoMinutos: padrao,
        diferencaPct: dif,
        sugerirAtualizar: sugerir,
        sugestao: sugerir
          ? padrao == null
            ? `${t.nome} está levando em média ${formatarMinutos(media)} e não tem padrão cadastrado. Usar como padrão?`
            : `${t.nome} está levando em média ${formatarMinutos(media)}, não ${formatarMinutos(padrao)}. Atualizar o padrão?`
          : null,
      };
    });
}
