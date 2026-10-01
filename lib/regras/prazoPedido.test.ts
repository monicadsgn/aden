import { describe, expect, it } from "vitest";
import { novaTarefa } from "../calculo/tarefas";
import { conferirPrazoDoPedido, somarDiasUteis } from "./prazoPedido";

const config = {
  pessoas: [
    { id: "moni", nome: "Mônica", socio: true },
    { id: "aleff", nome: "Áleff", socio: true },
    { id: "free", nome: "Freela", socio: false },
  ],
  empresa: { prazoMinimoPedidoDiasUteis: 2 },
} as never;

// 01/10/2026 é quinta-feira
const QUINTA = "2026-10-01";

describe("somarDiasUteis", () => {
  it("pula o fim de semana", () => {
    expect(somarDiasUteis("2026-09-28", 2)).toBe("2026-09-30"); // segunda → quarta
    expect(somarDiasUteis(QUINTA, 2)).toBe("2026-10-05"); // quinta → segunda
    expect(somarDiasUteis("2026-10-03", 2)).toBe("2026-10-06"); // sábado → terça
  });
});

describe("conferirPrazoDoPedido", () => {
  const pedido = (patch = {}) => ({ ...novaTarefa("t1", "Arte do post", { responsavelId: "aleff" }), ...patch });

  it("sem prazo, entra o mínimo de dias úteis a partir do pedido", () => {
    const r = conferirPrazoDoPedido({ config, antes: null, depois: pedido(), eu: "moni", hoje: QUINTA });
    expect(r.preencheu).toBe(true);
    expect(r.tarefa.vencimento).toBe("2026-10-05");
  });

  it("prazo menor que o mínimo pede confirmação de urgência", () => {
    const r = conferirPrazoDoPedido({ config, antes: null, depois: pedido({ vencimento: "2026-10-02" }), eu: "moni", hoje: QUINTA });
    expect(r.pedeUrgencia).toBe(true);
    const urgente = conferirPrazoDoPedido({ config, antes: null, depois: pedido({ vencimento: "2026-10-02", prioridade: "urgente" }), eu: "moni", hoje: QUINTA });
    expect(urgente.pedeUrgencia).toBe(false);
  });

  it("não vale para a própria tarefa, para quem não é sócio nem sem a regra configurada", () => {
    expect(conferirPrazoDoPedido({ config, antes: null, depois: pedido(), eu: "aleff", hoje: QUINTA }).minimo).toBeNull();
    expect(conferirPrazoDoPedido({ config, antes: null, depois: pedido({ responsavelId: "free" }), eu: "moni", hoje: QUINTA }).minimo).toBeNull();
    const semRegra = { ...(config as object), empresa: {} } as never;
    expect(conferirPrazoDoPedido({ config: semRegra, antes: null, depois: pedido(), eu: "moni", hoje: QUINTA }).preencheu).toBe(false);
  });

  it("editar outra coisa de um pedido antigo não confere o prazo de novo", () => {
    const antes = pedido({ vencimento: "2026-10-02" });
    const r = conferirPrazoDoPedido({ config, antes, depois: { ...antes, titulo: "Outro título" }, eu: "moni", hoje: QUINTA });
    expect(r.pedeUrgencia).toBe(false);
  });

  it("quem pediu encurtar o prazo depois também pede urgência", () => {
    const antes = pedido({ vencimento: "2026-10-09" });
    const r = conferirPrazoDoPedido({ config, antes, depois: { ...antes, vencimento: "2026-10-02" }, eu: "moni", hoje: QUINTA });
    expect(r.pedeUrgencia).toBe(true);
  });
});
