import { describe, expect, it } from "vitest";
import { avaliarConexao, conexaoVazia, passosParaCliente, permissoesPorEtapa, sugerirConta, traduzirErroMeta, type ContaMeta, type SituacaoToken } from "./estado";

const TODAS = ["pages_show_list", "instagram_basic", "instagram_content_publish", "pages_read_engagement", "pages_manage_posts", "instagram_manage_insights", "read_insights"];
const ok: SituacaoToken = { valido: true, expiraEm: null, permissoes: TODAS, erro: null };
const conta: ContaMeta = { paginaId: "111", paginaNome: "Loja X", instagramId: "999", instagramUsuario: "lojax" };
const comPagina = { ...conexaoVazia("c1"), paginaId: "111", status: "conectando" as const };

describe("avaliarConexao", () => {
  it("sem Página escolhida = não conectado", () => {
    expect(avaliarConexao(conexaoVazia("c1"), [conta], ok).status).toBe("nao_conectado");
  });
  it("Página escolhida e enxergada, com Instagram e permissões = conectado", () => {
    expect(avaliarConexao(comPagina, [conta], ok)).toEqual({ status: "conectado", motivo: null });
  });
  it("Página escolhida mas o cliente ainda não liberou = conectando", () => {
    const r = avaliarConexao(comPagina, [], ok);
    expect(r.status).toBe("conectando");
    expect(r.motivo).toMatch(/liberado para a Aden/);
  });
  it("já estava conectado e a Página sumiu = com problema", () => {
    expect(avaliarConexao({ ...comPagina, status: "conectado" }, [], ok).status).toBe("com_problema");
  });
  it("Página sem Instagram profissional = com problema", () => {
    expect(avaliarConexao(comPagina, [{ ...conta, instagramId: null, instagramUsuario: null }], ok).status).toBe("com_problema");
  });
  it("token vencido = com problema, mesmo com tudo certo", () => {
    expect(avaliarConexao(comPagina, [conta], { ...ok, valido: false }).status).toBe("com_problema");
  });
  it("falta permissão da conexão = com problema e diz qual", () => {
    const r = avaliarConexao(comPagina, [conta], { ...ok, permissoes: ["pages_show_list"] });
    expect(r.status).toBe("com_problema");
    expect(r.motivo).toContain("instagram_basic");
  });
  it("pausado continua pausado, nem confere", () => {
    expect(avaliarConexao({ ...comPagina, status: "pausado" }, [], { ...ok, valido: false }).status).toBe("pausado");
  });
});

describe("permissoesPorEtapa", () => {
  it("mostra o que falta em cada etapa", () => {
    const r = permissoesPorEtapa(["pages_show_list", "instagram_basic"]);
    expect(r.find((e) => e.etapa === "conexao")!.faltam).toEqual([]);
    expect(r.find((e) => e.etapa === "publicarInstagram")!.faltam).toEqual(["instagram_content_publish", "pages_read_engagement"]);
  });
});

describe("sugerirConta", () => {
  it("acha pelo @ da ficha, com ou sem arroba, link ou maiúscula", () => {
    expect(sugerirConta([conta], "@LojaX")?.paginaId).toBe("111");
    expect(sugerirConta([conta], "https://instagram.com/lojax/")?.paginaId).toBe("111");
    expect(sugerirConta([conta], "outra")).toBeNull();
    expect(sugerirConta([conta], null)).toBeNull();
  });
});

describe("traduzirErroMeta", () => {
  it("fala em português e nunca repete o texto da Meta", () => {
    const msg = traduzirErroMeta({ code: 190, message: "Error validating access token: EAAB..." }, 400);
    expect(msg).toMatch(/venceu/);
    expect(msg).not.toContain("EAAB");
    expect(traduzirErroMeta({ code: 4 })).toMatch(/pausa/);
    expect(traduzirErroMeta({ code: 10 })).toMatch(/permissão/);
  });
});

describe("passosParaCliente", () => {
  it("usa o ID do negócio quando existe e avisa quando falta", () => {
    expect(passosParaCliente("12345")).toContain("12345");
    expect(passosParaCliente(null)).toContain("peça a um sócio");
  });
});
