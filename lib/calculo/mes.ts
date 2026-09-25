// Visão do mês inteiro e saúde dos clientes.
//
// Visão do mês: soma as horas de TODOS os clientes ativos (pelo escopo contratado
// de cada um) e bate com a capacidade de cada sócio. É o que diz se dá para pegar
// cliente novo.
//
// Saúde do cliente: compara o previsto (escopo contratado + valor do contrato) com o
// realizado (horas reais lançadas no mês + valor recebido) e mostra o valor por hora
// real de cada sócio contra o piso.
//
// Funções puras, reaproveitando o motor da calculadora.

import { configComMediaMedida, type CalibragemTipo } from "./calibragem";
import { calcularComReceita, calcularTeto, prepararMes, type PreparadoMes } from "./motor";
import { novoCenario } from "./novo";
import type { Alerta, Cenario, ClienteBase, Configuracao, Id, ProjecaoTeto, ResultadoMes } from "./tipos";

const EPS = 0.005;
const v0 = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? 0 : v);

/** Escopo do cliente preso a ele (para o rateio contar o cliente certo). */
export function escopoDoCliente(c: ClienteBase): Cenario {
  const base = c.escopo ?? novoCenario(c.nome);
  return { ...base, clienteId: c.id };
}

// ─── Visão do mês ───────────────────────────────────────────────────────────

export type SituacaoSocio = "afogado" | "folga_sobrando" | "ok" | "sem_capacidade";

export interface VisaoSocio {
  id: Id;
  nome: string;
  capacidadeHorasMes: number | null;
  horasUsadas: number;
  horasLivres: number | null;
  usoPct: number | null;
  situacao: SituacaoSocio;
}

export interface VisaoClienteMes {
  id: Id;
  nome: string;
  interno: boolean;
  temEscopo: boolean;
  valorMensalCentavos: number | null;
  horasPorSocio: Record<Id, number>;
  horasTotais: number;
}

export interface VisaoMes {
  socios: VisaoSocio[];
  clientes: VisaoClienteMes[];
  /** clientes ativos sem escopo contratado: as horas deles não entram na soma */
  semEscopo: string[];
  faturamentoMensalCentavos: number;
  teto: ProjecaoTeto | null;
}

export function calcularVisaoMes(config: Configuracao): VisaoMes {
  const ativos = config.clientes.filter((c) => c.ativo);
  const socios = config.pessoas.filter((p) => p.ativo && p.socio);
  const uso = new Map<Id, number>(socios.map((p) => [p.id, 0]));

  const clientes: VisaoClienteMes[] = ativos.map((c) => {
    const horasPorSocio: Record<Id, number> = {};
    let horasTotais = 0;
    if (c.escopo) {
      const prep = prepararMes(config, escopoDoCliente(c));
      for (const p of socios) {
        const h = prep.horasPorPessoa.get(p.id) ?? 0;
        horasPorSocio[p.id] = h;
        uso.set(p.id, (uso.get(p.id) ?? 0) + h);
      }
      horasTotais = prep.horasTotais;
    }
    return {
      id: c.id,
      nome: c.nome,
      interno: c.interno,
      temEscopo: !!c.escopo,
      valorMensalCentavos: c.valorMensalCentavos,
      horasPorSocio,
      horasTotais,
    };
  });

  const ociosidade = config.empresa.ociosidadePct;
  const visaoSocios: VisaoSocio[] = socios.map((p) => {
    const usadas = uso.get(p.id) ?? 0;
    const cap = p.capacidadeHorasMes != null && p.capacidadeHorasMes > 0 ? p.capacidadeHorasMes : null;
    const usoPct = cap != null ? (usadas / cap) * 100 : null;
    let situacao: SituacaoSocio = "ok";
    if (cap == null) situacao = "sem_capacidade";
    else if (usadas > cap + EPS) situacao = "afogado";
    else if (ociosidade != null && usoPct! < ociosidade) situacao = "folga_sobrando";
    return {
      id: p.id,
      nome: p.nome,
      capacidadeHorasMes: cap,
      horasUsadas: usadas,
      horasLivres: cap != null ? cap - usadas : null,
      usoPct,
      situacao,
    };
  });

  const faturamento = ativos.reduce((a, c) => a + v0(c.valorMensalCentavos), 0);
  return {
    socios: visaoSocios,
    clientes,
    semEscopo: ativos.filter((c) => !c.escopo).map((c) => c.nome),
    faturamentoMensalCentavos: faturamento,
    teto: calcularTeto(config, null, 0),
  };
}

// ─── Saúde do cliente (previsto × realizado) ────────────────────────────────

export interface RegistroMesCliente {
  /** quanto entrou de fato no mês (lançamento antigo, à mão); null = considera o valor do contrato */
  valorRecebidoCentavos: number | null;
  /** horas reais lançadas à mão por sócio; ausente = sem registro */
  horas: Record<Id, number | null>;
}

/**
 * De onde vem o número de horas:
 * - manual: lançado à mão no mês
 * - medida: escopo × média medida pelo cronômetro (N medições)
 * - previsto: escopo × padrão cadastrado
 */
export type OrigemHoras = { tipo: "manual" } | { tipo: "medida"; medicoes: number; parcial: boolean } | { tipo: "previsto" };

export function rotuloOrigemHoras(o: OrigemHoras): string {
  if (o.tipo === "manual") return "lançado manualmente";
  if (o.tipo === "medida") return `${o.parcial ? "parte " : ""}média medida (${o.medicoes} ${o.medicoes === 1 ? "medição" : "medições"})`;
  return "previsto no escopo";
}

/** De onde vem o valor do mês usado no realizado. */
export type OrigemValor = "pagamentos" | "manual" | "contrato";

export interface SaudeSocio {
  id: Id;
  nome: string;
  piso: number | null;
  horasPrevistas: number;
  /** horas usadas no realizado (manual, medida ou prevista, conforme a origem) */
  horasReais: number;
  origemHoras: OrigemHoras;
  /** true quando não há lançamento à mão: o número é previsão */
  semRegistro: boolean;
  valorPrevisto: number | null;
  valorReal: number | null;
  valorHoraPrevisto: number | null;
  valorHoraReal: number | null;
  /** horas reais (lançadas ou medidas) derrubaram o valor por hora abaixo do piso */
  abaixoPisoReal: boolean;
  /** o próprio escopo contratado já paga menos que o piso */
  abaixoPisoPrevisto: boolean;
  /** recebe parte da sobra sem ter horas neste cliente */
  recebeSemHoras: boolean;
}

export interface SaudeCliente {
  id: Id;
  nome: string;
  temEscopo: boolean;
  valorContratoCentavos: number | null;
  /** valor usado no realizado */
  valorRealCentavos: number | null;
  origemValor: OrigemValor;
  /** soma dos pagamentos registrados para o mês (null = nenhum) */
  pagamentosCentavos: number | null;
  horasLancadas: boolean;
  horasPrevistas: number;
  horasReais: number;
  /** o que ele paga ÷ as horas que ele deu */
  valorCobradoHoraPrevisto: number | null;
  valorCobradoHoraReal: number | null;
  socios: SaudeSocio[];
  /** algum sócio com horas reais (lançadas ou medidas) abaixo do próprio piso */
  prejuizoSilencioso: boolean;
  /** o contrato já nasceu abaixo do piso de algum sócio */
  contratadoAbaixoDoPiso: boolean;
  /** o cálculo não pode ser feito (ex.: regra de rateio vazia) */
  bloqueio: Alerta | null;
  previsto: ResultadoMes | null;
  realizado: ResultadoMes | null;
}

export interface OpcoesSaude {
  /** calibragem do cronômetro: tipos calibrados estimam as horas pela média medida */
  calibragem?: CalibragemTipo[];
  /** soma dos pagamentos registrados para o mês */
  pagamentosCentavos?: number | null;
  /** mês já terminou? Com o mês aberto, pagamento parcial não conta como valor do mês */
  mesFechado?: boolean;
}

/** Mesmo preparo do mês, mas com outras horas por pessoa. */
export function comHoras(prep: PreparadoMes, horas: Map<Id, number>): PreparadoMes {
  const mapa = new Map(prep.horasPorPessoa);
  let total = 0;
  for (const [id] of mapa) {
    const h = v0(horas.get(id));
    mapa.set(id, h);
    total += h;
  }
  return { ...prep, horasPorPessoa: mapa, horasTotais: total };
}

/** Horas estimadas por sócio (média medida onde calibrado) e a origem de cada uma. */
function horasEstimadas(config: Configuracao, cliente: ClienteBase, calibragem: CalibragemTipo[]) {
  const escopo = escopoDoCliente(cliente);
  const prepMedido = prepararMes(configComMediaMedida(config, calibragem), escopo);
  const calibrados = new Map(calibragem.filter((c) => c.situacao === "calibrado").map((c) => [c.tipoEntregaId, c.medicoes]));
  const origem = new Map<Id, OrigemHoras>();
  for (const p of config.pessoas.filter((x) => x.ativo && x.socio)) {
    // tipos do escopo que dão horas a este sócio
    const tipos = new Set<Id>();
    for (const l of escopo.entregas) {
      const t = config.tiposEntrega.find((x) => x.id === l.tipoEntregaId);
      const serv = config.servicos.find((x) => x.id === t?.servicoId);
      if (t && !t.audiovisual && v0(l.quantidade) > 0 && v0(serv?.divisaoPadrao[p.id]) > 0) tipos.add(t.id);
    }
    const medidos = [...tipos].filter((id) => calibrados.has(id));
    origem.set(
      p.id,
      medidos.length
        ? { tipo: "medida", medicoes: medidos.reduce((a, id) => a + calibrados.get(id)!, 0), parcial: medidos.length < tipos.size }
        : { tipo: "previsto" },
    );
  }
  return { horas: prepMedido.horasPorPessoa, origem };
}

export function calcularSaudeCliente(
  config: Configuracao,
  cliente: ClienteBase,
  registro: RegistroMesCliente | null,
  opcoes: OpcoesSaude = {},
): SaudeCliente {
  const prep = prepararMes(config, escopoDoCliente(cliente));
  const contrato = cliente.valorMensalCentavos;
  const pagos = opcoes.pagamentosCentavos ?? null;
  const manualValor = registro?.valorRecebidoCentavos ?? null;
  const horasLancadas = !!registro && Object.values(registro.horas).some((h) => h != null);

  // valor do realizado: pagamentos (mês fechado, ou já cobriu o contrato) > lançamento à mão > contrato
  let origemValor: OrigemValor = "contrato";
  let valorReal = contrato;
  if (pagos != null && (opcoes.mesFechado || contrato == null || pagos >= contrato)) {
    origemValor = "pagamentos";
    valorReal = pagos;
  } else if (manualValor != null) {
    origemValor = "manual";
    valorReal = manualValor;
  }

  const bloqueio = prep.bloqueio;
  const temEscopo = !!cliente.escopo;
  const est = horasEstimadas(config, cliente, opcoes.calibragem ?? []);
  const socios0 = config.pessoas.filter((p) => p.ativo && p.socio);
  const horasUsadas = new Map<Id, number>();
  const origens = new Map<Id, OrigemHoras>();
  for (const p of socios0) {
    const manual = registro?.horas[p.id];
    if (manual != null) {
      horasUsadas.set(p.id, manual);
      origens.set(p.id, { tipo: "manual" });
    } else {
      horasUsadas.set(p.id, est.horas.get(p.id) ?? 0);
      origens.set(p.id, est.origem.get(p.id) ?? { tipo: "previsto" });
    }
  }

  const previsto = !bloqueio && contrato != null && temEscopo ? calcularComReceita(prep, contrato) : null;
  const realizado = !bloqueio && valorReal != null && (temEscopo || horasLancadas) ? calcularComReceita(comHoras(prep, horasUsadas), valorReal) : null;

  const socios: SaudeSocio[] = socios0.map((p) => {
    const pv = previsto?.pessoas.find((x) => x.id === p.id);
    const rl = realizado?.pessoas.find((x) => x.id === p.id);
    const origem = origens.get(p.id)!;
    const horasReais = horasUsadas.get(p.id) ?? 0;
    const medidoDeVerdade = origem.tipo !== "previsto";
    return {
      id: p.id,
      nome: p.nome,
      piso: p.pisoHoraCentavos != null && p.pisoHoraCentavos > 0 ? p.pisoHoraCentavos : null,
      horasPrevistas: prep.horasPorPessoa.get(p.id) ?? 0,
      horasReais,
      origemHoras: origem,
      semRegistro: origem.tipo !== "manual",
      valorPrevisto: pv?.valorCentavos ?? null,
      valorReal: rl?.valorCentavos ?? null,
      valorHoraPrevisto: pv?.valorHoraCentavos ?? null,
      valorHoraReal: horasReais > 0 ? (rl?.valorHoraCentavos ?? null) : null,
      abaixoPisoReal: medidoDeVerdade && horasReais > 0 && !!rl?.abaixoPiso,
      abaixoPisoPrevisto: !!pv?.abaixoPiso,
      recebeSemHoras: !!(rl ?? pv)?.recebeSemHoras,
    };
  });

  const horasReais = [...horasUsadas.values()].reduce((a, h) => a + h, 0);
  return {
    id: cliente.id,
    nome: cliente.nome,
    temEscopo,
    valorContratoCentavos: contrato,
    valorRealCentavos: valorReal,
    origemValor,
    pagamentosCentavos: pagos,
    horasLancadas,
    horasPrevistas: prep.horasTotais,
    horasReais,
    valorCobradoHoraPrevisto: previsto?.valorCobradoHoraCentavos ?? null,
    valorCobradoHoraReal: realizado && horasReais > 0 ? valorReal! / horasReais : null,
    socios,
    prejuizoSilencioso: socios.some((s) => s.abaixoPisoReal),
    contratadoAbaixoDoPiso: socios.some((s) => s.abaixoPisoPrevisto),
    bloqueio,
    previsto,
    realizado,
  };
}
