// Números aqui são só fixtures de teste — não são regra nem sugestão de preço.
// A própria Aden como cliente interno (pedido de 30/09/2026).
import { describe, expect, it, vi } from "vitest";
import { guardarEscopo } from "../dados/acoes";
import type { Repositorio } from "../dados/repositorio";
import type { Tarefa } from "./tarefas";
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

  it("as horas investidas na Aden saem das tarefas concluídas no mês × tempo cadastrado, por responsável", () => {
    const cfg = config();
    cfg.tiposEntrega = [{ id: "t", nome: "Post", servicoId: null, horasPorUnidade: 0.5, audiovisual: false, ativo: true } as Configuracao["tiposEntrega"][number],
      { id: "logo", nome: "Logo", servicoId: null, horasPorUnidade: null, audiovisual: false, ativo: true } as Configuracao["tiposEntrega"][number]];
    const tf = (id: string, clienteId: string, responsavelId: string, tipo: string, quantidade: number, concluidaEm: string | null): Tarefa => ({
      id, titulo: id, clienteId, tipoEntregaId: tipo, quantidade, status: concluidaEm ? "concluida" : "a_fazer", prioridade: null, responsavelId,
      inicio: null, vencimento: null, descricao: "", etapas: [], criadoEm: "2026-10-01T10:00:00Z", concluidaEm,
    });
    const inv = horasInvestidasNaAden(
      cfg,
      [
        tf("1", "aden", "m", "t", 4, "2026-10-05T12:00:00Z"), // 2 h
        tf("2", "aden", "m", "logo", 1, "2026-10-06T12:00:00Z"), // sem tempo cadastrado
        tf("3", "aden", "m", "t", 2, null), // aberta: não conta
        tf("4", "c1", "m", "t", 2, "2026-10-05T12:00:00Z"), // cliente pagante: não conta
        tf("5", "aden", "a", "t", 2, "2026-10-07T12:00:00Z"), // 1 h
        tf("6", "aden", "a", "t", 2, "2026-09-30T12:00:00Z"), // outro mês
      ],
      "2026-10",
    );
    expect(inv.find((x) => x.pessoaId === "m")).toMatchObject({ horas: 2, tarefas: 2, semTempo: 1 });
    expect(inv.find((x) => x.pessoaId === "a")).toMatchObject({ horas: 1, tarefas: 1, semTempo: 0 });
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
