// Logo da Aden: só a tipografia "aden" (identidade aprovada em 30/09/2026). Cor pela classe (text-marca no claro,
// clareia sozinha no modo escuro). Os caminhos vêm do SVG original da marca.
import { LOGO_ADEN } from "@/lib/documentos/logo";

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
