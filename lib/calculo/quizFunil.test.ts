import { describe, expect, it } from "vitest";
import { resumoDoQuiz, type VisitaQuiz } from "./quizFunil";

const v = (passos: string[], enviou = false, qualificacao: string | null = null): VisitaQuiz => ({
  passos,
  ultimoPasso: passos[passos.length - 1] ?? null,
  enviou,
  qualificacao,
  criadoEm: "2026-10-26T12:00:00Z",
});

describe("resumoDoQuiz", () => {
  it("sem visitas: tudo zero, sem tela de maior abandono", () => {
    const r = resumoDoQuiz([]);
    expect(r).toMatchObject({ comecaram: 0, enviaram: 0, taxaDeEnvio: 0, ondeMaisParam: null });
    expect(r.telas.every((t) => t.viram === 0 && t.pctDeQuemComecou === 0)).toBe(true);
  });

  it("conta quem viu cada tela, onde parou e quem enviou", () => {
    const r = resumoDoQuiz([
      v(["hero"]),
      v(["hero", "seg", "fat"]),
      v(["hero", "seg", "fat"]),
      v(["hero", "seg", "fat", "mar", "tic", "ate", "reg", "obj", "form"], true, "qualificado"),
      v(["hero", "seg", "fat", "gate", "desq"], true, "desqualificado"),
    ]);
    expect(r.comecaram).toBe(5);
    expect(r.enviaram).toBe(2);
    expect(r.taxaDeEnvio).toBe(40);
    const tela = (p: string) => r.telas.find((t) => t.passo === p)!;
    expect(tela("hero")).toMatchObject({ viram: 5, pctDeQuemComecou: 100, pararamAqui: 1 });
    expect(tela("fat")).toMatchObject({ viram: 4, pctDeQuemComecou: 80, pararamAqui: 2 });
    expect(tela("gate").viram).toBe(1);
    expect(r.ondeMaisParam?.passo).toBe("fat");
    expect(r.porEtiqueta).toEqual({ qualificado: 1, com_ressalva: 0, desqualificado: 1, social_media: 0 });
  });

  it("quem enviou não conta como quem parou na tela final", () => {
    const r = resumoDoQuiz([v(["hero", "form"], true, "qualificado")]);
    expect(r.telas.find((t) => t.passo === "form")!.pararamAqui).toBe(0);
    expect(r.ondeMaisParam).toBeNull();
  });
});
