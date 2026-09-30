// Fase 3, passo 1: etapas de publicação das peças (planejado, agendada, publicada) e os avisos.
import { describe, expect, it } from "vitest";
import { dataHoraBrasilia } from "../mcp/servidor";
import type { Medicao } from "./calibragem";
import { avisosDePublicacao } from "./dia";
import { aplicarResposta, montarPainel, montarQuadro, resumoDoMes } from "./painel";
import { novaTarefa, publicar, situacaoPeca } from "./tarefas";
import type { ClienteBase } from "./tipos";

const agora = new Date("2026-10-02T12:00:00Z");
const cli: ClienteBase = { id: "c", nome: "Loja", interno: false, participaRateio: true, valorMensalCentavos: null, ativo: true };

describe("etapas da peça", () => {
  it("planejado → produção → esperando → agendada → publicada, sem mudar o status da tarefa", () => {
    const dia = "2026-10-04T15:00:00.000Z";
    const plan = novaTarefa("1", "Post", { clienteId: "c", visivelCliente: true, publicarEm: dia });
    expect(situacaoPeca(plan)).toBe("planejado");
    expect(situacaoPeca({ ...plan, status: "em_producao" })).toBe("producao");
    const enviada = { ...plan, status: "revisao" as const, enviadaClienteEm: "2026-10-01T12:00:00Z" };
    expect(situacaoPeca(enviada)).toBe("aguardando");
    const aprovada = aplicarResposta(enviada, "aprovar", "", agora);
    // aprovada com data continua "aprovada" até a equipe programar o post
    expect(situacaoPeca(aprovada)).toBe("aprovada");
    const agendada = { ...aprovada, agendadaEm: agora.toISOString() };
    expect(situacaoPeca(agendada)).toBe("agendada");
    const pub = publicar(agendada, null, agora).tarefa;
    expect(pub).toMatchObject({ status: "concluida", publicadaEm: agora.toISOString() });
    expect(situacaoPeca(pub)).toBe("publicada");
  });

  it("sem data de publicação continua como antes (a fazer = em produção; concluída = entregue)", () => {
    const t = novaTarefa("1", "PDF", {});
    expect(situacaoPeca(t)).toBe("producao");
    expect(situacaoPeca({ ...t, status: "concluida" })).toBe("entregue");
  });

  it("publicar para o relógio; desfazer volta para produção", () => {
    const m: Medicao = { id: "m", clienteId: "c", tipoEntregaId: "t", pessoaId: "p", estado: "rodando", acumuladoSegundos: 0, retomadoEm: "2026-10-02T11:00:00Z", fim: null, criadoEm: "2026-10-02T11:00:00Z" };
    const t = novaTarefa("1", "Post", { tipoEntregaId: "t", status: "em_producao" });
    const r = publicar(t, m, agora);
    expect(r.medicao?.estado).toBe("concluido");
    const volta = publicar(r.tarefa, r.medicao, agora, false).tarefa;
    expect(volta).toMatchObject({ status: "em_producao", publicadaEm: null, concluidaEm: null });
  });

  it("o painel do cliente mostra quando vai ao ar e quando foi", () => {
    const t = novaTarefa("1", "Post", { clienteId: "c", visivelCliente: true, publicarEm: "2026-10-04T15:00:00.000Z" });
    const p = montarPainel(cli, [t], agora);
    expect(p.pecas[0]).toMatchObject({ publicarEm: "2026-10-04T15:00:00.000Z", publicadaEm: null });
  });
});

describe("avisos de publicação na Visão do dia", () => {
  const prazo = (id: string | null) => (id === "c" ? 2 : null);
  it("vai ao ar hoje, passou do dia sem publicar e aprovação fora do prazo do contrato", () => {
    const hoje = "2026-10-02";
    const ts = [
      novaTarefa("hoje", "Hoje", { clienteId: "c", publicarEm: "2026-10-02T18:00:00Z" }),
      novaTarefa("ontem", "Ontem", { clienteId: "c", publicarEm: "2026-10-01T15:00:00Z" }),
      novaTarefa("amanha", "Amanhã", { clienteId: "c", publicarEm: "2026-10-03T15:00:00Z" }),
      novaTarefa("feita", "Feita", { clienteId: "c", publicarEm: "2026-10-01T15:00:00Z", publicadaEm: "2026-10-01T15:00:00Z", status: "concluida" }),
      novaTarefa("atrasada", "Esperando", { clienteId: "c", status: "revisao", enviadaClienteEm: "2026-09-28T12:00:00Z" }),
      novaTarefa("noprazo", "No prazo", { clienteId: "c", status: "revisao", enviadaClienteEm: "2026-10-01T12:00:00Z" }),
      novaTarefa("semprazo", "Sem prazo", { clienteId: "x", status: "revisao", enviadaClienteEm: "2026-09-01T12:00:00Z" }),
    ];
    const a = avisosDePublicacao(ts, prazo, null, hoje);
    expect(a.irAoAr.map((x) => [x.t.id, x.atrasada])).toEqual([
      ["ontem", true],
      ["hoje", false],
    ]);
    expect(a.aprovacaoVencida.map((x) => x.t.id)).toEqual(["atrasada"]);
  });
});

describe("conector: data e hora de Brasília", () => {
  it("converte AAAA-MM-DD HH:MM para ISO e recusa formato errado", () => {
    expect(dataHoraBrasilia("2026-10-04 12:00")).toBe("2026-10-04T15:00:00.000Z");
    expect(dataHoraBrasilia(null)).toBeNull();
    expect(() => dataHoraBrasilia("04/10/2026")).toThrow(/AAAA-MM-DD HH:MM/);
  });
});

describe("quadro do painel do cliente", () => {
  const base = { arquivos: [], legenda: null, vencimento: null, rodadas: 0, feedback: null, feedbackEm: null, aprovadaEm: null, enviadaEm: null, respostas: [], publicarEm: null, publicadaEm: null, agendadaEm: null as string | null, tipo: null as string | null, titulo: "x" };
  const pecas = [
    { ...base, id: "plan", status: "a_fazer" as const, publicarEm: "2026-10-08T15:00:00Z" },
    { ...base, id: "prod", status: "em_producao" as const },
    { ...base, id: "aj", status: "em_producao" as const, feedbackEm: "2026-10-01T12:00:00Z", respostas: [{ decisao: "ajustar" as const, texto: "Arte: trocar", em: "2026-10-01T12:00:00Z" }] },
    { ...base, id: "esp", status: "revisao" as const, enviadaEm: "2026-10-01T12:00:00Z" },
    { ...base, id: "apr", status: "em_producao" as const, aprovadaEm: "2026-10-01T12:00:00Z", publicarEm: "2026-10-05T15:00:00Z" },
    { ...base, id: "ag2", status: "em_producao" as const, aprovadaEm: "2026-10-01T12:00:00Z", agendadaEm: "2026-10-01T13:00:00Z", publicarEm: "2026-10-06T15:00:00Z", tipo: "Reels" },
    { ...base, id: "ag1", status: "em_producao" as const, aprovadaEm: "2026-10-01T12:00:00Z", agendadaEm: "2026-10-01T13:00:00Z", publicarEm: "2026-10-04T15:00:00Z", tipo: "Reels" },
    { ...base, id: "pub", status: "concluida" as const, aprovadaEm: "2026-10-01T12:00:00Z", publicarEm: "2026-10-02T15:00:00Z", publicadaEm: "2026-10-02T15:00:00Z", tipo: "Post simples" },
  ];

  it("colunas na ordem do caminho do post; aprovação e publicados sempre aparecem", () => {
    const q = montarQuadro(pecas);
    expect(q.map((c) => [c.id, c.pecas.map((p) => p.id)])).toEqual([
      ["planejado", ["plan"]],
      ["producao", ["prod", "aj"]],
      ["aguardando", ["esp"]],
      ["aprovada", ["apr"]],
      ["agendada", ["ag1", "ag2"]],
      ["publicada", ["pub"]],
    ]);
    expect(montarQuadro([]).map((c) => c.id)).toEqual(["aguardando", "publicada"]);
  });

  it("resumo do mês: publicados, agendados, em andamento, ajustes e formatos", () => {
    expect(resumoDoMes(pecas, "2026-10")).toEqual({
      publicados: 1,
      agendados: 2,
      emAndamento: 3,
      ajustesPedidos: 1,
      porTipo: [
        { tipo: "Reels", quantidade: 2 },
        { tipo: "Post simples", quantidade: 1 },
      ],
    });
  });
});
