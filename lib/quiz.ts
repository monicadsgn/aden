// Entrada pública do quiz de conversão de leads (26/10/2026).
// A página do quiz manda dois tipos de pedido para /api/quiz: "passo" (chegou numa tela) e "enviar" (formulário final).
// Aqui fica só a conferência do que chega e a tradução para as funções do banco (migration 0046).
// A regra de quem é qualificado, com ressalva ou desqualificado mora na página do quiz (decisão do Áleff);
// o Aden só guarda o resultado. Nenhum número de negócio aqui: os limites abaixo são só de segurança contra spam.

import { createHash } from "node:crypto";
import { QUALIFICACOES, type Qualificacao, type RespostaQuiz } from "./calculo/crm";

/** Quem preenche tudo mais rápido que isso é robô: o pedido é aceito e jogado fora, sem avisar. */
export const TEMPO_MINIMO_MS = 4000;
export const LIMITE_ENVIOS_POR_HORA = 15;
export const LIMITE_PASSOS_POR_HORA = 200;
export const TAMANHO_MAXIMO_PEDIDO = 20_000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PASSO = /^[a-z0-9_]{1,20}$/;

/** De qual anúncio a pessoa veio (utm_*). Só estas cinco chaves, textos curtos. */
export type CampanhaQuiz = Partial<Record<"source" | "medium" | "campaign" | "content" | "term", string>>;
const CHAVES_CAMPANHA = ["source", "medium", "campaign", "content", "term"] as const;

export interface EnvioQuiz {
  sessao: string;
  nome: string;
  telefone: string;
  empresa: string;
  instagram: string;
  cidade: string;
  qualificacao: Qualificacao;
  motivos: string;
  respostas: RespostaQuiz[];
  campanha: CampanhaQuiz | null;
}

export type PedidoQuiz =
  | { acao: "passo"; sessao: string; passo: string; campanha: CampanhaQuiz | null }
  | { acao: "enviar"; descartar: boolean; dados: EnvioQuiz };

const texto = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Campanha nunca derruba o pedido: o que não for texto curto simplesmente fica de fora. */
export function campanhaDoQuiz(v: unknown): CampanhaQuiz | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const c = v as Record<string, unknown>;
  const out: CampanhaQuiz = {};
  for (const k of CHAVES_CAMPANHA) {
    const t = texto(c[k], 120);
    if (t) out[k] = t;
  }
  return Object.keys(out).length ? out : null;
}

/** Valida o corpo do POST. Erro com frase simples quando não dá. */
export function pedidoDoQuiz(corpo: unknown): PedidoQuiz {
  if (!corpo || typeof corpo !== "object") throw new Error("Pedido inválido.");
  const c = corpo as Record<string, unknown>;
  const sessao = typeof c.sessao === "string" ? c.sessao : "";
  if (!UUID.test(sessao)) throw new Error("Pedido inválido.");

  if (c.acao === "passo") {
    if (typeof c.passo !== "string" || !PASSO.test(c.passo)) throw new Error("Pedido inválido.");
    return { acao: "passo", sessao, passo: c.passo, campanha: campanhaDoQuiz(c.campanha) };
  }

  if (c.acao === "enviar") {
    const nome = texto(c.nome, 120);
    if (nome.length < 2) throw new Error("Informe o nome.");
    const telefone = texto(c.telefone, 40);
    const digitos = telefone.replace(/\D/g, "");
    if (digitos.length < 10 || digitos.length > 13) throw new Error("Informe o WhatsApp com DDD.");
    const empresa = texto(c.empresa, 120);
    if (!empresa) throw new Error("Informe a empresa.");
    if (!QUALIFICACOES.includes(c.qualificacao as Qualificacao)) throw new Error("Pedido inválido.");

    const motivos = Array.isArray(c.motivos)
      ? c.motivos.map((m) => texto(m, 200)).filter(Boolean).join("; ").slice(0, 1000)
      : texto(c.motivos, 1000);

    const respostas: RespostaQuiz[] = [];
    if (Array.isArray(c.respostas)) {
      for (const r of c.respostas.slice(0, 30)) {
        if (!r || typeof r !== "object") continue;
        const pergunta = texto((r as Record<string, unknown>).pergunta, 200);
        const resposta = texto((r as Record<string, unknown>).resposta, 300);
        if (pergunta && resposta) respostas.push({ pergunta, resposta });
      }
    }

    // armadilha para robô: campo escondido que gente de verdade não preenche
    const robo = (typeof c.site === "string" && c.site.trim() !== "") || !(typeof c.tempoMs === "number" && c.tempoMs >= TEMPO_MINIMO_MS);

    return {
      acao: "enviar",
      descartar: robo,
      dados: {
        sessao,
        nome,
        telefone,
        empresa,
        instagram: texto(c.instagram, 120),
        cidade: texto(c.cidade, 80),
        qualificacao: c.qualificacao as Qualificacao,
        motivos,
        respostas,
        campanha: campanhaDoQuiz(c.campanha),
      },
    };
  }

  throw new Error("Pedido inválido.");
}

/** Identificador do visitante para o limite por hora: hash do endereço, nunca o endereço. */
export function chaveDoVisitante(ip: string, sal: string): string {
  return createHash("sha256").update(`${sal}|${ip}`).digest("hex");
}

/** Endereço do visitante pelos cabeçalhos da Vercel. */
export function ipDoPedido(cabecalhos: { get(nome: string): string | null }): string {
  const encaminhado = cabecalhos.get("x-forwarded-for")?.split(",")[0]?.trim();
  return encaminhado || cabecalhos.get("x-real-ip")?.trim() || "desconhecido";
}
