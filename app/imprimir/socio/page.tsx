"use client";

import { useEffect, useState } from "react";
import { BlocoDoc, Capa, Documento, LinhaDoc, NumeroGrande } from "@/components/impressao/Documento";
import { useParametro } from "@/components/ui";
import { documentoSocio, type DocumentoSocio } from "@/lib/calculo/documentos";
import { calcularSaudeCliente } from "@/lib/calculo/mes";
import { somaPagamentos } from "@/lib/calculo/pagamentos";
import { calcularMesDeCima } from "@/lib/calculo/sociedade";
import { useDados } from "@/lib/dados/contexto";
import { competenciaAtual } from "@/lib/dados/repositorio";
import { formatarHoras, formatarMoeda } from "@/lib/formato";

// Relatório interno de um sócio: quanto recebeu, de quais clientes, e as horas.
export default function ImprimirSocio() {
  const { repo } = useDados();
  const mes = useParametro("mes");
  const pessoa = useParametro("pessoa");
  const [doc, setDoc] = useState<DocumentoSocio | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!mes || !pessoa) return;
    (async () => {
      const [config, pagamentos, registros] = await Promise.all([repo.carregarConfig(), repo.listarPagamentos(), repo.carregarMes(mes)]);
      const clientes = config.clientes.filter((c) => c.ativo && !c.interno);
      const horas = Object.fromEntries(
        clientes.map((c) => {
          const s = calcularSaudeCliente(config, c, registros[c.id] ?? null, { pagamentosCentavos: somaPagamentos(pagamentos, c.id, mes), mesFechado: mes < competenciaAtual() });
          return [c.id, s.socios.find((x) => x.id === pessoa)?.horasReais ?? null];
        }),
      );
      setDoc(documentoSocio(config, pessoa, mes, calcularMesDeCima(config, pagamentos, mes), horas));
    })().catch((e) => setErro(e instanceof Error ? e.message : "Erro ao montar o relatório."));
  }, [repo, mes, pessoa]);

  if (erro) return <p className="p-8 text-sm text-erro">{erro}</p>;
  if (!doc) return null;
  return (
    <Documento arquivo={doc.arquivo}>
      <Capa tipo="Relatório do sócio · interno" titulo={doc.socio} sub={`Mês: ${doc.mesReferencia}`} />
      <div className="grid gap-4 sm:grid-cols-3">
        <NumeroGrande rotulo="Parte no mês" valor={formatarMoeda(doc.parteCentavos)} destaque />
        <NumeroGrande rotulo="Entrou na Aden" valor={formatarMoeda(doc.entrouCentavos)} />
        <NumeroGrande rotulo="Horas no mês" valor={formatarHoras(doc.horasTotais)} />
      </div>
      {doc.regra && <p className="text-xs text-texto-suave">{doc.regra}</p>}
      {doc.bonusCentavos != null && doc.bonusCentavos > 0 && <p className="text-xs font-semibold">Bônus no mês: {formatarMoeda(doc.bonusCentavos)}</p>}
      <BlocoDoc titulo="O que entrou de cada cliente">
        {doc.clientes.map((c) => (
          <LinhaDoc
            key={c.cliente}
            rotulo={
              <>
                {c.cliente} <span className="text-texto-suave">· {formatarHoras(c.horas)}</span>
              </>
            }
            valor={formatarMoeda(c.entrouCentavos)}
          />
        ))}
      </BlocoDoc>
      <p className="text-xs text-texto-suave">
        Conta pelo mês em que o dinheiro entrou (é o que vale para a divisão e o caixa). Horas: corrigidas no mês quando houver; senão, as entregas do contrato × o tempo cadastrado.
      </p>
    </Documento>
  );
}
