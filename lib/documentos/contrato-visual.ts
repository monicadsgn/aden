// Contrato em PDF com a identidade da Aden (30/09/2026): primeira página com bloco verde cheio no topo, logo em
// branco, título grande e a linha do contratante; uma onda separa o verde do corpo branco. Partes em cartões,
// cláusulas com título verde em negrito, assinaturas em cartões e rodapé com a logo pequena.

import type { PDFPage } from "pdf-lib";
import type { DocumentoContrato } from "../calculo/contrato";
import { A4, caixa, cor, desenharLinhas, largura, limparTexto, logo, novoDocumento, quebrar, rotulo, type Fontes } from "./base";

const MX = 56;
const LARG = A4.largura - MX * 2;
const BASE = 74;

function rodape(p: PDFPage, f: Fontes, texto: string, n: number) {
  p.drawLine({ start: { x: MX, y: 52 }, end: { x: A4.largura - MX, y: 52 }, thickness: 0.6, color: cor("linha") });
  logo(p, MX, 42, 11, cor("verde"));
  const t = limparTexto(texto);
  const w = largura(f.regular, t, 7.5);
  p.drawText(t, { x: MX + 40 + (LARG - 40 - 30 - w) / 2, y: 33, size: 7.5, font: f.regular, color: cor("textoSuave") });
  p.drawCircle({ x: A4.largura - MX - 8, y: 35.5, size: 8, color: cor("verde") });
  const s = String(n);
  p.drawText(s, { x: A4.largura - MX - 8 - largura(f.forte, s, 7.5) / 2, y: 33, size: 7.5, font: f.forte, color: cor("branco") });
}

function cabecalhoInterno(p: PDFPage, f: Fontes, titulo: string) {
  // faixa curva fininha no topo
  p.drawSvgPath(`M0 0 H${A4.largura} V14 C ${A4.largura * 0.7} 30, ${A4.largura * 0.35} 4, 0 20 Z`, { x: 0, y: A4.altura, color: cor("verde") });
  logo(p, MX, A4.altura - 40, 13, cor("verde"));
  rotulo(p, titulo.toUpperCase(), { x: A4.largura - MX, y: A4.altura - 51, tamanho: 6.8, fonte: f.semi, cor: cor("textoSuave"), espacamento: 0.8, direita: true });
}

function capa(p: PDFPage, f: Fontes, doc: DocumentoContrato, marca: string): number {
  const W = A4.largura;
  const topo = A4.altura;
  // ondas em camadas: verde claro, verde escuro e o verde da marca por cima
  p.drawSvgPath(`M0 0 H${W} V262 C ${W * 0.84} 300, ${W * 0.62} 236, ${W * 0.42} 268 C ${W * 0.26} 293, ${W * 0.1} 286, 0 266 Z`, { x: 0, y: topo, color: cor("verdeClaro") });
  p.drawSvgPath(`M0 0 H${W} V250 C ${W * 0.84} 286, ${W * 0.62} 224, ${W * 0.42} 255 C ${W * 0.26} 280, ${W * 0.1} 273, 0 254 Z`, { x: 0, y: topo, color: cor("verdeEscuro") });
  p.drawSvgPath(`M0 0 H${W} V238 C ${W * 0.84} 272, ${W * 0.62} 210, ${W * 0.42} 241 C ${W * 0.26} 266, ${W * 0.1} 259, 0 242 Z`, { x: 0, y: topo, color: cor("verde") });
  // formas orgânicas dentro do verde
  p.drawCircle({ x: W - 40, y: topo - 40, size: 120, color: cor("branco"), opacity: 0.06 });
  p.drawCircle({ x: W - 110, y: topo - 175, size: 46, color: cor("branco"), opacity: 0.07 });
  p.drawSvgPath(`M ${W - 260} 0 C ${W - 220} 70, ${W - 120} 110, ${W} 96`, { x: 0, y: topo, borderColor: cor("branco"), borderWidth: 1.2, borderOpacity: 0.18 });

  logo(p, MX, topo - 44, 24, cor("branco"));
  rotulo(p, "CONTRATO", { x: MX, y: topo - 104, tamanho: 8, fonte: f.semi, cor: cor("branco"), espacamento: 2.2 });
  let y = topo - 114;
  y = desenharLinhas(p, quebrar([{ texto: "Contrato de prestação de serviços", fonte: "forte" }], f, 25, LARG), f, { x: MX, y, tamanho: 25, cor: cor("branco"), entrelinha: 1.2 });
  y -= 2;
  y = desenharLinhas(p, quebrar([{ texto: `Aden · ${marca}`, fonte: "semi" }], f, 13, LARG), f, { x: MX, y, tamanho: 13, cor: cor("branco"), entrelinha: 1.3 });
  if (doc.subtitulo) y = desenharLinhas(p, quebrar([{ texto: doc.subtitulo }], f, 9.5, LARG), f, { x: MX, y: y - 1, tamanho: 9.5, cor: cor("branco"), entrelinha: 1.4 });
  // linha do contratante numa pílula clara
  const linha = limparTexto(doc.linhaTopo);
  const wl = Math.min(largura(f.semi, linha, 8) + 24, LARG);
  caixa(p, MX, y - 8, wl, 20, 10, { cor: cor("branco"), opacidade: 0.14 });
  p.drawText(linha, { x: MX + 12, y: y - 21.5, size: 8, font: f.semi, color: cor("branco"), maxWidth: LARG - 24 });
  return topo - 300;
}

export async function contratoVisual(doc: DocumentoContrato, geradoEm: Date = new Date()): Promise<Uint8Array> {
  const { pdf, fontes: f } = await novoDocumento(doc.titulo, geradoEm);
  const marca = doc.titulo.split(" · ").at(-1) ?? "";
  const paginas: PDFPage[] = [];
  let p!: PDFPage;
  let y = 0;
  const nova = () => {
    p = pdf.addPage([A4.largura, A4.altura]);
    paginas.push(p);
    if (paginas.length === 1) y = capa(p, f, doc, marca);
    else {
      cabecalhoInterno(p, f, doc.titulo);
      y = A4.altura - 76;
    }
  };
  const caber = (h: number) => {
    if (y - h < BASE) nova();
  };
  const texto = (trechos: Parameters<typeof quebrar>[0], x: number, w: number, tamanho = 9.4, c = cor("texto")) => {
    const linhas = quebrar(trechos, f, tamanho, w);
    for (const l of linhas) {
      caber(tamanho * 1.6);
      y = desenharLinhas(p, [l], f, { x, y, tamanho, cor: c, entrelinha: 1.6 });
    }
  };

  nova();

  // Partes, em cartões verde-claro
  for (const parte of doc.partes) {
    const linhas = quebrar([{ texto: parte.texto }], f, 9, LARG - 36);
    const h = 30 + linhas.length * 9 * 1.55 + 8;
    caber(h + 10);
    caixa(p, MX, y, LARG, h, 14, { cor: cor("verdeClaro") });
    p.drawCircle({ x: MX + 22, y: y - 20, size: 3, color: cor("verde") });
    rotulo(p, parte.rotulo, { x: MX + 31, y: y - 23, tamanho: 7.5, fonte: f.forte, cor: cor("verdeEscuro"), espacamento: 1.6 });
    desenharLinhas(p, linhas, f, { x: MX + 18, y: y - 32, tamanho: 9, cor: cor("texto") });
    y -= h + 10;
  }
  y -= 2;
  texto([{ texto: doc.abertura }], MX, LARG, 9, cor("textoSuave"));

  // Cláusulas
  for (const c of doc.clausulas) {
    caber(70);
    y -= 16;
    const [num, ...resto] = c.titulo.split(". ");
    const titulo = resto.join(". ") || c.titulo;
    caixa(p, MX, y + 1, 22, 22, 7, { cor: cor("verde") });
    p.drawText(num, { x: MX + 11 - largura(f.forte, num, 10) / 2, y: y - 14.5, size: 10, font: f.forte, color: cor("branco") });
    rotulo(p, titulo.toUpperCase(), { x: MX + 32, y: y - 14.5, tamanho: 10.5, fonte: f.forte, cor: cor("verde"), espacamento: 0.6 });
    y -= 32;
    for (const it of c.itens) {
      const recuo = it.sub ? 34 : 0;
      const wm = it.sub ? 16 : 26;
      const linhas = quebrar([{ texto: it.texto }], f, 9.4, LARG - recuo - wm);
      caber(15);
      if (it.marcador) p.drawText(limparTexto(it.marcador), { x: MX + recuo, y: y - 9.4, size: 9.4, font: f.semi, color: cor("verde") });
      for (const l of linhas) {
        caber(15);
        y = desenharLinhas(p, [l], f, { x: MX + recuo + wm, y, tamanho: 9.4, cor: cor("texto"), entrelinha: 1.6 });
      }
      y -= 3;
    }
  }

  // Local e data e assinaturas
  caber(150);
  y -= 18;
  texto([{ texto: doc.localData, fonte: "semi" }], MX, LARG, 9.4, cor("texto"));
  y -= 14;
  const col = (LARG - 16) / 2;
  for (let i = 0; i < doc.assinaturas.length; i += 2) {
    caber(96);
    doc.assinaturas.slice(i, i + 2).forEach((a, j) => {
      const x = MX + j * (col + 16);
      caixa(p, x, y, col, 86, 14, { cor: cor("verdeClaro") });
      p.drawLine({ start: { x: x + 16, y: y - 46 }, end: { x: x + col - 16, y: y - 46 }, thickness: 0.8, color: cor("verdeEscuro") });
      p.drawText(limparTexto(a.nome), { x: x + 16, y: y - 60, size: 9.5, font: f.forte, color: cor("texto"), maxWidth: col - 32 });
      p.drawText(limparTexto(a.papel), { x: x + 16, y: y - 73, size: 7.5, font: f.regular, color: cor("textoSuave"), maxWidth: col - 32 });
    });
    y -= 100;
  }

  paginas.forEach((pg, i) => rodape(pg, f, doc.rodape, i + 1));
  return pdf.save();
}
