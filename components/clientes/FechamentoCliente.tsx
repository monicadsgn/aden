"use client";

// Checklist de fechamento do cliente (Fase 5, passo 1). Abre sozinho quando o lead vira cliente; para cliente antigo,
// pode ser aberto na mão. Cada passo guarda quem fez e quando (o banco preenche). O link do painel se confere sozinho.
// Marcar o kickoff com data cria a tarefa da reunião.

import { CheckCircle2, Circle, ClipboardCheck, ExternalLink, FileDown } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge, Botao } from "../ui";
import { montarFechamento, PASSOS_FECHAMENTO, type RegistroFechamento } from "@/lib/calculo/fechamento";
import { novoId } from "@/lib/calculo/novo";
import { novaTarefa } from "@/lib/calculo/tarefas";
import type { ClienteBase } from "@/lib/calculo/tipos";
import { useDados } from "@/lib/dados/contexto";
import { hojeISO } from "@/lib/calculo/dia";
import { montarOnboarding } from "@/lib/calculo/onboarding";
import { baixarPdf } from "@/lib/documentos/base";
import { onboardingVisual } from "@/lib/documentos/onboarding-visual";
import type { AcoesTarefas } from "../tarefas/useTarefas";
import type { Aba } from "./FichaCliente";

const campo = "h-9 rounded-campo border border-linha bg-superficie px-2 text-sm outline-none focus:border-marca focus:ring-2 focus:ring-marca/20";
const quando = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

export function FechamentoCliente({
  cliente: c,
  a,
  mensalidadeNoOnboarding,
  aoAbrir,
  irPara,
}: {
  /** leva para a aba da ficha que resolve o passo (G6 da auditoria) */
  irPara?: (aba: Aba) => void;
  cliente: ClienteBase;
  a: AcoesTarefas;
  mensalidadeNoOnboarding: boolean | null | undefined;
  aoAbrir: () => void;
}) {
  const { repo } = useDados();
  const [registros, setRegistros] = useState<RegistroFechamento[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => setRegistros(await repo.listarFechamento(c.id)), [repo, c.id]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lista vinda do banco
    if (c.fechamentoIniciadoEm) void carregar().catch((e) => setErro(e instanceof Error ? e.message : "Não deu para carregar."));
  }, [carregar, c.fechamentoIniciadoEm]);

  if (!c.fechamentoIniciadoEm)
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-bloco border border-dashed border-linha p-3 text-[12px] text-texto-suave">
        <ClipboardCheck size={15} /> Este cliente não tem checklist de fechamento (ele abre sozinho quando um lead vira cliente).
        <Botao pequeno onClick={aoAbrir}>
          Abrir checklist
        </Botao>
      </div>
    );

  const f = montarFechamento(registros, !!c.painelToken);

  const gerarOnboarding = async () => {
    setErro(null);
    try {
      const [config, modelo] = await Promise.all([repo.carregarConfig(), repo.obterModeloOnboarding()]);
      const doc = montarOnboarding(config, c.id, modelo, hojeISO());
      if (doc.faltando.length) throw new Error(`Falta preencher antes de gerar o onboarding: ${doc.faltando.join("; ")}.`);
      baixarPdf(await onboardingVisual(doc), doc.arquivo);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para gerar o onboarding.");
    }
  };

  const salvar = async (passo: RegistroFechamento["passo"], patch: { feito: boolean; link?: string | null; data?: string | null }) => {
    setErro(null);
    try {
      if (patch.link && !/^https:\/\/\S+$/.test(patch.link.trim())) throw new Error("O link precisa ser completo, começando com https://.");
      await repo.salvarPassoFechamento({ clienteId: c.id, passo, ...patch });
      // kickoff com data vira tarefa (uma vez)
      if (passo === "kickoff" && patch.feito && patch.data && !registros.find((r) => r.passo === "kickoff")?.feitoEm) {
        await a.salvar({
          ...novaTarefa(novoId(), `Kickoff · ${c.nome}`, { clienteId: c.id, responsavelId: a.usuario?.pessoaId ?? null }),
          vencimento: patch.data,
          descricao: "Reunião de início com o cliente (checklist de fechamento).",
        });
      }
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para salvar.");
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-bloco border border-linha p-3">
      <div className="flex flex-wrap items-center gap-2">
        <ClipboardCheck size={15} className="text-marca-forte" />
        <strong className="text-sm">Fechamento</strong>
        <Badge tom={f.completo ? "ok" : "aviso"}>
          {f.feitos} de {f.total}
        </Badge>
        {f.proximo && <span className="text-xs text-texto-suave">próximo: {f.proximo.rotulo.toLowerCase()}</span>}
      </div>
      <p className="text-[12px] text-texto-suave">
        Na ordem combinada: onboarding primeiro. Cada passo guarda quem fez e quando. Mês do onboarding:{" "}
        <strong>{mensalidadeNoOnboarding == null ? "cobra mensalidade? ainda a definir (Configurações → Regras da empresa)" : mensalidadeNoOnboarding ? "cobra mensalidade" : "sem mensalidade"}</strong>.
      </p>
      {erro && <p className="text-xs font-semibold text-erro">{erro}</p>}
      <ol className="flex flex-col gap-1.5">
        {f.itens.map((i) => {
          const def = PASSOS_FECHAMENTO.find((p) => p.passo === i.passo)!;
          const passo = i.passo === "painel" ? null : i.passo;
          return (
            <li key={i.passo} className="flex flex-wrap items-center gap-2 rounded-item bg-superficie-2/60 px-3 py-2 text-[13px]">
              <button
                type="button"
                disabled={!passo}
                aria-label={i.feito ? `Desmarcar ${i.rotulo}` : `Marcar ${i.rotulo}`}
                onClick={() => passo && void salvar(passo, { feito: !i.feito, ...(passo === "kickoff" ? { data: i.data } : {}) })}
                className="disabled:cursor-default"
              >
                {i.feito ? <CheckCircle2 size={17} className="text-ok" /> : <Circle size={17} className="text-texto-suave" />}
              </button>
              <span className="min-w-40 flex-1">
                <span className={i.feito ? "font-semibold" : ""}>{i.rotulo}</span>
                <span className="block text-[11px] text-texto-suave">
                  {i.feito && i.feitoEm ? `${i.feitoPorNome ?? "?"} · ${quando(i.feitoEm)}` : i.ajuda}

                </span>
              </span>
              {passo && def.pedeLink && (
                <span className="flex items-center gap-1">
                  <input
                    key={`${i.passo}-${i.link ?? ""}`}
                    className={`${campo} w-56`}
                    placeholder="link (https://…)"
                    defaultValue={i.link ?? ""}
                    onBlur={(e) => e.target.value.trim() !== (i.link ?? "") && void salvar(passo, { feito: i.feito, link: e.target.value.trim() || null })}
                  />
                  {i.link && (
                    <a href={i.link} target="_blank" rel="noreferrer" aria-label="Abrir link" className="text-texto-suave hover:text-texto">
                      <ExternalLink size={14} />
                    </a>
                  )}
                </span>
              )}
              {/* G6: cada passo com o botão do lugar que resolve */}
              {i.passo === "contrato" && !i.feito && irPara && (
                <span className="flex flex-wrap items-center gap-1 text-[12px] text-texto-suave">
                  dados em
                  <Botao pequeno variante="fantasma" onClick={() => irPara("resumo")}>
                    Dados
                  </Botao>
                  e
                  <Botao pequeno variante="fantasma" onClick={() => irPara("contrato")}>
                    Contrato
                  </Botao>
                  · envio logo abaixo
                </span>
              )}
              {i.passo === "briefing" && irPara && (
                <Botao pequeno onClick={() => irPara("briefing")}>
                  Abrir o briefing
                </Botao>
              )}
              {i.passo === "painel" && !i.feito && irPara && (
                <Botao pequeno onClick={() => irPara("resumo")}>
                  Criar o link
                </Botao>
              )}
              {passo === "onboarding" && (
                <Botao
                  pequeno
                  icone={FileDown}
                  onClick={() => void gerarOnboarding()}
                >
                  Gerar onboarding
                </Botao>
              )}
              {passo === "kickoff" && (
                <input
                  key={`kickoff-${i.data ?? ""}`}
                  type="date"
                  className={campo}
                  defaultValue={i.data ?? ""}
                  onChange={(e) => e.target.value && void salvar("kickoff", { feito: true, data: e.target.value })}
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
