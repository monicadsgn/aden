// Onboarding do cliente. Textos e números aqui são só fixtures de teste.
import { describe, expect, it } from "vitest";
import { novoCenario, configVazia } from "./novo";
import { blocosDoTexto, montarOnboarding, type ModeloOnboarding } from "./onboarding";
import type { Configuracao } from "./tipos";

function config(): Configuracao {
  const c = configVazia();
  c.servicos = [
    { id: "sm", nome: "Social media", divisaoPadrao: {}, ativo: true },
    { id: "tp", nome: "Tráfego pago", divisaoPadrao: {}, ativo: true },
  ];
  c.tiposEntrega = [{ id: "t", nome: "Post estático", nomeCliente: "Post", servicoId: "sm", horasPorUnidade: 1, ativo: true }];
  const escopo = { ...novoCenario("x"), clienteId: "c" };
  escopo.entregas = [{ id: "e", tipoEntregaId: "t", quantidade: 8, horasPorUnidade: null }];
  c.clientes = [
    {
      id: "c",
      nome: "Loja Ação",
      interno: false,
      participaRateio: true,
      valorMensalCentavos: 100000,
      ativo: true,
      escopo,
      contrato: {
        inicio: null, fim: null, prazoMinimoMeses: null, diaPagamento: null, avisoPrevioDias: null,
        limiteRodadas: 2, prazoAprovacaoDias: null, prazoEntregaDias: null, inicioCobranca: "", observacoes: "",
        limiteReunioesMes: 1, garantiaResultado: "10 vendas",
      },
    },
  ];
  return c;
}

const modelo: ModeloOnboarding = {
  secoes: [
    { chave: "livre", titulo: "Boas-vindas", texto: "Agora é com a gente.\nSegunda linha." },
    { chave: "incluso", titulo: "O que está incluso", texto: "" },
    { chave: "servicos", titulo: "Como funciona", texto: "" },
    { chave: "prazos", titulo: "Prazos", texto: "- Atendimento: {atendimento}." },
    { chave: "livre", titulo: "Dúvidas", texto: "- Posso pedir extras? Pode.\n- Sem pergunta" },
    { chave: "contato", titulo: "Fala com a gente", texto: "" },
  ],
  textoServico: { sm: "nós planejamos o mês.", tp: "campanhas no ar." },
  textoGarantia: "O que conta como resultado:",
  whatsapp: "(81) 0000-0000",
  instagram: "@aden",
  email: "a@a.com",
  atendimento: "seg a sex",
};

describe("onboarding do cliente", () => {
  it("junta o texto dos sócios com o pacote, o serviço contratado, a garantia e o contrato", () => {
    const d = montarOnboarding(config(), "c", modelo, "2026-10-05");
    expect(d.faltando).toEqual([]);
    expect(d.arquivo).toBe("onboarding_LojaAcao_10-2026");
    const s = Object.fromEntries(d.secoes.map((x) => [x.titulo, x.blocos]));
    expect(s["Boas-vindas"]).toEqual([{ tipo: "paragrafo", texto: "Agora é com a gente. Segunda linha." }]);
    expect(s["O que está incluso"][0]).toEqual({ tipo: "lista", itens: [{ destaque: null, texto: "Social media · Post: 8 por mês" }] });
    // só o serviço contratado entra; a garantia vem da ficha
    expect(s["Como funciona"]).toEqual([
      { tipo: "lista", itens: [{ destaque: "Social media:", texto: "nós planejamos o mês." }] },
      { tipo: "paragrafo", texto: "O que conta como resultado: 10 vendas" },
    ]);
    expect(s["Prazos"][0]).toMatchObject({ itens: [{ texto: "Ajustes por peça: até 2" }, { texto: "Reuniões por mês: até 1" }] });
    expect(s["Prazos"][1]).toMatchObject({ itens: [{ texto: "Atendimento: seg a sex." }] });
    expect(s["Dúvidas"][0]).toMatchObject({ itens: [{ destaque: "Posso pedir extras?", texto: "Pode." }, { destaque: null, texto: "Sem pergunta" }] });
    expect(s["Fala com a gente"]).toEqual([{ tipo: "paragrafo", texto: "WhatsApp (81) 0000-0000 · Instagram @aden · a@a.com · seg a sex" }]);
  });

  it("não inventa: o que está vazio aparece em faltando", () => {
    const d = montarOnboarding(config(), "c", { ...modelo, textoServico: {}, whatsapp: null, atendimento: null }, "2026-10-05");
    expect(d.faltando).toEqual(
      expect.arrayContaining([
        "Como funciona o serviço Social media (Configurações → Onboarding)",
        "WhatsApp (Configurações → Onboarding)",
        "Dias e horário de atendimento (Configurações → Onboarding)",
      ]),
    );
  });

  it("listas numeradas", () => {
    expect(blocosDoTexto("1. Contrato\n2. Pagamento")).toEqual([
      { tipo: "numerada", itens: [{ destaque: null, texto: "Contrato" }, { destaque: null, texto: "Pagamento" }] },
    ]);
  });
});
