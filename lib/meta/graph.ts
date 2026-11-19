// Conversa com a Graph API da Meta (só no servidor). Etapa 1: só leitura.
// Regras de segurança: o token vai SEMPRE no cabeçalho Authorization (nunca na URL), POST leva os parâmetros
// no corpo, nada fica em cache e nenhum erro devolve token, cabeçalho ou resposta crua da Meta.
// O token e o segredo moram só nas variáveis da Vercel; nada aqui os grava, devolve ou loga.

import "server-only";
import { traduzirErroMeta, type ContaMeta, type SituacaoToken } from "./estado";

const ler = (nome: string) => process.env[nome]?.trim() || null;

/** Chave geral da conexão (etapa 1). Desligada = a rota responde { ativo: false, motivo: "desligado" }. */
export const conexaoMetaLigada = () => ler("META_CONEXAO_ATIVA") === "1";

/** ID do negócio da Aden no Gerenciador de Negócios (não é segredo): vai no passo a passo do cliente. */
export const negocioMetaId = () => ler("META_NEGOCIO_ID");

const versao = () => {
  const v = ler("META_GRAPH_VERSION") ?? "v23.0";
  return /^v\d+\.\d+$/.test(v) ? v : "v23.0";
};
const BASE = "https://graph.facebook.com";

export class ErroMeta extends Error {
  constructor(mensagem: string, readonly codigo: number | null) {
    super(mensagem);
    this.name = "ErroMeta";
  }
}

type RespostaMeta = { error?: { code?: number; error_subcode?: number; type?: string; message?: string } } & Record<string, unknown>;

/** Chama a Graph API. `caminho` relativo (ex.: "me/accounts") ou URL completa de paginação da própria Meta. */
export async function graph<T = RespostaMeta>(
  caminho: string,
  opcoes: { token: string; metodo?: "GET" | "POST"; parametros?: Record<string, string> } ,
): Promise<T> {
  const metodo = opcoes.metodo ?? "GET";
  let url: URL;
  if (/^https:\/\//.test(caminho)) {
    url = new URL(caminho);
    if (url.hostname !== "graph.facebook.com") throw new ErroMeta("Endereço de paginação inesperado.", null);
  } else {
    url = new URL(`${BASE}/${versao()}/${caminho.replace(/^\//, "")}`);
  }
  // nunca deixar token na URL (nem se a Meta devolver um na paginação)
  url.searchParams.delete("access_token");
  let corpo: URLSearchParams | undefined;
  if (metodo === "GET") for (const [k, v] of Object.entries(opcoes.parametros ?? {})) url.searchParams.set(k, v);
  else corpo = new URLSearchParams(opcoes.parametros ?? {});

  let r: Response;
  try {
    r = await fetch(url, {
      method: metodo,
      headers: { Authorization: `Bearer ${opcoes.token}`, ...(corpo && { "Content-Type": "application/x-www-form-urlencoded" }) },
      body: corpo,
      cache: "no-store",
    });
  } catch {
    throw new ErroMeta("Não deu para falar com a Meta agora. Tente de novo em instantes.", null);
  }
  const dados = (await r.json().catch(() => null)) as RespostaMeta | null;
  if (!r.ok || !dados || dados.error) {
    const e = dados?.error;
    // log só com códigos (nunca cabeçalho, token ou resposta inteira)
    console.warn(`[meta] ${metodo} ${url.pathname} falhou: status ${r.status}, código ${e?.code ?? "-"}/${e?.error_subcode ?? "-"}`);
    throw new ErroMeta(traduzirErroMeta(e, r.status), e?.code ?? null);
  }
  return dados as T;
}

type PaginaDaMeta = { id: string; name?: string; instagram_business_account?: { id?: string; username?: string } };

/** Todas as Páginas que o acesso da Aden enxerga, com o Instagram ligado. Segue a paginação (a lista cresce com os clientes). */
export async function listarContasMeta(token: string, limitePaginas = 20): Promise<ContaMeta[]> {
  const contas: ContaMeta[] = [];
  let proximo: string | null = "me/accounts";
  let parametros: Record<string, string> | undefined = { fields: "id,name,instagram_business_account{id,username}", limit: "100" };
  for (let i = 0; proximo && i < limitePaginas; i++) {
    const r: { data?: PaginaDaMeta[]; paging?: { next?: string } } = await graph(proximo, { token, parametros });
    for (const p of r.data ?? []) {
      contas.push({
        paginaId: p.id,
        paginaNome: p.name ?? "(Página sem nome)",
        instagramId: p.instagram_business_account?.id ?? null,
        instagramUsuario: p.instagram_business_account?.username ?? null,
      });
    }
    proximo = r.paging?.next ?? null;
    parametros = undefined; // a URL de "next" já traz os campos
  }
  return contas;
}

/**
 * Situação do token: permissões concedidas (me/permissions, token no cabeçalho) e, se o ID e o segredo do app
 * estiverem na Vercel, validade e vencimento (debug_token por POST, sem nada na URL).
 */
export async function conferirToken(token: string): Promise<SituacaoToken> {
  try {
    const p: { data?: { permission: string; status: string }[] } = await graph("me/permissions", { token });
    const permissoes = (p.data ?? []).filter((x) => x.status === "granted").map((x) => x.permission).sort();
    let expiraEm: string | null = null;
    const appId = ler("META_APP_ID");
    const segredo = ler("META_APP_SECRET");
    if (appId && segredo) {
      try {
        const d: { data?: { is_valid?: boolean; expires_at?: number } } = await graph("debug_token", {
          token: `${appId}|${segredo}`,
          metodo: "POST",
          parametros: { input_token: token, method: "GET" },
        });
        if (d.data?.is_valid === false) return { valido: false, expiraEm: null, permissoes, erro: null };
        // 0 = não vence (usuário do sistema)
        if (d.data?.expires_at) expiraEm = new Date(d.data.expires_at * 1000).toISOString();
      } catch {
        // sem debug_token, segue só com as permissões
      }
    }
    return { valido: true, expiraEm, permissoes, erro: null };
  } catch (e) {
    return { valido: false, expiraEm: null, permissoes: [], erro: e instanceof Error ? e.message : "Não deu para conferir o acesso." };
  }
}

/** Token do usuário do sistema (variável da Vercel). Nunca sai do servidor. */
export const tokenMeta = () => ler("META_ACCESS_TOKEN");

// ── Publicar no Instagram (etapa 2) ────────────────────────────────────────────────────────────────────────
// Foto: cria o contêiner e publica. Carrossel: um contêiner por imagem, um do carrossel, e publica.
// Só é chamado por lib/meta/publicar.ts depois de todas as travas (chaves, lista de contas, confirmação escrita).

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Espera o contêiner ficar pronto (FINISHED). Erro da Meta ou demora demais = erro em português simples. */
async function esperarContainer(token: string, id: string, tentativas = 10, pausaMs = 2000): Promise<void> {
  for (let i = 0; i < tentativas; i++) {
    const r: { status_code?: string } = await graph(id, { token, parametros: { fields: "status_code" } });
    if (r.status_code === "FINISHED") return;
    if (r.status_code === "ERROR" || r.status_code === "EXPIRED") throw new ErroMeta("A Meta não conseguiu processar a imagem. Confira se o link abre e é um .jpg.", null);
    await dormir(pausaMs);
  }
  throw new ErroMeta("A Meta demorou demais para processar a imagem. Tente de novo em instantes.", null);
}

export async function publicarNoInstagram(
  token: string,
  instagramId: string,
  plano: { imagens: string[]; legenda: string },
): Promise<{ postId: string; link: string | null }> {
  let containerId: string;
  if (plano.imagens.length === 1) {
    const c: { id: string } = await graph(`${instagramId}/media`, {
      token,
      metodo: "POST",
      parametros: { image_url: plano.imagens[0], ...(plano.legenda && { caption: plano.legenda }) },
    });
    containerId = c.id;
  } else {
    const filhos: string[] = [];
    for (const url of plano.imagens) {
      const f: { id: string } = await graph(`${instagramId}/media`, { token, metodo: "POST", parametros: { image_url: url, is_carousel_item: "true" } });
      filhos.push(f.id);
    }
    for (const id of filhos) await esperarContainer(token, id);
    const c: { id: string } = await graph(`${instagramId}/media`, {
      token,
      metodo: "POST",
      parametros: { media_type: "CAROUSEL", children: filhos.join(","), ...(plano.legenda && { caption: plano.legenda }) },
    });
    containerId = c.id;
  }
  await esperarContainer(token, containerId);
  const p: { id: string } = await graph(`${instagramId}/media_publish`, { token, metodo: "POST", parametros: { creation_id: containerId } });
  let link: string | null = null;
  try {
    const m: { permalink?: string } = await graph(p.id, { token, parametros: { fields: "permalink" } });
    link = m.permalink ?? null;
  } catch {
    // o post já saiu; o link é só um extra
  }
  return { postId: p.id, link };
}
