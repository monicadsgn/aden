// Testes da segunda leva (rateio, imposto, tráfego, horas, saúde, cronômetro,
// apresentação, PDF, aprovação e pagamentos). Números aqui são só fixtures de teste.
import { describe, expect, it } from "vitest";
import { separarProtegidas, aprovadoresPendentes, aplicarItens, impactoNoBolso, assinaturaCenario } from "../regras/aprovacao";
import { camposFaltando } from "../regras/pendencias";
import { diferenca, type AlteracoesConfig } from "../dados/repositorio";
import { minutosParaHoras, horasParaMinutos, formatarDuracao } from "../formato";
import { alternarServico, pacoteQueCabe, sinalDoCenario, vistaApresentacao } from "./apresentacao";
import { calcularCalibragem, configComMediaMedida, iniciarMedicao, pararMedicao, pausarMedicao, retomarMedicao, segundosDaMedicao, type Medicao } from "./calibragem";
import { documentoContador, documentoProposta, nomeArquivo } from "./documentos";
import { calcularSaudeCliente, calcularVisaoMes, rotuloOrigemHoras } from "./mes";
import { ajustarQuantidade, calcularCenario, calcularComReceita, calcularEncaixe, prepararMes, verificarImpostoEmDobro } from "./motor";
import { configVazia, novoCenario } from "./novo";
import { distribuirPagamentos, repasseDosSocios, type Pagamento } from "./pagamentos";
import { calcularSolucoes } from "./solucoes";
import type { Cenario, ClienteBase, Configuracao } from "./tipos";

function config(): Configuracao {
  const c = configVazia();
  c.empresa = { reinvestimentoPct: 10, impostoPct: 0, taxaRecebimentoPct: 0, regraRateio: "proporcional" };
  c.pessoas = [
    { id: "m", nome: "Mônica", socio: true, percentualPadrao: 50, pisoHoraCentavos: 4500, capacidadeHorasMes: 44, ativo: true },
    // como o Áleff hoje: sem piso e sem capacidade
    { id: "a", nome: "Áleff", socio: true, percentualPadrao: 50, pisoHoraCentavos: null, capacidadeHorasMes: null, ativo: true },
  ];
  c.servicos = [
    { id: "sm", nome: "Social media", divisaoPadrao: { m: 100 }, ativo: true },
    { id: "tr", nome: "Tráfego pago", divisaoPadrao: { a: 100 }, ativo: true },
  ];
  c.tiposEntrega = [
    { id: "post", nome: "Post simples", servicoId: "sm", horasPorUnidade: 20 / 60, ativo: true },
    { id: "carr", nome: "Carrossel", servicoId: "sm", horasPorUnidade: 40 / 60, ativo: true },
    { id: "rot", nome: "Roteiro", servicoId: "sm", horasPorUnidade: 0.5, ativo: true },
    { id: "rel", nome: "Relatório", servicoId: "tr", horasPorUnidade: 1, ativo: true },
  ];
  c.custosFixos = [{ id: "ia", nome: "Inteligência artificial", valorMensalCentavos: 55000, ativo: true }];
  return c;
}

function cenario(entregas: [string, number][], modo: Cenario["modo"] = "escopo", mensalidade: number | null = null): Cenario {
  const e = novoCenario("teste");
  e.modo = modo;
  e.mensalidadeCentavos = mensalidade;
  e.entregas = entregas.map(([t, q], i) => ({ id: `l${i}`, tipoEntregaId: t, quantidade: q, horasPorUnidade: null }));
  return e;
}

const cliente = (id: string, valor: number | null, escopo?: Cenario | null): ClienteBase => ({
  id,
  nome: id.toUpperCase(),
  interno: false,
  participaRateio: true,
  valorMensalCentavos: valor,
  ativo: true,
  escopo: escopo ?? null,
});

// ─── Item 2: rateio ─────────────────────────────────────────────────────────

describe("rateio do custo fixo", () => {
  it("sem regra escolhida, o resultado fica bloqueado com botão para escolher a regra", () => {
    const c = config();
    c.empresa.regraRateio = null;
    const r = calcularCenario(c, cenario([["post", 8]], "valor", 100000));
    expect(r.bloqueio).not.toBeNull();
    expect(r.mes).toBeNull();
    expect(r.proposta).toBeNull();
    expect(r.minimo.possivel).toBe(false);
    expect(r.bloqueio!.acao?.destino).toEqual({ tipo: "config", secao: "regras", campo: "regraRateio" });
    // e no modo escopo também
    expect(calcularCenario(c, cenario([["post", 8]])).minimo.mensalidadeMinimaCentavos).toBeNull();
  });

  it("sem custo fixo cadastrado, não precisa de regra", () => {
    const c = config();
    c.empresa.regraRateio = null;
    c.custosFixos = [];
    expect(calcularCenario(c, cenario([["post", 8]], "valor", 100000)).bloqueio).toBeNull();
  });

  it("proporcional com 0 clientes: o cliente simulado conta como o único e fica com todo o custo", () => {
    const c = config();
    const r = calcularComReceita(prepararMes(c, cenario([["post", 8]])), 100000);
    expect(r.rateio.clientesNaBase).toBe(1);
    expect(r.rateio.outrosClientes).toBe(0);
    expect(r.rateio.quotaCentavos).toBe(55000);
    expect(r.rateio.explicacao).toMatch(/único/);
  });

  it("proporcional com 1 cliente: divide pelo valor de cada um", () => {
    const c = config();
    c.clientes = [cliente("x", 300000)];
    const r = calcularComReceita(prepararMes(c, cenario([["post", 8]])), 100000);
    expect(r.rateio.clientesNaBase).toBe(2);
    expect(r.rateio.quotaCentavos).toBeCloseTo((55000 * 100000) / 400000);
  });

  it("proporcional com vários clientes; o cliente que já existe não conta duas vezes", () => {
    const c = config();
    c.clientes = [cliente("x", 300000), cliente("y", 200000), { ...cliente("z", 500000), participaRateio: false }];
    const novo = calcularComReceita(prepararMes(c, cenario([["post", 8]])), 100000);
    expect(novo.rateio.clientesNaBase).toBe(3);
    expect(novo.rateio.quotaCentavos).toBeCloseTo((55000 * 100000) / 600000);
    const existente = { ...cenario([["post", 8]]), clienteId: "x" };
    const r = calcularComReceita(prepararMes(c, existente), 300000);
    expect(r.rateio.clientesNaBase).toBe(2);
    expect(r.rateio.quotaCentavos).toBeCloseTo((55000 * 300000) / 500000);
  });

  it("imposto fixo do MEI entra no rateio uma vez só", () => {
    const c = config();
    c.empresa.impostoFixoMensalCentavos = 9000;
    const r = calcularComReceita(prepararMes(c, cenario([["post", 8]])), 100000);
    expect(r.rateio.totalFixoCentavos).toBe(64000);
    expect(r.rateio.impostoFixoCentavos).toBe(9000);
    expect(r.rateio.quotaCentavos).toBe(64000);
    expect(r.impostosCentavos).toBe(0);
  });
});

// ─── Item 3: imposto em dobro e MEI ─────────────────────────────────────────

describe("imposto contado duas vezes", () => {
  it("avisa quando há custo fixo com nome de DAS e o imposto fixo também está preenchido", () => {
    const c = config();
    c.custosFixos.push({ id: "das", nome: "DAS (imposto MEI)", valorMensalCentavos: 9000, ativo: true });
    expect(verificarImpostoEmDobro(c)).toBeNull(); // campo novo ainda vazio
    c.empresa.impostoFixoMensalCentavos = 9000;
    const a = verificarImpostoEmDobro(c);
    expect(a?.texto).toMatch(/contado duas vezes/);
    expect(calcularCenario(c, cenario([["post", 8]])).alertas.some((x) => x.texto.includes("duas vezes"))).toBe(true);
  });

  it("não confunde nomes que só contêm as letras (ex.: 'Adobe')", () => {
    const c = config();
    c.empresa.impostoFixoMensalCentavos = 9000;
    c.custosFixos.push({ id: "ad", nome: "Adobe Creative Cloud", valorMensalCentavos: 10000, ativo: true });
    expect(verificarImpostoEmDobro(c)).toBeNull();
  });

  it("no MEI o imposto em % é ignorado", () => {
    const c = config();
    c.empresa.regime = "mei";
    c.empresa.impostoPct = 6;
    const r = calcularComReceita(prepararMes(c, cenario([["post", 8]])), 100000);
    expect(r.impostosCentavos).toBe(0);
  });
});

// ─── Item 5: tráfego ────────────────────────────────────────────────────────

describe("aviso do tráfego", () => {
  it("sem entrega de tráfego, não avisa do modelo de cobrança", () => {
    const r = calcularCenario(config(), cenario([["post", 8]]));
    expect(r.alertas.some((a) => a.texto.includes("modelo de cobrança do tráfego"))).toBe(false);
  });
  it("com entrega de tráfego e sem modelo, avisa com botão", () => {
    const r = calcularCenario(config(), cenario([["post", 8], ["rel", 1]]));
    const a = r.alertas.find((x) => x.texto.includes("modelo de cobrança do tráfego"));
    expect(a?.acao?.destino).toEqual({ tipo: "cenario", bloco: "trafego" });
  });
});

// ─── Item 8: lembrete × erro ────────────────────────────────────────────────

describe("avisos acionáveis", () => {
  it("reinvestimento vazio é lembrete, não erro, e tem botão", () => {
    const c = config();
    c.empresa.reinvestimentoPct = null;
    const a = calcularCenario(c, cenario([["post", 8]])).alertas.find((x) => x.texto.includes("Reinvestimento"));
    expect(a?.nivel).toBe("lembrete");
    expect(a?.acao?.destino).toEqual({ tipo: "config", secao: "regras", campo: "reinvestimentoPct" });
  });
});

// ─── Item 14 e Áleff sem piso nem capacidade ────────────────────────────────

describe("sócio sem piso nem capacidade (como o Áleff hoje)", () => {
  it("não quebra calculadora, visão do mês, saúde, soluções nem pagamentos", () => {
    const c = config();
    c.empresa.ordemDistribuicao = "custo_primeiro";
    const esc = cenario([["post", 8], ["rel", 2]]);
    esc.trafego.modelo = "incluido";
    c.clientes = [cliente("x", 150000, esc)];
    expect(() => calcularCenario(c, esc)).not.toThrow();
    expect(calcularCenario(c, { ...esc, modo: "valor", mensalidadeCentavos: 150000 }).encaixe).not.toBeNull();
    const v = calcularVisaoMes(c);
    expect(v.socios.find((s) => s.id === "a")!.situacao).toBe("sem_capacidade");
    const s = calcularSaudeCliente(c, c.clientes[0], null);
    expect(s.socios.find((x) => x.id === "a")!.piso).toBeNull();
    expect(() => calcularSolucoes(c, c.clientes[0], s)).not.toThrow();
    expect(distribuirPagamentos(c, c.clientes[0], "2026-09", [], "2026-09-10").bloqueio).toBeNull();
  });

  it("mostra quem recebe sem trabalhar no cliente", () => {
    const c = config();
    const r = calcularComReceita(prepararMes(c, cenario([["post", 16]])), 200000);
    const a = r.pessoas.find((p) => p.id === "a")!;
    expect(a.horas).toBe(0);
    expect(a.recebeSemHoras).toBe(true);
    expect(r.pessoas.find((p) => p.id === "m")!.recebeSemHoras).toBe(false);
  });
});

// ─── Item 15: minutos ───────────────────────────────────────────────────────

describe("horas em minutos", () => {
  it("três posts de 20 min dão exatamente 1 h", () => {
    const r = calcularComReceita(prepararMes(config(), cenario([["post", 3]])), 100000);
    expect(r.horasTotais).toBeCloseTo(1, 10);
    expect(minutosParaHoras(40)).toBeCloseTo(2 / 3, 12);
    expect(horasParaMinutos(40 / 60)).toBe(40);
    expect(formatarDuracao(1.5)).toBe("1 h 30 min");
    expect(formatarDuracao(20 / 60)).toBe("20 min");
  });
});

// ─── Item 4: origem das horas ───────────────────────────────────────────────

function medicoes(tipo: string, minutos: number[], desde = "2026-09-01T10:00:00Z"): Medicao[] {
  return minutos.map((m, i) => ({
    id: `${tipo}-${i}`,
    clienteId: "x",
    tipoEntregaId: tipo,
    pessoaId: "m",
    estado: "concluido",
    acumuladoSegundos: m * 60,
    retomadoEm: null,
    fim: desde,
    criadoEm: desde,
  }));
}

describe("origem das horas", () => {
  it("sem lançamento: 'sem registro', usa o previsto e avisa que é previsão", () => {
    const c = config();
    const cli = cliente("x", 150000, cenario([["post", 9]]));
    c.clientes = [cli];
    const s = calcularSaudeCliente(c, cli, null);
    const m = s.socios.find((x) => x.id === "m")!;
    expect(m.semRegistro).toBe(true);
    expect(m.origemHoras).toEqual({ tipo: "previsto" });
    expect(rotuloOrigemHoras(m.origemHoras)).toBe("previsto no escopo");
    expect(m.horasReais).toBeCloseTo(3);
    expect(s.realizado).not.toBeNull();
    expect(s.prejuizoSilencioso).toBe(false); // previsão não vira prejuízo silencioso
  });

  it("lançado à mão aparece como manual", () => {
    const c = config();
    const cli = cliente("x", 150000, cenario([["post", 9]]));
    const s = calcularSaudeCliente(c, cli, { valorRecebidoCentavos: null, horas: { m: 5 } });
    expect(rotuloOrigemHoras(s.socios.find((x) => x.id === "m")!.origemHoras)).toBe("lançado manualmente");
  });

  it("tipo calibrado aparece como média medida (N medições)", () => {
    const c = config();
    c.empresa.medicoesCalibragem = 5;
    const cli = cliente("x", 150000, cenario([["post", 9]]));
    const cal = calcularCalibragem(c, medicoes("post", [30, 30, 30, 30, 30]));
    const s = calcularSaudeCliente(c, cli, null, { calibragem: cal });
    const m = s.socios.find((x) => x.id === "m")!;
    expect(rotuloOrigemHoras(m.origemHoras)).toBe("média medida (5 medições)");
    expect(m.horasReais).toBeCloseTo(4.5);
  });
});

// ─── Item 10: cronômetro e calibragem ───────────────────────────────────────

describe("cronômetro e calibragem", () => {
  it("iniciar, pausar, retomar e parar somam só o tempo rodando", () => {
    const t0 = new Date("2026-09-25T10:00:00Z");
    let m = iniciarMedicao({ id: "1", clienteId: "x", tipoEntregaId: "carr", pessoaId: "m" }, t0);
    m = pausarMedicao(m, new Date("2026-09-25T10:20:00Z"));
    m = retomarMedicao(m, new Date("2026-09-25T11:00:00Z"));
    expect(segundosDaMedicao(m, new Date("2026-09-25T11:10:00Z"))).toBe(30 * 60);
    m = pararMedicao(m, new Date("2026-09-25T11:35:00Z"));
    expect(m.estado).toBe("concluido");
    expect(m.acumuladoSegundos).toBe(55 * 60);
  });

  it("depois de 5 medições fica calibrado e sugere atualizar o padrão", () => {
    const c = config();
    c.empresa.medicoesCalibragem = 5;
    const quatro = calcularCalibragem(c, medicoes("carr", [50, 55, 60, 55])).find((x) => x.tipoEntregaId === "carr")!;
    expect(quatro.situacao).toBe("calibrando");
    expect(quatro.sugerirAtualizar).toBe(false);
    const cinco = calcularCalibragem(c, medicoes("carr", [50, 55, 60, 55, 55])).find((x) => x.tipoEntregaId === "carr")!;
    expect(cinco.situacao).toBe("calibrado");
    expect(cinco.mediaMinutos).toBe(55);
    expect(cinco.sugestao).toBe("Carrossel está levando em média 55 min, não 40 min. Atualizar o padrão?");
    // a média medida só entra na estimativa, o padrão cadastrado não muda
    const cal = calcularCalibragem(c, medicoes("carr", [50, 55, 60, 55, 55]));
    expect(configComMediaMedida(c, cal).tiposEntrega.find((t) => t.id === "carr")!.horasPorUnidade).toBeCloseTo(55 / 60);
    expect(c.tiposEntrega.find((t) => t.id === "carr")!.horasPorUnidade).toBeCloseTo(40 / 60);
  });

  it("limiar de diferença configurado: diferença pequena não vira sugestão", () => {
    const c = config();
    c.empresa.medicoesCalibragem = 5;
    c.empresa.diferencaSugerirPct = 50;
    const x = calcularCalibragem(c, medicoes("carr", [50, 50, 50, 50, 50])).find((t) => t.tipoEntregaId === "carr")!;
    expect(x.sugerirAtualizar).toBe(false); // 25% de diferença < 50%
  });

  it("recalibrar descarta as medições antigas", () => {
    const c = config();
    c.empresa.medicoesCalibragem = 5;
    c.tiposEntrega = c.tiposEntrega.map((t) => (t.id === "carr" ? { ...t, calibrarDesde: "2026-10-01T00:00:00Z" } : t));
    const x = calcularCalibragem(c, medicoes("carr", [50, 55, 60, 55, 55])).find((t) => t.tipoEntregaId === "carr")!;
    expect(x.medicoes).toBe(0);
    expect(x.situacao).toBe("sem_medicao");
  });

  it("sem número de medições configurado, nenhum tipo pede cronômetro", () => {
    const x = calcularCalibragem(config(), medicoes("carr", [50]));
    expect(x.find((t) => t.tipoEntregaId === "carr")!.alvo).toBeNull();
  });
});

// ─── Item 9: soluções da Saúde ──────────────────────────────────────────────

describe("soluções da saúde", () => {
  function caso() {
    const c = config();
    c.custosFixos = [];
    c.empresa.reinvestimentoPct = 0;
    c.pessoas[0].percentualPadrao = 100;
    c.pessoas[1].percentualPadrao = 0;
    const esc = cenario([["post", 12], ["carr", 6], ["rot", 4]]); // 4 + 4 + 2 = 10 h previstas
    const cli = cliente("x", 60000, esc);
    c.clientes = [cli];
    return { c, cli };
  }

  it("subir o valor bate com o valor mínimo da calculadora", () => {
    const { c, cli } = caso();
    const s = calcularSaudeCliente(c, cli, { valorRecebidoCentavos: null, horas: { m: 20 } }); // 600 ÷ 20 h = 30/h < 45
    expect(s.prejuizoSilencioso).toBe(true);
    const sol = calcularSolucoes(c, cli, s);
    expect(sol.base).toBe("real");
    const calc = calcularCenario(c, sol.subir!.cenario);
    expect(sol.subir!.mensalidadeCentavos).toBe(calc.minimo.mensalidadeMinimaCentavos);
    expect(sol.subir!.mensalidadeCentavos).toBe(90000); // 20 h × 45
    expect(sol.subir!.aMaisCentavos).toBe(30000);
  });

  it("cortar escopo bate com o 'o que cabe' da calculadora e o corte cabe", () => {
    const { c, cli } = caso();
    const s = calcularSaudeCliente(c, cli, { valorRecebidoCentavos: null, horas: { m: 20 } });
    const sol = calcularSolucoes(c, cli, s);
    const base = sol.cenarioBase!;
    const mes = calcularComReceita(prepararMes(c, base), 60000);
    const enc = calcularEncaixe(c, base, mes);
    for (const corte of sol.cortar) {
      expect(-enc.tipos.find((t) => t.tipoEntregaId === corte.tipoEntregaId)!.folga!).toBe(corte.tirar);
      const depois = calcularCenario(c, corte.cenario);
      expect(depois.encaixe!.cabe).toBe(true);
    }
    expect(sol.cortar.length).toBeGreaterThan(0);
  });

  it("exceção mostra quanto o sócio perde por mês", () => {
    const { c, cli } = caso();
    const s = calcularSaudeCliente(c, cli, { valorRecebidoCentavos: null, horas: { m: 20 } });
    const sol = calcularSolucoes(c, cli, s);
    expect(sol.excecao[0].nome).toBe("Mônica");
    expect(sol.excecao[0].perdaMensalCentavos).toBeCloseTo(30000, 0); // 20 h × 45 − 600
  });

  it("se falta dado, diz qual e não sugere número", () => {
    const { c, cli } = caso();
    const sem = { ...cli, valorMensalCentavos: null };
    const s = calcularSaudeCliente(c, sem, { valorRecebidoCentavos: 10000, horas: { m: 20 } });
    const sol = calcularSolucoes(c, sem, s);
    expect(sol.subir).toBeNull();
    expect(sol.faltando.join(" ")).toMatch(/valor mensal do contrato/);
  });
});

// ─── Item 11: modo apresentação ─────────────────────────────────────────────

describe("modo apresentação", () => {
  it("a vista não carrega nenhum dado interno", () => {
    const c = config();
    const v = vistaApresentacao(c, { cenario: cenario([["post", 8], ["carr", 4]]), desligados: {} });
    expect(Object.keys(v).sort()).toEqual(["incluiTrafego", "servicos", "sinal", "valorCentavos", "verbaMidiaCentavos"]);
    const texto = JSON.stringify(v);
    for (const proibido of ["piso", "hora", "horas", "percentual", "socio", "rateio", "reinvest", "custo", "4500", "Mônica", "Áleff"])
      expect(texto.toLowerCase()).not.toContain(proibido.toLowerCase());
    expect(v.valorCentavos).toBeGreaterThan(0);
  });

  it("sem nenhuma entrega escolhida, não mostra preço", () => {
    const v = vistaApresentacao(config(), { cenario: cenario([]), desligados: {} });
    expect(v.valorCentavos).toBeNull();
  });

  it("sinal discreto acende abaixo do piso", () => {
    const c = config();
    const cen = cenario([["post", 30]], "valor", 200000);
    expect(sinalDoCenario(c, cen)).toBe("ok");
    expect(sinalDoCenario(c, { ...cen, mensalidadeCentavos: 30000 })).toBe("atencao");
  });

  it("'só tenho R$ X' devolve o pacote que cabe", () => {
    const c = config();
    const cen = cenario([["post", 30], ["carr", 10]]);
    const r = pacoteQueCabe(c, cen, 150000);
    expect(r.cabe).toBe(true);
    expect(calcularCenario(c, r.cenario).encaixe!.cabe).toBe(true);
    expect(r.tirados.length).toBeGreaterThan(0);
  });

  it("desligar e religar um serviço devolve as quantidades", () => {
    const c = config();
    const est = { cenario: cenario([["post", 8], ["rel", 2]]), desligados: {} };
    const off = alternarServico(c, est, "tr");
    expect(off.cenario.entregas.some((l) => l.tipoEntregaId === "rel")).toBe(false);
    const on = alternarServico(c, off, "tr");
    expect(on.cenario.entregas.find((l) => l.tipoEntregaId === "rel")!.quantidade).toBe(2);
  });
});

// ─── Item 12: PDFs ──────────────────────────────────────────────────────────

describe("PDF", () => {
  it("proposta não contém piso, horas nem divisão entre sócios", () => {
    const c = config();
    const cen = cenario([["post", 8], ["carr", 4]]);
    const r = calcularCenario(c, cen);
    const doc = documentoProposta(c, cen, r.proposta!.valorCentavos, { cliente: "Olinda Máquinas", competencia: "2026-09", incluiTrafego: false, verbaMidiaCentavos: null });
    const texto = JSON.stringify(doc).toLowerCase();
    for (const proibido of ["piso", "hora", "mônica", "áleff", "percentual", "custo", "rateio", "4500"]) expect(texto).not.toContain(proibido);
    expect(doc.arquivo).toBe("proposta_olinda-maquinas_09-2026");
    expect(doc.blocos[0].itens.map((i) => i.nome)).toEqual(["Post simples", "Carrossel"]);
  });

  it("resumo do contador soma recebimentos pela data e não leva dado dos sócios", () => {
    const c = config();
    c.clientes = [cliente("x", 150000)];
    c.empresa.tetoFaturamentoAnualCentavos = 8100000;
    const pags: Pagamento[] = [
      { id: "1", clienteId: "x", competencia: "2026-08", valorCentavos: 50000, recebidoEm: "2026-09-02" },
      { id: "2", clienteId: "x", competencia: "2026-09", valorCentavos: 150000, recebidoEm: "2026-09-10" },
      { id: "3", clienteId: "x", competencia: "2026-10", valorCentavos: 150000, recebidoEm: "2026-10-10" },
    ];
    const d = documentoContador(c, pags, "2026-09");
    expect(d.faturamentoCentavos).toBe(200000);
    expect(d.teto!.acumuladoAnoCentavos).toBe(200000);
    expect(JSON.stringify(d).toLowerCase()).not.toMatch(/piso|hora|mônica|áleff/);
    expect(nomeArquivo("resumo-contador", "aden", "2026-09")).toBe("resumo-contador_aden_09-2026");
  });
});

// ─── Item 13: aprovação ─────────────────────────────────────────────────────

function alteracoes(antes: Configuracao, depois: Configuracao): AlteracoesConfig {
  return {
    empresa: undefined,
    pessoas: diferenca(antes.pessoas, depois.pessoas),
    servicos: diferenca(antes.servicos, depois.servicos),
    tiposEntrega: diferenca(antes.tiposEntrega, depois.tiposEntrega),
    custosFixos: diferenca(antes.custosFixos, depois.custosFixos),
    clientes: diferenca(antes.clientes, depois.clientes),
  };
}

describe("campos protegidos", () => {
  it("piso de outro sócio não muda sem aprovação: volta ao valor antigo e vira pedido", () => {
    const antes = config();
    const depois = structuredClone(antes);
    depois.pessoas[0].pisoHoraCentavos = 3000;
    depois.pessoas[0].capacidadeHorasMes = 50; // campo livre segue direto
    const s = separarProtegidas(antes, alteracoes(antes, depois));
    expect(s.itens).toHaveLength(1);
    expect(s.alteracoes.pessoas.salvar[0].pisoHoraCentavos).toBe(4500);
    expect(s.alteracoes.pessoas.salvar[0].capacidadeHorasMes).toBe(50);
    expect(aprovadoresPendentes(antes, s.itens, "a")).toEqual(["m"]); // Áleff mudou: Mônica aprova
    expect(aprovadoresPendentes(antes, s.itens, null)).toEqual(["m"]); // conector: Mônica aprova
    expect(aprovadoresPendentes(antes, s.itens, "m")).toEqual([]); // a própria Mônica: vale na hora
  });

  it("primeiro preenchimento vale na hora", () => {
    const antes = config();
    const depois = structuredClone(antes);
    depois.pessoas[1].pisoHoraCentavos = 5000;
    const s = separarProtegidas(antes, alteracoes(antes, depois));
    expect(s.itens).toHaveLength(0);
    expect(s.primeirosPreenchimentos).toHaveLength(1);
    expect(s.alteracoes.pessoas.salvar[0].pisoHoraCentavos).toBe(5000);
  });

  it("% dos sócios anda em grupo e afeta os dois", () => {
    const antes = config();
    const depois = structuredClone(antes);
    depois.pessoas[0].percentualPadrao = 60;
    depois.pessoas[1].percentualPadrao = 40;
    const s = separarProtegidas(antes, alteracoes(antes, depois));
    expect(s.itens).toHaveLength(2);
    expect(s.alteracoes.pessoas.salvar).toHaveLength(0);
    expect(aprovadoresPendentes(antes, s.itens, "m")).toEqual(["a"]);
  });

  it("tempo por entrega afeta quem executa o serviço", () => {
    const antes = config();
    const depois = structuredClone(antes);
    depois.tiposEntrega[3].horasPorUnidade = 2; // relatório (tráfego, Áleff)
    const s = separarProtegidas(antes, alteracoes(antes, depois));
    expect(s.alteracoes.tiposEntrega.salvar).toHaveLength(0);
    expect(aprovadoresPendentes(antes, s.itens, "m")).toEqual(["a"]);
  });

  it("impacto no bolso: quanto muda por mês para cada sócio", () => {
    const antes = config();
    antes.clientes = [cliente("x", 200000, cenario([["post", 8]]))];
    const depois = aplicarItens(antes, [
      { tabela: "pessoas", registroId: "m", campo: "percentual_padrao", antes: 50, depois: 60, descricao: "" },
      { tabela: "pessoas", registroId: "a", campo: "percentual_padrao", antes: 50, depois: 40, descricao: "" },
    ]);
    const imp = impactoNoBolso(antes, depois);
    expect(imp.m).toBeGreaterThan(0);
    expect(imp.a).toBeCloseTo(-imp.m);
  });

  it("exceção vale só para o mesmo conteúdo do cenário", () => {
    const a = cenario([["post", 8]]);
    const b = { ...a, id: "outro", nome: "outro nome" };
    expect(assinaturaCenario(a)).toBe(assinaturaCenario(b));
    expect(assinaturaCenario(a)).not.toBe(assinaturaCenario(ajustarQuantidade(a, "post", 1)));
  });
});

describe("falta preencher", () => {
  it("aponta campos vazios por seção", () => {
    const f = camposFaltando(config());
    expect(f.socios).toContain("piso de Áleff");
    expect(f.regras).toContain("ordem de distribuição dos pagamentos");
    expect(f.limites).toContain("medições para calibrar");
  });
});

// ─── Item 16: pagamentos ────────────────────────────────────────────────────

describe("distribuição de pagamentos", () => {
  function caso(ordem: "custo_primeiro" | "proporcional") {
    const c = config();
    c.empresa.ordemDistribuicao = ordem;
    c.empresa.reinvestimentoPct = 10;
    const cli = cliente("x", 100000, cenario([["post", 8]]));
    c.clientes = [cli];
    return { c, cli };
  }
  const pag = (id: string, v: number, data: string, comp = "2026-09"): Pagamento => ({ id, clienteId: "x", competencia: comp, valorCentavos: v, recebidoEm: data });

  it("sem ordem escolhida, a distribuição fica bloqueada", () => {
    const { c, cli } = caso("custo_primeiro");
    c.empresa.ordemDistribuicao = null;
    const d = distribuirPagamentos(c, cli, "2026-09", [pag("1", 100000, "2026-09-05")], "2026-09-06");
    expect(d.bloqueio?.acao?.destino).toEqual({ tipo: "config", secao: "regras", campo: "ordemDistribuicao" });
  });

  for (const ordem of ["custo_primeiro", "proporcional"] as const) {
    it(`${ordem}: pagamento inteiro e em 3 partes chegam no mesmo total do mês`, () => {
      const { c, cli } = caso(ordem);
      const inteiro = distribuirPagamentos(c, cli, "2026-09", [pag("1", 100000, "2026-09-05")], "2026-09-06");
      const tres = distribuirPagamentos(
        c,
        cli,
        "2026-09",
        [pag("1", 30000, "2026-09-05"), pag("2", 30000, "2026-09-15"), pag("3", 40000, "2026-09-25")],
        "2026-09-26",
      );
      for (const d of [inteiro, tres]) {
        expect(d.situacao).toBe("pago");
        expect(d.totais.custosCentavos).toBeCloseTo(d.planejado!.custosCentavos);
        expect(d.totais.socios.m).toBeCloseTo(d.planejado!.socios.m);
        expect(d.totais.reinvestimentoCentavos).toBeCloseTo(d.planejado!.reinvestimentoCentavos);
      }
    });
  }

  it("custo primeiro: a primeira parte vai toda para os custos", () => {
    const { c, cli } = caso("custo_primeiro");
    const d = distribuirPagamentos(c, cli, "2026-09", [pag("1", 30000, "2026-09-05")], "2026-09-06");
    expect(d.partes[0].custosCentavos).toBe(30000); // custo do mês é 55.000 (único cliente)
    expect(d.partes[0].socios.m).toBe(0);
    expect(d.situacao).toBe("parcial");
  });

  it("proporcional: cada parte leva a mesma fração de custo e de sobra", () => {
    const { c, cli } = caso("proporcional");
    const d = distribuirPagamentos(c, cli, "2026-09", [pag("1", 30000, "2026-09-05")], "2026-09-06");
    expect(d.partes[0].custosCentavos).toBeCloseTo(30000 * 0.55);
    expect(d.partes[0].socios.m).toBeGreaterThan(0);
  });

  it("atrasado: o mês acabou sem pagar tudo; pagamento que cai depois é marcado", () => {
    const { c, cli } = caso("custo_primeiro");
    const semNada = distribuirPagamentos(c, cli, "2026-08", [], "2026-09-10");
    expect(semNada.situacao).toBe("atrasado");
    const tarde = distribuirPagamentos(c, cli, "2026-08", [pag("1", 100000, "2026-09-12", "2026-08")], "2026-09-12");
    expect(tarde.situacao).toBe("pago");
    expect(tarde.partes[0].atrasado).toBe(true);
    const rep = repasseDosSocios(c, [semNada]);
    expect(rep.find((r) => r.pessoaId === "m")!.faltaCentavos).toBeGreaterThan(0);
  });
});

import { recorteQuadrado } from "../imagem";

describe("foto de perfil", () => {
  it("corta no quadrado pelo centro", () => {
    expect(recorteQuadrado(400, 300)).toEqual({ x: 50, y: 0, lado: 300 });
    expect(recorteQuadrado(300, 500)).toEqual({ x: 0, y: 100, lado: 300 });
    expect(recorteQuadrado(200, 200)).toEqual({ x: 0, y: 0, lado: 200 });
  });
});
