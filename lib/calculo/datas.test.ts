// Datas comemorativas no planejamento. Números aqui são só fixtures de teste.
import { describe, expect, it } from "vitest";
import { datasDoPlanejamento, diasAntes, type DataComemorativa, type DataDoCliente } from "./datas";

const datas: DataComemorativa[] = [
  { id: "criancas", nome: "Dia das Crianças", data: "2026-10-12", ativo: true },
  { id: "bf", nome: "Black Friday", data: "2026-11-27", ativo: true },
  { id: "natal", nome: "Natal", data: "2026-12-25", ativo: true },
  { id: "velha", nome: "Desligada", data: "2026-10-20", ativo: false },
];
const lig = (dataId: string, clienteId: string, dias: number | null, extra: Partial<DataDoCliente> = {}): DataDoCliente => ({
  id: `${dataId}-${clienteId}`,
  dataId,
  clienteId,
  diasAntecedencia: dias,
  nota: null,
  escondida: false,
  ...extra,
});
const ligacoes = [
  lig("criancas", "olinda", 45, { nota: "roupinhas" }),
  lig("bf", "olinda", 60),
  lig("bf", "stadium", 45),
  lig("natal", "olinda", 60),
  lig("velha", "olinda", 10),
];

describe("datas comemorativas no planejamento", () => {
  it("conta dias para trás no calendário", () => {
    expect(diasAntes("2026-11-27", 60)).toBe("2026-09-28");
    expect(diasAntes("2027-03-01", 1)).toBe("2027-02-28");
  });

  it("cada cliente com a própria janela: a data do mês e as campanhas que abrem ou já abriram", () => {
    const o = datasDoPlanejamento("2026-10", datas, ligacoes, "olinda");
    expect(o.datasDoMes.map((d) => [d.nome, d.nota])).toEqual([["Dia das Crianças", "roupinhas"]]);
    expect(o.campanhasQueComecam.map((d) => [d.nome, d.janelaAbreEm, d.situacao])).toEqual([
      ["Black Friday", "2026-09-28", "já aberta (começou antes)"],
      ["Natal", "2026-10-26", "abre neste mês"],
    ]);
    const s = datasDoPlanejamento("2026-10", datas, ligacoes, "stadium");
    expect(s.datasDoMes).toEqual([]);
    expect(s.campanhasQueComecam.map((d) => [d.nome, d.janelaAbreEm, d.situacao])).toEqual([["Black Friday", "2026-10-13", "abre neste mês"]]);
  });

  it("escondida, desligada, sem antecedência ou já passada não entram como campanha", () => {
    const l = [lig("bf", "olinda", null), lig("natal", "olinda", 60, { escondida: true }), lig("velha", "olinda", 10)];
    const o = datasDoPlanejamento("2026-10", datas, l, "olinda");
    expect(o.datasDoMes).toEqual([]);
    expect(o.campanhasQueComecam).toEqual([]);
    expect(datasDoPlanejamento("2026-12", datas, ligacoes, "olinda").campanhasQueComecam).toEqual([]);
  });

  it("sem cliente traz de todos, um item por cliente", () => {
    const t = datasDoPlanejamento("2026-11", datas, ligacoes);
    expect(t.datasDoMes.map((d) => d.clienteId).sort()).toEqual(["olinda", "stadium"]);
    expect(() => datasDoPlanejamento("out/26", datas, ligacoes)).toThrow(/AAAA-MM/);
  });
});
