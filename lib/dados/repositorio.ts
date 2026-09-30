// Contrato da camada de dados. A tela fala só com esta interface.
//
// Duas implementações:
// - supabase.ts: a de verdade (login, permissões e auditoria no banco)
// - local.ts: modo demonstração, salva no navegador. Só é usado quando as
//   variáveis do Supabase não estão configuradas (dev local / apresentação).

import type { DataComemorativa, DataDoCliente } from "../calculo/datas";
import type { RegistroFechamento } from "../calculo/fechamento";
import type { PerguntaBriefing, RespostaBriefing } from "../calculo/briefing";
import type { ContratoEnviado, ModeloContrato, SituacaoContrato } from "../calculo/contrato";
import type { Medicao } from "../calculo/calibragem";
import type { RegistroMesCliente } from "../calculo/mes";
import type { Pagamento } from "../calculo/pagamentos";
import type { ArquivoPeca, RespostaCliente, Tarefa } from "../calculo/tarefas";
import type { InteracaoLead, Lead } from "../calculo/crm";
import type { EventoAgenda } from "../agenda/ics";
import type { AtalhosPainel, Cenario, ClienteBase, ConfigEmpresa, Configuracao, CustoFixo, Meta, Pacote, Pessoa, ResultadoCenario, Servico, Terceiro, TipoEntrega } from "../calculo/tipos";
import type { ItemProtegido } from "../regras/aprovacao";

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  /** admin = sócio; contador = só leitura do financeiro (perfil preparado) */
  papel: string;
  /** sócio (pessoa) ligado a este login; null = login sem sócio (ex.: o conector) */
  pessoaId: string | null;
  /** foto de perfil do sócio ligado a este login */
  fotoUrl?: string | null;
}

export interface MembroEquipe {
  id: string;
  nome: string;
  email: string;
  papel: string;
  ativo: boolean;
}

export interface Convite {
  id: string;
  nome: string;
  email: string;
  papel: string;
  criadoEm: string;
}

export interface Membro {
  id: string;
  nome: string;
  email: string;
  papel: string;
}

export type StatusPedido = "pendente" | "aplicado" | "recusado" | "cancelado";

export interface Aprovacao {
  pessoaId: string;
  decisao: "aprovado" | "recusado";
  automatica: boolean;
  em: string;
}

/** Pedido de alteração em campo protegido, ou exceção (escopo/proposta abaixo do piso). */
export interface Pedido {
  id: string;
  tipo: "campos" | "excecao";
  descricao: string;
  itens: ItemProtegido[];
  /** exceção: cenário, valor e perda por sócio */
  dados: DadosExcecao | null;
  assinatura: string | null;
  clienteId: string | null;
  afetados: string[];
  /** pessoa → quanto muda no bolso por mês (centavos) */
  impacto: Record<string, number> | null;
  status: StatusPedido;
  motivo: string | null;
  autorNome: string | null;
  autorPessoaId: string | null;
  criadoEm: string;
  decididoEm: string | null;
  aprovacoes: Aprovacao[];
}

export interface DadosExcecao {
  /** "escopo": ao aprovar, vira o escopo contratado (e o valor) do cliente. "proposta": libera o PDF */
  aplicar: "escopo" | "proposta";
  cenario: Cenario;
  valorCentavos: number | null;
  perdas: { pessoaId: string; nome: string; perdaMensalCentavos: number }[];
}

export interface ResultadoPedido {
  pedidoId: string;
  status: StatusPedido;
  /** pessoas que ainda precisam aprovar */
  aguardando: string[];
}

export interface AvisoSocio {
  id: string;
  pessoaId: string;
  titulo: string;
  texto: string;
  impactoCentavos: number | null;
  autorNome: string | null;
  pedidoId: string | null;
  criadoEm: string;
  lidoEm: string | null;
}

export type NovoAviso = Omit<AvisoSocio, "id" | "criadoEm" | "lidoEm">;

export interface PortaDeAcesso {
  id: string;
  /** começo do código, para reconhecer */
  inicio: string;
  criadoEm: string;
  usadoEm: string | null;
  canceladoEm: string | null;
}

/** Tipos de anotação do contexto do cliente (Fase 4). */
export type TipoContexto = "decisao" | "preferencia" | "pendencia" | "nota";

/** Memória de contexto do cliente: só os sócios leem. Não se apaga; resolvida sai da lista principal. */
export interface NotaContexto {
  id: string;
  clienteId: string;
  tipo: TipoContexto;
  texto: string;
  /** quem anotou ("Mônica", ou "Mônica (pelo Claude)"); o banco preenche */
  autorNome: string | null;
  peloClaude: boolean;
  criadoEm: string;
  resolvidoEm: string | null;
  resolvidoPorNome: string | null;
}

/** Quem dos sócios já usa o código do Claude. */
export interface UsoDoConector {
  pessoaId: string;
  nome: string;
  temCodigo: boolean;
  ultimoUso: string | null;
}

/** O que o cliente vê no painel: só as peças, nunca horas, valores ou sócios. */
export interface PainelCliente {
  cliente: string;
  limiteRodadas: number | null;
  prazoAprovacaoDias: number | null;
  atalhos?: AtalhosPainel | null;
  pecas: {
    id: string;
    titulo: string;
    legenda: string | null;
    arquivos: ArquivoPeca[];
    status: Tarefa["status"];
    vencimento: string | null;
    enviadaEm: string | null;
    rodadas: number;
    feedback: string | null;
    feedbackEm: string | null;
    aprovadaEm: string | null;
    respostas: RespostaCliente[];
    /** quando vai ao ar e quando foi (Fase 3) */
    publicarEm?: string | null;
    publicadaEm?: string | null;
    /** formato (nome do tipo de entrega) */
    tipo?: string | null;
    /** o que vai escrito dentro da arte */
    textoArte?: string | null;
    /** quando a equipe programou o post */
    agendadaEm?: string | null;
  }[];
}

/** O que aconteceu ao salvar as configurações. */
export interface ResultadoSalvarConfig {
  /** mudanças protegidas: aplicadas na hora (autor é o único afetado) ou pendentes */
  pedido: ResultadoPedido | null;
  itensProtegidos: ItemProtegido[];
}

export interface ResumoSimulacao {
  id: string;
  nome: string;
  atualizadoEm: string;
  cenarios: number;
}

export interface Simulacao {
  id: string;
  nome: string;
  cenarios: Cenario[];
}

export interface RegistroAuditoria {
  id: string;
  tabela: string;
  registroId: string;
  acao: "criou" | "alterou" | "removeu";
  antes: Record<string, unknown> | null;
  depois: Record<string, unknown> | null;
  autor: string;
  /** feito pelo Claude com o código pessoal do sócio */
  peloClaude?: boolean;
  em: string;
}

/** Mudanças de configuração num salvamento só. */
export interface AlteracoesConfig {
  empresa?: ConfigEmpresa;
  pessoas: { salvar: Pessoa[]; remover: string[] };
  servicos: { salvar: Servico[]; remover: string[] };
  tiposEntrega: { salvar: TipoEntrega[]; remover: string[] };
  custosFixos: { salvar: CustoFixo[]; remover: string[] };
  clientes: { salvar: ClienteBase[]; remover: string[] };
  terceiros?: { salvar: Terceiro[]; remover: string[] };
  pacotes?: { salvar: Pacote[]; remover: string[] };
  metas?: { salvar: Meta[]; remover: string[] };
}

export interface Repositorio {
  readonly modo: "supabase" | "local";
  usuarioAtual(): Promise<Usuario | null>;
  entrar(email: string, senha: string): Promise<void>;
  sair(): Promise<void>;
  /** Primeiro acesso de quem foi convidado. "confirmar" = falta clicar no link do e-mail. */
  criarConta(email: string, senha: string): Promise<"ok" | "confirmar">;

  // ─── Equipe e acessos (só sócios) ─────────────────────────────────────────
  listarEquipe(): Promise<{ membros: MembroEquipe[]; convites: Convite[] }>;
  convidar(nome: string, email: string, papel: string): Promise<void>;
  cancelarConvite(id: string): Promise<void>;
  mudarAcesso(membroId: string, patch: { papel?: string; ativo?: boolean }): Promise<void>;

  carregarConfig(): Promise<Configuracao>;
  /**
   * Salva o que é livre e manda para aprovação o que é protegido (piso, % dos sócios,
   * divisão de horas, tempo por entrega). Campo vazio sendo preenchido vale na hora.
   */
  salvarConfig(alteracoes: AlteracoesConfig): Promise<ResultadoSalvarConfig>;
  listarMembros(): Promise<Membro[]>;
  /** Troca a foto de perfil do sócio (imagem já reduzida). null tira a foto. Devolve o endereço novo. */
  salvarFotoPessoa(pessoaId: string, imagem: Blob | null): Promise<string | null>;

  listarSimulacoes(): Promise<ResumoSimulacao[]>;
  carregarSimulacao(id: string): Promise<Simulacao | null>;
  salvarSimulacao(sim: Simulacao, resultados: ResultadoCenario[], config: Configuracao): Promise<void>;
  removerSimulacao(id: string): Promise<void>;

  listarAuditoria(limite: number): Promise<RegistroAuditoria[]>;

  /** Escopo contratado do cliente (cenário da calculadora). null remove. */
  definirEscopoCliente(clienteId: string, escopo: Cenario | null): Promise<void>;
  /** Registros do mês ("AAAA-MM"): valor recebido e horas reais por cliente. */
  carregarMes(competencia: string): Promise<Record<string, RegistroMesCliente>>;
  salvarMesCliente(competencia: string, clienteId: string, registro: RegistroMesCliente): Promise<void>;

  // ─── Aprovações e avisos ──────────────────────────────────────────────────
  listarPedidos(): Promise<Pedido[]>;
  /** `comoPessoaId` só vale no modo demonstração (lá não há login de sócio) */
  decidirPedido(id: string, decisao: "aprovado" | "recusado", motivo?: string | null, comoPessoaId?: string): Promise<StatusPedido>;
  cancelarPedido(id: string): Promise<void>;
  proporExcecao(p: { clienteId: string | null; afetados: string[]; assinatura: string; descricao: string; dados: DadosExcecao }): Promise<ResultadoPedido>;
  listarAvisos(): Promise<AvisoSocio[]>;
  criarAvisos(avisos: NovoAviso[]): Promise<void>;
  marcarAvisoLido(id: string): Promise<void>;

  // ─── Cronômetro ───────────────────────────────────────────────────────────
  listarMedicoes(): Promise<Medicao[]>;
  salvarMedicao(m: Medicao): Promise<void>;
  removerMedicao(id: string): Promise<void>;

  // ─── Tarefas (com o cronômetro dentro) ────────────────────────────────────
  listarTarefas(): Promise<Tarefa[]>;
  salvarTarefa(t: Tarefa): Promise<void>;
  removerTarefa(id: string): Promise<void>;
  /** várias de uma vez (planejamento mensal): se uma falhar, nenhuma é gravada */
  salvarTarefas(ts: Tarefa[]): Promise<void>;

  // ─── Fechamento do cliente (Fase 5) ─────────────────────────────────────────
  listarFechamento(clienteId: string): Promise<RegistroFechamento[]>;
  /** marca (ou desmarca) um passo; quem fez vem do banco */
  salvarPassoFechamento(p: {
    clienteId: string;
    passo: RegistroFechamento["passo"];
    feito: boolean;
    link?: string | null;
    data?: string | null;
    observacao?: string | null;
  }): Promise<void>;

  // ─── Contrato (Fase 5, passo 3) ──────────────────────────────────────────────
  /** o que é igual em todo contrato (texto dos sócios); vazio se nunca foi salvo */
  obterModeloContrato(): Promise<ModeloContrato>;
  salvarModeloContrato(m: ModeloContrato): Promise<void>;
  /** contratos mandados para assinatura, do mais novo para o mais antigo */
  listarContratosAssinatura(clienteId: string): Promise<ContratoEnviado[]>;
  /** quem enviou vem do banco */
  registrarContratoAssinatura(c: { clienteId: string; autentiqueId: string; nome: string; signatarios: ContratoEnviado["signatarios"] }): Promise<void>;
  atualizarContratoAssinatura(id: string, s: { situacao: SituacaoContrato | "cancelado"; assinadoEm: string | null; faltam: string[] }): Promise<void>;
  /**
   * Pelo site: pede ao servidor (a chave da Autentique só existe lá). "situacao" diz se a Autentique está ligada;
   * "enviar" monta o PDF e manda; "conferir" pergunta à Autentique quem já assinou.
   */
  contratoNoServidor(pedido: { acao: "situacao" } | { acao: "enviar" | "conferir"; clienteId: string; reenviar?: boolean }): Promise<{ autentiqueLigada: boolean; teste?: boolean; mensagem?: string }>;

  // ─── Briefing do cliente (Fase 5) ────────────────────────────────────────────
  listarPerguntasBriefing(): Promise<PerguntaBriefing[]>;
  salvarPerguntaBriefing(p: PerguntaBriefing): Promise<void>;
  removerPerguntaBriefing(id: string): Promise<void>;
  listarRespostasBriefing(clienteId: string): Promise<RespostaBriefing[]>;
  /** quem respondeu vem do banco */
  responderBriefing(clienteId: string, perguntaId: string, resposta: string | null): Promise<void>;

  // ─── Datas comemorativas (planejamento mensal) ───────────────────────────────
  listarDatas(): Promise<{ datas: DataComemorativa[]; ligacoes: DataDoCliente[] }>;
  salvarDataComemorativa(d: DataComemorativa): Promise<void>;
  removerDataComemorativa(id: string): Promise<void>;
  /** liga a data a um cliente (antecedência, nota, escondida); uma por data e cliente */
  salvarDataDoCliente(l: DataDoCliente): Promise<void>;
  removerDataDoCliente(id: string): Promise<void>;

  // ─── Porta genérica (código pessoal, Fase 3) ─────────────────────────────────
  /** meus códigos (só o começo; o código inteiro só aparece ao gerar) */
  listarPortas(): Promise<PortaDeAcesso[]>;
  /** gera um código novo e devolve ele inteiro, uma única vez */
  gerarPorta(): Promise<string>;
  cancelarPorta(id: string): Promise<void>;

  // ─── Seu Claude: código pessoal do conector (Fase 4) ─────────────────────────
  /** meus códigos do Claude (só o começo) */
  listarCodigosClaude(): Promise<PortaDeAcesso[]>;
  /** gera um código novo do Claude e devolve ele inteiro, uma única vez (cancela com cancelarPorta) */
  gerarCodigoClaude(): Promise<string>;
  /** quem dos sócios já tem e usa o código do Claude */
  usoDoConector(): Promise<UsoDoConector[]>;

  // ─── Contexto do cliente (Fase 4) ────────────────────────────────────────────
  listarContexto(clienteId: string, incluirResolvidas?: boolean): Promise<NotaContexto[]>;
  anotarContexto(n: { clienteId: string; tipo: TipoContexto; texto: string }): Promise<NotaContexto>;
  /** marca como resolvida (ou volta a ativa); nunca apaga */
  resolverContexto(id: string, resolvida: boolean): Promise<void>;

  // ─── Google Agenda (só leitura, cada um a sua) ─────────────────────────────
  listarAgendas(): Promise<{ id: string; nome: string; endereco: string }[]>;
  salvarAgenda(nome: string, enderecoIcal: string): Promise<void>;
  removerAgenda(id: string): Promise<void>;
  /** Eventos das minhas agendas no período ("AAAA-MM-DD"). `erros` = agendas que não abriram. */
  eventosAgenda(de: string, ate: string): Promise<{ eventos: EventoAgenda[]; erros: string[] }>;

  // ─── Painel do cliente ────────────────────────────────────────────────────
  /** Gera (ou troca, revogando o antigo) o código do link do painel do cliente. */
  gerarLinkPainel(clienteId: string): Promise<string>;
  /** O que o cliente vê pelo link (sem login). null = link inválido. */
  painelCliente(token: string): Promise<PainelCliente | null>;
  /** Resposta do cliente pelo link: aprovar ou pedir ajuste. */
  responderPeca(token: string, tarefaId: string, decisao: "aprovar" | "ajustar", texto: string): Promise<void>;
  /** Manda a peça para o cliente aprovar (status "com o cliente", aparece no painel). */
  enviarParaCliente(tarefaId: string): Promise<void>;
  /** Sobe uma arte da peça e devolve o endereço. */
  enviarArquivoPeca(tarefaId: string, arquivo: File): Promise<ArquivoPeca>;

  // ─── CRM ──────────────────────────────────────────────────────────────────
  listarLeads(): Promise<Lead[]>;
  salvarLead(l: Lead): Promise<void>;
  removerLead(id: string): Promise<void>;
  listarInteracoes(leadId: string): Promise<InteracaoLead[]>;
  salvarInteracao(i: InteracaoLead): Promise<void>;
  removerInteracao(id: string): Promise<void>;

  // ─── Pagamentos ───────────────────────────────────────────────────────────
  listarPagamentos(): Promise<Pagamento[]>;
  salvarPagamento(p: Pagamento): Promise<void>;
  removerPagamento(id: string): Promise<void>;
}

/** Mês atual no formato "AAAA-MM". */
export function competenciaAtual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Diferença entre duas listas por id, comparando o conteúdo. */
export function diferenca<T extends { id: string }>(antes: T[], depois: T[]): { salvar: T[]; remover: string[] } {
  const mapaAntes = new Map(antes.map((x) => [x.id, JSON.stringify(x)]));
  const idsDepois = new Set(depois.map((x) => x.id));
  return {
    salvar: depois.filter((x) => mapaAntes.get(x.id) !== JSON.stringify(x)),
    remover: antes.filter((x) => !idsDepois.has(x.id)).map((x) => x.id),
  };
}

export function temAlteracoes(a: AlteracoesConfig): boolean {
  return (
    !!a.empresa ||
    ([a.pessoas, a.servicos, a.tiposEntrega, a.custosFixos, a.clientes, a.terceiros, a.pacotes, a.metas] as ({ salvar: unknown[]; remover: string[] } | undefined)[])
      .filter((d) => !!d)
      .some((d) => d!.salvar.length > 0 || d!.remover.length > 0)
  );
}
