import type { Metadata } from "next";
import type { ReactNode } from "react";

// Painel do cliente: página pública (o link é o acesso). Não aparece em buscadores.
export const metadata: Metadata = {
  title: "Painel do cliente · Aden",
  description: "Acompanhe e aprove as peças da Aden.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function LayoutPainel({ children }: { children: ReactNode }) {
  return children;
}
