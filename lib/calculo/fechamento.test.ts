// Checklist de fechamento. Números aqui são só fixtures de teste.
import { describe, expect, it } from "vitest";
import { montarFechamento, PASSOS_FECHAMENTO, type RegistroFechamento } from "./fechamento";

const reg = (passo: RegistroFechamento["passo"], feito: boolean): RegistroFechamento => ({
  id: passo,
  clienteId: "c",
  passo,
  feitoEm: feito ? "2026-10-01T12:00:00Z" : null,
  feitoPorNome: feito ? "Mônica" : null,
  link: null,
  data: null,
  observacao: null,
});

describe("checklist de fechamento", () => {
  it("segue a ordem combinada: onboarding primeiro, painel por último", () => {
    expect(PASSOS_FECHAMENTO.map((p) => p.passo)).toEqual(["onboarding", "contrato", "pagamento", "pasta_drive", "briefing", "kickoff", "painel"]);
  });

  it("conta o que foi feito e aponta o próximo; o painel vem do link da ficha", () => {
    const f = montarFechamento([reg("onboarding", true), reg("contrato", false)], false);
    expect(f.feitos).toBe(1);
    expect(f.proximo?.passo).toBe("contrato");
    expect(f.itens[0]).toMatchObject({ feito: true, feitoPorNome: "Mônica" });
    expect(montarFechamento([], true).itens.find((i) => i.passo === "painel")?.feito).toBe(true);
  });

  it("completo quando os 7 estão feitos", () => {
    const todos = PASSOS_FECHAMENTO.filter((p) => p.passo !== "painel").map((p) => reg(p.passo as RegistroFechamento["passo"], true));
    expect(montarFechamento(todos, false).completo).toBe(false);
    expect(montarFechamento(todos, true)).toMatchObject({ completo: true, proximo: null, feitos: 7 });
  });
});
