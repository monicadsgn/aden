// Painel do quiz na tela de Leads: fechado por padrão, com a frase que explica o que é (migration 0047).
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Repositorio } from "@/lib/dados/repositorio";
import { PainelDoQuiz } from "./PainelDoQuiz";

describe("PainelDoQuiz", () => {
  it("fechado: só o título e a frase que diz para que serve", () => {
    const html = renderToStaticMarkup(<PainelDoQuiz repo={{} as Repositorio} podeEditar />);
    expect(html).toContain("Configurar o quiz");
    expect(html).toContain("sem mexer no código");
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("pixel");
  });
});
