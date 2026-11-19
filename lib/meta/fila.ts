// Fila de publicação no Instagram (19/11/2026): regras puras e testadas. Nada aqui fala com a Meta nem com o banco.
// A rota /api/meta/fila pega as peças que já passaram da hora de "Vai ao ar em" e usa isto para montar e conferir cada
// uma. A Meta só aceita JPEG: imagem em outro formato passa pela rota /api/meta/jpg, que converte sem perder qualidade.

import { montarPlano, type PlanoPublicacao } from "./publicacao";

export type ArquivoFila = { url: string; nome?: string; tipo?: string };

export type ItemFila = {
  tarefaId: string;
  clienteId: string;
  titulo: string;
  legenda: string | null;
  arquivos: ArquivoFila[];
  publicarEm: string;
  instagramId: string;
  instagramUsuario: string;
};

export type ResultadoFila = { tarefaId: string; ok: boolean; postId?: string | null; link?: string | null; erro?: string; definitivo?: boolean };

const PREFIXO_PECAS = "/storage/v1/object/public/pecas/";

/** A imagem é mesmo uma arte guardada pela Aden (só essas a rota de conversão aceita)? */
export function ehImagemDaPeca(url: string, supabaseUrl: string | null | undefined): boolean {
  if (!supabaseUrl) return false;
  try {
    const u = new URL(url);
    const base = new URL(supabaseUrl);
    return u.protocol === "https:" && u.hostname === base.hostname && !u.port && !u.username && !u.password && u.pathname.startsWith(PREFIXO_PECAS) && !u.pathname.includes("..");
  } catch {
    return false;
  }
}

/** Endereço que a Meta vai buscar: o próprio, se já é .jpg; senão, o da conversão em JPEG. */
export function enderecoParaMeta(url: string, base: string): string {
  try {
    if (/\.jpe?g$/i.test(new URL(url).pathname)) return url;
  } catch {
    return url;
  }
  return `${base.replace(/\/$/, "")}/api/meta/jpg/imagem.jpg?u=${encodeURIComponent(url)}`;
}

/** Plano de uma peça da fila, ou o motivo de não dar (sempre definitivo: refazer a tentativa não resolve). */
export function planoDaPeca(item: Pick<ItemFila, "arquivos" | "legenda">, base: string, supabaseUrl: string | null | undefined): { plano: PlanoPublicacao } | { erro: string } {
  const arquivos = item.arquivos ?? [];
  if (arquivos.length === 0) return { erro: "A peça não tem imagem anexada." };
  const naoImagem = arquivos.find((a) => !(a.tipo ?? "").startsWith("image/"));
  if (naoImagem) return { erro: "Tem vídeo ou PDF na peça. Por aqui só saem fotos e carrosséis: publique pelo app do Instagram." };
  const imagens: string[] = [];
  for (const a of arquivos) {
    const jaJpg = (() => {
      try {
        return /\.jpe?g$/i.test(new URL(a.url).pathname);
      } catch {
        return false;
      }
    })();
    if (!jaJpg && !ehImagemDaPeca(a.url, supabaseUrl)) return { erro: "Uma das imagens não está guardada na Aden e não é .jpg. Anexe de novo na peça." };
    imagens.push(enderecoParaMeta(a.url, base));
  }
  return montarPlano({ imagens, legenda: item.legenda });
}

/** Publica cada item, um por vez, e dá o resultado de cada um. Um erro nunca derruba os outros. */
export async function processarFila(deps: {
  itens: ItemFila[];
  base: string;
  supabaseUrl: string | null | undefined;
  publicar: (item: ItemFila, plano: PlanoPublicacao) => Promise<{ postId: string | null; link: string | null }>;
  resultado: (r: ResultadoFila) => Promise<void>;
}): Promise<{ publicadas: number; falhas: number }> {
  let publicadas = 0;
  let falhas = 0;
  for (const item of deps.itens) {
    const montado = planoDaPeca(item, deps.base, deps.supabaseUrl);
    if ("erro" in montado) {
      falhas++;
      await deps.resultado({ tarefaId: item.tarefaId, ok: false, erro: montado.erro, definitivo: true });
      continue;
    }
    try {
      const r = await deps.publicar(item, montado.plano);
      publicadas++;
      await deps.resultado({ tarefaId: item.tarefaId, ok: true, postId: r.postId, link: r.link });
    } catch (e) {
      falhas++;
      await deps.resultado({ tarefaId: item.tarefaId, ok: false, erro: e instanceof Error ? e.message : "Não deu para publicar agora." });
    }
  }
  return { publicadas, falhas };
}
