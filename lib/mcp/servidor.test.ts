// Teste de ponta a ponta do conector: cliente MCP ↔ servidor, com banco em memória.
// Números aqui são só fixtures de teste.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Medicao } from "../calculo/calibragem";
import { configVazia, novoId } from "../calculo/novo";
import type { Pagamento } from "../calculo/pagamentos";
import type { Configuracao } from "../calculo/tipos";
import { afetados, aplicarItens, separarProtegidas } from "../regras/aprovacao";
import type { AlteracoesConfig, AvisoSocio, DadosExcecao, NotaContexto, NovoAviso, Pedido, RegistroAuditoria, ResultadoSalvarConfig, Simulacao } from "../dados/repositorio";
import type { RepositorioSupabase } from "../dados/supabase";
import { PAINEL_CLIENTE_ATIVO } from "../recursos";
import { criarServidorMcp } from "./servidor";

function aplicar<T extends { id: string }>(lista: T[], d: { salvar: T[]; remover: string[] }) {
  let out = [...lista];
  for (const x of d.salvar) out = out.some((y) => y.id === x.id) ? out.map((y) => (y.id === x.id ? x : y)) : [...out, x];
  return out.filter((x) => !d.remover.includes(x.id));
}

class BancoFalso {
  config: Configuracao = configVazia();
  sims: (Simulacao & { atualizadoEm: string })[] = [];
  historico: RegistroAuditoria[] = [];
  async carregarConfig() {
    return structuredClone(this.config);
  }
  pedidos: Pedido[] = [];
  avisos: AvisoSocio[] = [];
  medicoes: Medicao[] = [];
  pagamentos: Pagamento[] = [];
  // o conector não é sócio: toda mudança protegida vira pedido
  async salvarConfig(alt: AlteracoesConfig): Promise<ResultadoSalvarConfig> {
    const sep = separarProtegidas(this.config, alt);
    const a = sep.alteracoes;
    const antes = structuredClone(this.config);
    this.aplicarLivres(a);
    if (!sep.itens.length) return { pedido: null, itensProtegidos: [] };
    const af = afetados(antes, sep.itens);
    const pedidoId = novoId();
    this.pedidos.push({
      id: pedidoId, tipo: "campos", descricao: "x", itens: sep.itens, dados: null, assinatura: null, clienteId: null, afetados: af,
      impacto: null, status: af.length ? "pendente" : "aplicado", motivo: null, autorNome: "Claude (conector)", autorPessoaId: null,
      criadoEm: "", decididoEm: null, aprovacoes: [],
    });
    if (!af.length) this.config = aplicarItens(this.config, sep.itens);
    return { pedido: { pedidoId, status: af.length ? "pendente" : "aplicado", aguardando: af }, itensProtegidos: sep.itens };
  }
  private aplicarLivres(a: AlteracoesConfig) {
    if (a.empresa) this.config.empresa = a.empresa;
    this.config.pessoas = aplicar(this.config.pessoas, a.pessoas);
    this.config.servicos = aplicar(this.config.servicos, a.servicos);
    this.config.tiposEntrega = aplicar(this.config.tiposEntrega, a.tiposEntrega);
    this.config.custosFixos = aplicar(this.config.custosFixos, a.custosFixos);
    this.config.clientes = aplicar(this.config.clientes, a.clientes);
    if (a.terceiros) this.config.terceiros = aplicar(this.config.terceiros ?? [], a.terceiros);
    if (a.pacotes) this.config.pacotes = aplicar(this.config.pacotes ?? [], a.pacotes);
    if (a.metas) this.config.metas = aplicar(this.config.metas ?? [], a.metas);
    this.historico.push({ id: String(this.historico.length), tabela: "config", registroId: "-", acao: "alterou", antes: null, depois: null, autor: "Claude (conector)", em: "" });
  }
  async listarMembros() {
    return [];
  }
  async listarPedidos() {
    return this.pedidos;
  }
  async decidirPedido(): Promise<never> {
    throw new Error("O conector não aprova.");
  }
  async cancelarPedido() {}
  async proporExcecao(p: { clienteId: string | null; afetados: string[]; assinatura: string; descricao: string; dados: DadosExcecao }) {
    const id = novoId();
    this.pedidos.push({
      id, tipo: "excecao", descricao: p.descricao, itens: [], dados: p.dados, assinatura: p.assinatura, clienteId: p.clienteId, afetados: p.afetados,
      impacto: null, status: "pendente", motivo: null, autorNome: "Claude (conector)", autorPessoaId: null, criadoEm: "", decididoEm: null, aprovacoes: [],
    });
    return { pedidoId: id, status: "pendente" as const, aguardando: p.afetados };
  }
  async listarAvisos() {
    return this.avisos;
  }
  async criarAvisos(a: NovoAviso[]) {
    this.avisos.push(...a.map((x) => ({ ...x, id: novoId(), criadoEm: "", lidoEm: null })));
  }
  async marcarAvisoLido() {}
  leads: import("../calculo/crm").Lead[] = [];
  interacoes: import("../calculo/crm").InteracaoLead[] = [];
  async listarLeads() {
    return structuredClone(this.leads);
  }
  async salvarLead(l: import("../calculo/crm").Lead) {
    this.leads = [...this.leads.filter((x) => x.id !== l.id), l];
  }
  async salvarInteracao(i: import("../calculo/crm").InteracaoLead) {
    this.interacoes.push(i);
  }
  async listarInteracoes(leadId: string) {
    return this.interacoes.filter((i) => i.leadId === leadId);
  }
  // com código pessoal, o banco assina em nome do sócio
  async usuarioAtual() {
    return { id: "u", nome: "Mônica (pelo Claude)", email: "", papel: "admin", pessoaId: "p1" };
  }
  contexto: NotaContexto[] = [];
  async listarContexto(clienteId: string, incluirResolvidas = false) {
    return this.contexto.filter((n) => n.clienteId === clienteId && (incluirResolvidas || !n.resolvidoEm)).reverse();
  }
  async anotarContexto(n: { clienteId: string; tipo: NotaContexto["tipo"]; texto: string }) {
    const nota: NotaContexto = { id: novoId(), ...n, autorNome: "Mônica (pelo Claude)", peloClaude: true, criadoEm: new Date().toISOString(), resolvidoEm: null, resolvidoPorNome: null };
    this.contexto.push(nota);
    return nota;
  }
  async salvarTarefas(ts: import("../calculo/tarefas").Tarefa[]) {
    for (const t of ts) await this.salvarTarefa(t);
  }
  datas: import("../calculo/datas").DataComemorativa[] = [];
  ligacoes: import("../calculo/datas").DataDoCliente[] = [];
  async listarDatas() {
    return { datas: structuredClone(this.datas), ligacoes: structuredClone(this.ligacoes) };
  }
  async salvarDataComemorativa(d: import("../calculo/datas").DataComemorativa) {
    this.datas = [...this.datas.filter((x) => x.id !== d.id), d];
  }
  async removerDataComemorativa(id: string) {
    this.datas = this.datas.filter((x) => x.id !== id);
  }
  async salvarDataDoCliente(l: import("../calculo/datas").DataDoCliente) {
    this.ligacoes = [...this.ligacoes.filter((x) => x.id !== l.id), l];
  }
  async removerDataDoCliente(id: string) {
    this.ligacoes = this.ligacoes.filter((x) => x.id !== id);
  }
  fechamento: import("../calculo/fechamento").RegistroFechamento[] = [];
  async listarFechamento(clienteId: string) {
    return this.fechamento.filter((r) => r.clienteId === clienteId);
  }
  async salvarPassoFechamento(p: { clienteId: string; passo: import("../calculo/fechamento").RegistroFechamento["passo"]; feito: boolean; link?: string | null; data?: string | null }) {
    const antes = this.fechamento.find((r) => r.clienteId === p.clienteId && r.passo === p.passo);
    const r = {
      id: antes?.id ?? novoId(),
      clienteId: p.clienteId,
      passo: p.passo,
      feitoEm: p.feito ? (antes?.feitoEm ?? "2026-10-01T12:00:00Z") : null,
      feitoPorNome: p.feito ? "Mônica (pelo Claude)" : null,
      link: p.link !== undefined ? p.link : (antes?.link ?? null),
      data: p.data !== undefined ? p.data : (antes?.data ?? null),
      observacao: null,
    };
    this.fechamento = [...this.fechamento.filter((x) => x !== antes), r];
  }
  modeloContrato: import("../calculo/contrato").ModeloContrato = { contratadaNome: null, contratadaDocumento: null, contratadaEndereco: null, obrigacoes: null, disposicoes: null, signatariosAden: [] };
  contratos: import("../calculo/contrato").ContratoEnviado[] = [];
  async obterModeloContrato() {
    return structuredClone(this.modeloContrato);
  }
  async salvarModeloContrato(m: import("../calculo/contrato").ModeloContrato) {
    this.modeloContrato = structuredClone(m);
  }
  async listarContratosAssinatura(clienteId: string) {
    return this.contratos.filter((c) => c.clienteId === clienteId);
  }
  async registrarContratoAssinatura(c: { clienteId: string; autentiqueId: string; nome: string; signatarios: { nome: string; email: string }[] }) {
    this.contratos.unshift({ ...c, id: novoId(), situacao: "enviado", enviadoEm: "2026-10-01T12:00:00Z", enviadoPorNome: "Mônica (pelo Claude)", assinadoEm: null, conferidoEm: null, faltam: [] });
  }
  async atualizarContratoAssinatura(id: string, s: { situacao: import("../calculo/contrato").ContratoEnviado["situacao"]; assinadoEm: string | null; faltam: string[] }) {
    this.contratos = this.contratos.map((c) => (c.id === id ? { ...c, ...s } : c));
  }
  perguntasBriefing: import("../calculo/briefing").PerguntaBriefing[] = [];
  respostasBriefing: import("../calculo/briefing").RespostaBriefing[] = [];
  async listarPerguntasBriefing() {
    return structuredClone(this.perguntasBriefing);
  }
  async salvarPerguntaBriefing(p: import("../calculo/briefing").PerguntaBriefing) {
    this.perguntasBriefing = [...this.perguntasBriefing.filter((x) => x.id !== p.id), p];
  }
  async listarRespostasBriefing(clienteId: string) {
    return this.respostasBriefing.filter((r) => r.clienteId === clienteId);
  }
  async responderBriefing(clienteId: string, perguntaId: string, resposta: string | null) {
    const p = this.perguntasBriefing.find((x) => x.id === perguntaId)!;
    this.respostasBriefing = [
      ...this.respostasBriefing.filter((r) => !(r.clienteId === clienteId && r.perguntaId === perguntaId)),
      { id: novoId(), clienteId, perguntaId, perguntaTexto: p.pergunta, resposta: resposta?.trim() || null, respondidoPorNome: "Mônica (pelo Claude)", respondidoEm: "2026-10-01" },
    ];
  }
  async resolverContexto(id: string, resolvida: boolean) {
    this.contexto = this.contexto.map((n) => (n.id === id ? { ...n, resolvidoEm: resolvida ? "2026-09-30" : null, resolvidoPorNome: resolvida ? "Mônica (pelo Claude)" : null } : n));
  }
  async gerarLinkPainel(clienteId: string) {
    const c = this.config.clientes.find((x) => x.id === clienteId)!;
    c.painelToken = "t".repeat(48);
    return c.painelToken;
  }
  async enviarParaCliente(id: string) {
    this.tarefas = this.tarefas.map((t) => (t.id === id ? { ...t, status: "revisao" as const, visivelCliente: true, enviadaClienteEm: "agora" } : t));
  }
  tarefas: import("../calculo/tarefas").Tarefa[] = [];
  async listarTarefas() {
    return this.tarefas;
  }
  async salvarTarefa(t: import("../calculo/tarefas").Tarefa) {
    this.tarefas = [...this.tarefas.filter((x) => x.id !== t.id), t];
  }
  async removerTarefa(id: string) {
    this.tarefas = this.tarefas.filter((x) => x.id !== id);
  }
  async listarMedicoes() {
    return this.medicoes;
  }
  async salvarMedicao(m: Medicao) {
    this.medicoes = [...this.medicoes.filter((x) => x.id !== m.id), m];
  }
  async removerMedicao(id: string) {
    this.medicoes = this.medicoes.filter((x) => x.id !== id);
  }
  async listarPagamentos() {
    return this.pagamentos;
  }
  async salvarPagamento(p: Pagamento) {
    this.pagamentos = [...this.pagamentos.filter((x) => x.id !== p.id), p];
  }
  async removerPagamento(id: string) {
    this.pagamentos = this.pagamentos.filter((x) => x.id !== id);
  }
  async listarSimulacoes() {
    return this.sims.map((s) => ({ id: s.id, nome: s.nome, atualizadoEm: s.atualizadoEm, cenarios: s.cenarios.length }));
  }
  async carregarSimulacao(id: string) {
    return this.sims.find((s) => s.id === id) ?? null;
  }
  async salvarSimulacao(sim: Simulacao) {
    this.sims = [...this.sims.filter((s) => s.id !== sim.id), { ...sim, atualizadoEm: "agora" }];
  }
  async removerSimulacao(id: string) {
    this.sims = this.sims.filter((s) => s.id !== id);
  }
  async listarAuditoria() {
    return this.historico;
  }
  meses: Record<string, Record<string, import("../calculo/mes").RegistroMesCliente>> = {};
  async definirEscopoCliente(id: string, escopo: import("../calculo/tipos").Cenario | null) {
    const c = this.config.clientes.find((x) => x.id === id)!;
    c.escopo = escopo;
  }
  async carregarMes(m: string) {
    return this.meses[m] ?? {};
  }
  async salvarMesCliente(m: string, id: string, r: import("../calculo/mes").RegistroMesCliente) {
    (this.meses[m] ??= {})[id] = r;
  }
}

let banco: BancoFalso;
let cliente: Client;

async function chamar(nome: string, args: Record<string, unknown> = {}) {
  const r = (await cliente.callTool({ name: nome, arguments: args })) as { content: { text: string }[]; isError?: boolean };
  const texto = r.content[0].text;
  if (r.isError) throw new Error(texto);
  try {
    return JSON.parse(texto);
  } catch {
    return texto;
  }
}

beforeEach(async () => {
  banco = new BancoFalso();
  const servidor = criarServidorMcp(async () => banco as unknown as RepositorioSupabase);
  const [a, b] = InMemoryTransport.createLinkedPair();
  await servidor.connect(a);
  cliente = new Client({ name: "teste", version: "1" });
  await cliente.connect(b);
});

describe("conector MCP da Aden", () => {
  it("expõe as ferramentas e as instruções", async () => {
    const { tools } = await cliente.listTools();
    const nomes = tools.map((t) => t.name);
    for (const n of ["ver_configuracao", "salvar_socio", "salvar_tipo_entrega", "calcular_cenario", "salvar_simulacao", "ver_historico"])
      expect(nomes).toContain(n);
    expect(cliente.getInstructions()).toContain("NUNCA invente");
  });

  it("configura por nome, em reais, e calcula igual ao site", async () => {
    await chamar("salvar_socio", { nome: "Moni", percentualPadrao: 50, pisoHoraReais: 50, capacidadeHorasMes: 100 });
    await chamar("salvar_socio", { nome: "Áleff", percentualPadrao: 50, pisoHoraReais: 50, capacidadeHorasMes: 100 });
    await chamar("definir_percentuais_empresa", { reinvestimentoPct: 10, impostoPct: 6, taxaRecebimentoPct: 4, regraRateio: "igual" });
    await chamar("salvar_servico", { nome: "Social media", divisao: { moni: 100 } });
    await chamar("salvar_tipo_entrega", { nome: "Post simples", servico: "social media", horasPorUnidade: 2 });
    await chamar("salvar_tipo_entrega", { nome: "Reels editado", audiovisual: true });

    // piso de R$ 50 guardado em centavos, alterar só um campo mantém os outros
    expect(banco.config.pessoas[0].pisoHoraCentavos).toBe(5000);
    await chamar("salvar_socio", { id: "Moni", capacidadeHorasMes: 120 });
    expect(banco.config.pessoas[0].pisoHoraCentavos).toBe(5000);
    expect(banco.config.pessoas[0].capacidadeHorasMes).toBe(120);

    const r = await chamar("calcular_cenario", {
      cenario: {
        nome: "Teste",
        modo: "valor",
        mensalidadeReais: 3000,
        trafego: { modelo: "sem_trafego" },
        entregas: [
          { tipo: "post simples", quantidade: 10 },
          { tipo: "Reels editado", quantidade: 4 },
        ],
      },
    });
    expect(r.mes.receitaBruta).toBe(3000);
    expect(r.mes.horasNoMes).toBe(20); // vídeo de terceiro não soma horas
    expect(r.alertas.some((a: string) => a.includes("entrega de vídeo"))).toBe(true);
    expect(r.mes.socios.find((s: { nome: string }) => s.nome === "Moni").horas).toBe(20);
  });

  it("salva, lê e substitui simulações (aparecem no site)", async () => {
    await chamar("salvar_socio", { nome: "Moni", percentualPadrao: 100 });
    const salva = await chamar("salvar_simulacao", {
      nome: "Olinda",
      cenarios: [{ nome: "A", modo: "valor", mensalidadeReais: 2000, trafego: { modelo: "incluido" } }],
    });
    expect(banco.sims).toHaveLength(1);
    const lida = await chamar("ver_simulacao", { id: "olinda" });
    expect(lida.cenarios[0].cenario.mensalidadeReais).toBe(2000);
    await chamar("salvar_simulacao", {
      id: salva.id,
      nome: "Olinda",
      cenarios: [lida.cenarios[0].cenario, { ...lida.cenarios[0].cenario, id: undefined, nome: "B", mensalidadeReais: 2500 }],
    });
    expect(banco.sims).toHaveLength(1);
    expect(banco.sims[0].cenarios).toHaveLength(2);
    expect(banco.sims[0].cenarios[1].mensalidadeCentavos).toBe(250000);
  });

  it("escopo contratado, visão do mês e saúde do cliente", async () => {
    await chamar("salvar_socio", { nome: "Moni", percentualPadrao: 100, pisoHoraReais: 45, capacidadeHorasMes: 44 });
    await chamar("salvar_servico", { nome: "Social", divisao: { Moni: 100 } });
    await chamar("salvar_tipo_entrega", { nome: "Post", servico: "Social", horasPorUnidade: 2 });
    await chamar("salvar_cliente", { nome: "Olinda", valorMensalReais: 1500 });
    await chamar("definir_escopo_cliente", {
      cliente: "olinda",
      cenario: { nome: "Contrato", modo: "valor", trafego: { modelo: "sem_trafego" }, entregas: [{ tipo: "Post", quantidade: 10 }] },
    });
    const v = await chamar("ver_visao_do_mes");
    expect(v.socios[0].horasUsadasPelosClientes).toBe(20);
    expect(v.socios[0].horasLivres).toBe(24);

    await chamar("registrar_mes_cliente", { cliente: "Olinda", competencia: "2026-09", horas: { Moni: 40 } });
    const s = await chamar("ver_saude_clientes", { competencia: "2026-09" });
    // 1500 ÷ 40 h = 37,50/h < piso 45
    expect(s.clientes[0].socios[0].porHoraReal).toBe(37.5);
    expect(s.clientes[0].prejuizoSilencioso).toBe(true);
  });

  it("mudança protegida pelo conector fica pendente de aprovação do sócio", async () => {
    await chamar("salvar_socio", { nome: "Moni", percentualPadrao: 100, pisoHoraReais: 45 });
    const r = await chamar("salvar_socio", { id: "Moni", pisoHoraReais: 30 });
    expect(r.protegido).toMatch(/PENDENTES.*Moni/);
    expect(banco.config.pessoas[0].pisoHoraCentavos).toBe(4500); // vale o antigo
    const ap = await chamar("ver_aprovacoes");
    expect(ap.pedidos[0].status).toBe("pendente");
    expect(ap.pedidos[0].afetados[0].socio).toBe("Moni");
  });

  it("escopo abaixo do piso vira pedido de exceção; pagamentos e calibragem", async () => {
    await chamar("salvar_socio", { nome: "Moni", percentualPadrao: 100, pisoHoraReais: 45, capacidadeHorasMes: 44 });
    await chamar("salvar_servico", { nome: "Social", divisao: { Moni: 100 } });
    await chamar("salvar_tipo_entrega", { nome: "Carrossel", servico: "Social", minutosPorUnidade: 40 });
    expect(banco.config.tiposEntrega[0].horasPorUnidade).toBeCloseTo(40 / 60);
    await chamar("salvar_cliente", { nome: "Olinda", valorMensalReais: 100 });
    const e = await chamar("definir_escopo_cliente", {
      cliente: "Olinda",
      cenario: { nome: "Contrato", modo: "valor", mensalidadeReais: 100, entregas: [{ tipo: "Carrossel", quantidade: 10 }] },
    });
    expect(e.gravado).toBe(false);
    expect(e.situacao).toMatch(/Pedido de exceção/);
    expect(banco.config.clientes[0].escopo ?? null).toBeNull();

    // sem ordem de distribuição: registra, mas a distribuição fica bloqueada
    const p1 = await chamar("registrar_pagamento", { cliente: "Olinda", valorReais: 50, competencia: "2026-09", recebidoEm: "2026-09-10" });
    expect(p1.distribuicaoBloqueada).toMatch(/ordem de distribuição/);
    await chamar("definir_percentuais_empresa", { ordemDistribuicao: "proporcional", regime: "mei" });
    const mes = await chamar("ver_pagamentos_do_mes", { competencia: "2026-09" });
    expect(mes.clientes[0].entrou).toBe(50);
    expect(mes.socios[0].jaRecebeu).toBeGreaterThan(0);

    await chamar("definir_percentuais_empresa", { medicoesCalibragem: 2 });
    await chamar("registrar_medicao", { entrega: "Carrossel", minutos: 55 });
    const m = await chamar("registrar_medicao", { entrega: "Carrossel", minutos: 55 });
    expect(m.situacao).toBe("calibrado");
    expect(m.sugestao).toMatch(/55 min, não 40 min/);
  });

  it("tarefas: cria, edita e concluir encerra o tempo medido", async () => {
    const nova = await chamar("salvar_tarefa", { titulo: "Calendário Outubro", checklist: [{ titulo: "Pauta" }] });
    expect(nova.criada).toBe(true);
    await chamar("salvar_tarefa", { id: nova.id, quantidade: 3, vencimento: "2026-10-01" });
    await expect(chamar("salvar_tarefa", { id: nova.id, vencimento: "01/10" })).rejects.toThrow(/AAAA-MM-DD/);
    const agora = new Date().toISOString();
    banco.medicoes.push({ id: "m1", tarefaId: nova.id, clienteId: null, tipoEntregaId: "t", pessoaId: null, estado: "pausado", acumuladoSegundos: 600, retomadoEm: null, fim: null, criadoEm: agora });
    await chamar("mudar_status_tarefa", { id: nova.id, status: "concluida" });
    expect(banco.medicoes[0].estado).toBe("concluido");
    expect(banco.medicoes[0].unidades).toBe(3);
    const lista = await chamar("listar_tarefas", { incluirConcluidas: true });
    expect(lista[0]).toMatchObject({ titulo: "Calendário Outubro", quantidade: 3, status: "Concluída", tempoMedidoMin: 10, checklist: ["[ ] Pauta"] });
    expect(await chamar("listar_tarefas")).toHaveLength(0);
  });

  it("nome inexistente gera erro claro, sem gravar nada", async () => {
    await expect(chamar("salvar_tipo_entrega", { nome: "X", servico: "Inexistente" })).rejects.toThrow(/Serviço "Inexistente" não encontrado/);
    expect(banco.config.tiposEntrega).toHaveLength(0);
  });
});

describe("conector: terceiros, pacotes e metas", () => {
  it("pacote tem preço calculado; meta só com o que foi dito", async () => {
    await chamar("salvar_socio", { nome: "Moni", percentualPadrao: 100, pisoHoraReais: 60 });
    await chamar("salvar_servico", { nome: "Social media", divisao: { Moni: 100 } });
    await chamar("definir_percentuais_empresa", { regraRateio: "igual", reinvestimentoPct: 0, impostoPct: 0, taxaRecebimentoPct: 0 });
    await chamar("salvar_tipo_entrega", { nome: "Post", servico: "Social media", minutosPorUnidade: 60 });
    await chamar("salvar_terceiro", { nome: "Audiovisual", valorPorSaidaReais: 300, deslocamentoMedioReais: 50, fraseCliente: "gravação e edição mensal inclusa" });
    await chamar("salvar_tipo_entrega", { nome: "Gravação", terceiro: "Audiovisual" });
    // escolher o terceiro já tira a entrega das horas dos sócios
    expect(banco.config.tiposEntrega.find((t) => t.nome === "Gravação")).toMatchObject({ audiovisual: true });
    const p = await chamar("salvar_pacote", { nome: "Padrão", rotina: [{ entrega: "Post", quantidade: 4 }, { entrega: "Gravação", quantidade: 1 }], primeiroMes: [] });
    expect(p.manutencaoMensal).toBe(590);
    const [v] = await chamar("ver_pacotes");
    expect(v.oQueOClienteLe).toContain("gravação e edição mensal inclusa");
    expect(v.padrao).toBe(true);
    await chamar("salvar_meta", { nome: "Primeiro degrau", criterio: "faturamento_mensal", alvo: 5000, acao: "primeira terceirização" });
    const m = await chamar("ver_metas");
    expect(m.degraus[0]).toMatchObject({ alvo: 5000, atual: 0, conquistada: false, acao: "primeira terceirização" });
    expect(m.degrauAtual).toBe(1);
  });
});

describe("conector: CRM", () => {
  it("lead do começo ao fim: cria, conversa, fecha e vira cliente", async () => {
    await chamar("salvar_lead", { nome: "Loja Aurora", origem: "indicação", valorEstimadoReais: 1800, proximoContato: "2026-09-30" });
    await expect(chamar("salvar_lead", { id: "Loja Aurora", proximoContato: "30/09" })).rejects.toThrow(/AAAA-MM-DD/);
    await chamar("registrar_conversa_lead", { id: "Loja Aurora", texto: "Pediu proposta", tipo: "whatsapp", proximaAcao: "mandar proposta" });
    await chamar("mover_lead", { id: "Loja Aurora", etapa: "proposta_enviada" });
    const l = await chamar("listar_leads");
    expect(l.leads[0]).toMatchObject({ nome: "Loja Aurora", etapa: "Proposta enviada", valorEstimadoMensal: 1800, proximaAcao: "mandar proposta" });
    expect(banco.interacoes).toHaveLength(1);
    const g = await chamar("ganhar_lead", { id: "Loja Aurora" });
    expect(g.escopo).toMatch(/sem proposta/);
    expect(banco.config.clientes.map((c) => c.nome)).toContain("Loja Aurora");
    expect(banco.leads[0]).toMatchObject({ etapa: "ganho", clienteId: g.clienteId });
    expect((await chamar("listar_leads")).leads).toHaveLength(0);
  });
});

describe("conector: decisões de 29/09", () => {
  it("regra da sociedade, custo bancado por sócio, follow-up e mês visto de cima", async () => {
    await chamar("salvar_socio", { nome: "Mônica", percentualPadrao: 50 });
    await chamar("salvar_socio", { nome: "Áleff", percentualPadrao: 50 });
    await chamar("definir_regras_sociedade", {
      socioDoPercentual: "Mônica",
      percentualDoSocio: 30,
      tetoDaViradaReais: 15000,
      avisoDeBonusReais: 3400,
      socioDaSobra: "Áleff",
      percentualDaSobraParaTrafego: 100,
      trafegoProprioMinimoReais: 1500,
    });
    expect(banco.config.empresa).toMatchObject({ sociedadePctSocio: 30, sociedadeTetoViradaCentavos: 1500000, trafegoProprioMinimoCentavos: 150000 });
    await chamar("salvar_custo_fixo", { nome: "Contador", valorMensalReais: 300, pagoPor: "Áleff" });
    await chamar("salvar_custo_fixo", { nome: "Plano grande", valorMensalReais: 550, planejado: true });
    const cfg = await chamar("ver_configuracao");
    expect(cfg.custosFixos.find((c: { nome: string }) => c.nome === "Contador").pagoPor).toBe("Áleff");
    expect(cfg.custosFixos.find((c: { nome: string }) => c.nome === "Plano grande")).toMatchObject({ planejado: true, ativo: false });
    await chamar("salvar_cliente", { nome: "Loja", valorMensalReais: 3000 });
    await chamar("registrar_pagamento", { cliente: "Loja", valorReais: 500, competencia: "2026-10", recebidoEm: "2026-10-05", taxaReais: 20 });
    const m = await chamar("ver_mes_visto_de_cima", { competencia: "2026-10" });
    expect(m.entrou).toBe(500);
    expect(m.taxasDeRecebimento).toBe(20);
    expect(m.socios.find((x: { socio: string }) => x.socio === "Mônica").parte).toBe(150);
    expect(m.bancadoPor).toEqual([{ socio: "Áleff", valor: 300, itens: ["Contador"] }]);
    await chamar("definir_percentuais_empresa", { followUpsMaximo: 2 });
    await chamar("salvar_lead", { nome: "Padaria", comercialEstruturado: false });
    await chamar("registrar_conversa_lead", { id: "Padaria", texto: "vou ver", tipo: "follow_up" });
    const r = await chamar("registrar_conversa_lead", { id: "Padaria", texto: "vou ver de novo", tipo: "follow_up" });
    expect(r.followUpsFeitos).toBe(2);
    expect(r.sugestao).toMatch(/perdido/);
    expect(banco.leads.find((l) => l.nome === "Padaria")!.comercialEstruturado).toBe(false);
  });
});

describe("conector: clientes", () => {
  it("ficha e contrato do cliente", async () => {
    await chamar("salvar_cliente", { nome: "Olinda", valorMensalReais: 1500 });
    await chamar("salvar_ficha_cliente", { cliente: "Olinda", telefone: "81 9999", diaPagamento: 10, inicioContrato: "2026-01-15", prazoMinimoMeses: 6 });
    await expect(chamar("salvar_ficha_cliente", { cliente: "Olinda", fimContrato: "15/01" })).rejects.toThrow(/AAAA-MM-DD/);
    const f = await chamar("ver_cliente", { cliente: "Olinda" });
    expect(f.contato.telefone).toBe("81 9999");
    expect(f.contrato).toMatchObject({ valorMensal: 1500, diaPagamento: 10, fidelidadeAte: "2026-07-15" });
  });
});

describe("conector: contexto do cliente", () => {
  it("anota com quem anotou, lista só as ativas e resolve sem apagar", async () => {
    await chamar("salvar_cliente", { nome: "Olinda", valorMensalReais: 1500 });
    const a = await chamar("anotar_contexto_cliente", { cliente: "Olinda", tipo: "preferencia", texto: "Aprova pelo WhatsApp de manhã" });
    expect(a.anotado).toMatchObject({ tipo: "preferência", quem: "Mônica (pelo Claude)" });
    await chamar("anotar_contexto_cliente", { cliente: "Olinda", tipo: "pendencia", texto: "Mandar fotos da loja" });
    expect((await chamar("ver_cliente", { cliente: "Olinda" })).contextoTotal).toBe(2);
    await chamar("resolver_nota_contexto", { id: a.anotado.id });
    const ativas = await chamar("ver_contexto_cliente", { cliente: "Olinda" });
    expect(ativas.notas.map((n: { texto: string }) => n.texto)).toEqual(["Mandar fotos da loja"]);
    const todas = await chamar("ver_contexto_cliente", { cliente: "Olinda", resolvidas: true });
    expect(todas.notas).toHaveLength(2);
    expect(todas.notas.find((n: { id: string }) => n.id === a.anotado.id).resolvida.por).toBe("Mônica (pelo Claude)");
    await expect(chamar("anotar_contexto_cliente", { cliente: "Olinda", tipo: "outro", texto: "x" })).rejects.toThrow();
  });
});

describe("conector: planejamento mensal, datas e atalhos", () => {
  it("importa o planejamento de uma vez: planejado, visível ao cliente, com rede e lote internos", async () => {
    await chamar("salvar_cliente", { nome: "Olinda", valorMensalReais: 1500 });
    await chamar("salvar_tipo_entrega", { nome: "Post simples" });
    await chamar("salvar_tipo_entrega", { nome: "Reels" });
    const r = await chamar("importar_planejamento_mensal", {
      cliente: "Olinda",
      lote: "Calendário Outubro — Olinda",
      pecas: [
        { titulo: "Dicionário: Entretela", tipo: "Post simples", textoArte: "ENTRETELA", legenda: "Legenda", rede: "instagram", publicarEm: "2026-10-02" },
        { titulo: "Tour pela loja", tipo: "Reels", publicarEm: "2026-10-04 18:30" },
      ],
    });
    expect(r.criadas).toBe(2);
    expect(r.pecas.map((p: { etapa: string }) => p.etapa)).toEqual(["planejado", "planejado"]);
    const t = banco.tarefas.find((x) => x.titulo === "Dicionário: Entretela")!;
    expect(t).toMatchObject({ visivelCliente: true, rede: "instagram", lote: "Calendário Outubro — Olinda", status: "a_fazer", vencimento: "2026-10-02", textoArte: "ENTRETELA" });
    expect(t.publicarEm).toBe("2026-10-02T15:00:00.000Z");
    const lista = await chamar("listar_tarefas", { lote: "calendário outubro — olinda" });
    expect(lista).toHaveLength(2);
    // tipo que não existe: nada é gravado
    await expect(
      chamar("importar_planejamento_mensal", { cliente: "Olinda", lote: "X", pecas: [{ titulo: "a", tipo: "Post simples" }, { titulo: "b", tipo: "Sticker" }] }),
    ).rejects.toThrow(/Nada foi gravado.*Sticker/);
    expect(banco.tarefas).toHaveLength(2);
  });

  it("datas comemorativas com a janela de cada cliente", async () => {
    await chamar("salvar_cliente", { nome: "Olinda", valorMensalReais: 1500 });
    await chamar("salvar_cliente", { nome: "Stadium", valorMensalReais: 1500 });
    await chamar("salvar_data_comemorativa", { nome: "Black Friday", data: "2026-11-27" });
    await chamar("salvar_data_comemorativa", { nome: "Dia das Crianças", data: "2026-10-12" });
    await chamar("ligar_data_ao_cliente", { data: "Black Friday", cliente: "Olinda", diasAntecedencia: 60 });
    await chamar("ligar_data_ao_cliente", { data: "Black Friday", cliente: "Stadium", diasAntecedencia: 45 });
    await chamar("ligar_data_ao_cliente", { data: "Dia das Crianças", cliente: "Olinda", diasAntecedencia: 45, nota: "roupinhas" });
    const o = await chamar("datas_do_mes", { mes: "2026-10", cliente: "Olinda" });
    expect(o.datasDoMes).toEqual([{ nome: "Dia das Crianças", data: "2026-10-12", diasAntecedencia: 45, nota: "roupinhas" }]);
    expect(o.campanhasQueComecam[0]).toMatchObject({ nome: "Black Friday", janelaAbreEm: "2026-09-28", situacao: "já aberta (começou antes)" });
    const s = await chamar("datas_do_mes", { mes: "2026-10", cliente: "Stadium" });
    expect(s.campanhasQueComecam[0]).toMatchObject({ janelaAbreEm: "2026-10-13", situacao: "abre neste mês" });
    await chamar("ligar_data_ao_cliente", { data: "Black Friday", cliente: "Stadium", escondida: true });
    expect((await chamar("datas_do_mes", { mes: "2026-10", cliente: "Stadium" })).campanhasQueComecam).toEqual([]);
    const todas = await chamar("ver_datas_comemorativas", { cliente: "Olinda" });
    expect(todas).toHaveLength(2);
  });

  it("atalhos do painel: só https, só os campos enviados mudam", async () => {
    await chamar("salvar_cliente", { nome: "Olinda", valorMensalReais: 1500 });
    await expect(chamar("atualizar_atalhos_painel", { cliente: "Olinda", fotosUrl: "drive.google.com/x" })).rejects.toThrow(/https/);
    await chamar("atualizar_atalhos_painel", { cliente: "Olinda", planejamentoUrl: "https://a.com/plano.pdf", planejamentoRotulo: "Planejamento de outubro" });
    await chamar("atualizar_atalhos_painel", { cliente: "Olinda", inclusoTexto: "15 posts\nReunião mensal" });
    const f = await chamar("ver_cliente", { cliente: "Olinda" });
    expect(f.atalhosDoPainel).toMatchObject({ planejamentoUrl: "https://a.com/plano.pdf", planejamentoRotulo: "Planejamento de outubro", inclusoTexto: "15 posts\nReunião mensal", fotosUrl: null });
  });
});

describe("conector: fechamento do cliente", () => {
  it("abre o checklist, marca na ordem, kickoff com data vira tarefa e o CRM tem as etapas novas", async () => {
    await chamar("salvar_lead", { nome: "Loja Nova", valorEstimadoReais: 2000 });
    await chamar("mover_lead", { id: "Loja Nova", etapa: "pesquisa" });
    await chamar("mover_lead", { id: "Loja Nova", etapa: "reuniao" });
    await chamar("ganhar_lead", { id: "Loja Nova" });
    const v0 = await chamar("ver_fechamento", { cliente: "Loja Nova" });
    expect(v0.fechamentos[0]).toMatchObject({ feitos: "0 de 7", proximo: "Onboarding enviado" });
    await chamar("marcar_passo_fechamento", { cliente: "Loja Nova", passo: "onboarding" });
    await expect(chamar("marcar_passo_fechamento", { cliente: "Loja Nova", passo: "contrato", link: "autentique.com/x" })).rejects.toThrow(/https/);
    await chamar("marcar_passo_fechamento", { cliente: "Loja Nova", passo: "contrato", link: "https://assina.exemplo/doc" });
    const k = await chamar("marcar_passo_fechamento", { cliente: "Loja Nova", passo: "kickoff", data: "2026-10-05" });
    expect(k).toMatchObject({ tarefaCriada: "Kickoff · Loja Nova", feitos: "3 de 7", proximo: "Cobrança criada" });
    expect(banco.tarefas.find((t) => t.titulo === "Kickoff · Loja Nova")?.vencimento).toBe("2026-10-05");
    // marcar o kickoff de novo não duplica a tarefa
    await chamar("marcar_passo_fechamento", { cliente: "Loja Nova", passo: "kickoff", data: "2026-10-06" });
    expect(banco.tarefas.filter((t) => t.titulo === "Kickoff · Loja Nova")).toHaveLength(1);
    const todos = await chamar("ver_fechamento", {});
    expect(todos.mensalidadeNoOnboarding).toBe("a definir");
    expect(todos.fechamentos).toHaveLength(1);
  });
});

describe("conector: contrato pela Autentique", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("mostra o que falta, não envia incompleto e, completo, envia e marca o fechamento quando todos assinam", async () => {
    await chamar("salvar_cliente", { nome: "Loja X", valorMensalReais: 2000 });
    const v0 = await chamar("ver_contrato", { cliente: "Loja X" });
    expect(v0.pronto).toBe(false);
    expect(v0.faltando).toContain("Obrigações das partes (Configurações → Contrato)");
    await expect(chamar("enviar_contrato", { cliente: "Loja X" })).rejects.toThrow(/Falta preencher/);

    banco.config.tiposEntrega = [{ id: "t", nome: "Post", servicoId: null, horasPorUnidade: 1, ativo: true }];
    const c = banco.config.clientes[0];
    c.escopo = { ...(c.escopo ?? (await import("../calculo/novo")).novoCenario("x")), entregas: [{ id: "e", tipoEntregaId: "t", quantidade: 4, horasPorUnidade: null }] };
    await chamar("salvar_ficha_cliente", { cliente: "Loja X", email: "ana@loja.com", contato: "Ana", documento: "000.000.000-00", endereco: "Rua A", inicioContrato: "2026-10-01", diaPagamento: 10 });
    await chamar("salvar_modelo_contrato", {
      contratadaNome: "Aden",
      contratadaDocumento: "11.111.111/0001-11",
      obrigacoes: "Texto dos sócios.",
      disposicoes: "Foro.",
      signatariosAden: [{ nome: "Mônica", email: "m@aden.com" }],
    });
    const v1 = await chamar("ver_contrato", { cliente: "Loja X" });
    expect(v1).toMatchObject({ pronto: true, faltando: [], autentique: "não ligada (falta a chave na Vercel)" });
    await expect(chamar("enviar_contrato", { cliente: "Loja X" })).rejects.toThrow(/AUTENTIQUE_TOKEN/);

    vi.stubEnv("AUTENTIQUE_TOKEN", "chave-teste");
    let assinou = false;
    const pedidos: RequestInit[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        pedidos.push(init);
        if (init.body instanceof FormData) return new Response(JSON.stringify({ data: { createDocument: { id: "doc-1" } } }));
        const sig = (email: string) => ({ name: email, email, action: { name: "SIGN" }, signed: assinou ? { created_at: "2026-10-02 10:00:00" } : null, rejected: null });
        return new Response(JSON.stringify({ data: { document: { signatures: [sig("ana@loja.com"), sig("m@aden.com")] } } }));
      }),
    );
    const env = await chamar("enviar_contrato", { cliente: "Loja X" });
    expect(env.para).toEqual(["Ana <ana@loja.com>", "Mônica <m@aden.com>"]);
    expect((pedidos[0].headers as Record<string, string>).Authorization).toBe("Bearer chave-teste");
    await expect(chamar("enviar_contrato", { cliente: "Loja X" })).rejects.toThrow(/esperando assinatura/);

    expect((await chamar("conferir_contrato", { cliente: "Loja X" }))[0]).toMatchObject({ situacao: "enviado", faltam: ["ana@loja.com", "m@aden.com"] });
    expect(banco.fechamento.find((r) => r.passo === "contrato")).toBeUndefined();
    assinou = true;
    expect((await chamar("conferir_contrato", { cliente: "Loja X" }))[0]).toMatchObject({ situacao: "assinado" });
    expect(banco.fechamento.find((r) => r.passo === "contrato")?.feitoEm).toBeTruthy();
  });
});

describe("conector: briefing do cliente", () => {
  it("perguntas dos sócios, respostas com quem respondeu, contagem do que falta", async () => {
    await chamar("salvar_cliente", { nome: "Olinda", valorMensalReais: 1500 });
    await expect(chamar("salvar_pergunta_briefing", { pergunta: "Sem seção" })).rejects.toThrow(/seção/);
    const p1 = await chamar("salvar_pergunta_briefing", { secao: "Sobre o negócio", pergunta: "O que vocês vendem e pra quem?" });
    await chamar("salvar_pergunta_briefing", { secao: "Sobre o negócio", pergunta: "Quem aprova as peças?" });
    const r = await chamar("responder_briefing", { cliente: "Olinda", respostas: [{ pergunta: p1.id, resposta: "Máquinas de costura" }] });
    expect(r.respondidas).toBe("1 de 2");
    await chamar("responder_briefing", { cliente: "Olinda", respostas: [{ pergunta: "quem aprova as peças?", resposta: "A Regi" }] });
    const v = await chamar("ver_briefing", { cliente: "Olinda" });
    expect(v.respondidas).toBe("2 de 2");
    expect(v.secoes[0].perguntas[1]).toMatchObject({ resposta: "A Regi", quem: "Mônica (pelo Claude)" });
    await expect(chamar("responder_briefing", { cliente: "Olinda", respostas: [{ pergunta: "Não existe", resposta: "x" }] })).rejects.toThrow(/não encontrada/);
  });
});

describe("conector: painel do cliente", () => {
  it("desligado: o conector não oferece as ferramentas do painel", async () => {
    const nomes = (await cliente.listTools()).tools.map((t) => t.name);
    expect(nomes.includes("link_painel_cliente")).toBe(PAINEL_CLIENTE_ATIVO);
    expect(nomes.includes("enviar_para_cliente_aprovar")).toBe(PAINEL_CLIENTE_ATIVO);
  });

  // só roda quando o painel for religado (lib/recursos.ts)
  it.runIf(PAINEL_CLIENTE_ATIVO)("link e envio para aprovação", async () => {
    await chamar("salvar_cliente", { nome: "Olinda", valorMensalReais: 1500 });
    const l1 = await chamar("link_painel_cliente", { cliente: "Olinda" });
    expect(l1.link).toMatch(/\/c\/t{48}$/);
    const t = await chamar("salvar_tarefa", { titulo: "Post dia 10" });
    await expect(chamar("enviar_para_cliente_aprovar", { id: t.id })).rejects.toThrow(/não tem cliente/);
    await chamar("salvar_tarefa", { id: t.id, cliente: "Olinda" });
    await chamar("enviar_para_cliente_aprovar", { id: t.id, legenda: "Oi!" });
    expect(banco.tarefas[0]).toMatchObject({ status: "revisao", visivelCliente: true, legenda: "Oi!" });
    const [lt] = await chamar("listar_tarefas");
    expect(lt.noPainelDoCliente).toBe("aguardando");
  });
});
