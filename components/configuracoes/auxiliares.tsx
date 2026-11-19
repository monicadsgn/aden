"use client";

// Peças pequenas que as seções das Configurações dividem.

import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { Recolhivel } from "@/components/Recolhivel";
import { Badge, cx } from "@/components/ui";
import { descreverItem } from "@/lib/dados/acoes";
import { formatarPct } from "@/lib/formato";
import type { ItemProtegido } from "@/lib/regras/aprovacao";

// Nomes citados pela Moni no briefing. Só nomes: horas e divisões ficam vazias.
export const SERVICOS_CITADOS = ["Tráfego pago", "Criativos", "Social media", "Branding"];
export const TIPOS_CITADOS = ["Post simples", "Carrossel", "PDF", "Peça de WhatsApp", "Criativo de tráfego com variações", "Planejamento mensal", "Relatório"];

export function atualizar<T extends { id: string }>(lista: T[], id: string, patch: Partial<T>): T[] {
  return lista.map((x) => (x.id === id ? { ...x, ...patch } : x));
}

export function SomaPct({ soma, total }: { soma: number; total: number }) {
  if (total === 0) return null;
  const ok = Math.abs(soma - 100) < 0.005;
  return (
    <Badge tom={ok ? "ok" : "erro"} icone={ok ? Check : undefined}>
      soma {formatarPct(soma)}
    </Badge>
  );
}

export function Explica({ children }: { children: ReactNode }) {
  return <p className="self-end pb-2 text-[12px] leading-snug text-texto-suave">{children}</p>;
}

/** Marca o campo para o botão dos avisos saber onde levar. */
export function Alvo({ campo, children, className }: { campo: string; children: ReactNode; className?: string }) {
  return (
    <div data-campo={campo} className={cx("rounded-campo", className)}>
      {children}
    </div>
  );
}

/** Cadeado + alteração pendente, embaixo de um campo protegido. */
export function Protegido({ pendente }: { pendente: ItemProtegido | null }) {
  if (!pendente) return null;
  return <p className="mt-1 text-[12px] leading-tight font-semibold text-aviso">alteração pendente de aprovação: {descreverItem(pendente).split(": ").slice(1).join(": ")}</p>;
}

export function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  // fechado por padrão: a tela mostra só os títulos, e cada um lembra se foi deixado aberto
  return (
    <Recolhivel id={`config-${titulo}`} titulo={titulo}>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </Recolhivel>
  );
}
