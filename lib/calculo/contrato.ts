// Contrato do cliente (Fase 5, passo 3). O Aden monta o texto com os dados da ficha e manda para assinatura
// eletrônica (Autentique). As partes que mudam a cada cliente (partes, objeto, valor, prazo, condições, garantia)
// saem da ficha; obrigações e disposições gerais são o texto dos sócios (Configurações → Contrato). Estrutura e
// acabamento seguem o contrato da Moni (30/09/2026). Faltou algo → aparece em "faltando" e não envia.

import { dataPorExtenso, formatarDocumento, formatarMoeda, tipoDocumento, valorPorExtenso } from "../formato";
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
  /** cidade de assinatura, do cabeçalho e do rodapé (ex.: "Recife - Pernambuco") */
  cidade?: string | null;
  /** obrigações das partes (texto dos sócios, uma cláusula por linha; "a)" vira subitem) */
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
  cidade: null,
  obrigacoes: null,
  disposicoes: null,
  signatariosAden: [],
};

export interface ItemClausula {
  /** "1.1", "a)" */
  marcador: string;
  texto: string;
  /** subitem (a, b, c…) */
  sub?: boolean;
}

export interface Clausula {
  titulo: string;
  itens: ItemClausula[];
}

export interface DocumentoContrato {
  titulo: string;
  /** serviços contratados (ex.: "Social media + Tráfego pago") */
  subtitulo: string;
  /** "Contratante: … • Cidade, 30 de setembro de 2026" */
  linhaTopo: string;
  /** qualificação das partes em texto corrido */
  partes: { rotulo: "CONTRATANTE" | "CONTRATADA"; texto: string }[];
  abertura: string;
  clausulas: Clausula[];
  localData: string;
  assinaturas: { nome: string; papel: string }[];
  rodape: string;
  signatarios: Signatario[];
  /** o que falta para poder enviar (vazio = pronto) */
  faltando: string[];
  arquivo: string;
}

const vazio = (t: string | null | undefined) => !t || !t.trim();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const dataBr = (iso: string | null | undefined) => {
  if (!iso) return null;
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
};

export const paragrafos = (texto: string | null | undefined) =>
  (texto ?? "")
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);

/**
 * Texto dos sócios → itens numerados da cláusula n. Cada linha é um item; número que já vier escrito é trocado
 * pela numeração do contrato; linhas "a)", "b)"… viram subitens.
 */
export function itensDoTexto(texto: string | null | undefined, n: number): ItemClausula[] {
  const itens: ItemClausula[] = [];
  let k = 0;
  for (const bruta of (texto ?? "").split("\n")) {
    const linha = bruta.trim();
    if (!linha) continue;
    const sub = /^([a-z])\)\s*(.+)$/i.exec(linha);
    if (sub) {
      itens.push({ marcador: `${sub[1].toLowerCase()})`, texto: sub[2], sub: true });
      continue;
    }
    k += 1;
    itens.push({ marcador: `${n}.${k}`, texto: linha.replace(/^(cl[áa]usula\s+)?\d+(\.\d+)*\.?[)\-–]?\s+/i, "") });
  }
  return itens;
}

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
    // projeto de marca: entrega única com prazo em dias, não "por mês"
    const valor = t.projeto
      ? `${q === 1 ? "1 projeto" : `${q} projetos`}${t.prazoDias ? `, com entrega em até ${t.prazoDias} dias úteis` : ""}`
      : `${q} por mês`;
    linhas.push({ rotulo: servico ? `${servico} · ${nome}` : nome, valor });
  }
  return linhas;
}

function qualificacao(nome: string, doc: string | null | undefined, endereco: string | null | undefined, sede: boolean) {
  const tipo = tipoDocumento(doc);
  const docTxt = vazio(doc)
    ? ""
    : tipo === "cpf"
      ? `, pessoa física inscrita no CPF sob o nº ${formatarDocumento(doc)}`
      : tipo === "cnpj"
        ? `, pessoa jurídica inscrita no CNPJ sob o nº ${formatarDocumento(doc)}`
        : `, inscrita sob o nº ${formatarDocumento(doc)}`;
  const end = vazio(endereco) ? "" : `, ${sede ? "com sede em" : "com endereço em"} ${endereco!.trim()}`;
  return { texto: `${nome}${docTxt}${end}`, tipo };
}

/**
 * Monta o contrato do cliente no padrão de acabamento dos contratos da Moni: partes qualificadas em texto corrido,
 * cláusulas numeradas, local e data, assinaturas. Não inventa nada: o que não está na ficha ou no modelo entra em
 * "faltando". Obrigações e disposições gerais são o texto dos sócios.
 */
export function montarContrato(
  config: Configuracao,
  clienteId: Id,
  modelo: ModeloContrato,
  opcoes: { hoje: string; contato?: { whatsapp: string | null; email: string | null } | null },
): DocumentoContrato {
  const c = config.clientes.find((x) => x.id === clienteId);
  if (!c) throw new Error("Cliente não encontrado.");
  const k = c.contrato ?? null;
  const faltando: string[] = [];
  const marca = c.nome.trim();
  const contratante = c.razaoSocial?.trim() || marca;
  const cidade = modelo.cidade?.trim() || "";

  // Partes
  if (vazio(modelo.contratadaNome)) faltando.push("Nome da contratada (Configurações → Contrato)");
  if (vazio(modelo.contratadaDocumento)) faltando.push("CNPJ da contratada (Configurações → Contrato)");
  if (vazio(cidade)) faltando.push("Cidade da contratada (Configurações → Contrato)");
  if (vazio(c.documento)) faltando.push("CPF ou CNPJ do cliente (ficha → Dados)");
  if (vazio(c.endereco)) faltando.push("Endereço do cliente (ficha → Dados)");
  const aden = modelo.signatariosAden.filter((s) => !vazio(s.nome) && EMAIL.test(s.email.trim()));
  const qc = qualificacao(contratante, c.documento, c.endereco, false);
  const representante = qc.tipo === "cnpj" && !vazio(c.contato) ? `, neste ato representada por ${c.contato!.trim()}` : "";
  const qa = qualificacao(modelo.contratadaNome?.trim() || "—", modelo.contratadaDocumento, modelo.contratadaEndereco, true);
  const repAden = aden.length ? `, neste ato representada por ${aden.map((s) => s.nome.trim()).join(" e ")}` : "";
  const partes: DocumentoContrato["partes"] = [
    { rotulo: "CONTRATANTE", texto: `${qc.texto}${contratante !== marca ? ` (${marca})` : ""}${representante}.` },
    { rotulo: "CONTRATADA", texto: `${qa.texto}${repAden}.` },
  ];

  const clausulas: Clausula[] = [];
  const nova = (titulo: string) => {
    const cl = { titulo: `${clausulas.length + 1}. ${titulo}`, itens: [] as ItemClausula[] };
    clausulas.push(cl);
    const n = clausulas.length;
    return { n, add: (texto: string, sub?: boolean) => cl.itens.push({ marcador: sub ? "" : `${n}.${cl.itens.filter((i) => !i.sub).length + 1}`, texto, sub }) };
  };

  // Objeto
  const objeto = objetoDoContrato(config, c);
  if (!objeto.length) faltando.push("Entregas do contrato do cliente (ficha → Personalizar entregas)");
  for (const e of c.escopo?.entregas ?? []) {
    const t = config.tiposEntrega.find((x) => x.id === e.tipoEntregaId);
    if ((e.quantidade ?? 0) > 0 && t?.projeto && !t.prazoDias) faltando.push(`Prazo em dias úteis do projeto ${t.nome} (Configurações → Tipos de entrega)`);
  }
  const servicos = [...new Set(objeto.map((o) => o.rotulo.split(" · ")[0]).filter((x) => objeto.some((o) => o.rotulo.startsWith(`${x} · `))))];
  const ob = nova("Objeto do contrato");
  ob.add(`O presente contrato tem por objeto a prestação de serviços${servicos.length ? ` de ${servicos.join(" e ")}` : ""} para a marca ${marca}, conforme a proposta aceita pelo CONTRATANTE.`);
  ob.add("Estão incluídos, por mês:");
  objeto.forEach((o, i) => clausulas[ob.n - 1].itens.push({ marcador: `${String.fromCharCode(97 + i)})`, texto: `${o.rotulo}: ${o.valor}`, sub: true }));
  ob.add("Qualquer item não listado acima é considerado extra e será orçado à parte.");

  // Prazo
  if (!k?.inicio) faltando.push("Data de início (ficha → Contrato)");
  const pr = nova("Prazo");
  pr.add(`Este contrato começa a valer em ${dataBr(k?.inicio) ?? "—"}${k?.fim ? ` e termina em ${dataBr(k.fim)}` : ""}.`);
  if (k?.prazoMinimoMeses) pr.add(`O prazo mínimo de permanência é de ${k.prazoMinimoMeses} ${k.prazoMinimoMeses === 1 ? "mês" : "meses"}.`);
  if (k?.avisoPrevioDias) pr.add(`Para encerrar o contrato, a parte interessada deve avisar a outra com pelo menos ${k.avisoPrevioDias} dias de antecedência.`);

  // Valor e pagamento
  if (!c.valorMensalCentavos) faltando.push("Valor mensal (ficha → Contrato)");
  const vencimento = k?.venceUltimoDiaUtil ? "no último dia útil de cada mês" : k?.diaPagamento ? `no dia ${k.diaPagamento} de cada mês` : null;
  if (!vencimento) faltando.push("Dia do pagamento (ficha → Contrato)");
  const vp = nova("Valor e pagamento");
  vp.add(
    `Pelos serviços descritos neste contrato, o CONTRATANTE pagará à CONTRATADA o valor mensal de ${c.valorMensalCentavos ? `${formatarMoeda(c.valorMensalCentavos)} (${valorPorExtenso(c.valorMensalCentavos)})` : "—"}.`,
  );
  vp.add(`O pagamento vence ${vencimento ?? "—"}.`);
  if (!vazio(k?.inicioCobranca)) vp.add(`Início da cobrança: ${k!.inicioCobranca.trim()}.`);

  // Condições (só o que foi preenchido)
  const cond: string[] = [];
  if (k?.limiteRodadas) cond.push(`Estão incluídas até ${k.limiteRodadas} ${k.limiteRodadas === 1 ? "rodada" : "rodadas"} de ajuste por peça.`);
  if (k?.prazoAprovacaoDias) cond.push(`O CONTRATANTE tem até ${k.prazoAprovacaoDias} dias para aprovar cada peça.`);
  if (k?.prazoEntregaDias) cond.push(`O prazo de entrega é de ${k.prazoEntregaDias} dias.`);
  if (k?.limiteReunioesMes) cond.push(`Estão incluídas até ${k.limiteReunioesMes} ${k.limiteReunioesMes === 1 ? "reunião" : "reuniões"} por mês.`);
  if (cond.length) {
    const co = nova("Condições");
    cond.forEach((t) => co.add(t));
  }

  // Garantia (tráfego com garantia)
  if (!vazio(k?.garantiaResultado)) {
    const ga = nova("Garantia");
    ga.add(`O que conta como resultado: ${k!.garantiaResultado!.trim().replace(/\.$/, "")}.`);
    if (k?.garantiaAte) ga.add(`A garantia vale até ${dataBr(k.garantiaAte)}.`);
  }

  // Texto dos sócios
  if (vazio(modelo.obrigacoes)) faltando.push("Obrigações das partes (Configurações → Contrato)");
  else clausulas.push({ titulo: `${clausulas.length + 1}. Obrigações das partes`, itens: itensDoTexto(modelo.obrigacoes, clausulas.length + 1) });
  if (vazio(modelo.disposicoes)) faltando.push("Disposições gerais (Configurações → Contrato)");
  else clausulas.push({ titulo: `${clausulas.length + 1}. Disposições gerais`, itens: itensDoTexto(modelo.disposicoes, clausulas.length + 1) });
  if (k?.observacoes?.trim()) clausulas.push({ titulo: `${clausulas.length + 1}. Observações`, itens: itensDoTexto(k.observacoes, clausulas.length + 1) });

  // Assinaturas
  const signatarios: Signatario[] = [];
  const emailCliente = c.email?.trim() ?? "";
  const quemAssina = c.contato?.trim() || contratante;
  if (!EMAIL.test(emailCliente)) faltando.push("E-mail do cliente (ficha → Dados)");
  else signatarios.push({ nome: quemAssina, email: emailCliente.toLowerCase() });
  if (!aden.length) faltando.push("Quem assina pela Aden (Configurações → Contrato)");
  signatarios.push(...aden.map((s) => ({ nome: s.nome.trim(), email: s.email.trim().toLowerCase() })));
  const nomeAden = modelo.contratadaNome?.trim() || "Aden";
  const assinaturas = [
    { nome: quemAssina, papel: `CONTRATANTE · ${marca}` },
    ...aden.map((s) => ({ nome: s.nome.trim(), papel: `CONTRATADA · ${nomeAden}` })),
  ];

  const data = dataPorExtenso(opcoes.hoje);
  const localData = cidade ? `${cidade}, ${data}` : data;
  const rodape = [cidade, opcoes.contato?.whatsapp?.trim(), opcoes.contato?.email?.trim()].filter(Boolean).join(" | ");
  const nomeArquivo = marca.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w]+/g, "");

  return {
    titulo: `Contrato de prestação de serviços · Aden · ${marca}`,
    subtitulo: servicos.join(" + "),
    linhaTopo: `Contratante: ${contratante} • ${localData}`,
    partes,
    abertura:
      "As partes acima identificadas têm, entre si, justo e acertado o presente Contrato de Prestação de Serviços, que se regerá pelas cláusulas seguintes e pelas condições descritas no presente.",
    clausulas,
    localData,
    assinaturas,
    rodape,
    signatarios,
    faltando,
    arquivo: `Contrato_Aden_${nomeArquivo}_${opcoes.hoje.slice(0, 7)}`,
  };
}

/** Mensagem para o cliente mandar só o que o contrato precisa (WhatsApp). */
export function mensagemPedirDados(c: Pick<ClienteBase, "contato" | "nome">): string {
  const primeiro = c.contato?.trim().split(/\s+/)[0];
  return [
    `Oi${primeiro ? `, ${primeiro}` : ""}! Pra preparar o seu contrato, me manda por aqui:`,
    "",
    "• Nome completo (ou razão social, se for empresa)",
    "• CPF ou CNPJ",
    "• E-mail (é nele que o contrato chega pra assinar digitalmente)",
    "• Endereço completo, com CEP",
    "",
    "Assim que chegar, o contrato vai pro seu e-mail.",
  ].join("\n");
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
