// Aviso diário ao cliente (peça nova para aprovar ou ajuste pronto). A Vercel chama esta rota de manhã (vercel.json)
// com o segredo CRON_SECRET. Sem segredo certo, nada acontece. O banco só entrega a lista se o mesmo segredo bater.

import "server-only";
import { createClient } from "@supabase/supabase-js";
import { enviarAvisosDoDia, type PendenteDoBanco } from "@/lib/email/avisosDoDia";
import { criarEnvio, gmailConfigurado } from "@/lib/email/gmail";

export const dynamic = "force-dynamic";

const ler = (nome: string) => process.env[nome]?.trim() || null;

export async function GET(req: Request) {
  const segredo = ler("CRON_SECRET");
  const enviado = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!segredo || enviado !== segredo) return Response.json({ erro: "Sem permissão." }, { status: 401 });

  const url = ler("NEXT_PUBLIC_SUPABASE_URL") ?? ler("SUPABASE_URL");
  const chave = ler("NEXT_PUBLIC_SUPABASE_ANON_KEY") ?? ler("SUPABASE_ANON_KEY");
  if (!url || !chave) return Response.json({ erro: "Banco não configurado." }, { status: 503 });
  if (!gmailConfigurado()) return Response.json({ erro: "O Gmail da Aden ainda não foi ligado na Vercel." }, { status: 503 });

  const sb = createClient(url, chave, { auth: { persistSession: false } });
  const urlBase = ler("AVISO_URL_BASE") ?? `https://${req.headers.get("host")}`;
  const hoje = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());

  const r = await enviarAvisosDoDia({
    urlBase,
    hoje,
    enviar: criarEnvio(),
    buscar: async () => {
      const { data, error } = await sb.rpc("avisos_cliente_pendentes", { p_segredo: segredo });
      if (error) throw new Error(error.message);
      return (data ?? []) as PendenteDoBanco[];
    },
    marcar: async (clienteId, ate) => {
      const { error } = await sb.rpc("avisos_cliente_marcar", { p_segredo: segredo, p_cliente: clienteId, p_ate: ate });
      if (error) throw new Error(error.message);
    },
  });
  return Response.json(r);
}
