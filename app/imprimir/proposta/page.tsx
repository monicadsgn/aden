"use client";

import { useEffect, useState } from "react";
import { Documento } from "@/components/impressao/Documento";
import { PropostaDoc } from "@/components/impressao/Proposta";
import { documentoProposta, type DocumentoProposta } from "@/lib/calculo/documentos";
import { calcularCenario } from "@/lib/calculo/motor";
import { useDados } from "@/lib/dados/contexto";
import { competenciaAtual } from "@/lib/dados/repositorio";
import { lerParaImprimir } from "@/lib/impressao";

export default function ImprimirProposta() {
  const { repo } = useDados();
  const [doc, setDoc] = useState<DocumentoProposta | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const p = lerParaImprimir();
      if (!p || p.tipo !== "proposta") return setErro("Nada para imprimir. Volte e use “Exportar PDF” na calculadora ou na negociação.");
      const config = await repo.carregarConfig();
      const r = calcularCenario(config, p.cenario);
      setDoc(
        documentoProposta(config, p.cenario, p.valorCentavos, {
          cliente: p.clienteNome,
          competencia: competenciaAtual(),
          incluiTrafego: !!r.proposta?.incluiTrafego,
          verbaMidiaCentavos: r.proposta?.verbaMidiaCentavos ?? null,
        }),
      );
    })().catch((e) => setErro(e instanceof Error ? e.message : "Erro ao montar a proposta."));
  }, [repo]);

  if (erro) return <p className="p-8 text-sm text-erro">{erro}</p>;
  if (!doc) return null;
  return (
    <Documento arquivo={doc.arquivo}>
      <PropostaDoc doc={doc} />
    </Documento>
  );
}
