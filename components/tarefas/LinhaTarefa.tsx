"use client";

// Linha de tarefa (lista, Visão do dia, calendário) e os metadados (cliente, checklist, prazo, responsável).

import { CalendarDays, CheckSquare, ChevronDown, Flag, Layers, ListChecks } from "lucide-react";
import { useState } from "react";
import { Avatar } from "../Avatar";
import { cx } from "../ui";
import { STATUS, type Tarefa } from "@/lib/calculo/tarefas";
import { agruparPorCalendario, prontasDoCalendario } from "@/lib/calculo/lotes";
import { BotaoRelogio, COR_STATUS } from "./DetalheTarefa";
import type { AcoesTarefas } from "./useTarefas";

const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const dataCurta = (iso: string) => {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a, m - 1, d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
};

export function Prazo({ t }: { t: Tarefa }) {
  if (!t.vencimento) return null;
  const atrasada = t.status !== "concluida" && t.vencimento < hojeISO();
  return (
    <span className={cx("inline-flex items-center gap-1 text-[11px] tabular-nums", atrasada ? "font-semibold text-erro" : "text-texto-suave")}>
      <CalendarDays size={12} aria-hidden />
      {dataCurta(t.vencimento)}
    </span>
  );
}

export function MetaTarefa({ t, a }: { t: Tarefa; a: AcoesTarefas }) {
  const resp = a.config.pessoas.find((p) => p.id === t.responsavelId);
  const cliente = a.config.clientes.find((c) => c.id === t.clienteId);
  const feitas = t.etapas.filter((e) => e.feita).length;
  return (
    <>
      {cliente && <span className="max-w-32 truncate rounded-botao bg-marca-suave px-2 py-0.5 text-[10px] font-semibold text-marca-forte">{cliente.nome}</span>}
      {t.lote && <span className="max-w-40 truncate rounded-botao border border-linha px-2 py-0.5 text-[10px] font-semibold text-texto-suave" title="Lote do planejamento">{t.lote}</span>}
      {t.etapas.length > 0 && (
        <span className="inline-flex items-center gap-1 text-[11px] text-texto-suave tabular-nums">
          <ListChecks size={12} aria-hidden /> {feitas}/{t.etapas.length}
        </span>
      )}
      {(t.prioridade === "urgente" || t.prioridade === "alta") && (
        <Flag size={12} className={t.prioridade === "urgente" ? "text-erro" : "text-aviso"} aria-label={`Prioridade ${t.prioridade}`} />
      )}
      <Prazo t={t} />
      {resp && <Avatar nome={resp.nome} foto={resp.fotoUrl} tamanho="sm" />}
    </>
  );
}

export function LinhaTarefa({ t, a, abrir }: { t: Tarefa; a: AcoesTarefas; abrir: () => void }) {
  const feita = t.status === "concluida";
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={abrir}
      onKeyDown={(e) => e.key === "Enter" && abrir()}
      className="group flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 rounded-item px-2 py-2 hover:bg-superficie-2/70 focus-visible:bg-superficie-2/70 focus-visible:outline-none"
    >
      <button
        type="button"
        aria-label={feita ? "Reabrir tarefa" : "Marcar como concluída"}
        title={feita ? "Reabrir" : "Concluir"}
        className={cx("shrink-0", feita ? "text-ok" : "text-texto-suave hover:text-ok")}
        onClick={(e) => {
          e.stopPropagation();
          void a.status(t, feita ? "em_producao" : "concluida");
        }}
      >
        <CheckSquare size={17} />
      </button>
      <span className={cx("min-w-0 flex-1 basis-40 truncate text-[13px] font-medium", feita && "text-texto-suave line-through")}>{t.titulo}</span>
      <span className={cx("rounded-botao px-2 py-0.5 text-[10px] font-bold uppercase", COR_STATUS[t.status])}>{STATUS.find((s) => s.valor === t.status)?.rotulo}</span>
      <MetaTarefa t={t} a={a} />
      <BotaoRelogio t={t} a={a} pequeno />
    </div>
  );
}


/**
 * Lista de tarefas com as peças do mesmo calendário juntas num card só ("2/7 prontas"), que abre as peças
 * (G2 da auditoria, 01/10/2026). Tarefa sem calendário, ou sozinha no calendário dentro desta lista, fica como linha.
 */
export function ListaTarefas({ tarefas, a, abrir }: { tarefas: Tarefa[]; a: AcoesTarefas; abrir: (id: string) => void }) {
  return (
    <>
      {agruparPorCalendario(tarefas).map((g) =>
        g.tipo === "tarefa" ? (
          <LinhaTarefa key={g.tarefa.id} t={g.tarefa} a={a} abrir={() => abrir(g.tarefa.id)} />
        ) : (
          <CardCalendario key={g.chave} nome={g.lote} pecas={g.tarefas} a={a} abrir={abrir} />
        ),
      )}
    </>
  );
}

function CardCalendario({ nome, pecas, a, abrir }: { nome: string; pecas: Tarefa[]; a: AcoesTarefas; abrir: (id: string) => void }) {
  const [aberto, setAberto] = useState(false);
  const cliente = a.config.clientes.find((c) => c.id === pecas[0].clienteId);
  const { prontas, total } = prontasDoCalendario(a.tarefas, pecas[0]);
  const proxima = pecas.map((t) => t.vencimento).filter(Boolean).sort()[0] ?? null;
  return (
    <div className="rounded-item">
      <button
        type="button"
        onClick={() => setAberto(!aberto)}
        aria-expanded={aberto}
        className="flex min-h-11 w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-item px-2 py-2 text-left hover:bg-superficie-2/70"
      >
        <Layers size={17} className="shrink-0 text-marca-forte" aria-hidden />
        <span className="min-w-0 flex-1 basis-40 truncate text-[13px] font-semibold">
          {nome} <span className="font-normal text-texto-suave">· {pecas.length === 1 ? "1 peça aqui" : `${pecas.length} peças aqui`}</span>
        </span>
        <span className="numero rounded-botao bg-marca-tinta px-2 py-0.5 text-[11px] font-bold text-marca-forte">
          {prontas}/{total} prontas
        </span>
        {cliente && <span className="max-w-32 truncate rounded-botao bg-marca-suave px-2 py-0.5 text-[10px] font-semibold text-marca-forte">{cliente.nome}</span>}
        {proxima && <Prazo t={{ ...pecas.find((t) => t.vencimento === proxima)! }} />}
        <ChevronDown size={15} className={cx("shrink-0 text-texto-suave transition-transform", aberto && "rotate-180")} aria-hidden />
      </button>
      {aberto && (
        <div className="ml-4 border-l border-linha pl-2">
          {pecas.map((t) => (
            <LinhaTarefa key={t.id} t={t} a={a} abrir={() => abrir(t.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
