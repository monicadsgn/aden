// Teste de ponta a ponta do conector: cliente MCP ↔ servidor, com banco em memória.
// Números aqui são só fixtures de teste.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { beforeEach, describe, expect, it } from "vitest";
import { configVazia } from "../calculo/novo";
import type { Configuracao } from "../calculo/tipos";
import type { AlteracoesConfig, RegistroAuditoria, Simulacao } from "../dados/repositorio";
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
  async salvarConfig(a: AlteracoesConfig) {
    if (a.empresa) this.config.empresa = a.empresa;
    this.config.pessoas = aplicar(this.config.pessoas, a.pessoas);
    this.config.servicos = aplicar(this.config.servicos, a.servicos);
    this.config.tiposEntrega = aplicar(this.config.tiposEntrega, a.tiposEntrega);
    this.config.custosFixos = aplicar(this.config.custosFixos, a.custosFixos);
    this.config.clientes = aplicar(this.config.clientes, a.clientes);
    this.historico.push({ id: String(this.historico.length), tabela: "config", registroId: "-", acao: "alterou", antes: null, depois: null, autor: "Claude (conector)", em: "" });
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

  it("nome inexistente gera erro claro, sem gravar nada", async () => {
    await expect(chamar("salvar_tipo_entrega", { nome: "X", servico: "Inexistente" })).rejects.toThrow(/Serviço "Inexistente" não encontrado/);
    expect(banco.config.tiposEntrega).toHaveLength(0);
  });
});
