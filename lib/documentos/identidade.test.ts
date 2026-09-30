// As cores do PDF são espelho de app/tokens.css: se a paleta mudar lá, este teste avisa para mudar aqui também.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { IDENTIDADE_PDF, TOKEN_CSS } from "./identidade";

describe("identidade dos PDFs", () => {
  it("bate com os tokens do modo claro", () => {
    const css = readFileSync(path.resolve(__dirname, "../../app/tokens.css"), "utf8");
    const claro = css.slice(0, css.indexOf("@media"));
    for (const [k, token] of Object.entries(TOKEN_CSS)) {
      const m = new RegExp(`${token}:\\s*(#[0-9a-fA-F]{6})`).exec(claro);
      expect(m?.[1].toLowerCase(), token).toBe(IDENTIDADE_PDF[k as keyof typeof IDENTIDADE_PDF]);
    }
  });
});
