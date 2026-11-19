import { describe, expect, it } from "vitest";
import { abaDeTexto } from "./FichaCliente";

describe("abaDeTexto", () => {
  it("aceita as partes da ficha e traduz o nome antigo", () => {
    expect(abaDeTexto("contrato")).toBe("contrato");
    expect(abaDeTexto("painel")).toBe("painel");
    expect(abaDeTexto("resumo")).toBe("dados");
  });
  it("ignora o que não existe", () => {
    expect(abaDeTexto("qualquer")).toBeNull();
    expect(abaDeTexto(null)).toBeNull();
  });
});
