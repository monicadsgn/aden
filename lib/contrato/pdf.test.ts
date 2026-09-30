// PDF do contrato. Textos aqui são só fixtures de teste.
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { contratoEmPdf } from "./pdf";

describe("PDF do contrato", () => {
  it("gera um PDF válido com acentos e quebra em várias páginas quando o texto é longo", async () => {
    const longo = Array.from({ length: 80 }, (_, i) => `Cláusula ${i + 1}: obrigações da contratante e da contratada, com acentuação → ok.`);
    const bytes = await contratoEmPdf({
      titulo: "Contrato de prestação de serviços · Loja X",
      secoes: [
        { titulo: "Partes", itens: [{ rotulo: "Contratante", valor: "Loja X · São João" }] },
        { titulo: "Obrigações", paragrafos: longo },
      ],
      signatarios: [{ nome: "Ana", email: "ana@loja.com" }],
      faltando: [],
    });
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(1);
  });
});
