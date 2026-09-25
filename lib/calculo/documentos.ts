// Conteúdo dos PDFs. Cada documento só leva o que faz sentido para quem vai receber:
// - proposta (cliente): entregas, quantidades e um valor. Nunca piso, horas, divisão
//   entre sócios nem custo interno.
// - resumo do contador: faturamento, recebimentos por cliente, custos fixos, imposto do
//   MEI e posição no teto. Nada de piso, horas, divisão entre sócios nem negociação.
// - relatório do sócio (interno): o que ele recebeu, de quais clientes, e as horas.
// As telas de impressão usam só os tokens de app/tokens.css.

import type { DistribuicaoCliente, Pagamento } from "./pagamentos";
import type { Cenario, Configuracao, Id } from "./tipos";

const v0 = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? 0 : v);

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export function mesPorExtenso(competencia: string): string {
  const [a, m] = competencia.split("-").map(Number);
  return `${MESES[m - 1]} de ${a}`;
}

function slug(t: string): string {
  return (
    t
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "sem-nome"
  );
}

/** Nome do arquivo: tipo_cliente_mês-ano (ex.: proposta_olinda-maquinas_09-2026). */
export function nomeArquivo(tipo: string, quem: string, competencia: string): string {
  const [a, m] = competencia.split("-");
  return `${slug(tipo)}_${slug(quem)}_${m}-${a}`;
}

// ─── Proposta ───────────────────────────────────────────────────────────────

export interface DocumentoProposta {
  tipo: "proposta";
  arquivo: string;
  cliente: string;
  mesReferencia: string;
  blocos: { servico: string; itens: { nome: string; quantidade: number }[] }[];
  entrada: { nome: string; quantidade: number }[];
  valorMensalCentavos: number;
  incluiTrafego: boolean;
  verbaMidiaCentavos: number | null;
  observacao: string;
}

function agrupar(config: Configuracao, linhas: Cenario["entregas"]) {
  const qtd = new Map<Id, number>();
  for (const l of linhas) if (l.tipoEntregaId && v0(l.quantidade) > 0) qtd.set(l.tipoEntregaId, (qtd.get(l.tipoEntregaId) ?? 0) + v0(l.quantidade));
  const porServico = new Map<string, { nome: string; quantidade: number }[]>();
  for (const [id, q] of qtd) {
    const t = config.tiposEntrega.find((x) => x.id === id);
    if (!t) continue;
    const s = config.servicos.find((x) => x.id === t.servicoId)?.nome ?? "Entregas";
    porServico.set(s, [...(porServico.get(s) ?? []), { nome: t.nome, quantidade: q }]);
  }
  return porServico;
}

export function documentoProposta(
  config: Configuracao,
  cenario: Cenario,
  valorMensalCentavos: number,
  opcoes: { cliente: string; competencia: string; incluiTrafego: boolean; verbaMidiaCentavos: number | null },
): DocumentoProposta {
  const blocos = [...agrupar(config, cenario.entregas)].map(([servico, itens]) => ({ servico, itens }));
  const entrada = [...agrupar(config, cenario.entrada?.entregas ?? [])].flatMap(([, itens]) => itens);
  return {
    tipo: "proposta",
    arquivo: nomeArquivo("proposta", opcoes.cliente, opcoes.competencia),
    cliente: opcoes.cliente,
    mesReferencia: mesPorExtenso(opcoes.competencia),
    blocos,
    entrada,
    valorMensalCentavos,
    incluiTrafego: opcoes.incluiTrafego,
    verbaMidiaCentavos: opcoes.verbaMidiaCentavos,
    observacao: `Um valor só, com ${opcoes.incluiTrafego ? "gestão de tráfego, " : ""}produção, planejamento e todas as ferramentas incluídos. Sem cobranças separadas.${opcoes.verbaMidiaCentavos ? " A verba de anúncios é paga por vocês direto na plataforma." : ""}`,
  };
}

// ─── Resumo do contador ─────────────────────────────────────────────────────

export interface DocumentoContador {
  tipo: "contador";
  arquivo: string;
  mesReferencia: string;
  /** soma do que caiu na conta neste mês (pela data do recebimento) */
  faturamentoCentavos: number;
  recebimentos: { cliente: string; data: string; valorCentavos: number; referente: string }[];
  porCliente: { cliente: string; valorCentavos: number }[];
  custosFixos: { nome: string; valorCentavos: number }[];
  totalCustosFixosCentavos: number;
  impostoFixoCentavos: number | null;
  teto: { tetoCentavos: number; acumuladoAnoCentavos: number; pct: number } | null;
}

export function documentoContador(config: Configuracao, pagamentos: Pagamento[], competencia: string): DocumentoContador {
  const nome = (id: Id) => config.clientes.find((c) => c.id === id)?.nome ?? "cliente removido";
  const doMes = pagamentos.filter((p) => p.recebidoEm.startsWith(competencia)).sort((a, b) => a.recebidoEm.localeCompare(b.recebidoEm));
  const porCliente = new Map<string, number>();
  for (const p of doMes) porCliente.set(nome(p.clienteId), (porCliente.get(nome(p.clienteId)) ?? 0) + p.valorCentavos);
  const custos = config.custosFixos.filter((c) => c.ativo && v0(c.valorMensalCentavos) > 0).map((c) => ({ nome: c.nome, valorCentavos: c.valorMensalCentavos! }));
  const ano = competencia.slice(0, 4);
  const acumulado = pagamentos.filter((p) => p.recebidoEm.startsWith(ano) && p.recebidoEm.slice(0, 7) <= competencia).reduce((a, p) => a + p.valorCentavos, 0);
  const teto = config.empresa.tetoFaturamentoAnualCentavos;
  return {
    tipo: "contador",
    arquivo: nomeArquivo("resumo-contador", "aden", competencia),
    mesReferencia: mesPorExtenso(competencia),
    faturamentoCentavos: doMes.reduce((a, p) => a + p.valorCentavos, 0),
    recebimentos: doMes.map((p) => ({ cliente: nome(p.clienteId), data: p.recebidoEm, valorCentavos: p.valorCentavos, referente: mesPorExtenso(p.competencia) })),
    porCliente: [...porCliente].map(([cliente, valorCentavos]) => ({ cliente, valorCentavos })),
    custosFixos: custos,
    totalCustosFixosCentavos: custos.reduce((a, c) => a + c.valorCentavos, 0),
    impostoFixoCentavos: config.empresa.impostoFixoMensalCentavos ?? null,
    teto: teto != null && teto > 0 ? { tetoCentavos: teto, acumuladoAnoCentavos: acumulado, pct: (acumulado / teto) * 100 } : null,
  };
}

// ─── Relatório interno do sócio ─────────────────────────────────────────────

export interface DocumentoSocio {
  tipo: "socio";
  arquivo: string;
  socio: string;
  mesReferencia: string;
  recebidoCentavos: number;
  planejadoCentavos: number;
  faltaCentavos: number;
  clientes: { cliente: string; recebidoCentavos: number; planejadoCentavos: number; horas: number | null }[];
  horasTotais: number;
}

export function documentoSocio(
  config: Configuracao,
  pessoaId: Id,
  competencia: string,
  distribuicoes: DistribuicaoCliente[],
  horasPorCliente: Record<Id, number | null>,
): DocumentoSocio {
  const socio = config.pessoas.find((p) => p.id === pessoaId);
  const clientes = distribuicoes
    .filter((d) => !d.bloqueio)
    .map((d) => ({
      cliente: d.nome,
      recebidoCentavos: d.totais.socios[pessoaId] ?? 0,
      planejadoCentavos: d.planejado?.socios[pessoaId] ?? 0,
      horas: horasPorCliente[d.clienteId] ?? null,
    }));
  const recebido = clientes.reduce((a, c) => a + c.recebidoCentavos, 0);
  const planejado = clientes.reduce((a, c) => a + c.planejadoCentavos, 0);
  return {
    tipo: "socio",
    arquivo: nomeArquivo("relatorio-socio", socio?.nome ?? "socio", competencia),
    socio: socio?.nome ?? "",
    mesReferencia: mesPorExtenso(competencia),
    recebidoCentavos: recebido,
    planejadoCentavos: planejado,
    faltaCentavos: Math.max(0, planejado - recebido),
    clientes,
    horasTotais: clientes.reduce((a, c) => a + v0(c.horas), 0),
  };
}
