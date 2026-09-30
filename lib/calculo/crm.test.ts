import { describe, expect, it } from "vitest";
import { contatosParaHoje, diasNaEtapa, leadParado, moverLead, novoLead, resumoFunil, situacaoFollowUp } from "./crm";

const t0 = new Date("2026-09-20T12:00:00Z");
const depois = (dias: number) => new Date(t0.getTime() + dias * 86400000);

describe("crm", () => {
  it("mover guarda a entrada na etapa e fecha em ganho/perdido", () => {
    const l = novoLead("1", "Loja X", {}, t0);
    const c = moverLead(l, "contato_feito", depois(2));
    expect(diasNaEtapa(c, depois(5))).toBe(3);
    const g = moverLead(c, "ganho", depois(6));
    expect(g.fechadoEm).not.toBeNull();
    expect(moverLead(g, "proposta_enviada", depois(7)).fechadoEm).toBeNull();
  });

  it("parado só acende com dias configurados", () => {
    const l = novoLead("1", "x", {}, t0);
    expect(leadParado(l, null, depois(30))).toBe(false);
    expect(leadParado(l, 7, depois(6))).toBe(false);
    expect(leadParado(l, 7, depois(7))).toBe(true);
    expect(leadParado(moverLead(l, "perdido", t0), 7, depois(30))).toBe(false);
  });

  it("contatos para hoje: abertos com contato até hoje, da pessoa", () => {
    const leads = [
      novoLead("a", "hoje", { proximoContato: "2026-09-26", responsavelId: "m" }),
      novoLead("b", "atrasado", { proximoContato: "2026-09-20", responsavelId: "m" }),
      novoLead("c", "amanhã", { proximoContato: "2026-09-27", responsavelId: "m" }),
      novoLead("d", "do Áleff", { proximoContato: "2026-09-26", responsavelId: "a" }),
      novoLead("e", "ganho", { proximoContato: "2026-09-20", etapa: "ganho" }),
    ];
    expect(contatosParaHoje(leads, "m", "2026-09-26").map((l) => l.id)).toEqual(["b", "a"]);
    expect(contatosParaHoje(leads, null, "2026-09-26")).toHaveLength(3);
  });

  it("resumo do funil", () => {
    const r = resumoFunil(
      [
        novoLead("1", "a", { valorEstimadoCentavos: 100000 }),
        novoLead("2", "b"),
        novoLead("3", "c", { etapa: "ganho", fechadoEm: "2026-09-10T12:00:00Z", valorEstimadoCentavos: 200000 }),
        novoLead("4", "d", { etapa: "perdido", fechadoEm: "2026-08-10T12:00:00Z" }),
      ],
      "2026-09-26",
    );
    expect(r).toMatchObject({ abertos: 2, valorEmAbertoCentavos: 100000, semValor: 1, ganhosNoMes: 1, valorGanhoNoMesCentavos: 200000, taxaGanhoPct: 50 });
  });
});

describe("follow-up do vou ver", () => {
  it("conta os follow-ups e sugere perda só quando passa do máximo configurado", () => {
    const l = novoLead("l1", "Loja", { etapa: "proposta_enviada" });
    const fu = (id: string) => ({ id, leadId: "l1", tipo: "follow_up" as const, texto: "", em: "2026-10-01", autorNome: null });
    const nota = { id: "n", leadId: "l1", tipo: "nota" as const, texto: "", em: "2026-10-01", autorNome: null };
    expect(situacaoFollowUp(l, [fu("1"), nota], 2)).toEqual({ feitos: 1, sugerirPerda: false });
    expect(situacaoFollowUp(l, [fu("1"), fu("2")], 2)).toEqual({ feitos: 2, sugerirPerda: true });
    expect(situacaoFollowUp(l, [fu("1"), fu("2")], null).sugerirPerda).toBe(false);
    expect(situacaoFollowUp({ ...l, etapa: "perdido" }, [fu("1"), fu("2")], 2).sugerirPerda).toBe(false);
  });
});
