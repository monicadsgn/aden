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

import { calcularComReceita, calcularTeto, prepararMes, type PreparadoMes } from "./motor";
import { novoCenario } from "./novo";
import type { Cenario, ClienteBase, Configuracao, Id, ProjecaoTeto, ResultadoMes } from "./tipos";

const EPS = 0.005;
const v0 = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? 0 : v);

/** Escopo do cliente preso a ele (para o rateio contar o cliente certo). */
function escopoDoCliente(c: ClienteBase): Cenario {
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
  /** quanto entrou de fato no mês; null = considera o valor do contrato */
  valorRecebidoCentavos: number | null;
  /** horas reais por sócio; ausente = não lançado */
  horas: Record<Id, number | null>;
}

export interface SaudeSocio {
  id: Id;
  nome: string;
  piso: number | null;
  horasPrevistas: number;
  horasReais: number | null;
  valorHoraPrevisto: number | null;
  valorHoraReal: number | null;
  abaixoPisoReal: boolean;
  /** o próprio escopo contratado já paga menos que o piso */
  abaixoPisoPrevisto: boolean;
}

export interface SaudeCliente {
  id: Id;
  nome: string;
  temEscopo: boolean;
  valorContratoCentavos: number | null;
  valorRecebidoCentavos: number | null;
  horasLancadas: boolean;
  horasPrevistas: number;
  horasReais: number | null;
  /** o que ele paga ÷ as horas que ele deu */
  valorCobradoHoraPrevisto: number | null;
  valorCobradoHoraReal: number | null;
  socios: SaudeSocio[];
  /** algum sócio com horas reais abaixo do próprio piso */
  prejuizoSilencioso: boolean;
  /** o contrato já nasceu abaixo do piso de algum sócio */
  contratadoAbaixoDoPiso: boolean;
  previsto: ResultadoMes | null;
  realizado: ResultadoMes | null;
}

/** Mesmo preparo do mês, mas com as horas reais no lugar das horas previstas. */
function comHorasReais(prep: PreparadoMes, horas: Record<Id, number | null>): PreparadoMes {
  const mapa = new Map(prep.horasPorPessoa);
  let total = 0;
  for (const [id] of mapa) {
    const h = v0(horas[id]);
    mapa.set(id, h);
    total += h;
  }
  return { ...prep, horasPorPessoa: mapa, horasTotais: total };
}

export function calcularSaudeCliente(config: Configuracao, cliente: ClienteBase, registro: RegistroMesCliente | null): SaudeCliente {
  const prep = prepararMes(config, escopoDoCliente(cliente));
  const contrato = cliente.valorMensalCentavos;
  const recebido = registro?.valorRecebidoCentavos ?? null;
  const horasLancadas = !!registro && Object.values(registro.horas).some((h) => h != null);

  const previsto = contrato != null && cliente.escopo ? calcularComReceita(prep, contrato) : null;
  const receitaReal = recebido ?? contrato;
  const realizado = horasLancadas && receitaReal != null ? calcularComReceita(comHorasReais(prep, registro!.horas), receitaReal) : null;

  const socios: SaudeSocio[] = config.pessoas
    .filter((p) => p.ativo && p.socio)
    .map((p) => {
      const pv = previsto?.pessoas.find((x) => x.id === p.id);
      const rl = realizado?.pessoas.find((x) => x.id === p.id);
      const horasReais = registro?.horas[p.id] ?? null;
      return {
        id: p.id,
        nome: p.nome,
        piso: p.pisoHoraCentavos != null && p.pisoHoraCentavos > 0 ? p.pisoHoraCentavos : null,
        horasPrevistas: prep.horasPorPessoa.get(p.id) ?? 0,
        horasReais,
        valorHoraPrevisto: pv?.valorHoraCentavos ?? null,
        valorHoraReal: horasReais != null && horasReais > 0 ? (rl?.valorHoraCentavos ?? null) : null,
        abaixoPisoReal: horasReais != null && horasReais > 0 ? !!rl?.abaixoPiso : false,
        abaixoPisoPrevisto: !!pv?.abaixoPiso,
      };
    });

  const horasReais = horasLancadas ? Object.values(registro!.horas).reduce<number>((a, h) => a + v0(h), 0) : null;
  return {
    id: cliente.id,
    nome: cliente.nome,
    temEscopo: !!cliente.escopo,
    valorContratoCentavos: contrato,
    valorRecebidoCentavos: recebido,
    horasLancadas,
    horasPrevistas: prep.horasTotais,
    horasReais,
    valorCobradoHoraPrevisto: previsto?.valorCobradoHoraCentavos ?? null,
    valorCobradoHoraReal: realizado && horasReais ? receitaReal! / horasReais : null,
    socios,
    prejuizoSilencioso: socios.some((s) => s.abaixoPisoReal),
    contratadoAbaixoDoPiso: socios.some((s) => s.abaixoPisoPrevisto),
    previsto,
    realizado,
  };
}
