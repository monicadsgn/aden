// Ações que valem igual no site, no modo demonstração e no conector do Claude:
// avisos para os sócios e guardar escopo com a regra do piso.

import { calcularCenario } from "../calculo/motor";
import type { Cenario, Configuracao } from "../calculo/tipos";
import { formatarMoeda, formatarPct, formatarDuracao } from "../formato";
import { aplicarItens, assinaturaCenario, impactoNoBolso, sociosAbaixoDoPiso, type ItemProtegido } from "../regras/aprovacao";
import type { NovoAviso, Repositorio, ResultadoPedido, Usuario } from "./repositorio";

const MIN_AVISO = 1; // centavos: abaixo disso é arredondamento

function valorItem(i: ItemProtegido, v: number | null): string {
  if (v == null) return "vazio";
  if (i.campo === "piso_hora_centavos") return `${formatarMoeda(v)}/h`;
  if (i.campo === "horas_por_unidade") return formatarDuracao(v);
  return formatarPct(v);
}

export function descreverItem(i: ItemProtegido): string {
  return `${i.descricao}: ${valorItem(i, i.antes)} → ${valorItem(i, i.depois)}`;
}

/** Frases curtas do que mudou nas configurações, para os avisos. */
export function resumoMudancas(antes: Configuracao, depois: Configuracao): string[] {
  const out: string[] = [];
  const ea = antes.empresa;
  const ed = depois.empresa;
  const pct: [keyof typeof ea, string][] = [
    ["reinvestimentoPct", "Reinvestimento"],
    ["impostoPct", "Imposto em %"],
    ["taxaRecebimentoPct", "Taxa de recebimento"],
  ];
  for (const [k, nome] of pct) if (ea[k] !== ed[k]) out.push(`${nome}: ${formatarPct(ea[k] as number | null)} → ${formatarPct(ed[k] as number | null)}`);
  const din: [keyof typeof ea, string][] = [
    ["impostoFixoMensalCentavos", "Imposto fixo por mês"],
    ["taxaRecebimentoFixaCentavos", "Taxa fixa por cobrança"],
  ];
  for (const [k, nome] of din) if ((ea[k] ?? null) !== (ed[k] ?? null)) out.push(`${nome}: ${formatarMoeda(ea[k] as number | null)} → ${formatarMoeda(ed[k] as number | null)}`);
  if (ea.regraRateio !== ed.regraRateio) out.push(`Regra de rateio: ${ea.regraRateio ?? "vazia"} → ${ed.regraRateio ?? "vazia"}`);
  if ((ea.regime ?? null) !== (ed.regime ?? null)) out.push(`Regime: ${ea.regime ?? "vazio"} → ${ed.regime ?? "vazio"}`);
  for (const c of depois.custosFixos) {
    const a = antes.custosFixos.find((x) => x.id === c.id);
    if (!a) out.push(`Custo fixo novo: ${c.nome} (${formatarMoeda(c.valorMensalCentavos)})`);
    else if (a.valorMensalCentavos !== c.valorMensalCentavos || a.ativo !== c.ativo)
      out.push(`${c.nome}: ${formatarMoeda(a.valorMensalCentavos)} → ${formatarMoeda(c.ativo ? c.valorMensalCentavos : 0)}`);
  }
  for (const a of antes.custosFixos) if (!depois.custosFixos.some((c) => c.id === a.id)) out.push(`Custo fixo removido: ${a.nome}`);
  for (const c of depois.clientes) {
    const a = antes.clientes.find((x) => x.id === c.id);
    if (a && a.valorMensalCentavos !== c.valorMensalCentavos) out.push(`Valor de ${c.nome}: ${formatarMoeda(a.valorMensalCentavos)} → ${formatarMoeda(c.valorMensalCentavos)}`);
    if (a && a.ativo !== c.ativo) out.push(`${c.nome}: ${c.ativo ? "voltou a ficar ativo" : "deixou de ser ativo"}`);
  }
  return out;
}

const bolso = (v: number) => `${v >= 0 ? "+" : "−"}${formatarMoeda(Math.abs(v))} por mês no seu bolso`;

/**
 * Avisos de uma gravação de configurações: quem mudou, antes, depois e quanto muda no
 * bolso de cada sócio. Quem fez a mudança não recebe aviso da própria mudança.
 */
export function avisosDaMudanca(p: {
  antes: Configuracao;
  depois: Configuracao;
  autor: Usuario | null;
  itensPendentes: ItemProtegido[];
  pedido: ResultadoPedido | null;
  itensNaHora: ItemProtegido[];
}): NovoAviso[] {
  const avisos: NovoAviso[] = [];
  const autorNome = p.autor?.nome ?? null;
  const socios = p.depois.pessoas.filter((x) => x.socio && x.ativo);

  // o que já valeu
  const impacto = impactoNoBolso(p.antes, p.depois);
  const linhas = [...resumoMudancas(p.antes, p.depois), ...p.itensNaHora.map(descreverItem)];
  if (linhas.length)
    for (const s of socios) {
      if (s.id === p.autor?.pessoaId) continue;
      const d = impacto[s.id] ?? 0;
      if (Math.abs(d) < MIN_AVISO && !p.itensNaHora.some((i) => i.registroId === s.id || i.pessoaId === s.id)) continue;
      avisos.push({
        pessoaId: s.id,
        titulo: Math.abs(d) >= MIN_AVISO ? `Mudou quanto você recebe: ${bolso(d)}` : "Mudou um dado seu",
        texto: `${autorNome ?? "Alguém"} mudou: ${linhas.join("; ")}.`,
        impactoCentavos: Math.round(d),
        autorNome,
        pedidoId: null,
      });
    }

  // o que espera aprovação
  if (p.pedido?.status === "pendente") {
    const simulado = aplicarItens(p.antes, p.itensPendentes);
    const imp = impactoNoBolso(p.antes, simulado);
    for (const id of p.pedido.aguardando) {
      const d = imp[id] ?? 0;
      avisos.push({
        pessoaId: id,
        titulo: "Pedido de aprovação para você",
        texto: `${autorNome ?? "Alguém"} quer mudar: ${p.itensPendentes.map(descreverItem).join("; ")}. ${Math.abs(d) >= MIN_AVISO ? `Se aprovar: ${bolso(d)}.` : "Com os clientes de hoje, não muda o que você recebe."} Até você decidir, vale o valor antigo.`,
        impactoCentavos: Math.round(d),
        autorNome,
        pedidoId: p.pedido.pedidoId,
      });
    }
  }
  return avisos;
}

// ─── Escopo contratado com a regra do piso ──────────────────────────────────

export interface ResultadoGuardarEscopo {
  /** gravado direto (ninguém abaixo do piso) */
  gravado: boolean;
  /** virou exceção: aplicada na hora (o autor é o único afetado) ou esperando aprovação */
  pedido: ResultadoPedido | null;
  valorCentavos: number | null;
  abaixo: { pessoaId: string; nome: string; perdaMensalCentavos: number }[];
}

/** Valor mensal (sem a cobrança de tráfego) que este cenário significa como contrato. */
export function valorDoContrato(config: Configuracao, cenario: Cenario): number | null {
  if (cenario.modo === "valor") return cenario.mensalidadeCentavos;
  const r = calcularCenario(config, cenario);
  if (!r.proposta || !r.mes) return null;
  return Math.max(0, r.proposta.valorCentavos - r.mes.receitaTrafegoCentavos);
}

/**
 * Guarda o cenário como escopo contratado (e o valor como contrato). Se algum sócio fica
 * abaixo do piso, vira pedido de exceção: só vale quando o sócio afetado aprovar
 * (se o afetado é quem está guardando, vale na hora, registrado no histórico).
 */
export async function guardarEscopo(repo: Repositorio, config: Configuracao, clienteId: string, cenario: Cenario): Promise<ResultadoGuardarEscopo> {
  const cliente = config.clientes.find((c) => c.id === clienteId);
  if (!cliente) throw new Error("Cliente não encontrado.");
  const escopo: Cenario = { ...cenario, clienteId };
  const valor = valorDoContrato(config, escopo);
  const avaliado = calcularCenario(config, { ...escopo, modo: "valor", mensalidadeCentavos: valor });
  if (avaliado.bloqueio) throw new Error(avaliado.bloqueio.texto);
  const abaixo = sociosAbaixoDoPiso(config, avaliado).map((s) => ({ pessoaId: s.pessoaId, nome: s.nome, perdaMensalCentavos: s.perdaMensalCentavos }));
  if (!abaixo.length) {
    await repo.definirEscopoCliente(clienteId, escopo);
    if (valor != null && valor !== cliente.valorMensalCentavos) await gravarValorContrato(repo, config, clienteId, valor);
    return { gravado: true, pedido: null, valorCentavos: valor, abaixo };
  }
  const pedido = await repo.proporExcecao({
    clienteId,
    afetados: abaixo.map((a) => a.pessoaId),
    assinatura: `${assinaturaCenario(escopo)}:${valor ?? ""}`,
    descricao: `Escopo de ${cliente.nome} abaixo do piso de ${abaixo.map((a) => a.nome).join(" e ")}`,
    dados: { aplicar: "escopo", cenario: escopo, valorCentavos: valor, perdas: abaixo },
  });
  return { gravado: false, pedido, valorCentavos: valor, abaixo };
}

async function gravarValorContrato(repo: Repositorio, config: Configuracao, clienteId: string, valor: number) {
  const cli = config.clientes.find((c) => c.id === clienteId)!;
  await repo.salvarConfig({
    pessoas: { salvar: [], remover: [] },
    servicos: { salvar: [], remover: [] },
    tiposEntrega: { salvar: [], remover: [] },
    custosFixos: { salvar: [], remover: [] },
    clientes: { salvar: [{ ...cli, valorMensalCentavos: valor }], remover: [] },
  });
}

/** Assinatura de uma proposta (conteúdo + valor): a exceção aprovada vale só para ela. */
export function assinaturaProposta(cenario: Cenario, valorCentavos: number | null): string {
  return `${assinaturaCenario(cenario)}:${valorCentavos ?? ""}`;
}
