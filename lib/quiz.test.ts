// Entrada pública do quiz: o que a rota aceita, joga fora ou recusa (migration 0046).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { campanhaDoQuiz, chaveDoVisitante, ipDoPedido, pedidoDoQuiz, TEMPO_MINIMO_MS } from "./quiz";

const SESSAO = "11111111-1111-4111-8111-111111111111";
const envio = (extra: Record<string, unknown> = {}) => ({
  acao: "enviar",
  sessao: SESSAO,
  nome: "Ana Teste",
  telefone: "(81) 99786-9274",
  empresa: "Loja X",
  qualificacao: "qualificado",
  tempoMs: 30_000,
  ...extra,
});

describe("pedidoDoQuiz", () => {
  it("passo: aceita nome de tela simples e recusa o resto", () => {
    expect(pedidoDoQuiz({ acao: "passo", sessao: SESSAO, passo: "fat" })).toEqual({ acao: "passo", sessao: SESSAO, passo: "fat", campanha: null });
    expect(() => pedidoDoQuiz({ acao: "passo", sessao: SESSAO, passo: "DROP TABLE;" })).toThrow("Pedido inválido.");
    expect(() => pedidoDoQuiz({ acao: "passo", sessao: "nao-e-uuid", passo: "fat" })).toThrow("Pedido inválido.");
    expect(() => pedidoDoQuiz(null)).toThrow("Pedido inválido.");
    expect(() => pedidoDoQuiz({ acao: "outra", sessao: SESSAO })).toThrow("Pedido inválido.");
  });

  it("enviar: aceita o formulário completo e limpa os textos", () => {
    const p = pedidoDoQuiz(
      envio({
        nome: "  Ana Teste  ",
        instagram: "@lojax",
        cidade: "Recife",
        motivos: ["Margem baixa", " ", "Atende sem processo"],
        respostas: [
          { pergunta: "Segmento", resposta: "Varejo" },
          { pergunta: "", resposta: "sem pergunta" },
          "lixo",
        ],
      }),
    );
    expect(p.acao).toBe("enviar");
    if (p.acao !== "enviar") return;
    expect(p.descartar).toBe(false);
    expect(p.dados.nome).toBe("Ana Teste");
    expect(p.dados.motivos).toBe("Margem baixa; Atende sem processo");
    expect(p.dados.respostas).toEqual([{ pergunta: "Segmento", resposta: "Varejo" }]);
    expect(p.dados.instagram).toBe("@lojax");
  });

  it("enviar: frases simples para o que falta", () => {
    expect(() => pedidoDoQuiz(envio({ nome: "A" }))).toThrow("Informe o nome.");
    expect(() => pedidoDoQuiz(envio({ telefone: "123" }))).toThrow("Informe o WhatsApp com DDD.");
    expect(() => pedidoDoQuiz(envio({ empresa: "  " }))).toThrow("Informe a empresa.");
    expect(() => pedidoDoQuiz(envio({ qualificacao: "hacker" }))).toThrow("Pedido inválido.");
  });

  it("enviar: robô (campo escondido preenchido ou rápido demais) é descartado sem erro", () => {
    for (const extra of [{ site: "http://spam" }, { tempoMs: TEMPO_MINIMO_MS - 1 }, { tempoMs: undefined }]) {
      const p = pedidoDoQuiz(envio(extra));
      expect(p.acao === "enviar" && p.descartar).toBe(true);
    }
  });

  it("enviar: corta textos grandes e limita a quantidade de respostas", () => {
    const p = pedidoDoQuiz(
      envio({ nome: "x".repeat(500), respostas: Array.from({ length: 80 }, (_, i) => ({ pergunta: `p${i}`, resposta: "r".repeat(900) })) }),
    );
    if (p.acao !== "enviar") throw new Error("esperava enviar");
    expect(p.dados.nome.length).toBe(120);
    expect(p.dados.respostas).toHaveLength(30);
    expect(p.dados.respostas[0].resposta.length).toBe(300);
  });
});

describe("campanha do anúncio", () => {
  it("fica só com as cinco chaves conhecidas e textos curtos", () => {
    expect(campanhaDoQuiz({ source: " meta ", campaign: "outubro", medium: "", extra: "x", content: "c".repeat(300), term: 5 })).toEqual({
      source: "meta",
      campaign: "outubro",
      content: "c".repeat(120),
    });
  });

  it("não é objeto ou vem vazia: não tem campanha, e isso nunca derruba o pedido", () => {
    for (const v of [null, undefined, "meta", ["meta"], {}, { source: "  " }]) expect(campanhaDoQuiz(v)).toBeNull();
    const p = pedidoDoQuiz(envio({ campanha: "lixo" }));
    expect(p.acao === "enviar" && p.dados.campanha).toBeNull();
  });

  it("passo e enviar levam a campanha adiante", () => {
    const camp = { source: "meta", campaign: "outubro" };
    expect(pedidoDoQuiz({ acao: "passo", sessao: SESSAO, passo: "fat", campanha: camp })).toMatchObject({ campanha: camp });
    const p = pedidoDoQuiz(envio({ campanha: camp }));
    expect(p.acao === "enviar" && p.dados.campanha).toEqual(camp);
  });
});

describe("visitante", () => {
  it("a chave é um hash: não carrega o endereço e muda com o sal", () => {
    const k = chaveDoVisitante("200.1.2.3", "sal-a");
    expect(k).toMatch(/^[0-9a-f]{64}$/);
    expect(k).not.toContain("200");
    expect(chaveDoVisitante("200.1.2.3", "sal-b")).not.toBe(k);
    expect(chaveDoVisitante("200.1.2.4", "sal-a")).not.toBe(k);
  });

  it("lê o endereço do primeiro item do cabeçalho da Vercel", () => {
    const h = (m: Record<string, string>) => ({ get: (n: string) => m[n] ?? null });
    expect(ipDoPedido(h({ "x-forwarded-for": "200.1.2.3, 10.0.0.1" }))).toBe("200.1.2.3");
    expect(ipDoPedido(h({ "x-real-ip": "200.9.9.9" }))).toBe("200.9.9.9");
    expect(ipDoPedido(h({}))).toBe("desconhecido");
  });
});

// ─── A rota inteira, com o banco simulado ────────────────────────────────────
const rpc = vi.fn();
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc }) }));

async function chamar(corpo: unknown, cabecalhos: Record<string, string> = { "x-forwarded-for": "200.1.2.3" }) {
  const { POST } = await import("@/app/api/quiz/route");
  const r = await POST(new Request("http://x/api/quiz", { method: "POST", headers: cabecalhos, body: typeof corpo === "string" ? corpo : JSON.stringify(corpo) }));
  return { status: r.status, corpo: (await r.json()) as Record<string, unknown> };
}

describe("rota /api/quiz", () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ data: null, error: null });
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://exemplo.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
    process.env.QUIZ_SEGREDO = "segredo-de-teste-com-mais-de-24-letras";
  });

  it("sem segredo configurado o quiz fica fora do ar", async () => {
    delete process.env.QUIZ_SEGREDO;
    const r = await chamar({ acao: "passo", sessao: SESSAO, passo: "fat" });
    expect(r.status).toBe(503);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("passo: confere o limite e depois registra, sempre com o segredo", async () => {
    const r = await chamar({ acao: "passo", sessao: SESSAO, passo: "fat" });
    expect(r).toEqual({ status: 200, corpo: { ok: true } });
    expect(rpc.mock.calls.map((c) => c[0])).toEqual(["quiz_limite_checar", "quiz_passo"]);
    expect(rpc.mock.calls[0][1].p_segredo).toBe(process.env.QUIZ_SEGREDO);
    expect(rpc.mock.calls[0][1].p_chave).toMatch(/^[0-9a-f]{64}$/);
    expect(rpc.mock.calls[1][1]).toEqual({ p_segredo: process.env.QUIZ_SEGREDO, p_sessao: SESSAO, p_passo: "fat", p_campanha: null });
  });

  it("enviar: manda os dados limpos para o banco", async () => {
    const r = await chamar(envio({ cidade: "Recife", respostas: [{ pergunta: "Segmento", resposta: "Varejo" }] }));
    expect(r.status).toBe(200);
    const [nome, args] = rpc.mock.calls[1];
    expect(nome).toBe("quiz_enviar");
    expect(args.p_dados).toMatchObject({ nome: "Ana Teste", empresa: "Loja X", qualificacao: "qualificado", cidade: "Recife" });
    expect(args.p_dados).not.toHaveProperty("tempoMs");
  });

  it("a campanha chega ao banco nos dois pedidos", async () => {
    const camp = { source: "meta", campaign: "outubro" };
    await chamar({ acao: "passo", sessao: SESSAO, passo: "fat", campanha: camp });
    expect(rpc.mock.calls[1][1].p_campanha).toEqual(camp);
    rpc.mockClear();
    await chamar(envio({ campanha: camp }));
    expect(rpc.mock.calls[1][1].p_dados.campanha).toEqual(camp);
  });

  it("enviar: robô recebe sucesso e nada é gravado nem consultado", async () => {
    const r = await chamar(envio({ site: "spam" }));
    expect(r).toEqual({ status: 200, corpo: { ok: true } });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("limite estourado vira 429 e nada é gravado", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "Muitas tentativas. Tente de novo mais tarde." } });
    const r = await chamar(envio());
    expect(r.status).toBe(429);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("erro de validação do banco chega como frase simples; erro interno não vaza", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null }).mockResolvedValueOnce({ data: null, error: { message: "Informe o nome." } });
    expect((await chamar(envio())).corpo).toEqual({ erro: "Informe o nome." });
    rpc.mockResolvedValueOnce({ data: null, error: null }).mockResolvedValueOnce({ data: null, error: { message: 'relation "leads" does not exist' } });
    const r = await chamar(envio());
    expect(r.status).toBe(500);
    expect(JSON.stringify(r.corpo)).not.toContain("relation");
  });

  it("corpo quebrado ou grande demais é recusado", async () => {
    expect((await chamar("{nao e json")).status).toBe(400);
    expect((await chamar("x".repeat(25_000))).status).toBe(413);
    expect(rpc).not.toHaveBeenCalled();
  });
});
