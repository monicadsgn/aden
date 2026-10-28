import { describe, expect, it } from "vitest";
import { barraProducao, faltaParaComecar } from "./prontoParaComecar";
import { faltaParaFechar } from "./fechamentoLead";
import { novoLead } from "../calculo/crm";
import type { ClienteBase } from "../calculo/tipos";

const base = (o: Partial<ClienteBase> = {}): ClienteBase => ({
  id: "c1",
  nome: "Cliente",
  interno: false,
  participaRateio: true,
  valorMensalCentavos: null,
  ativo: true,
  escopo: null,
  ...o,
});

describe("faltaParaComecar", () => {
  it("cliente novo vazio falta tudo do essencial", () => {
    const itens = faltaParaComecar(base()).map((f) => f.item);
    expect(itens).toEqual(
      expect.arrayContaining(["CPF ou CNPJ do cliente", "Endereço do cliente", "Data de início", "Valor mensal", "Aviso prévio", "Prazo mínimo"]),
    );
  });

  it("zero em aviso prévio e prazo mínimo conta como decidido", () => {
    const c = base({
      documento: "123",
      endereco: "Rua",
      email: "a@b.com",
      valorMensalCentavos: 100000,
      contrato: { inicio: "2026-11-10", fim: null, prazoMinimoMeses: 0, diaPagamento: 10, avisoPrevioDias: 0, limiteRodadas: null, prazoAprovacaoDias: null, prazoEntregaDias: null, inicioCobranca: "após 30 dias", observacoes: "" },
    });
    expect(faltaParaComecar(c)).toEqual([]);
  });

  it("projeto avulso não exige mensalidade, aviso nem prazo mínimo", () => {
    const itens = faltaParaComecar(
      base({ documento: "1", endereco: "r", email: "a@b.com", contrato: { inicio: "2026-11-10" } as ClienteBase["contrato"], projetoAvulso: { pacoteId: null, nome: "Logo", itens: [], valorCentavos: 1, prazoDiasUteis: 15, sinalPct: 50, fechadoEm: "2026-10-28" } }),
    );
    expect(itens).toEqual([]);
  });

  it("a própria Aden nunca é barrada", () => {
    expect(faltaParaComecar(base({ interno: true }))).toEqual([]);
  });

  it("só barra quem nasceu do fechamento de lead", () => {
    expect(barraProducao(base())).toBe(false);
    expect(barraProducao(base({ fechamentoIniciadoEm: "2026-10-28T10:00:00Z" }))).toBe(true);
  });
});

describe("faltaParaFechar", () => {
  it("lead vazio não fecha", () => {
    const l = novoLead("l1", "Loja");
    expect(faltaParaFechar(l, { avulso: false })).toEqual(["pessoa de contato", "WhatsApp ou e-mail", "valor mensal combinado"]);
  });
  it("lead completo fecha", () => {
    const l = { ...novoLead("l1", "Loja"), contato: "Ana", telefone: "8199", valorEstimadoCentavos: 150000 };
    expect(faltaParaFechar(l, { avulso: false })).toEqual([]);
  });
  it("projeto avulso não pede mensalidade", () => {
    const l = { ...novoLead("l1", "Loja"), contato: "Ana", email: "a@b.com" };
    expect(faltaParaFechar(l, { avulso: true })).toEqual([]);
  });
});
