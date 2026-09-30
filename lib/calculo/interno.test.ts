// Números aqui são só fixtures de teste — não são regra nem sugestão de preço.
// A própria Aden como cliente interno (pedido de 30/09/2026).
import { describe, expect, it, vi } from "vitest";
import { guardarEscopo } from "../dados/acoes";
import type { Repositorio } from "../dados/repositorio";
import type { Medicao } from "./calibragem";
import { calcularVisaoMes, horasInvestidasNaAden } from "./mes";
import { calcularCenario, calcularTeto } from "./motor";
import { configVazia, novoCenario } from "./novo";
import type { Pagamento } from "./pagamentos";
import { calcularMesDeCima, mesQueEstouraOTeto } from "./sociedade";
import type { Configuracao } from "./tipos";

function config(): Configuracao {
  const c = configVazia();
  c.empresa = { regime: "mei", reinvestimentoPct: 0, impostoPct: 0, taxaRecebimentoPct: 0, regraRateio: "igual", impostoFixoMensalCentavos: 0, tetoFaturamentoAnualCentavos: 8_100_000 };
  c.pessoas = [
    { id: "m", nome: "M", socio: true, percentualPadrao: 50, pisoHoraCentavos: 10000, capacidadeHorasMes: 100, ativo: true },
    { id: "a", nome: "A", socio: true, percentualPadrao: 50, pisoHoraCentavos: 10000, capacidadeHorasMes: 100, ativo: true },
  ];
  c.custosFixos = [{ id: "f", nome: "Ferramenta", valorMensalCentavos: 20000, ativo: true }];
  c.clientes = [
    { id: "c1", nome: "C1", interno: false, participaRateio: true, valorMensalCentavos: 300000, ativo: true, escopo: { ...novoCenario("c1"), clienteId: "c1" } },
    { id: "c2", nome: "C2", interno: false, participaRateio: true, valorMensalCentavos: 100000, ativo: true, escopo: { ...novoCenario("c2"), clienteId: "c2" } },
    // mesmo marcado por engano para dividir o custo fixo, a Aden fica fora
    { id: "aden", nome: "Aden", interno: true, participaRateio: true, valorMensalCentavos: 0, ativo: true, escopo: { ...novoCenario("aden"), clienteId: "aden" } },
  ];
  return c;
}

const pg = (id: string, clienteId: string, valor: number, recebidoEm: string): Pagamento => ({ id, clienteId, competencia: recebidoEm.slice(0, 7), valorCentavos: valor, recebidoEm, taxaCentavos: null });

describe("a própria Aden como cliente interno", () => {
  it("não divide o custo fixo: os pagantes levam a mesma parte que levariam sem ela", () => {
    const cfg = config();
    const r = calcularCenario(cfg, cfg.clientes[0].escopo!);
    expect(r.mes!.rateio.clientesNaBase).toBe(2);
    expect(r.mes!.rateio.quotaCentavos).toBe(10000);
  });

  it("o escopo dela não recebe parte do custo fixo", () => {
    const cfg = config();
    const r = calcularCenario(cfg, cfg.clientes[2].escopo!);
    expect(r.mes!.rateio.quotaCentavos).toBe(0);
  });

  it("fica fora do faturamento do mês e do teto do MEI", () => {
    const cfg = config();
    cfg.clientes[2].valorMensalCentavos = 999_999; // nem se alguém digitar um valor
    expect(calcularVisaoMes(cfg).faturamentoMensalCentavos).toBe(400000);
    expect(calcularTeto(cfg, null, 0)!.anualCentavos).toBe(400000 * 12);
  });

  it("dinheiro lançado nela nunca conta como entrada (sociedade e teto)", () => {
    const cfg = config();
    const pags = [pg("1", "c1", 300000, "2026-10-10"), pg("2", "aden", 500000, "2026-10-11")];
    const m = calcularMesDeCima(cfg, pags, "2026-10");
    expect(m.entrouCentavos).toBe(300000);
    expect(m.porCliente.map((x) => x.clienteId)).toEqual(["c1"]);
    const soAden = [pg("3", "aden", 8_000_000, "2026-01-10")];
    expect(mesQueEstouraOTeto(cfg, soAden, "2026-02-01")).toBeNull();
  });

  it("as horas do cronômetro nela aparecem separadas, por sócio, como investidas na Aden", () => {
    const cfg = config();
    const med = (id: string, clienteId: string, pessoaId: string, seg: number): Medicao => ({
      id,
      clienteId,
      pessoaId,
      tipoEntregaId: "t",
      estado: "concluido",
      acumuladoSegundos: seg,
      retomadoEm: null,
      fim: "2026-10-05T12:00:00Z",
      criadoEm: "2026-10-05T10:00:00Z",
    });
    const inv = horasInvestidasNaAden(cfg, [med("1", "aden", "m", 7200), med("2", "aden", "m", 1800), med("3", "c1", "m", 3600), med("4", "aden", "a", 3600)], "2026-10");
    expect(inv.find((x) => x.pessoaId === "m")).toMatchObject({ horas: 2.5, medicoes: 2 });
    expect(inv.find((x) => x.pessoaId === "a")).toMatchObject({ horas: 1, medicoes: 1 });
  });

  it("guardar o escopo dela nunca vira pedido de exceção de piso", async () => {
    const cfg = config();
    const repo = { definirEscopoCliente: vi.fn(async () => {}), proporExcecao: vi.fn(), salvarConfig: vi.fn() } as unknown as Repositorio;
    const r = await guardarEscopo(repo, cfg, "aden", { ...novoCenario("Aden"), clienteId: "aden" });
    expect(r.gravado).toBe(true);
    expect(r.abaixo).toEqual([]);
    expect(repo.proporExcecao).not.toHaveBeenCalled();
    expect(repo.salvarConfig).not.toHaveBeenCalled();
  });
});
