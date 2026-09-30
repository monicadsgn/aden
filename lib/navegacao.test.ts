import { describe, expect, it } from "vitest";
import { linkConfig, linkDoDestino } from "./navegacao";

describe("links dos avisos", () => {
  it("dados do cliente abrem a ficha dele, no contrato, quando o aviso sabe qual é", () => {
    expect(linkDoDestino({ tipo: "config", secao: "clientes", clienteId: "c1" })).toBe("/clientes?cliente=c1&aba=contrato");
    expect(linkConfig("clientes")).toBe("/clientes");
  });
  it("as outras seções continuam indo para as Configurações", () => {
    expect(linkDoDestino({ tipo: "config", secao: "regras", campo: "ordemDistribuicao" })).toBe("/configuracoes?secao=regras&campo=ordemDistribuicao");
    expect(linkDoDestino({ tipo: "cenario", bloco: "custos" })).toBeNull();
  });
});
