// Tipos do domínio da calculadora.
//
// Convenções:
// - Dinheiro sempre em CENTAVOS (number inteiro). `null` = campo vazio.
// - Percentuais de 0 a 100. `null` = campo vazio.
// - Nenhum valor padrão de negócio mora no código: tudo vem da configuração
//   (tabelas do Supabase) ou do que a pessoa digita no cenário.

export type Id = string;
export type Centavos = number | null;
export type Pct = number | null;

// ─── Configuração da empresa ────────────────────────────────────────────────

export interface Pessoa {
  id: Id;
  nome: string;
  socio: boolean;
  /** % padrão da parte distribuível que vai pra essa pessoa */
  percentualPadrao: Pct;
  /** piso de valor por hora, em centavos */
  pisoHoraCentavos: Centavos;
  /** horas disponíveis de produção por mês */
  capacidadeHorasMes: number | null;
  ativo: boolean;
  /** login ligado a este sócio (para aprovar o que o afeta) */
  membroId?: string | null;
}

export interface Servico {
  id: Id;
  nome: string;
  /** divisão padrão das horas do serviço entre pessoas, em % (pessoaId → %) */
  divisaoPadrao: Record<Id, number | null>;
  ativo: boolean;
}

export interface TipoEntrega {
  id: Id;
  nome: string;
  servicoId: Id | null;
  horasPorUnidade: number | null;
  /**
   * Entrega de vídeo produzida por terceiro (edição, motion, legendagem, corte).
   * Nunca gera horas dos sócios: é sempre custo de audiovisual. Roteiro e
   * direção são tipos normais, com horas.
   */
  audiovisual?: boolean;
  ativo: boolean;
  /** medições do cronômetro antes desta data não contam (recalibrar quando o processo muda) */
  calibrarDesde?: string | null;
}

export interface CustoFixo {
  id: Id;
  nome: string;
  valorMensalCentavos: Centavos;
  ativo: boolean;
}

/** Cliente ativo usado como base do rateio de custo fixo. */
export interface ClienteBase {
  id: Id;
  nome: string;
  interno: boolean;
  participaRateio: boolean;
  /** valor mensal do contrato vigente */
  valorMensalCentavos: Centavos;
  ativo: boolean;
  /** escopo contratado (cenário da calculadora) — base da visão do mês e da saúde do cliente */
  escopo?: Cenario | null;
}

export type RegraRateio = "igual" | "proporcional";

/** MEI: imposto fixo por mês (o campo de imposto em % some). Outro: imposto em % do faturamento. */
export type Regime = "mei" | "outro";

/**
 * Como cada pagamento que cai é distribuído:
 * - custo_primeiro: primeiro cobre os custos do mês (projeto + parte do custo fixo); o resto vira sobra
 * - proporcional: cada real é dividido na mesma proporção do mês completo
 */
export type OrdemDistribuicao = "custo_primeiro" | "proporcional";

export interface ConfigEmpresa {
  /** regime do CNPJ; null = não informado (usa os dois campos de imposto) */
  regime?: Regime | null;
  reinvestimentoPct: Pct;
  impostoPct: Pct;
  taxaRecebimentoPct: Pct;
  regraRateio: RegraRateio | null;
  /** imposto de valor fixo por mês (ex.: MEI). Entra no rateio como custo da empresa */
  impostoFixoMensalCentavos?: Centavos;
  /** taxa fixa por recebimento (ex.: tarifa da maquininha/banco), além do % */
  taxaRecebimentoFixaCentavos?: Centavos;
  /** teto anual de faturamento do regime (ex.: MEI) */
  tetoFaturamentoAnualCentavos?: Centavos;
  /** avisar quando a projeção anual passar deste % do teto */
  avisoTetoPct?: Pct;
  /** sócio com uso abaixo deste % da capacidade aparece como "com folga sobrando" */
  ociosidadePct?: Pct;
  /** arredondar o valor da proposta para cima, em múltiplos deste valor */
  arredondamentoPropostaCentavos?: Centavos;
  /** ordem de distribuição dos pagamentos; vazio bloqueia a distribuição */
  ordemDistribuicao?: OrdemDistribuicao | null;
  /** quantas medições de cronômetro cada tipo de entrega precisa para ficar calibrado */
  medicoesCalibragem?: number | null;
  /** sugerir atualizar o padrão quando a média medida diferir mais que este %; vazio = qualquer diferença */
  diferencaSugerirPct?: Pct;
}

export interface Configuracao {
  empresa: ConfigEmpresa;
  pessoas: Pessoa[];
  servicos: Servico[];
  tiposEntrega: TipoEntrega[];
  custosFixos: CustoFixo[];
  clientes: ClienteBase[];
}

// ─── Cenário ────────────────────────────────────────────────────────────────

export type Modo = "escopo" | "valor";

export interface LinhaEntrega {
  id: Id;
  tipoEntregaId: Id | null;
  quantidade: number | null;
  /** sobrepõe a hora por unidade configurada no tipo. null = usa o padrão */
  horasPorUnidade: number | null;
}

export type CategoriaCusto = "ferramenta" | "audiovisual" | "terceiro" | "outro";
export type FormaCusto = "fixo" | "por_entrega";

export interface LinhaCusto {
  id: Id;
  categoria: CategoriaCusto;
  descricao: string;
  /** ferramenta é sempre fixo mensal */
  forma: FormaCusto;
  /** fixo: valor do mês (ou do projeto, no pontual). por_entrega: valor unitário */
  valorCentavos: Centavos;
  /** por_entrega: tipo de entrega cuja quantidade multiplica o valor */
  tipoEntregaId: Id | null;
}

export type ModeloTrafego =
  | "fixo"
  | "por_campanha"
  | "percentual_verba"
  | "incluido"
  | "sem_trafego";

export interface CobrancaTrafego {
  modelo: ModeloTrafego | null;
  valorFixoCentavos: Centavos;
  valorPorCampanhaCentavos: Centavos;
  campanhas: number | null;
  percentualVerba: Pct;
  /**
   * Verba de mídia do cliente. Paga pelo cliente direto na plataforma: NUNCA é
   * faturamento da Aden, não entra em imposto, taxa nem receita. Campo
   * informativo; o único uso em conta é como base do modelo "percentual da
   * verba" (e aí o que fatura é só a gestão).
   */
  verbaMensalCentavos: Centavos;
}

/** O que fica suspenso nos meses sem cobrança. */
export type SuspensaoSemCobranca =
  /** opção A: o cliente não paga nada */
  | "tudo"
  /** opção B: não paga a mensalidade, mas paga a gestão de tráfego */
  | "mensalidade";

export type FormaPontual = "diluido" | "fora";

export interface ProjetoPontual {
  id: Id;
  nome: string;
  forma: FormaPontual | null;
  /** diluído: em quantos meses */
  meses: number | null;
  entregas: LinhaEntrega[];
  custos: LinhaCusto[];
  /** fora da mensalidade, modo valor: quanto será cobrado pelo projeto */
  valorCobradoCentavos: Centavos;
}

/** O que acontece uma vez só quando o cliente entra (onboarding, enxoval, primeiras peças). */
export interface EntradaCliente {
  entregas: LinhaEntrega[];
  custos: LinhaCusto[];
  /** opcional: se a entrada for cobrada à parte */
  valorCobradoCentavos: Centavos;
  /** opcional: em quantos meses a entrada deve se pagar (modo escopo calcula a mensalidade para isso) */
  mesesParaPagar: number | null;
}

export interface Sobreposicoes {
  /** null = usa o padrão da empresa */
  reinvestimentoPct: Pct;
  impostoPct: Pct;
  taxaRecebimentoPct: Pct;
  /** pessoaId → % (ausente = padrão) */
  percentualPessoa: Record<Id, number | null>;
  /** servicoId → (pessoaId → %) (ausente = padrão do serviço) */
  divisaoServico: Record<Id, Record<Id, number | null>>;
}

export interface Cenario {
  id: Id;
  nome: string;
  modo: Modo;
  /** cliente já ativo que este cenário substitui na base de rateio */
  clienteId: Id | null;
  /** modo valor: mensalidade informada */
  mensalidadeCentavos: Centavos;
  entregas: LinhaEntrega[];
  custos: LinhaCusto[];
  trafego: CobrancaTrafego;
  pontuais: ProjetoPontual[];
  /** entrada de cliente novo: acontece uma vez só, separada da rotina mensal */
  entrada?: EntradaCliente;
  mesesSemCobranca: number | null;
  /** qual opção vale para este cenário; as duas são sempre calculadas para comparar */
  suspensaoSemCobranca?: SuspensaoSemCobranca | null;
  horizonteMeses: number | null;
  sobreposicoes: Sobreposicoes;
}

// ─── Resultado ──────────────────────────────────────────────────────────────

/**
 * erro: o resultado está errado ou bloqueado. aviso: atenção, o número pode enganar.
 * lembrete: campo opcional vazio (considerado zero). info: observação.
 */
export type NivelAlerta = "erro" | "aviso" | "lembrete" | "info";

export type SecaoConfig = "socios" | "servicos" | "tipos" | "custos" | "regras" | "limites" | "clientes";

/** Onde se resolve o alerta: um campo das configurações ou um bloco do cenário. */
export type DestinoAlerta = { tipo: "config"; secao: SecaoConfig; campo?: string } | { tipo: "cenario"; bloco: string };

export interface Alerta {
  nivel: NivelAlerta;
  texto: string;
  acao?: { rotulo: string; destino: DestinoAlerta };
}

export interface ResultadoPessoa {
  id: Id;
  nome: string;
  percentual: number | null;
  percentualSobreposto: boolean;
  horas: number;
  valorCentavos: number | null;
  valorHoraCentavos: number | null;
  pisoHoraCentavos: number | null;
  abaixoPiso: boolean;
  capacidadeHorasMes: number | null;
  consumoCapacidadePct: number | null;
  /** recebe parte da sobra sem ter horas neste cliente (a regra é dos sócios; aqui só fica visível) */
  recebeSemHoras: boolean;
}

export interface ResultadoServico {
  servicoId: Id | null;
  nome: string;
  horas: number;
  divisao: Record<Id, number>;
  divisaoSobreposta: boolean;
}

export interface ResultadoMes {
  receitaMensalidadeCentavos: number;
  receitaTrafegoCentavos: number;
  receitaBrutaCentavos: number;
  /** informativo: verba de mídia do cliente, fora do caixa e de qualquer soma */
  verbaMidiaCentavos: number | null;
  impostoPct: number;
  impostoPctSobreposto: boolean;
  impostosCentavos: number;
  taxaRecebimentoPct: number;
  taxaRecebimentoPctSobreposta: boolean;
  taxasCentavos: number;
  custosPorCategoria: Record<CategoriaCusto, number>;
  custoPontualDiluidoCentavos: number;
  custosProjetoCentavos: number;
  rateio: {
    regra: RegraRateio | null;
    totalFixoCentavos: number;
    /** clientes na divisão, contando este cenário (cliente novo soma 1) */
    clientesNaBase: number;
    /** outros clientes ativos que entram no rateio */
    outrosClientes: number;
    quotaCentavos: number;
    /** parte do total que é imposto fixo mensal (MEI) */
    impostoFixoCentavos: number;
    /** uma frase explicando a divisão deste mês */
    explicacao: string;
  };
  sobraCentavos: number;
  reinvestimentoPct: number;
  reinvestimentoPctSobreposto: boolean;
  reinvestimentoCentavos: number;
  distribuivelCentavos: number;
  horasTotais: number;
  servicos: ResultadoServico[];
  pessoas: ResultadoPessoa[];
  /** (custos do projeto + custo fixo rateado) ÷ horas */
  custoHoraCentavos: number | null;
  /** receita bruta ÷ horas */
  valorCobradoHoraCentavos: number | null;
  /** sobra ÷ horas (informativo) */
  sobraHoraCentavos: number | null;
  percentuaisValidos: boolean;
  alertas: Alerta[];
}

export interface ResultadoMinimo {
  possivel: boolean;
  motivo: string | null;
  criterio: "piso" | "equilibrio";
  receitaMinimaCentavos: number | null;
  mensalidadeMinimaCentavos: number | null;
  /** pessoa cujo piso define o mínimo */
  limitantePessoaId: Id | null;
  resultado: ResultadoMes | null;
}

/** O que impede de caber mais: piso é preço, capacidade é gente. */
export interface LimiteEncaixe {
  tipo: "piso" | "capacidade";
  pessoaId: Id;
  nome: string;
}

export interface EncaixeTipo {
  tipoEntregaId: Id;
  nome: string;
  quantidade: number;
  horasPorUnidade: number | null;
  /** positivo: quantas unidades a mais cabem; negativo: quantas precisa tirar */
  folga: number | null;
  /** o que trava: na folga positiva, o que impede a próxima unidade; na negativa, o que está estourado */
  limites: LimiteEncaixe[];
  /** true quando nem zerando este tipo o cenário volta a caber */
  naoResolve: boolean;
}

export interface Encaixe {
  disponivel: boolean;
  motivo: string | null;
  cabe: boolean;
  /** quando não cabe: quem e o que está estourado agora */
  limitantes: LimiteEncaixe[];
  tipos: EncaixeTipo[];
  pessoas: {
    id: Id;
    nome: string;
    horas: number;
    /** horas que o valor recebido paga no piso */
    horasPagasNoPiso: number | null;
    capacidadeHorasMes: number | null;
  }[];
}

export interface VarianteHorizonte {
  suspensao: SuspensaoSemCobranca;
  receitaTotalCentavos: number;
  sobraTotalCentavos: number;
  pessoas: { id: Id; nome: string; valorTotalCentavos: number | null; valorHoraMedioCentavos: number | null; abaixoPiso: boolean }[];
  /** mensalidade necessária nos meses pagantes para compensar os meses sem cobrança */
  mensalidadeNecessariaCentavos: number | null;
}

export interface ResultadoHorizonte {
  meses: number;
  semCobranca: number;
  /** as duas opções, sempre calculadas para comparação */
  opcoes: Record<SuspensaoSemCobranca, VarianteHorizonte>;
  /** a que vale para este cenário (null = ainda não escolhida) */
  escolhida: SuspensaoSemCobranca | null;
  /** sem cobrança de tráfego, A e B dão o mesmo resultado */
  opcoesIguais: boolean;
}

export interface ResultadoPontualFora {
  id: Id;
  nome: string;
  horasTotais: number;
  custosCentavos: number;
  minimo: ResultadoMinimo;
  /** só no modo valor, com valor cobrado informado */
  resultado: ResultadoMes | null;
}

export interface ResultadoEntrada {
  horasTotais: number;
  pessoas: {
    id: Id;
    nome: string;
    horas: number;
    /** horas × piso do sócio (null se o sócio não tem piso) */
    valorHorasNoPisoCentavos: number | null;
    /** 1º mês = rotina + entrada */
    horasPrimeiroMes: number;
    consumoPrimeiroMesPct: number | null;
  }[];
  /** terceiros, audiovisual, ferramentas da entrada */
  custosDinheiroCentavos: number;
  /** horas dos sócios valorizadas pelo piso de cada um */
  horasNoPisoCentavos: number;
  /** valor cobrado pela entrada, já sem imposto e taxa */
  cobradoLiquidoCentavos: number;
  /** custos em dinheiro + horas no piso − cobrado líquido */
  custoEntradaCentavos: number;
  /** quanto a rotina gera por mês acima do piso de todos (o que sobra pra pagar a entrada) */
  folgaMensalRotinaCentavos: number | null;
  /** meses para a folga da rotina pagar a entrada; null = não se paga com a rotina */
  mesesParaSePagar: number | null;
  /** escopo, com meses definidos: mensalidade para a entrada se pagar nesse prazo */
  mensalidadeParaPagarCentavos: number | null;
}

export interface ResultadoCenario {
  modo: Modo;
  /** algo impede o cálculo (ex.: regra de rateio vazia): nenhum número é mostrado */
  bloqueio: Alerta | null;
  /** null quando o cenário não tem entrada */
  entrada: ResultadoEntrada | null;
  /** projeção anual contra o teto do regime (null sem teto configurado) */
  teto: ProjecaoTeto | null;
  /** o valor único que vai para o cliente */
  proposta: PropostaCliente | null;
  /** o mês como calculado: no escopo, no valor mínimo; no valor, no valor informado */
  mes: ResultadoMes | null;
  minimo: ResultadoMinimo;
  encaixe: Encaixe | null;
  horizonte: ResultadoHorizonte | null;
  pontuaisFora: ResultadoPontualFora[];
  alertas: Alerta[];
}

export interface ProjecaoTeto {
  tetoCentavos: number;
  /** soma dos valores mensais dos clientes ativos (com este cenário) × 12 */
  anualCentavos: number;
  pct: number;
  nivel: "ok" | "perto" | "estourou";
}

export interface PropostaCliente {
  /** valor mensal único apresentado ao cliente (mensalidade + gestão de tráfego), já com rateio embutido */
  valorCentavos: number;
  arredondado: boolean;
  incluiTrafego: boolean;
  /** verba de mídia informada (paga pelo cliente direto na plataforma) */
  verbaMidiaCentavos: number | null;
}
