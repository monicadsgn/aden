// Conferir a conexão com a Meta, usado pela rota /api/meta/status e pelo conector do Claude.
// Sempre com o repositório de quem está agindo (só sócio): o banco grava quem conferiu e o RLS vale igual.
// O que sai daqui nunca leva token: só ids, nomes, permissões e mensagens em português.

import "server-only";
import type { Repositorio } from "../dados/repositorio";
import { avaliarConexao, conexaoVazia, passosParaCliente, permissoesPorEtapa, sugerirConta, type ContaMeta, type RespostaStatusMeta, type SituacaoToken } from "./estado";

export type { RespostaStatusMeta };
import { conexaoMetaLigada, conferirToken, listarContasMeta, negocioMetaId, tokenMeta } from "./graph";

export async function conferirConexaoMeta(repo: Repositorio, clienteId?: string): Promise<RespostaStatusMeta> {
  if (!conexaoMetaLigada()) return { ativo: false, motivo: "desligado" };
  const token = tokenMeta();
  if (!token) return { ativo: false, motivo: "sem_token" };

  const situacao: SituacaoToken = await conferirToken(token);
  let contas: ContaMeta[] = [];
  let erroContas: string | null = null;
  if (situacao.valido) {
    try {
      contas = await listarContasMeta(token);
    } catch (e) {
      erroContas = e instanceof Error ? e.message : "Não deu para listar as Páginas.";
    }
  }
  const resposta: RespostaStatusMeta = {
    ativo: true,
    token: { ...situacao, porEtapa: permissoesPorEtapa(situacao.permissoes) },
    contas,
    erroContas,
  };
  if (!clienteId) return resposta;

  const config = await repo.carregarConfig();
  const cliente = config.clientes.find((c) => c.id === clienteId);
  if (!cliente) throw new Error("Cliente não encontrado.");
  const atual = (await repo.obterConexaoMeta(clienteId)) ?? conexaoVazia(clienteId);
  // sem conseguir listar as Páginas, não dá para afirmar nada sobre o cliente: fica como estava, com o erro anotado
  const avaliado = erroContas ? { status: atual.status, motivo: erroContas } : avaliarConexao(atual, contas, situacao);
  const conta = contas.find((c) => c.paginaId === atual.paginaId);
  const agora = new Date().toISOString();
  await repo.salvarConexaoMeta({
    ...atual,
    status: avaliado.status,
    // nome e @ podem mudar na Meta: guarda o que ela mostra hoje
    paginaNome: conta?.paginaNome ?? atual.paginaNome,
    instagramId: conta ? conta.instagramId : atual.instagramId,
    instagramUsuario: conta ? conta.instagramUsuario : atual.instagramUsuario,
    ultimaConferencia: agora,
    ultimoErro: avaliado.status === "com_problema" || erroContas ? avaliado.motivo : null,
  });
  resposta.cliente = {
    clienteId,
    status: avaliado.status,
    motivo: avaliado.motivo,
    paginaNome: conta?.paginaNome ?? atual.paginaNome,
    instagramUsuario: conta ? conta.instagramUsuario : atual.instagramUsuario,
    sugestao: atual.paginaId ? null : sugerirConta(contas, cliente.instagram),
    conferidoEm: agora,
    passosParaCliente: passosParaCliente(negocioMetaId()),
  };
  return resposta;
}
