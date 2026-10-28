// Trava ao fechar um lead (28/10/2026): só vira cliente com o básico preenchido.
// Os dados do contrato (CPF/CNPJ, endereço, início…) ficam para a ficha do cliente: ver prontoParaComecar.ts.
// Nenhum número de negócio aqui: só confere se o campo foi preenchido.

import type { Lead } from "../calculo/crm";

export function faltaParaFechar(lead: Lead, opcoes: { avulso: boolean }): string[] {
  const falta: string[] = [];
  if (!lead.nome.trim()) falta.push("nome do cliente");
  if (!lead.contato.trim()) falta.push("pessoa de contato");
  if (!lead.telefone.trim() && !lead.email.trim()) falta.push("WhatsApp ou e-mail");
  if (!opcoes.avulso && !(lead.valorEstimadoCentavos && lead.valorEstimadoCentavos > 0)) falta.push("valor mensal combinado");
  return falta;
}

export function mensagemFaltaParaFechar(falta: string[]): string {
  return `Ainda não dá para fechar. Falta: ${falta.join(", ")}. Preencha no lead e tente de novo.`;
}
