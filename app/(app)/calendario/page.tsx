"use client";

// Calendário em abas (G5 da auditoria, 01/10/2026): o mês das tarefas e as datas comemorativas dos clientes.
// As datas saíram de Configurações: mexem todo mês, no planejamento.

import { CalendarDays, CalendarHeart } from "lucide-react";
import DatasComemorativas from "@/components/calendario/Datas";
import Grade from "@/components/calendario/Grade";
import { PaginaComAbas } from "@/components/PaginaComAbas";

export default function Calendario() {
  return (
    <PaginaComAbas
      icone={CalendarDays}
      selo="Dia a dia"
      titulo="Calendário"
      largura="max-w-[1300px]"
      abas={[
        { id: "mes", rotulo: "Mês", icone: CalendarDays, area: "calendario", conteudo: Grade, descricao: "As tarefas no tempo: do início ao prazo. Clique num dia para ver e criar tarefas nele." },
        // só sócios (as tabelas de datas são só de sócio)
        { id: "datas", rotulo: "Datas comemorativas", icone: CalendarHeart, area: "configuracoes", conteudo: DatasComemorativas, descricao: "As datas que entram no planejamento de cada cliente, com a antecedência da campanha de cada um." },
      ]}
    />
  );
}
