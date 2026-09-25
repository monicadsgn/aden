"use client";

// Avisos acionáveis: cada um tem o botão que leva ao campo que resolve.
// Erro (resultado errado ou bloqueado) fica separado de lembrete (campo opcional vazio).

import { AlertOctagon, AlertTriangle, ArrowRight, BellDot, Info, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { Alerta } from "@/lib/calculo/tipos";
import { irParaBloco, linkDoDestino } from "@/lib/navegacao";
import { cx } from "./ui";

const ESTILO: Record<Alerta["nivel"], { icone: LucideIcon; caixa: string; rotulo: string }> = {
  erro: { icone: AlertOctagon, caixa: "bg-erro-suave text-erro", rotulo: "Resultado errado ou bloqueado" },
  aviso: { icone: AlertTriangle, caixa: "bg-aviso-suave text-aviso", rotulo: "Atenção" },
  lembrete: { icone: BellDot, caixa: "border border-dashed border-linha bg-superficie text-texto-suave", rotulo: "Lembrete" },
  info: { icone: Info, caixa: "bg-info-suave text-info", rotulo: "Observação" },
};

export function BotaoAcao({ a, pequeno }: { a: Alerta; pequeno?: boolean }) {
  if (!a.acao) return null;
  const href = linkDoDestino(a.acao.destino);
  const classe = cx(
    "inline-flex shrink-0 items-center gap-1 rounded-botao font-bold whitespace-nowrap transition-colors",
    pequeno ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]",
    a.nivel === "erro" ? "bg-erro text-superficie hover:opacity-90" : a.nivel === "aviso" ? "bg-aviso text-superficie hover:opacity-90" : "bg-superficie-2 text-texto hover:bg-linha",
  );
  const conteudo = (
    <>
      {a.acao.rotulo} <ArrowRight size={12} />
    </>
  );
  if (href)
    return (
      <Link href={href} className={classe}>
        {conteudo}
      </Link>
    );
  const d = a.acao.destino;
  return (
    <button type="button" className={classe} onClick={() => d.tipo === "cenario" && irParaBloco(d.bloco)}>
      {conteudo}
    </button>
  );
}

function Item({ a }: { a: Alerta }) {
  const s = ESTILO[a.nivel];
  const Ic = s.icone;
  return (
    <div className={cx("flex flex-wrap items-start gap-2 rounded-bloco px-3 py-2 text-xs leading-snug font-medium", s.caixa)}>
      <Ic size={15} className="mt-px shrink-0" aria-label={s.rotulo} />
      <span className="min-w-0 flex-1 basis-48">{a.texto}</span>
      <BotaoAcao a={a} />
    </div>
  );
}

export function ListaAlertas({ alertas }: { alertas: Alerta[] }) {
  const [verLembretes, setVerLembretes] = useState(false);
  const erros = alertas.filter((a) => a.nivel === "erro");
  const avisos = alertas.filter((a) => a.nivel === "aviso");
  const lembretes = alertas.filter((a) => a.nivel === "lembrete" || a.nivel === "info");
  if (!alertas.length) return null;
  return (
    <div className="flex flex-col gap-2">
      {erros.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="px-1 text-[10px] font-bold tracking-wide text-erro uppercase">Precisa resolver: o resultado está errado ou bloqueado</p>
          {erros.map((a) => (
            <Item key={a.texto} a={a} />
          ))}
        </div>
      )}
      {avisos.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="px-1 text-[10px] font-bold tracking-wide text-aviso uppercase">Atenção</p>
          {avisos.map((a) => (
            <Item key={a.texto} a={a} />
          ))}
        </div>
      )}
      {lembretes.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            className="self-start px-1 text-[11px] font-semibold text-texto-suave hover:text-texto"
            onClick={() => setVerLembretes(!verLembretes)}
          >
            {verLembretes ? "Esconder lembretes" : `${lembretes.length} lembrete(s): campos opcionais vazios, contados como zero`}
          </button>
          {verLembretes && lembretes.map((a) => <Item key={a.texto} a={a} />)}
        </div>
      )}
    </div>
  );
}
