// Pacotes fechados para a negociação.
//
// O pacote guarda só O QUE é entregue (tipos e quantidades). Horas e preço saem do
// cálculo que já existe, nunca digitados:
// - manutenção mensal = valor mínimo do escopo da rotina (modo escopo, cliente novo),
//   arredondado para cima como a proposta
// - primeiro mês (entrada) = mínimo de um mês com a rotina + a entrada − mínimo da rotina
//   sozinha (assim segue a regra da sociedade: com 30% para um sócio, as horas dele na
//   entrada custam o piso ÷ 30%), arredondado do mesmo jeito (01/10/2026)
// - projeto avulso (sem mensalidade) = mínimo de um mês só com o projeto: piso de cada sócio
//   pela regra da sociedade e a parte dele dos custos fixos pela regra da divisão
// O cliente vê só o nome, frases simples e os dois valores; nunca quantidades, horas
// nem o valor pago a terceiro.

import { formatarMoeda } from "../formato";
import { calcularCenario, custoTerceiroPorSaida } from "./motor";
import { novoCenario, novoId } from "./novo";
import type { Cenario, Configuracao, Id, ItemPacote, Pacote, ResultadoCenario } from "./tipos";

const v0 = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? 0 : v);

const linhas = (itens: ItemPacote[]) =>
  itens.filter((i) => i.tipoEntregaId).map((i) => ({ id: novoId(), tipoEntregaId: i.tipoEntregaId, quantidade: i.quantidade, horasPorUnidade: null }));

/** Cenário (modo escopo, cliente novo) montado a partir do pacote. */
export function pacoteParaCenario(pacote: Pacote, base?: Partial<Cenario>): Cenario {
  const c = novoCenario(pacote.nome);
  if (pacote.avulso) return { ...c, ...base, pacoteId: pacote.id, avulso: true, entregas: linhas(pacote.rotina) };
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
  /** projeto avulso: `mensalCentavos` é o valor único do projeto (sem mensalidade) */
  avulso: boolean;
  /** manutenção mensal (no avulso, o valor do projeto); null = ainda não dá para calcular (ver `motivo`) */
  mensalCentavos: number | null;
  /** primeiro mês (entrada); null = sem entrada, ou quantidades a confirmar */
  entradaCentavos: number | null;
  /** alguma quantidade do primeiro mês ainda está vazia */
  entradaAConfirmar: boolean;
  motivo: string | null;
  resultado: ResultadoCenario;
}

/** Valor mínimo do mês (sem arredondar) de um cenário no modo escopo; null = não dá para calcular. */
function minimoDoMes(config: Configuracao, cenario: Cenario): number | null {
  const r = calcularCenario(config, { ...cenario, modo: "escopo", mensalidadeCentavos: null });
  return r.minimo.possivel ? r.minimo.mensalidadeMinimaCentavos : null;
}

/**
 * Valor do primeiro mês (entrada): quanto o mínimo do mês sobe com a entrada junto da rotina. Segue a regra da
 * sociedade e a divisão dos custos fixos, igual à mensalidade. null = não dá para calcular.
 */
export function valorEntrada(config: Configuracao, cenario: Cenario): number | null {
  const e = cenario.entrada;
  if (!e || (!e.entregas.some((l) => l.tipoEntregaId && v0(l.quantidade) > 0) && !e.custos.length)) return null;
  const rotina = minimoDoMes(config, { ...cenario, entrada: undefined });
  const junto = minimoDoMes(config, { ...cenario, entrada: undefined, entregas: [...cenario.entregas, ...e.entregas], custos: [...cenario.custos, ...e.custos] });
  if (rotina == null || junto == null) return null;
  return arredondar(config, Math.max(0, junto - rotina));
}

export function precoDoCenario(config: Configuracao, cenario: Cenario): PrecoPacote {
  const r = calcularCenario(config, cenario);
  const aConfirmar = (cenario.entrada?.entregas ?? []).some((l) => l.quantidade == null);
  return {
    avulso: !!cenario.avulso,
    mensalCentavos: r.proposta?.valorCentavos ?? null,
    entradaCentavos: aConfirmar || cenario.avulso ? null : valorEntrada(config, cenario),
    entradaAConfirmar: aConfirmar,
    motivo: r.bloqueio?.texto ?? (r.minimo.possivel ? null : r.minimo.motivo),
    resultado: r,
  };
}

/** Prazo do projeto em dias úteis: o maior prazo entre os tipos marcados como projeto (os extras não têm prazo). */
export function prazoDoProjeto(config: Configuracao, linhas: { tipoEntregaId: Id | null; quantidade: number | null }[]): number | null {
  const prazos = linhas
    .filter((l) => l.tipoEntregaId && v0(l.quantidade) > 0)
    .map((l) => config.tiposEntrega.find((t) => t.id === l.tipoEntregaId))
    .filter((t) => t?.projeto && t.prazoDias != null)
    .map((t) => t!.prazoDias!);
  return prazos.length ? Math.max(...prazos) : null;
}

/** Parcelas do projeto avulso: % no início e o resto na entrega (o % vem da configuração; vazio = sem parcelas). */
export function parcelasDoProjeto(config: Configuracao, valorCentavos: number | null): { sinalPct: number; inicioCentavos: number; entregaCentavos: number } | null {
  const pct = config.empresa.avulsoSinalPct;
  if (pct == null || valorCentavos == null) return null;
  const inicio = Math.round((valorCentavos * pct) / 100);
  return { sinalPct: pct, inicioCentavos: inicio, entregaCentavos: valorCentavos - inicio };
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

export interface ProjetoQueCabe {
  pacoteId: Id;
  nome: string;
  /** valor mínimo calculado do projeto; null = não dá para calcular */
  precoCentavos: number | null;
  prazoDiasUteis: number | null;
  /** null = ainda sem o valor do cliente */
  cabe: boolean | null;
  /** quanto passa do mínimo (negativo = falta) */
  folgaCentavos: number | null;
  /** valor por hora de cada sócio com horas no projeto, se o cliente pagar o valor informado */
  porHora: { pessoaId: Id; nome: string; valorHoraCentavos: number | null; abaixoPiso: boolean }[];
}

/** Modo valor, "paga uma vez": cada pacote de projeto avulso ativo, do mais barato ao mais caro, e se cabe no valor. */
export function projetosQueCabem(config: Configuracao, valorCentavos: number | null): ProjetoQueCabe[] {
  const socios = new Set(config.pessoas.filter((p) => p.socio).map((p) => p.id));
  return (config.pacotes ?? [])
    .filter((p) => p.ativo && p.avulso)
    .map((p) => {
      const preco = precoDoPacote(config, p).mensalCentavos;
      const comValor = valorCentavos != null ? calcularCenario(config, { ...pacoteParaCenario(p), modo: "valor", mensalidadeCentavos: valorCentavos }) : null;
      return {
        pacoteId: p.id,
        nome: p.nome,
        precoCentavos: preco,
        prazoDiasUteis: prazoDoProjeto(config, p.rotina),
        cabe: valorCentavos == null || preco == null ? null : valorCentavos >= preco,
        folgaCentavos: valorCentavos == null || preco == null ? null : valorCentavos - preco,
        porHora: (comValor?.mes?.pessoas ?? [])
          .filter((x) => socios.has(x.id) && x.horas > 0)
          .map((x) => ({ pessoaId: x.id, nome: x.nome, valorHoraCentavos: x.valorHoraCentavos, abaixoPiso: x.abaixoPiso })),
      };
    })
    .sort((a, b) => (a.precoCentavos ?? Infinity) - (b.precoCentavos ?? Infinity));
}

/** "50% no início (R$ 600,00) e 50% na entrega (R$ 600,00)": igual na tela e no PDF. */
export function textoParcelas(p: { sinalPct: number; inicioCentavos: number; entregaCentavos: number }): string {
  const pct = (v: number) => `${Number(v.toFixed(2)).toLocaleString("pt-BR")}%`;
  if (p.sinalPct >= 100) return `À vista, no início (${formatarMoeda(p.inicioCentavos)}).`;
  if (p.sinalPct <= 0) return `Na entrega (${formatarMoeda(p.entregaCentavos)}).`;
  return `${pct(p.sinalPct)} no início (${formatarMoeda(p.inicioCentavos)}) e ${pct(100 - p.sinalPct)} na entrega (${formatarMoeda(p.entregaCentavos)}).`;
}
