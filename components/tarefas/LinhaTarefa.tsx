"use client";

// Linha de tarefa (lista, Visão do dia, calendário) e os metadados (cliente, checklist, prazo, responsável).

import { CalendarDays, CheckSquare, ChevronDown, Flag, Layers, ListChecks } from "lucide-react";
import { useState } from "react";
import { Avatar } from "../Avatar";
import { cx } from "../ui";
import { STATUS, type Tarefa } from "@/lib/calculo/tarefas";
import { agruparPorCalendario, prontasDoCalendario } from "@/lib/calculo/lotes";
import { coresDosClientes } from "@/lib/calculo/cores";
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
  // data em toda tarefa (M6): sem vencimento diz "sem prazo"
  if (!t.vencimento)
    return t.status === "concluida" ? null : (
      <span className="inline-flex items-center gap-1 text-[11px] text-texto-suave">
        <CalendarDays size={12} aria-hidden />
        sem prazo
      </span>
    );
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
      {cliente && <span className={cx("max-w-32 truncate rounded-botao px-2 py-0.5 text-[10px] font-semibold", `cliente-${coresDosClientes(a.config.clientes).get(cliente.id) ?? 1}`)}>{cliente.nome}</span>}
      {t.pedidaPorNome && (
        <span className="max-w-48 truncate rounded-botao bg-info-suave px-2 py-0.5 text-[10px] font-semibold text-info" title="Quem pediu esta tarefa">
          pedida por {t.pedidaPorNome}
        </span>
      )}
      {t.lote && <span className="max-w-40 truncate rounded-botao border border-linha px-2 py-0.5 text-[10px] font-semibold text-texto-suave" title="Calendário do planejamento">{t.lote}</span>}
      {t.etapas.length > 0 && (
        <span className="inline-flex items-center gap-1 text-[11px] text-texto-suave tabular-nums">
          <ListChecks size={12} aria-hidden /> {feitas}/{t.etapas.length}
        </span>
      )}
      {t.prioridade && (
        <span
          className={cx(
            "inline-flex items-center gap-1 text-[11px] font-semibold",
            t.prioridade === "urgente" ? "rounded-item bg-erro-suave px-1.5 py-0.5 tracking-wide text-erro uppercase" : t.prioridade === "alta" ? "text-aviso" : "text-texto-suave",
          )}
          title="Prioridade"
        >
          <Flag size={12} aria-hidden /> {t.prioridade}
        </span>
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
          // M12: concluir com um toque, mas pergunta quando o relógio está rodando ou a peça ainda não foi ao ar
          const rodando = a.medicoes.some((m) => m.tarefaId === t.id && m.estado === "rodando");
          const pecaNoAr = !feita && !!t.publicarEm && !t.publicadaEm;
          if (!feita && (rodando || pecaNoAr)) {
            const motivo = rodando ? "O relógio desta tarefa está rodando e vai parar." : "Esta peça tem data para ir ao ar e ainda não foi marcada como publicada.";
            if (!confirm(`Concluir "${t.titulo}"? ${motivo}`)) return;
          }
          void a.status(t, feita ? "em_producao" : "concluida");
        }}
      >
        <CheckSquare size={17} />
      </button>
      <span className={cx("min-w-0 flex-1 basis-40 truncate text-[13px] font-medium", feita && "text-texto-suave line-through")}>{t.titulo}</span>
      {/* aprovada pelo cliente: o selo diz isso, em vez de "com o cliente" (M12) */}
      {t.status === "revisao" && t.clienteAprovouEm ? (
        <span className="rounded-botao bg-ok-suave px-2 py-0.5 text-[10px] font-bold text-ok uppercase">aprovada</span>
      ) : (
        <span className={cx("rounded-botao px-2 py-0.5 text-[10px] font-bold uppercase", COR_STATUS[t.status])}>{STATUS.find((s) => s.valor === t.status)?.rotulo}</span>
      )}
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
        {cliente && <span className={cx("max-w-32 truncate rounded-botao px-2 py-0.5 text-[10px] font-semibold", `cliente-${coresDosClientes(a.config.clientes).get(cliente.id) ?? 1}`)}>{cliente.nome}</span>}
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
