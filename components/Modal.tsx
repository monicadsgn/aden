"use client";

// Janela por cima da tela (padrão do SoftMoni):
// - Esc fecha; clicar fora fecha só se o clique COMEÇOU fora (arrastar uma seleção não fecha)
// - no celular sobe de baixo (folha); na tela grande fica no centro
// - `expandivel`: botão para ocupar a tela inteira

import { Maximize2, Minimize2, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cx } from "./ui";

export function Modal({
  aberto,
  aoFechar,
  titulo,
  subtitulo,
  children,
  rodape,
  largura = "md",
  expandivel,
  acoesTopo,
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo?: ReactNode;
  subtitulo?: ReactNode;
  children: ReactNode;
  rodape?: ReactNode;
  largura?: "sm" | "md" | "lg";
  expandivel?: boolean;
  acoesTopo?: ReactNode;
}) {
  const [cheia, setCheia] = useState(false);
  const comecouFora = useRef(false);
  const idTitulo = useId();
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && aoFechar();
    window.addEventListener("keydown", tecla);
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    caixa.current?.focus();
    return () => {
      window.removeEventListener("keydown", tecla);
      document.body.style.overflow = antes;
    };
  }, [aberto, aoFechar]);

  if (!aberto) return null;
  const larguras = { sm: "sm:max-w-md", md: "sm:max-w-xl", lg: "sm:max-w-3xl" };

  return (
    <div
      className={cx("fixed inset-0 z-50 flex bg-texto/40 backdrop-blur-[2px]", cheia ? "items-stretch" : "items-end sm:items-center sm:justify-center sm:p-4")}
      onMouseDown={(e) => (comecouFora.current = e.target === e.currentTarget)}
      onClick={(e) => {
        if (comecouFora.current && e.target === e.currentTarget) aoFechar();
      }}
    >
      <div
        ref={caixa}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titulo ? idTitulo : undefined}
        className={cx(
          "sem-contorno flex w-full flex-col bg-superficie shadow-forte outline-none",
          cheia ? "h-full" : cx("max-h-[88vh] rounded-t-card sm:rounded-card", larguras[largura]),
        )}
      >
        <div className="flex items-start gap-2 border-b border-linha px-5 pt-4 pb-3">
          <div className="min-w-0 flex-1">
            {titulo && (
              <h2 id={idTitulo} className="text-base leading-snug font-bold">
                {titulo}
              </h2>
            )}
            {subtitulo && <div className="mt-0.5 text-xs text-texto-suave">{subtitulo}</div>}
          </div>
          {acoesTopo}
          {expandivel && (
            <button
              type="button"
              className="flex size-8 items-center justify-center rounded-item text-texto-suave hover:bg-superficie-2 hover:text-texto"
              aria-label={cheia ? "Voltar ao tamanho normal" : "Abrir em tela cheia"}
              title={cheia ? "Voltar ao tamanho normal" : "Abrir em tela cheia"}
              onClick={() => setCheia(!cheia)}
            >
              {cheia ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          )}
          <button
            type="button"
            className="flex size-8 items-center justify-center rounded-item text-texto-suave hover:bg-superficie-2 hover:text-texto"
            aria-label="Fechar"
            onClick={aoFechar}
          >
            <X size={17} />
          </button>
        </div>
        <div className={cx("min-h-0 flex-1 overflow-y-auto px-5 py-4", cheia && "mx-auto w-full max-w-4xl")}>{children}</div>
        {rodape && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-linha px-5 py-3">{rodape}</div>}
      </div>
    </div>
  );
}
