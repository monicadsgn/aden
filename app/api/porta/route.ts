// Porta genérica: outro sistema entra com o código pessoal de um sócio (Configurações → Equipe e acessos).
// Quem confere o código e decide o que pode é o banco (funções porta_*, migration 0021); aqui só traduz.

import "server-only";
import { createClient } from "@supabase/supabase-js";
import { COMO_USAR_PORTA, chamadaDoPedido, codigoDoPedido } from "@/lib/porta";

function ler(nome: string): string | null {
  return process.env[nome]?.trim() || null;
}

function banco() {
  const url = ler("NEXT_PUBLIC_SUPABASE_URL") ?? ler("SUPABASE_URL");
  const chave = ler("NEXT_PUBLIC_SUPABASE_ANON_KEY") ?? ler("SUPABASE_ANON_KEY");
  if (!url || !chave) return null;
  return createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

const naoAutorizado = () => Response.json({ erro: "Código inválido ou ausente.", comoUsar: COMO_USAR_PORTA }, { status: 401 });

/** Erro do banco → resposta. "Código inválido" vira 401; o resto, 400 com a frase do banco. */
function respostaDeErro(mensagem: string) {
  if (/C[óo]digo inv[áa]lido/.test(mensagem)) return naoAutorizado();
  return Response.json({ erro: mensagem }, { status: 400 });
}

export async function GET(req: Request) {
  const codigo = codigoDoPedido(req.headers.get("authorization"));
  if (!codigo) return naoAutorizado();
  const sb = banco();
  if (!sb) return Response.json({ erro: "Porta não configurada." }, { status: 503 });
  const concluidas = new URL(req.url).searchParams.get("concluidas") === "1";
  const { data, error } = await sb.rpc("porta_ler", { p_codigo: codigo, p_concluidas: concluidas });
  if (error) return respostaDeErro(error.message);
  return Response.json(data);
}

export async function POST(req: Request) {
  const codigo = codigoDoPedido(req.headers.get("authorization"));
  if (!codigo) return naoAutorizado();
  const sb = banco();
  if (!sb) return Response.json({ erro: "Porta não configurada." }, { status: 503 });
  let chamada;
  try {
    chamada = chamadaDoPedido(await req.json().catch(() => null));
  } catch (e) {
    return Response.json({ erro: e instanceof Error ? e.message : "Pedido inválido." }, { status: 400 });
  }
  const { data, error } = await sb.rpc(chamada.funcao, { p_codigo: codigo, ...chamada.args });
  if (error) return respostaDeErro(error.message);
  return Response.json(data);
}
