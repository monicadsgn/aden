// Teste de ponta a ponta do conector: cliente MCP ↔ servidor, com banco em memória.
// Números aqui são só fixtures de teste.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { beforeEach, describe, expect, it } from "vitest";
import type { Medicao } from "../calculo/calibragem";
import { configVazia, novoId } from "../calculo/novo";
import type { Pagamento } from "../calculo/pagamentos";
import type { Configuracao } from "../calculo/tipos";
import { afetados, aplicarItens, separarProtegidas } from "../regras/aprovacao";
import type { AlteracoesConfig, AvisoSocio, DadosExcecao, NovoAviso, Pedido, RegistroAuditoria, ResultadoSalvarConfig, Simulacao } from "../dados/repositorio";
import type { RepositorioSupabase } from "../dados/supabase";
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
