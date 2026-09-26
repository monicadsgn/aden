// Pacotes fechados para a negociação.
//
// O pacote guarda só O QUE é entregue (tipos e quantidades). Horas e preço saem do
// cálculo que já existe, nunca digitados:
// - manutenção mensal = valor mínimo do escopo da rotina (modo escopo, cliente novo),
//   arredondado para cima como a proposta
// - primeiro mês (entrada) = (custos em dinheiro da entrada + horas da entrada × piso de
//   cada sócio) ÷ (1 − imposto% − taxa%), arredondado do mesmo jeito
// O cliente vê só o nome, frases simples e os dois valores; nunca quantidades, horas
// nem o valor pago a terceiro.

import { calcularCenario, custoTerceiroPorSaida } from "./motor";
import { novoCenario, novoId } from "./novo";
import type { Cenario, Configuracao, Id, ItemPacote, Pacote, ResultadoCenario } from "./tipos";

const v0 = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? 0 : v);

const linhas = (itens: ItemPacote[]) =>
  itens.filter((i) => i.tipoEntregaId).map((i) => ({ id: novoId(), tipoEntregaId: i.tipoEntregaId, quantidade: i.quantidade, horasPorUnidade: null }));

/** Cenário (modo escopo, cliente novo) montado a partir do pacote. */
export function pacoteParaCenario(pacote: Pacote, base?: Partial<Cenario>): Cenario {
  const c = novoCenario(pacote.nome);
  return {
    ...c,
    ...base,
    pacoteId: pacote.id,
    entregas: linhas(pacote.rotina),
    entrada: { entregas: linhas(pacote.entrada), custos: [], valorCobradoCentavos: null, mesesParaPagar: null },
  };
}

function arredondar(config: Configuracao, valor: number): number {
  const passo = config.empresa.arredondamentoPropostaCentavos;
  return passo != null && passo > 0 ? Math.ceil(valor / passo - 1e-9) * passo : Math.ceil(valor);
}

export interface PrecoPacote {
  /** manutenção mensal; null = ainda não dá para calcular (ver `motivo`) */
  mensalCentavos: number | null;
  /** primeiro mês (entrada); null = sem entrada, ou quantidades a confirmar */
  entradaCentavos: number | null;
  /** alguma quantidade do primeiro mês ainda está vazia */
  entradaAConfirmar: boolean;
  motivo: string | null;
  resultado: ResultadoCenario;
}

/** Valor do primeiro mês (entrada): custos + horas no piso, com imposto e taxa por cima. */
export function valorEntrada(config: Configuracao, r: ResultadoCenario): number | null {
  const e = r.entrada;
  if (!e) return null;
  const imp = r.mes?.impostoPct ?? v0(config.empresa.regime === "mei" ? 0 : config.empresa.impostoPct);
  const taxa = r.mes?.taxaRecebimentoPct ?? v0(config.empresa.taxaRecebimentoPct);
  const a = 1 - (imp + taxa) / 100;
  if (a <= 0) return null;
  const base = e.custosDinheiroCentavos + e.horasNoPisoCentavos;
  return base > 0 ? arredondar(config, base / a) : 0;
}

export function precoDoCenario(config: Configuracao, cenario: Cenario): PrecoPacote {
  const r = calcularCenario(config, cenario);
  const aConfirmar = (cenario.entrada?.entregas ?? []).some((l) => l.quantidade == null);
  return {
    mensalCentavos: r.proposta?.valorCentavos ?? null,
    entradaCentavos: aConfirmar ? null : valorEntrada(config, r),
    entradaAConfirmar: aConfirmar,
    motivo: r.bloqueio?.texto ?? (r.minimo.possivel ? null : r.minimo.motivo),
    resultado: r,
  };
}

export const precoDoPacote = (config: Configuracao, pacote: Pacote) => precoDoCenario(config, pacoteParaCenario(pacote));

/** Frases que o cliente lê: as do pacote + a frase de cada terceiro usado (nunca o valor). */
export function frasesParaCliente(config: Configuracao, pacote: Pacote | null, cenario: Cenario): string[] {
  const out = [...(pacote?.itensCliente ?? [])].map((f) => f.trim()).filter(Boolean);
  const usados = new Set<Id>();
  for (const l of [...cenario.entregas, ...(cenario.entrada?.entregas ?? [])]) {
    if (!l.tipoEntregaId || v0(l.quantidade) <= 0) continue;
    const t = custoTerceiroPorSaida(config, l.tipoEntregaId, cenario.deslocamentos, null);
    if (t && !usados.has(t.terceiro.id)) {
      usados.add(t.terceiro.id);
      if (t.terceiro.fraseCliente.trim()) out.push(t.terceiro.fraseCliente.trim());
    }
  }
  return [...new Set(out)];
}

/** Diferença de uma entrega entre o cenário personalizado e o pacote original. */
export function diferencaDoPacote(pacote: Pacote, cenario: Cenario): { tipoEntregaId: Id; original: number; atual: number }[] {
  const soma = (ls: { tipoEntregaId: Id | null; quantidade: number | null }[]) => {
    const m = new Map<Id, number>();
    for (const l of ls) if (l.tipoEntregaId) m.set(l.tipoEntregaId, (m.get(l.tipoEntregaId) ?? 0) + v0(l.quantidade));
    return m;
  };
  const a = soma(pacote.rotina);
  const b = soma(cenario.entregas);
  return [...new Set([...a.keys(), ...b.keys()])]
    .map((id) => ({ tipoEntregaId: id, original: a.get(id) ?? 0, atual: b.get(id) ?? 0 }))
    .filter((d) => d.original !== d.atual);
}

export const pacotePadrao = (config: Configuracao) => (config.pacotes ?? []).find((p) => p.ativo && p.padrao) ?? null;
