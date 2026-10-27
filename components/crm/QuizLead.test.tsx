// Telas do quiz dentro do CRM: etiqueta, respostas do lead e funil (migration 0046).
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { novoLead } from "@/lib/calculo/crm";
import type { VisitaQuiz } from "@/lib/calculo/quizFunil";
import { EtiquetaQuiz, FunilDoQuiz, RespostasDoQuiz } from "./QuizLead";

const visita = (passos: string[], enviou = false, qualificacao: string | null = null): VisitaQuiz => ({
  passos,
  ultimoPasso: passos[passos.length - 1] ?? null,
  enviou,
  qualificacao,
  criadoEm: "2026-10-26T12:00:00Z",
});

describe("FunilDoQuiz", () => {
  it("sem visitas não mostra nada", () => {
    expect(renderToStaticMarkup(<FunilDoQuiz visitas={[]} />)).toBe("");
  });

  it("mostra quantos começaram, enviaram, onde mais gente para e as etiquetas, em linguagem simples", () => {
    const html = renderToStaticMarkup(
      <FunilDoQuiz
        visitas={[
          visita(["hero", "seg", "fat"]),
          visita(["hero", "seg", "fat"]),
          visita(["hero", "seg", "fat", "mar", "form"], true, "qualificado"),
          visita(["hero", "seg", "fat", "gate", "desq"]),
        ]}
      />,
    );
    expect(html).toContain("Quiz de conversão");
    expect(html).toContain("Começaram");
    expect(html).toContain("Onde mais gente para: <strong>Faturamento</strong> (2 pessoas)");
    expect(html).toContain("Saída: sem a verba mínima");
    expect(html).toContain("1 qualificado");
    expect(html).not.toContain("NaN");
  });
});

describe("FunilDoQuiz por campanha", () => {
  const com = (passos: string[], source: string, campaign: string, enviou = false, q: string | null = null): VisitaQuiz => ({ ...visita(passos, enviou, q), campanha: { source, campaign } });

  it("mostra quantas pessoas cada campanha trouxe e quantas saíram boas", () => {
    const html = renderToStaticMarkup(
      <FunilDoQuiz visitas={[com(["hero"], "meta", "outubro"), com(["hero", "form"], "meta", "outubro", true, "qualificado"), visita(["hero"])]} />,
    );
    expect(html).toContain("Por campanha");
    expect(html).toContain("meta · outubro");
    expect(html).toContain("2 começaram · 1 enviou (50%) · 1 bom");
    expect(html).toContain("sem campanha identificada");
  });

  it("sem nenhuma campanha o bloco nem aparece", () => {
    expect(renderToStaticMarkup(<FunilDoQuiz visitas={[visita(["hero"])]} />)).not.toContain("Por campanha");
  });
});

describe("RespostasDoQuiz e etiqueta", () => {
  it("lead criado à mão não mostra o bloco do quiz", () => {
    expect(renderToStaticMarkup(<RespostasDoQuiz lead={novoLead("1", "Ana")} />)).toBe("");
  });

  it("lead do quiz mostra etiqueta, o que pesou, empresa, cidade e respostas", () => {
    const html = renderToStaticMarkup(
      <RespostasDoQuiz
        lead={novoLead("1", "Ana", {
          qualificacao: "com_ressalva",
          qualificacaoMotivos: "Margem baixa",
          empresa: "Loja X",
          cidade: "Recife",
          respostasQuiz: [{ pergunta: "Segmento", resposta: "Varejo" }],
        })}
      />,
    );
    expect(html).toContain("Qualificado com ressalva");
    expect(html).toContain("O que pesou na etiqueta: Margem baixa.");
    expect(html).toContain("Loja X");
    expect(html).toContain("Recife");
    expect(html).toContain("Varejo");
  });

  it("lead que veio de anúncio mostra a campanha; sozinho já abre o bloco", () => {
    const html = renderToStaticMarkup(<RespostasDoQuiz lead={novoLead("1", "Ana", { campanha: { source: "meta", campaign: "outubro", content: "video-1" } })} />);
    expect(html).toContain("Veio do anúncio");
    expect(html).toContain("meta · outubro");
    expect(html).toContain("video-1");
  });

  it("cada etiqueta tem o seu texto", () => {
    expect(renderToStaticMarkup(<EtiquetaQuiz qualificacao="social_media" />)).toContain("Quer só social media");
    expect(renderToStaticMarkup(<EtiquetaQuiz qualificacao="desqualificado" />)).toContain("Desqualificado");
  });
});
