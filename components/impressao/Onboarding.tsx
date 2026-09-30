// PDF do onboarding para o cliente. Recebe só o DocumentoOnboarding (texto dos sócios + pacote e contrato do
// cliente): nunca horas, custo, piso nem divisão entre sócios.

import type { Bloco, DocumentoOnboarding } from "@/lib/calculo/onboarding";
import { BlocoDoc, Capa } from "./Documento";

function Blocos({ blocos }: { blocos: Bloco[] }) {
  return (
    <div className="flex flex-col gap-3 text-sm leading-relaxed">
      {blocos.map((b, i) =>
        b.tipo === "paragrafo" ? (
          <p key={i}>{b.texto}</p>
        ) : b.tipo === "lista" ? (
          <ul key={i} className="flex list-disc flex-col gap-1.5 pl-5 marker:text-marca">
            {b.itens.map((it, j) => (
              <li key={j}>
                {it.destaque && <strong className="font-semibold">{it.destaque} </strong>}
                {it.texto}
              </li>
            ))}
          </ul>
        ) : (
          <ol key={i} className="flex list-decimal flex-col gap-1.5 pl-5 marker:font-bold marker:text-marca">
            {b.itens.map((it, j) => (
              <li key={j}>
                {it.destaque && <strong className="font-semibold">{it.destaque} </strong>}
                {it.texto}
              </li>
            ))}
          </ol>
        ),
      )}
    </div>
  );
}

export function OnboardingDoc({ doc }: { doc: DocumentoOnboarding }) {
  return (
    <>
      <Capa tipo="Onboarding" titulo={doc.cliente} sub="Como vai funcionar, do primeiro dia ao relatório do mês." />
      {doc.secoes.map((s) => (
        <BlocoDoc key={s.titulo} titulo={s.titulo}>
          <Blocos blocos={s.blocos} />
        </BlocoDoc>
      ))}
    </>
  );
}
