"use client";

// Estado das tarefas + ações (Start, Pausar, mudar status…) usadas pela lista, pelo quadro e pela janela.

import { useCallback, useEffect, useState } from "react";
import type { Medicao } from "@/lib/calculo/calibragem";
import { configVazia, novoId } from "@/lib/calculo/novo";
import { darStart, medicaoDaTarefa, mudarStatus, pausar, type StatusTarefa, type Tarefa } from "@/lib/calculo/tarefas";
import type { Configuracao } from "@/lib/calculo/tipos";
import { useDados } from "@/lib/dados/contexto";

/** Avisa o relógio do menu que algo mudou. */
export const avisarRelogio = () => window.dispatchEvent(new Event("aden:relogio"));

export function useTarefas() {
  const { repo, usuario } = useDados();
  const [config, setConfig] = useState<Configuracao>(configVazia());
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [medicoes, setMedicoes] = useState<Medicao[]>([]);
  const [carregado, setCarregado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    const [t, m, c] = await Promise.all([repo.listarTarefas(), repo.listarMedicoes(), repo.carregarConfig()]);
    setTarefas(t);
    setMedicoes(m);
    setConfig(c);
  }, [repo]);

  useEffect(() => {
    (async () => {
      try {
        await recarregar();
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro ao carregar as tarefas.");
      } finally {
        setCarregado(true);
      }
    })();
    const ao = () => void recarregar().catch(() => {});
    // voltou para a aba: busca de novo (o cliente pode ter respondido pelo painel)
    const aoVoltar = () => document.visibilityState === "visible" && ao();
    window.addEventListener("aden:relogio", ao);
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      window.removeEventListener("aden:relogio", ao);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [repo, recarregar]);

  const tentar = async (f: () => Promise<void>) => {
    setErro(null);
    try {
      await f();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para salvar.");
      await recarregar().catch(() => {});
    }
  };

  /** Salva a tarefa (otimista: a tela muda na hora). */
  const salvar = (t: Tarefa) =>
    tentar(async () => {
      setTarefas((l) => (l.some((x) => x.id === t.id) ? l.map((x) => (x.id === t.id ? t : x)) : [t, ...l]));
      await repo.salvarTarefa(t);
      // a medição acompanha a quantidade da tarefa
      const m = medicaoDaTarefa(t, medicoes);
      if (m && (m.unidades ?? 1) !== Math.max(1, t.quantidade)) {
        const nova = { ...m, unidades: Math.max(1, t.quantidade) };
        setMedicoes((l) => l.map((x) => (x.id === m.id ? nova : x)));
        await repo.salvarMedicao(nova);
      }
    });

  const gravarPar = async (tarefa: Tarefa, medicao: Medicao | null, tarefaMudou: boolean) => {
    if (tarefaMudou) {
      setTarefas((l) => l.map((x) => (x.id === tarefa.id ? tarefa : x)));
      await repo.salvarTarefa(tarefa);
    }
    if (medicao) {
      setMedicoes((l) => (l.some((x) => x.id === medicao.id) ? l.map((x) => (x.id === medicao.id ? medicao : x)) : [medicao, ...l]));
      await repo.salvarMedicao(medicao);
    }
    avisarRelogio();
  };

  const start = (t: Tarefa) =>
    tentar(async () => {
      // só um relógio rodando por pessoa: pausa o que estiver ligado
      const pessoaId = usuario?.pessoaId ?? t.responsavelId;
      for (const m of medicoes.filter((x) => x.estado === "rodando" && x.tarefaId !== t.id && (!pessoaId || x.pessoaId === pessoaId))) {
        const p = pausar(m, new Date());
        setMedicoes((l) => l.map((x) => (x.id === p.id ? p : x)));
        await repo.salvarMedicao(p);
      }
      const r = darStart(t, medicaoDaTarefa(t, medicoes), pessoaId ?? null, novoId(), new Date());
      if (!r) throw new Error("Escolha o tipo de entrega da tarefa para ligar o cronômetro.");
      await gravarPar(r.tarefa, r.medicao, r.tarefa !== t);
    });

  const pausarTarefa = (t: Tarefa) =>
    tentar(async () => {
      const m = medicaoDaTarefa(t, medicoes);
      if (m) await gravarPar(t, pausar(m, new Date()), false);
    });

  const status = (t: Tarefa, s: StatusTarefa) =>
    tentar(async () => {
      const r = mudarStatus(t, s, medicaoDaTarefa(t, medicoes), new Date());
      await gravarPar(r.tarefa, r.medicao, true);
    });

  const remover = (t: Tarefa) =>
    tentar(async () => {
      setTarefas((l) => l.filter((x) => x.id !== t.id));
      const m = medicaoDaTarefa(t, medicoes);
      // relógio ligado numa tarefa apagada: pausa, para não ficar contando para sempre
      if (m?.estado === "rodando") await repo.salvarMedicao(pausar(m, new Date()));
      await repo.removerTarefa(t.id);
      avisarRelogio();
    });

  const zerarTempo = (t: Tarefa) =>
    tentar(async () => {
      const m = medicaoDaTarefa(t, medicoes);
      if (!m) return;
      setMedicoes((l) => l.filter((x) => x.id !== m.id));
      await repo.removerMedicao(m.id);
      avisarRelogio();
    });

  /** Manda a peça para o cliente aprovar (aparece no painel dele). */
  const enviarParaCliente = (t: Tarefa) =>
    tentar(async () => {
      await repo.salvarTarefa({ ...t, visivelCliente: true });
      await repo.enviarParaCliente(t.id);
      await recarregar();
      avisarRelogio();
    });

  /** Sobe as artes e junta na peça. */
  const anexarArquivos = (t: Tarefa, arquivos: File[]) =>
    tentar(async () => {
      const novos = [];
      for (const f of arquivos) novos.push(await repo.enviarArquivoPeca(t.id, f));
      const nova = { ...t, arquivos: [...(t.arquivos ?? []), ...novos] };
      setTarefas((l) => l.map((x) => (x.id === t.id ? nova : x)));
      await repo.salvarTarefa(nova);
    });

  return { config, tarefas, medicoes, carregado, erro, setErro, salvar, start, pausarTarefa, status, remover, zerarTempo, enviarParaCliente, anexarArquivos, recarregar, usuario };
}

export type AcoesTarefas = ReturnType<typeof useTarefas>;
