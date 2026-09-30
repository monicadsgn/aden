// Mês visto de cima: o que entrou, os custos, o tráfego próprio e a parte de cada sócio.
//
// Regra da sociedade (decidida em 29/09/2026; os números vêm da configuração):
// - Antes da virada (o que ENTROU no mês abaixo do teto): um sócio recebe um % do que entrou,
//   depois do imposto em %. Do resto saem a taxa de recebimento, os custos da Aden e os dos
//   clientes (terceiros). O que sobra é do outro sócio; ele escolhe quanto dessa sobra vai para
//   o tráfego próprio da Aden. Se o tráfego não chegar ao mínimo, ou se o resto não cobrir os
//   custos, quem completa é esse outro sócio.
// - Da virada para cima: o tráfego próprio fica com o mínimo configurado e a sobra é dividida
//   pelo % padrão de cada sócio. O que faltar, cada um cobre na mesma proporção.
// - Custo pago do bolso de um sócio aparece em "bancado por" e não sai do caixa da Aden.
// - Custo planejado (desligado) acende um aviso quando a sobra do mês cobre o valor e ainda
//   deixa o tráfego próprio no mínimo.
// Pagamentos contam no mês em que caíram (recebidoEm), não no mês de referência.

import { formatarMoeda, formatarPct } from "../formato";
import { escopoDoCliente } from "./mes";
import { prepararMes } from "./motor";
import type { Pagamento } from "./pagamentos";
import type { Alerta, Configuracao, Id } from "./tipos";

const v0 = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? 0 : v);
const EPS = 0.5;

/** Taxa de recebimento de um pagamento: a lançada nele (ex.: cartão) ou o padrão da configuração. */
export function taxaDoPagamento(config: Configuracao, p: Pagamento): number {
  if (p.taxaCentavos != null) return p.taxaCentavos;
  if (p.valorCentavos <= 0) return 0;
  return (p.valorCentavos * v0(config.empresa.taxaRecebimentoPct)) / 100 + v0(config.empresa.taxaRecebimentoFixaCentavos);
}

/** Imposto em % que vale (no MEI o imposto é o DAS fixo, que entra como custo). */
export function impostoPctDoMes(config: Configuracao): number {
  return config.empresa.regime === "mei" ? 0 : v0(config.empresa.impostoPct);
}

export interface ParteSocioMes {
  pessoaId: Id;
  nome: string;
  /** o que fica para ele no mês (negativo = ele completa do bolso) */
  parteCentavos: number;
  /** frase curta: de onde vem a parte */
  regra: string;
  /** antes da virada: o que passou do valor do aviso, destacado como bônus */
  bonusCentavos: number | null;
}

export interface BancadoPor {
  pessoaId: Id;
  nome: string;
  centavos: number;
  itens: string[];
}

export interface MesDeCima {
  mes: string;
  entrouCentavos: number;
  porCliente: { clienteId: Id; nome: string; centavos: number }[];
  impostoCentavos: number;
  /** DAS do MEI (imposto fixo), pago pelo caixa */
  impostoFixoCentavos: number;
  taxasCentavos: number;
  /** custos fixos pagos pela Aden (sem o DAS) */
  custosFixosCaixaCentavos: number;
  /** custos dos clientes no mês (terceiros, audiovisual, ferramentas do escopo) */
  custosClientesCentavos: number;
  bancadoPor: BancadoPor[];
  divisao: "percentual" | "virada" | "sem_regra";
  socios: ParteSocioMes[];
  /** o que vai para o tráfego próprio da Aden neste mês */
  trafegoProprioCentavos: number;
  trafegoMinimoCentavos: number | null;
  /** quanto um sócio precisa pôr para o tráfego chegar ao mínimo */
  completaTrafego: { pessoaId: Id; nome: string; centavos: number } | null;
  tetoViradaCentavos: number | null;
  faltaParaViradaCentavos: number | null;
  /** custos planejados (desligados) e se a sobra do mês já cobre cada um */
  planejados: { id: Id; nome: string; centavos: number; cabe: boolean }[];
  alertas: Alerta[];
}

const noMes = (data: string, mes: string) => data.slice(0, 7) === mes;

export function calcularMesDeCima(config: Configuracao, pagamentos: Pagamento[], mes: string): MesDeCima {
  const e = config.empresa;
  const alertas: Alerta[] = [];
  const nomeDe = (id: Id | null | undefined) => config.pessoas.find((p) => p.id === id)?.nome ?? "sócio";
  const socios = config.pessoas.filter((p) => p.ativo && p.socio);

  // O que entrou
  const doMes = pagamentos.filter((p) => noMes(p.recebidoEm, mes));
  const entrou = doMes.reduce((a, p) => a + p.valorCentavos, 0);
  const porCliente = config.clientes
    .map((c) => ({ clienteId: c.id, nome: c.nome, centavos: doMes.filter((p) => p.clienteId === c.id).reduce((a, p) => a + p.valorCentavos, 0) }))
    .filter((x) => x.centavos > 0);

  const imposto = (entrou * impostoPctDoMes(config)) / 100;
  const impostoFixo = v0(e.impostoFixoMensalCentavos);
  const taxas = doMes.reduce((a, p) => a + taxaDoPagamento(config, p), 0);

  // Custos: fixos da Aden, bancados por sócio e os dos clientes
  const ativos = config.custosFixos.filter((c) => c.ativo && !c.planejado);
  const doCaixa = ativos.filter((c) => !c.pagoPorPessoaId);
  const custosFixosCaixa = doCaixa.reduce((a, c) => a + v0(c.valorMensalCentavos), 0);
  const bancado = new Map<Id, BancadoPor>();
  for (const c of ativos.filter((x) => x.pagoPorPessoaId)) {
    const id = c.pagoPorPessoaId!;
    const b = bancado.get(id) ?? { pessoaId: id, nome: nomeDe(id), centavos: 0, itens: [] };
    b.centavos += v0(c.valorMensalCentavos);
    b.itens.push(c.nome);
    bancado.set(id, b);
  }
  let custosClientes = 0;
  for (const cli of config.clientes.filter((c) => c.ativo && c.escopo)) {
    const prep = prepararMes(config, escopoDoCliente(cli), { semRateio: true, semCapacidade: true });
    custosClientes += prep.custosProjeto;
  }
  const custosCaixa = custosFixosCaixa + impostoFixo + custosClientes;

  // Regra da sociedade
  const temRegra =
    !!e.socioPercentualId && e.sociedadePctSocio != null && e.sociedadeTetoViradaCentavos != null && socios.some((s) => s.id === e.socioPercentualId);
  const teto = temRegra ? e.sociedadeTetoViradaCentavos! : null;
  const minimo = e.trafegoProprioMinimoCentavos ?? null;
  const reinvPct = v0(e.reinvestimentoPct);
  const divisao: MesDeCima["divisao"] = !temRegra ? "sem_regra" : entrou >= teto! - EPS ? "virada" : "percentual";

  const partes: ParteSocioMes[] = [];
  let trafego = 0;
  let completaTrafego: MesDeCima["completaTrafego"] = null;
  let folga = 0; // o que sobra acima do tráfego mínimo (para os custos planejados)

  if (divisao === "percentual") {
    const pct = e.sociedadePctSocio!;
    const base = entrou - imposto;
    const parteSocio = (base * pct) / 100;
    const aviso = e.sociedadeAvisoBonusCentavos ?? null;
    const bonus = aviso != null && parteSocio > aviso + EPS ? parteSocio - aviso : null;
    partes.push({ pessoaId: e.socioPercentualId!, nome: nomeDe(e.socioPercentualId), parteCentavos: parteSocio, regra: `${formatarPct(pct)} do que entrou, depois do imposto`, bonusCentavos: bonus });

    const sobraId = e.socioSobraId && e.socioSobraId !== e.socioPercentualId ? e.socioSobraId : socios.find((s) => s.id !== e.socioPercentualId)?.id ?? null;
    const resto = base - parteSocio - taxas - custosCaixa;
    const reinv = resto > 0 ? (resto * reinvPct) / 100 : 0;
    const sobra = resto - reinv;
    const pctTrafego = e.sociedadeSobraTrafegoPct ?? 0;
    trafego = sobra > 0 ? (sobra * pctTrafego) / 100 : 0;
    let parteSobra = sobra - trafego;
    folga = sobra - (minimo ?? 0);
    if (minimo != null && trafego < minimo - EPS && sobraId) {
      const falta = minimo - trafego;
      completaTrafego = { pessoaId: sobraId, nome: nomeDe(sobraId), centavos: falta };
      parteSobra -= falta;
      trafego = minimo;
    }
    if (sobraId)
      partes.push({
        pessoaId: sobraId,
        nome: nomeDe(sobraId),
        parteCentavos: parteSobra,
        regra: pctTrafego >= 100 - EPS ? "a sobra vai toda para o tráfego da Aden" : `fica com ${formatarPct(100 - pctTrafego)} da sobra; ${formatarPct(pctTrafego)} vai para o tráfego`,
        bonusCentavos: null,
      });
    if (resto < -EPS && sobraId)
      alertas.push({
        nivel: "aviso",
        texto: `O que entrou não cobriu os custos do mês: ${nomeDe(sobraId)} completa ${formatarMoeda(-resto)}.`,
        explica: `Antes da virada, a parte de ${nomeDe(e.socioPercentualId)} sai primeiro e os custos saem do resto. Ex.: entraram R$ 1.000, a parte dela é R$ 300 e os custos são R$ 900: faltam R$ 200, que ${nomeDe(sobraId)} completa.`,
        acao: { rotulo: "Ver as regras da sociedade", destino: { tipo: "config", secao: "regras", campo: "sociedade" } },
      });
  } else {
    // depois da virada, ou sem a regra: tráfego no mínimo e a sobra pelo % padrão
    const antesTrafego = entrou - imposto - taxas - custosCaixa;
    const reinv = antesTrafego > 0 ? (antesTrafego * reinvPct) / 100 : 0;
    trafego = minimo ?? 0;
    const sobra = antesTrafego - reinv - trafego;
    folga = sobra;
    const somaPct = socios.reduce((a, s) => a + v0(s.percentualPadrao), 0);
    for (const s of socios) {
      const fatia = somaPct > 0 ? v0(s.percentualPadrao) / somaPct : 1 / socios.length;
      partes.push({
        pessoaId: s.id,
        nome: s.nome,
        parteCentavos: sobra * fatia,
        regra: `${formatarPct(fatia * 100)} da sobra${minimo != null ? ", depois do tráfego mínimo" : ""}`,
        bonusCentavos: null,
      });
    }
    if (divisao === "sem_regra")
      alertas.push({
        nivel: "lembrete",
        texto: "A regra da sociedade ainda não foi preenchida: a sobra foi dividida pelo % padrão de cada sócio.",
        explica: "A regra diz quem recebe um % do que entra antes da virada e a partir de quanto a divisão fica igual. Ex.: 30% do que entrou para um sócio até R$ 15.000 no mês. Sem ela, o sistema divide a sobra pelo % de cada sócio.",
        acao: { rotulo: "Preencher a regra", destino: { tipo: "config", secao: "regras", campo: "sociedade" } },
      });
  }

  const planejados = config.custosFixos
    .filter((c) => c.planejado)
    .map((c) => ({ id: c.id, nome: c.nome, centavos: v0(c.valorMensalCentavos), cabe: v0(c.valorMensalCentavos) > 0 && folga >= v0(c.valorMensalCentavos) - EPS }));
  for (const p of planejados.filter((x) => x.cabe))
    alertas.push({
      nivel: "info",
      texto: `A sobra deste mês já cobre ${p.nome} (${formatarMoeda(p.centavos)}) e ainda deixa o tráfego da Aden no mínimo. Hora de decidir se liga.`,
      explica: `É um custo guardado para quando o caixa permitir. Ex.: sobraram ${formatarMoeda(folga)} além do tráfego mínimo; ${p.nome} custa ${formatarMoeda(p.centavos)}. Ligar é decisão dos sócios, em Configurações → Custos fixos.`,
      acao: { rotulo: "Ver os custos", destino: { tipo: "config", secao: "custos" } },
    });

  return {
    mes,
    entrouCentavos: entrou,
    porCliente,
    impostoCentavos: imposto,
    impostoFixoCentavos: impostoFixo,
    taxasCentavos: taxas,
    custosFixosCaixaCentavos: custosFixosCaixa,
    custosClientesCentavos: custosClientes,
    bancadoPor: [...bancado.values()],
    divisao,
    socios: partes,
    trafegoProprioCentavos: trafego,
    trafegoMinimoCentavos: minimo,
    completaTrafego,
    tetoViradaCentavos: teto,
    faltaParaViradaCentavos: teto != null ? Math.max(0, teto - entrou) : null,
    planejados,
    alertas,
  };
}

/**
 * Em que mês do ano o faturamento passa do teto anual do regime (ex.: MEI).
 * Soma o que já entrou no ano até o mês passado e, deste mês em diante, projeta o maior entre
 * o que já entrou no mês e o valor mensal dos contratos ativos. null = não estoura no ano.
 */
export function mesQueEstouraOTeto(config: Configuracao, pagamentos: Pagamento[], hoje: string): string | null {
  const teto = config.empresa.tetoFaturamentoAnualCentavos;
  if (teto == null || teto <= 0) return null;
  const ano = hoje.slice(0, 4);
  const mesAtual = Number(hoje.slice(5, 7));
  const contratado = config.clientes.filter((c) => c.ativo && !c.interno).reduce((a, c) => a + v0(c.valorMensalCentavos), 0);
  const entrouNoMes = (m: number) => {
    const chave = `${ano}-${String(m).padStart(2, "0")}`;
    return pagamentos.filter((p) => noMes(p.recebidoEm, chave)).reduce((a, p) => a + p.valorCentavos, 0);
  };
  let soma = 0;
  for (let m = 1; m <= 12; m++) {
    soma += m < mesAtual ? entrouNoMes(m) : Math.max(entrouNoMes(m), contratado);
    if (soma > teto + EPS) return `${ano}-${String(m).padStart(2, "0")}`;
  }
  return null;
}
