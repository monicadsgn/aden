import { atenderMcp } from "@/lib/mcp/rota";

// Conector MCP com a senha no cabeçalho "Authorization: Bearer …".
async function tratar(req: Request) {
  return atenderMcp(req, null);
}

export { tratar as GET, tratar as POST, tratar as DELETE };
