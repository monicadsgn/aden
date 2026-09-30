// Onboarding do cliente (Fase 5, passo 5). O texto é da Moni (aprovado em 30/09/2026) e fica editável em
// Configurações → Onboarding; o sistema não escreve nada. Por cliente, o Aden junta: o que está incluso (do pacote),
// como funciona cada serviço contratado, a garantia (da ficha) e prazos do contrato. Vira PDF pela impressão.
// Só sai o que o cliente pode ver: nada de horas, custo, piso ou divisão entre sócios.

import { objetoDoContrato } from "./contrato";
import { servicosDoCliente } from "./briefing";
import type { Configuracao, Id } from "./tipos";

/** Seções com parte automática: "incluso" (pacote), "servicos" (texto de cada serviço + garantia), "prazos" (contrato), "contato". */
export type ChaveSecao = "livre" | "incluso" | "servicos" | "prazos" | "contato";

export interface SecaoOnboarding {
  titulo: string;
  /** "- item" vira lista, "1. item" vira lista numerada, linha em branco separa parágrafos; "Pergunta? resposta" em lista realça a pergunta */
  texto: string;
  chave: ChaveSecao;
}

export interface ModeloOnboarding {
  secoes: SecaoOnboarding[];
  /** como funciona cada serviço (servicoId → texto) */
  textoServico: Record<Id, string>;
  /** frase da garantia; o que conta como resultado vem da ficha */
  textoGarantia: string | null;
  whatsapp: string | null;
  instagram: string | null;
  email: string | null;
  /** dias e horário de atendimento; entra onde o texto tiver {atendimento} */
  atendimento: string | null;
}

export const MODELO_ONBOARDING_VAZIO: ModeloOnboarding = {
  secoes: [],
  textoServico: {},
  textoGarantia: null,
  whatsapp: null,
  instagram: null,
  email: null,
  atendimento: null,
};

export type Bloco = { tipo: "paragrafo"; texto: string } | { tipo: "lista" | "numerada"; itens: { destaque: string | null; texto: string }[] };

/** Texto simples → blocos (parágrafo, lista, lista numerada). */
export function blocosDoTexto(texto: string): Bloco[] {
  const blocos: Bloco[] = [];
  let paragrafo: string[] = [];
  const fechar = () => {
    if (paragrafo.length) blocos.push({ tipo: "paragrafo", texto: paragrafo.join(" ") });
    paragrafo = [];
  };
  for (const bruta of texto.split("\n")) {
    const linha = bruta.trim();
    const lista = /^[-*•]\s+(.*)$/.exec(linha);
    const numerada = /^\d+[.)]\s+(.*)$/.exec(linha);
    if (!linha) {
      fechar();
      continue;
    }
    if (lista || numerada) {
      fechar();
      const tipo = lista ? "lista" : "numerada";
      const conteudo = (lista ?? numerada)![1];
      // "Pergunta? Resposta" → pergunta em destaque
      const q = /^(.+?\?)\s+(.+)$/.exec(conteudo);
      const item = q ? { destaque: q[1], texto: q[2] } : { destaque: null, texto: conteudo };
      const ultimo = blocos.at(-1);
      if (ultimo && ultimo.tipo === tipo) ultimo.itens.push(item);
      else blocos.push({ tipo, itens: [item] });
      continue;
    }
    paragrafo.push(linha);
  }
  fechar();
  return blocos;
}

export interface SecaoPronta {
  titulo: string;
  blocos: Bloco[];
}

/** O que o PDF recebe. Só texto para o cliente. */
export interface DocumentoOnboarding {
  cliente: string;
  arquivo: string;
  /** serviços contratados (ex.: "Social media + Tráfego pago") */
  subtitulo: string;
  /** contato da Aden no rodapé de cada página */
  rodape: string;
  secoes: SecaoPronta[];
  /** o que falta para gerar (vazio = pronto) */
  faltando: string[];
}

const vazio = (t: string | null | undefined) => !t || !t.trim();

export function montarOnboarding(config: Configuracao, clienteId: Id, modelo: ModeloOnboarding, hoje: string): DocumentoOnboarding {
  const c = config.clientes.find((x) => x.id === clienteId);
  if (!c) throw new Error("Cliente não encontrado.");
  const k = c.contrato ?? null;
  const faltando: string[] = [];
  if (!modelo.secoes.length) faltando.push("Texto do onboarding (Configurações → Onboarding)");
  const troca = (t: string) => t.replace(/\{atendimento\}/g, modelo.atendimento?.trim() || "");
  const usaAtendimento = modelo.secoes.some((s) => s.texto.includes("{atendimento}"));
  if (usaAtendimento && vazio(modelo.atendimento)) faltando.push("Dias e horário de atendimento (Configurações → Onboarding)");

  const secoes: SecaoPronta[] = [];
  for (const s of modelo.secoes) {
    const blocos = vazio(s.texto) ? [] : blocosDoTexto(troca(s.texto));
    if (s.chave === "incluso") {
      const itens = objetoDoContrato(config, c);
      if (!itens.length) faltando.push("Escopo do cliente (ficha → Personalizar escopo)");
      blocos.unshift({ tipo: "lista", itens: itens.map((i) => ({ destaque: null, texto: `${i.rotulo}: ${i.valor}` })) });
    }
    if (s.chave === "servicos") {
      const contratados = servicosDoCliente(config, c.id);
      for (const sv of config.servicos.filter((x) => contratados.has(x.id))) {
        const t = modelo.textoServico[sv.id]?.trim();
        if (!t) {
          faltando.push(`Como funciona o serviço ${sv.nome} (Configurações → Onboarding)`);
          continue;
        }
        blocos.push({ tipo: "lista", itens: [{ destaque: `${sv.nome}:`, texto: troca(t) }] });
      }
      if (!vazio(k?.garantiaResultado)) {
        if (vazio(modelo.textoGarantia)) faltando.push("Frase da garantia (Configurações → Onboarding)");
        else blocos.push({ tipo: "paragrafo", texto: `${modelo.textoGarantia!.trim()} ${k!.garantiaResultado!.trim()}` });
      }
    }
    if (s.chave === "prazos") {
      const itens: string[] = [];
      if (k?.limiteRodadas) itens.push(`Ajustes por peça: até ${k.limiteRodadas}`);
      if (k?.prazoAprovacaoDias) itens.push(`Prazo de aprovação: ${k.prazoAprovacaoDias} dias`);
      if (k?.limiteReunioesMes) itens.push(`Reuniões por mês: até ${k.limiteReunioesMes}`);
      if (itens.length) blocos.unshift({ tipo: "lista", itens: itens.map((texto) => ({ destaque: null, texto })) });
    }
    if (s.chave === "contato") {
      const partes = [
        modelo.whatsapp && `WhatsApp ${modelo.whatsapp.trim()}`,
        modelo.instagram && `Instagram ${modelo.instagram.trim()}`,
        modelo.email?.trim(),
        modelo.atendimento?.trim(),
      ].filter(Boolean) as string[];
      if (vazio(modelo.whatsapp)) faltando.push("WhatsApp (Configurações → Onboarding)");
      if (vazio(modelo.instagram)) faltando.push("Instagram (Configurações → Onboarding)");
      if (vazio(modelo.email)) faltando.push("E-mail (Configurações → Onboarding)");
      if (vazio(modelo.atendimento) && !usaAtendimento) faltando.push("Dias e horário de atendimento (Configurações → Onboarding)");
      if (partes.length) blocos.push({ tipo: "paragrafo", texto: partes.join(" · ") });
    }
    if (blocos.length) secoes.push({ titulo: s.titulo.trim(), blocos });
  }

  const mes = hoje.slice(0, 7).split("-").reverse().join("-");
  const nomeArquivo = c.nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w]+/g, "");
  const doCliente = servicosDoCliente(config, c.id);
  const subtitulo = config.servicos
    .filter((x) => doCliente.has(x.id))
    .map((x) => x.nome)
    .join(" + ");
  const rodape = [modelo.whatsapp, modelo.instagram, modelo.email].map((x) => x?.trim()).filter(Boolean).join(" | ");
  return { cliente: c.nome, arquivo: `Onboarding_Aden_${nomeArquivo}_${mes}`, subtitulo, rodape, secoes, faltando: [...new Set(faltando)] };
}
