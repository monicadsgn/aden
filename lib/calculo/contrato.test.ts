// Contrato do cliente. Números e textos aqui são só fixtures de teste.
import { describe, expect, it } from "vitest";
import { itensDoTexto, MODELO_VAZIO, montarContrato, situacaoDoContrato, type ModeloContrato } from "./contrato";
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
  contratadaDocumento: "11111111000111",
  contratadaEndereco: "Rua B, 2",
  cidade: "Recife - Pernambuco",
  obrigacoes: "4.1. Obrigações da CONTRATADA:\na) Executar os serviços.\nb) Manter comunicação clara.\nObrigações do CONTRATANTE:\na) Aprovar no prazo.",
  disposicoes: "Não gera vínculo empregatício.\nForo da cidade.",
  signatariosAden: [{ nome: "Sócio", email: "socio@aden.com" }],
};
const opcoes = { hoje: "2026-09-30", contato: { whatsapp: "+55 81 0000-0000", email: "a@aden.com" } };

describe("contrato do cliente", () => {
  it("com ficha e modelo completos, fica pronto, no padrão: título com a marca, partes qualificadas, cláusulas numeradas", () => {
    const d = montarContrato(config(), "c", modelo, opcoes);
    expect(d.faltando).toEqual([]);
    expect(d.titulo).toBe("Contrato de prestação de serviços · Aden · Loja X");
    expect(d.subtitulo).toBe("Social media");
    expect(d.linhaTopo).toBe("Contratante: Loja X • Recife - Pernambuco, 30 de setembro de 2026");
    expect(d.partes[0].texto).toBe("Loja X, pessoa jurídica inscrita no CNPJ sob o nº 00.000.000/0001-00, com endereço em Rua A, 1, neste ato representada por Ana.");
    expect(d.partes[1].texto).toBe("Aden, pessoa jurídica inscrita no CNPJ sob o nº 11.111.111/0001-11, com sede em Rua B, 2, neste ato representada por Sócio.");
    const [objeto, prazo, valor] = d.clausulas;
    expect(objeto.titulo).toBe("1. Objeto do contrato");
    expect(objeto.itens.map((i) => i.marcador)).toEqual(["1.1", "1.2", "a)", "1.3"]);
    expect(objeto.itens[2].texto).toBe("Social media · Post: 8 por mês");
    expect(prazo.itens[0].texto).toBe("Este contrato começa a valer em 01/10/2026.");
    expect(valor.itens[0].texto).toMatch(/R\$\s2\.500,00 \(dois mil e quinhentos reais\)\.$/);
    expect(valor.itens[1].texto).toBe("O pagamento vence no dia 10 de cada mês.");
    const obrig = d.clausulas.find((c) => c.titulo.endsWith("Obrigações das partes"))!;
    expect(obrig.itens.map((i) => i.marcador)).toEqual(["5.1", "a)", "b)", "5.2", "a)"]);
    expect(obrig.itens[0].texto).toBe("Obrigações da CONTRATADA:");
    expect(d.localData).toBe("Recife - Pernambuco, 30 de setembro de 2026");
    expect(d.assinaturas).toEqual([
      { nome: "Ana", papel: "CONTRATANTE · Loja X" },
      { nome: "Sócio", papel: "CONTRATADA · Aden" },
    ]);
    expect(d.rodape).toBe("Recife - Pernambuco | +55 81 0000-0000 | a@aden.com");
    expect(d.signatarios).toEqual([
      { nome: "Ana", email: "ana@loja.com" },
      { nome: "Sócio", email: "socio@aden.com" },
    ]);
  });

  it("pessoa física com nome no contrato diferente da marca", () => {
    const c = config();
    c.clientes[0] = { ...c.clientes[0], razaoSocial: "Ana Maria Souza", documento: "12345678901" };
    expect(montarContrato(c, "c", modelo, opcoes).partes[0].texto).toBe("Ana Maria Souza, pessoa física inscrita no CPF sob o nº 123.456.789-01, com endereço em Rua A, 1 (Loja X).");
  });

  it("não inventa texto: modelo vazio aparece em faltando e as cláusulas dos sócios não entram", () => {
    const d = montarContrato(config(), "c", MODELO_VAZIO, opcoes);
    expect(d.faltando).toEqual(
      expect.arrayContaining([
        "Nome da contratada (Configurações → Contrato)",
        "Cidade da contratada (Configurações → Contrato)",
        "Obrigações das partes (Configurações → Contrato)",
        "Disposições gerais (Configurações → Contrato)",
        "Quem assina pela Aden (Configurações → Contrato)",
      ]),
    );
    expect(d.clausulas.some((s) => s.titulo.endsWith("Obrigações das partes"))).toBe(false);
  });

  it("aponta o que falta na ficha do cliente", () => {
    const c = config();
    c.clientes[0] = { ...c.clientes[0], email: "", documento: "", contrato: null, valorMensalCentavos: 0 };
    const d = montarContrato(c, "c", modelo, opcoes);
    expect(d.faltando).toEqual(
      expect.arrayContaining(["E-mail do cliente (ficha → Dados)", "CPF ou CNPJ do cliente (ficha → Dados)", "Valor mensal (ficha → Contrato)", "Dia do pagamento (ficha → Contrato)"]),
    );
  });

  it("vence no último dia útil quando o contrato diz", () => {
    const c = config();
    c.clientes[0].contrato = { ...c.clientes[0].contrato!, venceUltimoDiaUtil: true };
    const valor = montarContrato(c, "c", modelo, opcoes).clausulas.find((x) => x.titulo.endsWith("Valor e pagamento"))!;
    expect(valor.itens[1].texto).toBe("O pagamento vence no último dia útil de cada mês.");
  });

  it("texto dos sócios: uma cláusula por linha, número escrito é trocado", () => {
    expect(itensDoTexto("1. Primeira\n\n2) Segunda\nc) sub", 7)).toEqual([
      { marcador: "7.1", texto: "Primeira" },
      { marcador: "7.2", texto: "Segunda" },
      { marcador: "c)", texto: "sub", sub: true },
    ]);
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

describe("projeto de marca no contrato (opção A, 01/10/2026)", () => {
  it("sai como entrega única com prazo em dias; sem prazo, falta preencher", () => {
    const c = config();
    c.tiposEntrega.push({ id: "logo", nome: "Logo", servicoId: "s", horasPorUnidade: 30, ativo: true, projeto: true, prazoDias: 15 });
    c.clientes[0].escopo!.entregas.push({ id: "e3", tipoEntregaId: "logo", quantidade: 1, horasPorUnidade: null });
    const texto = JSON.stringify(montarContrato(c, "c", MODELO_VAZIO, opcoes));
    expect(texto).toContain("1 projeto, com entrega em até 15 dias");
    c.tiposEntrega = c.tiposEntrega.map((t) => (t.id === "logo" ? { ...t, prazoDias: null } : t));
    expect(montarContrato(c, "c", MODELO_VAZIO, opcoes).faltando.join(" ")).toContain("Prazo em dias do projeto Logo");
  });
});
