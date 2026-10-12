"use client";

// O botão de um toque da peça: faz o próximo passo natural (começar, enviar ao cliente, agendar, publicar).
// Usa as mesmas ações do resto da tela, então as regras (aprovação antes de agendar etc.) continuam valendo.

import { CalendarClock, Megaphone, Play, Send } from "lucide-react";
import { Botao, cx } from "../ui";
import { proximoPasso } from "@/lib/calculo/tarefas";
import type { Tarefa } from "@/lib/calculo/tarefas";
import type { AcoesTarefas } from "./useTarefas";

const ICONE = { iniciar: Play, enviar: Send, agendar: CalendarClock, publicar: Megaphone } as const;

export function ProximoPasso({ t, a, compacto = false }: { t: Tarefa; a: AcoesTarefas; compacto?: boolean }) {
  const passo = proximoPasso(t, a.passa(t));
  if (!passo) return null;
  const fazer = () => {
    if (passo.chave === "enviar") return void a.enviarParaCliente(t);
    if (passo.chave === "publicar") return void a.marcarPublicada(t, true);
    return void a.etapa(t, passo.destino!);
  };
  return (
    <Botao
      pequeno
      variante="primario"
      icone={ICONE[passo.chave]}
      className={cx(compacto && "shrink-0")}
      onClick={(e: React.MouseEvent) => {
        e.stopPropagation();
        fazer();
      }}
    >
      {passo.rotulo}
    </Botao>
  );
}
