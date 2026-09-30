// PDF do onboarding no molde dos PDFs da Aden (o mesmo do contrato). Gerado no navegador, na ficha do cliente.
// Recebe só o DocumentoOnboarding: texto dos sócios + pacote, serviços e contrato do cliente, nada interno.

import type { DocumentoOnboarding } from "../calculo/onboarding";
import { gerarPdf, type DocumentoPdf, type ElementoPdf } from "./folha";

export function onboardingParaPdf(doc: DocumentoOnboarding): DocumentoPdf {
  const elementos: ElementoPdf[] = [];
  doc.secoes.forEach((s, i) => {
    elementos.push({ tipo: "titulo", texto: `${i + 1}. ${s.titulo}` });
    for (const b of s.blocos) {
      if (b.tipo === "paragrafo") elementos.push({ tipo: "paragrafo", trechos: [{ texto: b.texto }] });
      else b.itens.forEach((it, j) => elementos.push({ tipo: "item", marcador: b.tipo === "numerada" ? `${j + 1}.` : "•", destaque: it.destaque, texto: it.texto }));
    }
  });
  return { tipo: "Onboarding", titulo: `Onboarding · Aden · ${doc.cliente}`, subtitulo: doc.subtitulo || null, elementos, rodape: doc.rodape || null };
}

export async function onboardingEmPdf(doc: DocumentoOnboarding): Promise<Uint8Array> {
  return gerarPdf(onboardingParaPdf(doc));
}
