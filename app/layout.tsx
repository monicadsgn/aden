import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ProvedorDados } from "@/lib/dados/contexto";

export const metadata: Metadata = {
  title: "Aden · Gestão",
  description: "Sistema de gestão da Aden — assessoria de marketing e performance",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#797c46",
};

// aplica o tema salvo antes da pintura, evitando piscar
const scriptTema = `try{var t=localStorage.getItem("aden:tema");if(t)document.documentElement.dataset.tema=t}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptTema }} />
      </head>
      <body className="min-h-screen antialiased">
        <ProvedorDados>{children}</ProvedorDados>
      </body>
    </html>
  );
}
