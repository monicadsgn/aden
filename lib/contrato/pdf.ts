// PDF do contrato (o que vai para a Autentique e o "Baixar PDF" da ficha). Sai do mesmo DocumentoContrato que a
// tela mostra, no molde dos PDFs da Aden (lib/documentos/folha.ts).

import type { DocumentoContrato } from "../calculo/contrato";
import { gerarPdf, type DocumentoPdf, type ElementoPdf } from "../documentos/folha";

export function contratoParaPdf(doc: DocumentoContrato): DocumentoPdf {
  const elementos: ElementoPdf[] = [
    ...doc.partes.map((p): ElementoPdf => ({ tipo: "paragrafo", trechos: [{ texto: `${p.rotulo}:`, negrito: true }, { texto: p.texto }] })),
    { tipo: "paragrafo", trechos: [{ texto: doc.abertura }] },
  ];
  for (const c of doc.clausulas) {
    elementos.push({ tipo: "titulo", texto: c.titulo });
    for (const i of c.itens) elementos.push({ tipo: "item", marcador: i.marcador, texto: i.texto, nivel: i.sub ? 1 : 0 });
  }
  elementos.push({ tipo: "espaco", altura: 14 }, { tipo: "paragrafo", trechos: [{ texto: doc.localData }] }, { tipo: "assinaturas", pessoas: doc.assinaturas });
  return { tipo: "Contrato", titulo: doc.titulo, subtitulo: doc.subtitulo || null, linhaTopo: doc.linhaTopo, elementos, rodape: doc.rodape || null };
}

export async function contratoEmPdf(doc: DocumentoContrato, geradoEm: Date = new Date()): Promise<Uint8Array> {
  return gerarPdf(contratoParaPdf(doc), geradoEm);
}
