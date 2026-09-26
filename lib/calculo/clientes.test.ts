import { describe, expect, it } from "vitest";
import { contratoVazio, fimDaFidelidade, lembretesDeContrato, prazoDoAvisoPrevio, vencimentoNoMes } from "./clientes";
import type { ClienteBase } from "./tipos";

describe("contrato do cliente", () => {
  it("vencimento no mês respeita o último dia", () => {
    expect(vencimentoNoMes(31, "2026-09")).toBe("2026-09-30");
    expect(vencimentoNoMes(10, "2026-02")).toBe("2026-02-10");
  });
  it("fidelidade e aviso prévio", () => {
    const k = { ...contratoVazio(), inicio: "2026-01-15", prazoMinimoMeses: 6, fim: "2026-12-31", avisoPrevioDias: 30 };
    expect(fimDaFidelidade(k)).toBe("2026-07-15");
    expect(prazoDoAvisoPrevio(k)).toBe("2026-12-01");
    expect(fimDaFidelidade(contratoVazio())).toBeNull();
  });
  it("lembretes: pagamento de hoje em aberto e contrato perto do fim", () => {
    const c = (id: string, k: Partial<ReturnType<typeof contratoVazio>>): ClienteBase => ({
      id,
      nome: id,
      interno: false,
      participaRateio: true,
      valorMensalCentavos: 100000,
      ativo: true,
      contrato: { ...contratoVazio(), ...k },
    });
    const l = lembretesDeContrato([c("paga-hoje", { diaPagamento: 26 }), c("ja-pagou", { diaPagamento: 26 }), c("termina", { fim: "2026-10-10", avisoPrevioDias: 30 }), c("longe", { fim: "2026-12-10" })], (id) => (id === "ja-pagou" ? 100000 : 0), "2026-09-26");
    expect(l.map((x) => `${x.cliente}:${x.texto}`)).toEqual(["paga-hoje:pagamento vence hoje", "termina:contrato termina"]);
    // aviso prévio vencendo este mês
    expect(lembretesDeContrato([c("x", { fim: "2026-10-20", avisoPrevioDias: 20 })], () => 0, "2026-09-26").map((x) => x.texto)).toEqual(["último dia do aviso prévio"]);
  });
});

import { clienteNoMes } from "./clientes";
describe("cliente no mês", () => {
  it("só cobra meses a partir do início", () => {
    const c = { id: "x", nome: "x", interno: false, participaRateio: true, valorMensalCentavos: 1, ativo: true, clienteDesde: "2026-09-26" };
    expect(clienteNoMes(c, "2026-08")).toBe(false);
    expect(clienteNoMes(c, "2026-09")).toBe(true);
    expect(clienteNoMes({ ...c, clienteDesde: null }, "2020-01")).toBe(true);
  });
});
