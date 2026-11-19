// Métricas do Instagram de um cliente, usado pela rota /api/meta/metricas e pelo conector do Claude.
// Só leitura. Travas: conexão geral ligada (META_CONEXAO_ATIVA), cliente conectado e "Permitir ler métricas" ligado na ficha.

import "server-only";
import type { Repositorio } from "../dados/repositorio";
import { conexaoMetaLigada, tokenMeta } from "./graph";
import { limitarDias, type RespostaMetricas } from "./metricas";
import { coletarMetricas } from "./metricasMeta";

export async function metricasDoCliente(repo: Repositorio, clienteId: string, dias?: number | null): Promise<RespostaMetricas> {
  if (!conexaoMetaLigada()) return { ativo: false, motivo: "desligado" };
  const token = tokenMeta();
  if (!token) return { ativo: false, motivo: "sem_token" };
  const conexao = await repo.obterConexaoMeta(clienteId);
  if (!conexao || conexao.status !== "conectado" || !conexao.instagramId || !conexao.instagramUsuario)
    throw new Error("Este cliente ainda não está conectado ao Instagram. Use \"Conferir conexão\" na ficha primeiro.");
  if (!conexao.metricasAtivas) throw new Error("A leitura de métricas está desligada na ficha deste cliente. Ligue \"Permitir ler métricas\" antes.");
  return { ativo: true, ...(await coletarMetricas(token, conexao.instagramId, conexao.instagramUsuario, limitarDias(dias))) };
}
