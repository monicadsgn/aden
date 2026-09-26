"use client";

// Avatar de sócio: foto de perfil, ou a inicial do nome quando não há foto.

import { Camera, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { useDados } from "@/lib/dados/contexto";
import { reduzirFoto, tipoDeFotoAceito } from "@/lib/imagem";
import { cx } from "./ui";

type Tamanho = "sm" | "md" | "lg" | "xl";
const TAMANHO: Record<Tamanho, string> = {
  sm: "size-6 text-[11px]",
  md: "size-8 text-xs",
  lg: "size-9 text-sm",
  xl: "size-16 text-xl",
};

export function Avatar({
  nome,
  foto,
  tamanho = "md",
  tom = "marca",
  className,
}: {
  nome: string | null | undefined;
  foto?: string | null;
  tamanho?: Tamanho;
  tom?: "marca" | "suave";
  className?: string;
}) {
  const [falhou, setFalhou] = useState<string | null>(null);
  const mostrarFoto = !!foto && falhou !== foto;
  return (
    <span
      className={cx(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold",
        TAMANHO[tamanho],
        tom === "marca" ? "bg-marca text-sobre-marca" : "bg-marca-suave text-marca-forte",
        className,
      )}
    >
      {mostrarFoto ? (
        // eslint-disable-next-line @next/next/no-img-element -- foto pequena vinda do Storage; não precisa do otimizador
        <img src={foto} alt={nome ? `Foto de ${nome}` : "Foto de perfil"} className="size-full object-cover" onError={() => setFalhou(foto)} />
      ) : (
        (nome || "?").trim().slice(0, 1).toUpperCase() || "?"
      )}
    </span>
  );
}

/**
 * Avatar que troca de foto ao clicar. A imagem é cortada no quadrado e reduzida
 * no navegador antes de subir.
 */
export function TrocarFoto({
  pessoaId,
  nome,
  foto,
  tamanho = "xl",
  tom = "marca",
  aoTrocar,
  comTexto = true,
}: {
  pessoaId: string;
  nome: string | null | undefined;
  foto: string | null | undefined;
  tamanho?: Tamanho;
  tom?: "marca" | "suave";
  aoTrocar: (url: string | null) => void;
  comTexto?: boolean;
}) {
  const { repo } = useDados();
  const entrada = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [erroFoto, setErroFoto] = useState<string | null>(null);

  async function enviar(arquivo: File | null) {
    setErroFoto(null);
    if (!arquivo && !foto) return;
    if (arquivo && !tipoDeFotoAceito(arquivo.type)) {
      setErroFoto("Esse arquivo não é uma imagem.");
      return;
    }
    setEnviando(true);
    try {
      const imagem = arquivo ? await reduzirFoto(arquivo) : null;
      aoTrocar(await repo.salvarFotoPessoa(pessoaId, imagem));
    } catch (e) {
      setErroFoto(e instanceof Error ? e.message : "Não deu para salvar a foto.");
    } finally {
      setEnviando(false);
      if (entrada.current) entrada.current.value = "";
    }
  }

  const botao = (
    <button
      type="button"
      className="group relative shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca"
      aria-label={foto ? `Trocar a foto de ${nome || "sócio"}` : `Colocar foto de ${nome || "sócio"}`}
      title={foto ? "Trocar foto" : "Colocar foto"}
      disabled={enviando}
      onClick={() => entrada.current?.click()}
    >
      <Avatar nome={nome} foto={foto} tamanho={tamanho} tom={tom} />
      <span
        className={cx(
          "absolute inset-0 flex items-center justify-center rounded-full bg-texto/45 text-superficie transition-opacity",
          enviando ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100",
        )}
        aria-hidden
      >
        {enviando ? <Loader2 size={16} className="animate-spin" /> : <Camera size={tamanho === "xl" ? 20 : 14} />}
      </span>
      <input
        ref={entrada}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void enviar(e.target.files?.[0] ?? null)}
      />
    </button>
  );

  if (!comTexto) return botao;
  return (
    <div className="flex items-center gap-3">
      {botao}
      <div className="flex min-w-0 flex-col items-start gap-0.5">
        <button type="button" className="text-xs font-semibold text-marca-forte hover:underline" onClick={() => entrada.current?.click()} disabled={enviando}>
          {enviando ? "Salvando…" : foto ? "Trocar foto" : "Colocar foto"}
        </button>
        {foto && !enviando && (
          <button type="button" className="text-[11px] text-texto-suave hover:text-erro hover:underline" onClick={() => void enviar(null)}>
            Tirar foto
          </button>
        )}
        {erroFoto && <span className="text-[11px] text-erro">{erroFoto}</span>}
      </div>
    </div>
  );
}
