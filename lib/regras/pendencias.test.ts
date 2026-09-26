import { describe, expect, it } from "vitest";
import { configVazia } from "../calculo/novo";
import { passosParaComecar } from "./pendencias";

describe("para começar", () => {
  it("config vazia: o primeiro passo é cadastrar os sócios; metas e limites nunca aparecem", () => {
    const passos = passosParaComecar(configVazia());
    expect(passos[0].secao).toBe("socios");
    expect(passos[0].faltando.length).toBeGreaterThan(0);
    expect(passos.map((p) => p.secao)).not.toContain("metas");
    expect(passos.map((p) => p.secao)).not.toContain("limites");
    // sem terceiro, pacote nem cliente cadastrado, esses passos não aparecem
    expect(passos.map((p) => p.secao)).not.toContain("terceiros");
    expect(passos.map((p) => p.secao)).not.toContain("clientes");
  });
  it("sócio preenchido: o passo dos sócios fica pronto", () => {
    const c = configVazia();
    c.pessoas = [{ id: "m", nome: "Moni", socio: true, ativo: true, percentualPadrao: 100, pisoHoraCentavos: 1, capacidadeHorasMes: 1 }];
    expect(passosParaComecar(c)[0].faltando).toEqual([]);
  });
});
