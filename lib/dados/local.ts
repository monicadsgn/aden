// Modo demonstração: guarda tudo no navegador (localStorage).
// Reproduz o registro de auditoria e as regras de aprovação para que o comportamento
// seja o mesmo do banco — mas os dados ficam só neste navegador. Aqui não há login de
// sócio, então quem aprova escolhe "decidir como" na tela de aprovações.

import type { Medicao } from "../calculo/calibragem";
import type { RegistroMesCliente } from "../calculo/mes";
import { configVazia, novoId } from "../calculo/novo";
import type { Tarefa } from "../calculo/tarefas";
import type { InteracaoLead, Lead } from "../calculo/crm";
import { aplicarResposta, montarPainel } from "../calculo/painel";
import type { Pagamento } from "../calculo/pagamentos";
import type { Cenario, Configuracao } from "../calculo/tipos";
import { afetados, aplicarItens, separarProtegidas, type ItemProtegido } from "../regras/aprovacao";
import { avisosDaMudanca } from "./acoes";
import type {
  AlteracoesConfig,
  AvisoSocio,
  DadosExcecao,
  Membro,
  NovoAviso,
  Pedido,
  RegistroAuditoria,
  Repositorio,
  ResultadoPedido,
  ResultadoSalvarConfig,
  ResumoSimulacao,
  Simulacao,
  StatusPedido,
  Usuario,
} from "./repositorio";

const CHAVE = "aden:local:v1";

interface Banco {
  meses?: Record<string, Record<string, RegistroMesCliente>>;
  config: Configuracao;
  simulacoes: (Simulacao & { atualizadoEm: string })[];
  auditoria: RegistroAuditoria[];
  pedidos?: Pedido[];
  avisos?: AvisoSocio[];
  medicoes?: Medicao[];
  pagamentos?: Pagamento[];
  tarefas?: Tarefa[];
  leads?: Lead[];
  interacoes?: InteracaoLead[];
}

const USUARIO: Usuario = { id: "local", nome: "Modo local", email: "local", papel: "admin", pessoaId: null };

function paraDataUrl(b: Blob): Promise<string> {
  return new Promise((ok, falha) => {
    const r = new FileReader();
    r.onload = () => ok(r.result as string);
    r.onerror = () => falha(r.error);
    r.readAsDataURL(b);
  });
}

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

/** Valor atual de um item protegido na configuração. */
function valorAtual(c: Configuracao, i: ItemProtegido): number | null {
  if (i.tabela === "pessoas") {
    const p = c.pessoas.find((x) => x.id === i.registroId);
    return (i.campo === "piso_hora_centavos" ? p?.pisoHoraCentavos : p?.percentualPadrao) ?? null;
  }
  if (i.tabela === "servico_divisao") return c.servicos.find((x) => x.id === i.registroId)?.divisaoPadrao[i.pessoaId ?? ""] ?? null;
  return c.tiposEntrega.find((x) => x.id === i.registroId)?.horasPorUnidade ?? null;
}

function concluir(b: Banco, p: Pedido) {
  if (p.tipo === "campos") {
    if (p.itens.some((i) => valorAtual(b.config, i) !== i.antes)) {
      p.status = "cancelado";
      p.motivo = "Os valores mudaram desde o pedido. Faça o pedido de novo.";
      p.decididoEm = new Date().toISOString();
      return;
    }
    const antes = b.config;
    b.config = aplicarItens(b.config, p.itens);
    registrar(b, "configuracao", p.id, antes, b.config);
  } else if (p.dados?.aplicar === "escopo" && p.clienteId) {
    const c = b.config.clientes.find((x) => x.id === p.clienteId);
    if (c) {
      registrar(b, "contratos", c.id, { escopo: c.escopo ?? null, valor: c.valorMensalCentavos }, { escopo: p.dados.cenario, valor: p.dados.valorCentavos });
      c.escopo = p.dados.cenario;
      if (p.dados.valorCentavos != null) c.valorMensalCentavos = p.dados.valorCentavos;
    }
  }
  p.status = "aplicado";
  p.decididoEm = new Date().toISOString();
}

function criarPedido(b: Banco, base: Omit<Pedido, "id" | "status" | "motivo" | "autorNome" | "autorPessoaId" | "criadoEm" | "decididoEm" | "aprovacoes">): ResultadoPedido {
  const p: Pedido = {
    ...base,
    id: novoId(),
    status: "pendente",
    motivo: null,
    autorNome: USUARIO.nome,
    autorPessoaId: USUARIO.pessoaId,
    criadoEm: new Date().toISOString(),
    decididoEm: null,
    aprovacoes: [],
  };
  (b.pedidos ??= []).unshift(p);
  registrar(b, "pedidos_alteracao", p.id, null, { descricao: p.descricao, afetados: p.afetados });
  const aguardando = p.afetados.filter((id) => id !== USUARIO.pessoaId);
  if (!aguardando.length) concluir(b, p);
  return { pedidoId: p.id, status: p.status, aguardando };
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

  async listarMembros(): Promise<Membro[]> {
    return [{ id: "local", nome: USUARIO.nome, email: USUARIO.email, papel: "admin" }];
  }

  async salvarFotoPessoa(pessoaId: string, imagem: Blob | null): Promise<string | null> {
    const url = imagem ? await paraDataUrl(imagem) : null;
    const b = ler();
    const p = b.config.pessoas.find((x) => x.id === pessoaId);
    if (p) {
      registrar(b, "pessoas", p.id, { foto: p.fotoUrl ? "com foto" : "sem foto" }, { foto: url ? "foto nova" : "sem foto" });
      p.fotoUrl = url;
    }
    gravar(b);
    return url;
  }

  async salvarConfig(alt: AlteracoesConfig): Promise<ResultadoSalvarConfig> {
    const b = ler();
    const antes = structuredClone(b.config);
    const sep = separarProtegidas(antes, alt);
    const a = sep.alteracoes;
    if (a.empresa) {
      registrar(b, "configuracoes_empresa", "empresa", b.config.empresa, a.empresa);
      b.config.empresa = a.empresa;
    }
    b.config.pessoas = aplicar(b, "pessoas", b.config.pessoas, a.pessoas);
    b.config.servicos = aplicar(b, "servicos", b.config.servicos, a.servicos);
    b.config.tiposEntrega = aplicar(b, "tipos_entrega", b.config.tiposEntrega, a.tiposEntrega);
    b.config.custosFixos = aplicar(b, "custos_fixos", b.config.custosFixos, a.custosFixos);
    b.config.clientes = aplicar(b, "clientes", b.config.clientes, a.clientes);
    if (a.terceiros) b.config.terceiros = aplicar(b, "terceiros", b.config.terceiros ?? [], a.terceiros);
    if (a.pacotes) {
      // só um pacote padrão
      const padrao = a.pacotes.salvar.find((p) => p.padrao);
      if (padrao) b.config.pacotes = (b.config.pacotes ?? []).map((p) => (p.id !== padrao.id && p.padrao ? { ...p, padrao: false } : p));
      b.config.pacotes = aplicar(b, "pacotes", b.config.pacotes ?? [], a.pacotes);
    }
    if (a.metas) b.config.metas = aplicar(b, "metas", b.config.metas ?? [], a.metas);

    let pedido: ResultadoPedido | null = null;
    if (sep.itens.length)
      pedido = criarPedido(b, {
        tipo: "campos",
        descricao: sep.itens.map((i) => i.descricao).join(", "),
        itens: sep.itens,
        dados: null,
        assinatura: null,
        clienteId: null,
        afetados: afetados(antes, sep.itens),
        impacto: null,
      });
    const avisos = avisosDaMudanca({
      antes,
      depois: b.config,
      autor: USUARIO,
      itensPendentes: pedido?.status === "pendente" ? sep.itens : [],
      pedido,
      itensNaHora: [...sep.primeirosPreenchimentos, ...(pedido?.status === "aplicado" ? sep.itens : [])],
    });
    b.avisos = [...avisos.map(novoAviso), ...(b.avisos ?? [])];
    gravar(b);
    return { pedido, itensProtegidos: sep.itens };
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

  // ─── Aprovações e avisos ──────────────────────────────────────────────────

  async listarPedidos() {
    return ler().pedidos ?? [];
  }

  async decidirPedido(id: string, decisao: "aprovado" | "recusado", motivo?: string | null, comoPessoaId?: string): Promise<StatusPedido> {
    const b = ler();
    const p = b.pedidos?.find((x) => x.id === id);
    if (!p) throw new Error("Pedido não encontrado.");
    if (p.status !== "pendente") throw new Error("Este pedido já foi decidido.");
    const quem = comoPessoaId ?? USUARIO.pessoaId;
    if (!quem || !p.afetados.includes(quem)) throw new Error("Só o sócio afetado pode decidir este pedido.");
    if (p.aprovacoes.some((a) => a.pessoaId === quem)) throw new Error("Este sócio já decidiu este pedido.");
    p.aprovacoes.push({ pessoaId: quem, decisao, automatica: false, em: new Date().toISOString() });
    registrar(b, "aprovacoes", `${id}:${quem}`, null, { decisao });
    if (decisao === "recusado") {
      p.status = "recusado";
      p.motivo = motivo ?? null;
      p.decididoEm = new Date().toISOString();
    } else if (p.afetados.every((a) => p.aprovacoes.some((x) => x.pessoaId === a && x.decisao === "aprovado"))) concluir(b, p);
    gravar(b);
    return p.status;
  }

  async cancelarPedido(id: string) {
    const b = ler();
    const p = b.pedidos?.find((x) => x.id === id);
    if (!p || p.status !== "pendente") throw new Error("Só dá para cancelar pedido pendente.");
    p.status = "cancelado";
    p.motivo = "Cancelado por quem pediu.";
    p.decididoEm = new Date().toISOString();
    gravar(b);
  }

  async proporExcecao(e: { clienteId: string | null; afetados: string[]; assinatura: string; descricao: string; dados: DadosExcecao }) {
    const b = ler();
    const r = criarPedido(b, {
      tipo: "excecao",
      descricao: e.descricao,
      itens: [],
      dados: e.dados,
      assinatura: e.assinatura,
      clienteId: e.clienteId,
      afetados: e.afetados,
      impacto: null,
    });
    gravar(b);
    return r;
  }

  async listarAvisos() {
    return ler().avisos ?? [];
  }

  async criarAvisos(avisos: NovoAviso[]) {
    const b = ler();
    b.avisos = [...avisos.map(novoAviso), ...(b.avisos ?? [])];
    gravar(b);
  }

  async marcarAvisoLido(id: string) {
    const b = ler();
    const a = b.avisos?.find((x) => x.id === id);
    if (a) a.lidoEm = new Date().toISOString();
    gravar(b);
  }

  // ─── Cronômetro ───────────────────────────────────────────────────────────

  async listarMedicoes() {
    return ler().medicoes ?? [];
  }

  async salvarMedicao(m: Medicao) {
    const b = ler();
    const lista = b.medicoes ?? [];
    const i = lista.findIndex((x) => x.id === m.id);
    registrar(b, "medicoes", m.id, i >= 0 ? lista[i] : null, m);
    if (i >= 0) lista[i] = m;
    else lista.unshift(m);
    b.medicoes = lista;
    gravar(b);
  }

  async removerMedicao(id: string) {
    const b = ler();
    registrar(b, "medicoes", id, b.medicoes?.find((x) => x.id === id), null);
    b.medicoes = (b.medicoes ?? []).filter((x) => x.id !== id);
    gravar(b);
  }

  // ─── Tarefas ──────────────────────────────────────────────────────────────

  async listarTarefas() {
    return (ler().tarefas ?? []).slice();
  }

  async salvarTarefa(t: Tarefa) {
    const b = ler();
    const lista = b.tarefas ?? [];
    const i = lista.findIndex((x) => x.id === t.id);
    registrar(b, "tarefas", t.id, i >= 0 ? lista[i] : null, t);
    if (i >= 0) lista[i] = t;
    else lista.unshift(t);
    b.tarefas = lista;
    gravar(b);
  }

  async removerTarefa(id: string) {
    const b = ler();
    registrar(b, "tarefas", id, b.tarefas?.find((x) => x.id === id), null);
    b.tarefas = (b.tarefas ?? []).filter((x) => x.id !== id);
    // a medição fica (conta na calibragem), só perde o vínculo
    b.medicoes = (b.medicoes ?? []).map((m) => (m.tarefaId === id ? { ...m, tarefaId: null } : m));
    gravar(b);
  }

  // ─── Google Agenda: só com o banco conectado (o servidor busca no Google) ────

  async listarAgendas() {
    return [];
  }

  async salvarAgenda(): Promise<void> {
    throw new Error("A agenda do Google só funciona com o banco conectado.");
  }

  async removerAgenda() {}

  async eventosAgenda() {
    return { eventos: [], erros: [] };
  }

  // ─── Painel do cliente ────────────────────────────────────────────────────

  async gerarLinkPainel(clienteId: string) {
    const token = Array.from(crypto.getRandomValues(new Uint8Array(24)), (x) => x.toString(16).padStart(2, "0")).join("");
    const b = ler();
    b.config.clientes = b.config.clientes.map((c) => (c.id === clienteId ? { ...c, painelToken: token } : c));
    gravar(b);
    return token;
  }

  async painelCliente(token: string) {
    const b = ler();
    const c = b.config.clientes.find((x) => x.painelToken === token && x.ativo);
    return c ? montarPainel(c, b.tarefas ?? []) : null;
  }

  async responderPeca(token: string, tarefaId: string, decisao: "aprovar" | "ajustar", texto: string) {
    const b = ler();
    const c = b.config.clientes.find((x) => x.painelToken === token && x.ativo);
    if (!c) throw new Error("Link inválido.");
    const t = (b.tarefas ?? []).find((x) => x.id === tarefaId && x.clienteId === c.id);
    if (!t) throw new Error("Peça não encontrada.");
    const nova = aplicarResposta(t, decisao, texto);
    registrar(b, "tarefas", t.id, t, nova);
    b.tarefas = (b.tarefas ?? []).map((x) => (x.id === t.id ? nova : x));
    gravar(b);
  }

  async enviarParaCliente(tarefaId: string) {
    const b = ler();
    b.tarefas = (b.tarefas ?? []).map((t) =>
      t.id === tarefaId ? { ...t, status: "revisao" as const, visivelCliente: true, enviadaClienteEm: new Date().toISOString(), clienteAprovouEm: null } : t,
    );
    gravar(b);
  }

  async enviarArquivoPeca(_tarefaId: string, arquivo: File) {
    return { url: await paraDataUrl(arquivo), nome: arquivo.name, tipo: arquivo.type };
  }

  // ─── CRM ──────────────────────────────────────────────────────────────────

  async listarLeads() {
    return (ler().leads ?? []).slice();
  }

  async salvarLead(l: Lead) {
    const b = ler();
    const lista = b.leads ?? [];
    const i = lista.findIndex((x) => x.id === l.id);
    registrar(b, "leads", l.id, i >= 0 ? lista[i] : null, l);
    if (i >= 0) lista[i] = l;
    else lista.unshift(l);
    b.leads = lista;
    gravar(b);
  }

  async removerLead(id: string) {
    const b = ler();
    registrar(b, "leads", id, b.leads?.find((x) => x.id === id), null);
    b.leads = (b.leads ?? []).filter((x) => x.id !== id);
    b.interacoes = (b.interacoes ?? []).filter((x) => x.leadId !== id);
    gravar(b);
  }

  async listarInteracoes(leadId: string) {
    return (ler().interacoes ?? []).filter((i) => i.leadId === leadId).sort((a, b) => b.em.localeCompare(a.em));
  }

  async salvarInteracao(i: InteracaoLead) {
    const b = ler();
    const lista = b.interacoes ?? [];
    const novo = { ...i, autorNome: i.autorNome ?? USUARIO.nome };
    const k = lista.findIndex((x) => x.id === i.id);
    if (k >= 0) lista[k] = novo;
    else lista.push(novo);
    b.interacoes = lista;
    gravar(b);
  }

  async removerInteracao(id: string) {
    const b = ler();
    b.interacoes = (b.interacoes ?? []).filter((x) => x.id !== id);
    gravar(b);
  }

  // ─── Pagamentos ───────────────────────────────────────────────────────────

  async listarPagamentos() {
    return (ler().pagamentos ?? []).slice().sort((a, b) => a.recebidoEm.localeCompare(b.recebidoEm));
  }

  async salvarPagamento(p: Pagamento) {
    const b = ler();
    const lista = b.pagamentos ?? [];
    const i = lista.findIndex((x) => x.id === p.id);
    const novo = { ...p, autor: USUARIO.nome, criadoEm: p.criadoEm ?? new Date().toISOString() };
    registrar(b, "pagamentos", p.id, i >= 0 ? lista[i] : null, novo);
    if (i >= 0) lista[i] = novo;
    else lista.push(novo);
    b.pagamentos = lista;
    gravar(b);
  }

  async removerPagamento(id: string) {
    const b = ler();
    registrar(b, "pagamentos", id, b.pagamentos?.find((x) => x.id === id), null);
    b.pagamentos = (b.pagamentos ?? []).filter((x) => x.id !== id);
    gravar(b);
  }
}

function novoAviso(a: NovoAviso): AvisoSocio {
  return { ...a, id: novoId(), criadoEm: new Date().toISOString(), lidoEm: null };
}
