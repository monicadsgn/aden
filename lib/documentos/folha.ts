// Molde dos PDFs da Aden (contrato, onboarding): folha creme, cabeçalho com a marca, títulos numerados, itens com
// marcador, bloco de assinaturas e rodapé com contato e número da página. Roda no servidor (contrato para a
// Autentique) e no navegador (baixar PDF). Fonte padrão do PDF (Helvetica) até a identidade fechar.

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { IDENTIDADE_PDF } from "./identidade";

export type Trecho = { texto: string; negrito?: boolean };

export type ElementoPdf =
  | { tipo: "titulo"; texto: string }
  | { tipo: "paragrafo"; trechos: Trecho[]; suave?: boolean }
  | { tipo: "item"; marcador: string; texto: string; destaque?: string | null; nivel?: 0 | 1 }
  | { tipo: "espaco"; altura?: number }
  | { tipo: "assinaturas"; pessoas: { nome: string; papel: string }[] };

export interface DocumentoPdf {
  /** rótulo pequeno acima do título (ex.: "Contrato", "Onboarding") */
  tipo: string;
  titulo: string;
  subtitulo?: string | null;
  /** linha fina logo abaixo do título (ex.: contratante e local/data) */
  linhaTopo?: string | null;
  elementos: ElementoPdf[];
  /** texto do rodapé de cada página (contato) */
  rodape?: string | null;
}

const A4: [number, number] = [595.28, 841.89];
const MARGEM_X = 58;
const TOPO = 64;
const BASE = 70;
const LARGURA = A4[0] - MARGEM_X * 2;

function cor(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}
const C = Object.fromEntries(Object.entries(IDENTIDADE_PDF).map(([k, v]) => [k, cor(v)])) as Record<keyof typeof IDENTIDADE_PDF, RGB>;

// a fonte padrão do PDF só tem o alfabeto latino; o resto vira um caractere parecido
export const limparTexto = (t: string) =>
  t
    .replace(/[→⇒]/g, "->")
    .replace(/[‐-‒]/g, "-")
    .replace(/[^\x20-\x7E\xA0-\xFF·•–—‘’“”…]/g, "");

type Palavra = { texto: string; fonte: PDFFont };

// o pdf-lib mede com kerning, mas desenha sem: medir letra por letra evita palavras coladas ("CONTRATANTEpagará")
const cacheLarguras = new WeakMap<PDFFont, Map<string, number>>();
function largura(fonte: PDFFont, texto: string, tamanho: number): number {
  let m = cacheLarguras.get(fonte);
  if (!m) cacheLarguras.set(fonte, (m = new Map()));
  let soma = 0;
  for (const ch of texto) {
    let w = m.get(ch);
    if (w === undefined) m.set(ch, (w = fonte.widthOfTextAtSize(ch, 1000)));
    soma += w;
  }
  return (soma * tamanho) / 1000;
}

function quebrarTrechos(trechos: Trecho[], normal: PDFFont, negrito: PDFFont, tamanho: number, limite: number): Palavra[][] {
  const palavras: Palavra[] = [];
  for (const t of trechos) for (const p of limparTexto(t.texto).split(/\s+/).filter(Boolean)) palavras.push({ texto: p, fonte: t.negrito ? negrito : normal });
  const linhas: Palavra[][] = [];
  let atual: Palavra[] = [];
  let usado = 0;
  const espaco = largura(normal, " ", tamanho);
  for (const p of palavras) {
    const w = largura(p.fonte, p.texto, tamanho);
    const extra = atual.length ? espaco + w : w;
    if (atual.length && usado + extra > limite) {
      linhas.push(atual);
      atual = [p];
      usado = w;
    } else {
      atual.push(p);
      usado += extra;
    }
  }
  if (atual.length) linhas.push(atual);
  return linhas;
}

export async function gerarPdf(doc: DocumentoPdf, geradoEm: Date = new Date()): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(limparTexto(doc.titulo));
  pdf.setCreator("Aden");
  pdf.setCreationDate(geradoEm);
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);

  const paginas: PDFPage[] = [];
  let pagina!: PDFPage;
  let y = 0;

  const marca = (p: PDFPage, x: number, yTopo: number, lado: number) => {
    p.drawRectangle({ x, y: yTopo - lado, width: lado, height: lado, color: C.marca });
    p.drawCircle({ x: x + lado * 0.92, y: yTopo - lado * 0.92, size: lado * 0.28, color: C.destaque, opacity: 0.75 });
    const a = largura(negrito, "a", lado * 0.62);
    p.drawText("a", { x: x + (lado - a) / 2, y: yTopo - lado * 0.7, size: lado * 0.62, font: negrito, color: C.fundo });
    p.drawText("aden", { x: x + lado + 8, y: yTopo - lado * 0.62, size: lado * 0.62, font: negrito, color: C.texto });
  };

  const novaPagina = () => {
    pagina = pdf.addPage(A4);
    paginas.push(pagina);
    pagina.drawRectangle({ x: 0, y: 0, width: A4[0], height: A4[1], color: C.fundo });
    if (paginas.length === 1) {
      marca(pagina, MARGEM_X, A4[1] - 48, 26);
      y = A4[1] - 48 - 26 - 30;
    } else {
      marca(pagina, MARGEM_X, A4[1] - 34, 16);
      const t = limparTexto(doc.titulo);
      const w = largura(normal, t, 8);
      pagina.drawText(t, { x: A4[0] - MARGEM_X - Math.min(w, LARGURA - 80), y: A4[1] - 46, size: 8, font: normal, color: C.textoSuave, maxWidth: LARGURA - 80 });
      pagina.drawLine({ start: { x: MARGEM_X, y: A4[1] - 58 }, end: { x: A4[0] - MARGEM_X, y: A4[1] - 58 }, thickness: 0.6, color: C.linha });
      y = A4[1] - TOPO - 16;
    }
  };
  const caber = (altura: number) => {
    if (y - altura < BASE) novaPagina();
  };

  const escreverLinhas = (linhas: Palavra[][], x: number, tamanho: number, corTexto: RGB) => {
    const alt = tamanho * 1.5;
    for (const l of linhas) {
      caber(alt);
      let cx = x;
      for (const p of l) {
        pagina.drawText(p.texto, { x: cx, y: y - tamanho, size: tamanho, font: p.fonte, color: corTexto });
        cx += largura(p.fonte, p.texto, tamanho) + largura(normal, " ", tamanho);
      }
      y -= alt;
    }
  };

  novaPagina();
  // capa: tipo, título, subtítulo, linha do topo
  pagina.drawText(limparTexto(doc.tipo.toUpperCase()), { x: MARGEM_X, y: y - 9, size: 9, font: negrito, color: C.marcaForte });
  y -= 22;
  escreverLinhas(quebrarTrechos([{ texto: doc.titulo, negrito: true }], normal, negrito, 20, LARGURA), MARGEM_X, 20, C.texto);
  if (doc.subtitulo) escreverLinhas(quebrarTrechos([{ texto: doc.subtitulo }], normal, negrito, 11, LARGURA), MARGEM_X, 11, C.marcaForte);
  y -= 6;
  pagina.drawRectangle({ x: MARGEM_X, y: y - 2, width: 48, height: 2.5, color: C.marca });
  y -= 14;
  if (doc.linhaTopo) escreverLinhas(quebrarTrechos([{ texto: doc.linhaTopo }], normal, negrito, 9, LARGURA), MARGEM_X, 9, C.textoSuave);
  y -= 10;

  for (const e of doc.elementos) {
    if (e.tipo === "espaco") y -= e.altura ?? 8;
    else if (e.tipo === "titulo") {
      caber(60);
      y -= 12;
      escreverLinhas(quebrarTrechos([{ texto: e.texto.toUpperCase(), negrito: true }], normal, negrito, 10.5, LARGURA), MARGEM_X, 10.5, C.marcaForte);
      y -= 3;
    } else if (e.tipo === "paragrafo") {
      escreverLinhas(quebrarTrechos(e.trechos, normal, negrito, 10, LARGURA), MARGEM_X, 10, e.suave ? C.textoSuave : C.texto);
      y -= 5;
    } else if (e.tipo === "item") {
      const recuo = e.nivel === 1 ? 22 : 0;
      const larguraMarcador = Math.max(largura(negrito, limparTexto(e.marcador), 10) + 6, 20);
      const trechos: Trecho[] = [...(e.destaque ? [{ texto: e.destaque, negrito: true }] : []), { texto: e.texto }];
      const linhas = quebrarTrechos(trechos, normal, negrito, 10, LARGURA - recuo - larguraMarcador);
      caber(15);
      pagina.drawText(limparTexto(e.marcador), { x: MARGEM_X + recuo, y: y - 10, size: 10, font: negrito, color: C.marcaForte });
      escreverLinhas(linhas, MARGEM_X + recuo + larguraMarcador, 10, C.texto);
      y -= 3;
    } else if (e.tipo === "assinaturas") {
      const col = (LARGURA - 30) / 2;
      for (let i = 0; i < e.pessoas.length; i += 2) {
        caber(80);
        y -= 46;
        e.pessoas.slice(i, i + 2).forEach((p, j) => {
          const x = MARGEM_X + j * (col + 30);
          pagina.drawLine({ start: { x, y }, end: { x: x + col, y }, thickness: 0.8, color: C.texto });
          pagina.drawText(limparTexto(p.nome), { x, y: y - 14, size: 10, font: negrito, color: C.texto, maxWidth: col });
          pagina.drawText(limparTexto(p.papel), { x, y: y - 27, size: 8.5, font: normal, color: C.textoSuave, maxWidth: col });
        });
        y -= 36;
      }
    }
  }

  // rodapé em todas as páginas
  paginas.forEach((p, i) => {
    p.drawLine({ start: { x: MARGEM_X, y: 48 }, end: { x: A4[0] - MARGEM_X, y: 48 }, thickness: 0.6, color: C.linha });
    if (doc.rodape) p.drawText(limparTexto(doc.rodape), { x: MARGEM_X, y: 34, size: 8, font: normal, color: C.textoSuave, maxWidth: LARGURA - 40 });
    const n = String(i + 1);
    p.drawText(n, { x: A4[0] - MARGEM_X - largura(negrito, n, 8), y: 34, size: 8, font: negrito, color: C.marcaForte });
  });

  return pdf.save();
}

/** Baixar no navegador (onboarding, prévia do contrato). */
export function baixarPdf(bytes: Uint8Array, arquivo: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${arquivo}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
