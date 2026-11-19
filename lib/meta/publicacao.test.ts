import { describe, expect, it } from "vitest";
import { confirmacaoConfere, confirmacaoEsperada, contasLiberadas, LIMITE_LEGENDA, montarPlano } from "./publicacao";

describe("montarPlano", () => {
  it("1 imagem é foto e 2 ou mais é carrossel", () => {
    const f = montarPlano({ imagens: ["https://x.com/a.jpg"], legenda: " oi " });
    expect(f).toEqual({ plano: { tipo: "foto", imagens: ["https://x.com/a.jpg"], legenda: "oi" } });
    const c = montarPlano({ imagens: ["https://x.com/a.jpg", "https://x.com/b.JPEG"] });
    expect("plano" in c && c.plano.tipo).toBe("carrossel");
  });
  it("recusa o que não serve, com a razão em português", () => {
    expect(montarPlano({ imagens: [] })).toHaveProperty("erro");
    expect(montarPlano({ imagens: ["http://x.com/a.jpg"] })).toMatchObject({ erro: expect.stringContaining("https") });
    expect(montarPlano({ imagens: ["https://x.com/a.png"] })).toMatchObject({ erro: expect.stringContaining(".jpg") });
    expect(montarPlano({ imagens: ["https://u:p@x.com/a.jpg"] })).toHaveProperty("erro");
    expect(montarPlano({ imagens: ["https://x.com/a.jpg", "https://x.com/a.jpg"] })).toMatchObject({ erro: expect.stringContaining("repetidas") });
    expect(montarPlano({ imagens: Array.from({ length: 11 }, (_, i) => `https://x.com/${i}.jpg`) })).toHaveProperty("erro");
    expect(montarPlano({ imagens: ["https://x.com/a.jpg"], legenda: "a".repeat(LIMITE_LEGENDA + 1) })).toHaveProperty("erro");
  });
});

describe("confirmação escrita", () => {
  const plano = { tipo: "carrossel" as const, imagens: ["a", "b", "c"], legenda: "" };
  it("inclui o @ da conta e o tipo", () => {
    expect(confirmacaoEsperada("@Conta_Teste", plano)).toBe("publicar carrossel de 3 em @conta_teste");
    expect(confirmacaoEsperada("conta", { ...plano, tipo: "foto", imagens: ["a"] })).toBe("publicar foto em @conta");
  });
  it("aceita maiúsculas e espaços a mais, mas não outra conta", () => {
    const esperada = confirmacaoEsperada("conta", plano);
    expect(confirmacaoConfere("  Publicar  carrossel de 3 em @CONTA ", esperada)).toBe(true);
    expect(confirmacaoConfere("publicar carrossel de 3 em @outra", esperada)).toBe(false);
    expect(confirmacaoConfere(null, esperada)).toBe(false);
  });
});

describe("contasLiberadas", () => {
  it("lê a lista e vazia não libera ninguém", () => {
    expect(contasLiberadas(" @Teste , outra ,")).toEqual(["teste", "outra"]);
    expect(contasLiberadas("")).toEqual([]);
    expect(contasLiberadas(undefined)).toEqual([]);
  });
});
