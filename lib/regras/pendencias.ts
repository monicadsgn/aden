// O que falta preencher em cada seção das configurações.
// Só aponta campos vazios; nunca sugere valor.
// Separa o que é OBRIGATÓRIO (sem ele a conta não sai, ou sai errada) do que é OPCIONAL
// (vazio tem um sentido: sem aviso, conta como zero…). O selo "falta preencher" só acende
// para obrigatório; opcional vazio é lembrete (CLAUDE.md: campo opcional vazio é lembrete, não erro).

import type { Configuracao, SecaoConfig } from "../calculo/tipos";

export type Faltando = Record<SecaoConfig, string[]>;

/** Campo opcional vazio: o nome e o que acontece enquanto ficar vazio. */
export interface Opcional {
  campo: string;
  /** o que vale enquanto estiver vazio (ex.: "sem aviso") */
  vazio: string;
}

export interface PendenciasSecao {
  /** sem isso a conta não sai (ou sai errada): acende o selo da aba */
  obrigatorio: string[];
  /** vazio é escolha: só lembrete discreto */
  opcional: Opcional[];
}

export type Pendencias = Record<SecaoConfig, PendenciasSecao>;

/** O que acontece quando um obrigatório da seção fica vazio (frase curta, depois de "sem isso,"). */
export const SEM_O_OBRIGATORIO: Partial<Record<SecaoConfig, string>> = {
  socios: "a proposta não calcula o valor mínimo e o pagamento não é dividido entre os sócios",
  servicos: "as horas desse serviço não vão para nenhum sócio e a proposta não calcula",
  tipos: "a entrega não soma horas e a proposta sai menor do que deveria",
  custos: "o custo fica de fora da conta e o resultado parece melhor do que é",
  terceiros: "o custo do terceiro fica de fora da conta do cliente",
  pacotes: "o preço do pacote não sai",
  regras: "a proposta não calcula ou o pagamento não é dividido",
  clientes: "a tela Mês não sabe quanto entra nem o que o cliente recebe",
};

const secoesVazias = (): Pendencias => {
  const s = (): PendenciasSecao => ({ obrigatorio: [], opcional: [] });
  return {
    socios: s(), servicos: s(), tipos: s(), custos: s(), terceiros: s(), pacotes: s(), datas: s(), briefing: s(), onboarding: s(),
    contrato: s(), metas: s(), equipe: s(), regras: s(), limites: s(), clientes: s(),
  };
};

export function pendencias(c: Configuracao): Pendencias {
  const e = c.empresa;
  const socios = c.pessoas.filter((p) => p.ativo && p.socio);
  const out = secoesVazias();

  if (!socios.length) out.socios.obrigatorio.push("nenhum sócio cadastrado");
  for (const p of socios) {
    const nome = p.nome || "sócio sem nome";
    if (p.percentualPadrao == null) out.socios.obrigatorio.push(`% de ${nome}`);
    if (p.pisoHoraCentavos == null) out.socios.obrigatorio.push(`piso de ${nome}`);
    if (p.capacidadeHorasMes == null) out.socios.obrigatorio.push(`horas por mês de ${nome}`);
  }
  for (const s of c.servicos.filter((x) => x.ativo)) {
    const soma = Object.values(s.divisaoPadrao).reduce<number>((a, v) => a + (v ?? 0), 0);
    if (soma === 0) out.servicos.obrigatorio.push(`quem executa ${s.nome || "serviço sem nome"}`);
  }
  for (const t of c.tiposEntrega.filter((x) => x.ativo)) {
    if (!t.audiovisual && t.horasPorUnidade == null) out.tipos.obrigatorio.push(`tempo de ${t.nome || "entrega sem nome"}`);
    if (!t.audiovisual && !t.servicoId) out.tipos.obrigatorio.push(`serviço de ${t.nome || "entrega sem nome"}`);
  }
  for (const f of c.custosFixos.filter((x) => x.ativo)) if (f.valorMensalCentavos == null) out.custos.obrigatorio.push(`valor de ${f.nome || "custo sem nome"}`);

  for (const t of (c.terceiros ?? []).filter((x) => x.ativo)) {
    if (t.valorPorSaidaCentavos == null) out.terceiros.obrigatorio.push(`valor por saída de ${t.nome || "terceiro sem nome"}`);
    // o cálculo conta R$ 0 de deslocamento e avisa como lembrete
    if (t.deslocamentoMedioCentavos == null) out.terceiros.opcional.push({ campo: `deslocamento médio de ${t.nome || "terceiro sem nome"}`, vazio: "conta R$ 0 por saída" });
  }
  for (const p of (c.pacotes ?? []).filter((x) => x.ativo)) {
    const nome = p.nome || "pacote sem nome";
    if ([...p.rotina, ...p.entrada].some((i) => i.quantidade == null)) out.pacotes.obrigatorio.push(`quantidades a confirmar em ${nome}`);
  }
  // metas: os sócios decidem se e quando cadastrar; nunca aparece como "falta preencher"

  if (e.regime == null) out.regras.obrigatorio.push("regime da empresa");
  if (e.regime === "mei" && e.impostoFixoMensalCentavos == null) out.regras.obrigatorio.push("imposto fixo por mês");
  if (e.regime === "outro" && e.impostoPct == null) out.regras.obrigatorio.push("imposto em %");
  if (e.regraRateio == null) out.regras.obrigatorio.push("regra da divisão dos custos fixos");
  if (e.ordemDistribuicao == null) out.regras.obrigatorio.push("ordem de distribuição dos pagamentos");
  // o cálculo conta zero e avisa como lembrete: vazio é uma escolha possível
  if (e.reinvestimentoPct == null) out.regras.opcional.push({ campo: "reinvestimento", vazio: "nada fica guardado, a sobra toda vai para os sócios" });
  if (e.taxaRecebimentoPct == null && e.taxaRecebimentoFixaCentavos == null) out.regras.opcional.push({ campo: "taxa de recebimento", vazio: "conta como 0%" });

  // limites: vazio = sem aviso (a própria seção diz isso)
  if (e.tetoFaturamentoAnualCentavos == null) out.limites.opcional.push({ campo: "teto do ano", vazio: "sem aviso de teto" });
  if (e.avisoTetoPct == null) out.limites.opcional.push({ campo: "aviso do teto", vazio: "só avisa quando passar do teto" });
  if (e.ociosidadePct == null) out.limites.opcional.push({ campo: "folga sobrando", vazio: "sem aviso de horas sobrando" });
  if (e.arredondamentoPropostaCentavos == null) out.limites.opcional.push({ campo: "arredondamento da proposta", vazio: "o valor sai sem arredondar" });
  if (e.prazoMinimoPedidoDiasUteis == null) out.limites.opcional.push({ campo: "prazo mínimo de pedido", vazio: "pedido ao outro sócio sem prazo fica em \"sem prazo\"" });

  for (const k of c.clientes.filter((x) => x.ativo)) {
    if (k.valorMensalCentavos == null && !k.interno) out.clientes.obrigatorio.push(`valor de ${k.nome || "cliente sem nome"}`);
    if (!k.escopo && !k.projetoAvulso) out.clientes.obrigatorio.push(`entregas do contrato de ${k.nome || "cliente sem nome"}`);
  }
  return out;
}

/** Só o que é obrigatório, por seção: alimenta o selo "falta preencher" e o card "Para começar". */
export function camposFaltando(c: Configuracao): Faltando {
  const p = pendencias(c);
  return Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v.obrigatorio])) as Faltando;
}

export interface PassoComecar {
  secao: SecaoConfig;
  rotulo: string;
  /** o que ainda falta nesta seção; vazio = pronto */
  faltando: string[];
}

// Ordem de quem começa do zero: primeiro quem são os sócios, depois o que a Aden vende, depois as regras.
// Limites e avisos ficam de fora (vazio = sem aviso, é escolha) e metas também (os sócios decidem quando).
const ORDEM_COMECAR: { secao: SecaoConfig; rotulo: string }[] = [
  // mesma ordem dos números das abas de Configurações (G5): primeiro o sistema, depois o comercial
  { secao: "socios", rotulo: "Sócios: % de cada um, piso e horas no mês" },
  { secao: "custos", rotulo: "Custos fixos: quanto a empresa paga por mês" },
  { secao: "regras", rotulo: "Regras da empresa: regime, imposto e divisão dos custos e dos pagamentos" },
  { secao: "servicos", rotulo: "Serviços: quem executa cada um" },
  { secao: "tipos", rotulo: "Tipos de entrega: quanto tempo leva cada um" },
  { secao: "terceiros", rotulo: "Terceiros: valor por saída" },
  { secao: "pacotes", rotulo: "Pacotes: confirmar as quantidades" },
  { secao: "clientes", rotulo: "Clientes: valor e entregas do contrato de cada um" },
];

/** Card "Para começar" da Visão do dia: os passos, na ordem, com o que falta em cada um. */
export function passosParaComecar(c: Configuracao): PassoComecar[] {
  const f = camposFaltando(c);
  // passo que só existe quando tem o que fazer: sem terceiro, pacote ou cliente cadastrado, ele não aparece
  const opcionais: Partial<Record<SecaoConfig, number>> = {
    terceiros: (c.terceiros ?? []).filter((x) => x.ativo).length,
    pacotes: (c.pacotes ?? []).filter((x) => x.ativo).length,
    clientes: c.clientes.filter((x) => x.ativo).length,
  };
  return ORDEM_COMECAR.filter((p) => opcionais[p.secao] !== 0).map((p) => ({ ...p, faltando: f[p.secao] }));
}
