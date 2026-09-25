// Modo demonstração: guarda tudo no navegador (localStorage).
// Reproduz o registro de auditoria para que o comportamento seja o mesmo do
// banco — mas os dados ficam só neste navegador.

import { configVazia, novoId } from "../calculo/novo";
import type { RegistroMesCliente } from "../calculo/mes";
import type { Cenario, Configuracao } from "../calculo/tipos";
import type { AlteracoesConfig, RegistroAuditoria, Repositorio, ResumoSimulacao, Simulacao, Usuario } from "./repositorio";

const CHAVE = "aden:local:v1";

interface Banco {
  meses?: Record<string, Record<string, RegistroMesCliente>>;
  config: Configuracao;
  simulacoes: (Simulacao & { atualizadoEm: string })[];
  auditoria: RegistroAuditoria[];
}

const USUARIO: Usuario = { id: "local", nome: "Modo local", email: "local", papel: "admin" };

function ler(): Banco {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (bruto) return JSON.parse(bruto) as Banco;
  } catch {
    // armazenamento indisponível: segue com banco vazio
  }
  return { config: configVazia(), simulacoes: [], auditoria: [] };
}

function gravar(b: Banco) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(b));
  } catch {
    // sem armazenamento: os dados vivem só nesta aba
  }
}

function registrar(b: Banco, tabela: string, registroId: string, antes: unknown, depois: unknown) {
  if (JSON.stringify(antes) === JSON.stringify(depois)) return;
  b.auditoria.unshift({
    id: novoId(),
    tabela,
    registroId,
    acao: antes == null ? "criou" : depois == null ? "removeu" : "alterou",
    antes: (antes as Record<string, unknown>) ?? null,
    depois: (depois as Record<string, unknown>) ?? null,
    autor: USUARIO.nome,
    em: new Date().toISOString(),
  });
}

function aplicar<T extends { id: string }>(b: Banco, tabela: string, lista: T[], d: { salvar: T[]; remover: string[] }): T[] {
  let out = [...lista];
  for (const item of d.salvar) {
    const i = out.findIndex((x) => x.id === item.id);
    registrar(b, tabela, item.id, i >= 0 ? out[i] : null, item);
    if (i >= 0) out[i] = item;
    else out.push(item);
  }
  for (const id of d.remover) {
    registrar(b, tabela, id, out.find((x) => x.id === id), null);
    out = out.filter((x) => x.id !== id);
  }
  return out;
}

export class RepositorioLocal implements Repositorio {
  readonly modo = "local" as const;

  async usuarioAtual() {
    return USUARIO;
  }
  async entrar() {}
  async sair() {}

  async carregarConfig() {
    return ler().config;
  }

  async salvarConfig(a: AlteracoesConfig) {
    const b = ler();
    if (a.empresa) {
      registrar(b, "configuracoes_empresa", "empresa", b.config.empresa, a.empresa);
      b.config.empresa = a.empresa;
    }
    b.config.pessoas = aplicar(b, "pessoas", b.config.pessoas, a.pessoas);
    b.config.servicos = aplicar(b, "servicos", b.config.servicos, a.servicos);
    b.config.tiposEntrega = aplicar(b, "tipos_entrega", b.config.tiposEntrega, a.tiposEntrega);
    b.config.custosFixos = aplicar(b, "custos_fixos", b.config.custosFixos, a.custosFixos);
    b.config.clientes = aplicar(b, "clientes", b.config.clientes, a.clientes);
    gravar(b);
  }

  async listarSimulacoes(): Promise<ResumoSimulacao[]> {
    return ler()
      .simulacoes.map((s) => ({ id: s.id, nome: s.nome, atualizadoEm: s.atualizadoEm, cenarios: s.cenarios.length }))
      .sort((x, y) => y.atualizadoEm.localeCompare(x.atualizadoEm));
  }

  async carregarSimulacao(id: string) {
    const s = ler().simulacoes.find((x) => x.id === id);
    return s ? { id: s.id, nome: s.nome, cenarios: s.cenarios } : null;
  }

  async salvarSimulacao(sim: Simulacao) {
    const b = ler();
    const i = b.simulacoes.findIndex((x) => x.id === sim.id);
    const antes = i >= 0 ? b.simulacoes[i] : null;
    const novo = { ...sim, atualizadoEm: new Date().toISOString() };
    registrar(b, "simulacoes", sim.id, antes ? { nome: antes.nome, cenarios: antes.cenarios } : null, {
      nome: sim.nome,
      cenarios: sim.cenarios,
    });
    if (i >= 0) b.simulacoes[i] = novo;
    else b.simulacoes.push(novo);
    gravar(b);
  }

  async removerSimulacao(id: string) {
    const b = ler();
    const s = b.simulacoes.find((x) => x.id === id);
    if (s) registrar(b, "simulacoes", id, { nome: s.nome, cenarios: s.cenarios }, null);
    b.simulacoes = b.simulacoes.filter((x) => x.id !== id);
    gravar(b);
  }

  async listarAuditoria(limite: number) {
    return ler().auditoria.slice(0, limite);
  }

  async definirEscopoCliente(clienteId: string, escopo: Cenario | null) {
    const b = ler();
    const c = b.config.clientes.find((x) => x.id === clienteId);
    if (!c) throw new Error("Cliente não encontrado.");
    registrar(b, "contratos", clienteId, c.escopo ?? null, escopo);
    c.escopo = escopo;
    gravar(b);
  }

  async carregarMes(competencia: string) {
    return ler().meses?.[competencia] ?? {};
  }

  async salvarMesCliente(competencia: string, clienteId: string, registro: RegistroMesCliente) {
    const b = ler();
    b.meses ??= {};
    b.meses[competencia] ??= {};
    registrar(b, "mes_cliente", `${clienteId}:${competencia}`, b.meses[competencia][clienteId] ?? null, registro);
    b.meses[competencia][clienteId] = registro;
    gravar(b);
  }
}
