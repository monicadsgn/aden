import { describe, expect, it } from "vitest";
import { montarAvisoCliente } from "./avisoCliente";

const link = "https://exemplo.test/c/abc123";

describe("e-mail de aviso ao cliente", () => {
  it("peça nova: assunto, lista e botão para o painel", () => {
    const e = montarAvisoCliente({ nomeContato: "Jônatas", novas: [{ titulo: "[STADIUMPLAY] - Marca um amigo (estático, quinta 22/10)", formato: "Estático", dia: "2026-10-22" }], ajustadas: [], linkPainel: link, urlBase: "https://exemplo.test" });
    expect(e.assunto).toBe("Tem uma peça nova pra você aprovar");
    expect(e.texto).toContain("Oi, Jônatas!");
    expect(e.html).toContain(link);
    expect(e.html).not.toContain("[STADIUMPLAY]");
    expect(e.texto).toContain("Estático do dia 22/10 (Marca um amigo)");
    expect(e.html).toContain("https://exemplo.test/email/logo-aden-branco.png");
  });
  it("ajuste devolvido tem assunto próprio", () => {
    const e = montarAvisoCliente({ novas: [], ajustadas: [{ titulo: "Card X", pedido: "trocar a foto" }], linkPainel: link, urlBase: "https://exemplo.test" });
    expect(e.assunto).toBe("Fizemos o ajuste que você pediu");
    expect(e.html).toContain("Ajustes feitos");
    expect(e.html).not.toContain("Para aprovar");
    expect(e.texto).toContain("você pediu: trocar a foto");
  });
  it("nada interno e nunca promete aviso diário", () => {
    const e = montarAvisoCliente({ novas: [{ titulo: "Post" }], ajustadas: [{ titulo: "Reel" }], linkPainel: link, urlBase: "https://exemplo.test" });
    expect(e.html + e.texto).not.toMatch(/softmoni|briefing|horas|piso|mensalidade/i);
    expect(e.texto).toContain("só recebe este e-mail quando tem algo");
  });
  it("escapa HTML dos títulos", () => {
    const e = montarAvisoCliente({ novas: [{ titulo: "<b>oi</b>" }], ajustadas: [], linkPainel: link, urlBase: "https://exemplo.test" });
    expect(e.html).not.toContain("<b>oi</b>");
  });
});
