// Briefing do cliente. Números e textos aqui são só fixtures de teste.
import { describe, expect, it } from "vitest";
import { montarBriefing, type PerguntaBriefing, type RespostaBriefing } from "./briefing";

const p = (id: string, secao: string, ordem: number, servicoId: string | null = null, ativo = true): PerguntaBriefing => ({
  id,
  secao,
  pergunta: `Pergunta ${id}`,
  ajuda: null,
  servicoId,
  ordem,
  ativo,
});
const r = (perguntaId: string, resposta: string | null): RespostaBriefing => ({
  id: perguntaId,
  clienteId: "c",
  perguntaId,
  perguntaTexto: `Pergunta ${perguntaId}`,
  resposta,
  respondidoPorNome: "Áleff",
  respondidoEm: "2026-10-01",
});

describe("briefing do cliente", () => {
  const perguntas = [p("a", "Negócio", 10), p("b", "Negócio", 20), p("t", "Tráfego", 30, "trafego"), p("x", "Negócio", 5, null, false)];

  it("só as ativas, na ordem, agrupadas por seção; pergunta de serviço só para quem contratou", () => {
    const so = montarBriefing(perguntas, [], new Set(["social"]));
    expect(so.secoes.map((s) => [s.secao, s.itens.map((i) => i.pergunta.id)])).toEqual([["Negócio", ["a", "b"]]]);
    const com = montarBriefing(perguntas, [], new Set(["trafego"]));
    expect(com.total).toBe(3);
  });

  it("sem escopo guardado, entram todas (melhor perguntar a mais)", () => {
    expect(montarBriefing(perguntas, [], new Set()).total).toBe(3);
  });

  it("conta só respostas com texto", () => {
    const b = montarBriefing(perguntas, [r("a", "Loja"), r("b", "  ")], new Set(["social"]));
    expect(b).toMatchObject({ respondidas: 1, total: 2, completo: false });
  });
});
