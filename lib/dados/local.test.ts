// Campo protegido não muda sem aprovação (modo demonstração, mesma regra do banco).
// Números aqui são só fixtures de teste.
import { beforeEach, describe, expect, it } from "vitest";
import { configVazia } from "../calculo/novo";
import { diferenca } from "./repositorio";
import { RepositorioLocal } from "./local";

beforeEach(() => {
  const mem = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
    clear: () => mem.clear(),
    key: () => null,
    length: 0,
  };
});

describe("repositório local: proteção dos sócios", () => {
  it("piso só muda depois que o sócio afetado aprova; histórico registra tudo", async () => {
    const repo = new RepositorioLocal();
    const base = configVazia();
    base.pessoas = [
      { id: "m", nome: "Mônica", socio: true, percentualPadrao: 50, pisoHoraCentavos: null, capacidadeHorasMes: 44, ativo: true },
      { id: "a", nome: "Áleff", socio: true, percentualPadrao: 50, pisoHoraCentavos: null, capacidadeHorasMes: null, ativo: true },
    ];
    const vazio = { salvar: [], remover: [] };
    await repo.salvarConfig({ pessoas: diferenca([], base.pessoas), servicos: vazio, tiposEntrega: vazio, custosFixos: vazio, clientes: vazio });

    // primeiro preenchimento: vale na hora
    let atual = await repo.carregarConfig();
    const comPiso = atual.pessoas.map((p) => (p.id === "m" ? { ...p, pisoHoraCentavos: 4500 } : p));
    let r = await repo.salvarConfig({ pessoas: diferenca(atual.pessoas, comPiso), servicos: vazio, tiposEntrega: vazio, custosFixos: vazio, clientes: vazio });
    expect(r.pedido).toBeNull();
    expect((await repo.carregarConfig()).pessoas[0].pisoHoraCentavos).toBe(4500);

    // mudança: fica pendente e vale o valor antigo
    atual = await repo.carregarConfig();
    const novo = atual.pessoas.map((p) => (p.id === "m" ? { ...p, pisoHoraCentavos: 3000 } : p));
    r = await repo.salvarConfig({ pessoas: diferenca(atual.pessoas, novo), servicos: vazio, tiposEntrega: vazio, custosFixos: vazio, clientes: vazio });
    expect(r.pedido?.status).toBe("pendente");
    expect(r.pedido?.aguardando).toEqual(["m"]);
    expect((await repo.carregarConfig()).pessoas[0].pisoHoraCentavos).toBe(4500);
    const avisos = await repo.listarAvisos();
    expect(avisos.some((a) => a.pessoaId === "m" && a.titulo.includes("aprovação"))).toBe(true);

    // outro sócio não pode aprovar
    await expect(repo.decidirPedido(r.pedido!.pedidoId, "aprovado", null, "a")).rejects.toThrow(/afetado/);
    // o afetado aprova: aí sim vale
    expect(await repo.decidirPedido(r.pedido!.pedidoId, "aprovado", null, "m")).toBe("aplicado");
    expect((await repo.carregarConfig()).pessoas[0].pisoHoraCentavos).toBe(3000);
    expect((await repo.listarAuditoria(50)).some((x) => x.tabela === "aprovacoes")).toBe(true);
  });
});
