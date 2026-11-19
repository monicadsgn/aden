import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/meta/status/route";

afterEach(() => vi.unstubAllEnvs());

describe("/api/meta/status", () => {
  it("com a chave desligada responde só { ativo: false } e não pede nada a ninguém", async () => {
    vi.stubEnv("META_CONEXAO_ATIVA", "");
    vi.stubEnv("META_ACCESS_TOKEN", "EAAB-segredo");
    const buscar = vi.fn();
    vi.stubGlobal("fetch", buscar);
    const r = await GET(new Request("http://x/api/meta/status"));
    expect(await r.json()).toEqual({ ativo: false, motivo: "desligado" });
    expect(buscar).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("ligada, sem sessão de sócio, recusa", async () => {
    vi.stubEnv("META_CONEXAO_ATIVA", "1");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://exemplo.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    const r = await GET(new Request("http://x/api/meta/status"));
    expect(r.status).toBe(401);
  });
});
