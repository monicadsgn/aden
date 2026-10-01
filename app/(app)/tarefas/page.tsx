"use client";

import { CalendarDays, Columns3, List, ListChecks, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Grade from "@/components/calendario/Grade";
import { CabecalhoPagina, Embutida } from "@/components/Shell";
import { BotaoRelogio, COR_STATUS, DetalheTarefa } from "@/components/tarefas/DetalheTarefa";
import { ListaTarefas, MetaTarefa } from "@/components/tarefas/LinhaTarefa";
import { useTarefas, type AcoesTarefas } from "@/components/tarefas/useTarefas";
import { Botao, Card, Segmentado, Selecao, Vazio, cx } from "@/components/ui";
import { podeCriarTarefa } from "@/lib/acesso";
import { novoId } from "@/lib/calculo/novo";
import { agruparPorPrazo, novaTarefa, ROTULO_GRUPO, STATUS, type StatusTarefa, type Tarefa } from "@/lib/calculo/tarefas";

type Visao = "lista" | "quadro" | "calendario";
type Situacao = "abertas" | "concluidas" | "todas";
const CHAVE_VISAO = "aden:tarefas:visao";

function Quadro({ tarefas, a, abrir }: { tarefas: Tarefa[]; a: AcoesTarefas; abrir: (id: string) => void }) {
  const [sobre, setSobre] = useState<StatusTarefa | null>(null);
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {STATUS.map((s) => {
        const col = tarefas.filter((t) => t.status === s.valor);
        return (
          <div
            key={s.valor}
            onDragOver={(e) => {
              e.preventDefault();
              setSobre(s.valor);
            }}
            onDragLeave={() => setSobre(null)}
            onDrop={(e) => {
              e.preventDefault();
              setSobre(null);
              const t = tarefas.find((x) => x.id === e.dataTransfer.getData("text/plain"));
              if (t && t.status !== s.valor) void a.status(t, s.valor);
            }}
            className={cx("flex min-h-40 flex-col gap-2 rounded-bloco bg-superficie-2/60 p-2 transition-colors", sobre === s.valor && "bg-marca-suave")}
          >
            <p className="flex items-center gap-2 px-1 pt-1 text-[11px] font-bold uppercase">
              <span className={cx("size-2.5 rounded-full", COR_STATUS[s.valor])} aria-hidden />
              {s.rotulo}
              <span className="font-semibold text-texto-suave">{col.length}</span>
            </p>
            {col.map((t) => (
              <div
                key={t.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
                role="button"
                tabIndex={0}
                onClick={() => abrir(t.id)}
                onKeyDown={(e) => e.key === "Enter" && abrir(t.id)}
                className="flex cursor-grab flex-col gap-2 rounded-item border border-linha bg-superficie p-3 shadow-card hover:border-marca/50 active:cursor-grabbing"
              >
                <span className={cx("text-[13px] font-medium", t.status === "concluida" && "text-texto-suave line-through")}>{t.titulo}</span>
                <div className="flex flex-wrap items-center gap-2">
                  <MetaTarefa t={t} a={a} />
                  <span className="ml-auto">
                    <BotaoRelogio t={t} a={a} pequeno />
                  </span>
                </div>
              </div>
            ))}
            {col.length === 0 && <p className="px-1 py-4 text-center text-[11px] text-texto-suave">vazio</p>}
          </div>
        );
      })}
    </div>
  );
}

export default function Tarefas() {
  const a = useTarefas();
  const [visao, setVisao] = useState<Visao>("lista");
  const [aberta, setAberta] = useState<string | null>(null);
  const [rapida, setRapida] = useState("");
  const [cliente, setCliente] = useState<string | null>(null);
  const [resp, setResp] = useState<string | null>(null);
  const [lote, setLote] = useState<string | null>(null);
  // M6 da auditoria (01/10/2026): filtros da referência (abertas, concluídas, todas; cliente; área = serviço)
  const [situacao, setSituacao] = useState<Situacao>("abertas");
  const [area, setArea] = useState<string | null>(null);

  useEffect(() => {
    try {
      const v = localStorage.getItem(CHAVE_VISAO);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- preferência guardada no navegador
      if (v === "lista" || v === "quadro" || v === "calendario") setVisao(v);
    } catch {}
    const ler = () => setAberta(new URLSearchParams(window.location.search).get("tarefa"));
    ler();
    window.addEventListener("popstate", ler);
    return () => window.removeEventListener("popstate", ler);
  }, []);

  const abrir = (id: string | null) => {
    setAberta(id);
    const u = new URL(window.location.href);
    if (id) u.searchParams.set("tarefa", id);
    else u.searchParams.delete("tarefa");
    window.history.replaceState(null, "", u);
  };

  const trocarVisao = (v: Visao) => {
    setVisao(v);
    try {
      localStorage.setItem(CHAVE_VISAO, v);
    } catch {}
  };

  // calendários do planejamento mensal (só os que têm tarefa aberta)
  const lotes = [...new Set(a.tarefas.filter((t) => t.lote && t.status !== "concluida").map((t) => t.lote!))].sort();
  const areaDe = (t: Tarefa) => a.config.tiposEntrega.find((x) => x.id === t.tipoEntregaId)?.servicoId ?? null;
  const filtradas = useMemo(
    () =>
      a.tarefas.filter(
        (t) =>
          (!cliente || t.clienteId === cliente) &&
          (!resp || t.responsavelId === resp) &&
          (!lote || t.lote === lote) &&
          (!area || areaDe(t) === area) &&
          (situacao === "todas" || (situacao === "concluidas") === (t.status === "concluida")),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- areaDe só lê a configuração
    [a.tarefas, a.config, cliente, resp, lote, area, situacao],
  );
  const grupos = useMemo(() => agruparPorPrazo(filtradas, new Date()), [filtradas]);

  const criar = async (titulo: string, abrirDepois: boolean) => {
    const t = novaTarefa(novoId(), titulo, { clienteId: cliente, responsavelId: resp ?? a.usuario?.pessoaId ?? null });
    await a.salvar(t);
    if (abrirDepois) abrir(t.id);
  };

  const tarefaAberta = a.tarefas.find((t) => t.id === aberta) ?? null;
  const podeCriar = podeCriarTarefa(a.usuario?.papel ?? "admin");

  if (!a.carregado) return null;

  return (
    <div className="pb-16">
      <CabecalhoPagina
        icone={ListChecks}
        selo="Dia a dia"
        titulo="Tarefas"
        descricao="O que está em produção, por prazo. As horas saem do tempo cadastrado de cada entrega; medir o tempo é opcional, dentro da tarefa."
        acoes={
          podeCriar ? (
            <Botao variante="primario" icone={Plus} onClick={() => void criar("Nova tarefa", true)}>
              Nova tarefa
            </Botao>
          ) : undefined
        }
      />
      <div className="mx-auto flex max-w-[1300px] flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
        {a.erro && !tarefaAberta && <p className="rounded-card bg-erro-suave px-4 py-3 text-sm text-erro">{a.erro}</p>}

        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full sm:w-80">
            <Segmentado<Visao>
              rotulo="Visão"
              valor={visao}
              aoMudar={trocarVisao}
              opcoes={[
                { valor: "lista", rotulo: "Lista", icone: List },
                { valor: "quadro", rotulo: "Quadro", icone: Columns3 },
                { valor: "calendario", rotulo: "Calendário", icone: CalendarDays },
              ]}
            />
          </div>
          {visao !== "calendario" && (
            <div className="w-full sm:w-72">
              <Segmentado<Situacao>
                rotulo="Mostrar"
                valor={situacao}
                aoMudar={setSituacao}
                opcoes={[
                  { valor: "abertas", rotulo: "Abertas" },
                  { valor: "concluidas", rotulo: "Concluídas" },
                  { valor: "todas", rotulo: "Todas" },
                ]}
              />
            </div>
          )}
          <Selecao
            className="w-full sm:w-52"
            ariaLabel="Filtrar por cliente"
            valor={cliente}
            vazio="Todos os clientes"
            opcoes={a.config.clientes.filter((c) => c.ativo).map((c) => ({ valor: c.id, rotulo: c.nome }))}
            aoMudar={setCliente}
          />
          <Selecao
            className="w-full sm:w-44"
            ariaLabel="Filtrar por responsável"
            valor={resp}
            vazio="Todo mundo"
            opcoes={a.config.pessoas.filter((p) => p.ativo).map((p) => ({ valor: p.id, rotulo: p.nome }))}
            aoMudar={setResp}
          />
          <Selecao
            className="w-full sm:w-48"
            ariaLabel="Filtrar por área"
            valor={area}
            vazio="Todas as áreas"
            opcoes={a.config.servicos.filter((s) => s.ativo).map((s) => ({ valor: s.id, rotulo: s.nome }))}
            aoMudar={setArea}
          />
          {lotes.length > 0 && (
            <Selecao
              className="w-full sm:w-60"
              ariaLabel="Filtrar por calendário do planejamento"
              valor={lote}
              vazio="Todos os calendários"
              opcoes={lotes.map((l) => ({ valor: l, rotulo: l }))}
              aoMudar={setLote}
            />
          )}
        </div>

        {podeCriar && <input
          className="h-11 w-full rounded-botao border border-linha bg-superficie px-4 text-sm placeholder:text-texto-suave focus:border-marca focus:ring-2 focus:ring-marca/20 focus:outline-none"
          placeholder="Nova tarefa rápida: escreva e aperte Enter"
          value={rapida}
          onChange={(e) => setRapida(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && rapida.trim()) {
              void criar(rapida.trim(), false);
              setRapida("");
            }
          }}
        />}

        {visao === "calendario" ? (
          // a mesma grade da tela Calendário, dentro de Tarefas (o filtro de pessoa fica na própria grade)
          <Embutida.Provider value="max-w-[1300px]">
            <div className="-mx-4 sm:-mx-6 lg:-mx-8">
              <Grade />
            </div>
          </Embutida.Provider>
        ) : a.tarefas.length === 0 ? (
          <Vazio icone={ListChecks} titulo="Nenhuma tarefa ainda">
            Crie a primeira no campo acima.
          </Vazio>
        ) : visao === "quadro" ? (
          <Quadro tarefas={filtradas} a={a} abrir={abrir} />
        ) : filtradas.length === 0 ? (
          <Vazio icone={ListChecks} titulo={situacao === "concluidas" ? "Nenhuma tarefa concluída com esses filtros" : "Nada aberto com esses filtros"}>
            Troque o filtro acima para ver mais.
          </Vazio>
        ) : (
          <Card>
            <div className="flex flex-col gap-4 p-3">
              {grupos.map((g) => (
                <div key={g.grupo}>
                  <p className={cx("mb-1 flex items-center gap-2 px-2 text-[11px] font-bold tracking-wide uppercase", g.grupo === "atrasadas" ? "text-erro" : "text-texto-suave")}>
                    {ROTULO_GRUPO[g.grupo]} <span className="font-semibold">{g.tarefas.length}</span>
                    <span className="h-px flex-1 bg-linha" aria-hidden />
                  </p>
                  <ListaTarefas tarefas={g.tarefas} a={a} abrir={abrir} />
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
      <DetalheTarefa tarefa={tarefaAberta} a={a} aoFechar={() => abrir(null)} />
    </div>
  );
}
