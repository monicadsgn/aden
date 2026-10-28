"use client";

// Seção que abre e fecha. Serve para a tela mostrar só o resumo e deixar o detalhe a um clique.
// Lembra, neste navegador, se a pessoa deixou aberta ou fechada (se o navegador não deixar guardar, usa o padrão).
// O conteúdo continua montado quando fechado (só fica escondido), então nada que a pessoa já digitou se perde.

import { ChevronDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useId, useState, useSyncExternalStore, type ReactNode } from "react";
import { cx } from "./ui";

const PREFIXO = "aden:recolhivel:";

function lerGuardado(id: string): boolean | null {
  try {
    const v = window.localStorage.getItem(PREFIXO + id);
    return v === "1" ? true : v === "0" ? false : null;
  } catch {
    return null;
  }
}

const ouvintes = new Set<() => void>();

function assinar(aviso: () => void) {
  ouvintes.add(aviso);
  window.addEventListener("storage", aviso);
  return () => {
    ouvintes.delete(aviso);
    window.removeEventListener("storage", aviso);
  };
}

function guardar(id: string, aberto: boolean) {
  try {
    window.localStorage.setItem(PREFIXO + id, aberto ? "1" : "0");
  } catch {
    // sem permissão para guardar: vale só nesta visita
  }
  ouvintes.forEach((o) => o());
}

export function Recolhivel({
  id,
  titulo,
  resumo,
  icone: Icone,
  abertoPadrao = false,
  children,
  className,
}: {
  /** nome fixo, só para lembrar o estado (ex.: "crm-funil-quiz") */
  id: string;
  titulo: string;
  /** uma linha que aparece quando fechada (ex.: "8 começaram, 2 enviaram") */
  resumo?: ReactNode;
  icone?: LucideIcon;
  abertoPadrao?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const guardado = useSyncExternalStore(
    assinar,
    () => lerGuardado(id),
    () => null,
  );
  const [local, setLocal] = useState<boolean | null>(null);
  const aberto = guardado ?? local ?? abertoPadrao;
  const corpo = useId();

  const alternar = () => {
    setLocal(!aberto);
    guardar(id, !aberto);
  };

  return (
    <section className={cx("rounded-bloco border border-linha bg-superficie", className)} aria-label={titulo}>
      <button
        type="button"
        aria-expanded={aberto}
        aria-controls={corpo}
        onClick={alternar}
        className="flex min-h-12 w-full items-center gap-3 rounded-bloco px-4 py-3 text-left transition-colors hover:bg-superficie-2/60"
      >
        {Icone && <Icone size={16} className="shrink-0 text-marca" aria-hidden />}
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold">{titulo}</span>
          {!aberto && resumo && <span className="mt-0.5 block text-[12px] leading-snug text-texto-suave">{resumo}</span>}
        </span>
        <ChevronDown size={16} className={cx("shrink-0 text-texto-suave transition-transform", aberto && "rotate-180")} aria-hidden />
      </button>
      <div id={corpo} hidden={!aberto} className="border-t border-linha px-4 py-4">
        {children}
      </div>
    </section>
  );
}
