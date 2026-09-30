// PDFs com a identidade da Aden. Textos aqui são só fixtures de teste.
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import type { DocumentoOnboarding } from "../calculo/onboarding";
import { onboardingVisual } from "./onboarding-visual";

const secao = (titulo: string, texto: string, chave: DocumentoOnboarding["secoes"][number]["chave"] = "livre") => ({ titulo, chave, blocos: [{ tipo: "paragrafo" as const, texto }] });

describe("onboarding com a identidade da Aden", () => {
  it("capa, seções curtas duas por página e a página de contato no fim", async () => {
    const doc: DocumentoOnboarding = {
      cliente: "Loja Ação",
      arquivo: "x",
      subtitulo: "Social media",
      rodape: "+55 81 0000-0000 | @aden | a@a.com",
      saudacao: "Maria",
      contato: { whatsapp: "+55 81 0000-0000", instagram: "@aden", email: "a@a.com", atendimento: "seg a sex" },
      secoes: [secao("Boas-vindas", "Curta."), secao("Objetivo", "Curta também."), secao("Mais uma", "Curta."), secao("Fala com a gente", "", "contato")],
      faltando: [],
    };
    const pdf = await PDFDocument.load(await onboardingVisual(doc));
    // capa + (2 seções) + (1 seção) + contato
    expect(pdf.getPageCount()).toBe(4);
  });

  it("seção longa continua na página seguinte", async () => {
    const longo = Array.from({ length: 60 }, () => "Texto comprido para ocupar a página inteira do onboarding.").join(" ");
    const doc: DocumentoOnboarding = {
      cliente: "Loja",
      arquivo: "x",
      subtitulo: "",
      rodape: "",
      saudacao: "Ana",
      contato: { whatsapp: null, instagram: null, email: null, atendimento: null },
      secoes: [secao("Longa", longo), secao("Outra", longo), secao("Mais", longo)],
      faltando: [],
    };
    expect((await PDFDocument.load(await onboardingVisual(doc))).getPageCount()).toBeGreaterThanOrEqual(4);
  });
});
