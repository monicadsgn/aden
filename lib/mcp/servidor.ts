// Servidor MCP da Aden: dá ao Claude (projeto no claude.ai) o mesmo acesso que
// um sócio tem no site. Ele entra com um usuário próprio ("Claude (conector)"),
// então as permissões do banco (RLS) valem e tudo o que ele alterar aparece no
// Histórico com o nome dele.

import "server-only";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { calcularCenario } from "../calculo/motor";
import { novoId } from "../calculo/novo";
import type { Configuracao } from "../calculo/tipos";
import { diferenca, temAlteracoes, type AlteracoesConfig } from "../dados/repositorio";
import type { RepositorioSupabase } from "../dados/supabase";
import {
  cenarioParaConversa,
  cenarioParaInterno,
  configParaConversa,
  paraCentavos,
  resolver,
  resultadoParaConversa,
  zCenarioConversa,
} from "./traducao";

const INSTRUCOES = `Sistema de gestão da Aden (assessoria de marketing e performance, sócios Moni e Áleff).
Você tem o mesmo acesso de um sócio: configurações, calculadora de projeto, simulações e histórico.

Regras que você deve seguir:
- NUNCA invente número de negócio (percentual, preço, piso, prazo, horas por entrega, modelo de cobrança).
  Só grave números que a Moni ou o Áleff disseram na conversa. Se faltar, pergunte.
- Dinheiro é sempre em REAIS nas ferramentas. Percentuais de 0 a 100.
- Verba de mídia do cliente nunca é faturamento da Aden (não entra em receita, imposto nem taxa).
- Audiovisual (edição, motion, legenda, corte) nunca gera horas dos sócios: é tipo de entrega "audiovisual" + custo de terceiro.
  Roteiro e direção de gravação são tipos normais, com horas.
- Entrada do cliente (uma vez só) é separada da rotina mensal.
- Antes de alterar configurações, confirme com quem está conversando o que vai mudar.
- Tudo o que você alterar fica registrado no Histórico com o seu nome.
Comece por ver_configuracao para saber o que existe (nomes de sócios, serviços, tipos de entrega, clientes).`;

type Texto = { content: { type: "text"; text: string }[]; isError?: boolean };

function responder(dados: unknown): Texto {
  return { content: [{ type: "text", text: typeof dados === "string" ? dados : JSON.stringify(dados, null, 2) }] };
}

async function executar(fn: () => Promise<unknown>): Promise<Texto> {
  try {
    return responder(await fn());
  } catch (e) {
    return { content: [{ type: "text", text: `Erro: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
  }
}

/** Salva a diferença entre duas configurações (só o que mudou vai para o banco e o histórico). */
async function salvarDiferenca(repo: RepositorioSupabase, antes: Configuracao, depois: Configuracao) {
  const alt: AlteracoesConfig = {
    empresa: JSON.stringify(antes.empresa) !== JSON.stringify(depois.empresa) ? depois.empresa : undefined,
    pessoas: diferenca(antes.pessoas, depois.pessoas),
    servicos: diferenca(antes.servicos, depois.servicos),
    tiposEntrega: diferenca(antes.tiposEntrega, depois.tiposEntrega),
    custosFixos: diferenca(antes.custosFixos, depois.custosFixos),
    clientes: diferenca(antes.clientes, depois.clientes),
  };
  if (!temAlteracoes(alt)) return "Nada mudou.";
  await repo.salvarConfig(alt);
  return configParaConversa(await repo.carregarConfig());
}

const opt = <T extends z.ZodTypeAny>(t: T, d: string) => t.nullable().optional().describe(`${d} (null apaga, ausente mantém)`);

/** Aplica só os campos informados (undefined = mantém). */
function aplicar<T extends object>(alvo: T, patch: Partial<Record<keyof T, unknown>>): T {
  const out = { ...alvo };
  for (const [k, v] of Object.entries(patch)) if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  return out;
}

export function criarServidorMcp(obterRepo: () => Promise<RepositorioSupabase>): McpServer {
  const server = new McpServer({ name: "aden", version: "1.0.0" }, { instructions: INSTRUCOES });

  // ─── Leitura ──────────────────────────────────────────────────────────────

  server.registerTool(
    "ver_configuracao",
    {
      title: "Ver configuração da Aden",
      description:
        "Sócios (% padrão, piso por hora, horas/mês), percentuais da empresa, regra de rateio, serviços e divisão de horas, tipos de entrega com horas, custos fixos e clientes ativos. Valores em reais.",
      inputSchema: {},
    },
    async () => executar(async () => configParaConversa(await (await obterRepo()).carregarConfig())),
  );

  server.registerTool(
    "ver_historico",
    {
      title: "Ver histórico de alterações",
      description: "Últimas alterações em configurações e simulações, com autor e data.",
      inputSchema: { limite: z.number().int().min(1).max(200).optional().describe("Quantas (padrão 30)") },
    },
    async ({ limite }) =>
      executar(async () => {
        const regs = await (await obterRepo()).listarAuditoria(limite ?? 30);
        return regs.map((r) => ({ quando: r.em, quem: r.autor, acao: r.acao, onde: r.tabela, registro: r.registroId, antes: r.antes, depois: r.depois }));
      }),
  );

  // ─── Configuração ─────────────────────────────────────────────────────────

  server.registerTool(
    "definir_percentuais_empresa",
    {
      title: "Definir percentuais da empresa",
      description: "Padrões da empresa: reinvestimento (sobre a sobra), imposto e taxa de recebimento (sobre o faturamento) e regra de rateio do custo fixo.",
      inputSchema: {
        reinvestimentoPct: opt(z.number(), "% de reinvestimento"),
        impostoPct: opt(z.number(), "% de imposto sobre faturamento"),
        taxaRecebimentoPct: opt(z.number(), "% de taxa de recebimento"),
        regraRateio: opt(z.enum(["igual", "proporcional"]), "igual entre clientes ou proporcional ao valor"),
      },
    },
    async (p) =>
      executar(async () => {
        const repo = await obterRepo();
        const antes = await repo.carregarConfig();
        return salvarDiferenca(repo, antes, { ...antes, empresa: aplicar(antes.empresa, p) });
      }),
  );

  server.registerTool(
    "salvar_socio",
    {
      title: "Criar ou alterar sócio",
      description: "Sem id cria um sócio novo; com id (ou nome existente) altera só os campos informados.",
      inputSchema: {
        id: z.string().optional().describe("id ou nome do sócio a alterar; vazio = novo"),
        nome: z.string().optional(),
        percentualPadrao: opt(z.number(), "% padrão da divisão"),
        pisoHoraReais: opt(z.number(), "piso de valor por hora, em reais"),
        capacidadeHorasMes: opt(z.number(), "horas disponíveis por mês"),
        ativo: z.boolean().optional(),
      },
    },
    async ({ id, pisoHoraReais, ...resto }) =>
      executar(async () => {
        const repo = await obterRepo();
        const antes = await repo.carregarConfig();
        const socios = antes.pessoas.filter((p) => p.socio);
        const patch = { ...resto, ...(pisoHoraReais !== undefined ? { pisoHoraCentavos: paraCentavos(pisoHoraReais) } : {}) };
        let pessoas;
        if (id) {
          const alvo = resolver(socios, id, "Sócio");
          pessoas = antes.pessoas.map((p) => (p.id === alvo.id ? aplicar(p, patch) : p));
        } else {
          if (!resto.nome) throw new Error("Informe o nome do sócio novo.");
          pessoas = [
            ...antes.pessoas,
            aplicar(
              { id: novoId(), nome: resto.nome, socio: true, percentualPadrao: null, pisoHoraCentavos: null, capacidadeHorasMes: null, ativo: true },
              patch,
            ),
          ];
        }
        return salvarDiferenca(repo, antes, { ...antes, pessoas });
      }),
  );

  server.registerTool(
    "salvar_servico",
    {
      title: "Criar ou alterar serviço",
      description: "Serviço e divisão padrão das horas entre os sócios (% por sócio, somando 100).",
      inputSchema: {
        id: z.string().optional().describe("id ou nome do serviço a alterar; vazio = novo"),
        nome: z.string().optional(),
        divisao: z.record(z.string(), z.number().nullable()).optional().describe("sócio (nome ou id) → % das horas"),
        ativo: z.boolean().optional(),
      },
    },
    async ({ id, divisao, ...resto }) =>
      executar(async () => {
        const repo = await obterRepo();
        const antes = await repo.carregarConfig();
        const socios = antes.pessoas.filter((p) => p.socio);
        const div = divisao
          ? Object.fromEntries(Object.entries(divisao).map(([ref, v]) => [resolver(socios, ref, "Sócio").id, v]))
          : undefined;
        let servicos;
        if (id) {
          const alvo = resolver(antes.servicos, id, "Serviço");
          servicos = antes.servicos.map((s) =>
            s.id === alvo.id ? aplicar(s, { ...resto, ...(div ? { divisaoPadrao: { ...s.divisaoPadrao, ...div } } : {}) }) : s,
          );
        } else {
          if (!resto.nome) throw new Error("Informe o nome do serviço novo.");
          servicos = [...antes.servicos, { id: novoId(), nome: resto.nome, divisaoPadrao: div ?? {}, ativo: resto.ativo ?? true }];
        }
        return salvarDiferenca(repo, antes, { ...antes, servicos });
      }),
  );

  server.registerTool(
    "salvar_tipo_entrega",
    {
      title: "Criar ou alterar tipo de entrega",
      description:
        "Unidade de esforço da calculadora (ex.: post simples, carrossel, roteiro). audiovisual=true para vídeo feito por terceiro: não gera horas, exige custo de audiovisual.",
      inputSchema: {
        id: z.string().optional().describe("id ou nome do tipo a alterar; vazio = novo"),
        nome: z.string().optional(),
        servico: opt(z.string(), "serviço (nome ou id)"),
        horasPorUnidade: opt(z.number(), "horas por entrega"),
        audiovisual: z.boolean().optional(),
        ativo: z.boolean().optional(),
      },
    },
    async ({ id, servico, ...resto }) =>
      executar(async () => {
        const repo = await obterRepo();
        const antes = await repo.carregarConfig();
        const patch = {
          ...resto,
          ...(servico !== undefined ? { servicoId: servico == null ? null : resolver(antes.servicos, servico, "Serviço").id } : {}),
        };
        let tiposEntrega;
        if (id) {
          const alvo = resolver(antes.tiposEntrega, id, "Tipo de entrega");
          tiposEntrega = antes.tiposEntrega.map((t) => (t.id === alvo.id ? aplicar(t, patch) : t));
        } else {
          if (!resto.nome) throw new Error("Informe o nome do tipo de entrega novo.");
          tiposEntrega = [
            ...antes.tiposEntrega,
            aplicar({ id: novoId(), nome: resto.nome, servicoId: null, horasPorUnidade: null, audiovisual: false, ativo: true }, patch),
          ];
        }
        return salvarDiferenca(repo, antes, { ...antes, tiposEntrega });
      }),
  );

  server.registerTool(
    "salvar_custo_fixo",
    {
      title: "Criar ou alterar custo fixo da empresa",
      description: "Custos mensais da empresa (assinaturas, armazenamento, IA…), rateados entre clientes ativos.",
      inputSchema: {
        id: z.string().optional().describe("id ou nome do custo a alterar; vazio = novo"),
        nome: z.string().optional(),
        valorMensalReais: opt(z.number(), "valor mensal em reais"),
        ativo: z.boolean().optional(),
      },
    },
    async ({ id, valorMensalReais, ...resto }) =>
      executar(async () => {
        const repo = await obterRepo();
        const antes = await repo.carregarConfig();
        const patch = { ...resto, ...(valorMensalReais !== undefined ? { valorMensalCentavos: paraCentavos(valorMensalReais) } : {}) };
        let custosFixos;
        if (id) {
          const alvo = resolver(antes.custosFixos, id, "Custo fixo");
          custosFixos = antes.custosFixos.map((c) => (c.id === alvo.id ? aplicar(c, patch) : c));
        } else {
          if (!resto.nome) throw new Error("Informe o nome do custo novo.");
          custosFixos = [...antes.custosFixos, aplicar({ id: novoId(), nome: resto.nome, valorMensalCentavos: null, ativo: true }, patch)];
        }
        return salvarDiferenca(repo, antes, { ...antes, custosFixos });
      }),
  );

  server.registerTool(
    "salvar_cliente",
    {
      title: "Criar ou alterar cliente (base do rateio)",
      description: "Cliente ativo e valor mensal do contrato vigente. interno=true para a rede da própria Aden.",
      inputSchema: {
        id: z.string().optional().describe("id ou nome do cliente a alterar; vazio = novo"),
        nome: z.string().optional(),
        valorMensalReais: opt(z.number(), "valor mensal em reais"),
        interno: z.boolean().optional(),
        participaRateio: z.boolean().optional(),
        ativo: z.boolean().optional(),
      },
    },
    async ({ id, valorMensalReais, ...resto }) =>
      executar(async () => {
        const repo = await obterRepo();
        const antes = await repo.carregarConfig();
        const patch = { ...resto, ...(valorMensalReais !== undefined ? { valorMensalCentavos: paraCentavos(valorMensalReais) } : {}) };
        let clientes;
        if (id) {
          const alvo = resolver(antes.clientes, id, "Cliente");
          clientes = antes.clientes.map((c) => (c.id === alvo.id ? aplicar(c, patch) : c));
        } else {
          if (!resto.nome) throw new Error("Informe o nome do cliente novo.");
          clientes = [
            ...antes.clientes,
            aplicar({ id: novoId(), nome: resto.nome, interno: false, participaRateio: true, valorMensalCentavos: null, ativo: true }, patch),
          ];
        }
        return salvarDiferenca(repo, antes, { ...antes, clientes });
      }),
  );

  server.registerTool(
    "remover_da_configuracao",
    {
      title: "Remover item da configuração",
      description: "Remove um sócio, serviço, tipo de entrega, custo fixo ou cliente. Confirme antes com quem está conversando.",
      inputSchema: {
        tipo: z.enum(["socio", "servico", "tipo_entrega", "custo_fixo", "cliente"]),
        id: z.string().describe("id ou nome do item"),
      },
    },
    async ({ tipo, id }) =>
      executar(async () => {
        const repo = await obterRepo();
        const antes = await repo.carregarConfig();
        const depois = { ...antes };
        if (tipo === "socio") {
          const a = resolver(antes.pessoas.filter((p) => p.socio), id, "Sócio");
          depois.pessoas = antes.pessoas.filter((p) => p.id !== a.id);
        } else if (tipo === "servico") {
          const a = resolver(antes.servicos, id, "Serviço");
          depois.servicos = antes.servicos.filter((p) => p.id !== a.id);
        } else if (tipo === "tipo_entrega") {
          const a = resolver(antes.tiposEntrega, id, "Tipo de entrega");
          depois.tiposEntrega = antes.tiposEntrega.filter((p) => p.id !== a.id);
        } else if (tipo === "custo_fixo") {
          const a = resolver(antes.custosFixos, id, "Custo fixo");
          depois.custosFixos = antes.custosFixos.filter((p) => p.id !== a.id);
        } else {
          const a = resolver(antes.clientes, id, "Cliente");
          depois.clientes = antes.clientes.filter((p) => p.id !== a.id);
        }
        return salvarDiferenca(repo, antes, depois);
      }),
  );

  // ─── Calculadora e simulações ─────────────────────────────────────────────

  server.registerTool(
    "calcular_cenario",
    {
      title: "Calcular um cenário",
      description:
        "Roda a calculadora de projeto sem salvar. Modo escopo: valor mínimo. Modo valor: sobra, parte e valor/hora de cada sócio e o que cabe. Mostra também entrada, horizonte e alertas.",
      inputSchema: { cenario: zCenarioConversa },
    },
    async ({ cenario }) =>
      executar(async () => {
        const config = await (await obterRepo()).carregarConfig();
        return resultadoParaConversa(calcularCenario(config, cenarioParaInterno(cenario, config)));
      }),
  );

  server.registerTool(
    "listar_simulacoes",
    { title: "Listar simulações salvas", description: "Simulações da calculadora, da mais recente para a mais antiga.", inputSchema: {} },
    async () => executar(async () => (await obterRepo()).listarSimulacoes()),
  );

  server.registerTool(
    "ver_simulacao",
    {
      title: "Ver simulação salva",
      description: "Cenários da simulação (no mesmo formato aceito por calcular_cenario e salvar_simulacao) e o resultado calculado com a configuração atual.",
      inputSchema: { id: z.string().describe("id ou nome da simulação") },
    },
    async ({ id }) =>
      executar(async () => {
        const repo = await obterRepo();
        const lista = await repo.listarSimulacoes();
        const alvo = resolver(lista, id, "Simulação");
        const sim = await repo.carregarSimulacao(alvo.id);
        if (!sim) throw new Error("Simulação não encontrada.");
        const config = await repo.carregarConfig();
        return {
          id: sim.id,
          nome: sim.nome,
          cenarios: sim.cenarios.map((c) => ({
            cenario: cenarioParaConversa(c, config),
            resultado: resultadoParaConversa(calcularCenario(config, c)),
          })),
        };
      }),
  );

  server.registerTool(
    "salvar_simulacao",
    {
      title: "Salvar simulação",
      description:
        "Cria ou substitui uma simulação com até 3 cenários (aparece no site em Calculadora → Abrir simulação salva). Com id, substitui os cenários daquela simulação.",
      inputSchema: {
        id: z.string().optional().describe("id ou nome de uma simulação existente para substituir; vazio = nova"),
        nome: z.string(),
        cenarios: z.array(zCenarioConversa.extend({ id: z.string().optional() })).min(1).max(3),
      },
    },
    async ({ id, nome, cenarios }) =>
      executar(async () => {
        const repo = await obterRepo();
        const config = await repo.carregarConfig();
        const simId = id ? resolver(await repo.listarSimulacoes(), id, "Simulação").id : novoId();
        const internos = cenarios.map((c) => cenarioParaInterno(c, config, c.id));
        const resultados = internos.map((c) => calcularCenario(config, c));
        await repo.salvarSimulacao({ id: simId, nome, cenarios: internos }, resultados, config);
        return { salva: true, id: simId, nome, resultados: resultados.map(resultadoParaConversa) };
      }),
  );

  server.registerTool(
    "remover_simulacao",
    {
      title: "Remover simulação",
      description: "Apaga uma simulação salva (fica registrado no histórico). Confirme antes.",
      inputSchema: { id: z.string().describe("id ou nome da simulação") },
    },
    async ({ id }) =>
      executar(async () => {
        const repo = await obterRepo();
        const alvo = resolver(await repo.listarSimulacoes(), id, "Simulação");
        await repo.removerSimulacao(alvo.id);
        return { removida: alvo.nome };
      }),
  );

  return server;
}
