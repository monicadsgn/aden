// O que falta preencher em cada seção das configurações (selo "falta preencher").
// Só aponta campos vazios; nunca sugere valor.

import type { Configuracao, SecaoConfig } from "../calculo/tipos";

export type Faltando = Record<SecaoConfig, string[]>;

export function camposFaltando(c: Configuracao): Faltando {
  const e = c.empresa;
  const socios = c.pessoas.filter((p) => p.ativo && p.socio);
  const out: Faltando = { socios: [], servicos: [], tipos: [], custos: [], terceiros: [], pacotes: [], metas: [], equipe: [], regras: [], limites: [], clientes: [] };

  if (!socios.length) out.socios.push("nenhum sócio cadastrado");
  for (const p of socios) {
    const nome = p.nome || "sócio sem nome";
    if (p.percentualPadrao == null) out.socios.push(`% de ${nome}`);
    if (p.pisoHoraCentavos == null) out.socios.push(`piso de ${nome}`);
    if (p.capacidadeHorasMes == null) out.socios.push(`horas por mês de ${nome}`);
  }
  for (const s of c.servicos.filter((x) => x.ativo)) {
    const soma = Object.values(s.divisaoPadrao).reduce<number>((a, v) => a + (v ?? 0), 0);
    if (soma === 0) out.servicos.push(`quem executa ${s.nome || "serviço sem nome"}`);
  }
  for (const t of c.tiposEntrega.filter((x) => x.ativo)) {
    if (!t.audiovisual && t.horasPorUnidade == null) out.tipos.push(`tempo de ${t.nome || "entrega sem nome"}`);
    if (!t.audiovisual && !t.servicoId) out.tipos.push(`serviço de ${t.nome || "entrega sem nome"}`);
  }
  for (const f of c.custosFixos.filter((x) => x.ativo)) if (f.valorMensalCentavos == null) out.custos.push(`valor de ${f.nome || "custo sem nome"}`);

  for (const t of (c.terceiros ?? []).filter((x) => x.ativo)) {
    if (t.valorPorSaidaCentavos == null) out.terceiros.push(`valor por saída de ${t.nome || "terceiro sem nome"}`);
    if (t.deslocamentoMedioCentavos == null) out.terceiros.push(`deslocamento médio de ${t.nome || "terceiro sem nome"}`);
  }
  for (const p of (c.pacotes ?? []).filter((x) => x.ativo)) {
    const nome = p.nome || "pacote sem nome";
    if ([...p.rotina, ...p.entrada].some((i) => i.quantidade == null)) out.pacotes.push(`quantidades a confirmar em ${nome}`);
  }
  // metas: os sócios decidem se e quando cadastrar; nunca aparece como "falta preencher"

  if (e.regime == null) out.regras.push("regime da empresa");
  if (e.regime === "mei" && e.impostoFixoMensalCentavos == null) out.regras.push("imposto fixo por mês");
  if (e.regime === "outro" && e.impostoPct == null) out.regras.push("imposto em %");
  if (e.regraRateio == null) out.regras.push("regra de rateio");
  if (e.reinvestimentoPct == null) out.regras.push("reinvestimento");
  if (e.taxaRecebimentoPct == null && e.taxaRecebimentoFixaCentavos == null) out.regras.push("taxa de recebimento");
  if (e.ordemDistribuicao == null) out.regras.push("ordem de distribuição dos pagamentos");

  if (e.tetoFaturamentoAnualCentavos == null) out.limites.push("teto do ano");
  if (e.avisoTetoPct == null) out.limites.push("aviso do teto");
  if (e.ociosidadePct == null) out.limites.push("folga sobrando");
  if (e.arredondamentoPropostaCentavos == null) out.limites.push("arredondamento da proposta");
  if (e.medicoesCalibragem == null) out.limites.push("medições para calibrar");

  for (const k of c.clientes.filter((x) => x.ativo)) {
    if (k.valorMensalCentavos == null && !k.interno) out.clientes.push(`valor de ${k.nome || "cliente sem nome"}`);
    if (!k.escopo) out.clientes.push(`escopo de ${k.nome || "cliente sem nome"}`);
  }
  return out;
}
