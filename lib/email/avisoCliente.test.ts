import { describe, expect, it } from "vitest";
import { montarAvisoCliente } from "./avisoCliente";

const link = "https://exemplo.test/c/abc123";

describe("e-mail de aviso ao cliente", () => {
  it("peça nova: assunto, lista e botão para o painel", () => {
    const e = montarAvisoCliente({ nomeContato: "Jônatas", novas: ["[STADIUMPLAY] - Marca um amigo (estático, quinta 22/10)"], ajustadas: [], linkPainel: link });
    expect(e.assunto).toBe("Tem uma peça nova pra você aprovar");
    expect(e.texto).toContain("Oi, Jônatas!");
    expect(e.html).toContain(link);
    expect(e.html).not.toContain("[STADIUMPLAY]");
  });
  it("ajuste devolvido tem assunto próprio", () => {
    const e = montarAvisoCliente({ novas: [], ajustadas: ["Card X"], linkPainel: link });
    expect(e.assunto).toBe("Fizemos o ajuste que você pediu");
    expect(e.html).toContain("Ajustes feitos");
    expect(e.html).not.toContain("Para aprovar");
  });
  it("nada interno e nunca promete aviso diário", () => {
    const e = montarAvisoCliente({ novas: ["Post"], ajustadas: ["Reel"], linkPainel: link });
    expect(e.html + e.texto).not.toMatch(/softmoni|briefing|horas|piso|mensalidade/i);
    expect(e.texto).toContain("Sem novidade, sem e-mail.");
  });
  it("escapa HTML dos títulos", () => {
    const e = montarAvisoCliente({ novas: ["<b>oi</b>"], ajustadas: [], linkPainel: link });
    expect(e.html).not.toContain("<b>oi</b>");
  });
});
