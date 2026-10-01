import { describe, expect, it } from "vitest";
import { coresDosClientes } from "./cores";

describe("cor por cliente", () => {
  it("clientes ativos não repetem cor (até 6) e a cor não depende do nome", () => {
    const cs = ["a1", "b2", "c3", "d4", "e5", "f6"].map((id) => ({ id, ativo: true }));
    const m = coresDosClientes(cs);
    expect(new Set(m.values()).size).toBe(6);
    expect(coresDosClientes([...cs].reverse()).get("c3")).toBe(m.get("c3"));
  });
});
