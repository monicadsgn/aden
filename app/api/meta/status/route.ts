// Conexão com a Meta, etapa 1 (só leitura). GET /api/meta/status lista o que o acesso da Aden enxerga;
// GET /api/meta/status?clienteId=… confere um cliente e grava o estado dele. Só sócio.
// Chave geral: META_CONEXAO_ATIVA=1 na Vercel. Desligada, responde { ativo: false, motivo: "desligado" } e não faz mais nada.
// O token da Meta mora só na Vercel (META_ACCESS_TOKEN) e nunca vai na resposta nem no log.

import "server-only";
import { RepositorioSupabase } from "@/lib/dados/supabase";
import { conferirConexaoMeta } from "@/lib/meta/conferir";
import { conexaoMetaLigada } from "@/lib/meta/graph";

const ler = (nome: string) => process.env[nome]?.trim() || null;
const semCache = { "Cache-Control": "no-store" };

export async function GET(req: Request) {
  if (!conexaoMetaLigada()) return Response.json({ ativo: false, motivo: "desligado" }, { headers: semCache });

  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const url = ler("NEXT_PUBLIC_SUPABASE_URL") ?? ler("SUPABASE_URL");
  const chave = ler("NEXT_PUBLIC_SUPABASE_ANON_KEY") ?? ler("SUPABASE_ANON_KEY");
  if (!token || !url || !chave) return Response.json({ erro: "Entre no Aden de novo." }, { status: 401, headers: semCache });

  const repo = new RepositorioSupabase(url, chave, { servidor: true, tokenAcesso: token });
  const eu = await repo.usuarioAtual();
  if (!eu) return Response.json({ erro: "Entre no Aden de novo." }, { status: 401, headers: semCache });
  if (eu.papel !== "admin") return Response.json({ erro: "Só os sócios conferem a conexão com a Meta." }, { status: 403, headers: semCache });

  const clienteId = new URL(req.url).searchParams.get("clienteId")?.trim() || undefined;
  if (clienteId && !/^[0-9a-f-]{36}$/i.test(clienteId)) return Response.json({ erro: "Cliente inválido." }, { status: 400, headers: semCache });

  try {
    return Response.json(await conferirConexaoMeta(repo, clienteId), { headers: semCache });
  } catch (e) {
    return Response.json({ erro: e instanceof Error ? e.message : "Não deu para conferir." }, { status: 400, headers: semCache });
  }
}
