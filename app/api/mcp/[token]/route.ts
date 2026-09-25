import { atenderMcp } from "@/lib/mcp/rota";

// Conector MCP com a senha no fim do endereço (formato aceito pelo claude.ai).
async function tratar(req: Request, ctx: RouteContext<"/api/mcp/[token]">) {
  const { token } = await ctx.params;
  // símbolos na senha chegam codificados no endereço (ex.: ` vira %60)
  let senha = token;
  try {
    senha = decodeURIComponent(token);
  } catch {
    // mantém como veio
  }
  return atenderMcp(req, senha);
}

export { tratar as GET, tratar as POST, tratar as DELETE };
