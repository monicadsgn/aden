// Publicar no Instagram, etapa 2 (19/11/2026). Usado pela rota /api/meta/publicar e pelo conector.
// Travas, todas precisam estar certas: META_CONEXAO_ATIVA=1, META_PUBLICAR_ATIVO=1, o @ na lista META_PUBLICAR_CONTAS,
// cliente "conectado" com "publicar ativo" ligado na ficha e, para publicar de verdade, a confirmação escrita.
// Sem dryRun=false e sem a confirmação, só devolve a prévia. Nada aqui devolve ou loga token.

import "server-only";
import type { Repositorio } from "../dados/repositorio";
import type { RespostaPublicarMeta as RespostaPublicar } from "./estado";
import { conexaoMetaLigada, ErroMeta, publicarNoInstagram, tokenMeta } from "./graph";
import { confirmacaoConfere, confirmacaoEsperada, contasLiberadas, montarPlano, type EntradaPublicar } from "./publicacao";

export type PedidoPublicar = EntradaPublicar & { clienteId: string; dryRun?: boolean; confirmacao?: string | null };

export const publicacaoMetaLigada = () => process.env.META_PUBLICAR_ATIVO?.trim() === "1";

export async function publicarMeta(repo: Repositorio, pedido: PedidoPublicar): Promise<RespostaPublicar> {
  if (!conexaoMetaLigada()) return { ativo: false, motivo: "desligado" };
  if (!publicacaoMetaLigada()) return { ativo: false, motivo: "publicacao_desligada" };
  const token = tokenMeta();
  if (!token) return { ativo: false, motivo: "sem_token" };

  const conexao = await repo.obterConexaoMeta(pedido.clienteId);
  if (!conexao || conexao.status !== "conectado" || !conexao.instagramId || !conexao.instagramUsuario)
    throw new Error("Este cliente ainda não está conectado ao Instagram. Use \"Conferir conexão\" na ficha primeiro.");
  if (!conexao.publicarAtivo) throw new Error("A publicação está desligada na ficha deste cliente. Ligue \"Publicar no Instagram\" antes.");
  const arroba = conexao.instagramUsuario.toLowerCase();
  if (!contasLiberadas(process.env.META_PUBLICAR_CONTAS).includes(arroba)) throw new Error(`O @${arroba} não está na lista de contas liberadas para publicar (META_PUBLICAR_CONTAS).`);

  const montado = montarPlano(pedido);
  if ("erro" in montado) throw new Error(montado.erro);
  const { plano } = montado;
  const esperada = confirmacaoEsperada(arroba, plano);

  if (pedido.dryRun !== false) {
    return {
      ativo: true,
      dryRun: true,
      conta: arroba,
      tipo: plano.tipo,
      imagens: plano.imagens.length,
      legenda: plano.legenda,
      confirmacaoNecessaria: esperada,
      aviso: "Isto é só uma prévia: nada foi publicado. Para publicar de verdade, envie dryRun=false e escreva exatamente a confirmação.",
    };
  }
  if (!confirmacaoConfere(pedido.confirmacao, esperada)) throw new Error(`Para publicar, escreva exatamente: ${esperada}`);

  try {
    const r = await publicarNoInstagram(token, conexao.instagramId, plano);
    await repo.salvarConexaoMeta({ ...conexao, ultimoErro: null });
    return { ativo: true, dryRun: false, conta: arroba, tipo: plano.tipo, postId: r.postId, link: r.link };
  } catch (e) {
    throw new Error(e instanceof ErroMeta ? e.message : "Não deu para publicar agora.");
  }
}
