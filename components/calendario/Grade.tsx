"use client";

// Calendário do mês: as tarefas aparecem do início ao vencimento. Clicar num dia abre a
// lista do dia (e dá para criar tarefa nele); clicar numa tarefa abre a janela da tarefa.

import { CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, MessagesSquare, Plus } from "lucide-react";
import { ConectarAgenda } from "@/components/agenda/ConectarAgenda";
import { horaDoEvento, useAgenda } from "@/components/agenda/useAgenda";
import { eventosDoDia } from "@/lib/agenda/ics";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CabecalhoPagina } from "@/components/Shell";
import { Modal } from "@/components/Modal";
import { COR_STATUS, DetalheTarefa } from "@/components/tarefas/DetalheTarefa";
import { LinhaTarefa } from "@/components/tarefas/LinhaTarefa";
import { useTarefas } from "@/components/tarefas/useTarefas";
import { Botao, Selecao, cx } from "@/components/ui";
import { etapaAberta, type Lead } from "@/lib/calculo/crm";
import { useDados } from "@/lib/dados/contexto";
import { diasDaGrade, hojeISO, tarefasDoDia } from "@/lib/calculo/dia";
import { podeCriarTarefa } from "@/lib/acesso";
import { novoId } from "@/lib/calculo/novo";
import { novaTarefa } from "@/lib/calculo/tarefas";
import { primeiraMaiuscula } from "@/lib/formato";

const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MAX_NO_DIA = 3;

export default function Calendario() {
  const a = useTarefas();
  const [ref, setRef] = useState(() => {
    const d = new Date();
    return { ano: d.getFullYear(), mes: d.getMonth() };
  });
  const [pessoa, setPessoa] = useState<string | null | undefined>(undefined);
  const [dia, setDia] = useState<string | null>(null);
  const [tarefaAberta, setTarefaAberta] = useState<string | null>(null);
  const [nova, setNova] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const { repo } = useDados();
  useEffect(() => {
    repo.listarLeads().then(setLeads).catch(() => {});
  }, [repo]);

  const quem = pessoa === undefined ? (a.usuario?.pessoaId ?? null) : pessoa;
  const hoje = hojeISO();
  const dias = useMemo(() => diasDaGrade(ref.ano, ref.mes), [ref]);
  const agenda = useAgenda(dias[0], dias[dias.length - 1]);
  const [conectando, setConectando] = useState(false);
  const tarefas = useMemo(() => a.tarefas.filter((t) => !quem || t.responsavelId === quem), [a.tarefas, quem]);
  const contatos = useMemo(() => leads.filter((l) => etapaAberta(l.etapa) && l.proximoContato && (!quem || l.responsavelId === quem)), [leads, quem]);
  const contatosDoDia = (d: string) => contatos.filter((l) => l.proximoContato === d);
  const mesPrefixo = `${ref.ano}-${String(ref.mes + 1).padStart(2, "0")}`;
  const semData = tarefas.filter((t) => t.status !== "concluida" && !t.vencimento && !t.inicio).length;

  if (!a.carregado) return null;

  const mudarMes = (d: number) => setRef((r) => {
    const x = new Date(r.ano, r.mes + d, 1);
    return { ano: x.getFullYear(), mes: x.getMonth() };
  });
  const tarefa = a.tarefas.find((t) => t.id === tarefaAberta) ?? null;
  const doDia = dia ? tarefasDoDia(tarefas, dia) : [];

  return (
    <div className="pb-16">
      <CabecalhoPagina icone={CalendarDays} selo="Dia a dia" titulo="Calendário" descricao="As tarefas no tempo: do início ao prazo. Clique num dia para ver e criar tarefas nele." />
      <div className="mx-auto flex max-w-[1300px] flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <Botao icone={ChevronLeft} aria-label="Mês anterior" onClick={() => mudarMes(-1)} />
          <h2 className="min-w-44 text-center text-lg font-bold">
            {primeiraMaiuscula(new Date(ref.ano, ref.mes, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }))}
          </h2>
          <Botao icone={ChevronRight} aria-label="Próximo mês" onClick={() => mudarMes(1)} />
          <Botao
            pequeno
            variante="fantasma"
            onClick={() => {
              const d = new Date();
              setRef({ ano: d.getFullYear(), mes: d.getMonth() });
            }}
          >
            Hoje
          </Botao>
          <span className="flex-1" />
          <Botao pequeno icone={CalendarPlus} onClick={() => setConectando(true)}>
            {agenda.conectada ? "Google Agenda" : "Conectar Google Agenda"}
          </Botao>
          <Selecao
            className="w-full sm:w-48"
            ariaLabel="De quem"
            valor={quem}
            vazio="Todo mundo"
            opcoes={a.config.pessoas.filter((p) => p.ativo).map((p) => ({ valor: p.id, rotulo: p.id === a.usuario?.pessoaId ? `${p.nome} (eu)` : p.nome }))}
            aoMudar={(v) => setPessoa(v)}
          />
        </div>

        <div className="overflow-hidden rounded-card border border-linha bg-superficie shadow-card">
          <div className="grid grid-cols-7 border-b border-linha bg-superficie-2/60">
            {SEMANA.map((d) => (
              <div key={d} className="px-2 py-2 text-center text-[11px] font-bold text-texto-suave uppercase">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {dias.map((d) => {
              const ts = tarefasDoDia(tarefas, d);
              const foraDoMes = !d.startsWith(mesPrefixo);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDia(d)}
                  className={cx(
                    "flex min-h-24 flex-col gap-1 border-r border-b border-linha p-1.5 text-left transition-colors hover:bg-marca-tinta/60 sm:min-h-28",
                    foraDoMes && "bg-superficie-2/40 text-texto-suave",
                  )}
                >
                  <span
                    className={cx(
                      "flex size-6 items-center justify-center rounded-full text-xs font-semibold",
                      d === hoje && "bg-marca text-sobre-marca",
                    )}
                  >
                    {Number(d.slice(8))}
                  </span>
                  {eventosDoDia(agenda.eventos, d)
                    .slice(0, MAX_NO_DIA)
                    .map((e) => (
                      <span key={e.id} className="truncate rounded-item bg-info-suave px-1.5 py-0.5 text-[10px] font-semibold text-info" title={e.titulo}>
                        {!e.diaInteiro && <span className="tabular-nums">{horaDoEvento(e)} </span>}
                        {e.titulo}
                      </span>
                    ))}
                  {contatosDoDia(d).map((l) => (
                    <span key={l.id} className="truncate rounded-item bg-marca-suave px-1.5 py-0.5 text-[10px] font-semibold text-marca-forte">
                      <MessagesSquare size={10} className="mr-1 inline" aria-hidden />{l.nome}
                    </span>
                  ))}
                  {ts.slice(0, MAX_NO_DIA).map((t) => (
                    <span
                      key={t.id}
                      className={cx(
                        "truncate rounded-item px-1.5 py-0.5 text-[10px] font-semibold",
                        COR_STATUS[t.status],
                        t.status !== "concluida" && t.vencimento && t.vencimento < hoje && "ring-1 ring-erro",
                      )}
                    >
                      {t.titulo}
                    </span>
                  ))}
                  {ts.length > MAX_NO_DIA && <span className="text-[10px] font-semibold text-texto-suave">+{ts.length - MAX_NO_DIA}</span>}
                </button>
              );
            })}
          </div>
        </div>
        {agenda.erros.length > 0 && <p className="text-xs text-aviso">Não deu para ler: {agenda.erros.join(", ")}. Confira o endereço em Google Agenda.</p>}
        {semData > 0 && <p className="text-xs text-texto-suave">{semData} tarefa(s) aberta(s) sem data não aparecem no calendário.</p>}
      </div>

      <Modal
        aberto={!!dia && !tarefa}
        aoFechar={() => setDia(null)}
        titulo={dia ? primeiraMaiuscula(new Date(`${dia}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })) : ""}
      >
        {podeCriarTarefa(a.usuario?.papel ?? "admin") && <div className="mb-3 flex items-center gap-2 rounded-botao border border-linha px-3 focus-within:border-marca focus-within:ring-2 focus-within:ring-marca/20">
          <Plus size={15} className="text-texto-suave" />
          <input
            className="h-10 flex-1 bg-transparent text-sm outline-none placeholder:text-texto-suave sem-contorno"
            placeholder="Nova tarefa neste dia (Enter)"
            value={nova}
            onChange={(e) => setNova(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key !== "Enter" || !nova.trim() || !dia) return;
              await a.salvar(novaTarefa(novoId(), nova.trim(), { vencimento: dia, responsavelId: quem ?? a.usuario?.pessoaId ?? null }));
              setNova("");
            }}
          />
        </div>}
        {dia && eventosDoDia(agenda.eventos, dia).length > 0 && (
          <div className="mb-2 flex flex-col">
            <p className="px-2 text-[11px] font-bold text-info uppercase">Agenda</p>
            {eventosDoDia(agenda.eventos, dia).map((e) => (
              <div key={e.id} className="flex items-baseline gap-2 rounded-item px-2 py-1.5 text-[13px]">
                <span className="w-16 shrink-0 text-[11px] text-texto-suave tabular-nums">{horaDoEvento(e)}</span>
                <span className="flex-1">
                  {e.titulo}
                  {e.local && <span className="text-texto-suave"> · {e.local}</span>}
                </span>
              </div>
            ))}
          </div>
        )}
        {dia && contatosDoDia(dia).length > 0 && (
          <div className="mb-2 flex flex-col">
            <p className="px-2 text-[11px] font-bold text-marca-forte uppercase">Falar com (leads)</p>
            {contatosDoDia(dia).map((l) => (
              <Link key={l.id} href={`/crm?lead=${l.id}`} className="rounded-item px-2 py-2 text-[13px] font-medium hover:bg-superficie-2/70">
                <MessagesSquare size={10} className="mr-1 inline" aria-hidden />{l.nome}
                {l.proximaAcao && <span className="font-normal text-texto-suave"> · {l.proximaAcao}</span>}
              </Link>
            ))}
          </div>
        )}
        {doDia.length === 0 ? (
          <p className="py-4 text-center text-xs text-texto-suave">Nada neste dia.</p>
        ) : (
          doDia.map((t) => <LinhaTarefa key={t.id} t={t} a={a} abrir={() => setTarefaAberta(t.id)} />)
        )}
      </Modal>
      <DetalheTarefa tarefa={tarefa} a={a} aoFechar={() => setTarefaAberta(null)} />
      <ConectarAgenda aberto={conectando} aoFechar={() => setConectando(false)} aoMudar={() => void agenda.recarregar()} />
    </div>
  );
}
