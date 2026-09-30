// Base dos PDFs da Aden (contrato e onboarding), com a identidade real da marca (30/09/2026):
// - logo é só a tipografia "aden" (lib/documentos/logo.ts);
// - branco domina, verde de apoio; tons de apoio puxam para o verde mais escuro; preto só na versão negativa
//   (o texto é um verde quase preto, nunca preto puro);
// - formas orgânicas: ondas, curvas e cantos arredondados. Nada de folha ou planta.
// Roda no servidor (contrato para a Autentique) e no navegador (baixar PDF). Fonte Montserrat embutida.

import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { MONTSERRAT_FORTE, MONTSERRAT_REGULAR, MONTSERRAT_SEMI } from "./fontes";
import { LOGO_ADEN } from "./logo";

export const CORES_ADEN = {
  branco: "#ffffff",
  verde: "#797c46",
  verdeEscuro: "#5c5f33",
  verdeProfundo: "#3e4122",
  /** fundo de cartões e faixas leves */
  verdeClaro: "#eef0e3",
  verdeMedio: "#d9dcc4",
  linha: "#e4e6d6",
  texto: "#2b2e1a",
  textoSuave: "#6a6d55",
} as const;

export type NomeCor = keyof typeof CORES_ADEN;

function hex(h: string): RGB {
  const n = parseInt(h.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}
export const cor = (c: NomeCor) => hex(CORES_ADEN[c]);

export const A4 = { largura: 595.28, altura: 841.89 };

export interface Fontes {
  regular: PDFFont;
  semi: PDFFont;
  forte: PDFFont;
}

const bytes = (b64: string) => (typeof Buffer !== "undefined" ? new Uint8Array(Buffer.from(b64, "base64")) : Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));

export async function novoDocumento(titulo: string, geradoEm: Date = new Date()) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(limparTexto(titulo));
  pdf.setCreator("Aden");
  pdf.setProducer("Aden");
  pdf.setCreationDate(geradoEm);
  const fontes: Fontes = {
    regular: await pdf.embedFont(bytes(MONTSERRAT_REGULAR), { subset: true }),
    semi: await pdf.embedFont(bytes(MONTSERRAT_SEMI), { subset: true }),
    forte: await pdf.embedFont(bytes(MONTSERRAT_FORTE), { subset: true }),
  };
  return { pdf, fontes };
}

// só o que a fonte tem: setas viram "->", o resto fora do latino some
export const limparTexto = (t: string) =>
  t
    .replace(/[→⇒]/g, "->")
    .replace(/[‐-‒]/g, "-")
    .replace(/[^\x20-\x7E\xA0-\xFF·•–—‘’“”…]/g, "");

// medida letra por letra: o pdf-lib mede com kerning e desenha sem (palavras coladas)
const cache = new WeakMap<PDFFont, Map<string, number>>();
export function largura(fonte: PDFFont, texto: string, tamanho: number, espacamento = 0): number {
  let m = cache.get(fonte);
  if (!m) cache.set(fonte, (m = new Map()));
  let soma = 0;
  let n = 0;
  for (const ch of texto) {
    let w = m.get(ch);
    if (w === undefined) m.set(ch, (w = fonte.widthOfTextAtSize(ch, 1000)));
    soma += w;
    n++;
  }
  return (soma * tamanho) / 1000 + espacamento * Math.max(0, n - 1);
}

export type Trecho = { texto: string; fonte?: keyof Fontes; cor?: NomeCor };
type Palavra = { texto: string; fonte: PDFFont; cor: RGB | null };

/** Quebra trechos (com fontes diferentes) em linhas que cabem na largura. */
export function quebrar(trechos: Trecho[], fontes: Fontes, tamanho: number, limite: number): Palavra[][] {
  const palavras: Palavra[] = [];
  for (const t of trechos)
    for (const p of limparTexto(t.texto).split(/\s+/).filter(Boolean)) palavras.push({ texto: p, fonte: fontes[t.fonte ?? "regular"], cor: t.cor ? cor(t.cor) : null });
  const linhas: Palavra[][] = [];
  let atual: Palavra[] = [];
  let usado = 0;
  const espaco = largura(fontes.regular, " ", tamanho);
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

/** Desenha linhas já quebradas a partir do topo `y`; devolve o novo topo. */
export function desenharLinhas(
  pagina: PDFPage,
  linhas: Palavra[][],
  fontes: Fontes,
  o: { x: number; y: number; tamanho: number; cor: RGB; entrelinha?: number; alinhar?: "esquerda" | "centro"; larguraCaixa?: number },
): number {
  const alt = o.tamanho * (o.entrelinha ?? 1.55);
  const espaco = largura(fontes.regular, " ", o.tamanho);
  let y = o.y;
  for (const l of linhas) {
    const total = l.reduce((s, p, i) => s + largura(p.fonte, p.texto, o.tamanho) + (i ? espaco : 0), 0);
    let cx = o.alinhar === "centro" && o.larguraCaixa ? o.x + (o.larguraCaixa - total) / 2 : o.x;
    for (const p of l) {
      pagina.drawText(p.texto, { x: cx, y: y - o.tamanho, size: o.tamanho, font: p.fonte, color: p.cor ?? o.cor });
      cx += largura(p.fonte, p.texto, o.tamanho) + espaco;
    }
    y -= alt;
  }
  return y;
}

/** Texto numa linha só, com espaçamento entre letras (rótulos em caixa alta). */
export function rotulo(pagina: PDFPage, texto: string, o: { x: number; y: number; tamanho: number; fonte: PDFFont; cor: RGB; espacamento?: number; direita?: boolean }) {
  const t = limparTexto(texto);
  const esp = o.espacamento ?? 0;
  let x = o.direita ? o.x - largura(o.fonte, t, o.tamanho, esp) : o.x;
  for (const ch of t) {
    pagina.drawText(ch, { x, y: o.y, size: o.tamanho, font: o.fonte, color: o.cor });
    x += largura(o.fonte, ch, o.tamanho) + esp;
  }
}

/** Logo "aden" com o topo em `yTopo` e a altura pedida. Devolve a largura desenhada. */
export function logo(pagina: PDFPage, x: number, yTopo: number, altura: number, c: RGB): number {
  const escala = altura / LOGO_ADEN.altura;
  for (const d of LOGO_ADEN.caminhos) pagina.drawSvgPath(d, { x, y: yTopo, scale: escala, color: c });
  return LOGO_ADEN.largura * escala;
}

/** Retângulo com cantos arredondados; (x, yTopo) é o canto de cima à esquerda. */
export function caixa(pagina: PDFPage, x: number, yTopo: number, w: number, h: number, r: number, o: { cor?: RGB; borda?: RGB; espessura?: number; opacidade?: number }) {
  const k = 0.5523 * r;
  const d = `M ${r} 0 H ${w - r} C ${w - r + k} 0 ${w} ${r - k} ${w} ${r} V ${h - r} C ${w} ${h - r + k} ${w - r + k} ${h} ${w - r} ${h} H ${r} C ${r - k} ${h} 0 ${h - r + k} 0 ${h - r} V ${r} C 0 ${r - k} ${r - k} 0 ${r} 0 Z`;
  pagina.drawSvgPath(d, {
    x,
    y: yTopo,
    color: o.cor,
    borderColor: o.borda,
    borderWidth: o.borda ? (o.espessura ?? 1) : undefined,
    opacity: o.opacidade,
    borderOpacity: o.opacidade,
  });
}

// Ícones de traço (desenho próprio no estilo linha, grade 24 × 24)
const ICONES: Record<string, string[]> = {
  check: ["M5 12.5 l4.5 4.5 L19 7.5"],
  mao: ["M7 11 V6.5 a1.5 1.5 0 0 1 3 0 V11", "M10 10 V5 a1.5 1.5 0 0 1 3 0 V11", "M13 10.5 V6 a1.5 1.5 0 0 1 3 0 V13", "M7 11 C5 10 3.5 11.5 5 13.5 L8.5 18 C10 20 12 21 14.5 21 C17.5 21 19 18.5 19 15.5 V9.5 a1.5 1.5 0 0 0 -3 0"],
  alvo: ["M12 3 a9 9 0 1 0 0.01 0 Z", "M12 7 a5 5 0 1 0 0.01 0 Z", "M12 11 a1 1 0 1 0 0.01 0 Z"],
  olho: ["M2.5 12 C5 7 8.5 5 12 5 S19 7 21.5 12 C19 17 15.5 19 12 19 S5 17 2.5 12 Z", "M12 9 a3 3 0 1 0 0.01 0 Z"],
  lista: ["M9 6.5 H20", "M9 12 H20", "M9 17.5 H20", "M4 6.5 l1 1 2-2", "M4 12 l1 1 2-2", "M4 17.5 l1 1 2-2"],
  camadas: ["M12 3 L21 8 L12 13 L3 8 Z", "M3 12.5 L12 17.5 L21 12.5", "M3 16.5 L12 21.5 L21 16.5"],
  relogio: ["M12 3 a9 9 0 1 0 0.01 0 Z", "M12 7.5 V12 L15 14"],
  maos: ["M4 12 L8 8 L12 10 L16 7 L20 11", "M4 12 L9 17 C10 18 11.5 18 12.5 17 L17 12.5", "M8 14 L10 16", "M10.5 12.5 L13 15"],
  rota: ["M6 19 a2 2 0 1 0 0.01 0 Z", "M18 5 a2 2 0 1 0 0.01 0 Z", "M8 19 H15.5 a3.5 3.5 0 0 0 0 -7 H8.5 a3.5 3.5 0 0 1 0 -7 H16"],
  duvida: ["M12 3 a9 9 0 1 0 0.01 0 Z", "M9.3 9.2 a2.8 2.8 0 0 1 5.4 1 c0 1.9 -2.7 2.4 -2.7 4", "M12 17.3 V17.4"],
  conversa: ["M4 5.5 H20 V16 H11 L6.5 20 V16 H4 Z"],
  telefone: ["M7 3.5 H10 L11.5 8 L9.3 9.5 C10.4 11.8 12.2 13.6 14.5 14.7 L16 12.5 L20.5 14 V17 C20.5 19 19 20.5 17 20.5 C9.5 20 4 14.5 3.5 7 C3.5 5 5 3.5 7 3.5 Z"],
  instagram: ["M8 3.5 H16 a4.5 4.5 0 0 1 4.5 4.5 V16 a4.5 4.5 0 0 1 -4.5 4.5 H8 a4.5 4.5 0 0 1 -4.5 -4.5 V8 A4.5 4.5 0 0 1 8 3.5 Z", "M12 8.5 a3.5 3.5 0 1 0 0.01 0 Z", "M17 6.8 V6.9"],
  email: ["M3.5 6 H20.5 V18 H3.5 Z", "M3.5 6.5 L12 13 L20.5 6.5"],
  estrela: ["M12 3.5 L14.6 9 L20.5 9.7 L16.1 13.7 L17.3 19.5 L12 16.6 L6.7 19.5 L7.9 13.7 L3.5 9.7 L9.4 9 Z"],
  calendario: ["M4.5 6 H19.5 V20 H4.5 Z", "M4.5 10 H19.5", "M8.5 4 V7.5", "M15.5 4 V7.5"],
  foguete: ["M12 3 C15.5 5 17 9 16 14 H8 C7 9 8.5 5 12 3 Z", "M12 9 a1.5 1.5 0 1 0 0.01 0 Z", "M8 14 L5.5 17 L8.5 17.5", "M16 14 L18.5 17 L15.5 17.5", "M10 17.5 L12 21 L14 17.5"],
};
export type NomeIcone = keyof typeof ICONES;

/** Ícone de traço dentro de um quadrado de `tamanho`, com o topo em `yTopo`. */
export function icone(pagina: PDFPage, nome: NomeIcone, x: number, yTopo: number, tamanho: number, c: RGB, espessura = 1.8) {
  const escala = tamanho / 24;
  for (const d of ICONES[nome]) pagina.drawSvgPath(d, { x, y: yTopo, scale: escala, borderColor: c, borderWidth: espessura / escala, borderLineCap: 1 });
}

/** Círculo cheio com um ícone no meio. (cx, cy) em coordenadas do PDF. */
export function iconeEmCirculo(pagina: PDFPage, nome: NomeIcone, cx: number, cy: number, raio: number, fundo: RGB, traco: RGB) {
  pagina.drawCircle({ x: cx, y: cy, size: raio, color: fundo });
  const t = raio * 1.1;
  icone(pagina, nome, cx - t / 2, cy + t / 2, t, traco, Math.max(1.2, raio / 9));
}
