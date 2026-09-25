// Números aqui são só fixtures de teste — não são sugestão de preço nem regra.
import { describe, expect, it } from "vitest";
import { calcularCenario, calcularComReceita, calcularMinimo, prepararMes } from "./motor";
import { configVazia, novoCenario } from "./novo";
import type { Cenario, Configuracao } from "./tipos";

function config(): Configuracao {
  const c = configVazia();
  c.empresa = { reinvestimentoPct: 10, impostoPct: 6, taxaRecebimentoPct: 4, regraRateio: "igual" };
  c.pessoas = [
    { id: "a", nome: "A", socio: true, percentualPadrao: 50, pisoHoraCentavos: 5000, capacidadeHorasMes: 100, ativo: true },
    { id: "b", nome: "B", socio: true, percentualPadrao: 50, pisoHoraCentavos: 5000, capacidadeHorasMes: 100, ativo: true },
  ];
  c.servicos = [
    { id: "s1", nome: "Social", divisaoPadrao: { a: 100 }, ativo: true },
    { id: "s2", nome: "Tráfego", divisaoPadrao: { b: 100 }, ativo: true },
  ];
  c.tiposEntrega = [
    { id: "post", nome: "Post", servicoId: "s1", horasPorUnidade: 2, ativo: true },
    { id: "camp", nome: "Campanha", servicoId: "s2", horasPorUnidade: 5, ativo: true },
  ];
  c.custosFixos = [{ id: "f", nome: "Assinaturas", valorMensalCentavos: 30000, ativo: true }];
  c.clientes = [
    { id: "c1", nome: "C1", interno: false, participaRateio: true, valorMensalCentavos: 200000, ativo: true },
    { id: "c2", nome: "C2", interno: false, participaRateio: true, valorMensalCentavos: 100000, ativo: true },
  ];
  return c;
}

function cenario(): Cenario {
  const c = novoCenario("A");
  c.trafego.modelo = "sem_trafego";
  c.entregas = [
    { id: "l1", tipoEntregaId: "post", quantidade: 10, horasPorUnidade: null },
    { id: "l2", tipoEntregaId: "camp", quantidade: 2, horasPorUnidade: null },
  ];
  c.custos = [{ id: "k1", categoria: "ferramenta", descricao: "x", forma: "fixo", valorCentavos: 10000, tipoEntregaId: null }];
  return c;
}

describe("cálculo do mês", () => {
  it("segue a cascata receita → sobra → reinvestimento → sócios", () => {
    const prep = prepararMes(config(), cenario());
    const r = calcularComReceita(prep, 300000);
    expect(r.receitaBrutaCentavos).toBe(300000);
    expect(r.impostosCentavos).toBe(18000);
    expect(r.taxasCentavos).toBe(12000);
    expect(r.rateio.clientesNaBase).toBe(3); // cliente novo entra na base
    expect(r.rateio.quotaCentavos).toBe(10000);
    expect(r.sobraCentavos).toBe(300000 - 18000 - 12000 - 10000 - 10000);
    expect(r.reinvestimentoCentavos).toBeCloseTo(25000);
    const a = r.pessoas.find((p) => p.id === "a")!;
    expect(a.horas).toBe(20);
    expect(a.valorCentavos).toBeCloseTo(112500);
    expect(a.valorHoraCentavos).toBeCloseTo(5625);
    const b = r.pessoas.find((p) => p.id === "b")!;
    expect(b.horas).toBe(10);
    expect(b.valorHoraCentavos).toBeCloseTo(11250);
    expect(r.horasTotais).toBe(30);
    expect(r.custoHoraCentavos).toBeCloseTo(20000 / 30);
    expect(r.valorCobradoHoraCentavos).toBeCloseTo(10000);
    expect(a.consumoCapacidadePct).toBeCloseTo(20);
  });

  it("alerta quando o valor por hora fica abaixo do piso", () => {
    const r = calcularComReceita(prepararMes(config(), cenario()), 150000);
    expect(r.pessoas.find((p) => p.id === "a")!.abaixoPiso).toBe(true);
    expect(r.alertas.some((x) => x.nivel === "erro" && x.texto.includes("abaixo do piso"))).toBe(true);
  });

  it("bloqueia a divisão quando os percentuais não somam 100", () => {
    const c = cenario();
    c.sobreposicoes.percentualPessoa = { a: 70 };
    const r = calcularComReceita(prepararMes(config(), c), 300000);
    expect(r.percentuaisValidos).toBe(false);
    expect(r.pessoas[0].valorCentavos).toBeNull();
  });

  it("divide as horas de um serviço entre pessoas", () => {
    const c = cenario();
    c.sobreposicoes.divisaoServico = { s1: { a: 60, b: 40 } };
    const r = calcularComReceita(prepararMes(config(), c), 300000);
    expect(r.pessoas.find((p) => p.id === "a")!.horas).toBeCloseTo(12);
    expect(r.pessoas.find((p) => p.id === "b")!.horas).toBeCloseTo(18);
    expect(r.servicos.find((s) => s.servicoId === "s1")!.divisaoSobreposta).toBe(true);
  });

  it("começa sem nenhum número: config e cenário vazios não quebram", () => {
    const r = calcularCenario(configVazia(), novoCenario("X"));
    expect(r.alertas.length).toBeGreaterThan(0);
  });
});

describe("rateio", () => {
  it("cliente existente substitui a si mesmo na base", () => {
    const c = cenario();
    c.clienteId = "c1";
    const r = calcularComReceita(prepararMes(config(), c), 300000);
    expect(r.rateio.clientesNaBase).toBe(2);
    expect(r.rateio.quotaCentavos).toBe(15000);
  });

  it("proporcional ao valor", () => {
    const cfg = config();
    cfg.empresa.regraRateio = "proporcional";
    const r = calcularComReceita(prepararMes(cfg, cenario()), 300000);
    // 30000 × 300000 / (300000 + 300000)
    expect(r.rateio.quotaCentavos).toBeCloseTo(15000);
  });

  it("sem regra escolhida gera erro", () => {
    const cfg = config();
    cfg.empresa.regraRateio = null;
    const r = calcularComReceita(prepararMes(cfg, cenario()), 300000);
    expect(r.alertas.some((a) => a.texto.includes("regra de rateio"))).toBe(true);
    expect(r.rateio.quotaCentavos).toBe(0);
  });
});

describe("verba de mídia", () => {
  it("é só informativa: não muda nenhum número quando o modelo não é percentual", () => {
    const base = cenario();
    base.trafego = { ...base.trafego, modelo: "fixo", valorFixoCentavos: 50000 };
    const comVerba = { ...base, trafego: { ...base.trafego, verbaMensalCentavos: 10000000 } };
    const r1 = calcularComReceita(prepararMes(config(), base), 300000);
    const r2 = calcularComReceita(prepararMes(config(), comVerba), 300000);
    expect(r2.receitaBrutaCentavos).toBe(r1.receitaBrutaCentavos);
    expect(r2.impostosCentavos).toBe(r1.impostosCentavos);
    expect(r2.taxasCentavos).toBe(r1.taxasCentavos);
    expect(r2.sobraCentavos).toBe(r1.sobraCentavos);
    expect(r2.verbaMidiaCentavos).toBe(10000000);
  });

  it("no percentual da verba, fatura só a gestão; imposto e taxa incidem só sobre ela", () => {
    const c = cenario();
    c.trafego = { ...c.trafego, modelo: "percentual_verba", percentualVerba: 10, verbaMensalCentavos: 1000000 };
    const r = calcularComReceita(prepararMes(config(), c), 300000);
    expect(r.receitaTrafegoCentavos).toBe(100000);
    expect(r.receitaBrutaCentavos).toBe(400000); // mensalidade + gestão, sem a verba
    expect(r.impostosCentavos).toBeCloseTo(400000 * 0.06);
    expect(r.taxasCentavos).toBeCloseTo(400000 * 0.04);
  });
});

describe("valor mínimo (modo escopo)", () => {
  for (const regra of ["igual", "proporcional"] as const) {
    it(`o mínimo coloca o sócio limitante exatamente no piso (${regra})`, () => {
      const cfg = config();
      cfg.empresa.regraRateio = regra;
      const m = calcularMinimo(prepararMes(cfg, cenario()));
      expect(m.possivel).toBe(true);
      expect(m.criterio).toBe("piso");
      expect(m.limitantePessoaId).toBe("a");
      const a = m.resultado!.pessoas.find((p) => p.id === "a")!;
      expect(a.valorHoraCentavos!).toBeGreaterThanOrEqual(5000 - 0.01);
      expect(a.valorHoraCentavos!).toBeLessThan(5000 + 1);
      // um centavo a menos já fica abaixo do piso
      const menos = calcularComReceita(prepararMes(cfg, cenario()), m.mensalidadeMinimaCentavos! - 2);
      expect(menos.pessoas.find((p) => p.id === "a")!.abaixoPiso).toBe(true);
    });
  }

  it("sem piso, o mínimo é o ponto de equilíbrio", () => {
    const cfg = config();
    cfg.pessoas.forEach((p) => (p.pisoHoraCentavos = null));
    const m = calcularMinimo(prepararMes(cfg, cenario()));
    expect(m.criterio).toBe("equilibrio");
    expect(Math.abs(m.resultado!.sobraCentavos)).toBeLessThan(1);
  });

  it("desconta do mínimo o que o tráfego já cobra por fora", () => {
    const c = cenario();
    c.trafego = { ...c.trafego, modelo: "fixo", valorFixoCentavos: 50000 };
    const semTrafego = calcularMinimo(prepararMes(config(), cenario()));
    const comTrafego = calcularMinimo(prepararMes(config(), c));
    expect(comTrafego.receitaMinimaCentavos).toBe(semTrafego.receitaMinimaCentavos);
    expect(comTrafego.mensalidadeMinimaCentavos).toBe(semTrafego.mensalidadeMinimaCentavos! - 50000);
  });
});

describe("pontuais, horizonte e encaixe", () => {
  it("pontual diluído soma horas e custos divididos pelos meses", () => {
    const c = cenario();
    c.pontuais = [
      {
        id: "p",
        nome: "Branding",
        forma: "diluido",
        meses: 4,
        entregas: [{ id: "x", tipoEntregaId: "post", quantidade: 8, horasPorUnidade: null }],
        custos: [{ id: "y", categoria: "terceiro", descricao: "", forma: "fixo", valorCentavos: 40000, tipoEntregaId: null }],
        valorCobradoCentavos: null,
      },
    ];
    const r = calcularComReceita(prepararMes(config(), c), 300000);
    expect(r.horasTotais).toBe(30 + 4);
    expect(r.custoPontualDiluidoCentavos).toBe(10000);
  });

  it("pontual fora da mensalidade tem cálculo próprio, sem rateio", () => {
    const c = cenario();
    c.pontuais = [
      {
        id: "p",
        nome: "Branding",
        forma: "fora",
        meses: null,
        entregas: [{ id: "x", tipoEntregaId: "post", quantidade: 10, horasPorUnidade: null }],
        custos: [],
        valorCobradoCentavos: null,
      },
    ];
    const r = calcularCenario(config(), c);
    expect(r.pontuaisFora).toHaveLength(1);
    expect(r.pontuaisFora[0].horasTotais).toBe(20);
    expect(r.pontuaisFora[0].minimo.resultado!.rateio.quotaCentavos).toBe(0);
    expect(r.mes!.horasTotais).toBe(30); // não entra no mês
  });

  it("meses sem cobrança elevam a mensalidade necessária (opção A: não paga nada)", () => {
    const c = cenario();
    c.horizonteMeses = 12;
    c.mesesSemCobranca = 3;
    c.suspensaoSemCobranca = "tudo";
    const r = calcularCenario(config(), c);
    const a = r.horizonte!.opcoes.tudo;
    expect(a.mensalidadeNecessariaCentavos!).toBeGreaterThan(r.minimo.mensalidadeMinimaCentavos!);
    // cobrando a mensalidade necessária, a média no horizonte fica no piso
    const v = { ...c, modo: "valor" as const, mensalidadeCentavos: a.mensalidadeNecessariaCentavos };
    const rv = calcularCenario(config(), v);
    const moni = rv.horizonte!.opcoes.tudo.pessoas.find((p) => p.id === "a")!;
    expect(moni.valorHoraMedioCentavos!).toBeGreaterThanOrEqual(5000 - 0.01);
    expect(moni.valorHoraMedioCentavos!).toBeLessThan(5001);
  });

  it("opção B (paga só a gestão de tráfego) sai melhor que a A quando há cobrança de tráfego", () => {
    const c = cenario();
    c.trafego = { ...c.trafego, modelo: "fixo", valorFixoCentavos: 60000 };
    c.modo = "valor";
    c.mensalidadeCentavos = 300000;
    c.horizonteMeses = 12;
    c.mesesSemCobranca = 3;
    const r = calcularCenario(config(), c);
    const { tudo, mensalidade } = r.horizonte!.opcoes;
    expect(r.horizonte!.opcoesIguais).toBe(false);
    // nos 3 meses a gestão entra, já descontados imposto (6%) e taxa (4%)
    expect(mensalidade.sobraTotalCentavos - tudo.sobraTotalCentavos).toBeCloseTo(3 * 60000 * 0.9);
    expect(mensalidade.receitaTotalCentavos - tudo.receitaTotalCentavos).toBe(3 * 60000);
    expect(mensalidade.mensalidadeNecessariaCentavos!).toBeLessThan(tudo.mensalidadeNecessariaCentavos!);
    // sem escolher, avisa
    expect(r.alertas.some((a) => a.texto.includes("Escolha o que fica suspenso"))).toBe(true);
  });

  it("sem cobrança de tráfego, as opções A e B são iguais", () => {
    const c = cenario();
    c.horizonteMeses = 12;
    c.mesesSemCobranca = 2;
    const h = calcularCenario(config(), c).horizonte!;
    expect(h.opcoesIguais).toBe(true);
    expect(h.opcoes.tudo.mensalidadeNecessariaCentavos).toBe(h.opcoes.mensalidade.mensalidadeNecessariaCentavos);
  });

  it("modo valor mostra quantas entregas a mais cabem", () => {
    const c = cenario();
    c.modo = "valor";
    c.mensalidadeCentavos = 400000;
    const r = calcularCenario(config(), c);
    expect(r.encaixe!.disponivel).toBe(true);
    expect(r.encaixe!.cabe).toBe(true);
    const post = r.encaixe!.tipos.find((t) => t.tipoEntregaId === "post")!;
    expect(post.folga!).toBeGreaterThan(0);
    // conferir: com a folga cabe, com +1 não
    const cfg = config();
    const com = calcularComReceita(prepararMes(cfg, { ...c, entregas: [{ ...c.entregas[0], quantidade: 10 + post.folga! }, c.entregas[1]] }), 400000);
    expect(com.pessoas.find((p) => p.id === "a")!.abaixoPiso).toBe(false);
    const mais = calcularComReceita(prepararMes(cfg, { ...c, entregas: [{ ...c.entregas[0], quantidade: 11 + post.folga! }, c.entregas[1]] }), 400000);
    expect(mais.pessoas.find((p) => p.id === "a")!.abaixoPiso || mais.pessoas.find((p) => p.id === "a")!.consumoCapacidadePct! > 100).toBe(true);
  });

  it("diz qual limite trava e de qual sócio: piso (preço) ou capacidade (gente)", () => {
    const c = cenario();
    c.modo = "valor";
    c.mensalidadeCentavos = 150000;
    const r = calcularCenario(config(), c);
    expect(r.encaixe!.limitantes).toContainEqual({ tipo: "piso", pessoaId: "a", nome: "A" });

    // valor alto: quem trava a próxima unidade de post é a capacidade de A
    const cap = cenario();
    cap.modo = "valor";
    cap.mensalidadeCentavos = 100000000;
    const rc = calcularCenario(config(), cap);
    const post = rc.encaixe!.tipos.find((t) => t.tipoEntregaId === "post")!;
    expect(post.limites).toEqual([{ tipo: "capacidade", pessoaId: "a", nome: "A" }]);
    expect(post.folga).toBe(40); // (100 h − 20 h) ÷ 2 h
  });

  it("modo valor mostra quantas precisa tirar quando não cabe", () => {
    const c = cenario();
    c.modo = "valor";
    c.mensalidadeCentavos = 150000;
    const r = calcularCenario(config(), c);
    expect(r.encaixe!.cabe).toBe(false);
    const post = r.encaixe!.tipos.find((t) => t.tipoEntregaId === "post")!;
    expect(post.folga!).toBeLessThan(0);
  });
});

describe("audiovisual", () => {
  function cfgVideo() {
    const c = config();
    c.tiposEntrega.push({ id: "video", nome: "Reels editado", servicoId: "s1", horasPorUnidade: 3, audiovisual: true, ativo: true });
    return c;
  }

  it("entrega de vídeo nunca gera horas dos sócios, mesmo com horas preenchidas", () => {
    const c = cenario();
    c.entregas.push({ id: "v", tipoEntregaId: "video", quantidade: 4, horasPorUnidade: 5 });
    const r = calcularComReceita(prepararMes(cfgVideo(), c), 300000);
    expect(r.horasTotais).toBe(30);
  });

  it("alerta quando há vídeo sem custo de audiovisual", () => {
    const c = cenario();
    c.entregas.push({ id: "v", tipoEntregaId: "video", quantidade: 4, horasPorUnidade: null });
    const r = calcularCenario(cfgVideo(), c);
    expect(r.alertas.some((a) => a.nivel === "erro" && a.texto.includes("entrega de vídeo"))).toBe(true);
  });

  it("não alerta com custo de audiovisual por entrega (e o custo entra)", () => {
    const c = cenario();
    c.entregas.push({ id: "v", tipoEntregaId: "video", quantidade: 4, horasPorUnidade: null });
    c.custos.push({ id: "av", categoria: "audiovisual", descricao: "", forma: "por_entrega", valorCentavos: 15000, tipoEntregaId: "video" });
    const r = calcularCenario(cfgVideo(), c);
    expect(r.alertas.some((a) => a.texto.includes("entrega de vídeo"))).toBe(false);
    expect(r.mes!.custosPorCategoria.audiovisual).toBe(60000);
  });

  it("roteiro é entrega normal, com horas", () => {
    const cfg = cfgVideo();
    cfg.tiposEntrega.push({ id: "rot", nome: "Roteiro", servicoId: "s1", horasPorUnidade: 1, ativo: true });
    const c = cenario();
    c.entregas.push({ id: "r", tipoEntregaId: "rot", quantidade: 4, horasPorUnidade: null });
    const r = calcularComReceita(prepararMes(cfg, c), 300000);
    expect(r.pessoas.find((p) => p.id === "a")!.horas).toBe(24);
  });
});

describe("entrada de cliente novo", () => {
  function comEntrada() {
    const c = cenario();
    c.entrada = {
      entregas: [{ id: "e", tipoEntregaId: "post", quantidade: 5, horasPorUnidade: null }], // 10 h de A
      custos: [{ id: "k", categoria: "terceiro", descricao: "", forma: "fixo", valorCentavos: 20000, tipoEntregaId: null }],
      valorCobradoCentavos: null,
      mesesParaPagar: null,
    };
    return c;
  }

  it("não entra no resultado da rotina", () => {
    const r1 = calcularComReceita(prepararMes(config(), cenario()), 300000);
    const r2 = calcularComReceita(prepararMes(config(), comEntrada()), 300000);
    expect(r2.horasTotais).toBe(r1.horasTotais);
    expect(r2.sobraCentavos).toBe(r1.sobraCentavos);
  });

  it("custo = dinheiro + horas no piso; se paga pela folga da rotina acima do piso", () => {
    const c = comEntrada();
    c.modo = "valor";
    c.mensalidadeCentavos = 400000;
    const r = calcularCenario(config(), c);
    const e = r.entrada!;
    expect(e.custosDinheiroCentavos).toBe(20000);
    expect(e.horasNoPisoCentavos).toBe(10 * 5000);
    expect(e.custoEntradaCentavos).toBe(70000);
    const alvo = calcularMinimo(prepararMes(config(), c)).resultado!.sobraCentavos;
    expect(e.folgaMensalRotinaCentavos!).toBeCloseTo(r.mes!.sobraCentavos - alvo, -1);
    expect(e.mesesParaSePagar!).toBeCloseTo(70000 / e.folgaMensalRotinaCentavos!);
    expect(e.pessoas.find((p) => p.id === "a")!.horasPrimeiroMes).toBe(30);
  });

  it("valor cobrado pela entrada abate o custo (sem imposto e taxa)", () => {
    const c = comEntrada();
    c.entrada!.valorCobradoCentavos = 50000;
    const e = calcularCenario(config(), c).entrada!;
    expect(e.cobradoLiquidoCentavos).toBeCloseTo(50000 * 0.9);
    expect(e.custoEntradaCentavos).toBeCloseTo(70000 - 45000);
  });

  it("no valor mínimo a entrada não se paga; com prazo, calcula a mensalidade", () => {
    const c = comEntrada();
    const r = calcularCenario(config(), c);
    expect(r.entrada!.mesesParaSePagar).toBeNull();
    expect(r.alertas.some((a) => a.texto.includes("não se paga com a rotina"))).toBe(true);

    c.entrada!.mesesParaPagar = 4;
    const r2 = calcularCenario(config(), c);
    const m = r2.entrada!.mensalidadeParaPagarCentavos!;
    // cobrando essa mensalidade, a entrada se paga em ~4 meses
    const v = calcularCenario(config(), { ...c, modo: "valor", mensalidadeCentavos: m });
    expect(v.entrada!.mesesParaSePagar!).toBeGreaterThan(3.99);
    expect(v.entrada!.mesesParaSePagar!).toBeLessThanOrEqual(4.0001);
  });
});
