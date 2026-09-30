"use client";

// Perguntas do briefing do cliente (Fase 5, passo 2). O texto é dos sócios: nada vem pronto do sistema.
// Cada pergunta fica numa seção e vale para todos os serviços ou só para um. Salva na hora.

import { ArrowDown, ArrowUp, FileQuestion, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Botao, Interruptor, Selecao, Vazio } from "../ui";
import type { PerguntaBriefing } from "@/lib/calculo/briefing";
import { novoId } from "@/lib/calculo/novo";
import type { Servico } from "@/lib/calculo/tipos";
import { useDados } from "@/lib/dados/contexto";

const campo = "h-9 rounded-campo border border-linha bg-superficie px-2 text-sm outline-none focus:border-marca focus:ring-2 focus:ring-marca/20";

export function SecaoBriefing({ servicos }: { servicos: Servico[] }) {
  const { repo } = useDados();
  const [perguntas, setPerguntas] = useState<PerguntaBriefing[]>([]);
  const [nova, setNova] = useState({ secao: "", pergunta: "" });
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => setPerguntas(await repo.listarPerguntasBriefing()), [repo]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lista vinda do banco
    void carregar().catch((e) => setErro(e instanceof Error ? e.message : "Não deu para carregar."));
  }, [carregar]);

  const tentar = async (fn: () => Promise<void>) => {
    setErro(null);
    try {
      await fn();
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para salvar.");
    }
  };

  const ordenadas = [...perguntas].sort((a, b) => a.ordem - b.ordem);
  const secoes = [...new Set(ordenadas.map((p) => p.secao))];
  const opcoesServico = servicos.filter((s) => s.ativo).map((s) => ({ valor: s.id, rotulo: s.nome || "(sem nome)" }));

  const mover = (p: PerguntaBriefing, dir: -1 | 1) =>
    tentar(async () => {
      const i = ordenadas.findIndex((x) => x.id === p.id);
      const outra = ordenadas[i + dir];
      if (!outra) return;
      await repo.salvarPerguntaBriefing({ ...p, ordem: outra.ordem });
      await repo.salvarPerguntaBriefing({ ...outra, ordem: p.ordem === outra.ordem ? p.ordem - dir : p.ordem });
    });

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12px] text-texto-suave">
        As perguntas do briefing que aparece na ficha de cada cliente (aba Briefing). O cliente não responde: o Áleff preenche na reunião dele e a Moni completa na
        dela. Cada pergunta vale para todos os serviços ou só para um (ela aparece para quem contratou aquele serviço).
      </p>

      <div className="flex flex-wrap items-end gap-2 rounded-bloco border border-linha p-3">
        <label className="flex min-w-40 flex-col gap-1 text-xs font-semibold text-texto-suave">
          Seção
          <input className={campo} list="secoes-briefing" placeholder="ex.: Sobre o negócio" value={nova.secao} onChange={(e) => setNova({ ...nova, secao: e.target.value })} />
          <datalist id="secoes-briefing">
            {secoes.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
        <label className="flex min-w-60 flex-1 flex-col gap-1 text-xs font-semibold text-texto-suave">
          Pergunta
          <input className={campo} value={nova.pergunta} onChange={(e) => setNova({ ...nova, pergunta: e.target.value })} />
        </label>
        <Botao
          pequeno
          variante="primario"
          icone={Plus}
          onClick={() =>
            void tentar(async () => {
              if (!nova.secao.trim() || !nova.pergunta.trim()) throw new Error("Preencha a seção e a pergunta.");
              const ordem = (ordenadas.at(-1)?.ordem ?? 0) + 10;
              await repo.salvarPerguntaBriefing({ id: novoId(), secao: nova.secao.trim(), pergunta: nova.pergunta.trim(), ajuda: null, servicoId: null, ordem, ativo: true });
              setNova({ secao: nova.secao, pergunta: "" });
            })
          }
        >
          Adicionar
        </Botao>
      </div>
      {erro && <p className="text-xs font-semibold text-erro">{erro}</p>}

      {ordenadas.length === 0 ? (
        <Vazio icone={FileQuestion} titulo="Nenhuma pergunta ainda">
          O texto das perguntas é dos sócios.
        </Vazio>
      ) : (
        secoes.map((s) => (
          <div key={s} className="flex flex-col gap-1.5 rounded-bloco bg-superficie-2/60 p-3">
            <p className="text-sm font-bold">{s}</p>
            {ordenadas
              .filter((p) => p.secao === s)
              .map((p) => (
                <div key={p.id} className={`flex flex-wrap items-center gap-2 text-[13px] ${p.ativo ? "" : "opacity-60"}`}>
                  <input
                    key={`${p.id}-${p.pergunta}`}
                    className={`${campo} min-w-60 flex-1`}
                    defaultValue={p.pergunta}
                    onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== p.pergunta && void tentar(() => repo.salvarPerguntaBriefing({ ...p, pergunta: e.target.value.trim() }))}
                  />
                  <Selecao
                    className="w-44"
                    ariaLabel="Serviço"
                    valor={p.servicoId}
                    vazio="Todos os serviços"
                    opcoes={opcoesServico}
                    aoMudar={(v) => void tentar(() => repo.salvarPerguntaBriefing({ ...p, servicoId: v }))}
                  />
                  <Interruptor ligado={p.ativo} rotulo="Ativa" aoMudar={(v) => void tentar(() => repo.salvarPerguntaBriefing({ ...p, ativo: v }))} />
                  <Botao pequeno variante="fantasma" icone={ArrowUp} aria-label="Subir" onClick={() => void mover(p, -1)} />
                  <Botao pequeno variante="fantasma" icone={ArrowDown} aria-label="Descer" onClick={() => void mover(p, 1)} />
                  <Botao
                    pequeno
                    variante="perigo"
                    icone={Trash2}
                    aria-label="Apagar pergunta"
                    onClick={() => confirm("Apagar esta pergunta? As respostas dela somem dos clientes. Para só tirar da lista, desligue.") && void tentar(() => repo.removerPerguntaBriefing(p.id))}
                  />
                </div>
              ))}
          </div>
        ))
      )}
    </div>
  );
}
