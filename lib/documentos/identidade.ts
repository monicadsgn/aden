// Identidade provisória da Aden nos PDFs gerados (contrato, onboarding). Espelho de app/tokens.css (modo claro):
// o PDF não lê CSS, então as cores ficam aqui e um teste confere que batem com os tokens. Trocar a paleta =
// trocar tokens.css e estes valores juntos (o teste avisa se esquecer).

export const IDENTIDADE_PDF = {
  marca: "#797c46",
  marcaForte: "#5c5f33",
  marcaTinta: "#f2f2e6",
  destaque: "#c9a86a",
  fundo: "#fcf9f1",
  linha: "#e7e1cf",
  texto: "#2a2b1e",
  textoSuave: "#6b6c58",
} as const;

/** nome dos tokens em app/tokens.css */
export const TOKEN_CSS: Record<keyof typeof IDENTIDADE_PDF, string> = {
  marca: "--marca",
  marcaForte: "--marca-forte",
  marcaTinta: "--marca-tinta",
  destaque: "--destaque",
  fundo: "--fundo",
  linha: "--linha",
  texto: "--texto",
  textoSuave: "--texto-suave",
};
