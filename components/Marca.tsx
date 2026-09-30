// Logo da Aden: só a tipografia "aden" (identidade aprovada em 30/09/2026). Cor pela classe (text-marca no claro,
// clareia sozinha no modo escuro). Os caminhos vêm do SVG original da marca.
import { LETRA_A, LOGO_ADEN } from "@/lib/documentos/logo";

export function Marca({ compacta, className }: { compacta?: boolean; className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${LOGO_ADEN.largura} ${LOGO_ADEN.altura}`}
      role="img"
      aria-label="Aden"
      className={`${compacta ? "h-5" : "h-7"} w-auto fill-current ${className ?? "text-marca"}`}
    >
      {LOGO_ADEN.caminhos.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

/**
 * Ícone quadrado da Aden: só a letra "a" num retângulo arredondado, para o que é pequeno (carregamento, avatar da
 * marca). Padrão: "a" creme no verde; `invertido`: "a" verde no creme. Igual no claro e no escuro.
 */
export function MarcaIcone({ className, invertido }: { className?: string; invertido?: boolean }) {
  return (
    <span
      role="img"
      aria-label="Aden"
      className={`inline-flex shrink-0 items-center justify-center rounded-item ${invertido ? "bg-creme text-verde-aden" : "bg-verde-aden text-creme"} ${className ?? "size-10"}`}
    >
      <svg viewBox={`0 0 ${LETRA_A.largura} ${LETRA_A.altura}`} className="h-[58%] w-auto fill-current" aria-hidden>
        <path d={LETRA_A.caminho} />
      </svg>
    </span>
  );
}
