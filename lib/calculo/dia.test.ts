import { describe, expect, it } from "vitest";
import { diasDaGrade, montarVisaoDoDia, tarefasDoDia } from "./dia";
import { novaTarefa } from "./tarefas";

const hoje = "2026-09-26";

describe("visão do dia", () => {
  const tarefas = [
    novaTarefa("1", "hoje da Moni", { responsavelId: "m", vencimento: hoje }),
    novaTarefa("2", "atrasada da Moni", { responsavelId: "m", vencimento: "2026-09-20" }),
    novaTarefa("3", "semana do Áleff", { responsavelId: "a", vencimento: "2026-09-30" }),
    novaTarefa("4", "sem dono", { vencimento: hoje }),
    novaTarefa("5", "em aprovação da Moni", { responsavelId: "m", status: "revisao" }),
    novaTarefa("6", "feita hoje", { responsavelId: "m", status: "concluida", concluidaEm: new Date(2026, 8, 26, 10).toISOString() }),
  ];
  it("minhas: só o que é do login", () => {
    const v = montarVisaoDoDia(tarefas, "m", hoje);
    expect(v.hoje.map((t) => t.id)).toEqual(["1"]);
    expect(v.atrasadas.map((t) => t.id)).toEqual(["2"]);
    expect(v.semana).toHaveLength(0);
    expect(v.emAprovacao.map((t) => t.id)).toEqual(["5"]);
    expect(v.concluidasHoje.map((t) => t.id)).toEqual(["6"]);
    expect(v.semResponsavel).toHaveLength(0);
  });
  it("do outro sócio, e de todos (com as sem dono)", () => {
    expect(montarVisaoDoDia(tarefas, "a", hoje).semana.map((t) => t.id)).toEqual(["3"]);
    const todos = montarVisaoDoDia(tarefas, null, hoje);
    expect(todos.hoje.map((t) => t.id).sort()).toEqual(["1", "4"]);
    expect(todos.semResponsavel.map((t) => t.id)).toEqual(["4"]);
  });
  it("calendário: tarefa aparece do início ao vencimento; grade em semanas completas", () => {
    const t = novaTarefa("x", "x", { inicio: "2026-09-24", vencimento: "2026-09-26" });
    expect(tarefasDoDia([t], "2026-09-25")).toHaveLength(1);
    expect(tarefasDoDia([t], "2026-09-27")).toHaveLength(0);
    const g = diasDaGrade(2026, 8);
    expect(g.length % 7).toBe(0);
    expect(g[0]).toBe("2026-08-30");
    expect(g).toContain("2026-09-30");
  });
});
