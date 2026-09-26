import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import "./globals.css";
import { ProvedorDados, type ConexaoSupabase } from "@/lib/dados/contexto";

export const metadata: Metadata = {
  title: "Aden · Gestão",
  description: "A central da Aden: tarefas, calendário, comercial, financeiro e metas num lugar só",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

// aplica o tema salvo antes da pintura, evitando piscar
const scriptTema = `try{var t=localStorage.getItem("aden:tema");if(t)document.documentElement.dataset.tema=t}catch(e){}`;

// Lê a conexão do Supabase no servidor, A CADA ACESSO (não no build).
// A leitura por chave dinâmica impede o Next de congelar o valor no build;
// assim, trocar as variáveis na Vercel vale sem precisar reconstruir o site.
// Aceita os nomes NEXT_PUBLIC_SUPABASE_* ou SUPABASE_*.
// NEXT_PUBLIC_MODO_DEMO=1 força o modo demonstração (testes locais).
async function lerConexao(): Promise<ConexaoSupabase> {
  await connection();
  const env = process.env;
  // tolera espaço sobrando no NOME da variável (ex.: "NEXT_PUBLIC_SUPABASE_URL ")
  const porNome = new Map(Object.keys(env).map((k) => [k.trim(), env[k]]));
  const ler = (...nomes: string[]) => nomes.map((n) => porNome.get(n)?.trim()).find(Boolean) ?? null;
  if (ler("NEXT_PUBLIC_MODO_DEMO") === "1") return { url: null, chave: null, faltando: [] };
  const url = ler("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL");
  const chave = ler("NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY");
  if (!url || !chave) {
    // diagnóstico: só NOMES (entre aspas, para mostrar espaços), nunca valores
    const nomes = Object.keys(env).filter((k) => k.toUpperCase().includes("SUPABASE"));
    console.warn(`[aden] conexão Supabase incompleta. Variáveis com SUPABASE no nome: ${JSON.stringify(nomes)}`);
  }
  return {
    url,
    chave,
    faltando: [!url && "NEXT_PUBLIC_SUPABASE_URL", !chave && "NEXT_PUBLIC_SUPABASE_ANON_KEY"].filter(Boolean) as string[],
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const conexao = await lerConexao();
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptTema }} />
      </head>
      <body className="min-h-screen antialiased">
        <ProvedorDados conexao={conexao}>{children}</ProvedorDados>
      </body>
    </html>
  );
}
