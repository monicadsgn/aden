// As skills da Aden só podem citar ferramentas que existem no conector e nunca outro sistema.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const pasta = path.resolve(__dirname);
const skills = readdirSync(pasta, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name.startsWith("aden-"));
const servidor = readFileSync(path.resolve(pasta, "../lib/mcp/servidor.ts"), "utf8");
const ferramentas = new Set([...servidor.matchAll(/registerTool\(\s*"([a-z_]+)"/g)].map((m) => m[1]));
// valores de parâmetro (passo do fechamento, etapa do lead) também aparecem entre crases
const valores = new Set(["pasta_drive", "proposta_enviada", "lead_recebido", "contato_feito"]);

describe("skills da Aden", () => {
  it("existem as quatro da Fase 6", () => {
    expect(skills.map((s) => s.name).sort()).toEqual(["aden-contrato", "aden-fechamento", "aden-onboarding", "aden-proposta"]);
  });

  for (const s of skills) {
    const texto = readFileSync(path.join(pasta, s.name, "SKILL.md"), "utf8");
    it(`${s.name}: cabeçalho com name e description`, () => {
      expect(texto).toMatch(new RegExp(`^---\\nname: ${s.name}\\ndescription: .+\\n---\\n`));
    });
    it(`${s.name}: só cita ferramentas do conector que existem`, () => {
      const citadas = [...texto.matchAll(/`([a-z]+(?:_[a-z]+)+)`/g)].map((m) => m[1]);
      expect(citadas.length).toBeGreaterThan(0);
      for (const f of citadas) expect(ferramentas.has(f) || valores.has(f), f).toBe(true);
    });
    it(`${s.name}: não cita outro sistema`, () => {
      expect(texto).not.toMatch(/softmoni|clickup|numit/i);
    });
  }
});
