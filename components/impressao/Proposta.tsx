// PDF da proposta para o cliente. Só entregas, quantidades e um valor.
// Nunca piso, horas, divisão entre sócios nem custo interno: recebe só o DocumentoProposta.

import type { DocumentoProposta } from "@/lib/calculo/documentos";
import { formatarMoeda } from "@/lib/formato";
import { BlocoDoc, Capa, LinhaDoc, NumeroGrande } from "./Documento";

export function PropostaDoc({ doc }: { doc: DocumentoProposta }) {
  return (
    <>
      <Capa tipo="Proposta" titulo={doc.cliente} sub={`Referência: ${doc.mesReferencia}`} />
      <NumeroGrande rotulo="Investimento mensal" valor={formatarMoeda(doc.valorMensalCentavos)} destaque />
      <p className="-mt-4 text-sm leading-relaxed text-texto-suave">{doc.observacao}</p>
      {doc.blocos.map((b) => (
        <BlocoDoc key={b.servico} titulo={b.servico}>
          {b.itens.map((i) => (
            <LinhaDoc key={i.nome} rotulo={i.nome} valor={`${i.quantidade} por mês`} />
          ))}
        </BlocoDoc>
      ))}
      {doc.entrada.length > 0 && (
        <BlocoDoc titulo="Na entrada (uma vez)">
          {doc.entrada.map((i) => (
            <LinhaDoc key={i.nome} rotulo={i.nome} valor={i.quantidade} />
          ))}
        </BlocoDoc>
      )}
    </>
  );
}
