// PDF do contrato. Textos aqui são só fixtures de teste.
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import type { DocumentoContrato } from "../calculo/contrato";
import { contratoEmPdf, contratoParaPdf } from "./pdf";

const doc = (n: number): DocumentoContrato => ({
  titulo: "Contrato de prestação de serviços · Aden · Loja X",
  subtitulo: "Social media",
  linhaTopo: "Contratante: Loja X • Recife - Pernambuco, 30 de setembro de 2026",
  partes: [{ rotulo: "CONTRATANTE", texto: "Loja X, pessoa jurídica inscrita no CNPJ sob o nº 00.000.000/0001-00." }],
  abertura: "As partes acima identificadas…",
  clausulas: [{ titulo: "1. Obrigações", itens: Array.from({ length: n }, (_, i) => ({ marcador: `1.${i + 1}`, texto: `Cláusula com acentuação → ok ${i}.` })) }],
  localData: "Recife - Pernambuco, 30 de setembro de 2026",
  assinaturas: [
    { nome: "Ana", papel: "CONTRATANTE · Loja X" },
    { nome: "Sócio", papel: "CONTRATADA · Aden" },
  ],
  rodape: "Recife - Pernambuco | +55 81 0000-0000 | a@aden.com",
  signatarios: [],
  faltando: [],
  arquivo: "x",
});

describe("PDF do contrato", () => {
  it("gera um PDF válido, com várias páginas quando o texto é longo", async () => {
    const bytes = await contratoEmPdf(doc(80));
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(1);
  });

  it("partes com rótulo em negrito, cláusulas numeradas, local e data e assinaturas no fim", () => {
    const p = contratoParaPdf(doc(2));
    expect(p.elementos[0]).toEqual({ tipo: "paragrafo", trechos: [{ texto: "CONTRATANTE:", negrito: true }, { texto: expect.stringContaining("Loja X") }] });
    expect(p.elementos.filter((e) => e.tipo === "item").map((e) => (e as { marcador: string }).marcador)).toEqual(["1.1", "1.2"]);
    expect(p.elementos.at(-1)).toMatchObject({ tipo: "assinaturas" });
    expect(p.rodape).toContain("+55 81 0000-0000");
  });
});
