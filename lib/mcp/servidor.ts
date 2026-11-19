// Servidor MCP da Aden: dá ao Claude (projeto no claude.ai) o mesmo acesso que
// um sócio tem no site. Ele entra com um usuário próprio ("Claude (conector)"),
// então as permissões do banco (RLS) valem. Com o código pessoal do sócio (Fase 4),
// tudo o que ele alterar aparece no Histórico no nome do sócio, "pelo Claude".

import "server-only";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RepositorioSupabase } from "../dados/supabase";
import { INSTRUCOES } from "./comum";
import { VERSAO_FERRAMENTAS } from "./novidades";
import { registrarConfiguracao } from "./configuracao";
import { registrarMesESimulacoes } from "./mesESimulacoes";
import { registrarEquipeEClientes } from "./equipeEClientes";
import { registrarDatas } from "./datas";
import { registrarFechamento } from "./fechamento";
import { registrarBriefingEContexto } from "./briefingEContexto";
import { registrarComercial } from "./comercial";
import { registrarTarefas } from "./tarefas";
import { registrarFinanceiro } from "./financeiro";

export { dataDeBrasilia, dataHoraBrasilia } from "./comum";

/** Monta o servidor do conector: as ferramentas ficam uma área por arquivo (lib/mcp/*.ts). */
export function criarServidorMcp(obterRepo: () => Promise<RepositorioSupabase>, origem = ""): McpServer {
  const server = new McpServer({ name: "aden", version: VERSAO_FERRAMENTAS }, { instructions: INSTRUCOES });
  registrarConfiguracao(server, obterRepo);
  registrarMesESimulacoes(server, obterRepo);
  registrarEquipeEClientes(server, obterRepo, origem);
  registrarDatas(server, obterRepo);
  registrarFechamento(server, obterRepo);
  registrarBriefingEContexto(server, obterRepo);
  registrarComercial(server, obterRepo, origem);
  registrarTarefas(server, obterRepo);
  registrarFinanceiro(server, obterRepo);
  return server;
}
