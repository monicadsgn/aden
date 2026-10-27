// Pedaços do servidor que o quiz público usa em mais de uma rota (/api/quiz e /api/quiz/config).
import "server-only";
import { createClient } from "@supabase/supabase-js";

export function ler(nome: string): string | null {
  return process.env[nome]?.trim() || null;
}

/** Conexão do quiz com o banco: só a chave pública; quem protege são as funções do banco e o segredo da rota. */
export function banco() {
  const url = ler("NEXT_PUBLIC_SUPABASE_URL") ?? ler("SUPABASE_URL");
  const chave = ler("NEXT_PUBLIC_SUPABASE_ANON_KEY") ?? ler("SUPABASE_ANON_KEY");
  if (!url || !chave) return null;
  return createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
