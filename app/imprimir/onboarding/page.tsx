"use client";

import { useEffect, useState } from "react";
import { Documento } from "@/components/impressao/Documento";
import { OnboardingDoc } from "@/components/impressao/Onboarding";
import { hojeISO } from "@/lib/calculo/dia";
import { montarOnboarding, type DocumentoOnboarding } from "@/lib/calculo/onboarding";
import { useDados } from "@/lib/dados/contexto";
import { lerParaImprimir } from "@/lib/impressao";

export default function ImprimirOnboarding() {
  const { repo } = useDados();
  const [doc, setDoc] = useState<DocumentoOnboarding | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const p = lerParaImprimir();
      if (!p || p.tipo !== "onboarding") return setErro("Nada para imprimir. Volte e use “Gerar onboarding” no fechamento do cliente.");
      const [config, modelo] = await Promise.all([repo.carregarConfig(), repo.obterModeloOnboarding()]);
      setDoc(montarOnboarding(config, p.clienteId, modelo, hojeISO()));
    })().catch((e) => setErro(e instanceof Error ? e.message : "Erro ao montar o onboarding."));
  }, [repo]);

  if (erro) return <p className="p-8 text-sm text-erro">{erro}</p>;
  if (!doc) return null;
  if (doc.faltando.length)
    return (
      <div className="mx-auto max-w-xl p-8 text-sm">
        <p className="font-bold">Falta preencher antes de gerar o onboarding:</p>
        <ul className="mt-2 list-disc pl-5 text-texto-suave">
          {doc.faltando.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </div>
    );
  return (
    <Documento arquivo={doc.arquivo}>
      <OnboardingDoc doc={doc} />
    </Documento>
  );
}
