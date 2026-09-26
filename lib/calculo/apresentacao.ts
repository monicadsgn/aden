// Modo apresentação: negociar ao vivo com o cliente.
//
// O cliente vê entregas, quantidades e o valor. Nada interno: horas, piso, valor por
// hora, divisão entre sócios, custo fixo, reinvestimento. Para o operador, só um sinal
// discreto (ok / atenção) quando algum sócio fica abaixo do piso — sem nenhuma palavra.

import { ajustarQuantidade, calcularCenario } from "./motor";
import { diferencaDoPacote, frasesParaCliente, precoDoCenario, precoDoPacote } from "./pacotes";
import type { Cenario, Configuracao, Id, Pacote } from "./tipos";

const v0 = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? 0 : v);

export type Sinal = "ok" | "atencao" | "indefinido";

export interface ItemVista {
  tipoEntregaId: Id;
  nome: string;
  quantidade: number;
}

export interface ServicoVista {
  servicoId: Id | null;
  nome: string;
  ligado: boolean;
  itens: ItemVista[];
}

/** Tudo o que a tela de apresentação pode mostrar. Só isso: nada interno entra aqui. */
export interface VistaApresentacao {
  servicos: ServicoVista[];
  /** investimento mensal (um valor só, com tudo embutido); null = ainda não dá para calcular */
  valorCentavos: number | null;
  incluiTrafego: boolean;
  verbaMidiaCentavos: number | null;
  sinal: Sinal;
}

/** Sinal para o operador: atenção quando algum sócio fica abaixo do piso, passa das horas do mês ou a sobra fica negativa. */
export function sinalDoCenario(config: Configuracao, cenario: Cenario): Sinal {
  const r = calcularCenario(config, cenario);
  if (!r.mes) return "indefinido";
  const socios = new Set(config.pessoas.filter((p) => p.socio).map((p) => p.id));
  const abaixo = r.mes.pessoas.some((p) => socios.has(p.id) && p.abaixoPiso);
  const semHoras = r.mes.pessoas.some((p) => p.consumoCapacidadePct != null && p.consumoCapacidadePct > 100);
  return abaixo || semHoras || r.mes.sobraCentavos < 0 ? "atencao" : "ok";
}

/** Estado da negociação: o cenário e os serviços desligados (com as quantidades de antes). */
export interface EstadoApresentacao {
  cenario: Cenario;
  /** serviços desligados e as quantidades de antes, para religar sem perder o que estava */
  desligados: Record<Id, { tipoEntregaId: Id; quantidade: number }[]>;
}

export function vistaApresentacao(config: Configuracao, estado: EstadoApresentacao): VistaApresentacao {
  const { cenario } = estado;
  const r = calcularCenario(config, cenario);
  const qtd = new Map<Id, number>();
  for (const l of cenario.entregas) if (l.tipoEntregaId) qtd.set(l.tipoEntregaId, (qtd.get(l.tipoEntregaId) ?? 0) + v0(l.quantidade));
  const servicos: ServicoVista[] = config.servicos
    .filter((s) => s.ativo)
    .map((s) => ({
      servicoId: s.id,
      nome: s.nome,
      ligado: !estado.desligados[s.id],
      itens: config.tiposEntrega
        .filter((t) => t.ativo && t.servicoId === s.id)
        .map((t) => ({ tipoEntregaId: t.id, nome: t.nome, quantidade: qtd.get(t.id) ?? 0 })),
    }));
  const semServico = config.tiposEntrega.filter((t) => t.ativo && !t.servicoId);
  if (semServico.length)
    servicos.push({ servicoId: null, nome: "Outras entregas", ligado: true, itens: semServico.map((t) => ({ tipoEntregaId: t.id, nome: t.nome, quantidade: qtd.get(t.id) ?? 0 })) });
  // sem nenhuma entrega escolhida não há preço para mostrar (senão aparece só a parte do custo fixo)
  const temEntrega = cenario.entregas.some((l) => l.tipoEntregaId && v0(l.quantidade) > 0);
  const valor = cenario.modo === "valor" ? (r.mes ? r.mes.receitaBrutaCentavos : null) : temEntrega ? (r.proposta?.valorCentavos ?? null) : null;
  return {
    servicos: servicos.filter((s) => s.itens.length > 0),
    valorCentavos: valor,
    incluiTrafego: !!r.proposta?.incluiTrafego,
    verbaMidiaCentavos: r.proposta?.verbaMidiaCentavos ?? null,
    sinal: sinalDoCenario(config, cenario),
  };
}

/** Liga ou desliga um serviço inteiro, guardando as quantidades para religar. */
export function alternarServico(config: Configuracao, estado: EstadoApresentacao, servicoId: Id): EstadoApresentacao {
  const tipos = new Set(config.tiposEntrega.filter((t) => t.servicoId === servicoId).map((t) => t.id));
  const guardado = estado.desligados[servicoId];
  if (guardado) {
    let c = estado.cenario;
    for (const g of guardado) c = ajustarQuantidade(c, g.tipoEntregaId, g.quantidade);
    const desligados = { ...estado.desligados };
    delete desligados[servicoId];
    return { cenario: c, desligados };
  }
  const salvar = estado.cenario.entregas
    .filter((l) => l.tipoEntregaId && tipos.has(l.tipoEntregaId) && v0(l.quantidade) > 0)
    .map((l) => ({ tipoEntregaId: l.tipoEntregaId!, quantidade: v0(l.quantidade) }));
  return {
    cenario: { ...estado.cenario, entregas: estado.cenario.entregas.filter((l) => !l.tipoEntregaId || !tipos.has(l.tipoEntregaId)) },
    desligados: { ...estado.desligados, [servicoId]: salvar },
  };
}

/**
 * Contraproposta "só tenho R$ X": parte do pacote atual e vai tirando uma entrega por
 * vez (a que mais pesa em horas) até todos os sócios ficarem no piso e dentro das horas.
 * Devolve o pacote que cabe, já no modo valor com X de mensalidade.
 */
export function pacoteQueCabe(config: Configuracao, cenario: Cenario, valorCentavos: number): { cenario: Cenario; cabe: boolean; tirados: ItemVista[] } {
  let c: Cenario = { ...cenario, modo: "valor", mensalidadeCentavos: valorCentavos };
  const tirados = new Map<Id, number>();
  const cabe = (x: Cenario) => {
    const r = calcularCenario(config, x);
    return !!r.encaixe && r.encaixe.disponivel && r.encaixe.cabe;
  };
  const horasTipo = (id: Id) => {
    const t = config.tiposEntrega.find((x) => x.id === id);
    return t?.audiovisual ? 0 : v0(t?.horasPorUnidade);
  };
  for (let passo = 0; passo < 500 && !cabe(c); passo++) {
    const candidatos = c.entregas.filter((l) => l.tipoEntregaId && v0(l.quantidade) >= 1);
    if (!candidatos.length) break;
    // tira a entrega que mais pesa em horas; empate: a de maior quantidade
    candidatos.sort((a, b) => horasTipo(b.tipoEntregaId!) - horasTipo(a.tipoEntregaId!) || v0(b.quantidade) - v0(a.quantidade));
    const alvo = candidatos[0].tipoEntregaId!;
    c = ajustarQuantidade(c, alvo, -1);
    tirados.set(alvo, (tirados.get(alvo) ?? 0) + 1);
  }
  return {
    cenario: c,
    cabe: cabe(c),
    tirados: [...tirados].map(([id, q]) => ({ tipoEntregaId: id, nome: config.tiposEntrega.find((t) => t.id === id)?.nome ?? "", quantidade: q })),
  };
}

// ─── Pacote fechado na negociação ────────────────────────────────────────────

/**
 * O que o cliente vê de um pacote: nome, descrição, frases do que está incluso e os dois
 * valores (mensal e primeiro mês). Quantidades só aparecem ao personalizar. Nunca horas,
 * custos nem o valor pago a terceiro.
 */
export interface VistaPacote {
  nome: string;
  descricao: string;
  frases: string[];
  mensalCentavos: number | null;
  entradaCentavos: number | null;
  entradaAConfirmar: boolean;
  /** personalizado: quanto o mensal mudou em relação ao pacote original */
  diferencaMensalCentavos: number | null;
  /** para o "personalizar": as entregas do pacote e as quantidades atuais */
  itens: ItemVista[];
  sinal: Sinal;
}

export function vistaPacote(config: Configuracao, pacote: Pacote, estado: EstadoApresentacao): VistaPacote {
  const cen = estado.cenario;
  const atual = precoDoCenario(config, cen);
  const original = precoDoPacote(config, pacote);
  const mensal = cen.modo === "valor" ? (atual.resultado.mes?.receitaBrutaCentavos ?? null) : atual.mensalCentavos;
  const qtd = new Map<Id, number>();
  for (const l of cen.entregas) if (l.tipoEntregaId) qtd.set(l.tipoEntregaId, (qtd.get(l.tipoEntregaId) ?? 0) + v0(l.quantidade));
  const ids = [...new Set([...pacote.rotina.map((i) => i.tipoEntregaId), ...qtd.keys()])];
  const mudou = diferencaDoPacote(pacote, cen).length > 0 || cen.modo === "valor";
  return {
    nome: pacote.nome,
    descricao: pacote.descricao,
    frases: frasesParaCliente(config, pacote, cen),
    mensalCentavos: mensal,
    entradaCentavos: atual.entradaCentavos,
    entradaAConfirmar: atual.entradaAConfirmar,
    diferencaMensalCentavos: mudou && mensal != null && original.mensalCentavos != null ? mensal - original.mensalCentavos : null,
    itens: ids.map((id) => ({ tipoEntregaId: id, nome: config.tiposEntrega.find((t) => t.id === id)?.nome ?? "", quantidade: qtd.get(id) ?? 0 })),
    sinal: sinalDoCenario(config, cen),
  };
}
