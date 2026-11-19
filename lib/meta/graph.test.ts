import { afterEach, describe, expect, it, vi } from "vitest";
import { conferirToken, graph, listarContasMeta } from "./graph";

const TOKEN = "EAAB-token-secreto";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function respostas(...lista: unknown[]) {
  const chamadas: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: URL | string, init: RequestInit) => {
      chamadas.push({ url: String(url), init });
      const r = lista.shift() as { status?: number; corpo: unknown };
      return new Response(JSON.stringify(r.corpo), { status: r.status ?? 200 });
    }),
  );
  return chamadas;
}

describe("graph", () => {
  it("token só no cabeçalho, nunca na URL, e sem cache", async () => {
    const ch = respostas({ corpo: { ok: true } });
    await graph("me/accounts", { token: TOKEN, parametros: { limit: "100" } });
    expect(ch[0].url).not.toContain(TOKEN);
    expect(ch[0].url).not.toContain("access_token");
    expect((ch[0].init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`);
    expect(ch[0].init.cache).toBe("no-store");
  });

  it("POST leva os parâmetros no corpo", async () => {
    const ch = respostas({ corpo: { ok: true } });
    await graph("debug_token", { token: "app|segredo", metodo: "POST", parametros: { input_token: TOKEN } });
    expect(ch[0].url).not.toContain(TOKEN);
    expect(String(ch[0].init.body)).toContain("input_token");
  });

  it("erro da Meta vira mensagem em português, sem token nem texto cru", async () => {
    respostas({ status: 400, corpo: { error: { code: 190, message: `Invalid token ${TOKEN}` } } });
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await expect(graph("me", { token: TOKEN })).rejects.toThrow(/venceu/);
    expect(JSON.stringify(aviso.mock.calls)).not.toContain(TOKEN);
    aviso.mockRestore();
  });
});

describe("listarContasMeta", () => {
  it("segue a paginação e tira access_token que a Meta devolver no next", async () => {
    const ch = respostas(
      { corpo: { data: [{ id: "1", name: "A", instagram_business_account: { id: "9", username: "a" } }], paging: { next: "https://graph.facebook.com/v23.0/me/accounts?after=X&access_token=VAZOU" } } },
      { corpo: { data: [{ id: "2", name: "B" }] } },
    );
    const contas = await listarContasMeta(TOKEN);
    expect(contas).toEqual([
      { paginaId: "1", paginaNome: "A", instagramId: "9", instagramUsuario: "a" },
      { paginaId: "2", paginaNome: "B", instagramId: null, instagramUsuario: null },
    ]);
    expect(ch[1].url).toContain("after=X");
    expect(ch[1].url).not.toContain("VAZOU");
  });

  it("não segue paginação para fora da Meta", async () => {
    respostas({ corpo: { data: [], paging: { next: "https://outro.site/roubar" } } });
    await expect(listarContasMeta(TOKEN)).rejects.toThrow();
  });
});

describe("conferirToken", () => {
  it("lista só as permissões concedidas e devolve sem o token", async () => {
    respostas({ corpo: { data: [{ permission: "pages_show_list", status: "granted" }, { permission: "instagram_basic", status: "declined" }] } });
    const s = await conferirToken(TOKEN);
    expect(s).toEqual({ valido: true, expiraEm: null, permissoes: ["pages_show_list"], erro: null });
    expect(JSON.stringify(s)).not.toContain(TOKEN);
  });
});
