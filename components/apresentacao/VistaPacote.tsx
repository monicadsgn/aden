// Pacote fechado na tela do cliente. Recebe só a VistaPacote (nada interno).
// Sem "personalizar": nome, frases e valores. Personalizando: + e − por entrega e a
// diferença em relação ao pacote original.

import { Check, Minus, Plus, SlidersHorizontal } from "lucide-react";
import type { VistaPacote } from "@/lib/calculo/apresentacao";
import type { Id } from "@/lib/calculo/tipos";
import { formatarMoeda } from "@/lib/formato";
import { cx } from "../ui";
import { SinalDiscreto } from "./VistaCliente";

export function VistaPacoteCliente({
  vista,
  personalizando,
  aoPersonalizar,
  aoMudarQuantidade,
}: {
  vista: VistaPacote;
  personalizando?: boolean;
  aoPersonalizar?: () => void;
  aoMudarQuantidade?: (tipoId: Id, delta: number) => void;
}) {
  const dif = vista.diferencaMensalCentavos;
  return (
    <div className="flex flex-col gap-4">
      <section className="relative overflow-hidden rounded-card bg-marca p-6 text-sobre-marca shadow-forte">
        <span className="absolute top-4 right-4">
          <SinalDiscreto sinal={vista.sinal} />
        </span>
        <p className="text-xs font-bold tracking-[0.14em] uppercase opacity-80">Pacote</p>
        <h2 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">{vista.nome}</h2>
        {vista.descricao && <p className="mt-2 max-w-2xl text-sm opacity-90">{vista.descricao}</p>}
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-bold tracking-wide uppercase opacity-80">Investimento mensal</p>
            <p className="numero text-5xl font-extrabold tracking-tight">{vista.mensalCentavos != null ? formatarMoeda(vista.mensalCentavos) : "—"}</p>
            {dif != null && dif !== 0 && (
              <p className="mt-1 inline-flex rounded-botao bg-sobre-marca/20 px-2.5 py-0.5 text-xs font-bold">
                {dif > 0 ? "+" : "−"} {formatarMoeda(Math.abs(dif))} em relação ao pacote
              </p>
            )}
          </div>
          <div>
            <p className="text-xs font-bold tracking-wide uppercase opacity-80">Primeiro mês</p>
            <p className="numero text-3xl font-extrabold tracking-tight">
              {vista.entradaAConfirmar ? "a combinar" : vista.entradaCentavos != null && vista.entradaCentavos > 0 ? formatarMoeda(vista.entradaCentavos) : "—"}
            </p>
            <p className="mt-1 text-xs opacity-85">Uma vez só: a estrutura para começar (onboarding, perfil e identidade).</p>
          </div>
        </div>
      </section>

      <section className="rounded-card border border-linha bg-superficie p-5 shadow-card">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h3 className="flex-1 text-lg font-bold">O que está incluso</h3>
          {aoPersonalizar && (
            <button
              type="button"
              onClick={aoPersonalizar}
              className={cx(
                "inline-flex items-center gap-1.5 rounded-botao px-4 py-2 text-sm font-semibold transition-colors",
                personalizando ? "bg-marca text-sobre-marca" : "border border-linha bg-superficie hover:bg-superficie-2",
              )}
            >
              <SlidersHorizontal size={15} /> {personalizando ? "Pronto" : "Personalizar"}
            </button>
          )}
        </div>
        {!personalizando ? (
          <ul className="flex flex-col gap-2">
            {vista.frases.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-[15px]">
                <Check size={18} className="mt-0.5 shrink-0 text-marca-forte" aria-hidden />
                <span>{f}</span>
              </li>
            ))}
            {vista.frases.length === 0 && <li className="text-sm text-texto-suave">—</li>}
          </ul>
        ) : (
          <ul className="flex flex-col gap-2">
            {vista.itens.map((i) => (
              <li key={i.tipoEntregaId} className="flex items-center gap-3 rounded-bloco bg-superficie-2/60 px-3 py-2">
                <span className="min-w-0 flex-1 text-[15px] font-semibold">{i.nome}</span>
                <button
                  type="button"
                  aria-label={`Menos ${i.nome}`}
                  disabled={i.quantidade <= 0}
                  onClick={() => aoMudarQuantidade?.(i.tipoEntregaId, -1)}
                  className="flex size-11 items-center justify-center rounded-full border border-linha bg-superficie text-texto hover:bg-superficie-2 disabled:opacity-30"
                >
                  <Minus size={20} />
                </button>
                <span className="numero w-10 text-center text-2xl font-extrabold">{i.quantidade}</span>
                <button
                  type="button"
                  aria-label={`Mais ${i.nome}`}
                  onClick={() => aoMudarQuantidade?.(i.tipoEntregaId, 1)}
                  className="flex size-11 items-center justify-center rounded-full bg-marca text-sobre-marca hover:bg-marca-forte"
                >
                  <Plus size={20} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Primeiro passo da negociação: escolher um pacote. */
export function EscolherPacote({
  pacotes,
  aoEscolher,
  aoMontarDoZero,
}: {
  pacotes: { id: Id; nome: string; descricao: string; frases: string[]; mensalCentavos: number | null }[];
  aoEscolher: (id: Id) => void;
  aoMontarDoZero: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-2xl font-extrabold tracking-tight">Escolha um pacote</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {pacotes.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => aoEscolher(p.id)}
            className="flex flex-col gap-3 rounded-card border border-linha bg-superficie p-5 text-left shadow-card transition-colors hover:border-marca"
          >
            <span className="text-xl font-bold">{p.nome}</span>
            {p.descricao && <span className="text-sm text-texto-suave">{p.descricao}</span>}
            <ul className="flex flex-col gap-1">
              {p.frases.map((f) => (
                <li key={f} className="flex items-start gap-2 text-[13px]">
                  <Check size={15} className="mt-0.5 shrink-0 text-marca-forte" aria-hidden /> {f}
                </li>
              ))}
            </ul>
            <span className="numero mt-auto text-3xl font-extrabold">
              {p.mensalCentavos != null ? formatarMoeda(p.mensalCentavos) : "—"}
              <span className="text-sm font-semibold text-texto-suave"> /mês</span>
            </span>
          </button>
        ))}
      </div>
      <button type="button" onClick={aoMontarDoZero} className="self-start text-sm font-semibold text-texto-suave underline hover:text-texto">
        Montar do zero, entrega por entrega
      </button>
    </div>
  );
}
