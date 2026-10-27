// Painel do quiz (27/10/2026): o que os sócios trocam pela tela do Aden sem pedir mudança no código.
// Puro e testado (como o resto de lib/calculo). Aqui só se confere e se arruma o que a pessoa escreve;
// o banco confere de novo (migration 0047). Nenhum número de negócio: WhatsApp, Instagram e códigos de pixel
// são dados de contato e de anúncio, começam vazios.

export interface ConfigQuiz {
  /** só números, com código do país (ex.: 5581...). Vazio = a página usa o valor de reserva dela */
  whatsapp: string;
  /** endereço completo do Instagram da Aden */
  instagramUrl: string;
  /** ID do pixel da Meta (só números) */
  metaPixel: string;
  /** tag do Google: G-..., AW-... ou GTM-... */
  googleTag: string;
}

export const configQuizVazia = (): ConfigQuiz => ({ whatsapp: "", instagramUrl: "", metaPixel: "", googleTag: "" });

export type ErrosConfigQuiz = Partial<Record<keyof ConfigQuiz, string>>;

const soDigitos = (t: string) => t.replace(/\D/g, "");

/** Arruma o WhatsApp: tira máscara e põe o código do Brasil quando a pessoa escreveu só com DDD. */
function normalizarWhatsApp(t: string): { valor: string; erro?: string } {
  const bruto = t.trim();
  if (!bruto) return { valor: "" };
  let d = soDigitos(bruto);
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  if (d.length < 12 || d.length > 13) return { valor: bruto, erro: "Escreva o WhatsApp com DDD, por exemplo (81) 99999-9999." };
  return { valor: d };
}

/** Aceita @usuario, instagram.com/usuario ou o endereço inteiro; guarda sempre o endereço completo. */
function normalizarInstagram(t: string): { valor: string; erro?: string } {
  const bruto = t.trim();
  if (!bruto) return { valor: "" };
  const m = bruto.match(/^(?:https?:\/\/)?(?:www\.)?(?:instagram\.com\/)?@?([A-Za-z0-9._]{1,30})\/?(?:\?.*)?$/i);
  if (!m) return { valor: bruto, erro: "Escreva o @ do Instagram ou o endereço dele, por exemplo @grupoaden." };
  return { valor: `https://www.instagram.com/${m[1]}/` };
}

/** Aceita só o número ou o pedaço de código que o Gerenciador de Eventos mostra (fbq('init', '123...')). */
function normalizarMeta(t: string): { valor: string; erro?: string } {
  const bruto = t.trim();
  if (!bruto) return { valor: "" };
  if (/^\d{5,20}$/.test(bruto)) return { valor: bruto };
  const achado = bruto.match(/fbq\(\s*['"]init['"]\s*,\s*['"]?(\d{5,20})/);
  if (achado) return { valor: achado[1] };
  return { valor: bruto, erro: "O código do pixel da Meta tem só números. Cole só o número, sem letras." };
}

/** Aceita G-XXXX, AW-XXXX ou GTM-XXXX, ou um pedaço de código do Google com isso dentro. */
function normalizarGoogle(t: string): { valor: string; erro?: string } {
  const bruto = t.trim();
  if (!bruto) return { valor: "" };
  const achado = bruto.toUpperCase().match(/\b(G|AW|GTM)-[A-Z0-9]{4,20}\b/);
  if (achado) return { valor: achado[0] };
  return { valor: bruto, erro: "O código do Google começa com G-, AW- ou GTM- (por exemplo G-ABC123XYZ)." };
}

/** Confere e arruma tudo de uma vez. Se tiver erro, `config` devolve o que foi escrito e `erros` diz onde. */
export function normalizarConfigQuiz(entrada: Partial<ConfigQuiz>): { config: ConfigQuiz; erros: ErrosConfigQuiz } {
  const w = normalizarWhatsApp(entrada.whatsapp ?? "");
  const i = normalizarInstagram(entrada.instagramUrl ?? "");
  const m = normalizarMeta(entrada.metaPixel ?? "");
  const g = normalizarGoogle(entrada.googleTag ?? "");
  const erros: ErrosConfigQuiz = {};
  if (w.erro) erros.whatsapp = w.erro;
  if (i.erro) erros.instagramUrl = i.erro;
  if (m.erro) erros.metaPixel = m.erro;
  if (g.erro) erros.googleTag = g.erro;
  return { config: { whatsapp: w.valor, instagramUrl: i.valor, metaPixel: m.valor, googleTag: g.valor }, erros };
}

// ─── Link do anúncio com campanha ───────────────────────────────────────────

export interface CampanhaDoLink {
  /** onde o anúncio roda (ex.: meta, google, instagram) */
  fonte: string;
  /** tipo de mídia (ex.: pago, organico, story) */
  midia?: string;
  /** nome da campanha */
  campanha: string;
  /** qual anúncio ou criativo */
  conteudo?: string;
  /** palavra-chave (anúncio de busca) */
  termo?: string;
}

/** minúsculas, sem acento, espaço vira hífen: "Black Friday 2026" → "black-friday-2026" */
export function limparUtm(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

/** Endereço do quiz com a campanha grudada. Sem fonte ou sem nome da campanha não faz sentido: devolve null. */
export function linkDoQuiz(base: string, c: CampanhaDoLink): string | null {
  const fonte = limparUtm(c.fonte);
  const campanha = limparUtm(c.campanha);
  if (!fonte || !campanha) return null;
  const q = new URLSearchParams({ utm_source: fonte, utm_campaign: campanha });
  const midia = limparUtm(c.midia ?? "");
  const conteudo = limparUtm(c.conteudo ?? "");
  const termo = limparUtm(c.termo ?? "");
  if (midia) q.set("utm_medium", midia);
  if (conteudo) q.set("utm_content", conteudo);
  if (termo) q.set("utm_term", termo);
  return `${base.replace(/[?#].*$/, "").replace(/\/+$/, "")}?${q.toString()}`;
}
