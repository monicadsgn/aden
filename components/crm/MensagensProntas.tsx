"use client";

// Mensagens prontas do lead (primeiro contato, follow-up, retomada). São sugestões: copiar ou abrir no WhatsApp.
// Nada é enviado sozinho e o texto pode ser mudado antes de mandar.

import { Copy, MessageCircle } from "lucide-react";
import { useState } from "react";
import { Botao } from "@/components/ui";
import type { Lead } from "@/lib/calculo/crm";
import { linkWhatsApp, mensagensDoLead } from "@/lib/calculo/mensagensLead";

export function MensagensProntas({ lead }: { lead: Lead }) {
  const mensagens = mensagensDoLead(lead);
  const [copiada, setCopiada] = useState<string | null>(null);
  if (mensagens.length === 0) return null;

  const copiar = async (id: string, texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiada(id);
      setTimeout(() => setCopiada((c) => (c === id ? null : c)), 2000);
    } catch {
      setCopiada(null); // navegador sem permissão para copiar: a pessoa seleciona o texto à mão
    }
  };

  return (
    <details className="mb-3 rounded-bloco border border-linha bg-superficie-2/40 p-3">
      <summary className="cursor-pointer text-xs font-bold uppercase">Mensagens prontas</summary>
      <p className="mt-2 text-[12px] text-texto-suave">Sugestões para copiar ou abrir no WhatsApp. Nada é enviado sozinho, e você pode mudar o texto antes de mandar.</p>
      <ul className="mt-2 flex flex-col gap-3">
        {mensagens.map((m) => {
          const wa = linkWhatsApp(lead.telefone, m.texto);
          return (
            <li key={m.id} className="rounded-item border border-linha bg-superficie p-3">
              <p className="text-[13px] font-semibold">{m.titulo}</p>
              <p className="text-[11px] text-texto-suave">{m.quando}</p>
              <p className="mt-2 whitespace-pre-line text-[13px]">{m.texto}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Botao pequeno icone={Copy} onClick={() => void copiar(m.id, m.texto)}>
                  {copiada === m.id ? "Copiado" : "Copiar"}
                </Botao>
                {wa && (
                  <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-botao border border-linha px-3 text-xs font-semibold hover:bg-superficie-2">
                    <MessageCircle size={14} /> Abrir no WhatsApp
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
