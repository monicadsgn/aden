// Pagamentos que caem de verdade (inteiros, em partes, atrasados) e para onde vai cada real.
//
// O mês planejado de cada cliente sai do motor (valor do contrato + escopo): imposto,
// taxa, custos (do projeto + parte do custo fixo, que já inclui o imposto fixo do MEI),
// reinvestimento e a parte de cada sócio. Cada pagamento é distribuído nessa estrutura:
// - custo_primeiro: o que entra cobre primeiro os custos do mês; o resto é sobra
// - proporcional: cada real vai para custos e sobra na mesma proporção do mês completo
// Imposto em % e taxa de recebimento são descontados de cada pagamento (a tarifa fixa
// é cobrada por pagamento). Sem ordem escolhida, a distribuição fica bloqueada.

import { escopoDoCliente } from "./mes";
import { calcularComReceita, prepararMes } from "./motor";
import { novoCenario } from "./novo";
import type { Alerta, ClienteBase, Configuracao, Id } from "./tipos";

const EPS = 0.5;

export interface Pagamento {
  id: Id;
  clienteId: Id;
  /** mês de referência, "AAAA-MM" */
  competencia: string;
  valorCentavos: number;
  /** data em que caiu, "AAAA-MM-DD" */
  recebidoEm: string;
  observacao?: string | null;
  autor?: string | null;
  criadoEm?: string | null;
}

export interface Baldes {
  impostoCentavos: number;
  taxaCentavos: number;
  /** custos do projeto + parte do custo fixo (inclui imposto fixo) */
  custosCentavos: number;
  reinvestimentoCentavos: number;
  socios: Record<Id, number>;
}

export interface PartePagamento extends Baldes {
  pagamentoId: Id;
  valorCentavos: number;
  recebidoEm: string;
  /** caiu depois do fim do mês de referência */
  atrasado: boolean;
}

export type SituacaoPagamento = "sem_contrato" | "a_receber" | "parcial" | "pago" | "atrasado";

export interface DistribuicaoCliente {
  clienteId: Id;
  nome: string;
  competencia: string;
  bloqueio: Alerta | null;
  contratoCentavos: number | null;
  /** o mês inteiro pago, como planejado */
  planejado: (Baldes & { receitaCentavos: number }) | null;
  partes: PartePagamento[];
  recebidoCentavos: number;
  totais: Baldes;
  faltaReceberCentavos: number | null;
  situacao: SituacaoPagamento;
}

function zerado(): Baldes {
  return { impostoCentavos: 0, taxaCentavos: 0, custosCentavos: 0, reinvestimentoCentavos: 0, socios: {} };
}

function somar(a: Baldes, b: Baldes) {
  a.impostoCentavos += b.impostoCentavos;
  a.taxaCentavos += b.taxaCentavos;
  a.custosCentavos += b.custosCentavos;
  a.reinvestimentoCentavos += b.reinvestimentoCentavos;
  for (const [id, v] of Object.entries(b.socios)) a.socios[id] = (a.socios[id] ?? 0) + v;
}

/** Último dia do mês "AAAA-MM", como "AAAA-MM-DD". */
function fimDoMes(competencia: string): string {
  const [a, m] = competencia.split("-").map(Number);
  const d = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return `${competencia}-${String(d).padStart(2, "0")}`;
}

/** O mês de referência já terminou em relação a `hoje` ("AAAA-MM-DD")? */
export function mesTerminou(competencia: string, hoje: string): boolean {
  return hoje > fimDoMes(competencia);
}

export function distribuirPagamentos(
  config: Configuracao,
  cliente: ClienteBase,
  competencia: string,
  pagamentos: Pagamento[],
  hoje: string,
): DistribuicaoCliente {
  const doMes = pagamentos
    .filter((p) => p.clienteId === cliente.id && p.competencia === competencia)
    .sort((a, b) => (a.recebidoEm + (a.criadoEm ?? "")).localeCompare(b.recebidoEm + (b.criadoEm ?? "")));
  const recebido = doMes.reduce((a, p) => a + p.valorCentavos, 0);
  const contrato = cliente.valorMensalCentavos;
  const terminou = mesTerminou(competencia, hoje);
  const situacao: SituacaoPagamento =
    contrato == null
      ? "sem_contrato"
      : recebido >= contrato - EPS
        ? "pago"
        : terminou
          ? "atrasado"
          : recebido > 0
            ? "parcial"
            : "a_receber";

  const base = {
    clienteId: cliente.id,
    nome: cliente.nome,
    competencia,
    contratoCentavos: contrato,
    recebidoCentavos: recebido,
    faltaReceberCentavos: contrato == null ? null : Math.max(0, contrato - recebido),
    situacao,
  };
  const bloqueado = (b: Alerta): DistribuicaoCliente => ({ ...base, bloqueio: b, planejado: null, partes: [], totais: zerado() });

  const ordem = config.empresa.ordemDistribuicao ?? null;
  if (ordem == null)
    return bloqueado({
      nivel: "erro",
      texto: "A ordem de distribuição dos pagamentos ainda não foi escolhida pelos sócios. Enquanto estiver vazia, o sistema não diz para onde vai cada real.",
      acao: { rotulo: "Escolher a ordem", destino: { tipo: "config", secao: "regras", campo: "ordemDistribuicao" } },
    });
  if (contrato == null)
    return bloqueado({
      nivel: "erro",
      texto: `${cliente.nome} não tem valor mensal de contrato: sem ele não dá para saber quanto de cada pagamento é custo.`,
      acao: { rotulo: "Preencher o valor", destino: { tipo: "config", secao: "clientes" } },
    });

  const cenario = cliente.escopo ? escopoDoCliente(cliente) : { ...novoCenario(cliente.nome), clienteId: cliente.id };
  const prep = prepararMes(config, cenario);
  if (prep.bloqueio) return bloqueado(prep.bloqueio);
  if (!prep.percentuaisValidos)
    return bloqueado({
      nivel: "erro",
      texto: "Os percentuais dos sócios não somam 100%: não dá para dividir os pagamentos.",
      acao: { rotulo: "Corrigir os percentuais", destino: { tipo: "config", secao: "socios", campo: "percentualPadrao" } },
    });

  const plano = calcularComReceita(prep, contrato);
  const custosPlano = plano.custosProjetoCentavos + plano.rateio.quotaCentavos;
  const sobraPlano = plano.sobraCentavos;
  const pctSocios = new Map(prep.socios.map((s) => [s.pessoa.id, s.pct ?? 0]));
  const planejado = {
    receitaCentavos: plano.receitaBrutaCentavos,
    impostoCentavos: plano.impostosCentavos,
    taxaCentavos: plano.taxasCentavos,
    custosCentavos: custosPlano,
    reinvestimentoCentavos: plano.reinvestimentoCentavos,
    socios: Object.fromEntries(plano.pessoas.filter((p) => p.valorCentavos != null).map((p) => [p.id, p.valorCentavos!])),
  };

  // parte do líquido que é custo, no modo proporcional
  const fracaoCusto = custosPlano + Math.max(0, sobraPlano) > 0 ? custosPlano / (custosPlano + Math.max(0, sobraPlano)) : 1;

  const totais = zerado();
  let custosPagos = 0;
  const partes: PartePagamento[] = doMes.map((p) => {
    const v = p.valorCentavos;
    const imposto = (v * prep.impostoPct) / 100;
    const taxa = v > 0 ? (v * prep.taxaPct) / 100 + prep.taxaFixa : 0;
    const liquido = v - imposto - taxa;
    const faltaCusto = Math.max(0, custosPlano - custosPagos);
    const custo = liquido <= 0 ? 0 : Math.min(faltaCusto, ordem === "custo_primeiro" ? liquido : liquido * fracaoCusto);
    custosPagos += custo;
    const sobra = liquido - custo;
    const reinv = sobra > 0 ? (sobra * prep.reinvPct) / 100 : 0;
    const dividir = sobra - reinv;
    const socios = Object.fromEntries([...pctSocios].map(([id, pct]) => [id, (dividir * pct) / 100]));
    const parte: PartePagamento = {
      pagamentoId: p.id,
      valorCentavos: v,
      recebidoEm: p.recebidoEm,
      atrasado: p.recebidoEm > fimDoMes(competencia),
      impostoCentavos: imposto,
      taxaCentavos: taxa,
      custosCentavos: custo,
      reinvestimentoCentavos: reinv,
      socios,
    };
    somar(totais, parte);
    return parte;
  });

  return { ...base, bloqueio: null, planejado, partes, totais };
}

export interface RepasseSocio {
  pessoaId: Id;
  nome: string;
  /** o que viria no mês com todos os contratos pagos */
  planejadoCentavos: number;
  recebidoCentavos: number;
  faltaCentavos: number;
  porCliente: { clienteId: Id; nome: string; planejadoCentavos: number; recebidoCentavos: number; situacao: SituacaoPagamento }[];
}

/** Por sócio: quanto já recebeu no mês e quanto falta, somando todos os clientes. */
export function repasseDosSocios(config: Configuracao, distribuicoes: DistribuicaoCliente[]): RepasseSocio[] {
  return config.pessoas
    .filter((p) => p.ativo && p.socio)
    .map((p) => {
      const porCliente = distribuicoes
        .filter((d) => !d.bloqueio)
        .map((d) => ({
          clienteId: d.clienteId,
          nome: d.nome,
          planejadoCentavos: d.planejado?.socios[p.id] ?? 0,
          recebidoCentavos: d.totais.socios[p.id] ?? 0,
          situacao: d.situacao,
        }));
      const planejado = porCliente.reduce((a, c) => a + c.planejadoCentavos, 0);
      const recebido = porCliente.reduce((a, c) => a + c.recebidoCentavos, 0);
      return { pessoaId: p.id, nome: p.nome, planejadoCentavos: planejado, recebidoCentavos: recebido, faltaCentavos: Math.max(0, planejado - recebido), porCliente };
    });
}

/** Soma dos pagamentos de um cliente para um mês de referência (null = nenhum). */
export function somaPagamentos(pagamentos: Pagamento[], clienteId: Id, competencia: string): number | null {
  const doMes = pagamentos.filter((p) => p.clienteId === clienteId && p.competencia === competencia);
  return doMes.length ? doMes.reduce((a, p) => a + p.valorCentavos, 0) : null;
}
