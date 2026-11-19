// Publicar no Instagram, etapa 2. POST /api/meta/publicar com { clienteId, imagens: [https .jpg], legenda?, dryRun?, confirmacao? }.
// dryRun é true por padrão (só prévia). Só sócio. Tudo nasce desligado (META_PUBLICAR_ATIVO na Vercel). Token nunca na resposta.

import "server-only";
import { RepositorioSupabase } from "@/lib/dados/supabase";
import { conexaoMetaLigada } from "@/lib/meta/graph";
import { publicarMeta } from "@/lib/meta/publicar";

const ler = (nome: string) => process.env[nome]?.trim() || null;
const semCache = { "Cache-Control": "no-store" };

export async function POST(req: Request) {
  if (!conexaoMetaLigada()) return Response.json({ ativo: false, motivo: "desligado" }, { headers: semCache });

  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const url = ler("NEXT_PUBLIC_SUPABASE_URL") ?? ler("SUPABASE_URL");
  const chave = ler("NEXT_PUBLIC_SUPABASE_ANON_KEY") ?? ler("SUPABASE_ANON_KEY");
  if (!token || !url || !chave) return Response.json({ erro: "Entre no Aden de novo." }, { status: 401, headers: semCache });

  const repo = new RepositorioSupabase(url, chave, { servidor: true, tokenAcesso: token });
  const eu = await repo.usuarioAtual();
  if (!eu) return Response.json({ erro: "Entre no Aden de novo." }, { status: 401, headers: semCache });
  if (eu.papel !== "admin") return Response.json({ erro: "Só os sócios publicam pela Meta." }, { status: 403, headers: semCache });

  const corpo = (await req.json().catch(() => null)) as { clienteId?: string; imagens?: unknown; legenda?: unknown; dryRun?: unknown; confirmacao?: unknown } | null;
  if (!corpo || typeof corpo.clienteId !== "string" || !/^[0-9a-f-]{36}$/i.test(corpo.clienteId)) return Response.json({ erro: "Cliente inválido." }, { status: 400, headers: semCache });
  if (!Array.isArray(corpo.imagens)) return Response.json({ erro: "Mande a lista de imagens." }, { status: 400, headers: semCache });

  try {
    const r = await publicarMeta(repo, {
      clienteId: corpo.clienteId,
      imagens: corpo.imagens.map(String),
      legenda: typeof corpo.legenda === "string" ? corpo.legenda : null,
      // só false liga a publicação real; qualquer outra coisa é prévia
      dryRun: corpo.dryRun === false ? false : true,
      confirmacao: typeof corpo.confirmacao === "string" ? corpo.confirmacao : null,
    });
    return Response.json(r, { headers: semCache });
  } catch (e) {
    return Response.json({ erro: e instanceof Error ? e.message : "Não deu para publicar." }, { status: 400, headers: semCache });
  }
}
