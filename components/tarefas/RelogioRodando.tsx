"use client";

// Relógio flutuante: enquanto alguma tarefa está com o tempo rodando, aparece no canto
// de qualquer tela (como no ClickUp), para ninguém esquecer o Start ligado.

import { Pause, Timer } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { pausarMedicao, segundosDaMedicao, type Medicao } from "@/lib/calculo/calibragem";
import { relogio, type Tarefa } from "@/lib/calculo/tarefas";
import { useDados } from "@/lib/dados/contexto";
import { podeVer } from "@/lib/acesso";
import { useAgora } from "./DetalheTarefa";
import { avisarRelogio } from "./useTarefas";

export function RelogioRodando() {
  const { repo, usuario } = useDados();
  const caminho = usePathname();
  const [rodando, setRodando] = useState<{ m: Medicao; t: Tarefa | null } | null>(null);
  const permitido = !!usuario && podeVer(usuario.papel, "tarefas");

  const ler = useCallback(async () => {
    if (!permitido) return;
    const [ms, ts] = await Promise.all([repo.listarMedicoes(), repo.listarTarefas()]);
    const minhas = ms.filter((m) => m.estado === "rodando" && (!usuario?.pessoaId || !m.pessoaId || m.pessoaId === usuario.pessoaId));
    const m = minhas[0];
    setRodando(m ? { m, t: ts.find((t) => t.id === m.tarefaId) ?? null } : null);
  }, [repo, usuario, permitido]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- busca no banco (sistema externo)
    void ler().catch(() => {});
    const ao = () => void ler().catch(() => {});
    window.addEventListener("aden:relogio", ao);
    return () => window.removeEventListener("aden:relogio", ao);
  }, [ler, caminho]);

  const agora = useAgora(!!rodando);
  if (!rodando) return null;
  const naPropriaTela = caminho === "/tarefas";
  return (
    <div className="nao-imprimir fixed right-4 bottom-4 z-40 flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-botao bg-marca py-1.5 pr-1.5 pl-4 text-sobre-marca shadow-forte">
      <Timer size={15} className="shrink-0 animate-pulse" aria-hidden />
      <Link
        href={rodando.t ? `/tarefas?tarefa=${rodando.t.id}` : "/tarefas"}
        className="min-w-0 truncate text-xs font-semibold hover:underline"
        onClick={() => naPropriaTela && setTimeout(() => window.dispatchEvent(new PopStateEvent("popstate")), 0)}
      >
        {rodando.t?.titulo ?? "Tempo rodando"}
      </Link>
      <span className="numero text-sm font-bold tabular-nums">{relogio(segundosDaMedicao(rodando.m, agora))}</span>
      <button
        type="button"
        aria-label="Pausar"
        title="Pausar"
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sobre-marca/20 hover:bg-sobre-marca/30"
        onClick={async () => {
          await repo.salvarMedicao(pausarMedicao(rodando.m, new Date()));
          avisarRelogio();
        }}
      >
        <Pause size={14} />
      </button>
    </div>
  );
}
