import { describe, expect, it } from "vitest";
import { aplicarResposta, aprovarAte, montarPainel } from "./painel";
import { novaTarefa, situacaoPeca } from "./tarefas";
import type { ClienteBase } from "./tipos";

const cli: ClienteBase = { id: "c", nome: "Loja", interno: false, participaRateio: true, valorMensalCentavos: 150000, ativo: true };
const agora = new Date("2026-09-26T12:00:00Z");

describe("painel do cliente", () => {
  it("mostra só as peças do cliente marcadas para ele, sem nada interno", () => {
    const ts = [
      novaTarefa("1", "Post", { clienteId: "c", visivelCliente: true, status: "revisao", legenda: "oi" }),
      novaTarefa("2", "Interna", { clienteId: "c", visivelCliente: false }),
      novaTarefa("3", "De outro", { clienteId: "x", visivelCliente: true }),
      novaTarefa("4", "Antiga", { clienteId: "c", visivelCliente: true, status: "concluida", concluidaEm: "2026-01-01T00:00:00Z" }),
    ];
    const p = montarPainel({ ...cli, contrato: { limiteRodadas: 2, prazoAprovacaoDias: 3 } as ClienteBase["contrato"] }, ts, agora);
    expect(p.pecas.map((x) => x.id)).toEqual(["1"]);
    expect(p.limiteRodadas).toBe(2);
    const texto = JSON.stringify(p);
    expect(texto).not.toMatch(/150000|horas|responsavel|valor/i);
  });

  it("aprovar e pedir ajuste", () => {
    const t = novaTarefa("1", "Post", { clienteId: "c", visivelCliente: true, status: "revisao", enviadaClienteEm: "2026-09-25T12:00:00Z" });
    expect(situacaoPeca(t)).toBe("aguardando");
    expect(() => aplicarResposta(t, "ajustar", "  ", agora)).toThrow(/Conte o que/);
    const aj = aplicarResposta(t, "ajustar", "trocar a foto", agora);
    expect(aj).toMatchObject({ status: "em_producao", rodadas: 1, feedbackCliente: "trocar a foto" });
    expect(situacaoPeca(aj)).toBe("ajuste");
    expect(() => aplicarResposta(aj, "aprovar", "", agora)).toThrow(/não está esperando/);
    const ok = aplicarResposta(t, "aprovar", "", agora);
    expect(situacaoPeca(ok)).toBe("aprovada");
    expect(() => aplicarResposta(ok, "aprovar", "", agora)).toThrow(/já foi aprovada/);
    expect(ok.respostasCliente).toHaveLength(1);
  });

  it("prazo para aprovar sai do contrato", () => {
    expect(aprovarAte("2026-09-25T12:00:00Z", 3)).toBe("2026-09-28");
    expect(aprovarAte("2026-09-25T12:00:00Z", null)).toBeNull();
  });
});
