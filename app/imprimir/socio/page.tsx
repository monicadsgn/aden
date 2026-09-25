"use client";

import { useEffect, useState } from "react";
import { BlocoDoc, Capa, Documento, LinhaDoc, NumeroGrande } from "@/components/impressao/Documento";
import { useParametro } from "@/components/ui";
import { calcularCalibragem } from "@/lib/calculo/calibragem";
import { documentoSocio, type DocumentoSocio } from "@/lib/calculo/documentos";
import { calcularSaudeCliente } from "@/lib/calculo/mes";
import { distribuirPagamentos, somaPagamentos } from "@/lib/calculo/pagamentos";
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
      const [config, pagamentos, registros, medicoes] = await Promise.all([repo.carregarConfig(), repo.listarPagamentos(), repo.carregarMes(mes), repo.listarMedicoes()]);
      const hoje = new Date().toISOString().slice(0, 10);
      const clientes = config.clientes.filter((c) => c.ativo && !c.interno);
      const dist = clientes.map((c) => distribuirPagamentos(config, c, mes, pagamentos, hoje));
      const cal = calcularCalibragem(config, medicoes);
      const horas = Object.fromEntries(
        clientes.map((c) => {
          const s = calcularSaudeCliente(config, c, registros[c.id] ?? null, { calibragem: cal, pagamentosCentavos: somaPagamentos(pagamentos, c.id, mes), mesFechado: mes < competenciaAtual() });
          return [c.id, s.socios.find((x) => x.id === pessoa)?.horasReais ?? null];
        }),
      );
      setDoc(documentoSocio(config, pessoa, mes, dist, horas));
    })().catch((e) => setErro(e instanceof Error ? e.message : "Erro ao montar o relatório."));
  }, [repo, mes, pessoa]);

  if (erro) return <p className="p-8 text-sm text-erro">{erro}</p>;
  if (!doc) return null;
  return (
    <Documento arquivo={doc.arquivo}>
      <Capa tipo="Relatório do sócio · interno" titulo={doc.socio} sub={`Mês: ${doc.mesReferencia}`} />
      <div className="grid gap-4 sm:grid-cols-3">
        <NumeroGrande rotulo="Recebeu" valor={formatarMoeda(doc.recebidoCentavos)} destaque />
        <NumeroGrande rotulo="Falta receber" valor={formatarMoeda(doc.faltaCentavos)} />
        <NumeroGrande rotulo="Horas no mês" valor={formatarHoras(doc.horasTotais)} />
      </div>
      <BlocoDoc titulo="Por cliente">
        {doc.clientes.map((c) => (
          <LinhaDoc
            key={c.cliente}
            rotulo={
              <>
                {c.cliente} <span className="text-texto-suave">· {formatarHoras(c.horas)}</span>
              </>
            }
            valor={`${formatarMoeda(c.recebidoCentavos)} de ${formatarMoeda(c.planejadoCentavos)}`}
          />
        ))}
      </BlocoDoc>
      <p className="text-xs text-texto-suave">Horas: lançadas no mês quando houver; senão, a previsão do escopo (ou a média medida pelo cronômetro).</p>
    </Documento>
  );
}
