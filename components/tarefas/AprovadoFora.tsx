"use client";

// "O cliente aprovou fora do painel" (ex.: no grupo do WhatsApp): um clique abre, o lugar já vem preenchido, outro
// clique confirma. Num calendário, as peças que dá para marcar já vêm escolhidas. Não avisa o cliente; no painel
// dele aparece "Aprovado em [data] pelo grupo do WhatsApp".

import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { Botao } from "../ui";
import {
  ONDE_APROVACAO_PADRAO,
  motivoSemAprovacaoFora,
  type Tarefa,
} from "@/lib/calculo/tarefas";
import type { AcoesTarefas } from "./useTarefas";

export function AprovadoFora({
  pecas,
  a,
  rotulo,
}: {
  pecas: Tarefa[];
  a: AcoesTarefas;
  rotulo?: string;
}) {
  // sem data de ir ao ar a peça fica "aprovada" (sem agendar); por isso a conferência aqui não exige a data
  const podem = pecas.filter((t) => !motivoSemAprovacaoFora(t, false));
  const [aberto, setAberto] = useState(false);
  const [onde, setOnde] = useState(ONDE_APROVACAO_PADRAO);
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [enviando, setEnviando] = useState(false);
  if (podem.length === 0) return null;
  const varias = pecas.length > 1;
  const escolhidas = varias ? podem.filter((t) => marcadas.has(t.id)) : podem;

  const confirmar = async () => {
    setEnviando(true);
    const n = await a.aprovadoFora(
      escolhidas,
      onde.trim() || ONDE_APROVACAO_PADRAO,
    );
    setEnviando(false);
    if (n > 0) setAberto(false);
  };

  if (!aberto)
    return (
      <Botao
        pequeno
        icone={CheckCircle2}
        onClick={(e) => {
          e.stopPropagation();
          setMarcadas(new Set(podem.map((t) => t.id)));
          setAberto(true);
        }}
      >
        {rotulo ?? "Cliente aprovou fora do painel"}
      </Botao>
    );

  return (
    <div
      className="flex w-full flex-col gap-2 rounded-bloco border border-linha bg-superficie-2/60 p-3"
      onClick={(e) => e.stopPropagation()}
    >
      {varias && (
        <div className="flex flex-col gap-1">
          {podem.map((t) => (
            <label key={t.id} className="flex items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                className="h-4 w-4 accent-marca"
                checked={marcadas.has(t.id)}
                onChange={(e) => {
                  const s = new Set(marcadas);
                  if (e.target.checked) s.add(t.id);
                  else s.delete(t.id);
                  setMarcadas(s);
                }}
              />
              <span className="truncate">{t.titulo}</span>
              {!t.publicarEm && (
                <span className="text-[11px] text-texto-suave">
                  (sem data: fica aprovada)
                </span>
              )}
            </label>
          ))}
        </div>
      )}
      <label className="flex flex-wrap items-center gap-2 text-xs font-semibold text-texto-suave">
        Aprovou pelo
        <input
          aria-label="Onde o cliente aprovou"
          className="h-9 min-w-40 flex-1 rounded-campo border border-linha bg-superficie px-2 text-sm font-normal text-texto focus:border-marca focus:outline-none"
          value={onde}
          onChange={(e) => setOnde(e.target.value)}
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Botao
          pequeno
          variante="primario"
          icone={CheckCircle2}
          disabled={enviando || escolhidas.length === 0}
          onClick={() => void confirmar()}
        >
          {varias ? `Confirmar (${escolhidas.length})` : "Confirmar"}
        </Botao>
        <Botao pequeno variante="fantasma" onClick={() => setAberto(false)}>
          Cancelar
        </Botao>
      </div>
      <p className="text-[12px] text-texto-suave">
        Vai direto para agendada. O cliente não recebe nada; no painel dele
        aparece que aprovou por aí.
      </p>
    </div>
  );
}
