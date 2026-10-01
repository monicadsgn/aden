import { describe, expect, it } from "vitest";
import { linkWhatsapp, mensagemPecaNoPainel, numeroWhatsapp } from "./avisoCliente";

describe("aviso ao cliente pelo WhatsApp (M13)", () => {
  it("monta o número com 55 e a mensagem só com o link do painel", () => {
    expect(numeroWhatsapp("(81) 99999-0000")).toBe("5581999990000");
    expect(numeroWhatsapp("123")).toBeNull();
    const m = mensagemPecaNoPainel("Regina Souza", "https://x/c/abc", 2);
    expect(m).toContain("Oi, Regina!");
    expect(m).toContain("2 posts novos");
    expect(m).not.toMatch(/piso|hora|sócio/i);
    expect(linkWhatsapp("81999990000", m)).toMatch(/^https:\/\/wa\.me\/5581999990000\?text=/);
  });
});
