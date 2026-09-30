// Enviar e conferir o contrato na Autentique. Usado pela rota do site (/api/contrato) e pelo conector do Claude,
// sempre com o repositório de quem está agindo: o banco grava quem enviou e o RLS vale igual.

import "server-only";
import { montarContrato, situacaoDoContrato, type ContratoEnviado } from "../calculo/contrato";
import type { Repositorio } from "../dados/repositorio";
import { consultarDocumento, criarDocumento } from "./autentique";
import { contratoEmPdf } from "./pdf";

const aberto = (c: ContratoEnviado) => c.situacao === "enviado";

/** Hoje no horário do Brasil (o servidor roda em UTC). */
export const hojeNoBrasil = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

/** Contrato montado com a ficha, o modelo e o contato da Aden (rodapé). */
export async function contratoDoCliente(repo: Repositorio, clienteId: string) {
  const [config, modelo, onboarding] = await Promise.all([repo.carregarConfig(), repo.obterModeloContrato(), repo.obterModeloOnboarding()]);
  return montarContrato(config, clienteId, modelo, { hoje: hojeNoBrasil(), contato: { whatsapp: onboarding.whatsapp, email: onboarding.email } });
}

/** Monta o contrato com a ficha e o modelo e manda para assinatura. Não envia se faltar algo ou se já houver um aberto. */
export async function enviarContrato(repo: Repositorio, clienteId: string, opcoes: { reenviar?: boolean } = {}) {
  const [doc, enviados] = await Promise.all([contratoDoCliente(repo, clienteId), repo.listarContratosAssinatura(clienteId)]);
  if (doc.faltando.length) throw new Error(`Falta preencher antes de enviar: ${doc.faltando.join("; ")}.`);
  const emAberto = enviados.find(aberto);
  if (emAberto && !opcoes.reenviar)
    throw new Error(`Já há um contrato esperando assinatura (enviado em ${emAberto.enviadoEm.slice(0, 10)}). Confira a assinatura ou peça para reenviar.`);
  if (emAberto) await repo.atualizarContratoAssinatura(emAberto.id, { situacao: "cancelado", assinadoEm: null, faltam: [] });
  const pdf = await contratoEmPdf(doc);
  const autentiqueId = await criarDocumento(doc.titulo, pdf, doc.signatarios);
  await repo.registrarContratoAssinatura({ clienteId, autentiqueId, nome: doc.titulo, signatarios: doc.signatarios });
  return { enviado: doc.titulo, para: doc.signatarios.map((s) => `${s.nome} <${s.email}>`) };
}

/** Pergunta à Autentique quem já assinou. Assinado por todos → marca o passo "Contrato assinado" do fechamento. */
export async function conferirContratos(repo: Repositorio, clienteId: string) {
  const enviados = (await repo.listarContratosAssinatura(clienteId)).filter(aberto);
  const resultado: { contrato: string; situacao: string; faltam: string[] }[] = [];
  for (const c of enviados) {
    const s = situacaoDoContrato(await consultarDocumento(c.autentiqueId));
    await repo.atualizarContratoAssinatura(c.id, s);
    if (s.situacao === "assinado") {
      await repo.salvarPassoFechamento({
        clienteId,
        passo: "contrato",
        feito: true,
        observacao: `Assinado por todos na Autentique em ${s.assinadoEm?.slice(0, 10) ?? "?"}.`,
      });
    }
    resultado.push({ contrato: c.nome, situacao: s.situacao, faltam: s.faltam });
  }
  return resultado;
}
