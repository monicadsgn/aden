// Onboarding em PDF com a identidade da Aden (30/09/2026): capa inteira em verde com "Olá, [nome]!", uma seção por
// página com cartões arredondados, ícones e respiro, e a página final de contato em verde.
// Recebe só o DocumentoOnboarding (texto dos sócios + pacote, serviços e contrato do cliente): nada interno.

import type { PDFPage } from "pdf-lib";
import type { Bloco, DocumentoOnboarding, SecaoPronta } from "../calculo/onboarding";
import { A4, caixa, cor, desenharLinhas, iconeEmCirculo, largura, limparTexto, logo, novoDocumento, quebrar, rotulo, type Fontes, type NomeIcone } from "./base";

const MX = 60;
const LARG = A4.largura - MX * 2;
const BASE = 70;

function iconeDaSecao(s: SecaoPronta): NomeIcone {
  const t = s.titulo.toLowerCase();
  if (s.chave === "incluso") return "lista";
  if (s.chave === "servicos") return "camadas";
  if (s.chave === "prazos") return "relogio";
  if (s.chave === "contato") return "conversa";
  if (/boas-vindas|bem-vind/.test(t)) return "mao";
  if (/fazer|objetivo/.test(t)) return "alvo";
  if (/prática|pratica|como vai/.test(t)) return "olho";
  if (/precisar|compromisso/.test(t)) return "maos";
  if (/passos/.test(t)) return "rota";
  if (/dúvida|duvida|pergunta/.test(t)) return "duvida";
  return "estrela";
}

function capa(p: PDFPage, f: Fontes, doc: DocumentoOnboarding) {
  const W = A4.largura;
  const H = A4.altura;
  p.drawRectangle({ x: 0, y: 0, width: W, height: H, color: cor("verde") });
  p.drawCircle({ x: W - 30, y: H - 60, size: 190, color: cor("branco"), opacity: 0.05 });
  p.drawCircle({ x: W - 150, y: H - 250, size: 60, color: cor("branco"), opacity: 0.06 });
  p.drawCircle({ x: 40, y: 330, size: 22, color: cor("branco"), opacity: 0.08 });
  p.drawSvgPath(`M 0 ${H - 640} C ${W * 0.3} ${H - 600}, ${W * 0.55} ${H - 700}, ${W} ${H - 660}`, { x: 0, y: H, borderColor: cor("branco"), borderWidth: 1.2, borderOpacity: 0.16 });
  // ondas no pé da capa, puxando para o verde escuro
  p.drawSvgPath(`M0 ${H - 200} C ${W * 0.25} ${H - 250}, ${W * 0.55} ${H - 150}, ${W} ${H - 215} V ${H} H 0 Z`, { x: 0, y: H, color: cor("verdeEscuro") });
  p.drawSvgPath(`M0 ${H - 120} C ${W * 0.3} ${H - 165}, ${W * 0.62} ${H - 70}, ${W} ${H - 135} V ${H} H 0 Z`, { x: 0, y: H, color: cor("verdeProfundo") });

  logo(p, MX, H - 56, 28, cor("branco"));
  rotulo(p, "ONBOARDING", { x: MX, y: H - 330, tamanho: 9, fonte: f.semi, cor: cor("branco"), espacamento: 3.2 });
  let y = H - 344;
  y = desenharLinhas(p, quebrar([{ texto: "Olá,", fonte: "regular" }, { texto: `${doc.saudacao}!`, fonte: "forte" }], f, 46, LARG), f, { x: MX, y, tamanho: 46, cor: cor("branco"), entrelinha: 1.15 });
  y -= 6;
  y = desenharLinhas(p, quebrar([{ texto: "Boas-vindas à Aden", fonte: "semi" }], f, 15, LARG), f, { x: MX, y, tamanho: 15, cor: cor("verdeClaro") });
  if (doc.subtitulo) desenharLinhas(p, quebrar([{ texto: doc.subtitulo }], f, 10.5, LARG), f, { x: MX, y: y - 2, tamanho: 10.5, cor: cor("branco") });
  rotulo(p, doc.cliente.toUpperCase(), { x: MX, y: 60, tamanho: 7.5, fonte: f.semi, cor: cor("branco"), espacamento: 1.6 });
}

function contato(p: PDFPage, f: Fontes, doc: DocumentoOnboarding, s: SecaoPronta, n: number) {
  const W = A4.largura;
  const H = A4.altura;
  p.drawRectangle({ x: 0, y: 0, width: W, height: H, color: cor("verdeEscuro") });
  p.drawCircle({ x: W + 20, y: H - 80, size: 170, color: cor("branco"), opacity: 0.05 });
  p.drawSvgPath(`M0 ${H - 150} C ${W * 0.3} ${H - 200}, ${W * 0.6} ${H - 100}, ${W} ${H - 170} V ${H} H 0 Z`, { x: 0, y: H, color: cor("verdeProfundo") });
  logo(p, MX, H - 56, 20, cor("branco"));
  rotulo(p, String(n).padStart(2, "0"), { x: MX, y: H - 150, tamanho: 11, fonte: f.forte, cor: cor("verdeMedio"), espacamento: 1 });
  let y = H - 160;
  y = desenharLinhas(p, quebrar([{ texto: s.titulo, fonte: "forte" }], f, 30, LARG), f, { x: MX, y, tamanho: 30, cor: cor("branco"), entrelinha: 1.15 });
  y -= 30;
  const linhas: [NomeIcone, string, string | null][] = [
    ["telefone", "WHATSAPP", doc.contato.whatsapp],
    ["instagram", "INSTAGRAM", doc.contato.instagram],
    ["email", "E-MAIL", doc.contato.email],
    ["relogio", "ATENDIMENTO", doc.contato.atendimento],
  ];
  for (const [ic, r, v] of linhas) {
    if (!v) continue;
    iconeEmCirculo(p, ic, MX + 20, y - 20, 20, cor("branco"), cor("verdeEscuro"));
    rotulo(p, r, { x: MX + 54, y: y - 14, tamanho: 7, fonte: f.semi, cor: cor("verdeMedio"), espacamento: 1.4 });
    desenharLinhas(p, quebrar([{ texto: v, fonte: "forte" }], f, 13, LARG - 60), f, { x: MX + 54, y: y - 18, tamanho: 13, cor: cor("branco") });
    y -= 62;
  }
}

export async function onboardingVisual(doc: DocumentoOnboarding, geradoEm: Date = new Date()): Promise<Uint8Array> {
  const { pdf, fontes: f } = await novoDocumento(`Onboarding · Aden · ${doc.cliente}`, geradoEm);
  const brancas: PDFPage[] = [];
  let p!: PDFPage;
  let y = 0;

  capa(pdf.addPage([A4.largura, A4.altura]), f, doc);

  const novaPagina = () => {
    p = pdf.addPage([A4.largura, A4.altura]);
    brancas.push(p);
    const W = A4.largura;
    const H = A4.altura;
    // forma orgânica no canto
    p.drawSvgPath(`M ${W - 150} 0 H ${W} V 120 C ${W - 40} 130, ${W - 70} 60, ${W - 150} 0 Z`, { x: 0, y: H, color: cor("verdeClaro") });
    p.drawCircle({ x: W - 40, y: 70, size: 70, color: cor("verdeClaro") });
    logo(p, MX, H - 46, 15, cor("verde"));
    rotulo(p, `ONBOARDING · ${doc.cliente}`.toUpperCase(), { x: W - MX - 30, y: H - 58, tamanho: 6.8, fonte: f.semi, cor: cor("verdeEscuro"), espacamento: 1, direita: true });
    y = H - 110;
    naPagina = 0;
  };
  let naPagina = 0;

  const linhasTitulo = (s: SecaoPronta) => quebrar([{ texto: s.titulo, fonte: "forte" }], f, 25, LARG - 62);
  const tituloSecao = (s: SecaoPronta, n: number) => {
    iconeEmCirculo(p, iconeDaSecao(s), MX + 24, y - 24, 24, cor("verde"), cor("branco"));
    rotulo(p, String(n).padStart(2, "0"), { x: MX + 62, y: y - 14, tamanho: 9, fonte: f.forte, cor: cor("verde"), espacamento: 1.2 });
    y = desenharLinhas(p, linhasTitulo(s), f, { x: MX + 62, y: y - 18, tamanho: 25, cor: cor("verdeProfundo"), entrelinha: 1.15 });
    y -= 34;
    naPagina += 1;
  };

  // altura que a seção ocupa (mesmas medidas do desenho), para juntar seções curtas duas por página
  const alturaBloco = (b: Bloco): number => {
    if (b.tipo === "paragrafo") return quebrar([{ texto: b.texto }], f, 11.5, LARG - 44).length * 11.5 * 1.6 + 36 + 14;
    if (b.tipo === "numerada")
      return (
        b.itens.reduce((soma, it) => {
          const [rot, ...resto] = it.texto.split(": ");
          const temRotulo = resto.length > 0 && rot.length < 40;
          return soma + (temRotulo ? 16 : 0) + quebrar([{ texto: temRotulo ? resto.join(": ") : it.texto }], f, 10.5, LARG - 56).length * 10.5 * 1.55 + 18;
        }, 0) + 8
      );
    return b.itens.reduce((soma, it) => soma + (it.destaque ? 17 : 0) + quebrar([{ texto: it.texto }], f, 10.5, LARG - 70).length * 10.5 * 1.55 + 26 + 10, 0) + 4;
  };
  const alturaSecao = (s: SecaoPronta) => 18 + linhasTitulo(s).length * 25 * 1.15 + 34 + s.blocos.reduce((soma, b) => soma + alturaBloco(b), 0);

  doc.secoes.forEach((s, i) => {
    const n = i + 1;
    if (s.chave === "contato") {
      const pg = pdf.addPage([A4.largura, A4.altura]);
      contato(pg, f, doc, s, n);
      naPagina = 2;
      return;
    }
    // junta com a seção anterior se as duas couberem na mesma página (no máximo duas por página)
    const cabeAqui = brancas.length > 0 && naPagina === 1 && y - 30 - alturaSecao(s) > BASE - 12;
    if (cabeAqui) {
      y -= 10;
      p.drawSvgPath(`M 0 0 C ${LARG * 0.25} -6, ${LARG * 0.5} 6, ${LARG * 0.75} 0 S ${LARG} 0, ${LARG} 0`, { x: MX, y, borderColor: cor("verdeMedio"), borderWidth: 1 });
      y -= 20;
    } else novaPagina();
    tituloSecao(s, n);
    const caber = (h: number) => {
      if (y - h < BASE) {
        novaPagina();
        naPagina = 2;
      }
    };
    for (const b of s.blocos) desenharBloco(b);

    function desenharBloco(b: Bloco) {
      if (b.tipo === "paragrafo") {
        const linhas = quebrar([{ texto: b.texto }], f, 11.5, LARG - 44);
        const h = linhas.length * 11.5 * 1.6 + 36;
        caber(h + 14);
        caixa(p, MX, y, LARG, h, 18, { cor: cor("verdeClaro") });
        p.drawRectangle({ x: MX, y: y - h + 18, width: 4, height: h - 36, color: cor("verde") });
        desenharLinhas(p, linhas, f, { x: MX + 24, y: y - 18, tamanho: 11.5, cor: cor("texto"), entrelinha: 1.6 });
        y -= h + 14;
        return;
      }
      if (b.tipo === "numerada") {
        b.itens.forEach((it, j) => {
          const [rot, ...resto] = it.texto.split(": ");
          const temRotulo = resto.length > 0 && rot.length < 40;
          const corpo = temRotulo ? resto.join(": ") : it.texto;
          const linhas = quebrar([{ texto: corpo }], f, 10.5, LARG - 56);
          const h = (temRotulo ? 16 : 0) + linhas.length * 10.5 * 1.55 + 18;
          caber(h);
          if (j < b.itens.length - 1) p.drawLine({ start: { x: MX + 14, y: y - 28 }, end: { x: MX + 14, y: y - h - 2 }, thickness: 1.4, color: cor("verdeMedio") });
          p.drawCircle({ x: MX + 14, y: y - 14, size: 14, color: cor("verde") });
          const num = String(j + 1);
          p.drawText(num, { x: MX + 14 - largura(f.forte, num, 11) / 2, y: y - 18, size: 11, font: f.forte, color: cor("branco") });
          let yy = y - 4;
          if (temRotulo) {
            rotulo(p, rot.toUpperCase(), { x: MX + 42, y: yy - 9, tamanho: 9, fonte: f.forte, cor: cor("verde"), espacamento: 0.8 });
            yy -= 16;
          }
          desenharLinhas(p, linhas, f, { x: MX + 42, y: yy, tamanho: 10.5, cor: cor("texto") });
          y -= h;
        });
        y -= 8;
        return;
      }
      // lista: cartões arredondados com ícone
      for (const it of b.itens) {
        const comDestaque = !!it.destaque;
        const linhas = quebrar([{ texto: it.texto }], f, 10.5, LARG - 70);
        const h = (comDestaque ? 17 : 0) + linhas.length * 10.5 * 1.55 + 26;
        caber(h + 10);
        caixa(p, MX, y, LARG, h, 16, { cor: cor("verdeClaro") });
        iconeEmCirculo(p, comDestaque && it.destaque!.endsWith("?") ? "duvida" : "check", MX + 28, y - h / 2, 12, cor("verde"), cor("branco"));
        let yy = y - 13;
        if (comDestaque) {
          desenharLinhas(p, quebrar([{ texto: it.destaque!.replace(/:$/, ""), fonte: "forte" }], f, 11, LARG - 70), f, { x: MX + 52, y: yy, tamanho: 11, cor: cor("verdeEscuro") });
          yy -= 17;
        }
        desenharLinhas(p, linhas, f, { x: MX + 52, y: yy, tamanho: 10.5, cor: cor("texto") });
        y -= h + 10;
      }
      y -= 4;
    }
  });

  const total = pdf.getPageCount();
  brancas.forEach((pg) => {
    const t = limparTexto(doc.rodape);
    const w = largura(f.regular, t, 7.5);
    pg.drawText(t, { x: (A4.largura - w) / 2, y: 30, size: 7.5, font: f.regular, color: cor("textoSuave") });
    const idx = pdf.getPages().indexOf(pg) + 1;
    const s = `${idx}/${total}`;
    pg.drawText(s, { x: A4.largura - MX - largura(f.semi, s, 7.5), y: 30, size: 7.5, font: f.semi, color: cor("verde") });
  });
  return pdf.save();
}
