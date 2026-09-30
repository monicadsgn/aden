// Fechamento do cliente (Fase 5, passo 1, aprovado em 30/09/2026).
// Quando o lead vira cliente, abre um checklist na ordem combinada com a Moni (o onboarding vai primeiro, como na MD):
// onboarding → contrato → link de pagamento → pasta no Drive → briefing → kickoff → link do painel.
// O link do painel se confere sozinho (link criado na ficha); os outros são marcados por quem fez.

import type { Id } from "./tipos";

export type PassoFechamento = "onboarding" | "contrato" | "pagamento" | "pasta_drive" | "briefing" | "kickoff" | "painel";

export const PASSOS_FECHAMENTO: { passo: PassoFechamento; rotulo: string; ajuda: string; pedeLink?: boolean; pedeData?: boolean }[] = [
  { passo: "onboarding", rotulo: "Onboarding enviado", ajuda: "O cliente recebeu o onboarding do serviço (o que vem a seguir e o que precisamos dele)." },
  { passo: "contrato", rotulo: "Contrato assinado", ajuda: "Contrato enviado e assinado pelo cliente.", pedeLink: true },
  { passo: "pagamento", rotulo: "Link de pagamento enviado", ajuda: "O cliente recebeu o link para pagar.", pedeLink: true },
  { passo: "pasta_drive", rotulo: "Pasta no Drive criada", ajuda: "Pasta do cliente em 02 CLIENTES ATIVOS, com o link guardado aqui.", pedeLink: true },
  { passo: "briefing", rotulo: "Briefing preenchido", ajuda: "O briefing na ficha do cliente está completo (o Áleff na reunião dele, a Moni na dela)." },
  { passo: "kickoff", rotulo: "Kickoff marcado", ajuda: "Reunião de início com o cliente, com data. Vira tarefa.", pedeData: true },
  { passo: "painel", rotulo: "Link do painel criado", ajuda: "O link do painel do cliente foi criado na ficha (Dados → Painel do cliente)." },
];

/** O que ficou registrado de um passo (o painel não é registrado: vem do link da ficha). */
export interface RegistroFechamento {
  id: Id;
  clienteId: Id;
  passo: Exclude<PassoFechamento, "painel">;
  /** quando foi feito; null = ainda não */
  feitoEm: string | null;
  /** quem fez (o banco preenche) */
  feitoPorNome: string | null;
  link: string | null;
  /** "AAAA-MM-DD" (kickoff) */
  data: string | null;
  observacao: string | null;
}

export interface ItemFechamento {
  passo: PassoFechamento;
  rotulo: string;
  ajuda: string;
  feito: boolean;
  feitoEm: string | null;
  feitoPorNome: string | null;
  link: string | null;
  data: string | null;
  observacao: string | null;
}

export function montarFechamento(registros: RegistroFechamento[], temLinkDoPainel: boolean) {
  const itens: ItemFechamento[] = PASSOS_FECHAMENTO.map((p) => {
    if (p.passo === "painel")
      return { passo: p.passo, rotulo: p.rotulo, ajuda: p.ajuda, feito: temLinkDoPainel, feitoEm: null, feitoPorNome: null, link: null, data: null, observacao: null };
    const r = registros.find((x) => x.passo === p.passo);
    return {
      passo: p.passo,
      rotulo: p.rotulo,
      ajuda: p.ajuda,
      feito: !!r?.feitoEm,
      feitoEm: r?.feitoEm ?? null,
      feitoPorNome: r?.feitoPorNome ?? null,
      link: r?.link ?? null,
      data: r?.data ?? null,
      observacao: r?.observacao ?? null,
    };
  });
  const feitos = itens.filter((i) => i.feito).length;
  return { itens, feitos, total: itens.length, proximo: itens.find((i) => !i.feito) ?? null, completo: feitos === itens.length };
}
