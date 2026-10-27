// O que a página do quiz lê do painel do Aden (migration 0047): nunca quebra, nunca vaza o que não é público.
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc }) }));

async function chamar() {
  const { GET } = await import("@/app/api/quiz/config/route");
  const r = await GET();
  return { status: r.status, cache: r.headers.get("Cache-Control"), corpo: (await r.json()) as Record<string, unknown> };
}

describe("GET /api/quiz/config", () => {
  beforeEach(() => {
    rpc.mockReset();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://exemplo.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
    process.env.QUIZ_SEGREDO = "segredo-de-teste-com-mais-de-24-letras";
  });

  it("devolve só os quatro dados públicos, chamando o banco com o segredo", async () => {
    rpc.mockResolvedValue({ data: { whatsapp: "5581999557470", instagram: "https://www.instagram.com/grupoaden/", metaPixel: "123456789", googleTag: null, interno: "x" }, error: null });
    const r = await chamar();
    expect(r.status).toBe(200);
    expect(r.corpo).toEqual({ whatsapp: "5581999557470", instagram: "https://www.instagram.com/grupoaden/", metaPixel: "123456789", googleTag: null });
    expect(r.cache).toContain("max-age=60");
    expect(rpc).toHaveBeenCalledWith("quiz_config_publica", { p_segredo: process.env.QUIZ_SEGREDO });
  });

  it("sem segredo, sem banco ou com erro: tudo vazio e a página usa os valores de reserva", async () => {
    const vazio = { whatsapp: null, instagram: null, metaPixel: null, googleTag: null };
    rpc.mockResolvedValue({ data: null, error: { message: "function does not exist" } });
    expect((await chamar()).corpo).toEqual(vazio);
    delete process.env.QUIZ_SEGREDO;
    expect((await chamar()).corpo).toEqual(vazio);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
