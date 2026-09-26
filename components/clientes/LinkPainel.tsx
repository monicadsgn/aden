"use client";

// Link do painel do cliente (padrão do SoftMoni): copiar, ver como o cliente vê e, se o
// link vazar, gerar outro (o antigo para de funcionar na hora).

import { Check, Copy, ExternalLink, Link2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Botao } from "../ui";
import { useDados } from "@/lib/dados/contexto";

export function LinkPainel({ clienteId, token, aoMudar }: { clienteId: string; token: string | null | undefined; aoMudar: (t: string) => void }) {
  const { repo } = useDados();
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const url = token && typeof window !== "undefined" ? `${window.location.origin}/c/${token}` : null;

  const gerar = async () => {
    if (token && !confirm("Gerar um link novo? O link antigo para de funcionar na hora.")) return;
    try {
      aoMudar(await repo.gerarLinkPainel(clienteId));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para gerar o link.");
    }
  };

  return (
    <div className="rounded-bloco border border-linha p-3">
      <p className="mb-1 flex items-center gap-1.5 text-sm font-bold">
        <Link2 size={15} /> Painel do cliente
      </p>
      <p className="mb-3 text-[11px] text-texto-suave">
        Um link só deste cliente, sem senha. Ele vê as peças que vocês marcarem para ele e aprova ou pede ajuste. Nunca vê valores, horas nem nada interno.
      </p>
      {erro && <p className="mb-2 text-xs text-erro">{erro}</p>}
      {!url ? (
        <Botao pequeno variante="primario" icone={Link2} onClick={() => void gerar()}>
          Criar o link do painel
        </Botao>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-item bg-superficie-2 px-2 py-1.5 text-[11px]">{url}</code>
          <Botao
            pequeno
            icone={copiado ? Check : Copy}
            onClick={() =>
              void navigator.clipboard?.writeText(url).then(() => {
                setCopiado(true);
                setTimeout(() => setCopiado(false), 2000);
              })
            }
          >
            {copiado ? "Copiado" : "Copiar"}
          </Botao>
          <a href={url} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-botao border border-linha px-3 text-xs font-semibold hover:bg-superficie-2">
            <ExternalLink size={13} /> Ver como o cliente
          </a>
          <Botao pequeno variante="fantasma" icone={RefreshCw} onClick={() => void gerar()} title="O link vazou? Gera outro e o antigo para de funcionar">
            Gerar outro
          </Botao>
        </div>
      )}
    </div>
  );
}
