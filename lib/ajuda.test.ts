import { describe, expect, it } from "vitest";
import { AJUDA_TELAS, GLOSSARIO, termo, TOUR } from "./ajuda";

const frases = (t: string) => t.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ"])/).filter(Boolean).length;

describe("ajuda do sistema", () => {
  it("tour tem até 6 passos", () => {
    expect(TOUR.length).toBeGreaterThan(0);
    expect(TOUR.length).toBeLessThanOrEqual(6);
  });
  it("o ? de cada tela explica em até 3 frases e só cita termos que existem", () => {
    for (const [rota, a] of Object.entries(AJUDA_TELAS)) {
      expect(frases(a.texto), rota).toBeLessThanOrEqual(3);
      for (const t of a.termos ?? []) expect(termo(t), `${rota}: ${t}`).toBeDefined();
    }
  });
  it("glossário cobre os termos pedidos, cada um com frase e exemplo", () => {
    for (const id of ["piso", "capacidade", "rateio", "reinvestimento", "sobra", "escopo", "valor-por-hora", "teto-mei", "ordem-distribuicao"])
      expect(termo(id), id).toBeDefined();
    for (const t of GLOSSARIO) {
      expect(t.frase.length).toBeGreaterThan(10);
      expect(t.exemplo.length).toBeGreaterThan(10);
    }
  });
});
