import { describe, expect, it } from "vitest";
import { agruparPorCalendario, prontasDoCalendario } from "./lotes";
import type { Tarefa } from "./tarefas";

const t = (id: string, lote: string | null, o: Partial<Tarefa> = {}): Tarefa => ({
  id, titulo: id, clienteId: "sp", tipoEntregaId: null, quantidade: 1, status: "a_fazer", prioridade: null, responsavelId: null,
  inicio: null, vencimento: null, descricao: "", etapas: [], criadoEm: "2026-10-01", concluidaEm: null, lote, ...o,
});

describe("peças do mesmo calendário num card só", () => {
  it("junta no lugar da primeira peça e deixa sozinha a que não tem par", () => {
    const g = agruparPorCalendario([t("a", null), t("b", "Cards"), t("c", "Outro"), t("d", "Cards")]);
    expect(g.map((x) => (x.tipo === "tarefa" ? x.tarefa.id : `[${x.tarefas.map((y) => y.id).join(",")}]`))).toEqual(["a", "[b,d]", "c"]);
  });
  it("mesmo nome de calendário em clientes diferentes não se mistura", () => {
    const g = agruparPorCalendario([t("a", "Outubro"), t("b", "Outubro", { clienteId: "ol" })]);
    expect(g.every((x) => x.tipo === "tarefa")).toBe(true);
  });
  it("conta as prontas do calendário inteiro", () => {
    const todas = [t("a", "Cards", { status: "concluida" }), t("b", "Cards", { clienteAprovouEm: "x" }), t("c", "Cards"), t("d", "Outro")];
    expect(prontasDoCalendario(todas, todas[2])).toEqual({ prontas: 2, total: 3 });
  });
});
