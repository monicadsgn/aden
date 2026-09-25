// Contrato da camada de dados. A tela fala só com esta interface.
//
// Duas implementações:
// - supabase.ts: a de verdade (login, permissões e auditoria no banco)
// - local.ts: modo demonstração, salva no navegador. Só é usado quando as
//   variáveis do Supabase não estão configuradas (dev local / apresentação).

import type { Cenario, ClienteBase, ConfigEmpresa, Configuracao, CustoFixo, Pessoa, ResultadoCenario, Servico, TipoEntrega } from "../calculo/tipos";

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  papel: string;
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
  salvarConfig(alteracoes: AlteracoesConfig): Promise<void>;

  listarSimulacoes(): Promise<ResumoSimulacao[]>;
  carregarSimulacao(id: string): Promise<Simulacao | null>;
  salvarSimulacao(sim: Simulacao, resultados: ResultadoCenario[], config: Configuracao): Promise<void>;
  removerSimulacao(id: string): Promise<void>;

  listarAuditoria(limite: number): Promise<RegistroAuditoria[]>;
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
