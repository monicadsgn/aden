import { describe, expect, it } from "vitest";
import { novoLead } from "./crm";
import { linkWhatsApp, mensagensDoLead } from "./mensagensLead";

const lead = (extra = {}) => novoLead("1", "Ana Souza", { telefone: "(81) 99786-9274", ...extra });

describe("mensagensDoLead", () => {
  it("lead do quiz qualificado: primeiro contato, follow-up e retomada, com o primeiro nome e a empresa", () => {
    const m = mensagensDoLead(lead({ qualificacao: "qualificado", empresa: "Loja X" }));
    expect(m.map((x) => x.id)).toEqual(["primeiro_contato", "follow_up", "retomada"]);
    expect(m[0].texto).toContain("Oi, Ana!");
    expect(m[0].texto).toContain("para a empresa Loja X");
  });

  it("com ressalva usa as mesmas mensagens e não revela a ressalva", () => {
    const m = mensagensDoLead(lead({ qualificacao: "com_ressalva", qualificacaoMotivos: "Margem baixa" }));
    expect(m).toHaveLength(3);
    expect(m.every((x) => !/ressalva|margem/i.test(x.texto))).toBe(true);
  });

  it("quem quer só social media recebe a mensagem de social media", () => {
    expect(mensagensDoLead(lead({ qualificacao: "social_media" }))[0].id).toBe("social_media");
  });

  it("desqualificado não tem mensagem para empurrar", () => {
    expect(mensagensDoLead(lead({ qualificacao: "desqualificado" }))).toEqual([]);
  });

  it("lead criado à mão (sem quiz) também tem as mensagens, sem empresa no texto", () => {
    const m = mensagensDoLead(lead());
    expect(m).toHaveLength(3);
    expect(m[0].texto).not.toContain("undefined");
  });

  it("nenhuma mensagem pede formulário nem fala de dinheiro apertado", () => {
    const todas = mensagensDoLead(lead({ qualificacao: "qualificado" })).concat(mensagensDoLead(lead({ qualificacao: "social_media" })));
    for (const x of todas) expect(x.texto).not.toMatch(/formul[aá]rio|caro|sem dinheiro|investimento pesou/i);
  });
});

describe("linkWhatsApp", () => {
  it("monta o link com DDI 55 e a mensagem codificada", () => {
    expect(linkWhatsApp("(81) 99786-9274", "Oi, Ana!")).toBe("https://wa.me/5581997869274?text=Oi%2C%20Ana!");
  });
  it("não duplica o 55 e recusa telefone inválido", () => {
    expect(linkWhatsApp("+55 81 99786-9274", "x")).toContain("wa.me/5581997869274");
    expect(linkWhatsApp("123", "x")).toBeNull();
    expect(linkWhatsApp("", "x")).toBeNull();
  });
});
