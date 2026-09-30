// PDF do contrato (o que vai para a Autentique e o "Baixar PDF" da ficha), com a identidade da Aden
// (lib/documentos/contrato-visual.ts). Sai do mesmo DocumentoContrato que a tela mostra.

import type { DocumentoContrato } from "../calculo/contrato";
import { contratoVisual } from "../documentos/contrato-visual";

export function contratoEmPdf(doc: DocumentoContrato, geradoEm: Date = new Date()): Promise<Uint8Array> {
  return contratoVisual(doc, geradoEm);
}
