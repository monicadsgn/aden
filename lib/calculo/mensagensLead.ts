// Mensagens prontas para o primeiro contato e os follow-ups do lead (26/10/2026).
// São SUGESTÕES para copiar ou abrir no WhatsApp; ninguém é avisado sozinho. Escritas do ponto de vista de quem
// recebe, curtas, sem pedir formulário nem etapa a mais e sem insinuar que o valor pesou. O texto e a hora de
// mandar são dos sócios: o Aden não decide quando (isso fica no "Próximo contato" e no limite de follow-ups).

import type { Lead } from "./crm";

export interface MensagemLead {
  id: "primeiro_contato" | "social_media" | "follow_up" | "retomada";
  titulo: string;
  /** quando faz sentido mandar, em uma frase */
  quando: string;
  texto: string;
}

const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] || "tudo bem";

export function mensagensDoLead(l: Lead): MensagemLead[] {
  const nome = primeiroNome(l.nome);
  const empresa = l.empresa?.trim();
  // "da empresa X" funciona com qualquer nome (sem errar o gênero do artigo)
  const daEmpresa = empresa ? ` da empresa ${empresa}` : "";
  const paraEmpresa = empresa ? ` para a empresa ${empresa}` : "";

  const primeiroContato: MensagemLead = {
    id: "primeiro_contato",
    titulo: "Primeiro contato",
    quando: "Logo depois que a pessoa responde o quiz.",
    texto: `Oi, ${nome}! Aqui é da Aden. Vi o quiz que você respondeu${paraEmpresa}. Na Aden você só paga a nossa gestão quando o tráfego trouxer venda, e a gente deixa a meta de vendas por escrito antes de começar. Posso te explicar por aqui como funciona no seu caso?`,
  };
  const socialMedia: MensagemLead = {
    id: "social_media",
    titulo: "Quer só social media",
    quando: "Para quem escolheu cuidar só do Instagram, sem anúncio.",
    texto: `Oi, ${nome}! Aqui é da Aden. Vi que você quer cuidar só do Instagram${daEmpresa}. Dá pra começar só por ele, sem anúncio. Posso te contar como a gente trabalha?`,
  };
  const followUp: MensagemLead = {
    id: "follow_up",
    titulo: "Follow-up do \"vou ver\"",
    quando: "Quando a pessoa disse que ia pensar e não voltou.",
    texto: `Oi, ${nome}! Passando pra saber se ficou alguma dúvida sobre como a gente trabalha. Se ajudar, explico de novo por aqui, é rapidinho.`,
  };
  const retomada: MensagemLead = {
    id: "retomada",
    titulo: "Retomada",
    quando: "Depois de um tempo sem resposta, para reabrir a conversa.",
    texto: `Oi, ${nome}! Tudo bem? Voltei pra ver se agora faz sentido a gente conversar sobre as vendas${daEmpresa}. Se for, me chama por aqui.`,
  };

  if (l.qualificacao === "desqualificado") return []; // o quiz já respondeu que o modelo não fecha; nada a empurrar
  if (l.qualificacao === "social_media") return [socialMedia, followUp, retomada];
  return [primeiroContato, followUp, retomada];
}

/** Link do WhatsApp com a mensagem pronta; sem telefone válido (com DDD), devolve null. */
export function linkWhatsApp(telefone: string, texto: string): string | null {
  const d = telefone.replace(/\D/g, "");
  if (d.length < 10 || d.length > 13) return null;
  const completo = d.length <= 11 ? `55${d}` : d;
  return `https://wa.me/${completo}?text=${encodeURIComponent(texto)}`;
}
