// Números aqui são só fixtures de teste — não são regra nem sugestão de preço.
import { describe, expect, it } from "vitest";
import { calcularComReceita, calcularMinimo, prepararMes } from "./motor";
import { configVazia, novoCenario } from "./novo";
import type { Cenario, Configuracao } from "./tipos";

function config(): Configuracao {
  const c = configVazia();
  c.empresa = { reinvestimentoPct: 0, impostoPct: 10, taxaRecebimentoPct: 0, regraRateio: "igual" };
  c.pessoas = [
    { id: "m", nome: "M", socio: true, percentualPadrao: 50, pisoHoraCentavos: 5000, capacidadeHorasMes: 100, ativo: true },
    { id: "a", nome: "A", socio: true, percentualPadrao: 50, pisoHoraCentavos: 5000, capacidadeHorasMes: 100, ativo: true },
  ];
  c.servicos = [
    { id: "s1", nome: "Social", divisaoPadrao: { m: 100 }, ativo: true },
    { id: "s2", nome: "Tráfego", divisaoPadrao: { a: 100 }, ativo: true },
  ];
  c.tiposEntrega = [
    { id: "post", nome: "Post", servicoId: "s1", horasPorUnidade: 1, ativo: true },
    { id: "camp", nome: "Campanha", servicoId: "s2", horasPorUnidade: 1, ativo: true },
  ];
  c.custosFixos = [{ id: "f", nome: "Ferramentas", valorMensalCentavos: 20000, ativo: true }];
  return c;
}

function comRegra(c: Configuracao, teto = 1_000_000): Configuracao {
  c.empresa.socioPercentualId = "m";
  c.empresa.sociedadePctSocio = 30;
  c.empresa.sociedadeTetoViradaCentavos = teto;
  c.empresa.socioSobraId = "a";
  return c;
}

function cenario(posts: number, camps: number): Cenario {
  const e = novoCenario("x");
  e.trafego.modelo = "sem_trafego";
  e.entregas = [
    { id: "1", tipoEntregaId: "post", quantidade: posts, horasPorUnidade: null },
    { id: "2", tipoEntregaId: "camp", quantidade: camps, horasPorUnidade: null },
  ];
  return e;
}

describe("divisão entre os sócios (regra de 29/09)", () => {
  it("sem a regra configurada, divide a sobra pelo % padrão (como antes)", () => {
    const r = calcularComReceita(prepararMes(config(), cenario(10, 10)), 300000);
    expect(r.divisao.tipo).toBe("sobra");
    // sobra = 3000 − 300 imposto − 200 rateio = 2500 → 1250 cada
    expect(r.pessoas.find((p) => p.id === "m")!.valorCentavos).toBeCloseTo(125000);
  });

  it("antes da virada: o sócio do % recebe 30% do que entra depois do imposto; o outro fica com o resto", () => {
    const r = calcularComReceita(prepararMes(comRegra(config()), cenario(10, 10)), 300000);
    expect(r.divisao.tipo).toBe("percentual");
    const m = r.pessoas.find((p) => p.id === "m")!;
    const a = r.pessoas.find((p) => p.id === "a")!;
    expect(m.valorCentavos).toBeCloseTo(81000); // 30% de (3000 − 300)
    expect(a.valorCentavos).toBeCloseTo(250000 - 81000); // sobra − parte dela
    expect(m.regraParte).toContain("30%");
  });

  it("taxa de recebimento sai do resto, não da base dos 30%", () => {
    const c = comRegra(config());
    c.empresa.taxaRecebimentoPct = 5;
    const r = calcularComReceita(prepararMes(c, cenario(10, 10)), 300000);
    expect(r.pessoas.find((p) => p.id === "m")!.valorCentavos).toBeCloseTo(81000);
  });

  it("do teto para cima (contratos ativos + este cenário), vale a divisão da sobra", () => {
    const c = comRegra(config(), 500000);
    c.clientes = [{ id: "c1", nome: "C1", interno: false, participaRateio: true, valorMensalCentavos: 300000, ativo: true }];
    const r = calcularComReceita(prepararMes(c, cenario(10, 10)), 300000); // 3000 + 3000 ≥ 5000
    expect(r.divisao.tipo).toBe("sobra");
    expect(r.pessoas.find((p) => p.id === "m")!.percentual).toBe(50);
  });

  it("valor mínimo com a regra: todos com horas chegam ao piso", () => {
    const prep = prepararMes(comRegra(config()), cenario(10, 10));
    const min = calcularMinimo(prep);
    expect(min.possivel).toBe(true);
    const r = min.resultado!;
    for (const p of r.pessoas) expect(p.valorCentavos!).toBeGreaterThanOrEqual(p.pisoHoraCentavos! * p.horas - 1);
    // R$ 1 a menos já não atende alguém
    const antes = calcularComReceita(prep, min.mensalidadeMinimaCentavos! - 100);
    expect(antes.pessoas.some((p) => p.valorCentavos! < p.pisoHoraCentavos! * p.horas - 0.5)).toBe(true);
    // M precisa de 500 → 30% de 90% de R ≥ 500 → R ≥ 1851,85
    expect(min.mensalidadeMinimaCentavos!).toBeGreaterThanOrEqual(185185);
  });

  it("tráfego com garantia: horas contam, receita de gestão não", () => {
    const e = cenario(0, 5);
    e.trafego.modelo = "garantia";
    e.trafego.valorFixoCentavos = 100000;
    const prep = prepararMes(config(), e);
    expect(prep.receitaTrafego).toBe(0);
    expect(prep.horasPorPessoa.get("a")).toBe(5);
    expect(prep.alertas.some((x) => x.texto.includes("garantia"))).toBe(true);
  });
});
