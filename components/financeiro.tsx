"use client";

// Peças do financeiro usadas em mais de uma tela.

import type { Baldes, SituacaoPagamento } from "@/lib/calculo/pagamentos";
import type { Configuracao } from "@/lib/calculo/tipos";
import { formatarMoeda } from "@/lib/formato";
import type { Tom } from "./ui";

export const SITUACAO: Record<SituacaoPagamento, { tom: Tom; rotulo: string }> = {
  sem_contrato: { tom: "neutro", rotulo: "sem valor de contrato" },
  a_receber: { tom: "neutro", rotulo: "a receber" },
  parcial: { tom: "aviso", rotulo: "pago em parte" },
  pago: { tom: "ok", rotulo: "pago" },
  atrasado: { tom: "erro", rotulo: "em atraso" },
};

/** Para onde vai cada real: uma linha por destino. */
export function Destinos({ b, config }: { b: Baldes; config: Configuracao }) {
  const linhas: [string, number][] = [
    ["Imposto (%)", b.impostoCentavos],
    ["Taxa de recebimento", b.taxaCentavos],
    ["Custos do mês (do projeto + parte do custo fixo e do imposto fixo)", b.custosCentavos],
    ["Reinvestimento (fica na empresa)", b.reinvestimentoCentavos],
    ...config.pessoas.filter((p) => p.socio && p.ativo).map((p) => [`Vai para ${p.nome}`, b.socios[p.id] ?? 0] as [string, number]),
  ];
  return (
    <div className="flex flex-col text-[12px]">
      {linhas
        .filter(([, v]) => Math.abs(v) >= 0.5)
        .map(([r, v]) => (
          <div key={r} className="flex justify-between gap-3 border-b border-linha/60 py-1 last:border-0">
            <span className="text-texto-suave">{r}</span>
            <span className="numero font-semibold whitespace-nowrap">{formatarMoeda(v)}</span>
          </div>
        ))}
    </div>
  );
}

