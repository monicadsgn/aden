// Métricas do Instagram (só leitura). GET /api/meta/metricas?clienteId=…&dias=28. Só sócio, sessão no cabeçalho.
// Chave geral: META_CONEXAO_ATIVA=1. Token nunca na resposta nem no log.

import "server-only";
import { RepositorioSupabase } from "@/lib/dados/supabase";
import { conexaoMetaLigada } from "@/lib/meta/graph";
import { metricasDoCliente } from "@/lib/meta/metricasCliente";

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
  if (eu.papel !== "admin") return Response.json({ erro: "Só os sócios veem as métricas." }, { status: 403, headers: semCache });
  const p = new URL(req.url).searchParams;
  const clienteId = p.get("clienteId")?.trim() ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(clienteId)) return Response.json({ erro: "Cliente inválido." }, { status: 400, headers: semCache });
  try {
    return Response.json(await metricasDoCliente(repo, clienteId, Number(p.get("dias")) || null), { headers: semCache });
  } catch (e) {
    return Response.json({ erro: e instanceof Error ? e.message : "Não deu para buscar as métricas." }, { status: 400, headers: semCache });
  }
}
