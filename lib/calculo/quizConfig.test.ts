import { describe, expect, it } from "vitest";
import { configQuizVazia, limparUtm, linkDoQuiz, normalizarConfigQuiz } from "./quizConfig";

describe("normalizarConfigQuiz", () => {
  it("vazio é válido: o quiz usa os valores de reserva da página", () => {
    expect(normalizarConfigQuiz(configQuizVazia())).toEqual({ config: configQuizVazia(), erros: {} });
  });

  it("WhatsApp: tira a máscara e põe o código do Brasil", () => {
    expect(normalizarConfigQuiz({ whatsapp: "(81) 99955-7470" }).config.whatsapp).toBe("5581999557470");
    expect(normalizarConfigQuiz({ whatsapp: "+55 81 99955-7470" }).config.whatsapp).toBe("5581999557470");
    expect(normalizarConfigQuiz({ whatsapp: "81 3333-4444" }).config.whatsapp).toBe("558133334444");
  });

  it("WhatsApp curto ou comprido demais dá erro em frase simples", () => {
    expect(normalizarConfigQuiz({ whatsapp: "9955-7470" }).erros.whatsapp).toMatch(/DDD/);
    expect(normalizarConfigQuiz({ whatsapp: "55819995574709999" }).erros.whatsapp).toMatch(/DDD/);
  });

  it("Instagram: aceita @, endereço curto ou completo e guarda o endereço completo", () => {
    for (const t of ["@grupoaden", "grupoaden", "instagram.com/grupoaden", "https://www.instagram.com/grupoaden/", "https://instagram.com/grupoaden?igsh=1"]) {
      expect(normalizarConfigQuiz({ instagramUrl: t }).config.instagramUrl).toBe("https://www.instagram.com/grupoaden/");
    }
    expect(normalizarConfigQuiz({ instagramUrl: "https://outro-site.com/grupoaden" }).erros.instagramUrl).toMatch(/Instagram/);
    expect(normalizarConfigQuiz({ instagramUrl: "nome com espaço" }).erros.instagramUrl).toBeDefined();
  });

  it("pixel da Meta: só números, ou tira o número de dentro do código colado", () => {
    expect(normalizarConfigQuiz({ metaPixel: " 1234567890123456 " }).config.metaPixel).toBe("1234567890123456");
    expect(normalizarConfigQuiz({ metaPixel: "fbq('init', '1234567890123456');" }).config.metaPixel).toBe("1234567890123456");
    expect(normalizarConfigQuiz({ metaPixel: "abc" }).erros.metaPixel).toMatch(/só números/);
    expect(normalizarConfigQuiz({ metaPixel: "123" }).erros.metaPixel).toBeDefined();
  });

  it("tag do Google: G-, AW- ou GTM-, em maiúsculas, mesmo colada no meio de um código", () => {
    expect(normalizarConfigQuiz({ googleTag: "g-abc123xyz9" }).config.googleTag).toBe("G-ABC123XYZ9");
    expect(normalizarConfigQuiz({ googleTag: "gtag('config', 'AW-1234567890');" }).config.googleTag).toBe("AW-1234567890");
    expect(normalizarConfigQuiz({ googleTag: "GTM-ABCD123" }).config.googleTag).toBe("GTM-ABCD123");
    expect(normalizarConfigQuiz({ googleTag: "UA-123456-1" }).erros.googleTag).toMatch(/G-, AW- ou GTM-/);
  });

  it("um erro não apaga o resto: cada campo é conferido sozinho", () => {
    const r = normalizarConfigQuiz({ whatsapp: "123", metaPixel: "1234567890" });
    expect(Object.keys(r.erros)).toEqual(["whatsapp"]);
    expect(r.config.metaPixel).toBe("1234567890");
  });
});

describe("link do quiz com campanha", () => {
  it("limpa o texto: minúsculas, sem acento, hífen no lugar de espaço", () => {
    expect(limparUtm("Black Friday 2026!")).toBe("black-friday-2026");
    expect(limparUtm("  Anúncio Vídeo 01 ")).toBe("anuncio-video-01");
    expect(limparUtm("???")).toBe("");
  });

  it("monta o endereço com fonte e campanha, e só põe o que foi preenchido", () => {
    const base = "https://aden-sable.vercel.app/quiz";
    expect(linkDoQuiz(base, { fonte: "Meta", campanha: "Captação Outubro" })).toBe("https://aden-sable.vercel.app/quiz?utm_source=meta&utm_campaign=captacao-outubro");
    expect(linkDoQuiz(`${base}/?x=1`, { fonte: "meta", midia: "pago", campanha: "c1", conteudo: "Vídeo 2", termo: "marketing local" })).toBe(
      "https://aden-sable.vercel.app/quiz?utm_source=meta&utm_campaign=c1&utm_medium=pago&utm_content=video-2&utm_term=marketing-local",
    );
  });

  it("sem fonte ou sem nome de campanha não gera link", () => {
    expect(linkDoQuiz("https://x.com/quiz", { fonte: "", campanha: "c" })).toBeNull();
    expect(linkDoQuiz("https://x.com/quiz", { fonte: "meta", campanha: "  " })).toBeNull();
  });
});
