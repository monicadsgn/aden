import { describe, expect, it } from "vitest";
import { configVazia } from "../calculo/novo";
import { camposFaltando, passosParaComecar, pendencias, SEM_O_OBRIGATORIO } from "./pendencias";

describe("para começar", () => {
  it("config vazia: o primeiro passo é cadastrar os sócios; metas e limites nunca aparecem", () => {
    const passos = passosParaComecar(configVazia());
    expect(passos[0].secao).toBe("socios");
    expect(passos[0].faltando.length).toBeGreaterThan(0);
    expect(passos.map((p) => p.secao)).not.toContain("metas");
    expect(passos.map((p) => p.secao)).not.toContain("limites");
    // sem terceiro, pacote nem cliente cadastrado, esses passos não aparecem
    expect(passos.map((p) => p.secao)).not.toContain("terceiros");
    expect(passos.map((p) => p.secao)).not.toContain("clientes");
  });
  it("sócio preenchido: o passo dos sócios fica pronto", () => {
    const c = configVazia();
    c.pessoas = [{ id: "m", nome: "Moni", socio: true, ativo: true, percentualPadrao: 100, pisoHoraCentavos: 1, capacidadeHorasMes: 1 }];
    expect(passosParaComecar(c)[0].faltando).toEqual([]);
  });
});

describe("falta preencher: obrigatório x opcional", () => {
  it("limites vazios são opcionais: não acendem o selo, viram lembrete com o que vale vazio", () => {
    const c = configVazia();
    expect(camposFaltando(c).limites).toEqual([]);
    const opc = pendencias(c).limites.opcional;
    expect(opc.map((o) => o.campo)).toContain("teto do ano");
    expect(opc.every((o) => o.vazio.length > 0)).toBe(true);
  });
  it("regra da divisão dos custos fixos e ordem de distribuição são obrigatórias; reinvestimento e taxa são opcionais", () => {
    const p = pendencias(configVazia()).regras;
    expect(p.obrigatorio).toContain("regra da divisão dos custos fixos");
    expect(p.obrigatorio).toContain("ordem de distribuição dos pagamentos");
    expect(p.opcional.map((o) => o.campo)).toEqual(expect.arrayContaining(["reinvestimento", "taxa de recebimento"]));
    expect(p.obrigatorio).not.toContain("reinvestimento");
  });
  it("% dos sócios e tempo por entrega são obrigatórios", () => {
    const c = configVazia();
    c.pessoas = [{ id: "m", nome: "Moni", socio: true, ativo: true, percentualPadrao: null, pisoHoraCentavos: null, capacidadeHorasMes: null }];
    c.tiposEntrega = [{ id: "t", nome: "Post", servicoId: null, horasPorUnidade: null, audiovisual: false, ativo: true }];
    const f = camposFaltando(c);
    expect(f.socios).toContain("% de Moni");
    expect(f.tipos).toContain("tempo de Post");
  });
  it("toda seção com obrigatório diz o que acontece se ficar vazio", () => {
    const c = configVazia();
    c.pessoas = [{ id: "m", nome: "Moni", socio: true, ativo: true, percentualPadrao: null, pisoHoraCentavos: null, capacidadeHorasMes: null }];
    for (const [secao, v] of Object.entries(pendencias(c))) if (v.obrigatorio.length) expect(SEM_O_OBRIGATORIO[secao as keyof typeof SEM_O_OBRIGATORIO], secao).toBeTruthy();
  });
});
