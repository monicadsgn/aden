import { describe, expect, it } from "vitest";
import { chamadaDoPedido, codigoDoPedido } from "./porta";

const codigo = `aden_${"a1".repeat(24)}`;

describe("porta genérica: tradução do pedido", () => {
  it("só aceita o código no formato do Aden, no cabeçalho Bearer", () => {
    expect(codigoDoPedido(`Bearer ${codigo}`)).toBe(codigo);
    expect(codigoDoPedido(codigo)).toBe(codigo);
    expect(codigoDoPedido("Bearer outra-coisa")).toBeNull();
    expect(codigoDoPedido(null)).toBeNull();
  });

  it("salvar: só os campos conhecidos, com datas e números conferidos", () => {
    expect(chamadaDoPedido({ acao: "salvar", tarefa: { titulo: "Post", cliente: "Aden", vencimento: "2026-10-04" } })).toEqual({
      funcao: "porta_salvar_tarefa",
      args: { p_dados: { titulo: "Post", cliente: "Aden", vencimento: "2026-10-04" } },
    });
    expect(() => chamadaDoPedido({ acao: "salvar", tarefa: { titulo: "x", valor: 10 } })).toThrow(/Campo desconhecido: valor/);
    expect(() => chamadaDoPedido({ acao: "salvar", tarefa: { cliente: "Aden" } })).toThrow(/título/);
    expect(() => chamadaDoPedido({ acao: "salvar", tarefa: { id: "1", vencimento: "04/10" } })).toThrow(/AAAA-MM-DD/);
    expect(() => chamadaDoPedido({ acao: "salvar", tarefa: { id: "1", quantidade: 0 } })).toThrow(/Quantidade/);
    expect(() => chamadaDoPedido({ acao: "salvar", tarefa: { id: "1", publicarEm: "amanhã" } })).toThrow(/publicarEm/);
  });

  it("status: só os permitidos (sem 'com o cliente', que é do painel)", () => {
    expect(chamadaDoPedido({ acao: "status", id: "t1", status: "publicada" })).toEqual({ funcao: "porta_status", args: { p_id: "t1", p_status: "publicada" } });
    expect(() => chamadaDoPedido({ acao: "status", id: "t1", status: "revisao" })).toThrow(/Status deve ser/);
    expect(() => chamadaDoPedido({ acao: "apagar" })).toThrow(/acao deve ser/);
  });
});
