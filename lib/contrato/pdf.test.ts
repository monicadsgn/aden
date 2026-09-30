// PDF do contrato. Textos aqui são só fixtures de teste.
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import type { DocumentoContrato } from "../calculo/contrato";
import { contratoEmPdf } from "./pdf";

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
});
