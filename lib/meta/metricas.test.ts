import { describe, expect, it } from "vitest";
import { amostraPequena, fraseComparacao, limitarDias, numeroDe, respostaCurta, variacaoPct } from "./metricas";

describe("variacaoPct", () => {
  it("calcula a variação com uma casa e não inventa quando falta base", () => {
    expect(variacaoPct(580, 100)).toBe(480);
    expect(variacaoPct(105, 100)).toBe(5);
    expect(variacaoPct(88, 100)).toBe(-12);
    expect(variacaoPct(10, null)).toBeNull();
    expect(variacaoPct(10, 0)).toBeNull();
  });
});

describe("limitarDias", () => {
  it("usa 28 por padrão e nunca passa do limite da Meta", () => {
    expect(limitarDias(undefined)).toBe(28);
    expect(limitarDias(0)).toBe(28);
    expect(limitarDias(7)).toBe(7);
    expect(limitarDias(90)).toBe(30);
  });
});

describe("fraseComparacao", () => {
  it("fala em português simples e avisa quando não há comparação", () => {
    expect(fraseComparacao(numeroDe("viram", 580, 100))).toBe("480% a mais que antes.");
    expect(fraseComparacao(numeroDe("viram", 80, 100))).toBe("20% a menos que antes.");
    expect(fraseComparacao(numeroDe("viram", 100, 100))).toBe("Igual ao período anterior.");
    expect(fraseComparacao(numeroDe("novos_seguidores", 3, null))).toContain("vira a base");
    expect(fraseComparacao(numeroDe("viram", 5, 0))).toContain("zero");
  });
});

describe("amostraPequena", () => {
  it("poucos posts são indício, não prova", () => {
    expect(amostraPequena(4)).toBe(true);
    expect(amostraPequena(12)).toBe(false);
    expect(amostraPequena(0)).toBe(false);
  });
});

describe("respostaCurta", () => {
  it("diz a verdade dos números", () => {
    expect(respostaCurta([numeroDe("viram", 200, 100), numeroDe("guardaram", 20, 10)]).titulo).toBe("Tudo subiu");
    expect(respostaCurta([numeroDe("viram", 50, 100)]).titulo).toBe("Tudo caiu");
    expect(respostaCurta([numeroDe("viram", 200, 100), numeroDe("guardaram", 5, 10)]).titulo).toBe("Resultado misto");
    expect(respostaCurta([numeroDe("viram", 10, null)]).titulo).toBe("Este período vira a base");
  });
});
