// Funil do quiz de conversão: quantas pessoas começaram, em que tela cada uma parou e quantas enviaram.
// Puro e testado (como o resto de lib/calculo). Os dados vêm de quiz_progresso (migration 0046): uma linha por visita.

import type { Qualificacao } from "./crm";

export interface VisitaQuiz {
  /** telas que a pessoa viu, na ordem */
  passos: string[];
  ultimoPasso: string | null;
  enviou: boolean;
  qualificacao: string | null;
  criadoEm: string;
}

/** Telas do quiz na ordem em que aparecem. Gate e verba só aparecem para parte das pessoas (depende do faturamento). */
export const TELAS_DO_QUIZ: { passo: string; rotulo: string; sePula?: string; saida?: boolean }[] = [
  { passo: "hero", rotulo: "Abertura" },
  { passo: "seg", rotulo: "Segmento" },
  { passo: "fat", rotulo: "Faturamento" },
  { passo: "gate", rotulo: "Verba mínima", sePula: "só aparece para quem fatura menos" },
  { passo: "mar", rotulo: "Margem" },
  { passo: "vrb", rotulo: "Verba para anúncios", sePula: "só aparece para quem fatura mais" },
  { passo: "tic", rotulo: "Ticket e ciclo de venda" },
  { passo: "ate", rotulo: "Atendimento" },
  { passo: "reg", rotulo: "Controle de vendas" },
  { passo: "obj", rotulo: "Objetivo" },
  { passo: "form", rotulo: "Formulário final" },
  // saída de propósito: quem diz que não consegue a verba mínima não segue (e não deixa contato)
  { passo: "desq", rotulo: "Saída: sem a verba mínima", sePula: "por desenho do quiz, não é abandono", saida: true },
];

export interface TelaDoFunil {
  passo: string;
  rotulo: string;
  sePula?: string;
  saida?: boolean;
  /** quantas visitas chegaram nessa tela */
  viram: number;
  /** % de quem começou que chegou nessa tela */
  pctDeQuemComecou: number;
  /** quantas visitas pararam nessa tela e não enviaram */
  pararamAqui: number;
}

export interface ResumoQuiz {
  comecaram: number;
  enviaram: number;
  /** % de quem começou que enviou */
  taxaDeEnvio: number;
  telas: TelaDoFunil[];
  /** tela onde mais gente parou sem enviar (null se ninguém parou) */
  ondeMaisParam: TelaDoFunil | null;
  porEtiqueta: Record<Qualificacao, number>;
}

const pct = (parte: number, todo: number) => (todo > 0 ? Math.round((parte / todo) * 1000) / 10 : 0);

export function resumoDoQuiz(visitas: VisitaQuiz[]): ResumoQuiz {
  const comecaram = visitas.length;
  const enviaram = visitas.filter((v) => v.enviou).length;
  const telas: TelaDoFunil[] = TELAS_DO_QUIZ.map((t) => {
    const viram = visitas.filter((v) => v.passos.includes(t.passo)).length;
    // quem enviou passou pelo formulário, então "parou aqui" só conta quem não enviou
    const pararamAqui = visitas.filter((v) => !v.enviou && v.ultimoPasso === t.passo).length;
    return { ...t, viram, pctDeQuemComecou: pct(viram, comecaram), pararamAqui };
  });
  const maisParam = telas.filter((t) => !t.saida).sort((a, b) => b.pararamAqui - a.pararamAqui)[0];
  const porEtiqueta: Record<Qualificacao, number> = { qualificado: 0, com_ressalva: 0, desqualificado: 0, social_media: 0 };
  for (const v of visitas) if (v.enviou && v.qualificacao && v.qualificacao in porEtiqueta) porEtiqueta[v.qualificacao as Qualificacao]++;
  return { comecaram, enviaram, taxaDeEnvio: pct(enviaram, comecaram), telas, ondeMaisParam: maisParam && maisParam.pararamAqui > 0 ? maisParam : null, porEtiqueta };
}
