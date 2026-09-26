// Contrato da camada de dados. A tela fala só com esta interface.
//
// Duas implementações:
// - supabase.ts: a de verdade (login, permissões e auditoria no banco)
// - local.ts: modo demonstração, salva no navegador. Só é usado quando as
//   variáveis do Supabase não estão configuradas (dev local / apresentação).

import type { Medicao } from "../calculo/calibragem";
import type { RegistroMesCliente } from "../calculo/mes";
import type { Pagamento } from "../calculo/pagamentos";
import type { Tarefa } from "../calculo/tarefas";
import type { Cenario, ClienteBase, ConfigEmpresa, Configuracao, CustoFixo, Pessoa, ResultadoCenario, Servico, TipoEntrega } from "../calculo/tipos";
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
}

export interface Repositorio {
  readonly modo: "supabase" | "local";
  usuarioAtual(): Promise<Usuario | null>;
  entrar(email: string, senha: string): Promise<void>;
  sair(): Promise<void>;

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
    [a.pessoas, a.servicos, a.tiposEntrega, a.custosFixos, a.clientes].some((d) => d.salvar.length > 0 || d.remover.length > 0)
  );
}
