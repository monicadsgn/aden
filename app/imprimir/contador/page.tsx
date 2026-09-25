"use client";

import { useEffect, useState } from "react";
import { BlocoDoc, Capa, Documento, LinhaDoc, NumeroGrande } from "@/components/impressao/Documento";
import { useParametro } from "@/components/ui";
import { documentoContador, type DocumentoContador } from "@/lib/calculo/documentos";
import { useDados } from "@/lib/dados/contexto";
import { formatarMoeda, formatarPct } from "@/lib/formato";

// Resumo mensal para o contador. Sem piso, horas, divisão entre sócios nem negociação.
export default function ImprimirContador() {
  const { repo } = useDados();
  const mes = useParametro("mes");
  const [doc, setDoc] = useState<DocumentoContador | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!mes) return;
    (async () => {
      const [config, pagamentos] = await Promise.all([repo.carregarConfig(), repo.listarPagamentos()]);
      setDoc(documentoContador(config, pagamentos, mes));
    })().catch((e) => setErro(e instanceof Error ? e.message : "Erro ao montar o resumo."));
  }, [repo, mes]);

  if (erro) return <p className="p-8 text-sm text-erro">{erro}</p>;
  if (!doc) return null;
  return (
    <Documento arquivo={doc.arquivo}>
      <Capa tipo="Resumo para o contador" titulo="Aden" sub={`Mês: ${doc.mesReferencia}`} />
      <NumeroGrande rotulo="Recebido no mês" valor={formatarMoeda(doc.faturamentoCentavos)} destaque />
      <BlocoDoc titulo="Recebimentos por cliente">
        {doc.porCliente.length === 0 && <p className="text-sm text-texto-suave">Nenhum recebimento neste mês.</p>}
        {doc.porCliente.map((c) => (
          <LinhaDoc key={c.cliente} rotulo={c.cliente} valor={formatarMoeda(c.valorCentavos)} />
        ))}
      </BlocoDoc>
      {doc.recebimentos.length > 0 && (
        <BlocoDoc titulo="Cada recebimento">
          {doc.recebimentos.map((r, i) => (
            <LinhaDoc
              key={i}
              rotulo={
                <>
                  {new Date(`${r.data}T12:00:00`).toLocaleDateString("pt-BR")} · {r.cliente} <span className="text-texto-suave">(referente a {r.referente})</span>
                </>
              }
              valor={formatarMoeda(r.valorCentavos)}
            />
          ))}
        </BlocoDoc>
      )}
      <BlocoDoc titulo="Custos fixos do mês">
        {doc.custosFixos.map((c) => (
          <LinhaDoc key={c.nome} rotulo={c.nome} valor={formatarMoeda(c.valorCentavos)} />
        ))}
        <LinhaDoc rotulo="Total" valor={formatarMoeda(doc.totalCustosFixosCentavos)} forte />
      </BlocoDoc>
      <div className="grid gap-4 sm:grid-cols-2">
        <NumeroGrande rotulo="Imposto fixo do mês (MEI)" valor={doc.impostoFixoCentavos != null ? formatarMoeda(doc.impostoFixoCentavos) : "não informado"} />
        <NumeroGrande
          rotulo={doc.teto ? `Recebido no ano, de ${formatarMoeda(doc.teto.tetoCentavos)} do teto` : "Teto do regime"}
          valor={doc.teto ? `${formatarMoeda(doc.teto.acumuladoAnoCentavos)} · ${formatarPct(Math.round(doc.teto.pct * 10) / 10)}` : "não informado"}
        />
      </div>
    </Documento>
  );
}
