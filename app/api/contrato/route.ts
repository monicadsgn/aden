// Contrato pela Autentique, pedido pelo site. O navegador manda o token da sessão; o servidor age com as
// permissões dessa pessoa (só sócio envia) e usa a chave da Autentique, que nunca vai para o navegador.

import "server-only";
import { chaveAutentique } from "@/lib/contrato/autentique";
import { conferirContratos, enviarContrato } from "@/lib/contrato/acoes";
import { RepositorioSupabase } from "@/lib/dados/supabase";

function ler(nome: string): string | null {
  return process.env[nome]?.trim() || null;
}

export async function POST(req: Request) {
  const pedido = (await req.json().catch(() => null)) as { acao?: string; clienteId?: string; reenviar?: boolean } | null;
  const ligada = !!chaveAutentique();
  const teste = ler("AUTENTIQUE_SANDBOX") === "1";
  if (pedido?.acao === "situacao") return Response.json({ autentiqueLigada: ligada, teste });

  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const url = ler("NEXT_PUBLIC_SUPABASE_URL") ?? ler("SUPABASE_URL");
  const chave = ler("NEXT_PUBLIC_SUPABASE_ANON_KEY") ?? ler("SUPABASE_ANON_KEY");
  if (!token || !url || !chave) return Response.json({ erro: "Entre no Aden de novo." }, { status: 401 });
  if (!ligada) return Response.json({ erro: "A chave da Autentique ainda não foi salva na Vercel (AUTENTIQUE_TOKEN)." }, { status: 503 });
  if ((pedido?.acao !== "enviar" && pedido?.acao !== "conferir") || !pedido.clienteId) return Response.json({ erro: "Pedido inválido." }, { status: 400 });

  const repo = new RepositorioSupabase(url, chave, { servidor: true, tokenAcesso: token });
  const eu = await repo.usuarioAtual();
  if (!eu) return Response.json({ erro: "Entre no Aden de novo." }, { status: 401 });
  if (eu.papel !== "admin") return Response.json({ erro: "Só os sócios enviam contrato." }, { status: 403 });

  try {
    if (pedido.acao === "enviar") {
      const r = await enviarContrato(repo, pedido.clienteId, { reenviar: pedido.reenviar === true });
      return Response.json({ autentiqueLigada: true, teste, mensagem: `Contrato enviado para ${r.para.join(", ")}.` });
    }
    const r = await conferirContratos(repo, pedido.clienteId);
    const msg = !r.length
      ? "Nenhum contrato esperando assinatura."
      : r.map((x) => (x.situacao === "assinado" ? "Assinado por todos." : x.situacao === "recusado" ? "Alguém recusou a assinatura." : `Falta assinar: ${x.faltam.join(", ")}.`)).join(" ");
    return Response.json({ autentiqueLigada: true, teste, mensagem: msg });
  } catch (e) {
    return Response.json({ erro: e instanceof Error ? e.message : "Não deu certo." }, { status: 400 });
  }
}
