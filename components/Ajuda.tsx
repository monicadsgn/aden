"use client";

// Ajuda dentro do sistema: botão "?" de cada tela e tour de primeira vez.
// Textos em lib/ajuda.ts.

import { ArrowLeft, ArrowRight, BookOpen, HelpCircle } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AJUDA_TELAS, termo, TOUR } from "@/lib/ajuda";
import { useDados } from "@/lib/dados/contexto";
import { Modal } from "./Modal";
import { Botao, cx } from "./ui";

/** Botão "?" no cabeçalho: pra que serve a tela e quando usar. */
export function BotaoAjudaTela() {
  const caminho = usePathname();
  const [aberto, setAberto] = useState(false);
  const ajuda = AJUDA_TELAS[caminho];
  if (!ajuda) return null;
  return (
    <>
      <button
        type="button"
        className="nao-imprimir flex size-10 shrink-0 items-center justify-center rounded-full border border-linha bg-superficie text-texto-suave hover:border-marca hover:text-marca-forte"
        aria-label={`Ajuda: ${ajuda.titulo}`}
        title="Pra que serve esta tela?"
        onClick={() => setAberto(true)}
      >
        <HelpCircle size={19} />
      </button>
      <Modal aberto={aberto} aoFechar={() => setAberto(false)} titulo={ajuda.titulo} largura="sm">
        <p className="text-sm leading-relaxed">{ajuda.texto}</p>
        {ajuda.termos && ajuda.termos.length > 0 && (
          <div className="mt-4 border-t border-linha pt-3">
            <p className="mb-2 text-[11px] font-bold tracking-wide text-texto-suave uppercase">Palavras desta tela</p>
            <div className="flex flex-col gap-2">
              {ajuda.termos.map((id) => {
                const t = termo(id);
                return t ? (
                  <p key={id} className="text-[13px] leading-snug">
                    <strong>{t.termo}:</strong> {t.frase}
                  </p>
                ) : null;
              })}
            </div>
            <Link href="/glossario" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-marca-forte underline" onClick={() => setAberto(false)}>
              <BookOpen size={12} /> Ver o glossário completo
            </Link>
          </div>
        )}
      </Modal>
    </>
  );
}

const EVENTO_TOUR = "aden:tour";
export const abrirTour = () => window.dispatchEvent(new Event(EVENTO_TOUR));
const chaveTour = (usuario: string) => `aden:tour-visto:v2:${usuario}`;

/** Tour de primeira vez: abre sozinho na primeira entrada; pode pular e rever pelo menu. */
export function Tour() {
  const { usuario } = useDados();
  const [aberto, setAberto] = useState(false);
  const [passo, setPasso] = useState(0);
  const id = usuario?.id;

  useEffect(() => {
    if (!id || usuario?.papel !== "admin") return;
    let visto = true;
    try {
      visto = localStorage.getItem(chaveTour(id)) === "1";
    } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect -- primeira visita lida do navegador
    if (!visto) setAberto(true);
  }, [id, usuario?.papel]);

  useEffect(() => {
    const abrir = () => {
      setPasso(0);
      setAberto(true);
    };
    window.addEventListener(EVENTO_TOUR, abrir);
    return () => window.removeEventListener(EVENTO_TOUR, abrir);
  }, []);

  const fechar = () => {
    setAberto(false);
    try {
      if (id) localStorage.setItem(chaveTour(id), "1");
    } catch {}
  };

  const p = TOUR[passo];
  const ultimo = passo === TOUR.length - 1;
  return (
    <Modal
      aberto={aberto}
      aoFechar={fechar}
      largura="sm"
      titulo={p.titulo}
      subtitulo={`${passo + 1} de ${TOUR.length}`}
      rodape={
        <>
          <Botao variante="fantasma" pequeno className="mr-auto" onClick={fechar}>
            {ultimo ? "Fechar" : "Pular"}
          </Botao>
          {passo > 0 && (
            <Botao pequeno icone={ArrowLeft} onClick={() => setPasso(passo - 1)}>
              Voltar
            </Botao>
          )}
          <Botao pequeno variante="primario" onClick={() => (ultimo ? fechar() : setPasso(passo + 1))}>
            {ultimo ? "Entendi" : "Próximo"} {!ultimo && <ArrowRight size={14} />}
          </Botao>
        </>
      }
    >
      <p className="text-sm leading-relaxed">{p.texto}</p>
      <div className="mt-5 flex justify-center gap-1.5" aria-hidden>
        {TOUR.map((_, i) => (
          <span key={i} className={cx("h-1.5 rounded-full transition-all", i === passo ? "w-6 bg-marca" : "w-1.5 bg-linha")} />
        ))}
      </div>
    </Modal>
  );
}
