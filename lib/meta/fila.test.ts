import { describe, expect, it, vi } from "vitest";
import { ehImagemDaPeca, enderecoParaMeta, planoDaPeca, processarFila, type ItemFila } from "./fila";

const SB = "https://abc.supabase.co";
const peca = (n: string) => `${SB}/storage/v1/object/public/pecas/org/t1/${n}`;
const BASE = "https://aden.exemplo.app";
const item = (arquivos: ItemFila["arquivos"], extra: Partial<ItemFila> = {}): ItemFila => ({
  tarefaId: "t1", clienteId: "c1", titulo: "Post", legenda: "Oi", arquivos, publicarEm: "2026-11-20T15:00:00Z", instagramId: "1", instagramUsuario: "olinda", ...extra,
});

describe("fila do Instagram", () => {
  it("só converte imagem guardada pela Aden", () => {
    expect(ehImagemDaPeca(peca("a.png"), SB)).toBe(true);
    expect(ehImagemDaPeca("https://outro.com/storage/v1/object/public/pecas/a.png", SB)).toBe(false);
    expect(ehImagemDaPeca(`${SB}/storage/v1/object/public/avatares/a.png`, SB)).toBe(false);
    expect(ehImagemDaPeca(`http://abc.supabase.co/storage/v1/object/public/pecas/a.png`, SB)).toBe(false);
    expect(ehImagemDaPeca(peca("a.png"), null)).toBe(false);
  });

  it("jpg segue direto; png vai pela conversão", () => {
    expect(enderecoParaMeta(peca("a.jpg"), BASE)).toBe(peca("a.jpg"));
    const c = enderecoParaMeta(peca("a.png"), BASE);
    expect(c.startsWith(`${BASE}/api/meta/jpg/imagem.jpg?u=`)).toBe(true);
    expect(decodeURIComponent(c.split("?u=")[1])).toBe(peca("a.png"));
  });

  it("mantém a ordem das artes no carrossel", () => {
    const r = planoDaPeca(item([{ url: peca("1.jpg"), tipo: "image/jpeg" }, { url: peca("2.png"), tipo: "image/png" }, { url: peca("3.jpg"), tipo: "image/jpeg" }]), BASE, SB);
    if ("erro" in r) throw new Error(r.erro);
    expect(r.plano.tipo).toBe("carrossel");
    expect(r.plano.imagens[0]).toBe(peca("1.jpg"));
    expect(r.plano.imagens[1]).toContain("/api/meta/jpg/");
    expect(r.plano.imagens[2]).toBe(peca("3.jpg"));
  });

  it("recusa vídeo, peça sem imagem e imagem de fora", () => {
    expect("erro" in planoDaPeca(item([]), BASE, SB)).toBe(true);
    expect("erro" in planoDaPeca(item([{ url: peca("a.mp4"), tipo: "video/mp4" }]), BASE, SB)).toBe(true);
    expect("erro" in planoDaPeca(item([{ url: "https://x.com/a.png", tipo: "image/png" }]), BASE, SB)).toBe(true);
  });

  it("um erro não derruba os outros e plano ruim é definitivo", async () => {
    const resultados: unknown[] = [];
    const publicar = vi.fn(async (i: ItemFila) => {
      if (i.tarefaId === "ruim") throw new Error("A Meta recusou.");
      return { postId: "p1", link: "https://instagram.com/p/x" };
    });
    const r = await processarFila({
      itens: [item([{ url: peca("a.jpg"), tipo: "image/jpeg" }], { tarefaId: "ruim" }), item([{ url: peca("b.mp4"), tipo: "video/mp4" }], { tarefaId: "video" }), item([{ url: peca("c.jpg"), tipo: "image/jpeg" }], { tarefaId: "boa" })],
      base: BASE,
      supabaseUrl: SB,
      publicar,
      resultado: async (x) => void resultados.push(x),
    });
    expect(r).toEqual({ publicadas: 1, falhas: 2 });
    expect(publicar).toHaveBeenCalledTimes(2);
    expect(resultados).toContainEqual(expect.objectContaining({ tarefaId: "video", ok: false, definitivo: true }));
    expect(resultados).toContainEqual(expect.objectContaining({ tarefaId: "ruim", ok: false }));
    expect(resultados).toContainEqual(expect.objectContaining({ tarefaId: "boa", ok: true, postId: "p1" }));
  });
});
