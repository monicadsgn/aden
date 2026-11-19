// Conexão com a Meta (Instagram e Facebook), etapa 1: só leitura (19/11/2026).
// Regras puras e testadas: em que estado está o cliente, que permissões faltam, como falar do erro e
// o passo a passo que o cliente faz para liberar o acesso. Nada aqui chama a Meta nem conhece token.

export type StatusConexaoMeta = "nao_conectado" | "conectando" | "conectado" | "com_problema" | "pausado";

export const ROTULO_STATUS_META: Record<StatusConexaoMeta, string> = {
  nao_conectado: "Não conectado",
  conectando: "Conectando",
  conectado: "Conectado",
  com_problema: "Com problema",
  pausado: "Pausado",
};

export const EXPLICA_STATUS_META: Record<StatusConexaoMeta, string> = {
  nao_conectado: "Ainda não escolhemos qual Página do Facebook e qual Instagram são deste cliente.",
  conectando: "A Página foi escolhida, mas o cliente ainda precisa liberar o acesso para a Aden.",
  conectado: "A Aden enxerga a Página e o Instagram do cliente. Nada é publicado: isso só liga numa etapa futura.",
  com_problema: "Algo parou de funcionar (acesso vencido, permissão faltando ou Página desligada do Instagram). O motivo aparece logo abaixo.",
  pausado: "Os sócios pausaram a conexão deste cliente. Nada é conferido nem publicado até reativar.",
};

/** Ficha da conexão do cliente (tabela conexoes_meta). Nunca guarda token. */
export type ConexaoMeta = {
  clienteId: string;
  paginaId: string | null;
  paginaNome: string | null;
  instagramId: string | null;
  instagramUsuario: string | null;
  status: StatusConexaoMeta;
  publicarAtivo: boolean;
  metricasAtivas: boolean;
  ultimaConferencia: string | null;
  ultimoErro: string | null;
};

export function conexaoVazia(clienteId: string): ConexaoMeta {
  return {
    clienteId,
    paginaId: null,
    paginaNome: null,
    instagramId: null,
    instagramUsuario: null,
    status: "nao_conectado",
    publicarAtivo: false,
    metricasAtivas: false,
    ultimaConferencia: null,
    ultimoErro: null,
  };
}

/** Uma Página que o acesso da Aden enxerga, com o Instagram profissional ligado a ela (se houver). */
export type ContaMeta = { paginaId: string; paginaNome: string; instagramId: string | null; instagramUsuario: string | null };

/** Permissões que cada etapa usa (princípio do mínimo: pedir só o que a etapa usa). */
export const PERMISSOES_POR_ETAPA = {
  conexao: { rotulo: "Conferir a conexão", permissoes: ["pages_show_list", "instagram_basic"] },
  publicarInstagram: { rotulo: "Publicar no Instagram", permissoes: ["instagram_basic", "instagram_content_publish", "pages_read_engagement", "pages_show_list"] },
  publicarFacebook: { rotulo: "Publicar na Página do Facebook", permissoes: ["pages_manage_posts", "pages_read_engagement", "pages_show_list"] },
  metricas: { rotulo: "Ver as métricas", permissoes: ["instagram_manage_insights", "pages_read_engagement", "read_insights"] },
} as const;

export type EtapaMeta = keyof typeof PERMISSOES_POR_ETAPA;

export function permissoesPorEtapa(concedidas: string[]): { etapa: EtapaMeta; rotulo: string; faltam: string[] }[] {
  const tem = new Set(concedidas);
  return (Object.keys(PERMISSOES_POR_ETAPA) as EtapaMeta[]).map((etapa) => ({
    etapa,
    rotulo: PERMISSOES_POR_ETAPA[etapa].rotulo,
    faltam: PERMISSOES_POR_ETAPA[etapa].permissoes.filter((p) => !tem.has(p)),
  }));
}

/** Situação do acesso da Aden (o token fica na Vercel; aqui só o que se pode mostrar). */
export type SituacaoToken = { valido: boolean; expiraEm: string | null; permissoes: string[]; erro: string | null };

const limpar = (u: string | null | undefined) => (u ?? "").trim().replace(/^@/, "").toLowerCase();

/** O que a rota /api/meta/status devolve (nunca leva token). */
export type RespostaStatusMeta =
  | { ativo: false; motivo: "desligado" | "sem_token" }
  | {
      ativo: true;
      token: { valido: boolean; expiraEm: string | null; permissoes: string[]; porEtapa: { etapa: EtapaMeta; rotulo: string; faltam: string[] }[]; erro: string | null };
      contas: ContaMeta[];
      erroContas: string | null;
      cliente?: {
        clienteId: string;
        status: StatusConexaoMeta;
        motivo: string | null;
        paginaNome: string | null;
        instagramUsuario: string | null;
        sugestao: ContaMeta | null;
        conferidoEm: string;
        passosParaCliente: string;
      };
    };

/** Página cujo Instagram tem o mesmo @ que está na ficha do cliente (para sugerir a escolha). */
export function sugerirConta(contas: ContaMeta[], instagramDaFicha: string | null | undefined): ContaMeta | null {
  const alvo = limpar(instagramDaFicha?.split("/").filter(Boolean).pop());
  if (!alvo) return null;
  return contas.find((c) => limpar(c.instagramUsuario) === alvo) ?? null;
}

/**
 * Estado do cliente depois de conferir com a Meta. Não muda nada sozinho no que os sócios decidiram
 * (Página escolhida, pausa, publicar/métricas): só diz o status e o motivo.
 */
export function avaliarConexao(conexao: ConexaoMeta, contas: ContaMeta[], token: SituacaoToken): { status: StatusConexaoMeta; motivo: string | null } {
  if (conexao.status === "pausado") return { status: "pausado", motivo: null };
  if (!token.valido) return { status: "com_problema", motivo: token.erro ?? "O acesso da Aden à Meta venceu ou não vale mais. Um sócio precisa gerar um novo e trocar na Vercel." };
  if (!conexao.paginaId) return { status: "nao_conectado", motivo: null };

  const conta = contas.find((c) => c.paginaId === conexao.paginaId);
  if (!conta) {
    const jaFuncionou = conexao.status === "conectado" || conexao.status === "com_problema";
    return jaFuncionou
      ? { status: "com_problema", motivo: "A Aden deixou de enxergar a Página deste cliente. O acesso pode ter sido retirado no Gerenciador de Negócios do cliente." }
      : { status: "conectando", motivo: "O acesso ainda não foi liberado para a Aden. Mande o passo a passo para o cliente." };
  }
  if (!conta.instagramId) return { status: "com_problema", motivo: "A Página não tem Instagram profissional ligado a ela. O cliente precisa ligar o Instagram à Página (e a conta precisa ser profissional)." };
  const faltam = permissoesPorEtapa(token.permissoes).find((e) => e.etapa === "conexao")!.faltam;
  if (faltam.length) return { status: "com_problema", motivo: `Falta permissão no acesso da Aden: ${faltam.join(", ")}.` };
  return { status: "conectado", motivo: null };
}

/** Erro da Meta em português simples (nunca o texto cru para o cliente). */
export function traduzirErroMeta(e: { code?: number; error_subcode?: number; type?: string; message?: string } | null | undefined, status?: number): string {
  const code = e?.code;
  if (code === 190 || (e?.type === "OAuthException" && status === 401)) return "O acesso da Aden à Meta venceu ou não vale mais. Um sócio precisa gerar um novo e trocar na Vercel.";
  if (code === 10 || code === 200 || (code != null && code >= 200 && code < 300)) return "Falta permissão no acesso da Aden para fazer isso.";
  if (code === 4 || code === 17 || code === 32 || code === 613) return "A Meta pediu uma pausa (muitas consultas seguidas). Tente de novo em alguns minutos.";
  if (code === 100) return "A Meta não encontrou o que pedimos (Página ou conta). Confira se ainda está ligada à Aden.";
  if (code === 1 || code === 2) return "A Meta ficou fora do ar por um instante. Tente de novo.";
  if (status && status >= 500) return "A Meta ficou fora do ar por um instante. Tente de novo.";
  return "A Meta recusou a consulta. Tente de novo; se continuar, avise a equipe.";
}

/**
 * Passo a passo que o cliente (ou quem administra o negócio dele) faz para liberar a Página e o Instagram.
 * Texto pronto para copiar e mandar no WhatsApp. O ID do negócio da Aden vem da Vercel (META_NEGOCIO_ID).
 */
export function passosParaCliente(negocioId: string | null): string {
  const id = negocioId?.trim() || "[ID do negócio da Aden: peça a um sócio]";
  return [
    "Oi! Pra gente cuidar do seu Instagram e da sua Página por aqui, precisamos que você libere o acesso pra Aden. Leva uns 5 minutos:",
    "",
    "1. Confira se o seu Instagram é conta profissional e está ligado à sua Página do Facebook.",
    "2. Entre em business.facebook.com com quem administra a sua empresa.",
    "3. Vá em Configurações > Contas > Páginas, escolha a sua Página e clique em Atribuir parceiro (ou Compartilhar com parceiro).",
    `4. Cole o ID do negócio da Aden: ${id}`,
    "5. Marque as permissões de conteúdo e de insights (métricas) e confirme.",
    "6. Repita em Configurações > Contas > Contas do Instagram, com a sua conta do Instagram.",
    "",
    "Os nomes dos botões às vezes mudam um pouco. Se travar em algum passo, manda um print que a gente te ajuda.",
  ].join("\n");
}

// Publicar no Instagram (etapa 2): formato da resposta da rota /api/meta/publicar. Sem token, só ids, links e texto.
export type RespostaPublicarMeta =
  | { ativo: false; motivo: string }
  | { ativo: true; dryRun: true; conta: string; tipo: "foto" | "carrossel"; imagens: number; legenda: string; confirmacaoNecessaria: string; aviso: string }
  | { ativo: true; dryRun: false; conta: string; tipo: "foto" | "carrossel"; postId: string; link: string | null };
