// Autentique (assinatura eletrônica), API v2 em GraphQL. Só roda no servidor: a chave fica na Vercel
// (AUTENTIQUE_TOKEN, da conta grupoaden1) e nunca vai para o navegador. AUTENTIQUE_SANDBOX=1 manda como teste
// (documento sem validade, não gasta crédito).

import "server-only";
import type { AssinaturaRecebida, Signatario } from "../calculo/contrato";

const ENDERECO = "https://api.autentique.com.br/v2/graphql";

export function chaveAutentique(): string | null {
  return process.env.AUTENTIQUE_TOKEN?.trim() || null;
}

const sandbox = () => process.env.AUTENTIQUE_SANDBOX?.trim() === "1";

async function chamar<T>(corpo: BodyInit, json: boolean): Promise<T> {
  const chave = chaveAutentique();
  if (!chave) throw new Error("A chave da Autentique ainda não foi salva na Vercel (AUTENTIQUE_TOKEN).");
  const r = await fetch(ENDERECO, {
    method: "POST",
    headers: { Authorization: `Bearer ${chave}`, ...(json && { "Content-Type": "application/json" }) },
    body: corpo,
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  const texto = await r.text();
  let dados: { data?: T; errors?: { message: string }[] };
  try {
    dados = JSON.parse(texto);
  } catch {
    throw new Error(`A Autentique respondeu ${r.status} sem dados.`);
  }
  if (dados.errors?.length) throw new Error(`Autentique: ${dados.errors.map((e) => e.message).join("; ")}`);
  if (!r.ok || !dados.data) throw new Error(`A Autentique respondeu ${r.status}.`);
  return dados.data;
}

/** Cria o documento com o PDF e manda para cada signatário assinar por e-mail. Devolve o id da Autentique. */
export async function criarDocumento(nome: string, pdf: Uint8Array, signatarios: Signatario[]): Promise<string> {
  const query = `mutation Criar($document: DocumentInput!, $signers: [SignerInput!]!, $file: Upload!) {
    createDocument(${sandbox() ? "sandbox: true, " : ""}document: $document, signers: $signers, file: $file) { id }
  }`;
  const operacoes = {
    query,
    variables: {
      document: { name: nome },
      signers: signatarios.map((s) => ({ email: s.email, name: s.nome, action: "SIGN" })),
      file: null,
    },
  };
  const form = new FormData();
  form.append("operations", JSON.stringify(operacoes));
  form.append("map", JSON.stringify({ file: ["variables.file"] }));
  form.append("file", new Blob([pdf as BlobPart], { type: "application/pdf" }), `${nome.replace(/[^\w\- ]+/g, "").trim() || "contrato"}.pdf`);
  const d = await chamar<{ createDocument: { id: string } }>(form, false);
  return d.createDocument.id;
}

interface AssinaturaAutentique {
  name: string | null;
  email: string | null;
  action: { name: string } | null;
  signed: { created_at: string } | null;
  rejected: { created_at: string } | null;
}

/** Assinaturas do documento, para conferir se já foi assinado. */
export async function consultarDocumento(id: string): Promise<AssinaturaRecebida[]> {
  const query = `query Ver($id: UUID!) { document(id: $id) { id signatures { name email action { name } signed { created_at } rejected { created_at } } } }`;
  const d = await chamar<{ document: { signatures: AssinaturaAutentique[] } | null }>(JSON.stringify({ query, variables: { id } }), true);
  if (!d.document) throw new Error("A Autentique não encontrou este documento (pode ter sido apagado lá).");
  return d.document.signatures.map((s) => ({
    nome: s.name,
    email: s.email,
    // a conta que cria o documento aparece sem ação: não conta como quem assina
    assina: s.action?.name === "SIGN",
    assinadoEm: s.signed?.created_at ?? null,
    recusadoEm: s.rejected?.created_at ?? null,
  }));
}
