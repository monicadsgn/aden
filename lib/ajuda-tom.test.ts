// A abertura da Visão do mês fala em crescimento: nada de "impedimento", "não cabe", "bloqueado".
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("tom da Visão do mês", () => {
  it("sem palavras de impedimento na tela de abertura", () => {
    const fonte = readFileSync("app/(app)/mes/page.tsx", "utf8");
    // só o texto visível (strings e JSX), sem comentários
    const semComentarios = fonte.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(semComentarios).not.toMatch(/impediment|n[ãa]o cabe|bloquead|n[ãa]o d[áa]\b|afogad/i);
  });
});
