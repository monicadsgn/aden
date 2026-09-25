"use client";

// Base dos PDFs: página limpa, só com os tokens de app/tokens.css (cores e fonte trocam
// junto com a identidade). "Salvar em PDF" usa a impressão do navegador; o nome do
// arquivo sai do título da página (tipo_cliente_mês-ano).

import { ArrowLeft, FileDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useDados } from "@/lib/dados/contexto";
import { Marca } from "../Marca";
import { cx } from "../ui";

export function GuardaImpressao({ children }: { children: ReactNode }) {
  const { repo, usuario, carregando } = useDados();
  const router = useRouter();
  useEffect(() => {
    if (!carregando && repo.modo === "supabase" && !usuario) router.replace("/entrar");
  }, [carregando, usuario, repo.modo, router]);
  if (carregando || (repo.modo === "supabase" && !usuario)) return null;
  return <>{children}</>;
}

export function Documento({ arquivo, children }: { arquivo: string; children: ReactNode }) {
  const router = useRouter();
  useEffect(() => {
    const antes = document.title;
    document.title = arquivo;
    return () => {
      document.title = antes;
    };
  }, [arquivo]);
  return (
    <div className="min-h-screen bg-superficie-2 print:bg-superficie">
      <div className="nao-imprimir sticky top-0 z-10 flex items-center gap-2 border-b border-linha bg-fundo/95 px-4 py-3 backdrop-blur">
        <button type="button" onClick={() => router.back()} className="inline-flex h-9 items-center gap-1.5 rounded-botao px-3 text-sm font-semibold hover:bg-superficie-2">
          <ArrowLeft size={16} /> Voltar
        </button>
        <span className="flex-1 truncate text-xs text-texto-suave">Arquivo: {arquivo}.pdf</span>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex h-9 items-center gap-1.5 rounded-botao bg-marca px-4 text-sm font-semibold text-sobre-marca hover:bg-marca-forte"
        >
          <FileDown size={16} /> Salvar em PDF
        </button>
      </div>
      <article className="documento mx-auto my-6 flex max-w-[800px] flex-col gap-8 bg-superficie px-10 py-12 shadow-card print:my-0 print:max-w-none print:px-0 print:py-0 print:shadow-none">
        {children}
      </article>
    </div>
  );
}

export function Capa({ tipo, titulo, sub }: { tipo: string; titulo: string; sub: string }) {
  return (
    <header className="flex flex-col gap-6 border-b border-linha pb-8">
      <Marca />
      <div>
        <p className="text-xs font-bold tracking-[0.18em] text-marca-forte uppercase">{tipo}</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight">{titulo}</h1>
        <p className="mt-1 text-sm text-texto-suave">{sub}</p>
      </div>
    </header>
  );
}

export function BlocoDoc({ titulo, children, className }: { titulo: string; children: ReactNode; className?: string }) {
  return (
    <section className={cx("break-inside-avoid", className)}>
      <h2 className="mb-3 text-xs font-bold tracking-[0.14em] text-texto-suave uppercase">{titulo}</h2>
      {children}
    </section>
  );
}

export function NumeroGrande({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className={cx("rounded-bloco p-5", destaque ? "bg-marca text-sobre-marca" : "bg-marca-tinta")}>
      <p className={cx("text-xs font-semibold", destaque ? "opacity-85" : "text-texto-suave")}>{rotulo}</p>
      <p className="numero mt-1 text-3xl font-extrabold tracking-tight">{valor}</p>
    </div>
  );
}

export function LinhaDoc({ rotulo, valor, forte }: { rotulo: ReactNode; valor: ReactNode; forte?: boolean }) {
  return (
    <div className={cx("flex items-baseline justify-between gap-4 border-b border-linha py-2 text-sm last:border-0", forte && "font-bold")}>
      <span>{rotulo}</span>
      <span className="numero whitespace-nowrap">{valor}</span>
    </div>
  );
}
