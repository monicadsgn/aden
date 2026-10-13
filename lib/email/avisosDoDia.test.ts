import { describe, expect, it, vi } from "vitest";
import { enderecosDe, enviarAvisosDoDia, type PendenteDoBanco } from "./avisosDoDia";

const base: PendenteDoBanco = {
  clienteId: "c1", cliente: "Cliente A", contato: "Ana", email: "ana@x.com; bia@x.com", token: "t".repeat(32), ate: "2026-10-12T11:00:00Z",
  prazoAprovacaoDias: 2,
  pecas: [
    { titulo: "[CLIENTE A] - Marca um amigo (Marca um amigo)", formato: "Estático", dia: "2026-10-22", ajuste: false, pedido: null },
    { titulo: "Reel de jogo", formato: "Reel", dia: null, ajuste: true, pedido: "trocar a música" },
  ],
};

describe("aviso diário", () => {
  it("separa endereços e ignora o que não é e-mail", () => {
    expect(enderecosDe("a@x.com, b@y.com; lixo")).toEqual(["a@x.com", "b@y.com"]);
    expect(enderecosDe(null)).toEqual([]);
  });

  it("manda um e-mail por cliente e só carimba depois de enviar", async () => {
    const enviar = vi.fn().mockResolvedValue(undefined);
    const marcar = vi.fn().mockResolvedValue(undefined);
    const r = await enviarAvisosDoDia({ buscar: async () => [base], marcar, enviar, urlBase: "https://aden.test", hoje: "2026-10-12" });
    expect(r.enviados).toEqual(["Cliente A"]);
    expect(enviar).toHaveBeenCalledTimes(1);
    const [para, email] = enviar.mock.calls[0];
    expect(para).toEqual(["ana@x.com", "bia@x.com"]);
    expect(email.assunto).toBe("Tem peças novas e ajustes prontos pra você");
    expect(email.texto).toContain("https://aden.test/c/" + "t".repeat(32));
    expect(email.texto).toContain("responda até 14/10");
    expect(marcar).toHaveBeenCalledWith("c1", base.ate);
  });

  it("se o envio falha, não carimba (amanhã tenta de novo)", async () => {
    const marcar = vi.fn();
    const r = await enviarAvisosDoDia({
      buscar: async () => [base], marcar, enviar: async () => { throw new Error("gmail fora"); }, urlBase: "https://aden.test", hoje: "2026-10-12",
    });
    expect(r.falhas[0].motivo).toBe("gmail fora");
    expect(marcar).not.toHaveBeenCalled();
  });

  it("e-mail inválido na ficha vira falha clara, sem enviar", async () => {
    const enviar = vi.fn();
    const r = await enviarAvisosDoDia({ buscar: async () => [{ ...base, email: "sem arroba" }], marcar: vi.fn(), enviar, urlBase: "https://aden.test", hoje: "2026-10-12" });
    expect(enviar).not.toHaveBeenCalled();
    expect(r.falhas).toHaveLength(1);
  });
});
