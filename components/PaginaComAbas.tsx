"use client";

// Tela com abas (ex.: Mês, Pedidos e avisos). Cada aba é uma tela antiga aberta dentro desta:
// o cabeçalho dela some (fica só a linha de ações) e o "?" do topo explica a aba aberta.
// A aba fica no endereço (?aba=…), então links e o botão voltar do navegador funcionam.

import type { LucideIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, type ComponentType } from "react";
import { podeVer, type Area } from "@/lib/acesso";
import { useDados } from "@/lib/dados/contexto";
import { CabecalhoPagina, Embutida } from "./Shell";
import { cx } from "./ui";

export interface Aba {
  id: string;
  rotulo: string;
  icone: LucideIcon;
  area: Area;
  /** frase curta embaixo do título quando esta aba está aberta */
  descricao: string;
  conteudo: ComponentType;
}

interface Props {
  icone: LucideIcon;
  titulo: string;
  selo?: string;
  abas: Aba[];
  /** largura máxima do conteúdo das abas (classe Tailwind), para a barra de abas alinhar com ele */
  largura: string;
}

function Conteudo({ icone, titulo, selo, abas, largura }: Props) {
  const { usuario } = useDados();
  const router = useRouter();
  const caminho = usePathname();
  const params = useSearchParams();
  const visiveis = abas.filter((a) => !usuario || podeVer(usuario.papel, a.area));
  const atual = visiveis.find((a) => a.id === params.get("aba")) ?? visiveis[0];
  if (!atual) return null;
  const Tela = atual.conteudo;

  return (
    <div className="pb-16">
      <CabecalhoPagina icone={icone} selo={selo} titulo={titulo} descricao={atual.descricao} ajuda={`${caminho}#${atual.id}`} />
      <div className={cx("mx-auto px-4 pt-5 sm:px-6 lg:px-8", largura)}>
        <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label={`Abas de ${titulo}`}>
          {visiveis.map((a) => {
            const Ic = a.icone;
            const sel = a.id === atual.id;
            return (
              <button
                key={a.id}
                type="button"
                role="tab"
                aria-selected={sel}
                onClick={() => router.replace(`${caminho}?aba=${a.id}`, { scroll: false })}
                className={cx(
                  "flex shrink-0 items-center gap-1.5 rounded-botao border px-3.5 py-2 text-xs font-bold transition-all",
                  sel ? "border-marca bg-marca text-sobre-marca shadow-card" : "border-linha bg-superficie text-texto hover:border-marca/50",
                )}
              >
                <Ic size={14} />
                {a.rotulo}
              </button>
            );
          })}
        </div>
      </div>
      <Embutida.Provider value={largura}>
        <Tela key={atual.id} />
      </Embutida.Provider>
    </div>
  );
}

export function PaginaComAbas(props: Props) {
  return (
    <Suspense fallback={null}>
      <Conteudo {...props} />
    </Suspense>
  );
}
