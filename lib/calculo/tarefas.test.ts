import { describe, expect, it } from "vitest";
import { calcularCalibragem, segundosDaMedicao, type Medicao } from "./calibragem";
import { configVazia } from "./novo";
import { agruparPorPrazo, darStart, erroAgendarSemAprovacao, estimativaHoras, motivoSemAprovacaoFora, mudarStatus, novaTarefa, relogio, situacaoPeca } from "./tarefas";
import type { Configuracao } from "./tipos";

const cfg = (): Configuracao => {
  const c = configVazia();
  c.empresa.medicoesCalibragem = 5;
  c.tiposEntrega = [
    { id: "post", servicoId: null, nome: "Post", horasPorUnidade: 20 / 60, ativo: true, audiovisual: false },
    { id: "video", servicoId: null, nome: "Vídeo", horasPorUnidade: null, ativo: true, audiovisual: true },
  ] as Configuracao["tiposEntrega"];
  return c;
};
const t0 = new Date("2026-09-26T10:00:00Z");
const mais = (min: number) => new Date(t0.getTime() + min * 60000);

describe("tarefas com cronômetro", () => {
  it("estimativa = tempo por entrega × quantidade; vídeo de terceiro não tem horas", () => {
    expect(estimativaHoras(novaTarefa("a", "x", { tipoEntregaId: "post", quantidade: 3 }), cfg())).toBeCloseTo(1);
    expect(estimativaHoras(novaTarefa("a", "x", { tipoEntregaId: "video" }), cfg())).toBeNull();
  });

  it("Start liga, pausa não conta, concluir encerra e divide pela quantidade na calibragem", () => {
    const t = novaTarefa("a", "Posts", { tipoEntregaId: "post", quantidade: 2 });
    expect(darStart(novaTarefa("b", "sem tipo"), null, null, "m", t0)).toBeNull();
    const r1 = darStart(t, null, "moni", "m1", t0)!;
    expect(r1.tarefa.status).toBe("em_producao");
    const pausada: Medicao = { ...r1.medicao, estado: "pausado", acumuladoSegundos: segundosDaMedicao(r1.medicao, mais(30)), retomadoEm: null };
    const r2 = darStart(r1.tarefa, pausada, "moni", "x", mais(90))!; // 1 h parada não conta
    expect(r2.medicao.id).toBe("m1");
    const fim = mudarStatus(r2.tarefa, "concluida", r2.medicao, mais(100));
    expect(fim.tarefa.concluidaEm).not.toBeNull();
    expect(fim.medicao!.estado).toBe("concluido");
    expect(fim.medicao!.acumuladoSegundos).toBe(40 * 60);
    const cal = calcularCalibragem(cfg(), [fim.medicao!]).find((c) => c.tipoEntregaId === "post")!;
    expect(cal.medicoes).toBe(2); // 2 posts medidos
    expect(cal.mediaMinutos).toBeCloseTo(20);
    // reabrir: medição volta a pausada e continua de onde parou
    const re = mudarStatus(fim.tarefa, "em_producao", fim.medicao, mais(200));
    expect(re.medicao!.estado).toBe("pausado");
    expect(re.tarefa.concluidaEm).toBeNull();
  });

  it("agrupa por prazo, com atrasadas primeiro", () => {
    const hoje = new Date(2026, 8, 26);
    const g = agruparPorPrazo(
      [
        novaTarefa("1", "sem prazo"),
        novaTarefa("2", "atrasada", { vencimento: "2026-09-20" }),
        novaTarefa("3", "hoje", { vencimento: "2026-09-26" }),
        novaTarefa("4", "semana", { vencimento: "2026-10-01" }),
        novaTarefa("5", "feita", { vencimento: "2026-09-20", status: "concluida" }),
      ],
      hoje,
    );
    expect(g.map((x) => x.grupo)).toEqual(["atrasadas", "hoje", "semana", "sem_prazo", "concluidas"]);
  });

  it("relógio", () => {
    expect(relogio(65)).toBe("1:05");
    expect(relogio(3725)).toBe("1:02:05");
  });
});

describe("aprovação fora do painel", () => {
  const base = { status: "em_producao" as const, clienteId: "c", clienteAprovouEm: null, publicarEm: "2026-10-06T20:30:00Z" };
  it("aprovada fora do painel com agendada = agendada, sem passar por esperando aprovação", () => {
    expect(situacaoPeca({ ...base, feedbackEm: null, enviadaClienteEm: null, clienteAprovouEm: "2026-10-02T22:00:00Z", agendadaEm: "2026-10-02T22:00:00Z" })).toBe("agendada");
  });
  it("diz por que não dá (espelho da 0040)", () => {
    expect(motivoSemAprovacaoFora(base)).toBeNull();
    expect(motivoSemAprovacaoFora({ ...base, publicarEm: null })).toMatch(/Sem data/);
    expect(motivoSemAprovacaoFora({ ...base, publicarEm: null }, false)).toBeNull();
    expect(motivoSemAprovacaoFora({ ...base, clienteAprovouEm: "x" })).toMatch(/pelo painel/);
    expect(motivoSemAprovacaoFora({ ...base, clienteAprovouEm: "x", aprovadaForaOnde: "grupo do WhatsApp" })).toMatch(/grupo do WhatsApp/);
    expect(motivoSemAprovacaoFora({ ...base, publicadaEm: "x" })).toMatch(/publicada/);
    expect(motivoSemAprovacaoFora({ ...base, status: "concluida" })).toMatch(/concluída/);
    expect(motivoSemAprovacaoFora({ ...base, clienteId: null })).toMatch(/cliente/);
  });
  it("agendada sem aprovação é erro, nunca 'salva' calado", () => {
    expect(erroAgendarSemAprovacao({ clienteAprovouEm: null }, true)).toMatch(/registrar_aprovacao_fora_do_painel/);
    expect(erroAgendarSemAprovacao({ clienteAprovouEm: "x" }, true)).toBeNull();
    expect(erroAgendarSemAprovacao({ clienteAprovouEm: null }, false)).toBeNull();
    expect(erroAgendarSemAprovacao({ clienteAprovouEm: null }, undefined)).toBeNull();
  });
});
