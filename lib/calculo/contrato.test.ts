// Contrato do cliente. Números e textos aqui são só fixtures de teste.
import { describe, expect, it } from "vitest";
import { MODELO_VAZIO, montarContrato, paragrafos, situacaoDoContrato, type ModeloContrato } from "./contrato";
import { configVazia, novoCenario } from "./novo";
import type { Configuracao } from "./tipos";

function config(): Configuracao {
  const c = configVazia();
  c.servicos = [{ id: "s", nome: "Social media", divisaoPadrao: {}, ativo: true }];
  c.tiposEntrega = [
    { id: "t1", nome: "Post estático", servicoId: "s", horasPorUnidade: 1, ativo: true, nomeCliente: "Post" },
    { id: "t2", nome: "Reels", servicoId: "s", horasPorUnidade: 1, ativo: true },
  ];
  const escopo = { ...novoCenario("x"), clienteId: "c" };
  escopo.entregas = [
    { id: "e1", tipoEntregaId: "t1", quantidade: 8, horasPorUnidade: null },
    { id: "e2", tipoEntregaId: "t2", quantidade: 0, horasPorUnidade: null },
  ];
  c.clientes = [
    {
      id: "c",
      nome: "Loja X",
      interno: false,
      participaRateio: true,
      valorMensalCentavos: 250000,
      ativo: true,
      escopo,
      contato: "Ana",
      email: "Ana@Loja.com",
      documento: "00.000.000/0001-00",
      endereco: "Rua A, 1",
      contrato: {
        inicio: "2026-10-01",
        fim: null,
        prazoMinimoMeses: 3,
        diaPagamento: 10,
        avisoPrevioDias: 30,
        limiteRodadas: 2,
        prazoAprovacaoDias: null,
        prazoEntregaDias: null,
        inicioCobranca: "",
        observacoes: "",
        limiteReunioesMes: 2,
      },
    },
  ];
  return c;
}

const modelo: ModeloContrato = {
  contratadaNome: "Aden",
  contratadaDocumento: "11.111.111/0001-11",
  contratadaEndereco: null,
  obrigacoes: "Primeiro parágrafo\ncontinua.\n\nSegundo.",
  disposicoes: "Foro da cidade.",
  signatariosAden: [{ nome: "Sócio", email: "socio@aden.com" }],
};

describe("contrato do cliente", () => {
  it("com ficha e modelo completos, fica pronto e usa o nome que o cliente vê", () => {
    const d = montarContrato(config(), "c", modelo);
    expect(d.faltando).toEqual([]);
    const objeto = d.secoes.find((s) => s.titulo.startsWith("Objeto"))!;
    expect(objeto.itens).toEqual([{ rotulo: "Social media · Post", valor: "8 por mês" }]);
    expect(d.secoes.find((s) => s.titulo === "Valor e pagamento")!.itens![1].valor).toBe("dia 10 de cada mês");
    expect(d.secoes.find((s) => s.titulo === "Prazo")!.itens).toContainEqual({ rotulo: "Início", valor: "01/10/2026" });
    expect(d.signatarios).toEqual([
      { nome: "Ana", email: "ana@loja.com" },
      { nome: "Sócio", email: "socio@aden.com" },
    ]);
  });

  it("não inventa texto: modelo vazio aparece em faltando e as seções dos sócios não entram", () => {
    const d = montarContrato(config(), "c", MODELO_VAZIO);
    expect(d.faltando).toEqual(
      expect.arrayContaining([
        "Nome da contratada (Configurações → Contrato)",
        "Obrigações das partes (Configurações → Contrato)",
        "Disposições gerais (Configurações → Contrato)",
        "Quem assina pela Aden (Configurações → Contrato)",
      ]),
    );
    expect(d.secoes.some((s) => s.titulo === "Obrigações")).toBe(false);
  });

  it("aponta o que falta na ficha do cliente", () => {
    const c = config();
    c.clientes[0] = { ...c.clientes[0], email: "", documento: "", contrato: null, valorMensalCentavos: 0 };
    const d = montarContrato(c, "c", modelo);
    expect(d.faltando).toEqual(
      expect.arrayContaining(["E-mail do cliente (ficha → Dados)", "CPF ou CNPJ do cliente (ficha → Dados)", "Valor mensal (ficha → Contrato)", "Dia do pagamento (ficha → Contrato)"]),
    );
  });

  it("vence no último dia útil quando o contrato diz", () => {
    const c = config();
    c.clientes[0].contrato = { ...c.clientes[0].contrato!, venceUltimoDiaUtil: true };
    expect(montarContrato(c, "c", modelo).secoes.find((s) => s.titulo === "Valor e pagamento")!.itens![1].valor).toBe("último dia útil de cada mês");
  });

  it("parágrafos separados por linha em branco", () => {
    expect(paragrafos(modelo.obrigacoes)).toEqual(["Primeiro parágrafo continua.", "Segundo."]);
  });
});

describe("situação da assinatura", () => {
  const a = (assinadoEm: string | null, extra: Partial<{ assina: boolean; recusadoEm: string }> = {}) => ({
    nome: "X",
    email: "x@x.com",
    assina: true,
    assinadoEm,
    recusadoEm: null,
    ...extra,
  });

  it("assinado só quando todos que assinam assinaram; quem só recebe cópia não conta", () => {
    expect(situacaoDoContrato([a("2026-10-02T10:00:00Z"), a(null)]).situacao).toBe("enviado");
    expect(situacaoDoContrato([a("2026-10-02T10:00:00Z"), a("2026-10-03T10:00:00Z"), a(null, { assina: false })])).toMatchObject({
      situacao: "assinado",
      assinadoEm: "2026-10-03T10:00:00Z",
    });
  });

  it("recusado se alguém recusou", () => {
    expect(situacaoDoContrato([a(null, { recusadoEm: "2026-10-02" })]).situacao).toBe("recusado");
  });
});
