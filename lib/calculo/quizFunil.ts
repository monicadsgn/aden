// Funil do quiz de conversão: quantas pessoas começaram, em que tela cada uma parou e quantas enviaram.
// Puro e testado (como o resto de lib/calculo). Os dados vêm de quiz_progresso (migration 0046): uma linha por visita.

import { rotuloCampanha, type CampanhaDoLead, type Qualificacao } from "./crm";

export interface VisitaQuiz {
  /** telas que a pessoa viu, na ordem */
  passos: string[];
  ultimoPasso: string | null;
  enviou: boolean;
  qualificacao: string | null;
  /** de qual anúncio veio (migration 0047); vazio em visitas antigas ou sem link de campanha */
  campanha?: CampanhaDoLead | null;
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

export interface LinhaCampanha {
  /** fonte + campanha: duas visitas com o mesmo par entram na mesma linha */
  chave: string;
  rotulo: string;
  fonte: string | null;
  campanha: string | null;
  comecaram: number;
  enviaram: number;
  /** quem enviou e saiu qualificado ou com ressalva (os contatos que vale ligar) */
  bons: number;
  /** % de quem começou que enviou */
  taxaDeEnvio: number;
}

/** Quantas pessoas cada campanha trouxe, quantas enviaram e quantas saíram boas. Quem veio sem link de campanha fica numa linha só, no fim. */
export function resumoPorCampanha(visitas: VisitaQuiz[]): LinhaCampanha[] {
  const grupos = new Map<string, LinhaCampanha>();
  for (const v of visitas) {
    const c = v.campanha;
    const fonte = c?.source ?? null;
    const campanha = c?.campaign ?? null;
    const chave = fonte || campanha ? `${fonte ?? ""}|${campanha ?? ""}` : "";
    let g = grupos.get(chave);
    if (!g) {
      g = { chave, rotulo: rotuloCampanha(chave ? { source: fonte ?? undefined, campaign: campanha ?? undefined } : null), fonte, campanha, comecaram: 0, enviaram: 0, bons: 0, taxaDeEnvio: 0 };
      grupos.set(chave, g);
    }
    g.comecaram++;
    if (v.enviou) {
      g.enviaram++;
      if (v.qualificacao === "qualificado" || v.qualificacao === "com_ressalva") g.bons++;
    }
  }
  const linhas = [...grupos.values()].map((g) => ({ ...g, taxaDeEnvio: pct(g.enviaram, g.comecaram) }));
  return linhas.sort((a, b) => (a.chave === "" ? 1 : b.chave === "" ? -1 : b.comecaram - a.comecaram || a.rotulo.localeCompare(b.rotulo, "pt-BR")));
}
