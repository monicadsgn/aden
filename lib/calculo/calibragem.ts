// Cronômetro e calibragem das horas.
//
// Ninguém sabe de cabeça quanto leva cada entrega. O cronômetro mede as primeiras
// entregas de cada tipo (quantas, vem da configuração). Depois disso o tipo fica
// "calibrado" e a média medida passa a ser usada para estimar as horas reais do mês.
// O padrão cadastrado (que é campo protegido) só muda se alguém aceitar a sugestão
// e o sócio afetado aprovar.

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
}

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

export type SituacaoCalibragem = "sem_medicao" | "calibrando" | "calibrado";

export interface CalibragemTipo {
  tipoEntregaId: Id;
  nome: string;
  /** medições concluídas que contam (depois de "calibrar desde") */
  medicoes: number;
  /** quantas são pedidas para calibrar; null = não configurado */
  alvo: number | null;
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
  const alvo = config.empresa.medicoesCalibragem != null && config.empresa.medicoesCalibragem > 0 ? config.empresa.medicoesCalibragem : null;
  const limiar = config.empresa.diferencaSugerirPct ?? null;
  return config.tiposEntrega
    .filter((t) => t.ativo && !t.audiovisual)
    .map((t) => {
      const ms = medicoesQueContam(t, medicoes);
      const n = ms.length;
      const media = n ? ms.reduce((a, m) => a + m.acumuladoSegundos, 0) / n / 60 : null;
      const padrao = minutos(t.horasPorUnidade);
      const situacao: SituacaoCalibragem = n === 0 ? "sem_medicao" : alvo != null && n >= alvo ? "calibrado" : "calibrando";
      const dif = media != null && padrao != null && padrao > 0 ? ((media - padrao) / padrao) * 100 : null;
      // diferença de menos de 1 minuto é arredondamento, nunca vira sugestão
      const diferente = media != null && (padrao == null || Math.abs(media - padrao) >= 1);
      const passaLimiar = limiar == null || dif == null || Math.abs(dif) >= limiar;
      const sugerir = situacao === "calibrado" && diferente && passaLimiar;
      return {
        tipoEntregaId: t.id,
        nome: t.nome,
        medicoes: n,
        alvo,
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

/** Tipos que ainda pedem cronômetro (modo calibragem). Sem alvo configurado, nenhum pede. */
export function pedeCronometro(c: CalibragemTipo): boolean {
  return c.alvo != null && c.medicoes < c.alvo;
}

/**
 * Configuração com a média medida no lugar do padrão, só para os tipos calibrados.
 * Serve para estimar as horas reais do mês; a calculadora continua usando o padrão.
 */
export function configComMediaMedida(config: Configuracao, calibragem: CalibragemTipo[]): Configuracao {
  const medidos = new Map(calibragem.filter((c) => c.situacao === "calibrado" && c.mediaMinutos != null).map((c) => [c.tipoEntregaId, c]));
  if (!medidos.size) return config;
  return {
    ...config,
    tiposEntrega: config.tiposEntrega.map((t) => {
      const c = medidos.get(t.id);
      return c ? { ...t, horasPorUnidade: c.mediaMinutos! / 60 } : t;
    }),
  };
}
