// Números aqui são só fixtures de teste — não são regra nem sugestão de preço.
import { describe, expect, it } from "vitest";
import { afetadosDoItem, separarProtegidas } from "../regras/aprovacao";
import { configVazia, novoCenario } from "./novo";
import { distribuirPagamentos, type Pagamento } from "./pagamentos";
import { calcularMesDeCima, mesQueEstouraOTeto, taxaDoPagamento } from "./sociedade";
import type { Configuracao } from "./tipos";

function config(): Configuracao {
  const c = configVazia();
  c.empresa = {
    regime: "mei",
    reinvestimentoPct: 0,
    impostoPct: 0,
    taxaRecebimentoPct: 0,
    regraRateio: "igual",
    impostoFixoMensalCentavos: 9000,
    ordemDistribuicao: "custo_primeiro",
    socioPercentualId: "m",
    sociedadePctSocio: 30,
    sociedadeTetoViradaCentavos: 1_500_000,
    sociedadeAvisoBonusCentavos: 340_000,
    socioSobraId: "a",
    sociedadeSobraTrafegoPct: 100,
    trafegoProprioMinimoCentavos: 150_000,
  };
  c.pessoas = [
    { id: "m", nome: "M", socio: true, percentualPadrao: 50, pisoHoraCentavos: null, capacidadeHorasMes: null, ativo: true },
    { id: "a", nome: "A", socio: true, percentualPadrao: 50, pisoHoraCentavos: null, capacidadeHorasMes: null, ativo: true },
  ];
  c.custosFixos = [
    { id: "f1", nome: "Contador", valorMensalCentavos: 30000, ativo: true, pagoPorPessoaId: "a" },
    { id: "f2", nome: "Canva", valorMensalCentavos: 3500, ativo: true, pagoPorPessoaId: "m" },
    { id: "f3", nome: "Hospedagem", valorMensalCentavos: 10000, ativo: true },
    { id: "f4", nome: "Plano grande", valorMensalCentavos: 55000, ativo: false, planejado: true },
  ];
  c.clientes = [
    { id: "c1", nome: "C1", interno: false, participaRateio: true, valorMensalCentavos: 300000, ativo: true, escopo: { ...novoCenario("c1"), clienteId: "c1" } },
    { id: "c2", nome: "C2", interno: false, participaRateio: true, valorMensalCentavos: 150000, ativo: true, escopo: { ...novoCenario("c2"), clienteId: "c2" } },
  ];
  return c;
}

const pg = (id: string, clienteId: string, valor: number, recebidoEm: string, taxa: number | null = null): Pagamento => ({
  id,
  clienteId,
  competencia: recebidoEm.slice(0, 7),
  valorCentavos: valor,
  recebidoEm,
  taxaCentavos: taxa,
});

describe("mês visto de cima", () => {
  it("antes da virada: 30% do que entrou para M; custos do caixa e o resto para o tráfego", () => {
    const m = calcularMesDeCima(config(), [pg("1", "c1", 300000, "2026-10-20"), pg("2", "c2", 150000, "2026-10-30")], "2026-10");
    expect(m.divisao).toBe("percentual");
    expect(m.entrouCentavos).toBe(450000);
    const pm = m.socios.find((s) => s.pessoaId === "m")!;
    expect(pm.parteCentavos).toBeCloseTo(135000); // 30% de 4.500
    // caixa: hospedagem 100 + DAS 90 (contador e Canva são bancados por sócio)
    expect(m.custosFixosCaixaCentavos).toBe(10000);
    expect(m.impostoFixoCentavos).toBe(9000);
    expect(m.bancadoPor.map((b) => [b.pessoaId, b.centavos])).toEqual([
      ["a", 30000],
      ["m", 3500],
    ]);
    // sobra = 4500 − 1350 − 100 − 90 = 2960, toda para o tráfego (100%)
    expect(m.trafegoProprioCentavos).toBeCloseTo(296000);
    expect(m.socios.find((s) => s.pessoaId === "a")!.parteCentavos).toBeCloseTo(0);
    expect(m.completaTrafego).toBeNull();
    expect(m.faltaParaViradaCentavos).toBe(1_050_000);
  });

  it("parcial gera 30% do parcial; tráfego abaixo do mínimo é completado por A", () => {
    const m = calcularMesDeCima(config(), [pg("1", "c1", 50000, "2026-10-05")], "2026-10");
    expect(m.socios.find((s) => s.pessoaId === "m")!.parteCentavos).toBeCloseTo(15000);
    // sobra = 500 − 150 − 100 − 90 = 160 → tráfego 160, falta 1340 para o mínimo
    expect(m.completaTrafego).toEqual({ pessoaId: "a", nome: "A", centavos: 134000 });
    expect(m.trafegoProprioCentavos).toBe(150000);
    expect(m.socios.find((s) => s.pessoaId === "a")!.parteCentavos).toBeCloseTo(-134000);
  });

  it("A escolhe tirar parte da sobra: o % do tráfego manda", () => {
    const c = config();
    c.empresa.sociedadeSobraTrafegoPct = 60;
    c.empresa.trafegoProprioMinimoCentavos = null;
    const m = calcularMesDeCima(c, [pg("1", "c1", 300000, "2026-10-20")], "2026-10");
    // sobra = 3000 − 900 − 100 − 90 = 1910 → 60% tráfego, 40% A
    expect(m.trafegoProprioCentavos).toBeCloseTo(114600);
    expect(m.socios.find((s) => s.pessoaId === "a")!.parteCentavos).toBeCloseTo(76400);
  });

  it("bônus: o que passar do aviso aparece destacado", () => {
    const m = calcularMesDeCima(config(), [pg("1", "c1", 1_300_000, "2026-10-20")], "2026-10");
    const pm = m.socios.find((s) => s.pessoaId === "m")!;
    expect(pm.parteCentavos).toBeCloseTo(390000);
    expect(pm.bonusCentavos).toBeCloseTo(50000);
  });

  it("imposto em % sai antes dos 30% (fora do MEI) e o DAS deixa de contar", () => {
    const c = config();
    c.empresa.regime = "outro";
    c.empresa.impostoPct = 8;
    c.empresa.impostoFixoMensalCentavos = null;
    const m = calcularMesDeCima(c, [pg("1", "c1", 1_000_000, "2026-10-20")], "2026-10");
    expect(m.impostoCentavos).toBeCloseTo(80000);
    expect(m.socios.find((s) => s.pessoaId === "m")!.parteCentavos).toBeCloseTo(276000); // 30% de 9.200
  });

  it("da virada para cima: tráfego fica com o mínimo e a sobra é dividida meio a meio", () => {
    const m = calcularMesDeCima(config(), [pg("1", "c1", 1_600_000, "2026-10-20")], "2026-10");
    expect(m.divisao).toBe("virada");
    expect(m.trafegoProprioCentavos).toBe(150000);
    // sobra = 16000 − 100 − 90 − 1500 = 14310 → 7155 cada
    for (const s of m.socios) expect(s.parteCentavos).toBeCloseTo(715500);
  });

  it("taxa do pagamento: a real (cartão) vence o padrão", () => {
    const c = config();
    c.empresa.taxaRecebimentoPct = 0;
    expect(taxaDoPagamento(c, pg("1", "c1", 100000, "2026-10-01"))).toBe(0);
    expect(taxaDoPagamento(c, pg("2", "c1", 100000, "2026-10-01", 4990))).toBe(4990);
    const m = calcularMesDeCima(c, [pg("2", "c1", 100000, "2026-10-01", 4990)], "2026-10");
    expect(m.taxasCentavos).toBe(4990);
  });

  it("custo planejado: avisa quando a sobra cobre e ainda deixa o tráfego no mínimo", () => {
    const pouco = calcularMesDeCima(config(), [pg("1", "c1", 300000, "2026-10-20")], "2026-10");
    // sobra 1910 − mínimo 1500 = 410 < 550
    expect(pouco.planejados[0].cabe).toBe(false);
    const muito = calcularMesDeCima(config(), [pg("1", "c1", 500000, "2026-10-20")], "2026-10");
    // sobra = 5000 − 1500 − 190 = 3310; folga 1810 ≥ 550
    expect(muito.planejados[0].cabe).toBe(true);
    expect(muito.alertas.some((a) => a.texto.includes("Plano grande"))).toBe(true);
  });

  it("pagamento conta no mês em que caiu", () => {
    const m = calcularMesDeCima(config(), [pg("1", "c1", 300000, "2026-11-02")], "2026-10");
    expect(m.entrouCentavos).toBe(0);
  });
});

describe("distribuição de cada pagamento com a regra", () => {
  it("antes da virada, o pagamento parcial dá 30% do parcial para M, mesmo com custo por cobrir", () => {
    const c = config();
    const d = distribuirPagamentos(c, c.clientes[0], "2026-10", [pg("1", "c1", 50000, "2026-10-05")], "2026-10-10");
    expect(d.bloqueio).toBeNull();
    expect(d.totais.socios.m).toBeCloseTo(15000);
  });
});

describe("teto anual (MEI)", () => {
  it("diz o mês em que a soma do ano passa do teto", () => {
    const c = config();
    c.empresa.tetoFaturamentoAnualCentavos = 8_100_000;
    // jan–set: 4.500/mês já entrou = 40.500; de out em diante, 4.500/mês de contrato
    const pags = Array.from({ length: 9 }, (_, i) => pg(`p${i}`, "c1", 450000, `2026-${String(i + 1).padStart(2, "0")}-10`));
    expect(mesQueEstouraOTeto(c, pags, "2026-10-01")).toBeNull(); // 12 × 4.500 = 54.000
    c.clientes[0].valorMensalCentavos = 3_000_000; // 31.500/mês de contrato
    expect(mesQueEstouraOTeto(c, pags, "2026-10-01")).toBe("2026-11"); // 40.500 + 31.500 + 31.500 > 81.000
  });
});


describe("proteção dos números da sociedade", () => {
  const alt = (c: Configuracao, empresa: Configuracao["empresa"]) => ({
    empresa,
    pessoas: { salvar: [], remover: [] },
    servicos: { salvar: [], remover: [] },
    tiposEntrega: { salvar: [], remover: [] },
    custosFixos: { salvar: [], remover: [] },
    clientes: { salvar: [], remover: [] },
  });

  it("mudar o % ou o teto vira pedido para os dois; o % do tráfego, só para quem fica com a sobra", () => {
    const c = config();
    const sep = separarProtegidas(c, alt(c, { ...c.empresa, sociedadePctSocio: 35, sociedadeSobraTrafegoPct: 50 }));
    expect(sep.itens.map((i) => i.campo).sort()).toEqual(["sociedade_pct_socio", "sociedade_sobra_trafego_pct"]);
    // até aprovar, vale o valor antigo
    expect(sep.alteracoes.empresa!.sociedadePctSocio).toBe(30);
    const pct = sep.itens.find((i) => i.campo === "sociedade_pct_socio")!;
    const trafego = sep.itens.find((i) => i.campo === "sociedade_sobra_trafego_pct")!;
    expect(afetadosDoItem(c, pct).sort()).toEqual(["a", "m"]);
    expect(afetadosDoItem(c, trafego)).toEqual(["a"]);
  });

  it("campo vazio pode ser preenchido direto; quem é quem não troca depois de escolhido", () => {
    const c = config();
    c.empresa.sociedadeAvisoBonusCentavos = null;
    const sep = separarProtegidas(c, alt(c, { ...c.empresa, sociedadeAvisoBonusCentavos: 340000, socioPercentualId: "a" }));
    expect(sep.itens).toEqual([]);
    expect(sep.primeirosPreenchimentos.map((i) => i.campo)).toEqual(["sociedade_aviso_bonus_centavos"]);
    expect(sep.alteracoes.empresa!.socioPercentualId).toBe("m");
  });
});
