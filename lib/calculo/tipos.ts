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
  /** endereço da foto de perfil (vazio = mostra a inicial) */
  fotoUrl?: string | null;
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
  /**
   * Entrega feita por um terceiro que cobra por saída (ex.: gravação). Cada unidade é uma
   * saída: custo = quantidade × (valor por saída + deslocamento). Custo só do cliente, nunca rateado.
   */
  terceiroId?: Id | null;
  /** como aparece no painel do cliente (ex.: "Post" para um criativo de tráfego estático); vazio = o nome */
  nomeCliente?: string | null;
}

/** Serviço terceirizado cobrado por saída (ex.: audiovisual: vai ao cliente, grava, edita e entrega). */
export interface Terceiro {
  id: Id;
  /** nome do serviço (ex.: Audiovisual); não precisa do nome da pessoa */
  nome: string;
  /** o que inclui (interno), ex.: gravação e edição */
  inclui: string;
  /** o que o cliente lê na negociação, ex.: "gravação e edição mensal inclusa". Nunca o valor. */
  fraseCliente: string;
  valorPorSaidaCentavos: Centavos;
  /** deslocamento médio estimado por saída (o escopo de cada cliente pode trocar pelo real) */
  deslocamentoMedioCentavos: Centavos;
  ativo: boolean;
}

/** Uma entrega do pacote: tipo e quantidade (null = a confirmar). */
export interface ItemPacote {
  tipoEntregaId: Id;
  quantidade: number | null;
}

/**
 * Pacote fechado para a negociação. Horas e preço nunca são digitados: saem do cálculo
 * (rotina → mensalidade mínima; entrada → valor do primeiro mês).
 */
export interface Pacote {
  id: Id;
  nome: string;
  /** descrição em linguagem de cliente */
  descricao: string;
  /** o que está incluso, em frases simples (o cliente não vê quantidades nem horas) */
  itensCliente: string[];
  /** manutenção mensal */
  rotina: ItemPacote[];
  /** primeiro mês (entrada: onboarding, enxoval, estrutura visual) */
  entrada: ItemPacote[];
  /** o pacote de referência para "cabem mais N clientes" */
  padrao: boolean;
  ativo: boolean;
}

export type CriterioMeta = "faturamento_mensal" | "clientes" | "recebido_socio" | "uso_capacidade";

/** Degrau da trilha de crescimento. Os sócios definem; o sistema nunca cadastra sozinho. */
export interface Meta {
  id: Id;
  nome: string;
  criterio: CriterioMeta | null;
  /** faturamento e recebido: centavos; clientes: quantidade; uso da capacidade: % */
  alvo: number | null;
  /** o que fazer ao chegar lá, em texto livre (ex.: "primeira terceirização") */
  acao: string;
  /** quando o degrau foi batido pela primeira vez */
  conquistadaEm: string | null;
}

export interface CustoFixo {
  id: Id;
  nome: string;
  valorMensalCentavos: Centavos;
  ativo: boolean;
  /**
   * Sócio que paga este custo do próprio bolso (registro, sem reembolso). Conta no preço
   * (calculadora) como qualquer custo; no mês visto de cima aparece em "bancado por" e
   * não sai do caixa da Aden. null = a Aden paga.
   */
  pagoPorPessoaId?: Id | null;
  /** custo guardado para quando o caixa permitir (fica desligado; avisa quando a sobra cobre) */
  planejado?: boolean;
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
  // ficha do cliente (tudo opcional, começa vazio)
  contato?: string;
  telefone?: string;
  email?: string;
  instagram?: string;
  segmento?: string;
  observacoes?: string;
  /** para o contrato: nome no documento (vazio = o nome), CPF/CNPJ e endereço */
  razaoSocial?: string;
  documento?: string;
  endereco?: string;
  /** "AAAA-MM-DD" */
  clienteDesde?: string | null;
  /** condições do contrato ativo */
  contrato?: DadosContrato | null;
  /** código do link do painel do cliente (só se muda por gerarLinkPainel) */
  painelToken?: string | null;
  /** atalhos que o cliente vê no painel (links só https) */
  atalhos?: AtalhosPainel | null;
  /** quando o fechamento começou (lead virou cliente); vazio = sem checklist de fechamento */
  fechamentoIniciadoEm?: string | null;
}

/** Atalhos do painel do cliente: o que ele abre sem pedir por fora. Tudo opcional. */
export interface AtalhosPainel {
  /** PDF do planejamento do mês */
  planejamentoUrl: string | null;
  /** texto do botão, ex.: "Planejamento de outubro" */
  planejamentoRotulo: string | null;
  fotosUrl: string | null;
  identidadeUrl: string | null;
  /** "O que está incluso" (o que o serviço cobre e o que é extra), texto simples */
  inclusoTexto: string | null;
}

/** Condições combinadas com o cliente. Nenhuma vem pronta: é o que foi assinado. */
export interface DadosContrato {
  /** "AAAA-MM-DD" */
  inicio: string | null;
  fim: string | null;
  prazoMinimoMeses: number | null;
  /** dia do mês em que o cliente paga */
  diaPagamento: number | null;
  avisoPrevioDias: number | null;
  /** rodadas de alteração incluídas por peça */
  limiteRodadas: number | null;
  prazoAprovacaoDias: number | null;
  prazoEntregaDias: number | null;
  /** quando começa a cobrança (texto livre: "na assinatura", "após o onboarding"…) */
  inicioCobranca: string;
  observacoes: string;
  /** vence no último dia útil do mês (no lugar do dia do pagamento) */
  venceUltimoDiaUtil?: boolean;
  /** máximo de reuniões por mês combinado no contrato (condição, não quantidade do pacote) */
  limiteReunioesMes?: number | null;
  /** tráfego com garantia: o que conta como resultado (texto combinado com o cliente) */
  garantiaResultado?: string;
  /** tráfego com garantia: até quando vale ("AAAA-MM-DD") */
  garantiaAte?: string | null;
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
  /** o mês do onboarding cobra mensalidade? null = ainda a definir entre os sócios */
  mensalidadeNoOnboarding?: boolean | null;
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
  /** lead parado na mesma etapa há este número de dias acende o aviso em Leads; vazio = nunca */
  diasLeadParado?: number | null;
  /** depois de quantos follow-ups sem resposta o sistema sugere marcar o lead como perdido; vazio = nunca */
  followUpsMaximo?: number | null;

  // ─── Divisão entre os sócios (decidida em 29/09/2026; os números são protegidos) ───
  /** sócio que recebe um % do que entra enquanto o faturamento não chega ao teto da virada */
  socioPercentualId?: Id | null;
  /** % do que entra (depois do imposto em %) que vai para esse sócio */
  sociedadePctSocio?: Pct;
  /** o que entrou no mês a partir do qual a divisão vira igual (percentual padrão de cada sócio) */
  sociedadeTetoViradaCentavos?: Centavos;
  /** parte do sócio acima deste valor aparece destacada como "bônus" */
  sociedadeAvisoBonusCentavos?: Centavos;
  /** sócio que fica com a sobra (e cobre o que faltar) antes da virada */
  socioSobraId?: Id | null;
  /** % da sobra desse sócio que vai para o tráfego próprio da Aden (ele mesmo controla) */
  sociedadeSobraTrafegoPct?: Pct;
  /** mínimo por mês para o tráfego próprio da Aden */
  trafegoProprioMinimoCentavos?: Centavos;

  // ─── Oferta padrão (proposta e negociação) ───
  /** verba de mídia indicada ao cliente, de… até… (paga por ele direto na plataforma) */
  ofertaVerbaMinCentavos?: Centavos;
  ofertaVerbaMaxCentavos?: Centavos;
  /** valor da gestão de tráfego depois que o resultado vem (tráfego com garantia) */
  ofertaGestaoAposResultadoCentavos?: Centavos;
  /** social media + tráfego abaixo deste valor mostra um aviso na Proposta (só aviso) */
  ofertaMinimoSocialTrafegoCentavos?: Centavos;
}

export interface Configuracao {
  empresa: ConfigEmpresa;
  pessoas: Pessoa[];
  servicos: Servico[];
  tiposEntrega: TipoEntrega[];
  custosFixos: CustoFixo[];
  clientes: ClienteBase[];
  terceiros?: Terceiro[];
  pacotes?: Pacote[];
  /** trilha de metas, na ordem dos degraus */
  metas?: Meta[];
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
  | "sem_trafego"
  /** tráfego com garantia: a gestão só é cobrada depois do resultado (até lá, horas sem receita) */
  | "garantia";

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
  /** deslocamento real deste cliente por saída, por terceiro (vazio = usa o médio do terceiro) */
  deslocamentos?: Record<Id, number | null>;
  /** pacote de onde o cenário saiu (para mostrar a diferença na negociação) */
  pacoteId?: Id | null;
}

// ─── Resultado ──────────────────────────────────────────────────────────────

/**
 * erro: o resultado está errado ou bloqueado. aviso: atenção, o número pode enganar.
 * lembrete: campo opcional vazio (considerado zero). info: observação.
 */
export type NivelAlerta = "erro" | "aviso" | "lembrete" | "info";

export type SecaoConfig = "socios" | "servicos" | "tipos" | "custos" | "terceiros" | "pacotes" | "datas" | "briefing" | "contrato" | "metas" | "equipe" | "regras" | "limites" | "clientes";

/** Onde se resolve o alerta: um campo das configurações ou um bloco do cenário. */
/** clienteId: na seção clientes, abre a ficha desse cliente (na aba contrato) */
export type DestinoAlerta = { tipo: "config"; secao: SecaoConfig; campo?: string; clienteId?: string } | { tipo: "cenario"; bloco: string };

export interface Alerta {
  nivel: NivelAlerta;
  texto: string;
  /** "o que isso quer dizer?": explicação curta, sem jargão, com exemplo */
  explica: string;
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
  /** de onde vem a parte dele: "30% do que entra" ou "o que sobra" (regra da sociedade) */
  regraParte?: string | null;
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
  /** qual divisão entre os sócios valeu nesta conta */
  divisao: DivisaoDoMes;
  alertas: Alerta[];
}

/**
 * Divisão entre os sócios usada na conta:
 * - percentual: antes da virada, um sócio recebe um % do que entra (depois do imposto em %) e o outro fica com o resto
 * - sobra: a sobra dividida pelo percentual padrão de cada sócio (depois da virada, ou sem a regra configurada)
 */
export type DivisaoDoMes =
  | { tipo: "percentual"; socioId: Id; pct: number; faturamentoMesCentavos: number; tetoViradaCentavos: number }
  | { tipo: "sobra"; faturamentoMesCentavos: number | null; tetoViradaCentavos: number | null };

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
