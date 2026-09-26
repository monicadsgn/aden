"use client";

import { Columns3, List, ListChecks, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CabecalhoPagina } from "@/components/Shell";
import { BotaoRelogio, COR_STATUS, DetalheTarefa } from "@/components/tarefas/DetalheTarefa";
import { LinhaTarefa, MetaTarefa } from "@/components/tarefas/LinhaTarefa";
import { useTarefas, type AcoesTarefas } from "@/components/tarefas/useTarefas";
import { Botao, Card, Segmentado, Selecao, Vazio, cx } from "@/components/ui";
import { podeCriarTarefa } from "@/lib/acesso";
import { novoId } from "@/lib/calculo/novo";
import { agruparPorPrazo, novaTarefa, ROTULO_GRUPO, STATUS, type StatusTarefa, type Tarefa } from "@/lib/calculo/tarefas";

type Visao = "lista" | "quadro";
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
  const [mostrarConcluidas, setMostrarConcluidas] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(CHAVE_VISAO);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- preferência guardada no navegador
      if (v === "lista" || v === "quadro") setVisao(v);
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

  const filtradas = useMemo(
    () => a.tarefas.filter((t) => (!cliente || t.clienteId === cliente) && (!resp || t.responsavelId === resp)),
    [a.tarefas, cliente, resp],
  );
  const grupos = useMemo(() => agruparPorPrazo(filtradas, new Date()), [filtradas]);
  const concluidas = filtradas.filter((t) => t.status === "concluida").length;

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
        descricao="O que está em produção. Abra a tarefa e dê Start ao começar: o tempo medido calibra quanto cada entrega leva de verdade."
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
          <div className="w-full sm:w-52">
            <Segmentado<Visao>
              rotulo="Visão"
              valor={visao}
              aoMudar={trocarVisao}
              opcoes={[
                { valor: "lista", rotulo: "Lista", icone: List },
                { valor: "quadro", rotulo: "Quadro", icone: Columns3 },
              ]}
            />
          </div>
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

        {a.tarefas.length === 0 ? (
          <Vazio icone={ListChecks} titulo="Nenhuma tarefa ainda">
            Crie a primeira no campo acima. Dentro dela tem o botão Start, para medir quanto tempo a entrega leva.
          </Vazio>
        ) : visao === "quadro" ? (
          <Quadro tarefas={filtradas} a={a} abrir={abrir} />
        ) : (
          <Card>
            <div className="flex flex-col gap-4 p-3">
              {grupos
                .filter((g) => g.grupo !== "concluidas")
                .map((g) => (
                  <div key={g.grupo}>
                    <p className={cx("mb-1 flex items-center gap-2 px-2 text-[11px] font-bold tracking-wide uppercase", g.grupo === "atrasadas" ? "text-erro" : "text-texto-suave")}>
                      {ROTULO_GRUPO[g.grupo]} <span className="font-semibold">{g.tarefas.length}</span>
                      <span className="h-px flex-1 bg-linha" aria-hidden />
                    </p>
                    {g.tarefas.map((t) => (
                      <LinhaTarefa key={t.id} t={t} a={a} abrir={() => abrir(t.id)} />
                    ))}
                  </div>
                ))}
              {concluidas > 0 && (
                <div>
                  <button type="button" className="px-2 text-[11px] font-semibold text-texto-suave hover:text-texto" onClick={() => setMostrarConcluidas(!mostrarConcluidas)}>
                    {mostrarConcluidas ? "Esconder concluídas" : `Ver ${concluidas} concluída(s)`}
                  </button>
                  {mostrarConcluidas &&
                    grupos
                      .find((g) => g.grupo === "concluidas")
                      ?.tarefas.map((t) => <LinhaTarefa key={t.id} t={t} a={a} abrir={() => abrir(t.id)} />)}
                </div>
              )}
            </div>
          </Card>
        )}
      </div>
      <DetalheTarefa tarefa={tarefaAberta} a={a} aoFechar={() => abrir(null)} />
    </div>
  );
}
