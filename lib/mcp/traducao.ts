// Tradução entre o formato "de conversa" usado pelo conector MCP e o formato
// interno do sistema.
//
// No conector: dinheiro em REAIS e referências por NOME ou id (o que for mais
// natural numa conversa). Internamente: centavos e ids.
// Funções puras — sem banco, sem rede.

import { z } from "zod";
import { novaLinhaCusto, novaLinhaEntrega, novoCenario, novoId, novoPontual } from "../calculo/novo";
import type {
  Cenario,
  Configuracao,
  LinhaCusto,
  LinhaEntrega,
  ResultadoCenario,
  ResultadoMes,
} from "../calculo/tipos";

// ─── Conversões básicas ─────────────────────────────────────────────────────

export const paraCentavos = (reais: number | null | undefined): number | null =>
  reais == null ? null : Math.round(reais * 100);
export const paraReais = (centavos: number | null | undefined): number | null =>
  centavos == null || !Number.isFinite(centavos) ? null : Math.round(centavos) / 100;

const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();

/** Acha um item por id ou nome (sem diferenciar maiúsculas e acentos). Erro claro se não achar. */
export function resolver<T extends { id: string; nome: string }>(lista: T[], ref: string, oque: string): T {
  const achado = lista.find((x) => x.id === ref) ?? lista.find((x) => normalizar(x.nome) === normalizar(ref));
  if (!achado) {
    const opcoes = lista.map((x) => x.nome).join(", ") || "nenhum cadastrado";
    throw new Error(`${oque} "${ref}" não encontrado. Opções: ${opcoes}.`);
  }
  return achado;
}

// ─── Schemas do cenário "de conversa" ───────────────────────────────────────

const zEntrega = z.object({
  tipo: z.string().describe("Tipo de entrega (nome ou id, ver ver_configuracao)"),
  quantidade: z.number().nullable().optional().describe("Quantidade (por mês na rotina; total na entrada/pontual)"),
  horasPorUnidade: z
    .number()
    .nullable()
    .optional()
    .describe("Só se for DIFERENTE do padrão configurado no tipo. Vazio = usa o padrão. Prefira minutosPorUnidade."),
  minutosPorUnidade: z.number().nullable().optional().describe("Tempo por entrega em minutos, só se for DIFERENTE do padrão"),
});

const zCusto = z.object({
  categoria: z.enum(["ferramenta", "audiovisual", "terceiro", "outro"]).describe("outro = diária, deslocamento (Uber) e custos avulsos do caso"),
  descricao: z.string().optional(),
  forma: z.enum(["fixo", "por_entrega"]).optional().describe("Ferramenta é sempre fixo. Padrão: fixo."),
  valorReais: z.number().nullable().optional().describe("Fixo: valor do mês (ou do projeto). Por entrega: valor unitário."),
  tipoEntrega: z.string().optional().describe("Por entrega: qual tipo de entrega multiplica o valor"),
});

export const zCenarioConversa = z.object({
  nome: z.string(),
  modo: z.enum(["escopo", "valor"]).describe("escopo = calcula o valor mínimo; valor = mostra o que cabe na mensalidade informada"),
  cliente: z.string().nullable().optional().describe("Cliente ativo (nome ou id) que este cenário substitui no rateio. Vazio = cliente novo."),
  mensalidadeReais: z.number().nullable().optional().describe("Modo valor: mensalidade que o cliente vai pagar"),
  entregas: z.array(zEntrega).optional().describe("Rotina mensal"),
  custos: z.array(zCusto).optional().describe("Custos da rotina mensal"),
  trafego: z
    .object({
      modelo: z.enum(["fixo", "por_campanha", "percentual_verba", "incluido", "sem_trafego"]).nullable().optional(),
      valorFixoReais: z.number().nullable().optional(),
      valorPorCampanhaReais: z.number().nullable().optional(),
      campanhas: z.number().nullable().optional(),
      percentualVerba: z.number().nullable().optional(),
      verbaMensalReais: z
        .number()
        .nullable()
        .optional()
        .describe("Verba de mídia do cliente: NUNCA é faturamento da Aden. Informativa; só é base no modelo percentual_verba."),
    })
    .optional(),
  entrada: z
    .object({
      entregas: z.array(zEntrega).optional(),
      custos: z.array(zCusto).optional(),
      valorCobradoReais: z.number().nullable().optional(),
      mesesParaPagar: z.number().nullable().optional(),
    })
    .optional()
    .describe("Entrada do cliente novo: acontece uma vez só (onboarding, enxoval, primeiras peças)"),
  pontuais: z
    .array(
      z.object({
        nome: z.string(),
        forma: z.enum(["diluido", "fora"]).nullable().optional(),
        meses: z.number().nullable().optional(),
        entregas: z.array(zEntrega).optional(),
        custos: z.array(zCusto).optional(),
        valorCobradoReais: z.number().nullable().optional(),
      }),
    )
    .optional(),
  mesesSemCobranca: z.number().nullable().optional(),
  horizonteMeses: z.number().nullable().optional(),
  suspensaoSemCobranca: z.enum(["tudo", "mensalidade"]).nullable().optional(),
  percentuais: z
    .object({
      reinvestimentoPct: z.number().nullable().optional(),
      impostoPct: z.number().nullable().optional(),
      taxaRecebimentoPct: z.number().nullable().optional(),
      socios: z.record(z.string(), z.number()).optional().describe("sócio (nome ou id) → % só neste cenário"),
      divisaoServico: z
        .record(z.string(), z.record(z.string(), z.number()))
        .optional()
        .describe("serviço (nome ou id) → { sócio → % das horas } só neste cenário"),
    })
    .optional()
    .describe("Sobreposições deste cenário. Vazio = usa o padrão da empresa."),
});

export type CenarioConversa = z.infer<typeof zCenarioConversa>;

// ─── Conversa → interno ─────────────────────────────────────────────────────

function entregasParaInterno(lista: z.infer<typeof zEntrega>[] | undefined, config: Configuracao): LinhaEntrega[] {
  return (lista ?? []).map((e) => ({
    ...novaLinhaEntrega(resolver(config.tiposEntrega, e.tipo, "Tipo de entrega").id),
    quantidade: e.quantidade ?? null,
    horasPorUnidade: e.minutosPorUnidade != null ? e.minutosPorUnidade / 60 : (e.horasPorUnidade ?? null),
  }));
}

function custosParaInterno(lista: z.infer<typeof zCusto>[] | undefined, config: Configuracao): LinhaCusto[] {
  return (lista ?? []).map((c) => ({
    ...novaLinhaCusto(c.categoria),
    descricao: c.descricao ?? "",
    forma: c.categoria === "ferramenta" ? "fixo" : (c.forma ?? "fixo"),
    valorCentavos: paraCentavos(c.valorReais),
    tipoEntregaId: c.tipoEntrega ? resolver(config.tiposEntrega, c.tipoEntrega, "Tipo de entrega").id : null,
  }));
}

export function cenarioParaInterno(c: CenarioConversa, config: Configuracao, id?: string): Cenario {
  const base = novoCenario(c.nome);
  const socios = config.pessoas.filter((p) => p.socio);
  const t = c.trafego ?? {};
  const pct = c.percentuais ?? {};
  return {
    ...base,
    id: id ?? base.id,
    modo: c.modo,
    clienteId: c.cliente ? resolver(config.clientes, c.cliente, "Cliente").id : null,
    mensalidadeCentavos: paraCentavos(c.mensalidadeReais),
    entregas: entregasParaInterno(c.entregas, config),
    custos: custosParaInterno(c.custos, config),
    trafego: {
      modelo: t.modelo ?? null,
      valorFixoCentavos: paraCentavos(t.valorFixoReais),
      valorPorCampanhaCentavos: paraCentavos(t.valorPorCampanhaReais),
      campanhas: t.campanhas ?? null,
      percentualVerba: t.percentualVerba ?? null,
      verbaMensalCentavos: paraCentavos(t.verbaMensalReais),
    },
    entrada: {
      entregas: entregasParaInterno(c.entrada?.entregas, config),
      custos: custosParaInterno(c.entrada?.custos, config),
      valorCobradoCentavos: paraCentavos(c.entrada?.valorCobradoReais),
      mesesParaPagar: c.entrada?.mesesParaPagar ?? null,
    },
    pontuais: (c.pontuais ?? []).map((p) => ({
      ...novoPontual(),
      nome: p.nome,
      forma: p.forma ?? null,
      meses: p.meses ?? null,
      entregas: entregasParaInterno(p.entregas, config),
      custos: custosParaInterno(p.custos, config),
      valorCobradoCentavos: paraCentavos(p.valorCobradoReais),
    })),
    mesesSemCobranca: c.mesesSemCobranca ?? null,
    horizonteMeses: c.horizonteMeses ?? null,
    suspensaoSemCobranca: c.suspensaoSemCobranca ?? null,
    sobreposicoes: {
      reinvestimentoPct: pct.reinvestimentoPct ?? null,
      impostoPct: pct.impostoPct ?? null,
      taxaRecebimentoPct: pct.taxaRecebimentoPct ?? null,
      percentualPessoa: Object.fromEntries(
        Object.entries(pct.socios ?? {}).map(([ref, v]) => [resolver(socios, ref, "Sócio").id, v]),
      ),
      divisaoServico: Object.fromEntries(
        Object.entries(pct.divisaoServico ?? {}).map(([sRef, div]) => [
          resolver(config.servicos, sRef, "Serviço").id,
          Object.fromEntries(Object.entries(div).map(([pRef, v]) => [resolver(socios, pRef, "Sócio").id, v])),
        ]),
      ),
    },
  };
}

// ─── Interno → conversa ─────────────────────────────────────────────────────

const nomeDe = (lista: { id: string; nome: string }[], id: string | null) =>
  id == null ? null : (lista.find((x) => x.id === id)?.nome ?? id);

function entregasParaConversa(l: LinhaEntrega[], config: Configuracao) {
  return l
    .filter((e) => e.tipoEntregaId)
    .map((e) => ({
      tipo: nomeDe(config.tiposEntrega, e.tipoEntregaId)!,
      quantidade: e.quantidade,
      ...(e.horasPorUnidade != null ? { minutosPorUnidade: Math.round(e.horasPorUnidade * 60 * 100) / 100 } : {}),
    }));
}

function custosParaConversa(l: LinhaCusto[], config: Configuracao) {
  return l.map((c) => ({
    categoria: c.categoria,
    ...(c.descricao ? { descricao: c.descricao } : {}),
    forma: c.forma,
    valorReais: paraReais(c.valorCentavos),
    ...(c.tipoEntregaId ? { tipoEntrega: nomeDe(config.tiposEntrega, c.tipoEntregaId)! } : {}),
  }));
}

export function cenarioParaConversa(c: Cenario, config: Configuracao): CenarioConversa & { id: string } {
  const s = c.sobreposicoes;
  const e = c.entrada;
  return {
    id: c.id,
    nome: c.nome,
    modo: c.modo,
    cliente: nomeDe(config.clientes, c.clienteId),
    mensalidadeReais: paraReais(c.mensalidadeCentavos),
    entregas: entregasParaConversa(c.entregas, config),
    custos: custosParaConversa(c.custos, config),
    trafego: {
      modelo: c.trafego.modelo,
      valorFixoReais: paraReais(c.trafego.valorFixoCentavos),
      valorPorCampanhaReais: paraReais(c.trafego.valorPorCampanhaCentavos),
      campanhas: c.trafego.campanhas,
      percentualVerba: c.trafego.percentualVerba,
      verbaMensalReais: paraReais(c.trafego.verbaMensalCentavos),
    },
    entrada: e
      ? {
          entregas: entregasParaConversa(e.entregas, config),
          custos: custosParaConversa(e.custos, config),
          valorCobradoReais: paraReais(e.valorCobradoCentavos),
          mesesParaPagar: e.mesesParaPagar,
        }
      : undefined,
    pontuais: c.pontuais.map((p) => ({
      nome: p.nome,
      forma: p.forma,
      meses: p.meses,
      entregas: entregasParaConversa(p.entregas, config),
      custos: custosParaConversa(p.custos, config),
      valorCobradoReais: paraReais(p.valorCobradoCentavos),
    })),
    mesesSemCobranca: c.mesesSemCobranca,
    horizonteMeses: c.horizonteMeses,
    suspensaoSemCobranca: c.suspensaoSemCobranca ?? null,
    percentuais: {
      reinvestimentoPct: s.reinvestimentoPct,
      impostoPct: s.impostoPct,
      taxaRecebimentoPct: s.taxaRecebimentoPct,
      socios: Object.fromEntries(
        Object.entries(s.percentualPessoa)
          .filter(([, v]) => v != null)
          .map(([id, v]) => [nomeDe(config.pessoas, id)!, v as number]),
      ),
      divisaoServico: Object.fromEntries(
        Object.entries(s.divisaoServico).map(([sid, div]) => [
          nomeDe(config.servicos, sid)!,
          Object.fromEntries(
            Object.entries(div)
              .filter(([, v]) => v != null)
              .map(([pid, v]) => [nomeDe(config.pessoas, pid)!, v as number]),
          ),
        ]),
      ),
    },
  };
}

// ─── Configuração legível ───────────────────────────────────────────────────

export function configParaConversa(c: Configuracao) {
  const e = c.empresa;
  return {
    empresa: {
      regime: e.regime ?? null,
      ordemDistribuicao: e.ordemDistribuicao ?? null,
      medicoesCalibragem: e.medicoesCalibragem ?? null,
      diferencaSugerirPct: e.diferencaSugerirPct ?? null,
      reinvestimentoPct: e.reinvestimentoPct,
      impostoPct: e.impostoPct,
      taxaRecebimentoPct: e.taxaRecebimentoPct,
      regraRateio: e.regraRateio,
      impostoFixoMensalReais: paraReais(e.impostoFixoMensalCentavos),
      taxaRecebimentoFixaReais: paraReais(e.taxaRecebimentoFixaCentavos),
      tetoFaturamentoAnualReais: paraReais(e.tetoFaturamentoAnualCentavos),
      avisoTetoPct: e.avisoTetoPct ?? null,
      ociosidadePct: e.ociosidadePct ?? null,
      arredondamentoPropostaReais: paraReais(e.arredondamentoPropostaCentavos),
    },
    socios: c.pessoas
      .filter((p) => p.socio)
      .map((p) => ({
        id: p.id,
        nome: p.nome,
        percentualPadrao: p.percentualPadrao,
        pisoHoraReais: paraReais(p.pisoHoraCentavos),
        capacidadeHorasMes: p.capacidadeHorasMes,
        ativo: p.ativo,
        temLoginLigado: !!p.membroId,
      })),
    servicos: c.servicos.map((s) => ({
      id: s.id,
      nome: s.nome,
      ativo: s.ativo,
      divisaoPadrao: Object.fromEntries(
        Object.entries(s.divisaoPadrao)
          .filter(([, v]) => v != null)
          .map(([pid, v]) => [nomeDe(c.pessoas, pid)!, v]),
      ),
    })),
    tiposEntrega: c.tiposEntrega.map((t) => ({
      id: t.id,
      nome: t.nome,
      servico: nomeDe(c.servicos, t.servicoId),
      minutosPorUnidade: t.horasPorUnidade == null ? null : Math.round(t.horasPorUnidade * 60 * 100) / 100,
      audiovisual: !!t.audiovisual,
      ativo: t.ativo,
    })),
    custosFixos: c.custosFixos.map((f) => ({ id: f.id, nome: f.nome, valorMensalReais: paraReais(f.valorMensalCentavos), ativo: f.ativo })),
    clientes: c.clientes.map((k) => ({
      id: k.id,
      nome: k.nome,
      valorMensalReais: paraReais(k.valorMensalCentavos),
      interno: k.interno,
      participaRateio: k.participaRateio,
      ativo: k.ativo,
      temEscopoContratado: !!k.escopo,
    })),
  };
}

// ─── Resultado legível ──────────────────────────────────────────────────────

function mesParaConversa(m: ResultadoMes) {
  return {
    mensalidade: paraReais(m.receitaMensalidadeCentavos),
    cobrancaTrafego: paraReais(m.receitaTrafegoCentavos),
    receitaBruta: paraReais(m.receitaBrutaCentavos),
    verbaMidiaInformativa: paraReais(m.verbaMidiaCentavos),
    imposto: { pct: m.impostoPct, valor: paraReais(m.impostosCentavos), diferenteDoPadrao: m.impostoPctSobreposto },
    taxaRecebimento: { pct: m.taxaRecebimentoPct, valor: paraReais(m.taxasCentavos), diferenteDoPadrao: m.taxaRecebimentoPctSobreposta },
    custos: {
      ferramentas: paraReais(m.custosPorCategoria.ferramenta),
      audiovisual: paraReais(m.custosPorCategoria.audiovisual),
      terceiros: paraReais(m.custosPorCategoria.terceiro),
      outros: paraReais(m.custosPorCategoria.outro ?? 0),
      pontualDiluido: paraReais(m.custoPontualDiluidoCentavos),
      total: paraReais(m.custosProjetoCentavos),
    },
    rateioCustoFixo: {
      regra: m.rateio.regra,
      totalEmpresa: paraReais(m.rateio.totalFixoCentavos),
      clientesNaBase: m.rateio.clientesNaBase,
      outrosClientesAtivos: m.rateio.outrosClientes,
      parteDesteCliente: paraReais(m.rateio.quotaCentavos),
      comoFoiDividido: m.rateio.explicacao,
    },
    sobra: paraReais(m.sobraCentavos),
    reinvestimento: { pct: m.reinvestimentoPct, valor: paraReais(m.reinvestimentoCentavos), diferenteDoPadrao: m.reinvestimentoPctSobreposto },
    paraDividir: paraReais(m.distribuivelCentavos),
    horasNoMes: m.horasTotais,
    custoPorHora: paraReais(m.custoHoraCentavos),
    valorCobradoPorHora: paraReais(m.valorCobradoHoraCentavos),
    sobraPorHora: paraReais(m.sobraHoraCentavos),
    socios: m.pessoas.map((p) => ({
      nome: p.nome,
      percentual: p.percentual,
      percentualDiferenteDoPadrao: p.percentualSobreposto,
      horas: p.horas,
      recebeNoMes: paraReais(p.valorCentavos),
      porHora: paraReais(p.valorHoraCentavos),
      piso: paraReais(p.pisoHoraCentavos),
      abaixoDoPiso: p.abaixoPiso,
      consumoCapacidadePct: p.consumoCapacidadePct,
      recebeSemHorasNesteCliente: p.recebeSemHoras,
    })),
  };
}

export function resultadoParaConversa(r: ResultadoCenario) {
  return {
    modo: r.modo,
    bloqueado: r.bloqueio ? { motivo: r.bloqueio.texto, comoResolver: r.bloqueio.acao?.rotulo ?? null } : null,
    paraOCliente: r.proposta
      ? {
          investimentoMensal: paraReais(r.proposta.valorCentavos),
          arredondado: r.proposta.arredondado,
          observacao: "Valor único, com ferramentas e estrutura embutidas. Nunca apresentar ferramentas como cobrança à parte.",
        }
      : null,
    tetoDoRegime: r.teto
      ? { projecaoAnual: paraReais(r.teto.anualCentavos), teto: paraReais(r.teto.tetoCentavos), pct: r.teto.pct, nivel: r.teto.nivel }
      : null,
    alertas: r.alertas.map((a) => `[${a.nivel}] ${a.texto}${a.acao ? ` (resolver: ${a.acao.rotulo})` : ""}`),
    valorMinimo: r.minimo.possivel
      ? {
          mensalidadeMinima: paraReais(r.minimo.mensalidadeMinimaCentavos),
          receitaMinima: paraReais(r.minimo.receitaMinimaCentavos),
          criterio: r.minimo.criterio === "piso" ? "piso de todos os sócios com horas" : "ponto de equilíbrio (sem piso)",
        }
      : { impossivel: r.minimo.motivo },
    mes: r.mes ? mesParaConversa(r.mes) : null,
    oQueCabe: r.encaixe
      ? {
          cabe: r.encaixe.cabe,
          travando: r.encaixe.limitantes.map((l) => `${l.tipo === "piso" ? "piso (preço)" : "capacidade (gente)"} de ${l.nome}`),
          motivoIndisponivel: r.encaixe.motivo,
          porTipo: r.encaixe.tipos.map((t) => ({
            tipo: t.nome,
            quantidade: t.quantidade,
            folga: t.folga,
            proximoLimite: t.limites.map((l) => `${l.tipo} de ${l.nome}`),
            zerarSozinhoNaoResolve: t.naoResolve,
          })),
        }
      : null,
    entrada: r.entrada
      ? {
          custoDaEntrada: paraReais(r.entrada.custoEntradaCentavos),
          custosEmDinheiro: paraReais(r.entrada.custosDinheiroCentavos),
          horasDosSociosNoPiso: paraReais(r.entrada.horasNoPisoCentavos),
          cobradoLiquido: paraReais(r.entrada.cobradoLiquidoCentavos),
          folgaMensalDaRotina: paraReais(r.entrada.folgaMensalRotinaCentavos),
          sePagaEmMeses: r.entrada.mesesParaSePagar,
          mensalidadeParaPagarNoPrazo: paraReais(r.entrada.mensalidadeParaPagarCentavos),
          primeiroMes: r.entrada.pessoas.map((p) => ({
            nome: p.nome,
            horasDaEntrada: p.horas,
            horasNoPrimeiroMes: p.horasPrimeiroMes,
            consumoCapacidadePct: p.consumoPrimeiroMesPct,
          })),
        }
      : null,
    horizonte: r.horizonte
      ? {
          meses: r.horizonte.meses,
          semCobranca: r.horizonte.semCobranca,
          opcaoQueVale: r.horizonte.escolhida,
          opcoesIguais: r.horizonte.opcoesIguais,
          opcoes: Object.fromEntries(
            (["tudo", "mensalidade"] as const).map((k) => {
              const v = r.horizonte!.opcoes[k];
              return [
                k === "tudo" ? "A_naoPagaNada" : "B_pagaSoGestaoTrafego",
                {
                  mensalidadeNecessaria: paraReais(v.mensalidadeNecessariaCentavos),
                  receitaNoPeriodo: paraReais(v.receitaTotalCentavos),
                  sobraNoPeriodo: paraReais(v.sobraTotalCentavos),
                  socios: v.pessoas.map((p) => ({
                    nome: p.nome,
                    noPeriodo: paraReais(p.valorTotalCentavos),
                    mediaPorHora: paraReais(p.valorHoraMedioCentavos),
                    abaixoDoPiso: p.abaixoPiso,
                  })),
                },
              ];
            }),
          ),
        }
      : null,
    pontuaisForaDaMensalidade: r.pontuaisFora.map((p) => ({
      nome: p.nome,
      horas: p.horasTotais,
      custos: paraReais(p.custosCentavos),
      valorMinimo: p.minimo.possivel ? paraReais(p.minimo.mensalidadeMinimaCentavos) : null,
      resultado: p.resultado ? mesParaConversa(p.resultado) : null,
    })),
  };
}

export { novoId };
