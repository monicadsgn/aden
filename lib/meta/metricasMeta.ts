// Busca as métricas do Instagram na Meta (só no servidor, só leitura). O token vai sempre no cabeçalho (ver graph.ts).
// Cada consulta é independente: se uma falhar (permissão, métrica indisponível), ela vira "faltou" no resultado
// em vez de derrubar o resto, e nunca se inventa número.

import "server-only";
import { graph } from "./graph";
import { numeroDe, type ChaveMetrica, type DiaValor, type NumeroMetrica, type PostDestaque, type PublicoMetricas, type ResultadoMetricas } from "./metricas";

const seg = (d: Date) => String(Math.floor(d.getTime() / 1000));
const DIA = 86_400_000;

type Total = { data?: { total_value?: { value?: number } }[] };
type Serie = { data?: { values?: { value: number; end_time?: string }[] }[] };
type Demografia = { data?: { total_value?: { breakdowns?: { results?: { dimension_values: string[]; value: number }[] }[] } }[] };
type Midias = { data?: { id: string; caption?: string; media_type?: string; media_product_type?: string; timestamp?: string; permalink?: string; like_count?: number; comments_count?: number }[] };
type InsightsMidia = { data?: { name: string; values?: { value: number }[] }[] };

const tentar = async <T>(f: () => Promise<T>): Promise<T | null> => {
  try {
    return await f();
  } catch {
    return null;
  }
};

const total = (token: string, ig: string, metrica: string, desde: Date, ate: Date) =>
  tentar(async () => {
    const r = await graph<Total>(`${ig}/insights`, { token, parametros: { metric: metrica, metric_type: "total_value", period: "day", since: seg(desde), until: seg(ate) } });
    return r.data?.[0]?.total_value?.value ?? 0;
  });

const serie = (token: string, ig: string, metrica: string, desde: Date, ate: Date) =>
  tentar(async () => {
    const r = await graph<Serie>(`${ig}/insights`, { token, parametros: { metric: metrica, period: "day", since: seg(desde), until: seg(ate) } });
    // end_time é o fim do dia (começo do seguinte): o dia da medida é o anterior
    return (r.data?.[0]?.values ?? [])
      .filter((v) => v.end_time)
      .map((v): DiaValor => ({ dia: new Date(new Date(v.end_time as string).getTime() - 12 * 3_600_000).toISOString().slice(0, 10), valor: v.value ?? 0 }));
  });

const NOME_TIPO: Record<string, string> = { REELS: "Reel", CAROUSEL_ALBUM: "Carrossel", IMAGE: "Estático", VIDEO: "Vídeo" };
const titulo = (legenda?: string) => {
  const linha = (legenda ?? "").split("\n").map((l) => l.trim()).find(Boolean) ?? "";
  if (!linha) return "Post sem legenda";
  return linha.length > 60 ? `${linha.slice(0, 57).trimEnd()}...` : linha;
};

async function postsDoPeriodo(token: string, ig: string, desde: Date): Promise<PostDestaque[] | null> {
  const lista = await tentar(() =>
    graph<Midias>(`${ig}/media`, { token, parametros: { fields: "id,caption,media_type,media_product_type,timestamp,permalink,like_count,comments_count", limit: "50" } }),
  );
  if (!lista) return null;
  const noPeriodo = (lista.data ?? []).filter((m) => m.timestamp && new Date(m.timestamp) >= desde);
  const comNumeros = await Promise.all(
    noPeriodo.map(async (m) => {
      const ins = await tentar(() => graph<InsightsMidia>(`${m.id}/insights`, { token, parametros: { metric: "reach,shares,saved" } }));
      const num = (nome: string) => ins?.data?.find((d) => d.name === nome)?.values?.[0]?.value ?? null;
      const post: PostDestaque = {
        titulo: titulo(m.caption),
        tipo: NOME_TIPO[m.media_product_type === "REELS" ? "REELS" : (m.media_type ?? "")] ?? "Post",
        data: m.timestamp ? m.timestamp.slice(0, 10) : null,
        pessoasViram: num("reach"),
        compartilhamentos: num("shares"),
        guardaram: num("saved"),
        link: m.permalink ?? null,
      };
      return { post, pontos: (m.like_count ?? 0) + (m.comments_count ?? 0) + (post.guardaram ?? 0) + (post.compartilhamentos ?? 0) };
    }),
  );
  return comNumeros.sort((a, b) => b.pontos - a.pontos).slice(0, 4).map((x) => x.post);
}

async function publico(token: string, ig: string): Promise<PublicoMetricas | null> {
  const quebra = (b: "gender" | "age" | "city") =>
    tentar(async () => {
      const r = await graph<Demografia>(`${ig}/insights`, { token, parametros: { metric: "follower_demographics", period: "lifetime", metric_type: "total_value", breakdown: b } });
      return (r.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? []).map((x) => ({ chave: x.dimension_values[0], valor: x.value }));
    });
  const [genero, idade, cidade] = await Promise.all([quebra("gender"), quebra("age"), quebra("city")]);
  if (!genero && !idade && !cidade) return null;
  const soma = (genero ?? []).reduce((s, x) => s + x.valor, 0);
  const pct = (k: string) => {
    const v = genero?.find((x) => x.chave === k)?.valor;
    return v !== undefined && soma > 0 ? Math.round((v / soma) * 100) : null;
  };
  const faixa = [...(idade ?? [])].sort((a, b) => b.valor - a.valor)[0]?.chave ?? null;
  return {
    mulheresPct: pct("F"),
    homensPct: pct("M"),
    faixaPrincipal: faixa ? faixa.replace("-", " a ") : null,
    cidades: [...(cidade ?? [])].sort((a, b) => b.valor - a.valor).slice(0, 3).map((c) => c.chave.split(",")[0].trim()),
  };
}

const METRICAS: { chave: ChaveMetrica; metrica: string; falta: string }[] = [
  { chave: "viram", metrica: "views", falta: "visualizações" },
  { chave: "pessoas_alcancadas", metrica: "reach", falta: "pessoas alcançadas" },
  { chave: "interacoes", metrica: "total_interactions", falta: "interações" },
  { chave: "compartilhamentos", metrica: "shares", falta: "compartilhamentos" },
  { chave: "guardaram", metrica: "saves", falta: "salvamentos" },
  { chave: "visitas_perfil", metrica: "profile_views", falta: "visitas ao perfil" },
  { chave: "cliques_link", metrica: "profile_links_taps", falta: "cliques no link" },
];

export async function coletarMetricas(token: string, instagramId: string, usuario: string, dias: number): Promise<ResultadoMetricas> {
  const ate = new Date();
  const desde = new Date(ate.getTime() - dias * DIA);
  const desdeAnt = new Date(desde.getTime() - dias * DIA);
  const faltou: string[] = [];

  const totais = await Promise.all(
    METRICAS.map(async (m) => ({ m, atual: await total(token, instagramId, m.metrica, desde, ate), anterior: await total(token, instagramId, m.metrica, desdeAnt, desde) })),
  );
  const numeros: NumeroMetrica[] = [];
  for (const t of totais) {
    if (t.atual === null) faltou.push(t.m.falta);
    else numeros.push(numeroDe(t.m.chave, t.atual, t.anterior));
  }

  const [alcance, seguidores, seguidoresAnt, posts, pub] = await Promise.all([
    serie(token, instagramId, "reach", desde, ate),
    serie(token, instagramId, "follower_count", desde, ate),
    // a Meta só guarda 30 dias de seguidores novos: só dá para comparar quando os dois períodos cabem
    dias * 2 <= 29 ? serie(token, instagramId, "follower_count", desdeAnt, desde) : Promise.resolve(null),
    postsDoPeriodo(token, instagramId, desde),
    publico(token, instagramId),
  ]);
  if (seguidores) {
    const soma = (l: DiaValor[]) => l.reduce((s, d) => s + d.valor, 0);
    numeros.push(numeroDe("novos_seguidores", soma(seguidores), seguidoresAnt ? soma(seguidoresAnt) : null));
  } else faltou.push("seguidores novos");
  if (!posts) faltou.push("lista de posts");
  if (!pub) faltou.push("perfil do público");

  return {
    usuario,
    dias,
    de: desde.toISOString().slice(0, 10),
    ate: ate.toISOString().slice(0, 10),
    numeros,
    porDia: { alcance: alcance ?? [], seguidores: seguidores ?? [] },
    posts: posts ?? [],
    publico: pub,
    faltou,
  };
}
