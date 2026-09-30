// Atendimento HTTP do conector MCP (usado por app/api/mcp e app/api/mcp/[token]).
//
// Acesso, no cabeçalho "Authorization: Bearer …" ou no fim do endereço
// (/api/mcp/<código>) — o claude.ai só aceita o endereço, sem cabeçalho:
// - código pessoal do sócio (Fase 4, Configurações → Equipe → Seu Claude): tudo
//   fica no nome dele ("Mônica (pelo Claude)"), e o banco confere o código em cada chamada;
// - senha antiga única (ADEN_MCP_TOKEN), enquanto CONECTOR_ENDERECO_ANTIGO estiver ligado.
//
// No banco, o conector entra como um usuário próprio (ADEN_MCP_EMAIL /
// ADEN_MCP_SENHA), vinculado à Aden como admin com o nome "Claude (conector)".

import "server-only";
import { timingSafeEqual } from "node:crypto";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { RepositorioSupabase } from "../dados/supabase";
import { CONECTOR_ENDERECO_ANTIGO } from "../recursos";
import { criarServidorMcp } from "./servidor";

// leitura dinâmica: valor do momento da requisição, nunca congelado no build
function ler(nome: string): string | null {
  const env = process.env;
  return env[nome]?.trim() || null;
}

function mesmaSenha(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function atenderMcp(req: Request, senhaNoEndereco: string | null): Promise<Response> {
  const config = {
    ADEN_MCP_EMAIL: ler("ADEN_MCP_EMAIL"),
    ADEN_MCP_SENHA: ler("ADEN_MCP_SENHA"),
    NEXT_PUBLIC_SUPABASE_URL: ler("NEXT_PUBLIC_SUPABASE_URL") ?? ler("SUPABASE_URL"),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: ler("NEXT_PUBLIC_SUPABASE_ANON_KEY") ?? ler("SUPABASE_ANON_KEY"),
  };
  const faltando = Object.entries(config)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (faltando.length) {
    // só nomes, nunca valores
    return new Response(`Conector da Aden não configurado. Faltam: ${faltando.join(", ")}.`, { status: 503 });
  }

  const cabecalho = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const senha = (senhaNoEndereco || cabecalho).trim();
  const senhaAntiga = ler("ADEN_MCP_TOKEN");
  const ehAntiga = CONECTOR_ENDERECO_ANTIGO && !!senhaAntiga && !!senha && mesmaSenha(senha, senhaAntiga);
  const pareceCodigo = /^aden_[0-9a-f]{48}$/.test(senha);
  if (!ehAntiga && !pareceCodigo) return new Response("Não autorizado", { status: 401 });

  const novoRepo = async () => {
    const repo = new RepositorioSupabase(config.NEXT_PUBLIC_SUPABASE_URL!, config.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      servidor: true,
      codigoClaude: ehAntiga ? undefined : senha,
    });
    await repo.entrar(config.ADEN_MCP_EMAIL!, config.ADEN_MCP_SENHA!);
    return repo;
  };

  // código pessoal: o banco confere antes de qualquer coisa (código cancelado ou de outra finalidade = 401)
  let repoConferido: RepositorioSupabase | null = null;
  if (!ehAntiga) {
    try {
      repoConferido = await novoRepo();
      if (!(await repoConferido.donoDoCodigoClaude())) return new Response("Não autorizado", { status: 401 });
    } catch {
      return new Response("Não autorizado", { status: 401 });
    }
  }

  const obterRepo = async () => {
    const repo = repoConferido ?? (await novoRepo());
    const usuario = await repo.usuarioAtual();
    if (!usuario || usuario.papel === "sem_vinculo")
      throw new Error("O usuário do conector não está vinculado à Aden. Rode vincular_socio para ele no Supabase.");
    return repo;
  };

  // sem estado entre requisições: cada chamada cria servidor + transporte (bom na Vercel)
  const transporte = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  const servidor = criarServidorMcp(obterRepo, new URL(req.url).origin);
  await servidor.connect(transporte);
  return transporte.handleRequest(req);
}
