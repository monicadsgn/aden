// Tráfego com garantia, como o cliente lê na Proposta: só frases e valores da oferta, nada interno.

import { ShieldCheck } from "lucide-react";
import type { GarantiaCliente } from "@/lib/calculo/apresentacao";
import { formatarMoeda } from "@/lib/formato";

export function BlocoGarantia({ g }: { g: GarantiaCliente }) {
  const verba =
    g.verbaDeCentavos != null && g.verbaAteCentavos != null
      ? `de ${formatarMoeda(g.verbaDeCentavos)} a ${formatarMoeda(g.verbaAteCentavos)} por mês`
      : g.verbaDeCentavos != null
        ? `a partir de ${formatarMoeda(g.verbaDeCentavos)} por mês`
        : null;
  return (
    <section className="flex gap-3 rounded-card border border-marca/30 bg-marca-tinta p-5">
      <ShieldCheck size={22} className="mt-0.5 shrink-0 text-marca-forte" />
      <div className="flex flex-col gap-1.5 text-sm">
        <p className="font-bold">Tráfego com garantia</p>
        <p>Você só paga a gestão do tráfego quando o resultado vier.</p>
        {verba && <p>Investimento em anúncios indicado: {verba}, pago direto na plataforma.</p>}
        {g.gestaoDepoisCentavos != null && <p>Depois do resultado, a gestão do tráfego passa a {formatarMoeda(g.gestaoDepoisCentavos)} por mês.</p>}
      </div>
    </section>
  );
}
