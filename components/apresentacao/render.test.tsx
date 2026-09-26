// O que o cliente vê (tela de apresentação e PDF da proposta) não pode ter nada interno.
// Números aqui são só fixtures de teste.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { vistaApresentacao } from "@/lib/calculo/apresentacao";
import { documentoProposta } from "@/lib/calculo/documentos";
import { calcularCenario } from "@/lib/calculo/motor";
import { configVazia, novoCenario } from "@/lib/calculo/novo";
import type { Configuracao } from "@/lib/calculo/tipos";
import { PropostaDoc } from "../impressao/Proposta";
import { VistaCliente } from "./VistaCliente";
import { VistaPacoteCliente } from "./VistaPacote";
import { vistaPacote } from "@/lib/calculo/apresentacao";
import { pacoteParaCenario } from "@/lib/calculo/pacotes";

function config(): Configuracao {
  const c = configVazia();
  c.empresa = { reinvestimentoPct: 10, impostoPct: 0, taxaRecebimentoPct: 0, regraRateio: "igual" };
  c.pessoas = [
    { id: "m", nome: "Mônica", socio: true, percentualPadrao: 50, pisoHoraCentavos: 4500, capacidadeHorasMes: 44, ativo: true },
    { id: "a", nome: "Áleff", socio: true, percentualPadrao: 50, pisoHoraCentavos: null, capacidadeHorasMes: null, ativo: true },
  ];
  c.servicos = [{ id: "sm", nome: "Social media", divisaoPadrao: { m: 100 }, ativo: true }];
  c.tiposEntrega = [{ id: "post", nome: "Post simples", servicoId: "sm", horasPorUnidade: 20 / 60, ativo: true }];
  c.custosFixos = [{ id: "f", nome: "Canva", valorMensalCentavos: 3500, ativo: true }];
  return c;
}

const PROIBIDO = /piso|preju[ií]zo|hora|\bh\b|mônica|áleff|reinvest|rateio|custo fixo|divis[ãa]o|percentual|%/i;

describe("tela do cliente e PDF", () => {
  it("pacote fechado: só nome, frases e valor; nunca o valor do terceiro, horas ou quantidades", () => {
    const c = config();
    c.terceiros = [{ id: "av", nome: "Audiovisual", inclui: "", fraseCliente: "gravação e edição mensal inclusa", valorPorSaidaCentavos: 31700, deslocamentoMedioCentavos: 4300, ativo: true }];
    c.tiposEntrega.push({ id: "grav", nome: "Gravação", servicoId: null, horasPorUnidade: null, audiovisual: true, terceiroId: "av", ativo: true });
    const pk = { id: "p", nome: "Social media padrão", descricao: "", itensCliente: ["posts em dias alternados"], rotina: [{ tipoEntregaId: "post", quantidade: 8 }, { tipoEntregaId: "grav", quantidade: 1 }], entrada: [], padrao: true, ativo: true };
    const html = renderToStaticMarkup(<VistaPacoteCliente vista={vistaPacote(c, pk, { cenario: pacoteParaCenario(pk), desligados: {} })} aoPersonalizar={() => {}} />);
    const texto = html.replace(/<[^>]+>/g, " ");
    expect(texto).not.toMatch(PROIBIDO);
    expect(texto).not.toMatch(/317|360,00|43,00|Post simples|\b8\b/);
    expect(texto).toContain("gravação e edição mensal inclusa");
    expect(texto).toContain("Social media padrão");
  });

  it("modo apresentação: nenhum dado interno nem palavra como piso ou prejuízo", () => {
    const c = config();
    const cen = novoCenario("x");
    cen.entregas = [{ id: "1", tipoEntregaId: "post", quantidade: 8, horasPorUnidade: null }];
    for (const mensalidade of [null, 1000]) {
      const e = { cenario: mensalidade == null ? cen : { ...cen, modo: "valor" as const, mensalidadeCentavos: mensalidade }, desligados: {} };
      const html = renderToStaticMarkup(<VistaCliente vista={vistaApresentacao(c, e)} aoMudarQuantidade={() => {}} aoAlternarServico={() => {}} />);
      const texto = html.replace(/<[^>]+>/g, " ");
      expect(texto).not.toMatch(PROIBIDO);
      expect(texto).toContain("Post simples");
      expect(texto).toContain("Investimento mensal");
    }
  });

  it("o sinal discreto muda de cor sem texto", () => {
    const c = config();
    const cen = { ...novoCenario("x"), modo: "valor" as const, entregas: [{ id: "1", tipoEntregaId: "post", quantidade: 8, horasPorUnidade: null }] };
    const ok = renderToStaticMarkup(<VistaCliente vista={vistaApresentacao(c, { cenario: { ...cen, mensalidadeCentavos: 200000 }, desligados: {} })} />);
    const baixo = renderToStaticMarkup(<VistaCliente vista={vistaApresentacao(c, { cenario: { ...cen, mensalidadeCentavos: 5000 }, desligados: {} })} />);
    expect(ok).toContain('data-sinal="ok"');
    expect(baixo).toContain('data-sinal="atencao"');
  });

  it("PDF da proposta não contém piso, horas nem divisão entre sócios", () => {
    const c = config();
    const cen = novoCenario("x");
    cen.entregas = [{ id: "1", tipoEntregaId: "post", quantidade: 8, horasPorUnidade: null }];
    const r = calcularCenario(c, cen);
    const doc = documentoProposta(c, cen, r.proposta!.valorCentavos, { cliente: "Cliente", competencia: "2026-09", incluiTrafego: false, verbaMidiaCentavos: null });
    const texto = renderToStaticMarkup(<PropostaDoc doc={doc} />).replace(/<[^>]+>/g, " ");
    expect(texto).not.toMatch(PROIBIDO);
    expect(texto).toContain("8 por mês");
  });
});
