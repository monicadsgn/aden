// Contrato do cliente (Fase 5, passo 3). O Aden monta o texto com os dados da ficha e manda para assinatura
// eletrônica (Autentique). Nenhuma cláusula jurídica é escrita pelo sistema: as partes que mudam a cada cliente
// (partes, objeto, valor, prazo, condições, garantia) saem da ficha como dados; obrigações e disposições gerais são
// o texto dos sócios, guardado em Configurações → Contrato. Faltou algo → aparece em "faltando" e não envia.

import { formatarMoeda } from "../formato";
import type { ClienteBase, Configuracao, Id } from "./tipos";

/** Pessoa que assina o contrato (pela Aden ou pelo cliente). */
export interface Signatario {
  nome: string;
  email: string;
}

/** O que é igual em todo contrato da Aden. Tudo começa vazio: é texto dos sócios. */
export interface ModeloContrato {
  contratadaNome: string | null;
  /** CNPJ (ou CPF) da contratada */
  contratadaDocumento: string | null;
  contratadaEndereco: string | null;
  /** obrigações das partes (texto dos sócios, parágrafos separados por linha em branco) */
  obrigacoes: string | null;
  /** disposições gerais (foro, rescisão, confidencialidade…), texto dos sócios */
  disposicoes: string | null;
  /** quem assina pela Aden */
  signatariosAden: Signatario[];
}

export const MODELO_VAZIO: ModeloContrato = {
  contratadaNome: null,
  contratadaDocumento: null,
  contratadaEndereco: null,
  obrigacoes: null,
  disposicoes: null,
  signatariosAden: [],
};

export interface SecaoContrato {
  titulo: string;
  /** linhas "rótulo: valor" (dados) */
  itens?: { rotulo: string; valor: string }[];
  /** parágrafos de texto (obrigações e disposições dos sócios) */
  paragrafos?: string[];
}

export interface DocumentoContrato {
  titulo: string;
  secoes: SecaoContrato[];
  signatarios: Signatario[];
  /** o que falta para poder enviar (vazio = pronto) */
  faltando: string[];
}

const vazio = (t: string | null | undefined) => !t || !t.trim();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const data = (iso: string | null | undefined) => {
  if (!iso) return null;
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
};

export const paragrafos = (texto: string | null | undefined) =>
  (texto ?? "")
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);

/** Entregas por mês do escopo guardado, com o nome que o cliente vê. */
export function objetoDoContrato(config: Configuracao, c: ClienteBase): { rotulo: string; valor: string }[] {
  const linhas: { rotulo: string; valor: string }[] = [];
  for (const e of c.escopo?.entregas ?? []) {
    const q = e.quantidade ?? 0;
    if (!q) continue;
    const t = config.tiposEntrega.find((x) => x.id === e.tipoEntregaId);
    if (!t) continue;
    const nome = t.nomeCliente?.trim() || t.nome;
    const servico = config.servicos.find((s) => s.id === t.servicoId)?.nome;
    linhas.push({ rotulo: servico ? `${servico} · ${nome}` : nome, valor: `${q} por mês` });
  }
  return linhas;
}

/** Monta o contrato do cliente. Não inventa nada: o que não está na ficha ou no modelo entra em "faltando". */
export function montarContrato(config: Configuracao, clienteId: Id, modelo: ModeloContrato): DocumentoContrato {
  const c = config.clientes.find((x) => x.id === clienteId);
  if (!c) throw new Error("Cliente não encontrado.");
  const k = c.contrato ?? null;
  const faltando: string[] = [];
  const secoes: SecaoContrato[] = [];

  // 1. Partes
  if (vazio(modelo.contratadaNome)) faltando.push("Nome da contratada (Configurações → Contrato)");
  if (vazio(modelo.contratadaDocumento)) faltando.push("CNPJ da contratada (Configurações → Contrato)");
  const contratante = c.razaoSocial?.trim() || c.nome;
  if (vazio(c.documento)) faltando.push("CPF ou CNPJ do cliente (ficha → Dados)");
  if (vazio(c.endereco)) faltando.push("Endereço do cliente (ficha → Dados)");
  secoes.push({
    titulo: "Partes",
    itens: [
      { rotulo: "Contratada", valor: [modelo.contratadaNome, modelo.contratadaDocumento, modelo.contratadaEndereco].filter((x) => !vazio(x)).join(" · ") || "—" },
      { rotulo: "Contratante", valor: [contratante, c.documento, c.endereco].filter((x) => !vazio(x)).join(" · ") },
      ...(!vazio(c.contato) ? [{ rotulo: "Responsável pelo contratante", valor: c.contato!.trim() }] : []),
    ],
  });

  // 2. Objeto
  const objeto = objetoDoContrato(config, c);
  if (!objeto.length) faltando.push("Escopo do cliente (ficha → Personalizar escopo)");
  secoes.push({ titulo: "Objeto: o que está incluso por mês", itens: objeto });

  // 3. Valor e pagamento
  if (!c.valorMensalCentavos) faltando.push("Valor mensal (ficha → Contrato)");
  const vencimento = k?.venceUltimoDiaUtil ? "último dia útil de cada mês" : k?.diaPagamento ? `dia ${k.diaPagamento} de cada mês` : null;
  if (!vencimento) faltando.push("Dia do pagamento (ficha → Contrato)");
  secoes.push({
    titulo: "Valor e pagamento",
    itens: [
      { rotulo: "Valor mensal", valor: c.valorMensalCentavos ? formatarMoeda(c.valorMensalCentavos) : "—" },
      { rotulo: "Vencimento", valor: vencimento ?? "—" },
      ...(!vazio(k?.inicioCobranca) ? [{ rotulo: "Início da cobrança", valor: k!.inicioCobranca.trim() }] : []),
    ],
  });

  // 4. Prazo
  if (!k?.inicio) faltando.push("Data de início (ficha → Contrato)");
  const prazo: { rotulo: string; valor: string }[] = [{ rotulo: "Início", valor: data(k?.inicio) ?? "—" }];
  if (k?.fim) prazo.push({ rotulo: "Fim", valor: data(k.fim)! });
  if (k?.prazoMinimoMeses) prazo.push({ rotulo: "Prazo mínimo", valor: `${k.prazoMinimoMeses} ${k.prazoMinimoMeses === 1 ? "mês" : "meses"}` });
  if (k?.avisoPrevioDias) prazo.push({ rotulo: "Aviso prévio para encerrar", valor: `${k.avisoPrevioDias} dias` });
  secoes.push({ titulo: "Prazo", itens: prazo });

  // 5. Condições (só o que foi preenchido)
  const cond: { rotulo: string; valor: string }[] = [];
  if (k?.limiteReunioesMes) cond.push({ rotulo: "Reuniões por mês", valor: `até ${k.limiteReunioesMes}` });
  if (k?.limiteRodadas) cond.push({ rotulo: "Rodadas de alteração por peça", valor: `até ${k.limiteRodadas}` });
  if (k?.prazoAprovacaoDias) cond.push({ rotulo: "Prazo do cliente para aprovar", valor: `${k.prazoAprovacaoDias} dias` });
  if (k?.prazoEntregaDias) cond.push({ rotulo: "Prazo de entrega", valor: `${k.prazoEntregaDias} dias` });
  if (cond.length) secoes.push({ titulo: "Condições", itens: cond });

  // 6. Garantia (tráfego com garantia)
  if (!vazio(k?.garantiaResultado))
    secoes.push({
      titulo: "Garantia",
      itens: [
        { rotulo: "O que conta como resultado", valor: k!.garantiaResultado!.trim() },
        ...(k?.garantiaAte ? [{ rotulo: "Vale até", valor: data(k.garantiaAte)! }] : []),
      ],
    });

  // 7 e 8. Texto dos sócios
  if (vazio(modelo.obrigacoes)) faltando.push("Obrigações das partes (Configurações → Contrato)");
  else secoes.push({ titulo: "Obrigações", paragrafos: paragrafos(modelo.obrigacoes) });
  if (vazio(modelo.disposicoes)) faltando.push("Disposições gerais (Configurações → Contrato)");
  else secoes.push({ titulo: "Disposições gerais", paragrafos: paragrafos(modelo.disposicoes) });

  if (k?.observacoes?.trim()) secoes.push({ titulo: "Observações", paragrafos: paragrafos(k.observacoes) });

  // Assinaturas: o cliente e quem assina pela Aden
  const signatarios: Signatario[] = [];
  const emailCliente = c.email?.trim() ?? "";
  if (!EMAIL.test(emailCliente)) faltando.push("E-mail do cliente (ficha → Dados)");
  else signatarios.push({ nome: c.contato?.trim() || contratante, email: emailCliente.toLowerCase() });
  const aden = modelo.signatariosAden.filter((s) => !vazio(s.nome) && EMAIL.test(s.email.trim()));
  if (!aden.length) faltando.push("Quem assina pela Aden (Configurações → Contrato)");
  signatarios.push(...aden.map((s) => ({ nome: s.nome.trim(), email: s.email.trim().toLowerCase() })));

  return { titulo: `Contrato de prestação de serviços · ${contratante}`, secoes, signatarios, faltando };
}

// ─── Situação da assinatura (resposta da Autentique) ─────────────────────────

export type SituacaoContrato = "enviado" | "assinado" | "recusado";

export interface AssinaturaRecebida {
  nome: string | null;
  email: string | null;
  /** quem só recebe cópia não conta */
  assina: boolean;
  assinadoEm: string | null;
  recusadoEm: string | null;
}

/** Assinado quando todos que assinam assinaram; recusado se alguém recusou. */
export function situacaoDoContrato(assinaturas: AssinaturaRecebida[]): { situacao: SituacaoContrato; assinadoEm: string | null; faltam: string[] } {
  const quemAssina = assinaturas.filter((a) => a.assina);
  if (quemAssina.some((a) => a.recusadoEm)) return { situacao: "recusado", assinadoEm: null, faltam: [] };
  const faltam = quemAssina.filter((a) => !a.assinadoEm).map((a) => a.nome || a.email || "?");
  if (quemAssina.length && !faltam.length) {
    const ultima = quemAssina.map((a) => a.assinadoEm!).sort().at(-1)!;
    return { situacao: "assinado", assinadoEm: ultima, faltam };
  }
  return { situacao: "enviado", assinadoEm: null, faltam };
}

/** Registro de um contrato enviado para assinatura. */
export interface ContratoEnviado {
  id: Id;
  clienteId: Id;
  autentiqueId: string;
  nome: string;
  situacao: SituacaoContrato | "cancelado";
  enviadoEm: string;
  enviadoPorNome: string | null;
  assinadoEm: string | null;
  conferidoEm: string | null;
  /** quem ainda falta assinar (da última conferência) */
  faltam: string[];
  signatarios: Signatario[];
}
