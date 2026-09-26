// Números são fixtures de teste, não valores de negócio.
import { describe, expect, it } from "vitest";
import { vistaPacote } from "./apresentacao";
import { calcularVisaoMes } from "./mes";
import { calcularTrilha, espacoPraVender } from "./metas";
import { ajustarQuantidade, calcularCenario } from "./motor";
import { configVazia } from "./novo";
import { diferencaDoPacote, frasesParaCliente, pacoteParaCenario, precoDoPacote } from "./pacotes";
import type { Configuracao, Pacote } from "./tipos";

function cfg(): Configuracao {
  const c = configVazia();
  c.empresa = { reinvestimentoPct: 0, impostoPct: 0, taxaRecebimentoPct: 0, regraRateio: "igual", regime: "mei", impostoFixoMensalCentavos: 0 };
  c.pessoas = [{ id: "m", nome: "M", socio: true, percentualPadrao: 100, pisoHoraCentavos: 6000, capacidadeHorasMes: 20, ativo: true }];
  c.servicos = [{ id: "sm", nome: "Social media", divisaoPadrao: { m: 100 }, ativo: true }];
  c.terceiros = [{ id: "av", nome: "Audiovisual", inclui: "gravação e edição", fraseCliente: "gravação e edição mensal inclusa", valorPorSaidaCentavos: 30000, deslocamentoMedioCentavos: 5000, ativo: true }];
  c.tiposEntrega = [
    { id: "post", nome: "Post", servicoId: "sm", horasPorUnidade: 1, ativo: true },
    { id: "grav", nome: "Gravação", servicoId: null, horasPorUnidade: null, audiovisual: true, terceiroId: "av", ativo: true },
    { id: "onb", nome: "Onboarding", servicoId: "sm", horasPorUnidade: 2, ativo: true },
  ];
  return c;
}
const pacote = (): Pacote => ({
  id: "p",
  nome: "Social media padrão",
  descricao: "",
  itensCliente: ["planejamento e relatório mensal"],
  rotina: [
    { tipoEntregaId: "post", quantidade: 4 },
    { tipoEntregaId: "grav", quantidade: 1 },
  ],
  entrada: [{ tipoEntregaId: "onb", quantidade: 1 }],
  padrao: true,
  ativo: true,
});

describe("terceiro por saída", () => {
  it("custo = saídas × (valor + deslocamento), só do cliente; deslocamento real troca o médio", () => {
    const c = cfg();
    const cen = pacoteParaCenario(pacote());
    const r = calcularCenario(c, cen);
    expect(r.mes!.custosPorCategoria.audiovisual).toBe(35000);
    expect(r.alertas.some((a) => /vídeo, mas não há custo/.test(a.texto))).toBe(false);
    const longe = calcularCenario(c, { ...cen, deslocamentos: { av: 12000 } });
    expect(longe.mes!.custosPorCategoria.audiovisual).toBe(42000);
    // mudou o valor do terceiro: recalcula
    c.terceiros![0].valorPorSaidaCentavos = 40000;
    expect(calcularCenario(c, cen).mes!.custosPorCategoria.audiovisual).toBe(45000);
  });

  it("valor por saída vazio vira erro que aponta para Terceiros", () => {
    const c = cfg();
    c.terceiros![0].valorPorSaidaCentavos = null;
    const r = calcularCenario(c, pacoteParaCenario(pacote()));
    expect(r.alertas.find((a) => /valor por saída/.test(a.texto))?.acao?.destino).toEqual({ tipo: "config", secao: "terceiros" });
  });
});

describe("pacote", () => {
  it("preço sai do cálculo: mensal = mínimo do escopo; primeiro mês = custos + horas no piso", () => {
    const c = cfg();
    const p = precoDoPacote(c, pacote());
    // 4 h × R$ 60 = R$ 240 de piso + R$ 350 da saída = R$ 590
    expect(p.mensalCentavos).toBe(59000);
    // 2 h de onboarding × R$ 60
    expect(p.entradaCentavos).toBe(12000);
  });

  it("entrada com quantidade vazia fica 'a confirmar'", () => {
    const pk = { ...pacote(), entrada: [{ tipoEntregaId: "onb", quantidade: null }] };
    const p = precoDoPacote(cfg(), pk);
    expect(p.entradaAConfirmar).toBe(true);
    expect(p.entradaCentavos).toBeNull();
  });

  it("cliente vê frases (a do terceiro entra sozinha) e a diferença ao personalizar", () => {
    const c = cfg();
    const pk = pacote();
    expect(frasesParaCliente(c, pk, pacoteParaCenario(pk))).toEqual(["planejamento e relatório mensal", "gravação e edição mensal inclusa"]);
    const mais = ajustarQuantidade(pacoteParaCenario(pk), "post", 1);
    expect(diferencaDoPacote(pk, mais)).toEqual([{ tipoEntregaId: "post", original: 4, atual: 5 }]);
    const v = vistaPacote(c, pk, { cenario: mais, desligados: {} });
    expect(v.diferencaMensalCentavos).toBe(6000);
    expect(vistaPacote(c, pk, { cenario: pacoteParaCenario(pk), desligados: {} }).diferencaMensalCentavos).toBeNull();
  });
});

describe("visão do mês: espaço pra vender e trilha", () => {
  it("cabem N clientes do pacote padrão pelas horas livres", () => {
    const c = cfg();
    // 20 h de capacidade, pacote usa 4 h
    expect(espacoPraVender(c, pacote()).cabem).toBe(5);
    c.pessoas[0].capacidadeHorasMes = null;
    expect(espacoPraVender(c, pacote()).cabem).toBeNull();
  });

  it("degrau batido fica conquistado e o atual é o primeiro não batido", () => {
    const c = cfg();
    c.clientes = [{ id: "k", nome: "K", interno: false, participaRateio: true, valorMensalCentavos: 100000, ativo: true }];
    c.metas = [
      { id: "1", nome: "Primeiro cliente", criterio: "clientes", alvo: 1, acao: "", conquistadaEm: null },
      { id: "2", nome: "R$ 5 mil", criterio: "faturamento_mensal", alvo: 500000, acao: "primeira terceirização", conquistadaEm: null },
    ];
    const t = calcularTrilha(c, calcularVisaoMes(c));
    expect(t.degraus[0]).toMatchObject({ batida: true, conquistarAgora: true });
    expect(t.atual).toBe(1);
    expect(t.degraus[1]).toMatchObject({ progressoPct: 20, falta: 400000 });
    // conquista guardada não se perde se o número cair
    c.metas[0].conquistadaEm = "2026-09-26T00:00:00Z";
    c.clientes = [];
    expect(calcularTrilha(c).degraus[0].batida).toBe(true);
  });
});
