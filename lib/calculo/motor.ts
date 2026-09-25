// Motor de cálculo da calculadora de projeto.
//
// Funções puras: recebem configuração + cenário e devolvem números. Nada aqui
// conhece tela, banco ou usuário. O mesmo motor vai servir, nas próximas fases,
// pra calcular o resultado real por cliente no Financeiro.
//
// Fluxo de um mês:
//   receita bruta = mensalidade + cobrança de tráfego
//   − impostos (% da receita) − taxa de recebimento (% da receita)
//   − custos do projeto (ferramentas, audiovisual, terceiros, pontual diluído)
//   − parte do custo fixo da empresa (rateio)
//   = sobra
//   − reinvestimento (% da sobra, só quando a sobra é positiva)
//   = distribuível → dividido entre os sócios pelo % de cada um
//   valor por hora do sócio = parte dele ÷ horas dos serviços que ele executa

import { formatarMoeda, formatarPct } from "../formato";
import type {
  Alerta,
  CategoriaCusto,
  Cenario,
  Configuracao,
  Encaixe,
  EncaixeTipo,
  Id,
  LimiteEncaixe,
  LinhaCusto,
  LinhaEntrega,
  Pessoa,
  RegraRateio,
  ResultadoCenario,
  ResultadoEntrada,
  ResultadoHorizonte,
  ResultadoMes,
  ResultadoMinimo,
  ResultadoPessoa,
  ResultadoPontualFora,
  ProjecaoTeto,
  PropostaCliente,
  ResultadoServico,
  SuspensaoSemCobranca,
  VarianteHorizonte,
} from "./tipos";

const EPS = 0.005; // tolerância de meio centavo / arredondamento de %

const v0 = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? 0 : v);
const positivo = (v: number | null | undefined): v is number => v != null && Number.isFinite(v) && v > 0;

// ─── Preparação (tudo que não depende da receita) ───────────────────────────

interface SocioEfetivo {
  pessoa: Pessoa;
  pct: number | null;
  sobreposto: boolean;
}

export interface PreparadoMes {
  config: Configuracao;
  horasTotais: number;
  servicos: ResultadoServico[];
  horasPorPessoa: Map<Id, number>;
  custosPorCategoria: Record<CategoriaCusto, number>;
  custoPontualDiluido: number;
  custosProjeto: number;
  /** só a cobrança da Aden pela gestão; a verba de mídia nunca entra aqui */
  receitaTrafego: number;
  /** informativo, fora de qualquer soma */
  verbaMidia: number | null;
  impostoPct: number;
  impostoSobreposto: boolean;
  taxaPct: number;
  /** tarifa fixa por recebimento (só quando há receita) */
  taxaFixa: number;
  taxaSobreposta: boolean;
  reinvPct: number;
  reinvSobreposto: boolean;
  socios: SocioEfetivo[];
  percentuaisValidos: boolean;
  rateio: {
    ativo: boolean;
    regra: RegraRateio | null;
    total: number;
    impostoFixo: number;
    clientesNaBase: number;
    somaOutros: number;
  };
  semCapacidade: boolean;
  alertas: Alerta[];
}

interface OpcoesPreparo {
  semRateio?: boolean;
  semCapacidade?: boolean;
  /** pontual fora da mensalidade não tem tráfego nem pontuais aninhados */
  ignorarPontuais?: boolean;
}

function custosVazios(): Record<CategoriaCusto, number> {
  return { ferramenta: 0, audiovisual: 0, terceiro: 0, outro: 0 };
}

const somaCategorias = (c: Record<CategoriaCusto, number>) => c.ferramenta + c.audiovisual + c.terceiro + (c.outro ?? 0);

/** Quantidade total de cada tipo de entrega numa lista de linhas. */
function quantidadesPorTipo(linhas: LinhaEntrega[]): Map<Id, number> {
  const m = new Map<Id, number>();
  for (const l of linhas) {
    if (!l.tipoEntregaId) continue;
    m.set(l.tipoEntregaId, (m.get(l.tipoEntregaId) ?? 0) + v0(l.quantidade));
  }
  return m;
}

/** Soma os custos de uma lista de linhas. `fator` divide (pontual diluído). */
function somarCustos(
  custos: LinhaCusto[],
  quantidades: Map<Id, number>,
  config: Configuracao,
  alertas: Alerta[],
  prefixo: string,
): Record<CategoriaCusto, number> {
  const tot = custosVazios();
  for (const c of custos) {
    const valor = v0(c.valorCentavos);
    if (valor === 0) continue;
    const forma = c.categoria === "ferramenta" ? "fixo" : c.forma;
    if (forma === "fixo") {
      tot[c.categoria] += valor;
    } else {
      if (!c.tipoEntregaId) {
        alertas.push({
          nivel: "aviso",
          texto: `${prefixo}Custo "${c.descricao || c.categoria}" é por entrega mas não tem tipo de entrega vinculado — ficou fora do cálculo.`,
        });
        continue;
      }
      const tipo = config.tiposEntrega.find((t) => t.id === c.tipoEntregaId);
      if (!tipo) continue;
      tot[c.categoria] += valor * (quantidades.get(c.tipoEntregaId) ?? 0);
    }
  }
  return tot;
}

interface LinhaHoras {
  servicoId: Id | null;
  horas: number;
}

function horasDasEntregas(
  linhas: LinhaEntrega[],
  config: Configuracao,
  fator: number,
  alertas: Alerta[],
  prefixo: string,
): LinhaHoras[] {
  const out: LinhaHoras[] = [];
  for (const l of linhas) {
    if (!l.tipoEntregaId) continue;
    const tipo = config.tiposEntrega.find((t) => t.id === l.tipoEntregaId);
    if (!tipo) continue;
    const qtd = v0(l.quantidade);
    if (qtd === 0) continue;
    // audiovisual é sempre terceiro: nunca gera horas dos sócios
    if (tipo.audiovisual) continue;
    const hUn = l.horasPorUnidade ?? tipo.horasPorUnidade;
    if (hUn == null) {
      alertas.push({
        nivel: "aviso",
        texto: `${prefixo}"${tipo.nome}" não tem horas por entrega configuradas — contou 0 h.`,
      });
      continue;
    }
    out.push({ servicoId: tipo.servicoId, horas: (qtd * hUn) / fator });
  }
  return out;
}

export function prepararMes(config: Configuracao, cenario: Cenario, opcoes: OpcoesPreparo = {}): PreparadoMes {
  const alertas: Alerta[] = [];
  const sob = cenario.sobreposicoes;

  // Percentuais da empresa, com sobreposição por projeto
  const imposto = sob.impostoPct ?? config.empresa.impostoPct;
  const taxa = sob.taxaRecebimentoPct ?? config.empresa.taxaRecebimentoPct;
  const reinv = sob.reinvestimentoPct ?? config.empresa.reinvestimentoPct;
  if (imposto == null) alertas.push({ nivel: "info", texto: "Imposto sobre faturamento não configurado — considerado 0%." });
  if (taxa == null) alertas.push({ nivel: "info", texto: "Taxa de recebimento não configurada — considerada 0%." });
  if (reinv == null) alertas.push({ nivel: "aviso", texto: "Percentual de reinvestimento não configurado — considerado 0%." });

  // Horas: entregas do mês + pontuais diluídos
  const linhasHoras = horasDasEntregas(cenario.entregas, config, 1, alertas, "");
  const custosCat = somarCustos(cenario.custos, quantidadesPorTipo(cenario.entregas), config, alertas, "");
  let custoPontualDiluido = 0;

  if (!opcoes.ignorarPontuais) {
    for (const p of cenario.pontuais) {
      const nome = p.nome || "Projeto pontual";
      if (p.forma == null) {
        alertas.push({ nivel: "aviso", texto: `${nome}: escolha "diluído" ou "fora da mensalidade" — ainda não entrou no cálculo.` });
        continue;
      }
      if (p.forma !== "diluido") continue;
      if (!positivo(p.meses)) {
        alertas.push({ nivel: "erro", texto: `${nome}: informe em quantos meses o projeto será diluído.` });
        continue;
      }
      const pref = `${nome}: `;
      linhasHoras.push(...horasDasEntregas(p.entregas, config, p.meses, alertas, pref));
      const c = somarCustos(p.custos, quantidadesPorTipo(p.entregas), config, alertas, pref);
      custoPontualDiluido += somaCategorias(c) / p.meses;
    }
  }

  // Sócios e percentuais
  const pessoasAtivas = config.pessoas.filter((p) => p.ativo);
  const socios: SocioEfetivo[] = pessoasAtivas
    .filter((p) => p.socio)
    .map((p) => {
      const o = sob.percentualPessoa[p.id];
      const sobreposto = o != null && o !== p.percentualPadrao;
      return { pessoa: p, pct: o ?? p.percentualPadrao, sobreposto };
    });
  let percentuaisValidos = true;
  if (socios.length === 0) {
    percentuaisValidos = false;
    alertas.push({ nivel: "erro", texto: "Cadastre os sócios nas configurações para ver a divisão." });
  } else {
    const faltando = socios.filter((s) => s.pct == null);
    if (faltando.length) {
      percentuaisValidos = false;
      alertas.push({
        nivel: "erro",
        texto: `Defina o percentual de ${faltando.map((s) => s.pessoa.nome).join(", ")} (padrão nas configurações ou neste cenário).`,
      });
    } else {
      const soma = socios.reduce((a, s) => a + v0(s.pct), 0);
      if (Math.abs(soma - 100) > EPS) {
        percentuaisValidos = false;
        alertas.push({ nivel: "erro", texto: `Os percentuais dos sócios somam ${formatarPct(soma)}. Precisam somar 100%.` });
      }
    }
  }

  // Horas por serviço e por pessoa
  const horasServico = new Map<Id | null, number>();
  for (const l of linhasHoras) horasServico.set(l.servicoId, (horasServico.get(l.servicoId) ?? 0) + l.horas);

  const horasPorPessoa = new Map<Id, number>();
  for (const p of pessoasAtivas) horasPorPessoa.set(p.id, 0);
  const servicos: ResultadoServico[] = [];
  let horasTotais = 0;

  for (const [servicoId, horas] of horasServico) {
    horasTotais += horas;
    if (servicoId == null) {
      servicos.push({ servicoId: null, nome: "Sem serviço", horas, divisao: {}, divisaoSobreposta: false });
      if (horas > 0)
        alertas.push({ nivel: "aviso", texto: "Há tipos de entrega sem serviço vinculado: essas horas não foram atribuídas a ninguém." });
      continue;
    }
    const serv = config.servicos.find((s) => s.id === servicoId);
    const nome = serv?.nome ?? "Serviço removido";
    const o = sob.divisaoServico[servicoId];
    const divisao: Record<Id, number> = {};
    let sobreposta = false;
    for (const p of pessoasAtivas) {
      const padrao = serv?.divisaoPadrao[p.id] ?? null;
      const valor = o && o[p.id] != null ? o[p.id] : padrao;
      if (o && o[p.id] != null && o[p.id] !== padrao) sobreposta = true;
      if (valor != null && valor !== 0) divisao[p.id] = valor;
    }
    const soma = Object.values(divisao).reduce((a, b) => a + b, 0);
    if (horas > 0) {
      if (soma === 0) {
        percentuaisValidos = false;
        alertas.push({ nivel: "erro", texto: `Defina quem executa "${nome}" (divisão de horas entre as pessoas).` });
      } else if (Math.abs(soma - 100) > EPS) {
        percentuaisValidos = false;
        alertas.push({ nivel: "erro", texto: `A divisão de horas de "${nome}" soma ${formatarPct(soma)}. Precisa somar 100%.` });
      }
    }
    for (const [pid, pct] of Object.entries(divisao)) {
      horasPorPessoa.set(pid, (horasPorPessoa.get(pid) ?? 0) + (horas * pct) / 100);
    }
    servicos.push({ servicoId, nome, horas, divisao, divisaoSobreposta: sobreposta });
  }

  // Tráfego — só a gestão fatura. A verba de mídia é paga pelo cliente direto na
  // plataforma: não é receita, não entra em imposto nem em taxa de recebimento.
  let receitaTrafego = 0;
  if (!opcoes.ignorarPontuais) {
    const t = cenario.trafego;
    switch (t.modelo) {
      case null:
        alertas.push({
          nivel: "aviso",
          texto: 'Modelo de cobrança do tráfego não definido — nenhuma receita de tráfego considerada. Se não houver tráfego, marque "não há tráfego".',
        });
        break;
      case "fixo":
        receitaTrafego = v0(t.valorFixoCentavos);
        break;
      case "por_campanha":
        receitaTrafego = v0(t.valorPorCampanhaCentavos) * v0(t.campanhas);
        break;
      case "percentual_verba":
        // a verba é só a BASE do percentual; o faturamento é a gestão
        receitaTrafego = (v0(t.verbaMensalCentavos) * v0(t.percentualVerba)) / 100;
        break;
    }
  }

  // Rateio do custo fixo
  // imposto fixo mensal (ex.: MEI) é custo da empresa: entra no rateio junto com os custos fixos
  const impostoFixo = v0(config.empresa.impostoFixoMensalCentavos);
  const totalFixo = config.custosFixos.filter((c) => c.ativo).reduce((a, c) => a + v0(c.valorMensalCentavos), 0) + impostoFixo;
  const base = config.clientes.filter((c) => c.ativo && c.participaRateio);
  const outros = base.filter((c) => c.id !== cenario.clienteId);
  const rateioAtivo = !opcoes.semRateio && totalFixo > 0;
  const regra = config.empresa.regraRateio;
  if (rateioAtivo && regra == null) {
    alertas.push({ nivel: "erro", texto: "Há custos fixos cadastrados, mas a regra de rateio não foi escolhida nas configurações." });
  }
  if (rateioAtivo && regra === "proporcional") {
    const semValor = outros.filter((c) => c.valorMensalCentavos == null);
    if (semValor.length)
      alertas.push({
        nivel: "aviso",
        texto: `Clientes sem valor mensal na base de rateio (contados como R$ 0): ${semValor.map((c) => c.nome).join(", ")}.`,
      });
  }

  const custosProjeto = somaCategorias(custosCat) + custoPontualDiluido;

  return {
    config,
    horasTotais,
    servicos,
    horasPorPessoa,
    custosPorCategoria: custosCat,
    custoPontualDiluido,
    custosProjeto,
    receitaTrafego,
    verbaMidia: opcoes.ignorarPontuais ? null : cenario.trafego.verbaMensalCentavos,
    impostoPct: v0(imposto),
    impostoSobreposto: sob.impostoPct != null && sob.impostoPct !== config.empresa.impostoPct,
    taxaPct: v0(taxa),
    taxaFixa: v0(config.empresa.taxaRecebimentoFixaCentavos),
    taxaSobreposta: sob.taxaRecebimentoPct != null && sob.taxaRecebimentoPct !== config.empresa.taxaRecebimentoPct,
    reinvPct: v0(reinv),
    reinvSobreposto: sob.reinvestimentoPct != null && sob.reinvestimentoPct !== config.empresa.reinvestimentoPct,
    socios,
    percentuaisValidos,
    rateio: {
      ativo: rateioAtivo && regra != null,
      regra,
      total: totalFixo,
      impostoFixo,
      clientesNaBase: outros.length + 1,
      somaOutros: outros.reduce((a, c) => a + v0(c.valorMensalCentavos), 0),
    },
    semCapacidade: !!opcoes.semCapacidade,
    alertas,
  };
}

// ─── Cálculo do mês com uma receita ─────────────────────────────────────────

function quotaRateio(prep: PreparadoMes, receita: number): number {
  const r = prep.rateio;
  if (!r.ativo) return 0;
  if (r.regra === "igual") return r.total / r.clientesNaBase;
  // proporcional ao valor
  const soma = r.somaOutros + receita;
  if (soma <= 0) return 0;
  return (r.total * receita) / soma;
}

export function calcularComReceita(
  prep: PreparadoMes,
  mensalidade: number,
  opcoes: { semTrafego?: boolean } = {},
): ResultadoMes {
  const alertas: Alerta[] = [...prep.alertas];
  const trafego = opcoes.semTrafego ? 0 : prep.receitaTrafego;
  const receita = Math.max(0, mensalidade) + trafego;
  const impostos = (receita * prep.impostoPct) / 100;
  const taxas = receita > 0 ? (receita * prep.taxaPct) / 100 + prep.taxaFixa : 0;
  const quota = quotaRateio(prep, receita);
  const sobra = receita - impostos - taxas - prep.custosProjeto - quota;
  const reinvestimento = sobra > 0 ? (sobra * prep.reinvPct) / 100 : 0;
  const distribuivel = sobra - reinvestimento;

  if (sobra < -EPS) alertas.push({ nivel: "erro", texto: `A sobra é negativa (${formatarMoeda(sobra)}): o valor não cobre os custos.` });

  const pessoas: ResultadoPessoa[] = prep.config.pessoas
    .filter((p) => p.ativo)
    .map((p) => {
      const socio = prep.socios.find((s) => s.pessoa.id === p.id);
      const horas = prep.horasPorPessoa.get(p.id) ?? 0;
      const pct = socio?.pct ?? null;
      const valor = socio && prep.percentuaisValidos && pct != null ? (distribuivel * pct) / 100 : null;
      const valorHora = valor != null && horas > 0 ? valor / horas : null;
      const piso = positivo(p.pisoHoraCentavos) ? p.pisoHoraCentavos : null;
      const abaixoPiso = piso != null && valorHora != null && valorHora < piso - EPS;
      const cap = prep.semCapacidade ? null : positivo(p.capacidadeHorasMes) ? p.capacidadeHorasMes : null;
      const consumo = cap != null ? (horas / cap) * 100 : null;
      return {
        id: p.id,
        nome: p.nome,
        percentual: pct,
        percentualSobreposto: socio?.sobreposto ?? false,
        horas,
        valorCentavos: valor,
        valorHoraCentavos: valorHora,
        pisoHoraCentavos: piso,
        abaixoPiso,
        capacidadeHorasMes: cap,
        consumoCapacidadePct: consumo,
      };
    });

  for (const p of pessoas) {
    if (p.abaixoPiso)
      alertas.push({
        nivel: "erro",
        texto: `${p.nome}: ${formatarMoeda(p.valorHoraCentavos)}/h, abaixo do piso de ${formatarMoeda(p.pisoHoraCentavos)}/h.`,
      });
    if (p.horas > 0 && p.pisoHoraCentavos == null && prep.socios.some((s) => s.pessoa.id === p.id))
      alertas.push({ nivel: "aviso", texto: `${p.nome} não tem piso por hora configurado — o alerta de piso não vale para ele(a).` });
    if (p.consumoCapacidadePct != null && p.consumoCapacidadePct > 100 + EPS)
      alertas.push({
        nivel: "erro",
        texto: `${p.nome}: este projeto sozinho usa ${formatarPct(p.consumoCapacidadePct)} das horas do mês.`,
      });
  }

  const H = prep.horasTotais;
  return {
    receitaMensalidadeCentavos: Math.max(0, mensalidade),
    receitaTrafegoCentavos: trafego,
    receitaBrutaCentavos: receita,
    verbaMidiaCentavos: prep.verbaMidia,
    impostoPct: prep.impostoPct,
    impostoPctSobreposto: prep.impostoSobreposto,
    impostosCentavos: impostos,
    taxaRecebimentoPct: prep.taxaPct,
    taxaRecebimentoPctSobreposta: prep.taxaSobreposta,
    taxasCentavos: taxas,
    custosPorCategoria: prep.custosPorCategoria,
    custoPontualDiluidoCentavos: prep.custoPontualDiluido,
    custosProjetoCentavos: prep.custosProjeto,
    rateio: {
      regra: prep.rateio.regra,
      totalFixoCentavos: prep.rateio.total,
      clientesNaBase: prep.rateio.clientesNaBase,
      quotaCentavos: quota,
      impostoFixoCentavos: prep.rateio.impostoFixo,
    },
    sobraCentavos: sobra,
    reinvestimentoPct: prep.reinvPct,
    reinvestimentoPctSobreposto: prep.reinvSobreposto,
    reinvestimentoCentavos: reinvestimento,
    distribuivelCentavos: distribuivel,
    horasTotais: H,
    servicos: prep.servicos,
    pessoas,
    custoHoraCentavos: H > 0 ? (prep.custosProjeto + quota) / H : null,
    valorCobradoHoraCentavos: H > 0 ? receita / H : null,
    sobraHoraCentavos: H > 0 ? sobra / H : null,
    percentuaisValidos: prep.percentuaisValidos,
    alertas,
  };
}

// ─── Valor mínimo (modo escopo) ─────────────────────────────────────────────

/** Sobra mensal mínima para cada sócio com horas atingir o próprio piso. */
function sobraAlvo(prep: PreparadoMes):
  | { ok: true; alvo: number; criterio: "piso" | "equilibrio"; limitante: Id | null }
  | { ok: false; motivo: string } {
  let alvo = 0;
  let criterio: "piso" | "equilibrio" = "equilibrio";
  let limitante: Id | null = null;
  for (const s of prep.socios) {
    const horas = prep.horasPorPessoa.get(s.pessoa.id) ?? 0;
    const piso = s.pessoa.pisoHoraCentavos;
    if (horas <= 0 || !positivo(piso)) continue;
    const fatia = (1 - prep.reinvPct / 100) * (v0(s.pct) / 100);
    if (fatia <= 0)
      return {
        ok: false,
        motivo: `${s.pessoa.nome} tem horas no projeto, mas a parte dele(a) na divisão é zero — nenhum valor atinge o piso.`,
      };
    const req = (piso * horas) / fatia;
    if (req > alvo) {
      alvo = req;
      criterio = "piso";
      limitante = s.pessoa.id;
    }
  }
  return { ok: true, alvo, criterio, limitante };
}

/** Menor receita bruta cuja sobra atinge `alvo`. Retorna null se impossível. */
export function resolverReceita(prep: PreparadoMes, alvo: number): number | null {
  const a = 1 - (prep.impostoPct + prep.taxaPct) / 100;
  if (a <= 0) return null;
  // a tarifa fixa de recebimento se comporta como custo fixo sempre que há receita
  const c = alvo + prep.custosProjeto + prep.taxaFixa;
  let R: number;
  const r = prep.rateio;
  if (!r.ativo) {
    R = c / a;
  } else if (r.regra === "igual") {
    R = (c + r.total / r.clientesNaBase) / a;
  } else if (r.somaOutros <= 0) {
    // único cliente na base: fica com todo o custo fixo
    R = (c + r.total) / a;
  } else if (c <= 0) {
    R = 0;
  } else {
    // a·R² + (a·B − F − c)·R − c·B = 0  → raiz positiva única
    const B = r.somaOutros;
    const bq = a * B - r.total - c;
    R = (-bq + Math.sqrt(bq * bq + 4 * a * c * B)) / (2 * a);
  }
  R = Math.max(0, Math.ceil(R - 1e-9));
  // garante que a conta direta confirma (arredondamentos)
  for (let i = 0; i < 5; i++) {
    const s = calcularComReceita(prep, R - prep.receitaTrafego).sobraCentavos;
    if (s >= alvo - EPS || R - prep.receitaTrafego < 0) break;
    R += 1;
  }
  return R;
}

export function calcularMinimo(prep: PreparadoMes): ResultadoMinimo {
  const vazio = (motivo: string): ResultadoMinimo => ({
    possivel: false,
    motivo,
    criterio: "equilibrio",
    receitaMinimaCentavos: null,
    mensalidadeMinimaCentavos: null,
    limitantePessoaId: null,
    resultado: null,
  });
  if (!prep.percentuaisValidos) return vazio("Corrija os percentuais indicados nos alertas para calcular o valor mínimo.");
  const alvo = sobraAlvo(prep);
  if (!alvo.ok) return vazio(alvo.motivo);
  const R = resolverReceita(prep, alvo.alvo);
  if (R == null) return vazio("Imposto + taxa de recebimento somam 100% ou mais: nenhum valor cobre os custos.");
  const mensalidade = Math.max(0, R - prep.receitaTrafego);
  const resultado = calcularComReceita(prep, mensalidade);
  return {
    possivel: true,
    motivo: null,
    criterio: alvo.criterio,
    receitaMinimaCentavos: resultado.receitaBrutaCentavos,
    mensalidadeMinimaCentavos: mensalidade,
    limitantePessoaId: alvo.limitante,
    resultado,
  };
}

// ─── Horizonte com meses sem cobrança ───────────────────────────────────────

export function calcularHorizonte(
  prep: PreparadoMes,
  cenario: Cenario,
  mensalidade: number | null,
): { horizonte: ResultadoHorizonte | null; alertas: Alerta[] } {
  const alertas: Alerta[] = [];
  const N = v0(cenario.mesesSemCobranca);
  const M = cenario.horizonteMeses;
  if (!positivo(M)) {
    if (N > 0)
      alertas.push({ nivel: "aviso", texto: "Informe o horizonte da simulação (em meses) para ver o efeito dos meses sem cobrança." });
    return { horizonte: null, alertas };
  }
  if (N > M) {
    alertas.push({ nivel: "erro", texto: "Os meses sem cobrança passam do horizonte da simulação." });
    return { horizonte: null, alertas };
  }
  const alvo = prep.percentuaisValidos ? sobraAlvo(prep) : null;
  const pagante = mensalidade != null ? calcularComReceita(prep, mensalidade) : null;

  const variante = (suspensao: SuspensaoSemCobranca): VarianteHorizonte => {
    // A: não paga nada. B: não paga a mensalidade, mas paga a gestão de tráfego.
    const gratis = calcularComReceita(prep, 0, { semTrafego: suspensao === "tudo" });

    let necessaria: number | null = null;
    if (N < M && alvo?.ok) {
      const alvoPagante = (M * alvo.alvo - N * gratis.sobraCentavos) / (M - N);
      const R = resolverReceita(prep, alvoPagante);
      if (R != null) necessaria = Math.max(0, R - prep.receitaTrafego);
    }

    const sobraTotal = pagante ? (M - N) * pagante.sobraCentavos + N * gratis.sobraCentavos : 0;
    const reinv = sobraTotal > 0 ? (sobraTotal * prep.reinvPct) / 100 : 0;
    const distribuivel = sobraTotal - reinv;

    const pessoas = prep.socios.map((s) => {
      const horasTot = (prep.horasPorPessoa.get(s.pessoa.id) ?? 0) * M;
      const valor = pagante && prep.percentuaisValidos && s.pct != null ? (distribuivel * s.pct) / 100 : null;
      const vh = valor != null && horasTot > 0 ? valor / horasTot : null;
      const piso = positivo(s.pessoa.pisoHoraCentavos) ? s.pessoa.pisoHoraCentavos : null;
      return {
        id: s.pessoa.id,
        nome: s.pessoa.nome,
        valorTotalCentavos: valor,
        valorHoraMedioCentavos: vh,
        abaixoPiso: piso != null && vh != null && vh < piso - EPS,
      };
    });

    return {
      suspensao,
      receitaTotalCentavos: pagante ? (M - N) * pagante.receitaBrutaCentavos + N * gratis.receitaBrutaCentavos : 0,
      sobraTotalCentavos: sobraTotal,
      pessoas,
      mensalidadeNecessariaCentavos: necessaria,
    };
  };

  const escolhida = cenario.suspensaoSemCobranca ?? null;
  if (N > 0 && escolhida == null)
    alertas.push({
      nivel: "aviso",
      texto: "Escolha o que fica suspenso nos meses sem cobrança (nada é pago, ou só a mensalidade). As duas opções aparecem lado a lado.",
    });

  return {
    horizonte: {
      meses: M,
      semCobranca: N,
      opcoes: { tudo: variante("tudo"), mensalidade: variante("mensalidade") },
      escolhida,
      opcoesIguais: prep.receitaTrafego === 0,
    },
    alertas,
  };
}

// ─── Encaixe (modo valor): quantas entregas cabem ───────────────────────────

/** Devolve uma cópia do cenário com `delta` unidades a mais (ou a menos) de um tipo. */
export function ajustarQuantidade(cenario: Cenario, tipoId: Id, delta: number): Cenario {
  const entregas = cenario.entregas.map((l) => ({ ...l }));
  if (delta >= 0) {
    const l = entregas.find((e) => e.tipoEntregaId === tipoId);
    if (l) l.quantidade = v0(l.quantidade) + delta;
    else entregas.push({ id: `tmp-${tipoId}`, tipoEntregaId: tipoId, quantidade: delta, horasPorUnidade: null });
  } else {
    let resto = -delta;
    for (const l of entregas) {
      if (l.tipoEntregaId !== tipoId || resto <= 0) continue;
      const tira = Math.min(v0(l.quantidade), resto);
      l.quantidade = v0(l.quantidade) - tira;
      resto -= tira;
    }
  }
  return { ...cenario, entregas };
}

/** Lista o que está estourado: piso (preço) e/ou capacidade (gente), por sócio. */
function verificarCabe(r: ResultadoMes, socios: Set<Id>): { ok: boolean; limites: LimiteEncaixe[] } {
  const limites: LimiteEncaixe[] = [];
  for (const p of r.pessoas) {
    if (p.horas <= EPS) continue;
    if (socios.has(p.id) && p.pisoHoraCentavos != null && (p.valorHoraCentavos == null || p.valorHoraCentavos < p.pisoHoraCentavos - EPS))
      limites.push({ tipo: "piso", pessoaId: p.id, nome: p.nome });
    if (p.capacidadeHorasMes != null && p.horas > p.capacidadeHorasMes + EPS) limites.push({ tipo: "capacidade", pessoaId: p.id, nome: p.nome });
  }
  return { ok: limites.length === 0, limites };
}

const MAX_ENCAIXE = 9999;

export function calcularEncaixe(config: Configuracao, cenario: Cenario, base: ResultadoMes): Encaixe {
  const socios = new Set(config.pessoas.filter((p) => p.ativo && p.socio).map((p) => p.id));
  const temLimite = config.pessoas.some((p) => p.ativo && (positivo(p.pisoHoraCentavos) || positivo(p.capacidadeHorasMes)));
  const pessoas = base.pessoas.map((p) => ({
    id: p.id,
    nome: p.nome,
    horas: p.horas,
    horasPagasNoPiso:
      p.valorCentavos != null && p.pisoHoraCentavos != null ? Math.max(0, p.valorCentavos) / p.pisoHoraCentavos : null,
    capacidadeHorasMes: p.capacidadeHorasMes,
  }));
  const qtds = quantidadesPorTipo(cenario.entregas);
  const tiposBase = config.tiposEntrega.filter((t) => t.ativo || qtds.has(t.id));

  if (!base.percentuaisValidos || !temLimite) {
    return {
      disponivel: false,
      motivo: !base.percentuaisValidos
        ? "Corrija os percentuais para ver quanto cabe."
        : "Configure o piso por hora ou a capacidade dos sócios para ver quantas entregas cabem.",
      cabe: true,
      limitantes: [],
      tipos: tiposBase.map((t) => ({
        tipoEntregaId: t.id,
        nome: t.nome,
        quantidade: qtds.get(t.id) ?? 0,
        horasPorUnidade: t.horasPorUnidade,
        folga: null,
        limites: [],
        naoResolve: false,
      })),
      pessoas,
    };
  }

  const mensalidade = base.receitaMensalidadeCentavos;
  const teste = (c: Cenario) => verificarCabe(calcularComReceita(prepararMes(config, c), mensalidade), socios);
  const atual = verificarCabe(base, socios);

  const tipos: EncaixeTipo[] = tiposBase.map((t) => {
    const quantidade = qtds.get(t.id) ?? 0;
    const linha = cenario.entregas.find((l) => l.tipoEntregaId === t.id);
    const hUn = linha?.horasPorUnidade ?? t.horasPorUnidade;
    const item: EncaixeTipo = {
      tipoEntregaId: t.id,
      nome: t.nome,
      quantidade,
      horasPorUnidade: hUn,
      folga: null,
      limites: [],
      naoResolve: false,
    };
    if (atual.ok) {
      // se uma unidade a mais não muda nada (sem horas e sem custo), não há limite
      const um = teste(ajustarQuantidade(cenario, t.id, 1));
      if (um.ok) {
        const r1 = calcularComReceita(prepararMes(config, ajustarQuantidade(cenario, t.id, 1)), mensalidade);
        if (Math.abs(r1.horasTotais - base.horasTotais) < 1e-9 && Math.abs(r1.custosProjetoCentavos - base.custosProjetoCentavos) < EPS)
          return item;
      } else {
        item.folga = 0;
        item.limites = um.limites;
        return item;
      }
      let lo = 1;
      let hi = 2;
      while (hi <= MAX_ENCAIXE && teste(ajustarQuantidade(cenario, t.id, hi)).ok) {
        lo = hi;
        hi *= 2;
      }
      if (hi > MAX_ENCAIXE) {
        item.folga = MAX_ENCAIXE;
        return item;
      }
      while (hi - lo > 1) {
        const mid = Math.floor((lo + hi) / 2);
        if (teste(ajustarQuantidade(cenario, t.id, mid)).ok) lo = mid;
        else hi = mid;
      }
      item.folga = lo;
      item.limites = teste(ajustarQuantidade(cenario, t.id, lo + 1)).limites;
    } else {
      item.limites = atual.limites;
      const q = Math.floor(quantidade);
      if (q <= 0 || !teste(ajustarQuantidade(cenario, t.id, -q)).ok) {
        item.naoResolve = true;
        item.folga = q > 0 ? -q : null;
        return item;
      }
      let lo = 0; // não cabe
      let hi = q; // cabe
      while (hi - lo > 1) {
        const mid = Math.floor((lo + hi) / 2);
        if (teste(ajustarQuantidade(cenario, t.id, -mid)).ok) hi = mid;
        else lo = mid;
      }
      item.folga = -hi;
    }
    return item;
  });

  return { disponivel: true, motivo: null, cabe: atual.ok, limitantes: atual.limites, tipos, pessoas };
}

// ─── Audiovisual: entrega de vídeo exige custo de terceiro ──────────────────

function alertasAudiovisualBloco(config: Configuracao, entregas: LinhaEntrega[], custos: LinhaCusto[], prefixo: string): Alerta[] {
  const out: Alerta[] = [];
  const temFixo = custos.some((c) => c.categoria === "audiovisual" && c.forma === "fixo" && v0(c.valorCentavos) > 0);
  for (const [tipoId, qtd] of quantidadesPorTipo(entregas)) {
    const tipo = config.tiposEntrega.find((t) => t.id === tipoId);
    if (!tipo?.audiovisual || qtd <= 0) continue;
    const temPorEntrega = custos.some(
      (c) => c.categoria === "audiovisual" && c.forma === "por_entrega" && c.tipoEntregaId === tipoId && v0(c.valorCentavos) > 0,
    );
    if (!temFixo && !temPorEntrega)
      out.push({
        nivel: "erro",
        texto: `${prefixo}"${tipo.nome}" é entrega de vídeo, mas não há custo de audiovisual preenchido. Audiovisual é sempre terceiro pago pela empresa: informe o custo (fixo ou por entrega).`,
      });
  }
  return out;
}

export function verificarAudiovisual(config: Configuracao, cenario: Cenario): Alerta[] {
  const out = alertasAudiovisualBloco(config, cenario.entregas, cenario.custos, "");
  for (const p of cenario.pontuais) out.push(...alertasAudiovisualBloco(config, p.entregas, p.custos, `${p.nome || "Projeto pontual"}: `));
  if (cenario.entrada) out.push(...alertasAudiovisualBloco(config, cenario.entrada.entregas, cenario.entrada.custos, "Entrada: "));
  return out;
}

// ─── Entrada de cliente novo (uma vez só) ───────────────────────────────────
//
// custo da entrada = custos em dinheiro + horas dos sócios × piso de cada um
//                    − valor cobrado pela entrada (sem imposto e taxa)
// folga da rotina  = sobra do mês − sobra necessária para todos chegarem ao piso
// meses p/ pagar   = custo da entrada ÷ folga da rotina

export function calcularEntrada(
  config: Configuracao,
  cenario: Cenario,
  prep: PreparadoMes,
  mesRotina: ResultadoMes | null,
): { entrada: ResultadoEntrada | null; alertas: Alerta[] } {
  const e = cenario.entrada;
  const alertas: Alerta[] = [];
  if (!e) return { entrada: null, alertas };
  const temAlgo =
    e.entregas.some((l) => v0(l.quantidade) > 0) || e.custos.some((c) => v0(c.valorCentavos) > 0) || v0(e.valorCobradoCentavos) > 0;
  if (!temAlgo) return { entrada: null, alertas };

  const pseudo: Cenario = { ...cenario, entregas: e.entregas, custos: e.custos, pontuais: [], clienteId: null };
  const pe = prepararMes(config, pseudo, { semRateio: true, semCapacidade: true, ignorarPontuais: true });
  // só os alertas próprios da entrada (os de percentual já aparecem pela rotina)
  for (const a of pe.alertas)
    if (a.nivel !== "info" && !prep.alertas.some((x) => x.texto === a.texto)) alertas.push({ ...a, texto: `Entrada: ${a.texto}` });

  const cobrado = v0(e.valorCobradoCentavos);
  const liquido = cobrado * (1 - (pe.impostoPct + pe.taxaPct) / 100);

  let horasNoPiso = 0;
  const pessoas = config.pessoas
    .filter((p) => p.ativo)
    .map((p) => {
      const horas = pe.horasPorPessoa.get(p.id) ?? 0;
      const piso = positivo(p.pisoHoraCentavos) ? p.pisoHoraCentavos : null;
      const valor = piso != null ? horas * piso : null;
      if (valor != null) horasNoPiso += valor;
      if (horas > 0 && piso == null)
        alertas.push({ nivel: "aviso", texto: `Entrada: as horas de ${p.nome} não foram valorizadas porque ele(a) não tem piso por hora configurado.` });
      const horasPrimeiroMes = (prep.horasPorPessoa.get(p.id) ?? 0) + horas;
      const cap = positivo(p.capacidadeHorasMes) ? p.capacidadeHorasMes : null;
      const consumo = cap != null ? (horasPrimeiroMes / cap) * 100 : null;
      if (consumo != null && consumo > 100 + EPS)
        alertas.push({
          nivel: "aviso",
          texto: `No 1º mês (rotina + entrada), ${p.nome} usa ${formatarPct(consumo)} das horas do mês.`,
        });
      return { id: p.id, nome: p.nome, horas, valorHorasNoPisoCentavos: valor, horasPrimeiroMes, consumoPrimeiroMesPct: consumo };
    });

  const custo = pe.custosProjeto + horasNoPiso - liquido;

  let folga: number | null = null;
  let mensalidadeParaPagar: number | null = null;
  const alvo = prep.percentuaisValidos ? sobraAlvo(prep) : null;
  if (alvo?.ok) {
    if (mesRotina) folga = mesRotina.sobraCentavos - alvo.alvo;
    if (positivo(e.mesesParaPagar) && custo > 0) {
      const R = resolverReceita(prep, alvo.alvo + custo / e.mesesParaPagar);
      if (R != null) mensalidadeParaPagar = Math.max(0, R - prep.receitaTrafego);
    }
  }
  // folga de até 1 centavo é só arredondamento do valor mínimo: conta como zero
  const meses = custo <= 0 ? 0 : folga != null && folga > 1 ? custo / folga : null;
  if (custo > 0 && mesRotina && meses == null)
    alertas.push({
      nivel: "aviso",
      texto:
        "A entrada não se paga com a rotina: neste valor, a rotina paga só o piso (ou menos). Cobre a entrada à parte ou suba a mensalidade.",
    });

  return {
    entrada: {
      horasTotais: pe.horasTotais,
      pessoas,
      custosDinheiroCentavos: pe.custosProjeto,
      horasNoPisoCentavos: horasNoPiso,
      cobradoLiquidoCentavos: liquido,
      custoEntradaCentavos: custo,
      folgaMensalRotinaCentavos: folga,
      mesesParaSePagar: meses,
      mensalidadeParaPagarCentavos: mensalidadeParaPagar,
    },
    alertas,
  };
}

// ─── Teto do regime (ex.: MEI) ──────────────────────────────────────────────

/**
 * Projeção anual de faturamento: (valor mensal dos outros clientes ativos + a receita
 * deste cenário) × 12, contra o teto configurado. Sem teto configurado → null.
 */
export function calcularTeto(config: Configuracao, clienteId: Id | null, receitaMensal: number | null): ProjecaoTeto | null {
  const teto = config.empresa.tetoFaturamentoAnualCentavos;
  if (!positivo(teto)) return null;
  const outros = config.clientes
    .filter((c) => c.ativo && c.id !== clienteId)
    .reduce((a, c) => a + v0(c.valorMensalCentavos), 0);
  const anual = (outros + v0(receitaMensal)) * 12;
  const pct = (anual / teto) * 100;
  const aviso = config.empresa.avisoTetoPct;
  const nivel = pct > 100 + EPS ? "estourou" : aviso != null && pct >= aviso ? "perto" : "ok";
  return { tetoCentavos: teto, anualCentavos: anual, pct, nivel };
}

// ─── Valor único para o cliente ─────────────────────────────────────────────

/** Um valor só: mensalidade + gestão de tráfego, com rateio embutido. Arredonda para cima se configurado. */
export function calcularProposta(config: Configuracao, mes: ResultadoMes | null, modo: Cenario["modo"]): PropostaCliente | null {
  if (!mes) return null;
  let valor = mes.receitaBrutaCentavos;
  const passo = config.empresa.arredondamentoPropostaCentavos;
  let arredondado = false;
  if (modo === "escopo" && positivo(passo)) {
    const up = Math.ceil(valor / passo - 1e-9) * passo;
    arredondado = up !== valor;
    valor = up;
  }
  return {
    valorCentavos: valor,
    arredondado,
    incluiTrafego: mes.receitaTrafegoCentavos > 0,
    verbaMidiaCentavos: mes.verbaMidiaCentavos,
  };
}

// ─── Cenário completo ───────────────────────────────────────────────────────

function calcularPontuaisFora(config: Configuracao, cenario: Cenario): ResultadoPontualFora[] {
  return cenario.pontuais
    .filter((p) => p.forma === "fora")
    .map((p) => {
      const pseudo: Cenario = {
        ...cenario,
        entregas: p.entregas,
        custos: p.custos,
        pontuais: [],
        clienteId: null,
      };
      const prep = prepararMes(config, pseudo, { semRateio: true, semCapacidade: true, ignorarPontuais: true });
      const minimo = calcularMinimo(prep);
      const resultado =
        cenario.modo === "valor" && p.valorCobradoCentavos != null ? calcularComReceita(prep, p.valorCobradoCentavos) : null;
      return {
        id: p.id,
        nome: p.nome || "Projeto pontual",
        horasTotais: prep.horasTotais,
        custosCentavos: prep.custosProjeto,
        minimo,
        resultado,
      };
    });
}

function unicos(alertas: Alerta[]): Alerta[] {
  const vistos = new Set<string>();
  const ordem = { erro: 0, aviso: 1, info: 2 } as const;
  return alertas
    .filter((a) => (vistos.has(a.texto) ? false : (vistos.add(a.texto), true)))
    .sort((a, b) => ordem[a.nivel] - ordem[b.nivel]);
}

export function calcularCenario(config: Configuracao, cenario: Cenario): ResultadoCenario {
  const prep = prepararMes(config, cenario);
  const minimo = calcularMinimo(prep);
  const pontuaisFora = calcularPontuaisFora(config, cenario);

  let mes: ResultadoMes | null;
  let encaixe: Encaixe | null = null;
  const alertas: Alerta[] = [];

  if (cenario.modo === "escopo") {
    mes = minimo.resultado;
    if (!mes) alertas.push(...prep.alertas);
    if (!minimo.possivel && minimo.motivo) alertas.push({ nivel: "erro", texto: minimo.motivo });
  } else {
    if (cenario.mensalidadeCentavos == null) {
      mes = null;
      alertas.push(...prep.alertas, { nivel: "info", texto: "Informe o valor mensal que o cliente vai pagar." });
    } else {
      mes = calcularComReceita(prep, cenario.mensalidadeCentavos);
      encaixe = calcularEncaixe(config, cenario, mes);
    }
  }
  if (mes) alertas.push(...mes.alertas);

  alertas.push(...verificarAudiovisual(config, cenario));
  const ent = calcularEntrada(config, cenario, prep, mes);
  alertas.push(...ent.alertas);

  const mensalidadeHorizonte = cenario.modo === "escopo" ? minimo.mensalidadeMinimaCentavos : cenario.mensalidadeCentavos;
  const hz = calcularHorizonte(prep, cenario, mensalidadeHorizonte);
  alertas.push(...hz.alertas);
  if (hz.horizonte?.escolhida) {
    for (const p of hz.horizonte.opcoes[hz.horizonte.escolhida].pessoas)
      if (p.abaixoPiso)
        alertas.push({
          nivel: "erro",
          texto: `No horizonte de ${hz.horizonte.meses} meses, ${p.nome} fica com média de ${formatarMoeda(p.valorHoraMedioCentavos)}/h, abaixo do piso.`,
        });
  }

  for (const pf of pontuaisFora) {
    if (pf.resultado) for (const a of pf.resultado.alertas) if (a.nivel === "erro") alertas.push({ ...a, texto: `${pf.nome}: ${a.texto}` });
  }

  const teto = calcularTeto(config, cenario.clienteId, mes ? mes.receitaBrutaCentavos : null);
  if (teto?.nivel === "estourou")
    alertas.push({
      nivel: "erro",
      texto: `Com este cliente, o faturamento projetado do ano (${formatarMoeda(teto.anualCentavos)}) passa do teto de ${formatarMoeda(teto.tetoCentavos)}. Estourar o teto muda o regime da empresa.`,
    });
  else if (teto?.nivel === "perto")
    alertas.push({
      nivel: "aviso",
      texto: `Com este cliente, o faturamento projetado do ano chega a ${formatarPct(teto.pct)} do teto (${formatarMoeda(teto.tetoCentavos)}).`,
    });

  return {
    modo: cenario.modo,
    entrada: ent.entrada,
    teto,
    proposta: calcularProposta(config, mes, cenario.modo),
    mes,
    minimo,
    encaixe,
    horizonte: hz.horizonte,
    pontuaisFora,
    alertas: unicos(alertas),
  };
}
