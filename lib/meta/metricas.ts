// Métricas do Instagram (19/11/2026): só leitura. Regras puras e testadas: períodos, rótulos em linguagem simples,
// comparação com o período anterior. Nada aqui chama a Meta nem conhece token. Nunca inventa número:
// o que a Meta não devolver fica fora (null), e o texto diz isso.

export const DIAS_MAX = 30; // a Meta limita o intervalo de cada consulta de insights

export type ChaveMetrica = "viram" | "pessoas_alcancadas" | "interacoes" | "compartilhamentos" | "guardaram" | "visitas_perfil" | "cliques_link" | "novos_seguidores";

export type NumeroMetrica = {
  chave: ChaveMetrica;
  rotulo: string;
  /** o que isso quer dizer, em português simples */
  explica: string;
  valor: number;
  /** mesmo tamanho de período, logo antes; null quando a Meta não dá esse histórico */
  anterior: number | null;
  /** variação em %, uma casa decimal; null sem anterior ou com anterior zero */
  variacaoPct: number | null;
};

export type DiaValor = { dia: string; valor: number };

export type PostDestaque = { titulo: string; tipo: string; data: string | null; pessoasViram: number | null; compartilhamentos: number | null; guardaram: number | null; link: string | null };

export type PublicoMetricas = { mulheresPct: number | null; homensPct: number | null; faixaPrincipal: string | null; cidades: string[] };

export type ResultadoMetricas = {
  usuario: string;
  dias: number;
  de: string;
  ate: string;
  numeros: NumeroMetrica[];
  /** valor de cada dia (alcance e seguidores novos), para os gráficos; vazio quando a Meta não devolveu */
  porDia: { alcance: DiaValor[]; seguidores: DiaValor[] };
  posts: PostDestaque[];
  publico: PublicoMetricas | null;
  /** o que a Meta não devolveu, em português, para o texto do relatório avisar em vez de inventar */
  faltou: string[];
};

export type RespostaMetricas = { ativo: false; motivo: string } | ({ ativo: true } & ResultadoMetricas);

export const ROTULOS: Record<ChaveMetrica, { rotulo: string; explica: string }> = {
  viram: { rotulo: "Visualizações", explica: "Quantas vezes os posts foram vistos. A mesma pessoa pode ver mais de uma vez." },
  pessoas_alcancadas: { rotulo: "Pessoas alcançadas", explica: "Quantas pessoas diferentes viram os posts, contando cada pessoa uma vez." },
  interacoes: { rotulo: "Interações", explica: "Curtidas, comentários, compartilhamentos e salvamentos somados: gente que reagiu ao que viu." },
  compartilhamentos: { rotulo: "Compartilhamentos", explica: "Quantas vezes alguém mandou um post para outra pessoa. É um dos melhores sinais de que o conteúdo valeu." },
  guardaram: { rotulo: "Salvamentos", explica: "Quantas vezes alguém guardou um post para ver depois." },
  visitas_perfil: { rotulo: "Visitas ao perfil", explica: "Quantas vezes alguém abriu o perfil depois de ver um post." },
  cliques_link: { rotulo: "Cliques no link", explica: "Quantas vezes alguém tocou no link que fica no perfil." },
  novos_seguidores: { rotulo: "Seguidores novos", explica: "Quantas pessoas passaram a seguir o perfil no período." },
};

export const limitarDias = (dias: number | null | undefined): number => {
  const n = Math.trunc(Number(dias));
  if (!Number.isFinite(n) || n < 1) return 28;
  return Math.min(n, DIAS_MAX);
};

/** Variação em %, uma casa decimal. Sem período anterior (ou anterior zero) não há como comparar: devolve null. */
export function variacaoPct(valor: number, anterior: number | null | undefined): number | null {
  if (anterior == null || anterior <= 0) return null;
  return Math.round(((valor - anterior) / anterior) * 1000) / 10;
}

export function numeroDe(chave: ChaveMetrica, valor: number, anterior: number | null): NumeroMetrica {
  return { chave, ...ROTULOS[chave], valor, anterior, variacaoPct: variacaoPct(valor, anterior) };
}

/** "480,5% a mais que antes", "12% a menos que antes" ou o aviso de que não há base de comparação. */
export function fraseComparacao(n: Pick<NumeroMetrica, "valor" | "anterior" | "variacaoPct">): string {
  if (n.anterior == null) return "Sem período anterior para comparar: este período vira a base.";
  if (n.variacaoPct == null) return n.valor > 0 ? "No período anterior foi zero, então não dá para calcular a porcentagem." : "Segue zerado, como antes.";
  const p = Math.abs(n.variacaoPct).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  if (n.variacaoPct === 0) return "Igual ao período anterior.";
  return `${p}% a ${n.variacaoPct > 0 ? "mais" : "menos"} que antes.`;
}

/** Amostra pequena é indício, não prova. Usado pelo relatório quando há poucos posts no período. */
export const amostraPequena = (qtdPosts: number) => qtdPosts > 0 && qtdPosts < 5;

/** "Resposta curta" do relatório, montada só com o que os números mostram (nada de exagero nem palpite). */
export function respostaCurta(numeros: NumeroMetrica[]): { titulo: string; texto: string } {
  const comparaveis = numeros.filter((n) => n.variacaoPct != null);
  if (comparaveis.length === 0) return { titulo: "Este período vira a base", texto: "Não há um período anterior para comparar, então estes números são o ponto de partida das próximas comparações." };
  const subiram = comparaveis.filter((n) => (n.variacaoPct as number) > 0);
  const baixaram = comparaveis.filter((n) => (n.variacaoPct as number) < 0);
  const maior = [...comparaveis].sort((a, b) => (b.variacaoPct as number) - (a.variacaoPct as number))[0];
  if (baixaram.length === 0 && subiram.length > 0)
    return { titulo: "Tudo subiu", texto: `Todas as métricas comparáveis subiram em relação ao período anterior. ${maior.rotulo} foi a que mais cresceu.` };
  if (subiram.length === 0 && baixaram.length > 0) return { titulo: "Tudo caiu", texto: "As métricas comparáveis ficaram abaixo do período anterior. Vale olhar o que mudou nos posts e nos anúncios." };
  return { titulo: "Resultado misto", texto: `${subiram.length} métrica(s) subiram e ${baixaram.length} baixaram em relação ao período anterior. ${maior.rotulo} foi a que mais cresceu.` };
}
