// Números aqui são só fixtures de teste.
import { describe, expect, it } from "vitest";
import { calcularSaudeCliente, calcularVisaoMes } from "./mes";
import { calcularCenario, calcularComReceita, calcularMinimo, prepararMes } from "./motor";
import { configVazia, novoCenario } from "./novo";
import type { Cenario, Configuracao } from "./tipos";

function config(): Configuracao {
  const c = configVazia();
  c.empresa = { reinvestimentoPct: 10, impostoPct: 0, taxaRecebimentoPct: 0, regraRateio: "igual" };
  c.pessoas = [
    { id: "a", nome: "A", socio: true, percentualPadrao: 50, pisoHoraCentavos: 5000, capacidadeHorasMes: 40, ativo: true },
    { id: "b", nome: "B", socio: true, percentualPadrao: 50, pisoHoraCentavos: 5000, capacidadeHorasMes: 40, ativo: true },
  ];
  c.servicos = [
    { id: "s1", nome: "Social", divisaoPadrao: { a: 100 }, ativo: true },
    { id: "s2", nome: "Tráfego", divisaoPadrao: { b: 100 }, ativo: true },
  ];
  c.tiposEntrega = [
    { id: "post", nome: "Post", servicoId: "s1", horasPorUnidade: 2, ativo: true },
    { id: "camp", nome: "Campanha", servicoId: "s2", horasPorUnidade: 5, ativo: true },
  ];
  c.custosFixos = [{ id: "f", nome: "Ferramentas", valorMensalCentavos: 60000, ativo: true }];
  return c;
}

function escopo(posts: number, camps: number): Cenario {
  const e = novoCenario("contratado");
  e.trafego.modelo = "incluido";
  e.entregas = [
    { id: "1", tipoEntregaId: "post", quantidade: posts, horasPorUnidade: null },
    { id: "2", tipoEntregaId: "camp", quantidade: camps, horasPorUnidade: null },
  ];
  return e;
}

describe("visão do mês", () => {
  it("soma as horas de todos os clientes ativos e bate com a capacidade", () => {
    const c = config();
    c.clientes = [
      { id: "c1", nome: "C1", interno: false, participaRateio: true, valorMensalCentavos: 300000, ativo: true, escopo: escopo(10, 2) },
      { id: "c2", nome: "C2", interno: false, participaRateio: true, valorMensalCentavos: 200000, ativo: true, escopo: escopo(6, 4) },
      { id: "c3", nome: "C3", interno: false, participaRateio: true, valorMensalCentavos: 100000, ativo: true },
      { id: "c4", nome: "Antigo", interno: false, participaRateio: true, valorMensalCentavos: 100000, ativo: false, escopo: escopo(50, 50) },
    ];
    const v = calcularVisaoMes(c);
    const a = v.socios.find((s) => s.id === "a")!;
    const b = v.socios.find((s) => s.id === "b")!;
    expect(a.horasUsadas).toBe(32); // (10 + 6) × 2
    expect(a.horasLivres).toBe(8);
    expect(a.situacao).toBe("ok");
    expect(b.horasUsadas).toBe(30); // (2 + 4) × 5
    expect(v.semEscopo).toEqual(["C3"]);
    expect(v.faturamentoMensalCentavos).toBe(600000);
  });

  it("marca afogado acima da capacidade e folga sobrando abaixo do limite configurado", () => {
    const c = config();
    c.empresa.ociosidadePct = 50;
    c.clientes = [{ id: "c1", nome: "C1", interno: false, participaRateio: true, valorMensalCentavos: 300000, ativo: true, escopo: escopo(25, 2) }];
    const v = calcularVisaoMes(c);
    expect(v.socios.find((s) => s.id === "a")!.situacao).toBe("afogado"); // 50 h de 40
    expect(v.socios.find((s) => s.id === "b")!.situacao).toBe("folga_sobrando"); // 10 h = 25%
  });

  it("sem limite de folga configurado, não marca folga sobrando", () => {
    const c = config();
    c.clientes = [{ id: "c1", nome: "C1", interno: false, participaRateio: true, valorMensalCentavos: 300000, ativo: true, escopo: escopo(1, 0) }];
    expect(calcularVisaoMes(c).socios.find((s) => s.id === "a")!.situacao).toBe("ok");
  });
});

describe("saúde do cliente", () => {
  it("valor por hora real usa as horas lançadas e o valor recebido", () => {
    const c = config();
    const cli = { id: "c1", nome: "C1", interno: false, participaRateio: true, valorMensalCentavos: 300000, ativo: true, escopo: escopo(10, 2) };
    c.clientes = [cli];
    const s = calcularSaudeCliente(c, cli, { valorRecebidoCentavos: null, horas: { a: 40, b: 10 } });
    // sobra = 3000 − 600 (rateio, único cliente) = 2400; −10% = 2160; A fica com 1080
    const a = s.socios.find((x) => x.id === "a")!;
    expect(a.horasPrevistas).toBe(20);
    expect(a.valorHoraPrevisto).toBeCloseTo(108000 / 20);
    expect(a.valorHoraReal).toBeCloseTo(108000 / 40);
    expect(a.abaixoPisoReal).toBe(true); // 27/h < 50/h
    expect(s.prejuizoSilencioso).toBe(true);
    expect(s.valorCobradoHoraReal).toBeCloseTo(300000 / 50);
    expect(s.contratadoAbaixoDoPiso).toBe(false); // previsto 54/h ≥ 50/h
  });

  it("sem horas lançadas, o realizado usa a previsão e não acusa prejuízo silencioso", () => {
    const c = config();
    const cli = { id: "c1", nome: "C1", interno: false, participaRateio: true, valorMensalCentavos: 300000, ativo: true, escopo: escopo(10, 2) };
    c.clientes = [cli];
    const s = calcularSaudeCliente(c, cli, null);
    expect(s.realizado!.horasTotais).toBe(s.horasPrevistas);
    expect(s.socios.every((x) => x.semRegistro)).toBe(true);
    expect(s.prejuizoSilencioso).toBe(false);
    expect(s.previsto).not.toBeNull();
  });
});

describe("imposto fixo, taxa fixa, custo outro, teto e proposta", () => {
  it("imposto fixo mensal (MEI) entra no rateio como custo da empresa", () => {
    const c = config();
    c.empresa.impostoFixoMensalCentavos = 7000;
    const r = calcularComReceita(prepararMes(c, escopo(1, 0)), 300000);
    expect(r.rateio.totalFixoCentavos).toBe(67000);
    expect(r.rateio.impostoFixoCentavos).toBe(7000);
    expect(r.rateio.quotaCentavos).toBe(67000); // único cliente
  });

  it("taxa fixa por recebimento entra quando há receita e o mínimo considera", () => {
    const c = config();
    c.empresa.taxaRecebimentoFixaCentavos = 500;
    const prep = prepararMes(c, escopo(10, 2));
    expect(calcularComReceita(prep, 300000).taxasCentavos).toBe(500);
    expect(calcularComReceita(prep, 0).taxasCentavos).toBe(0);
    const m = calcularMinimo(prep);
    expect(m.resultado!.pessoas.find((p) => p.id === "a")!.valorHoraCentavos!).toBeGreaterThanOrEqual(5000 - 0.01);
  });

  it("custo 'outro' (diária, deslocamento) soma nos custos do cenário", () => {
    const e = escopo(1, 0);
    e.custos = [
      { id: "d", categoria: "outro", descricao: "Diária de gravação", forma: "fixo", valorCentavos: 25000, tipoEntregaId: null },
      { id: "u", categoria: "outro", descricao: "Uber", forma: "fixo", valorCentavos: 4000, tipoEntregaId: null },
    ];
    const r = calcularComReceita(prepararMes(config(), e), 300000);
    expect(r.custosPorCategoria.outro).toBe(29000);
    expect(r.custosProjetoCentavos).toBe(29000);
  });

  it("avisa perto do teto e quando estoura", () => {
    const c = config();
    c.empresa.tetoFaturamentoAnualCentavos = 8100000;
    c.empresa.avisoTetoPct = 80;
    c.clientes = [{ id: "c1", nome: "C1", interno: false, participaRateio: true, valorMensalCentavos: 500000, ativo: true }];
    const e = { ...escopo(1, 0), modo: "valor" as const, mensalidadeCentavos: 100000 };
    const perto = calcularCenario(c, e); // (5000 + 1000) × 12 = 72.000 = 88,9%
    expect(perto.teto!.nivel).toBe("perto");
    expect(perto.alertas.some((a) => a.texto.includes("do teto"))).toBe(true);
    const estoura = calcularCenario(c, { ...e, mensalidadeCentavos: 300000 });
    expect(estoura.teto!.nivel).toBe("estourou");
  });

  it("proposta: um valor só, com rateio embutido, arredondado para cima se configurado", () => {
    const c = config();
    c.empresa.arredondamentoPropostaCentavos = 10000;
    const r = calcularCenario(c, escopo(10, 2));
    expect(r.proposta!.valorCentavos % 10000).toBe(0);
    expect(r.proposta!.valorCentavos).toBeGreaterThanOrEqual(r.minimo.receitaMinimaCentavos!);
    expect(r.proposta!.valorCentavos - r.minimo.receitaMinimaCentavos!).toBeLessThan(10000);
  });
});
