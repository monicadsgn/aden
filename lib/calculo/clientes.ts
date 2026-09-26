// Ficha do cliente: datas do contrato e o que vence.
// Nenhum prazo vem pronto: são os combinados com cada cliente (campos vazios = sem aviso).

import { hojeISO, somarDias } from "./dia";
import type { ClienteBase, DadosContrato, Id } from "./tipos";

export function contratoVazio(): DadosContrato {
  return {
    inicio: null,
    fim: null,
    prazoMinimoMeses: null,
    diaPagamento: null,
    avisoPrevioDias: null,
    limiteRodadas: null,
    prazoAprovacaoDias: null,
    prazoEntregaDias: null,
    inicioCobranca: "",
    observacoes: "",
  };
}

const ultimoDia = (ano: number, mes0: number) => new Date(ano, mes0 + 1, 0).getDate();

/** Dia do pagamento neste mês (dia 31 num mês de 30 dias vira o dia 30). */
export function vencimentoNoMes(diaPagamento: number, competencia: string): string {
  const [a, m] = competencia.split("-").map(Number);
  const d = Math.min(diaPagamento, ultimoDia(a, m - 1));
  return `${competencia}-${String(d).padStart(2, "0")}`;
}

/** Fim da fidelidade: início + prazo mínimo (em meses). */
export function fimDaFidelidade(k: DadosContrato): string | null {
  if (!k.inicio || !k.prazoMinimoMeses) return null;
  const [a, m, d] = k.inicio.split("-").map(Number);
  return hojeISO(new Date(a, m - 1 + k.prazoMinimoMeses, d));
}

/** Último dia para avisar que não renova: fim do contrato − aviso prévio. */
export function prazoDoAvisoPrevio(k: DadosContrato): string | null {
  if (!k.fim || k.avisoPrevioDias == null) return null;
  return somarDias(k.fim, -k.avisoPrevioDias);
}

export interface Lembrete {
  clienteId: Id;
  cliente: string;
  texto: string;
  data: string;
}

/**
 * O que vence em relação aos contratos, para a Visão do dia: pagamento que vence hoje e
 * ainda não entrou; contrato que termina neste mês (ou já dentro do aviso prévio); e o
 * último dia do aviso prévio quando cai neste mês. Sem número fixo de dias: usa o que
 * foi combinado no contrato.
 */
export function lembretesDeContrato(clientes: ClienteBase[], recebidoNoMes: (clienteId: Id) => number, hoje = hojeISO()): Lembrete[] {
  const out: Lembrete[] = [];
  const competencia = hoje.slice(0, 7);
  for (const c of clientes.filter((x) => x.ativo && !x.interno)) {
    const k = c.contrato;
    if (!k) continue;
    if (k.diaPagamento != null) {
      const venc = vencimentoNoMes(k.diaPagamento, competencia);
      const falta = c.valorMensalCentavos != null && recebidoNoMes(c.id) < c.valorMensalCentavos;
      if (venc === hoje && falta) out.push({ clienteId: c.id, cliente: c.nome, texto: "pagamento vence hoje", data: venc });
    }
    const aviso = prazoDoAvisoPrevio(k);
    if (k.fim && k.fim >= hoje && (k.fim.startsWith(competencia) || (aviso != null && hoje >= aviso)))
      out.push({ clienteId: c.id, cliente: c.nome, texto: "contrato termina", data: k.fim });
    if (aviso && aviso >= hoje && aviso.startsWith(competencia)) out.push({ clienteId: c.id, cliente: c.nome, texto: "último dia do aviso prévio", data: aviso });
  }
  return out.sort((a, b) => a.data.localeCompare(b.data));
}

/**
 * O cliente já era cliente naquele mês? (pelo início do contrato ou "cliente desde").
 * Sem data nenhuma, conta como cliente em qualquer mês, como sempre foi.
 */
export function clienteNoMes(c: ClienteBase, competencia: string): boolean {
  const inicio = c.contrato?.inicio ?? c.clienteDesde ?? null;
  return !inicio || inicio.slice(0, 7) <= competencia;
}
