// PDF do contrato que vai para a Autentique. Sai do mesmo DocumentoContrato que a tela mostra.
// Texto simples, preto e cinza: a identidade da Aden entra no passo 7, quando a logo fechar.

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { DocumentoContrato } from "../calculo/contrato";

const A4: [number, number] = [595.28, 841.89];
const MARGEM = 56;
const LARGURA = A4[0] - MARGEM * 2;

// as fontes padrão do PDF só têm o alfabeto latino; o resto vira um caractere parecido
const limpar = (t: string) =>
  t
    .replace(/[→⇒]/g, "->")
    .replace(/[•·]/g, "·")
    .replace(/[^\x20-\x7E\xA0-\xFF·–—‘’“”…]/g, "");

function quebrar(texto: string, fonte: PDFFont, tamanho: number, largura: number): string[] {
  const linhas: string[] = [];
  let atual = "";
  for (const palavra of limpar(texto).split(/\s+/).filter(Boolean)) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra;
    if (fonte.widthOfTextAtSize(tentativa, tamanho) <= largura || !atual) atual = tentativa;
    else {
      linhas.push(atual);
      atual = palavra;
    }
  }
  if (atual) linhas.push(atual);
  return linhas;
}

export async function contratoEmPdf(doc: DocumentoContrato, geradoEm: Date = new Date()): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(limpar(doc.titulo));
  pdf.setCreationDate(geradoEm);
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);
  const preto = rgb(0.1, 0.1, 0.1);
  const cinza = rgb(0.4, 0.4, 0.4);

  let pagina: PDFPage = pdf.addPage(A4);
  let y = A4[1] - MARGEM;
  const espaco = (altura: number) => {
    if (y - altura < MARGEM) {
      pagina = pdf.addPage(A4);
      y = A4[1] - MARGEM;
    }
  };
  const escrever = (texto: string, fonte: PDFFont, tamanho: number, cor = preto, recuo = 0) => {
    for (const linha of quebrar(texto, fonte, tamanho, LARGURA - recuo)) {
      espaco(tamanho * 1.45);
      pagina.drawText(linha, { x: MARGEM + recuo, y: y - tamanho, size: tamanho, font: fonte, color: cor });
      y -= tamanho * 1.45;
    }
  };

  escrever(doc.titulo, negrito, 15);
  y -= 14;
  doc.secoes.forEach((s, i) => {
    espaco(40);
    y -= 6;
    escrever(`${i + 1}. ${s.titulo}`, negrito, 11.5);
    y -= 2;
    for (const it of s.itens ?? []) escrever(`${it.rotulo}: ${it.valor}`, normal, 10, preto, 10);
    for (const p of s.paragrafos ?? []) {
      escrever(p, normal, 10, preto, 10);
      y -= 4;
    }
    y -= 6;
  });

  espaco(60);
  y -= 10;
  escrever("Assinaturas", negrito, 11.5);
  for (const s of doc.signatarios) escrever(`${s.nome} · ${s.email}`, normal, 10, preto, 10);
  y -= 6;
  escrever("Assinado eletronicamente pela Autentique; a página de assinaturas é anexada pela própria plataforma.", normal, 8.5, cinza);

  return pdf.save();
}
