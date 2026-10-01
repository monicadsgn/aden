// G8 da auditoria (01/10/2026): apagar também é mudar o que é protegido.
import { describe, expect, it } from "vitest";
import { configVazia } from "../calculo/novo";
import { motivoNaoApagar } from "./aprovacao";

function config() {
  const c = configVazia();
  c.pessoas = [
    { id: "m", nome: "Mônica", socio: true, percentualPadrao: 50, pisoHoraCentavos: 6800, capacidadeHorasMes: 100, ativo: true },
    { id: "f", nome: "Freela", socio: false, percentualPadrao: null, pisoHoraCentavos: null, capacidadeHorasMes: null, ativo: true },
  ];
  c.servicos = [
    { id: "sm", nome: "Social media", divisaoPadrao: { m: 100 }, ativo: true },
    { id: "nv", nome: "Novo", divisaoPadrao: {}, ativo: true },
  ];
  c.tiposEntrega = [
    { id: "post", nome: "Post", servicoId: "sm", horasPorUnidade: 0.5, audiovisual: false, ativo: true },
    { id: "logo", nome: "Logo", servicoId: null, horasPorUnidade: null, audiovisual: false, ativo: true },
  ];
  return c;
}

describe("o que é protegido não se apaga", () => {
  it("sócio nunca; quem não é sócio pode", () => {
    expect(motivoNaoApagar(config(), "socio", "m")).toMatch(/sócio/);
    expect(motivoNaoApagar(config(), "socio", "f")).toBeNull();
  });
  it("serviço com divisão de horas e tipo com tempo: desativar, não apagar", () => {
    expect(motivoNaoApagar(config(), "servico", "sm")).toMatch(/desative/);
    expect(motivoNaoApagar(config(), "servico", "nv")).toBeNull();
    expect(motivoNaoApagar(config(), "tipo_entrega", "post")).toMatch(/desative/);
    expect(motivoNaoApagar(config(), "tipo_entrega", "logo")).toBeNull();
  });
});
