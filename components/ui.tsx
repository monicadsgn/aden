"use client";

// Componentes básicos de interface. Só usam os tokens de app/tokens.css.

import { ChevronDown, Minus, Plus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useId, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { lerMoeda, lerNumero, moedaParaTexto, numeroParaTexto } from "@/lib/formato";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

// ─── Estrutura ──────────────────────────────────────────────────────────────

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cx("card relative rounded-card border border-linha bg-superficie shadow-card", className)}>{children}</section>
  );
}

export function IconeBadge({ icone: Icone, tom = "marca", tamanho = "md" }: { icone: LucideIcon; tom?: Tom; tamanho?: "sm" | "md" | "lg" }) {
  const t = { sm: "size-7 rounded-item", md: "size-9 rounded-item", lg: "size-12 rounded-bloco" }[tamanho];
  const i = { sm: 14, md: 18, lg: 22 }[tamanho];
  return (
    <span className={cx("inline-flex shrink-0 items-center justify-center", t, TONS[tom])}>
      <Icone size={i} strokeWidth={2} className="shrink-0" aria-hidden />
    </span>
  );
}

export function TituloCard({
  icone,
  titulo,
  descricao,
  acao,
  tom,
}: {
  icone: LucideIcon;
  titulo: string;
  descricao?: ReactNode;
  acao?: ReactNode;
  tom?: Tom;
}) {
  return (
    <header className="flex items-start gap-3 px-5 pt-5 pb-3">
      <IconeBadge icone={icone} tom={tom} />
      <div className="min-w-0 flex-1">
        <h2 className="text-[15px] font-semibold leading-tight">{titulo}</h2>
        {descricao && <p className="mt-0.5 text-xs leading-snug text-texto-suave">{descricao}</p>}
      </div>
      {acao}
    </header>
  );
}

// ─── Tons, badges, botões ───────────────────────────────────────────────────

export type Tom = "marca" | "erro" | "aviso" | "ok" | "info" | "neutro";

const TONS: Record<Tom, string> = {
  marca: "bg-marca-suave text-marca-forte",
  erro: "bg-erro-suave text-erro",
  aviso: "bg-aviso-suave text-aviso",
  ok: "bg-ok-suave text-ok",
  info: "bg-info-suave text-info",
  neutro: "bg-superficie-2 text-texto-suave",
};

export function Badge({ children, tom = "neutro", icone: Icone, title }: { children: ReactNode; tom?: Tom; icone?: LucideIcon; title?: string }) {
  return (
    <span title={title} className={cx("inline-flex items-center gap-1 rounded-botao px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap", TONS[tom])}>
      {Icone && <Icone size={12} strokeWidth={2.4} aria-hidden />}
      {children}
    </span>
  );
}

type Variante = "primario" | "secundario" | "fantasma" | "perigo";

export function Botao({
  variante = "secundario",
  icone: Icone,
  children,
  className,
  pequeno,
  ...resto
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; icone?: LucideIcon; pequeno?: boolean }) {
  const v: Record<Variante, string> = {
    primario: "bg-marca text-sobre-marca hover:bg-marca-forte shadow-sm",
    secundario: "bg-superficie border border-linha text-texto hover:bg-superficie-2",
    fantasma: "text-texto-suave hover:bg-superficie-2 hover:text-texto",
    perigo: "text-erro hover:bg-erro-suave",
  };
  return (
    <button
      type="button"
      {...resto}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-botao font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        pequeno ? "h-8 text-xs" : "h-10 text-sm",
        children ? (pequeno ? "px-3" : "px-4") : pequeno ? "w-8" : "w-10",
        v[variante],
        className,
      )}
    >
      {Icone && <Icone size={pequeno ? 14 : 16} strokeWidth={2.2} className="shrink-0" aria-hidden />}
      {children}
    </button>
  );
}

export function Segmentado<T extends string>({
  valor,
  opcoes,
  aoMudar,
  rotulo,
}: {
  valor: T | null;
  opcoes: { valor: T; rotulo: string; icone?: LucideIcon }[];
  aoMudar: (v: T) => void;
  rotulo: string;
}) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="inline-flex w-full rounded-botao bg-superficie-2 p-1">
      {opcoes.map((o) => {
        const ativo = o.valor === valor;
        const Ic = o.icone;
        return (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={ativo}
            onClick={() => aoMudar(o.valor)}
            className={cx(
              "flex flex-1 items-center justify-center gap-1.5 rounded-botao px-3 py-1.5 text-xs font-semibold transition-all",
              ativo ? "bg-superficie text-marca-forte shadow-card" : "text-texto-suave hover:text-texto",
            )}
          >
            {Ic && <Ic size={14} aria-hidden />}
            {o.rotulo}
          </button>
        );
      })}
    </div>
  );
}

// ─── Campos ─────────────────────────────────────────────────────────────────

const campoBase =
  "h-10 w-full rounded-campo border border-linha bg-superficie px-3 text-sm text-texto placeholder:text-texto-suave/70 transition-colors hover:border-marca/50 focus:border-marca focus:outline-none focus:ring-2 focus:ring-marca/20";

export function Rotulo({ children, htmlFor, dica }: { children: ReactNode; htmlFor?: string; dica?: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 flex items-baseline justify-between gap-2 text-xs font-semibold text-texto-suave">
      <span>{children}</span>
      {dica && <span className="font-medium">{dica}</span>}
    </label>
  );
}

/** Campo numérico que aceita vírgula. Mantém o texto enquanto a pessoa digita. */
function CampoNumericoBase({
  valor,
  aoMudar,
  paraTexto,
  deTexto,
  prefixo,
  sufixo,
  placeholder,
  id,
  rotulo,
  destaque,
  className,
  ariaLabel,
}: {
  valor: number | null;
  aoMudar: (v: number | null) => void;
  paraTexto: (v: number | null) => string;
  deTexto: (t: string) => number | null;
  prefixo?: string;
  sufixo?: string;
  placeholder?: string;
  id?: string;
  rotulo?: ReactNode;
  destaque?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const autoId = useId();
  const campoId = id ?? autoId;
  const [texto, setTexto] = useState(paraTexto(valor));
  const [foco, setFoco] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- espelha valor externo quando fora de foco
    if (!foco) setTexto(paraTexto(valor));
  }, [valor, foco, paraTexto]);
  return (
    <div className={className}>
      {rotulo && <Rotulo htmlFor={campoId}>{rotulo}</Rotulo>}
      <div className="relative">
        {prefixo && <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-xs font-semibold text-texto-suave">{prefixo}</span>}
        <input
          id={campoId}
          aria-label={ariaLabel}
          inputMode="decimal"
          className={cx(campoBase, "numero", prefixo && "pl-9", sufixo && "pr-9", destaque && "border-aviso bg-aviso-suave/40")}
          value={texto}
          placeholder={placeholder}
          onFocus={() => setFoco(true)}
          onBlur={() => {
            setFoco(false);
            setTexto(paraTexto(valor));
          }}
          onChange={(e) => {
            setTexto(e.target.value);
            aoMudar(deTexto(e.target.value));
          }}
        />
        {sufixo && <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs font-semibold text-texto-suave">{sufixo}</span>}
      </div>
    </div>
  );
}

type PropsCampo = {
  valor: number | null;
  aoMudar: (v: number | null) => void;
  placeholder?: string;
  rotulo?: ReactNode;
  id?: string;
  destaque?: boolean;
  className?: string;
  ariaLabel?: string;
};

export function CampoMoeda(p: PropsCampo) {
  return <CampoNumericoBase {...p} prefixo="R$" paraTexto={moedaParaTexto} deTexto={lerMoeda} />;
}

export function CampoNumero(p: PropsCampo & { sufixo?: string }) {
  return <CampoNumericoBase {...p} paraTexto={numeroParaTexto} deTexto={lerNumero} />;
}

export function CampoPct(p: PropsCampo) {
  return <CampoNumericoBase {...p} sufixo="%" paraTexto={numeroParaTexto} deTexto={lerNumero} />;
}

export function CampoTexto({
  valor,
  aoMudar,
  placeholder,
  rotulo,
  className,
  ariaLabel,
}: {
  valor: string;
  aoMudar: (v: string) => void;
  placeholder?: string;
  rotulo?: ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  const id = useId();
  return (
    <div className={className}>
      {rotulo && <Rotulo htmlFor={id}>{rotulo}</Rotulo>}
      <input id={id} aria-label={ariaLabel} className={campoBase} value={valor} placeholder={placeholder} onChange={(e) => aoMudar(e.target.value)} />
    </div>
  );
}

export function Selecao({
  valor,
  aoMudar,
  opcoes,
  vazio,
  rotulo,
  className,
  ariaLabel,
}: {
  valor: string | null;
  aoMudar: (v: string | null) => void;
  opcoes: { valor: string; rotulo: string; grupo?: string }[];
  vazio?: string;
  rotulo?: ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  const id = useId();
  const grupos = [...new Set(opcoes.map((o) => o.grupo))];
  const temGrupos = grupos.some((g) => g != null);
  return (
    <div className={className}>
      {rotulo && <Rotulo htmlFor={id}>{rotulo}</Rotulo>}
      <div className="relative">
        <select
          id={id}
          aria-label={ariaLabel}
          className={cx(campoBase, "cursor-pointer appearance-none pr-8")}
          value={valor ?? ""}
          onChange={(e) => aoMudar(e.target.value === "" ? null : e.target.value)}
        >
          {vazio !== undefined && <option value="">{vazio}</option>}
          {temGrupos
            ? grupos.map((g) => (
                <optgroup key={g ?? "-"} label={g ?? "Sem serviço"}>
                  {opcoes
                    .filter((o) => o.grupo === g)
                    .map((o) => (
                      <option key={o.valor} value={o.valor}>
                        {o.rotulo}
                      </option>
                    ))}
                </optgroup>
              ))
            : opcoes.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.rotulo}
                </option>
              ))}
        </select>
        <ChevronDown size={16} strokeWidth={2.5} className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-marca" aria-hidden />
      </div>
    </div>
  );
}

export function Passo({ valor, aoMudar, ariaLabel }: { valor: number | null; aoMudar: (v: number | null) => void; ariaLabel: string }) {
  const v = valor ?? 0;
  return (
    <div className="inline-flex h-10 items-center rounded-botao border border-linha bg-superficie">
      <button type="button" aria-label={`Menos ${ariaLabel}`} className="flex size-9 items-center justify-center rounded-botao text-texto-suave hover:bg-superficie-2 hover:text-texto" onClick={() => aoMudar(Math.max(0, v - 1))}>
        <Minus size={14} />
      </button>
      <input
        aria-label={ariaLabel}
        inputMode="numeric"
        className="numero w-10 bg-transparent text-center text-sm font-semibold focus:outline-none"
        value={valor == null ? "" : String(valor).replace(".", ",")}
        placeholder="0"
        onChange={(e) => aoMudar(lerNumero(e.target.value))}
      />
      <button type="button" aria-label={`Mais ${ariaLabel}`} className="flex size-9 items-center justify-center rounded-botao text-texto-suave hover:bg-superficie-2 hover:text-texto" onClick={() => aoMudar(v + 1)}>
        <Plus size={14} />
      </button>
    </div>
  );
}

export function Interruptor({ ligado, aoMudar, rotulo }: { ligado: boolean; aoMudar: (v: boolean) => void; rotulo: string }) {
  return (
    <button type="button" role="switch" aria-checked={ligado} onClick={() => aoMudar(!ligado)} className="inline-flex items-center gap-2 text-left text-xs font-semibold text-texto-suave">
      <span className={cx("relative h-5 w-9 shrink-0 rounded-full transition-colors", ligado ? "bg-marca" : "bg-linha")}>
        <span className={cx("absolute top-0.5 size-4 rounded-full bg-superficie shadow transition-all", ligado ? "left-[18px]" : "left-0.5")} />
      </span>
      {rotulo}
    </button>
  );
}

export function Vazio({ icone: Icone, titulo, children }: { icone: LucideIcon; titulo: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-card border border-dashed border-linha bg-marca-tinta/50 px-6 py-8 text-center">
      <span className="flex size-12 items-center justify-center rounded-bloco bg-marca-suave text-marca-forte">
        <Icone size={22} />
      </span>
      <p className="text-sm font-semibold">{titulo}</p>
      {children && <div className="max-w-sm text-xs text-texto-suave">{children}</div>}
    </div>
  );
}

/** Forma orgânica decorativa (não é conteúdo). */
export function Forma({ className, variante = 1 }: { className?: string; variante?: 1 | 2 | 3 }) {
  const d = {
    1: "M44.7,-58.3C57.1,-49.7,66.2,-36.1,70.6,-21C75,-5.9,74.7,10.8,68.4,24.8C62.1,38.8,49.8,50.2,35.7,58.3C21.6,66.4,5.7,71.2,-10.8,70.1C-27.3,69,-44.5,62,-56.4,49.6C-68.3,37.2,-75,19.4,-74.4,2.2C-73.8,-15,-65.9,-31.6,-54,-40.6C-42.1,-49.6,-26.2,-51,-11.6,-56.3C3,-61.6,32.3,-66.9,44.7,-58.3Z",
    2: "M38.4,-47.9C50.2,-36.9,60.3,-24.5,63.7,-10.1C67.1,4.3,63.8,20.7,54.8,32.6C45.8,44.5,31.1,51.9,15.6,57.1C0.1,62.3,-16.2,65.3,-30.5,59.9C-44.8,54.5,-57.1,40.7,-63.4,24.6C-69.7,8.5,-70,-9.9,-63.1,-24.6C-56.2,-39.3,-42.1,-50.3,-27.9,-60.6C-13.7,-70.9,0.6,-80.5,13.4,-77.7C26.2,-74.9,26.6,-58.9,38.4,-47.9Z",
    3: "M51.1,-62.2C63.3,-49.9,68.2,-31,69.8,-12.8C71.4,5.4,69.7,22.9,61.1,36.4C52.5,49.9,37,59.4,20.2,64.9C3.4,70.4,-14.7,71.9,-31.7,66.2C-48.7,60.5,-64.6,47.6,-71.2,31C-77.8,14.4,-75.1,-5.9,-67.3,-22.6C-59.5,-39.3,-46.6,-52.4,-32.2,-64.1C-17.8,-75.8,-1.9,-86.1,13.6,-83.9C29.1,-81.7,38.9,-74.5,51.1,-62.2Z",
  }[variante];
  return (
    <svg viewBox="-100 -100 200 200" className={cx("pointer-events-none absolute", className)} aria-hidden>
      <path d={d} fill="currentColor" />
    </svg>
  );
}
