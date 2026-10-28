// Cliente novo só começa a produzir com o essencial preenchido (28/10/2026).
// Vale para quem nasceu do fechamento de lead (tem `fechamentoIniciadoEm`); clientes antigos não são barrados.
// Aviso prévio e prazo mínimo contam como preenchidos até com 0 (decidir "não tem" também é decidir).
// Nenhum número de negócio aqui: só confere se o campo foi preenchido.

import type { ClienteBase } from "../calculo/tipos";

export interface FaltaParaComecar {
  /** o que falta, em palavras da tela */
  item: string;
  /** aba da ficha do cliente onde se resolve */
  aba: "resumo" | "contrato";
}

const vazio = (v: string | null | undefined) => !v || !v.trim();

export function faltaParaComecar(c: ClienteBase): FaltaParaComecar[] {
  if (c.interno) return [];
  const k = c.contrato ?? null;
  const falta: FaltaParaComecar[] = [];
  if (vazio(c.documento)) falta.push({ item: "CPF ou CNPJ do cliente", aba: "resumo" });
  if (vazio(c.endereco)) falta.push({ item: "Endereço do cliente", aba: "resumo" });
  if (vazio(c.email)) falta.push({ item: "E-mail do cliente", aba: "resumo" });
  if (!k?.inicio) falta.push({ item: "Data de início", aba: "contrato" });
  if (!c.projetoAvulso) {
    if (!c.valorMensalCentavos) falta.push({ item: "Valor mensal", aba: "contrato" });
    if (!k?.diaPagamento && !k?.venceUltimoDiaUtil) falta.push({ item: "Dia do pagamento", aba: "contrato" });
    if (vazio(k?.inicioCobranca)) falta.push({ item: "Quando começa a cobrança", aba: "contrato" });
    if (k?.avisoPrevioDias == null) falta.push({ item: "Aviso prévio", aba: "contrato" });
    if (k?.prazoMinimoMeses == null) falta.push({ item: "Prazo mínimo", aba: "contrato" });
  }
  return falta;
}

/** Só o cliente que nasceu do fechamento de lead é barrado; o resto segue como está. */
export function barraProducao(c: ClienteBase): boolean {
  return Boolean(c.fechamentoIniciadoEm) && faltaParaComecar(c).length > 0;
}

export function mensagemNaoPodeComecar(c: ClienteBase): string {
  const itens = faltaParaComecar(c).map((f) => f.item.toLowerCase());
  return `${c.nome} ainda não pode começar a produzir. Falta na ficha: ${itens.join(", ")}. Preencha e tente de novo.`;
}
