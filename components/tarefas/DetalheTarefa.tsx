"use client";

// Janela da tarefa, no jeito do ClickUp: propriedades em grade (Status, Datas, Estimativa,
// Rastrear tempo, Responsável…), descrição e checklist. Tudo edita no lugar e salva sozinho.

import {
  CalendarDays,
  CheckSquare,
  Flag,
  Hash,
  Hourglass,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Square,
  Timer,
  Trash2,
  User,
  Users,
  Layers,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Avatar } from "../Avatar";
import { Modal } from "../Modal";
import { Botao, cx, Passo } from "../ui";
import { calcularCalibragem, formatarMinutos } from "@/lib/calculo/calibragem";
import { novoId } from "@/lib/calculo/novo";
import {
  estimativaHoras,
  medicaoDaTarefa,
  PRIORIDADES,
  relogio,
  STATUS,
  tempoGasto,
  temCronometro,
  type StatusTarefa,
  type Tarefa,
} from "@/lib/calculo/tarefas";
import { formatarDuracao } from "@/lib/formato";
import { ParaCliente } from "./ParaCliente";
import type { AcoesTarefas } from "./useTarefas";

export const COR_STATUS: Record<StatusTarefa, string> = {
  a_fazer: "bg-superficie-2 text-texto",
  em_producao: "bg-info text-superficie",
  revisao: "bg-aviso text-superficie",
  concluida: "bg-ok text-superficie",
};

const COR_PRIORIDADE = { urgente: "text-erro", alta: "text-aviso", normal: "text-info", baixa: "text-texto-suave" } as const;

function Linha({ icone: Ic, rotulo, children }: { icone: LucideIcon; rotulo: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[8.5rem_1fr] items-center gap-2 py-1.5 text-[13px]">
      <span className="flex items-center gap-2 text-texto-suave">
        <Ic size={15} aria-hidden /> {rotulo}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

const campoLeve =
  "sem-contorno h-8 w-full min-w-0 rounded-item border border-transparent bg-transparent px-2 text-[13px] text-texto hover:border-linha hover:bg-superficie-2/60 focus:border-marca focus:bg-superficie focus:outline-none";

/** Hook do relógio: atualiza a cada segundo enquanto roda. */
export function useAgora(rodando: boolean) {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    if (!rodando) return;
    const t = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(t);
  }, [rodando]);
  return agora;
}

export function BotaoRelogio({ t, a, pequeno }: { t: Tarefa; a: AcoesTarefas; pequeno?: boolean }) {
  const m = medicaoDaTarefa(t, a.medicoes);
  const rodando = m?.estado === "rodando";
  const agora = useAgora(rodando);
  if (!temCronometro(t, a.config)) return null;
  const seg = tempoGasto(m, agora);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        void (rodando ? a.pausarTarefa(t) : a.start(t));
      }}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-botao font-semibold tabular-nums transition-colors",
        pequeno ? "h-7 px-2 text-[11px]" : "h-8 px-3 text-xs",
        rodando ? "bg-marca text-sobre-marca" : "bg-superficie-2 text-texto hover:bg-linha",
      )}
      aria-label={rodando ? `Pausar o tempo de ${t.titulo}` : `Começar a contar o tempo de ${t.titulo}`}
      title={rodando ? "Pausar" : "Start: começar a contar o tempo"}
    >
      {rodando ? <Pause size={pequeno ? 12 : 13} /> : <Play size={pequeno ? 12 : 13} />}
      {seg > 0 ? relogio(seg) : "Start"}
    </button>
  );
}

export function DetalheTarefa({ tarefa, a, aoFechar }: { tarefa: Tarefa | null; a: AcoesTarefas; aoFechar: () => void }) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [novaEtapa, setNovaEtapa] = useState("");
  const [confirmarApagar, setConfirmarApagar] = useState(false);
  const id = tarefa?.id;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- rascunho dos campos de texto ao trocar de tarefa
    setTitulo(tarefa?.titulo ?? "");
    setDescricao(tarefa?.descricao ?? "");
    setConfirmarApagar(false);
    // só ao trocar de tarefa: o texto que a pessoa está digitando não é sobrescrito
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const m = tarefa ? medicaoDaTarefa(tarefa, a.medicoes) : null;
  const agora = useAgora(m?.estado === "rodando");
  if (!tarefa) return null;
  const t = tarefa;
  const cfg = a.config;
  const set = (patch: Partial<Tarefa>) => void a.salvar({ ...t, ...patch });
  const est = estimativaHoras(t, cfg);
  const seg = tempoGasto(m, agora);
  const tipo = cfg.tiposEntrega.find((x) => x.id === t.tipoEntregaId);
  const cal = tipo ? calcularCalibragem(cfg, a.medicoes).find((c) => c.tipoEntregaId === tipo.id) : undefined;
  const socios = cfg.pessoas.filter((p) => p.ativo);
  const resp = cfg.pessoas.find((p) => p.id === t.responsavelId);
  const feitas = t.etapas.filter((e) => e.feita).length;

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      largura="lg"
      expandivel
      titulo={
        <input
          aria-label="Nome da tarefa"
          className="w-full rounded-item bg-transparent px-1 text-lg font-bold outline-none hover:bg-superficie-2/60 focus:bg-superficie-2/60"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          onBlur={() => titulo.trim() && titulo !== t.titulo && set({ titulo: titulo.trim() })}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        />
      }
      subtitulo={
        <span className="px-1">
          {cfg.clientes.find((c) => c.id === t.clienteId)?.nome ?? "Sem cliente"}
          {tipo && ` · ${tipo.nome}`}
        </span>
      }
      rodape={
        <>
          {confirmarApagar ? (
            <span className="mr-auto flex items-center gap-2 text-xs">
              Apagar de vez?
              <Botao pequeno variante="perigo" onClick={() => void a.remover(t).then(aoFechar)}>
                Sim, apagar
              </Botao>
              <Botao pequeno variante="fantasma" onClick={() => setConfirmarApagar(false)}>
                Cancelar
              </Botao>
            </span>
          ) : (
            <Botao pequeno variante="perigo" icone={Trash2} className="mr-auto" onClick={() => setConfirmarApagar(true)}>
              Apagar
            </Botao>
          )}
          {t.status === "concluida" ? (
            <Botao icone={RotateCcw} onClick={() => void a.status(t, "em_producao")}>
              Reabrir
            </Botao>
          ) : (
            <Botao variante="primario" icone={CheckSquare} onClick={() => void a.status(t, "concluida")}>
              Marcar concluída
            </Botao>
          )}
        </>
      }
    >
      {a.erro && <p className="mb-3 rounded-bloco bg-erro-suave px-3 py-2 text-xs text-erro">{a.erro}</p>}
      <div className="grid gap-x-8 md:grid-cols-2">
        <div>
          <Linha icone={Layers} rotulo="Status">
            <div className="flex flex-wrap gap-1">
              {STATUS.map((s) => (
                <button
                  key={s.valor}
                  type="button"
                  onClick={() => s.valor !== t.status && void a.status(t, s.valor)}
                  className={cx(
                    "rounded-botao px-2.5 py-1 text-[11px] font-bold uppercase transition-opacity",
                    s.valor === t.status ? COR_STATUS[s.valor] : "bg-superficie-2/60 text-texto-suave opacity-70 hover:opacity-100",
                  )}
                  aria-pressed={s.valor === t.status}
                >
                  {s.rotulo}
                </button>
              ))}
            </div>
          </Linha>
          <Linha icone={CalendarDays} rotulo="Datas">
            <div className="flex items-center gap-1">
              <input type="date" aria-label="Início" className={campoLeve} value={t.inicio ?? ""} onChange={(e) => set({ inicio: e.target.value || null })} />
              <span className="text-texto-suave">→</span>
              <input type="date" aria-label="Vencimento" className={campoLeve} value={t.vencimento ?? ""} onChange={(e) => set({ vencimento: e.target.value || null })} />
            </div>
          </Linha>
          <Linha icone={Hourglass} rotulo="Estimativa de tempo">
            <span className="px-2" title="Tempo por entrega (em Configurações → Tipos de entrega) × quantidade">
              {est != null ? formatarDuracao(est) : tipo?.audiovisual ? "vídeo de terceiro: sem horas" : tipo ? "tipo sem tempo cadastrado" : "escolha o tipo de entrega"}
            </span>
          </Linha>
          <Linha icone={Timer} rotulo="Rastrear tempo">
            {temCronometro(t, cfg) ? (
              <div className="flex flex-wrap items-center gap-2">
                <BotaoRelogio t={t} a={a} />
                {m && seg > 0 && (
                  <>
                    {est != null && (
                      <span className={cx("text-[11px]", seg / 3600 > est ? "text-erro" : "text-texto-suave")}>
                        de {formatarDuracao(est)} estimado
                      </span>
                    )}
                    {m.estado !== "rodando" && (
                      <button
                        type="button"
                        className="text-[11px] text-texto-suave underline hover:text-erro"
                        onClick={() => confirm("Zerar o tempo desta tarefa? Ele sai da média da calibragem.") && void a.zerarTempo(t)}
                      >
                        zerar
                      </button>
                    )}
                  </>
                )}
                {m?.estado === "concluido" && <span className="text-[11px] text-ok">contou na calibragem</span>}
              </div>
            ) : (
              <span className="px-2 text-texto-suave">{tipo?.audiovisual ? "vídeo é de terceiro: não conta horas" : "escolha o tipo de entrega"}</span>
            )}
          </Linha>
        </div>
        <div>
          <Linha icone={User} rotulo="Responsável">
            <div className="flex items-center gap-1.5">
              {resp && <Avatar nome={resp.nome} foto={resp.fotoUrl} tamanho="sm" />}
              <select className={campoLeve} value={t.responsavelId ?? ""} onChange={(e) => set({ responsavelId: e.target.value || null })} aria-label="Responsável">
                <option value="">Vazio</option>
                {socios.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </div>
          </Linha>
          <Linha icone={Flag} rotulo="Prioridade">
            <select
              className={cx(campoLeve, t.prioridade && COR_PRIORIDADE[t.prioridade], "font-semibold")}
              value={t.prioridade ?? ""}
              onChange={(e) => set({ prioridade: (e.target.value || null) as Tarefa["prioridade"] })}
              aria-label="Prioridade"
            >
              <option value="">Vazio</option>
              {PRIORIDADES.map((p) => (
                <option key={p.valor} value={p.valor}>
                  {p.rotulo}
                </option>
              ))}
            </select>
          </Linha>
          <Linha icone={Users} rotulo="Cliente">
            <select className={campoLeve} value={t.clienteId ?? ""} onChange={(e) => set({ clienteId: e.target.value || null })} aria-label="Cliente">
              <option value="">Sem cliente</option>
              {cfg.clientes
                .filter((c) => c.ativo || c.id === t.clienteId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
            </select>
          </Linha>
          <Linha icone={Layers} rotulo="Tipo de entrega">
            <select
              className={campoLeve}
              value={t.tipoEntregaId ?? ""}
              onChange={(e) => set({ tipoEntregaId: e.target.value || null })}
              aria-label="Tipo de entrega"
              disabled={!!m && seg > 0}
              title={m && seg > 0 ? "Já tem tempo medido: para trocar o tipo, zere o tempo antes." : undefined}
            >
              <option value="">Escolha</option>
              {cfg.tiposEntrega
                .filter((x) => x.ativo || x.id === t.tipoEntregaId)
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nome}
                  </option>
                ))}
            </select>
          </Linha>
          <Linha icone={Hash} rotulo="Quantidade">
            <div className="flex items-center gap-2">
              <Passo valor={t.quantidade} aoMudar={(v) => set({ quantidade: Math.max(1, v ?? 1) })} ariaLabel="Quantidade de entregas" />
              <span className="text-[11px] text-texto-suave">{tipo ? `${tipo.nome.toLowerCase()}(s) nesta tarefa` : ""}</span>
            </div>
          </Linha>
        </div>
      </div>

      {cal && cal.alvo != null && (
        <p className="mt-2 rounded-bloco bg-marca-tinta px-3 py-2 text-[11px] text-texto-suave">
          {cal.situacao === "calibrado"
            ? `${tipo?.nome} já está calibrado (média ${formatarMinutos(cal.mediaMinutos)} por entrega). O tempo continua contando para acompanhar.`
            : `Calibragem de ${tipo?.nome}: ${cal.medicoes} de ${cal.alvo} entregas medidas. Dê Start ao começar e conclua a tarefa ao terminar.`}{" "}
          <Link href="/calibragem" className="font-semibold text-marca-forte underline">
            Ver calibragem
          </Link>
        </p>
      )}

      {t.clienteId && <ParaCliente t={t} a={a} />}

      <div className="mt-4">
        <p className="mb-1 text-xs font-semibold text-texto-suave">Descrição</p>
        <textarea
          className="min-h-20 w-full rounded-campo border border-linha bg-superficie px-3 py-2 text-sm focus:border-marca focus:outline-none"
          placeholder="Detalhes, links, referências…"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          onBlur={() => descricao !== t.descricao && set({ descricao })}
        />
      </div>

      <div className="mt-4">
        <p className="mb-1 flex items-center gap-2 text-xs font-semibold text-texto-suave">
          Checklist {t.etapas.length > 0 && <span className="tabular-nums">{feitas}/{t.etapas.length}</span>}
        </p>
        <div className="flex flex-col">
          {t.etapas.map((e) => (
            <div key={e.id} className="group flex items-center gap-2 rounded-item px-1 py-1 hover:bg-superficie-2/60">
              <button
                type="button"
                role="checkbox"
                aria-checked={e.feita}
                aria-label={e.titulo}
                className={cx("shrink-0", e.feita ? "text-ok" : "text-texto-suave hover:text-texto")}
                onClick={() => set({ etapas: t.etapas.map((x) => (x.id === e.id ? { ...x, feita: !x.feita } : x)) })}
              >
                {e.feita ? <CheckSquare size={16} /> : <Square size={16} />}
              </button>
              <span className={cx("flex-1 text-[13px]", e.feita && "text-texto-suave line-through")}>{e.titulo}</span>
              <button
                type="button"
                aria-label={`Remover ${e.titulo}`}
                className="text-texto-suave opacity-0 group-hover:opacity-100 hover:text-erro focus:opacity-100"
                onClick={() => set({ etapas: t.etapas.filter((x) => x.id !== e.id) })}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-2 px-1 py-1">
            <Plus size={14} className="text-texto-suave" aria-hidden />
            <input
              className="h-7 flex-1 bg-transparent text-[13px] outline-none placeholder:text-texto-suave"
              placeholder="Adicionar item (Enter)"
              value={novaEtapa}
              onChange={(e) => setNovaEtapa(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && novaEtapa.trim()) {
                  set({ etapas: [...t.etapas, { id: novoId(), titulo: novaEtapa.trim(), feita: false }] });
                  setNovaEtapa("");
                }
              }}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}
