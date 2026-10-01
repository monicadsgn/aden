"use client";

// Briefing único do cliente (Fase 5, passo 2). O cliente não preenche: o Áleff responde na reunião dele e a Moni
// completa na dela, sem repetir pergunta. Salva ao sair do campo; cada resposta guarda quem respondeu.

import { FileQuestion } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "../ui";
import { montarBriefing, servicosDoCliente, type PerguntaBriefing, type RespostaBriefing } from "@/lib/calculo/briefing";
import type { Configuracao } from "@/lib/calculo/tipos";
import { useDados } from "@/lib/dados/contexto";

const quando = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

export function BriefingCliente({ clienteId, config }: { clienteId: string; config: Configuracao }) {
  const { repo } = useDados();
  const [perguntas, setPerguntas] = useState<PerguntaBriefing[]>([]);
  const [respostas, setRespostas] = useState<RespostaBriefing[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const [p, r] = await Promise.all([repo.listarPerguntasBriefing(), repo.listarRespostasBriefing(clienteId)]);
    setPerguntas(p);
    setRespostas(r);
  }, [repo, clienteId]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lista vinda do banco
    void carregar().catch((e) => setErro(e instanceof Error ? e.message : "Não deu para carregar."));
  }, [carregar]);

  const b = montarBriefing(perguntas, respostas, servicosDoCliente(config, clienteId));

  const responder = async (perguntaId: string, texto: string) => {
    setErro(null);
    try {
      await repo.responderBriefing(clienteId, perguntaId, texto);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para salvar.");
    }
  };

  if (b.total === 0)
    return (
      <p className="flex items-center gap-2 rounded-bloco border border-dashed border-linha p-3 text-[12px] text-texto-suave">
        <FileQuestion size={15} /> Ainda não há perguntas de briefing.{" "}
        <Link href="/configuracoes?secao=briefing" className="font-semibold text-marca-forte underline">
          Cadastrar em Configurações
        </Link>
      </p>
    );

  return (
    <div className="flex flex-col gap-3">
      <p className="flex flex-wrap items-center gap-2 text-[12px] text-texto-suave">
        <Badge tom={b.completo ? "ok" : "aviso"}>
          {b.respondidas} de {b.total} respondidas
        </Badge>
        O briefing é da Aden, não do cliente: o Áleff responde na reunião dele e a Moni completa na dela, sem repetir pergunta. Salva ao sair do campo.
      </p>
      {erro && <p className="text-xs font-semibold text-erro">{erro}</p>}
      {b.secoes.map((s) => (
        <div key={s.secao} className="flex flex-col gap-2 rounded-bloco border border-linha p-3">
          <p className="text-sm font-bold">{s.secao}</p>
          {s.itens.map(({ pergunta: p, resposta: r }) => (
            <label key={p.id} className="flex flex-col gap-1 text-[13px] font-semibold">
              {p.pergunta}
              {p.ajuda && <span className="text-[12px] font-normal text-texto-suave">{p.ajuda}</span>}
              <textarea
                key={`${p.id}-${r?.resposta ?? ""}`}
                className="min-h-16 rounded-campo border border-linha bg-superficie px-3 py-2 text-sm font-normal text-texto focus:border-marca focus:outline-none"
                defaultValue={r?.resposta ?? ""}
                onBlur={(e) => e.target.value.trim() !== (r?.resposta ?? "") && void responder(p.id, e.target.value)}
              />
              {r?.respondidoEm && r.resposta && (
                <span className="text-[12px] font-normal text-texto-suave">
                  {r.respondidoPorNome ?? "?"} · {quando(r.respondidoEm)}
                  {r.perguntaTexto && r.perguntaTexto !== p.pergunta && ` · respondida quando a pergunta era: “${r.perguntaTexto}”`}
                </span>
              )}
            </label>
          ))}
        </div>
      ))}
    </div>
  );
}
