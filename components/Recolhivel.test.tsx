import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Recolhivel } from "./Recolhivel";

describe("Recolhivel", () => {
  it("começa fechado, com o resumo à mostra e o conteúdo escondido", () => {
    const html = renderToStaticMarkup(
      <Recolhivel id="teste" titulo="Funil" resumo="8 começaram">
        <p>detalhe</p>
      </Recolhivel>,
    );
    expect(html).toContain("8 começaram");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("hidden");
  });

  it("pode começar aberto e não mostra o resumo", () => {
    const html = renderToStaticMarkup(
      <Recolhivel id="teste" titulo="Funil" resumo="8 começaram" abertoPadrao>
        <p>detalhe</p>
      </Recolhivel>,
    );
    expect(html).toContain('aria-expanded="true"');
    expect(html).not.toContain("8 começaram");
  });
});
