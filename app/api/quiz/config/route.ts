// O que a página pública do quiz precisa saber do painel do Aden: WhatsApp, Instagram e códigos de pixel.
// Tudo isso já é público por natureza (aparece na própria página e nos anúncios), então não tem nada interno aqui.
// A chamada ao banco usa o segredo da rota, como o resto do quiz.

import { banco, ler } from "@/lib/quizServidor";

const VAZIA = { whatsapp: null, instagram: null, metaPixel: null, googleTag: null };

function resposta(corpo: Record<string, unknown>, status = 200) {
  // um minuto de cache: trocar o código do pixel no painel vale quase na hora
  return Response.json(corpo, { status, headers: { "Cache-Control": status === 200 ? "public, max-age=60" : "no-store" } });
}

export async function GET() {
  const segredo = ler("QUIZ_SEGREDO");
  const sb = banco();
  // sem segredo ou sem banco a página usa os valores de reserva dela; nada quebra
  if (!segredo || !sb) return resposta(VAZIA);
  const { data, error } = await sb.rpc("quiz_config_publica", { p_segredo: segredo });
  if (error || !data || typeof data !== "object") return resposta(VAZIA);
  const c = data as Record<string, unknown>;
  const t = (v: unknown) => (typeof v === "string" && v ? v : null);
  return resposta({ whatsapp: t(c.whatsapp), instagram: t(c.instagram), metaPixel: t(c.metaPixel), googleTag: t(c.googleTag) });
}
