import { describe, expect, it } from "vitest";
import { faltaDefinir, mudarStatusCampanha, novaCampanha, ordenarCampanhas, paginaUrlValida } from "./campanhas";

describe("campanhas", () => {
  it("nasce ativa, sem número nenhum", () => {
    const c = novaCampanha("1", "  Mês grátis  ");
    expect(c.nome).toBe("Mês grátis");
    expect(c.status).toBe("ativa");
    expect(c.limiteClientes).toBeNull();
  });

  it("arquivar guarda a data e reativar limpa", () => {
    const c = novaCampanha("1", "A");
    const arq = mudarStatusCampanha(c, "arquivada", new Date("2026-10-28T12:00:00Z"));
    expect(arq.arquivadaEm).toBe("2026-10-28T12:00:00.000Z");
    expect(mudarStatusCampanha(arq, "ativa").arquivadaEm).toBeNull();
    expect(mudarStatusCampanha(c, "ativa")).toBe(c);
  });

  it("só aceita link https", () => {
    expect(paginaUrlValida("")).toBe(true);
    expect(paginaUrlValida("https://aden-sable.vercel.app/quiz")).toBe(true);
    expect(paginaUrlValida("javascript:alert(1)")).toBe(false);
    expect(paginaUrlValida("http://exemplo.com")).toBe(false);
  });

  it("ordena ativas, pausadas e arquivadas, da mais nova para a mais antiga", () => {
    const a = novaCampanha("a", "A", { criadaEm: "2026-10-01T00:00:00Z" });
    const b = novaCampanha("b", "B", { criadaEm: "2026-10-20T00:00:00Z" });
    const c = novaCampanha("c", "C", { status: "arquivada" });
    const d = novaCampanha("d", "D", { status: "pausada" });
    expect(ordenarCampanhas([c, a, d, b]).map((x) => x.id)).toEqual(["b", "a", "d", "c"]);
  });

  it("lembra o que falta definir", () => {
    expect(faltaDefinir(novaCampanha("1", "A"))).toEqual(["o que a campanha promete", "quem pode entrar", "as regras", "o limite de clientes"]);
    expect(faltaDefinir(novaCampanha("1", "A", { promete: "x", quemEntra: "y", regras: "z", limiteClientes: 0 }))).toEqual([]);
  });
});
