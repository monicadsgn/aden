// Dia da postagem e prazo 1 dia antes (regra da Moni, 13/10/2026).
import { describe, expect, it } from "vitest";
import { ordenarParaQuadro, novaTarefa } from "../calculo/tarefas";
import { conferirPrazoDaPeca, ehPostagemPlanejada, semDiaDaPostagem, vesperaDaPostagem } from "./prazoPostagem";

// 15h UTC = 12h em Brasília
const dia = (d: string) => `${d}T15:00:00.000Z`;

describe("prazo da peça: 1 dia antes da postagem", () => {
  it("a véspera é calculada no dia de Brasília (postagem de madrugada não pula de dia)", () => {
    expect(vesperaDaPostagem(dia("2026-10-14"))).toBe("2026-10-13");
    // 01h de Brasília do dia 14 = 04h UTC do dia 14: a véspera é o dia 13
    expect(vesperaDaPostagem("2026-10-14T04:00:00.000Z")).toBe("2026-10-13");
    // 22h de Brasília do dia 14 = 01h UTC do dia 15: continua dia 14, véspera 13
    expect(vesperaDaPostagem("2026-10-15T01:00:00.000Z")).toBe("2026-10-13");
    // virada de mês
    expect(vesperaDaPostagem(dia("2026-11-01"))).toBe("2026-10-31");
  });

  it("prazo vazio entra sozinho na véspera", () => {
    const t = novaTarefa("1", "Post", { clienteId: "c", publicarEm: dia("2026-10-20") });
    const r = conferirPrazoDaPeca(t);
    expect(r.ajuste).toBe("preencheu");
    expect(r.tarefa.vencimento).toBe("2026-10-19");
  });

  it("prazo no dia da postagem (ou depois) volta para a véspera", () => {
    const igual = conferirPrazoDaPeca(novaTarefa("1", "Post", { clienteId: "c", publicarEm: dia("2026-10-20"), vencimento: "2026-10-20" }));
    expect(igual).toMatchObject({ ajuste: "antecipou", prazoAnterior: "2026-10-20" });
    expect(igual.tarefa.vencimento).toBe("2026-10-19");
    const depois = conferirPrazoDaPeca(novaTarefa("2", "Post", { clienteId: "c", publicarEm: dia("2026-10-20"), vencimento: "2026-10-25" }));
    expect(depois.tarefa.vencimento).toBe("2026-10-19");
  });

  it("prazo mais cedo que a véspera fica como está", () => {
    const t = novaTarefa("1", "Post", { clienteId: "c", publicarEm: dia("2026-10-20"), vencimento: "2026-10-16" });
    const r = conferirPrazoDaPeca(t);
    expect(r.ajuste).toBeNull();
    expect(r.tarefa).toBe(t);
    expect(r.vespera).toBe("2026-10-19");
  });

  it("início depois do novo prazo encosta no prazo", () => {
    const r = conferirPrazoDaPeca(novaTarefa("1", "Post", { clienteId: "c", publicarEm: dia("2026-10-20"), inicio: "2026-10-20", vencimento: "2026-10-20" }));
    expect(r.tarefa).toMatchObject({ inicio: "2026-10-19", vencimento: "2026-10-19" });
  });

  it("não mexe em tarefa sem data de postagem, publicada ou concluída", () => {
    const sem = novaTarefa("1", "PDF", { clienteId: "c", vencimento: "2026-10-20" });
    expect(conferirPrazoDaPeca(sem).tarefa).toBe(sem);
    const publicada = novaTarefa("2", "Post", { clienteId: "c", publicarEm: dia("2026-10-20"), vencimento: "2026-10-20", publicadaEm: dia("2026-10-20") });
    expect(conferirPrazoDaPeca(publicada).tarefa).toBe(publicada);
    const feita = novaTarefa("3", "Post", { clienteId: "c", publicarEm: dia("2026-10-20"), vencimento: "2026-10-20", status: "concluida" });
    expect(conferirPrazoDaPeca(feita).tarefa).toBe(feita);
  });
});

describe("peça de calendário sem o dia da postagem", () => {
  it("do planejamento (calendário ou rede) sem o dia: falta o dia", () => {
    expect(semDiaDaPostagem(novaTarefa("1", "Post", { clienteId: "c", lote: "Calendário Outubro", visivelCliente: true }))).toBe(true);
    expect(semDiaDaPostagem(novaTarefa("2", "Post", { clienteId: "c", rede: "instagram", legenda: "oi" }))).toBe(true);
  });

  it("com o dia, publicada, concluída ou fora do planejamento não é cobrada", () => {
    expect(semDiaDaPostagem(novaTarefa("1", "Post", { clienteId: "c", lote: "x", publicarEm: dia("2026-10-20") }))).toBe(false);
    expect(semDiaDaPostagem(novaTarefa("2", "Post", { clienteId: "c", lote: "x", status: "concluida" }))).toBe(false);
    expect(semDiaDaPostagem(novaTarefa("3", "Post", { clienteId: "c", lote: "x", publicadaEm: dia("2026-10-20") }))).toBe(false);
    // projeto de marca enviado ao cliente (logo, PDF): é peça, mas não é postagem de calendário
    expect(semDiaDaPostagem(novaTarefa("4", "Logo", { clienteId: "c", visivelCliente: true, legenda: "Segue a logo" }))).toBe(false);
    // tarefa sem cliente
    expect(ehPostagemPlanejada(novaTarefa("5", "Interna", { lote: "x" }))).toBe(false);
  });
});

describe("ordem do quadro: da data mais perto para a mais longe", () => {
  const t = (id: string, extra: Parameters<typeof novaTarefa>[2]) => novaTarefa(id, id, { clienteId: "c", ...extra }, new Date("2026-10-01T12:00:00Z"));

  it("ordena pelo dia da postagem, do mais perto para o mais longe", () => {
    const col = [t("longe", { publicarEm: dia("2026-10-30") }), t("perto", { publicarEm: dia("2026-10-14") }), t("meio", { publicarEm: dia("2026-10-20") })];
    expect(ordenarParaQuadro(col, "a_fazer").map((x) => x.id)).toEqual(["perto", "meio", "longe"]);
  });

  it("sem data de postagem usa o prazo; sem nenhuma das duas vai para o fim", () => {
    const col = [t("semdata", {}), t("prazo", { vencimento: "2026-10-16" }), t("post", { publicarEm: dia("2026-10-14") })];
    expect(ordenarParaQuadro(col, "em_producao").map((x) => x.id)).toEqual(["post", "prazo", "semdata"]);
  });

  it("empate de data: a mais antiga criada primeiro; não muda a lista de entrada", () => {
    const a = novaTarefa("a", "a", { publicarEm: dia("2026-10-14") }, new Date("2026-10-02T12:00:00Z"));
    const b = novaTarefa("b", "b", { publicarEm: dia("2026-10-14") }, new Date("2026-10-01T12:00:00Z"));
    const entrada = [a, b];
    expect(ordenarParaQuadro(entrada, "revisao").map((x) => x.id)).toEqual(["b", "a"]);
    expect(entrada.map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("em Concluída, o mais perto de hoje fica em cima", () => {
    const col = [t("velha", { publicarEm: dia("2026-09-10") }), t("recente", { publicarEm: dia("2026-10-10") }), t("semdata", {})];
    expect(ordenarParaQuadro(col, "concluida").map((x) => x.id)).toEqual(["recente", "velha", "semdata"]);
  });
});
