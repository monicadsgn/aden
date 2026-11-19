// Publicar no Instagram, etapa 2 (19/11/2026): regras puras e testadas. Nada aqui chama a Meta nem conhece token.
// Só foto (1 imagem) e carrossel (2 a 10 imagens), em .jpg. Antes de publicar de verdade sempre há uma prévia
// (dryRun) e a pessoa precisa escrever a confirmação. Reels, stories e Facebook ficam para depois.

export const LIMITE_LEGENDA = 2200;
export const MAX_IMAGENS = 10;

export type PlanoPublicacao = {
  tipo: "foto" | "carrossel";
  imagens: string[];
  legenda: string;
};

export type EntradaPublicar = { imagens: string[]; legenda?: string | null };

const ehJpg = (u: URL) => /\.jpe?g$/i.test(u.pathname);

/** Confere as imagens e a legenda e monta o plano. Erros em português simples, um por vez. */
export function montarPlano(entrada: EntradaPublicar): { plano: PlanoPublicacao } | { erro: string } {
  const bruto = (entrada.imagens ?? []).map((i) => String(i ?? "").trim()).filter(Boolean);
  if (bruto.length === 0) return { erro: "Falta pelo menos uma imagem (link https terminando em .jpg)." };
  if (bruto.length > MAX_IMAGENS) return { erro: `O Instagram aceita até ${MAX_IMAGENS} imagens num carrossel.` };
  const imagens: string[] = [];
  for (const texto of bruto) {
    let u: URL;
    try {
      u = new URL(texto);
    } catch {
      return { erro: `Link de imagem inválido: ${texto.slice(0, 60)}` };
    }
    if (u.protocol !== "https:") return { erro: "Os links das imagens precisam começar com https://." };
    if (u.username || u.password) return { erro: "O link da imagem não pode ter usuário ou senha." };
    if (!ehJpg(u)) return { erro: "Por enquanto só imagens .jpg (ou .jpeg) funcionam. Converta e mande de novo." };
    imagens.push(u.toString());
  }
  if (new Set(imagens).size !== imagens.length) return { erro: "Há imagens repetidas na lista." };
  const legenda = (entrada.legenda ?? "").trim();
  if (legenda.length > LIMITE_LEGENDA) return { erro: `A legenda tem ${legenda.length} caracteres e o Instagram aceita até ${LIMITE_LEGENDA}.` };
  return { plano: { tipo: imagens.length === 1 ? "foto" : "carrossel", imagens, legenda } };
}

/** Frase que a pessoa escreve para confirmar. Inclui o @ da conta para não publicar na errada. */
export function confirmacaoEsperada(instagramUsuario: string, plano: PlanoPublicacao): string {
  const arroba = instagramUsuario.trim().replace(/^@/, "").toLowerCase();
  return plano.tipo === "foto" ? `publicar foto em @${arroba}` : `publicar carrossel de ${plano.imagens.length} em @${arroba}`;
}

export const confirmacaoConfere = (escrita: string | null | undefined, esperada: string) => (escrita ?? "").trim().toLowerCase().replace(/\s+/g, " ") === esperada;

/** Lista de @ liberados para publicar (META_PUBLICAR_CONTAS, separados por vírgula). Vazia = ninguém. */
export function contasLiberadas(valor: string | null | undefined): string[] {
  return (valor ?? "")
    .split(",")
    .map((x) => x.trim().replace(/^@/, "").toLowerCase())
    .filter(Boolean);
}

export type { RespostaPublicarMeta as RespostaPublicar } from "./estado";
