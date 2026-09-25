import { atenderMcp } from "@/lib/mcp/rota";

// Conector MCP com a senha no fim do endereço (formato aceito pelo claude.ai).
async function tratar(req: Request, ctx: RouteContext<"/api/mcp/[token]">) {
  const { token } = await ctx.params;
  return atenderMcp(req, token);
}

export { tratar as GET, tratar as POST, tratar as DELETE };
