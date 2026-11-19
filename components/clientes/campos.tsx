"use client";

// Peças pequenas dos formulários do cliente (rótulo, texto que salva ao sair do campo, dica).

import type { ReactNode } from "react";

export const campo =
  "sem-contorno h-9 w-full rounded-campo border border-linha bg-superficie px-3 text-sm placeholder:text-texto-suave/70 focus:border-marca focus:outline-none focus:ring-2 focus:ring-marca/20";

export function Rot({ rotulo, children, dica }: { rotulo: string; children: ReactNode; dica?: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold text-texto-suave">
      {rotulo}
      {children}
      {dica && <span className="text-[12px] leading-snug font-normal">{dica}</span>}
    </label>
  );
}

/** Campo numérico com a frase do que ele significa embaixo. */
export function ComDica({ dica, children }: { dica: string; children: ReactNode }) {
  return (
    <div>
      {children}
      <p className="mt-1 text-[12px] leading-snug text-texto-suave">{dica}</p>
    </div>
  );
}

/** Texto que salva ao sair do campo. */
export function Texto({ valor, aoSalvar, placeholder, tipo = "text" }: { valor: string; aoSalvar: (v: string) => void; placeholder?: string; tipo?: string }) {
  return (
    <input
      key={valor}
      type={tipo}
      className={campo}
      placeholder={placeholder}
      defaultValue={valor}
      onBlur={(e) => e.target.value !== valor && aoSalvar(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    />
  );
}

export const dataBr = (iso: string | null) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR") : "—");
