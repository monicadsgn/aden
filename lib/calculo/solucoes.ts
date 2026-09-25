// Saúde dos clientes: além do diagnóstico, os caminhos para sair do prejuízo.
//
// Tudo sai do mesmo motor da calculadora, com os números reais do cliente:
//   a) subir o valor  → valor mínimo do escopo (com as horas reais)
//   b) cortar escopo  → "o que cabe" no valor atual (quantas unidades tirar de um tipo)
//   c) misto          → tira metade do corte e calcula o novo mínimo
//   d) exceção        → quanto cada sócio perde por mês se nada mudar
// Nenhum número é sugerido fora do cálculo. Se faltar dado, a lista diz qual.

import { escopoDoCliente, type SaudeCliente } from "./mes";
import { ajustarQuantidade, calcularComReceita, calcularEncaixe, calcularMinimo, prepararMes } from "./motor";
import { configComMediaMedida, type CalibragemTipo } from "./calibragem";
import { novoId } from "./novo";
import type { Cenario, ClienteBase, Configuracao, Id } from "./tipos";

const v0 = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? 0 : v);

export interface SolucaoSubir {
  mensalidadeCentavos: number;
  aMaisCentavos: number;
  cenario: Cenario;
}

export interface SolucaoCortar {
  tipoEntregaId: Id;
  nome: string;
  tirar: number;
  cenario: Cenario;
}

export interface SolucaoMista extends SolucaoCortar {
  mensalidadeCentavos: number;
  aMaisCentavos: number;
}

export interface PerdaSocio {
  pessoaId: Id;
  nome: string;
  /** quanto falta por mês para chegar no piso com as horas deste cliente */
  perdaMensalCentavos: number;
}

export interface SolucoesSaude {
  /** há problema a resolver (abaixo do piso no real ou no contratado) */
  temProblema: boolean;
  /** dado que falta para calcular; vazio = tudo certo */
  faltando: string[];
  /** as horas usadas: as reais do mês ou as previstas no escopo */
  base: "real" | "previsto";
  /** o escopo com as horas que de fato acontecem, no valor do contrato: é o que abre na calculadora */
  cenarioBase: Cenario | null;
  subir: SolucaoSubir | null;
  cortar: SolucaoCortar[];
  /** nenhum corte de um tipo só resolve */
  corteSozinhoNaoResolve: boolean;
  misto: SolucaoMista[];
  excecao: PerdaSocio[];
}

function vazio(temProblema: boolean, faltando: string[], base: "real" | "previsto"): SolucoesSaude {
  return { temProblema, faltando, base, cenarioBase: null, subir: null, cortar: [], corteSozinhoNaoResolve: false, misto: [], excecao: [] };
}

/**
 * Escopo do cliente em modo valor, no valor do contrato, com as horas por entrega
 * ajustadas para reproduzir as horas reais de cada sócio (fator do sócio, ponderado
 * pela divisão do serviço). Sem horas reais, usa a média medida onde houver.
 */
export function cenarioRealista(config: Configuracao, cliente: ClienteBase, saude: SaudeCliente, calibragem: CalibragemTipo[] = []): Cenario {
  const base = escopoDoCliente(cliente);
  const medido = configComMediaMedida(config, calibragem);
  const prepEst = prepararMes(medido, base);
  const fator = new Map<Id, number>();
  for (const s of saude.socios) {
    const est = prepEst.horasPorPessoa.get(s.id) ?? 0;
    fator.set(s.id, est > 0 ? s.horasReais / est : 1);
  }
  const entregas = base.entregas.map((l) => {
    const tipo = medido.tiposEntrega.find((t) => t.id === l.tipoEntregaId);
    const padrao = config.tiposEntrega.find((t) => t.id === l.tipoEntregaId)?.horasPorUnidade ?? null;
    if (!tipo || tipo.audiovisual) return { ...l };
    const hUn = l.horasPorUnidade ?? tipo.horasPorUnidade;
    if (hUn == null) return { ...l };
    const serv = config.servicos.find((s) => s.id === tipo.servicoId);
    const div = Object.entries(serv?.divisaoPadrao ?? {}).filter(([, v]) => v0(v) > 0);
    const soma = div.reduce((a, [, v]) => a + v0(v), 0);
    const f = soma > 0 ? div.reduce((a, [pid, v]) => a + (v0(v) / soma) * (fator.get(pid) ?? 1), 0) : 1;
    const h = hUn * f;
    return { ...l, horasPorUnidade: padrao != null && Math.abs(h - padrao) < 1e-9 ? null : h };
  });
  return {
    ...base,
    id: novoId(),
    nome: `${cliente.nome}: como está hoje`,
    modo: "valor",
    clienteId: cliente.id,
    mensalidadeCentavos: cliente.valorMensalCentavos,
    entregas,
  };
}

export function calcularSolucoes(config: Configuracao, cliente: ClienteBase, saude: SaudeCliente, calibragem: CalibragemTipo[] = []): SolucoesSaude {
  const temProblema = saude.prejuizoSilencioso || saude.contratadoAbaixoDoPiso;
  const base: "real" | "previsto" = saude.prejuizoSilencioso ? "real" : "previsto";
  const faltando: string[] = [];
  if (saude.bloqueio) faltando.push(saude.bloqueio.texto);
  if (!cliente.escopo) faltando.push("o escopo contratado do cliente (guarde pela calculadora)");
  if (cliente.valorMensalCentavos == null) faltando.push("o valor mensal do contrato");
  for (const s of saude.socios)
    if (s.piso == null && (s.horasReais > 0 || s.horasPrevistas > 0)) faltando.push(`o piso por hora de ${s.nome} (sem ele não dá para saber se ${s.nome} perde)`);
  if (!temProblema) return vazio(false, faltando, base);
  if (saude.bloqueio || !cliente.escopo || cliente.valorMensalCentavos == null) return vazio(true, faltando, base);

  const contrato = cliente.valorMensalCentavos;
  const cen =
    base === "real"
      ? cenarioRealista(config, cliente, saude, calibragem)
      : { ...escopoDoCliente(cliente), id: novoId(), nome: `${cliente.nome}: contrato atual`, modo: "valor" as const, mensalidadeCentavos: contrato };

  // a) subir o valor
  const prep = prepararMes(config, cen);
  const min = calcularMinimo(prep);
  const subir: SolucaoSubir | null =
    min.possivel && min.mensalidadeMinimaCentavos != null && min.mensalidadeMinimaCentavos > contrato
      ? {
          mensalidadeCentavos: min.mensalidadeMinimaCentavos,
          aMaisCentavos: min.mensalidadeMinimaCentavos - contrato,
          cenario: { ...cen, id: novoId(), nome: `${cliente.nome}: subir o valor`, modo: "escopo", mensalidadeCentavos: null },
        }
      : null;

  // b) cortar escopo, mantendo o valor
  const mes = calcularComReceita(prep, contrato);
  const encaixe = calcularEncaixe(config, cen, mes);
  const cortaveis = encaixe.tipos.filter((t) => t.folga != null && t.folga < 0 && !t.naoResolve);
  const cortar: SolucaoCortar[] = cortaveis.map((t) => ({
    tipoEntregaId: t.tipoEntregaId,
    nome: t.nome,
    tirar: -t.folga!,
    cenario: { ...ajustarQuantidade(cen, t.tipoEntregaId, t.folga!), id: novoId(), nome: `${cliente.nome}: tirar ${-t.folga!} ${t.nome}` },
  }));

  // c) misto: tira metade do corte e sobe o que faltar
  const misto: SolucaoMista[] = [];
  for (const c of cortar) {
    const k = Math.floor(c.tirar / 2);
    if (k < 1) continue;
    const reduzido = ajustarQuantidade(cen, c.tipoEntregaId, -k);
    const m = calcularMinimo(prepararMes(config, reduzido));
    if (!m.possivel || m.mensalidadeMinimaCentavos == null || m.mensalidadeMinimaCentavos <= contrato) continue;
    misto.push({
      tipoEntregaId: c.tipoEntregaId,
      nome: c.nome,
      tirar: k,
      mensalidadeCentavos: m.mensalidadeMinimaCentavos,
      aMaisCentavos: m.mensalidadeMinimaCentavos - contrato,
      cenario: { ...reduzido, id: novoId(), nome: `${cliente.nome}: tirar ${k} ${c.nome} e subir o valor`, modo: "escopo", mensalidadeCentavos: null },
    });
  }

  // d) aceitar a exceção: quanto cada sócio perde por mês
  const excecao: PerdaSocio[] = mes.pessoas
    .filter((p) => p.abaixoPiso && p.pisoHoraCentavos != null)
    .map((p) => ({ pessoaId: p.id, nome: p.nome, perdaMensalCentavos: Math.max(0, p.horas * p.pisoHoraCentavos! - v0(p.valorCentavos)) }));

  return {
    temProblema,
    faltando,
    base,
    cenarioBase: cen,
    subir,
    cortar,
    corteSozinhoNaoResolve: encaixe.disponivel && !encaixe.cabe && cortar.length === 0,
    misto,
    excecao,
  };
}
