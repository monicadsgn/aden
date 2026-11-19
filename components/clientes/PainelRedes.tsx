"use client";

// Painel do cliente e redes sociais: o link que o cliente abre, os atalhos que mudam todo mês
// e a conexão com o Instagram e o Facebook. Cada coisa no seu cartão.

import { useState } from "react";
import { LinkPainel } from "./LinkPainel";
import { ConexaoMeta } from "./ConexaoMeta";
import { Rot, Texto } from "./campos";
import { PAINEL_CLIENTE_ATIVO } from "@/lib/recursos";
import type { AtalhosPainel, ClienteBase } from "@/lib/calculo/tipos";

const ATALHOS_VAZIOS: AtalhosPainel = { planejamentoUrl: null, planejamentoRotulo: null, fotosUrl: null, cardsJogoUrl: null, identidadeUrl: null, inclusoTexto: null };

export function PainelRedes({ c, set, aoRecarregar }: { c: ClienteBase; set: (patch: Partial<ClienteBase>) => void; aoRecarregar: () => Promise<void> }) {
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-4">
      {msg && <p className="rounded-bloco bg-info-suave px-3 py-2 text-xs text-info">{msg}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              {PAINEL_CLIENTE_ATIVO && !c.interno && <LinkPainel clienteId={c.id} token={c.painelToken} aoMudar={(t) => void aoRecarregar().then(() => setMsg(t ? "Link do painel pronto." : null))} />}
            </div>
            {!c.interno && (
              <div className="sm:col-span-2">
                <ConexaoMeta clienteId={c.id} />
              </div>
            )}
            {PAINEL_CLIENTE_ATIVO && !c.interno && c.painelToken && (
              <div className="grid gap-3 rounded-bloco border border-marca/40 bg-marca-tinta/40 p-3 sm:col-span-2 sm:grid-cols-2">
                {/* D1: o que muda todo mês fica separado do cadastro (que se preenche uma vez) */}
                <p className="text-[11px] font-bold tracking-wide text-marca-forte uppercase sm:col-span-2">Muda todo mês</p>
                <p className="text-[12px] text-texto-suave sm:col-span-2">
                  <strong className="text-texto">Atalhos do painel.</strong> O que o cliente abre direto no painel, sem pedir por fora. Links completos, começando com https://. Vazio = não
                  aparece. Todo mês, troque o planejamento e a pasta dos cards de jogo.
                </p>
                {(
                  [
                    ["planejamentoUrl", "PDF do planejamento do mês", "https://…"],
                    ["planejamentoRotulo", "Texto do botão do planejamento", "ex.: Planejamento de outubro"],
                    ["fotosUrl", "Pasta de fotos (Drive)", "https://…"],
                    ["cardsJogoUrl", "Pasta dos cards de jogo do mês (Drive)", "https://…"],
                    ["identidadeUrl", "Pasta da identidade visual", "https://…"],
                  ] as const
                ).map(([k, rotulo, dica]) => (
                  <Rot key={k} rotulo={rotulo}>
                    <Texto
                      valor={c.atalhos?.[k] ?? ""}
                      placeholder={dica}
                      aoSalvar={(v) => {
                        const limpo = v.trim();
                        if (k !== "planejamentoRotulo" && limpo && !/^https:\/\/\S+$/.test(limpo)) return setMsg("O link precisa ser completo, começando com https://.");
                        set({ atalhos: { ...ATALHOS_VAZIOS, ...c.atalhos, [k]: limpo || null } });
                      }}
                    />
                  </Rot>
                ))}
                <label className="flex flex-col gap-1 text-xs font-semibold text-texto-suave sm:col-span-2">
                  O que está incluso (o cliente lê no painel)
                  <textarea
                    key={`incluso-${c.id}`}
                    className="min-h-20 rounded-campo border border-linha bg-superficie px-3 py-2 text-sm font-normal text-texto focus:border-marca focus:outline-none"
                    defaultValue={c.atalhos?.inclusoTexto ?? ""}
                    placeholder="O que o serviço cobre e o que é extra."
                    onBlur={(e) =>
                      e.target.value.trim() !== (c.atalhos?.inclusoTexto ?? "") && set({ atalhos: { ...ATALHOS_VAZIOS, ...c.atalhos, inclusoTexto: e.target.value.trim() || null } })
                    }
                  />
                </label>
              </div>
            )}
      </div>
    </div>
  );
}
