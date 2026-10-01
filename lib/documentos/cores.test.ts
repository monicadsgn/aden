// D7 da auditoria (01/10/2026): as cores dos PDFs são as mesmas do sistema. O pdf-lib não lê CSS, então os PDFs têm a
// própria tabela (CORES_ADEN); este teste trava que ela acompanha app/tokens.css.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CORES_ADEN } from "./base";

const tokens = readFileSync(path.resolve(__dirname, "../../app/tokens.css"), "utf8");
const claro = tokens.slice(0, tokens.indexOf("@media"));
const token = (nome: string) => claro.match(new RegExp(`--${nome}:\\s*(#[0-9a-fA-F]{6})`))?.[1]?.toLowerCase();

describe("cores dos PDFs = cores do sistema", () => {
  it("verde, tons de apoio, texto e linha vêm de tokens.css", () => {
    expect(CORES_ADEN.verde).toBe(token("marca"));
    expect(CORES_ADEN.verdeEscuro).toBe(token("marca-forte"));
    expect(CORES_ADEN.verdeProfundo).toBe(token("destaque"));
    expect(CORES_ADEN.texto).toBe(token("texto"));
    expect(CORES_ADEN.textoSuave).toBe(token("texto-suave"));
    expect(CORES_ADEN.linha).toBe(token("linha"));
  });
});
