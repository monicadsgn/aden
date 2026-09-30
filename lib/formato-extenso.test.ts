import { describe, expect, it } from "vitest";
import { dataPorExtenso, formatarDocumento, tipoDocumento, valorPorExtenso } from "./formato";

describe("documentos e extenso", () => {
  it("formata CPF e CNPJ com ponto, barra e traço", () => {
    expect(formatarDocumento("12345678901")).toBe("123.456.789-01");
    expect(formatarDocumento("12.345.678/0001-90")).toBe("12.345.678/0001-90");
    expect(formatarDocumento("12345678000190")).toBe("12.345.678/0001-90");
    expect(formatarDocumento(" RG 123 ")).toBe("RG 123");
    expect(tipoDocumento("123.456.789-01")).toBe("cpf");
    expect(tipoDocumento("12345678000190")).toBe("cnpj");
  });

  it("data por extenso", () => {
    expect(dataPorExtenso("2026-09-30")).toBe("30 de setembro de 2026");
  });

  it("valor por extenso", () => {
    expect(valorPorExtenso(99700)).toBe("novecentos e noventa e sete reais");
    expect(valorPorExtenso(150000)).toBe("mil e quinhentos reais");
    expect(valorPorExtenso(250000)).toBe("dois mil e quinhentos reais");
    expect(valorPorExtenso(123400)).toBe("mil duzentos e trinta e quatro reais");
    expect(valorPorExtenso(100000)).toBe("mil reais");
    expect(valorPorExtenso(10000)).toBe("cem reais");
    expect(valorPorExtenso(49850)).toBe("quatrocentos e noventa e oito reais e cinquenta centavos");
    expect(valorPorExtenso(100)).toBe("um real");
    expect(valorPorExtenso(1200000)).toBe("doze mil reais");
  });
});
