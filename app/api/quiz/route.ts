// Entrada pública do quiz de conversão de leads. Sem login: quem protege é o segredo da rota (QUIZ_SEGREDO,
// só o hash dele mora no banco, migration 0046), o limite por hora por visitante, a armadilha para robô e a
// validação do que chega. A regra de qualificação fica na página do quiz; aqui só se recebe e se guarda.

import "server-only";
import { createClient } from "@supabase/supabase-js";
import {
  LIMITE_ENVIOS_POR_HORA,
  LIMITE_PASSOS_POR_HORA,
  TAMANHO_MAXIMO_PEDIDO,
  chaveDoVisitante,
  ipDoPedido,
  pedidoDoQuiz,
} from "@/lib/quiz";

function ler(nome: string): string | null {
  return process.env[nome]?.trim() || null;
}

function banco() {
  const url = ler("NEXT_PUBLIC_SUPABASE_URL") ?? ler("SUPABASE_URL");
  const chave = ler("NEXT_PUBLIC_SUPABASE_ANON_KEY") ?? ler("SUPABASE_ANON_KEY");
  if (!url || !chave) return null;
  return createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

const resposta = (corpo: Record<string, unknown>, status = 200) => Response.json(corpo, { status, headers: { "Cache-Control": "no-store" } });

/** Erro do banco → resposta. Só frases que o banco escreve para o visitante passam; o resto vira erro genérico. */
function respostaDeErro(mensagem: string) {
  if (/Muitas tentativas/.test(mensagem)) return resposta({ erro: mensagem }, 429);
  if (/Quiz não configurado/.test(mensagem)) return resposta({ erro: "O quiz está fora do ar. Fale com a gente pelo WhatsApp." }, 503);
  if (/^(Informe|Pedido inválido)/.test(mensagem)) return resposta({ erro: mensagem }, 400);
  return resposta({ erro: "Não deu para registrar agora." }, 500);
}

export async function POST(req: Request) {
  const segredo = ler("QUIZ_SEGREDO");
  const sb = banco();
  if (!segredo || !sb) return resposta({ erro: "O quiz está fora do ar. Fale com a gente pelo WhatsApp." }, 503);

  const bruto = await req.text().catch(() => "");
  if (bruto.length > TAMANHO_MAXIMO_PEDIDO) return resposta({ erro: "Pedido grande demais." }, 413);

  let pedido;
  try {
    pedido = pedidoDoQuiz(JSON.parse(bruto));
  } catch (e) {
    return resposta({ erro: e instanceof Error && !(e instanceof SyntaxError) ? e.message : "Pedido inválido." }, 400);
  }

  // robô: finge que deu certo e não grava nada
  if (pedido.acao === "enviar" && pedido.descartar) return resposta({ ok: true });

  const chave = chaveDoVisitante(ipDoPedido(req.headers), segredo);
  const tipo = pedido.acao === "passo" ? "passo" : "enviar";
  const limite = await sb.rpc("quiz_limite_checar", {
    p_segredo: segredo,
    p_chave: chave,
    p_tipo: tipo,
    p_max: tipo === "passo" ? LIMITE_PASSOS_POR_HORA : LIMITE_ENVIOS_POR_HORA,
  });
  if (limite.error) return respostaDeErro(limite.error.message);

  if (pedido.acao === "passo") {
    const { error } = await sb.rpc("quiz_passo", { p_segredo: segredo, p_sessao: pedido.sessao, p_passo: pedido.passo });
    if (error) return respostaDeErro(error.message);
    return resposta({ ok: true });
  }

  const { error } = await sb.rpc("quiz_enviar", { p_segredo: segredo, p_dados: pedido.dados });
  if (error) return respostaDeErro(error.message);
  return resposta({ ok: true });
}
