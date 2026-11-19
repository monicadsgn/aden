// Fila de publicação no Instagram (19/11/2026). Chamada a cada 5 minutos (Supabase pg_cron) e uma vez por dia pela
// Vercel (vercel.json), sempre com o segredo CRON_SECRET: sem ele nada acontece. Pega as peças aprovadas pelo cliente que
// já passaram da hora de "Vai ao ar em", publica foto ou carrossel na ordem das artes e dá baixa na peça.
// Só roda com todas as travas: META_CONEXAO_ATIVA=1, META_PUBLICAR_ATIVO=1, @ liberado em META_PUBLICAR_CONTAS e, na ficha
// do cliente, "Permitir publicar" + "Agendar sozinho". Nada aqui devolve ou loga token.

import "server-only";
import { conexaoMetaLigada, ErroMeta, publicarNoInstagram, tokenMeta } from "@/lib/meta/graph";
import { processarFila, type ItemFila } from "@/lib/meta/fila";
import { contasLiberadas } from "@/lib/meta/publicacao";
import { publicacaoMetaLigada } from "@/lib/meta/publicar";
import { banco, ler } from "@/lib/quizServidor";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function rodar(req: Request) {
  const segredo = ler("CRON_SECRET");
  const enviado = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!segredo || enviado !== segredo) return Response.json({ erro: "Sem permissão." }, { status: 401 });
  if (!conexaoMetaLigada()) return Response.json({ ativo: false, motivo: "desligado" });
  if (!publicacaoMetaLigada()) return Response.json({ ativo: false, motivo: "publicacao_desligada" });
  const token = tokenMeta();
  if (!token) return Response.json({ ativo: false, motivo: "sem_token" });
  const sb = banco();
  if (!sb) return Response.json({ erro: "Banco não configurado." }, { status: 503 });

  const liberadas = contasLiberadas(process.env.META_PUBLICAR_CONTAS);
  if (liberadas.length === 0) return Response.json({ ativo: false, motivo: "nenhuma_conta_liberada" });
  const contas = liberadas.includes("*") ? [] : liberadas;

  const pegou = await sb.rpc("meta_fila_pegar", { p_segredo: segredo, p_contas: contas });
  if (pegou.error) return Response.json({ erro: "Não deu para ler a fila." }, { status: 500 });
  const itens = (pegou.data ?? []) as ItemFila[];

  const producao = ler("VERCEL_PROJECT_PRODUCTION_URL");
  const base = ler("AVISO_URL_BASE") ?? (producao ? `https://${producao}` : `https://${req.headers.get("host")}`);

  const r = await processarFila({
    itens,
    base,
    supabaseUrl: ler("NEXT_PUBLIC_SUPABASE_URL") ?? ler("SUPABASE_URL"),
    publicar: async (item, plano) => {
      try {
        const x = await publicarNoInstagram(token, item.instagramId, plano);
        return { postId: x.postId, link: x.link };
      } catch (e) {
        throw new Error(e instanceof ErroMeta ? e.message : "Não deu para publicar agora.");
      }
    },
    resultado: async (x) => {
      await sb.rpc("meta_fila_resultado", {
        p_segredo: segredo,
        p_tarefa: x.tarefaId,
        p_ok: x.ok,
        p_post_id: x.postId ?? null,
        p_link: x.link ?? null,
        p_erro: x.erro ?? null,
        p_definitivo: x.definitivo ?? false,
      });
    },
  });
  return Response.json({ ativo: true, pegas: itens.length, ...r });
}

export const GET = rodar;
export const POST = rodar;
