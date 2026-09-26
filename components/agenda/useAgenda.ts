"use client";

import { useCallback, useEffect, useState } from "react";
import type { EventoAgenda } from "@/lib/agenda/ics";
import { useDados } from "@/lib/dados/contexto";

/** Eventos do Google Agenda de quem está logado, no período. */
export function useAgenda(de: string, ate: string) {
  const { repo } = useDados();
  const [eventos, setEventos] = useState<EventoAgenda[]>([]);
  const [erros, setErros] = useState<string[]>([]);
  const [conectada, setConectada] = useState<boolean | null>(null);

  const carregar = useCallback(async () => {
    try {
      const ag = await repo.listarAgendas();
      setConectada(ag.length > 0);
      if (!ag.length) return setEventos([]);
      const r = await repo.eventosAgenda(de, ate);
      setEventos(r.eventos);
      setErros(r.erros);
    } catch {
      setConectada(false);
    }
  }, [repo, de, ate]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- busca da agenda (sistema externo)
    void carregar();
  }, [carregar]);

  return { eventos, erros, conectada, recarregar: carregar };
}

export const horaDoEvento = (e: EventoAgenda) => (e.diaInteiro ? "dia todo" : e.inicio.slice(11, 16));
