// Servidor MCP da Aden: dá ao Claude (projeto no claude.ai) o mesmo acesso que
// um sócio tem no site. Ele entra com um usuário próprio ("Claude (conector)"),
// então as permissões do banco (RLS) valem e tudo o que ele alterar aparece no
// Histórico com o nome dele.

import "server-only";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { calcularSaudeCliente, calcularVisaoMes } from "../calculo/mes";
import { calcularCenario } from "../calculo/motor";
import { novoId } from "../calculo/novo";
import type { Configuracao } from "../calculo/tipos";
import { competenciaAtual, diferenca, temAlteracoes, type AlteracoesConfig } from "../dados/repositorio";
import type { RepositorioSupabase } from "../dados/supabase";
import {
  cenarioParaConversa,
  cenarioParaInterno,
  configParaConversa,
  paraCentavos,
  paraReais,
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
- Ferramentas e estrutura vão EMBUTIDAS na mensalidade (rateio). Na proposta, um valor só; nunca assinatura à parte.
- Para saber se cabe cliente novo, use ver_visao_do_mes. Para ver cliente dando prejuízo, ver_saude_clientes.
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
      description:
        "Padrões da empresa: reinvestimento, impostos (em % ou fixo por mês, como no MEI), taxa de recebimento (% e fixa), regra de rateio, teto anual do regime e avisos.",
      inputSchema: {
        reinvestimentoPct: opt(z.number(), "% de reinvestimento"),
        impostoPct: opt(z.number(), "% de imposto sobre faturamento"),
        impostoFixoMensalReais: opt(z.number(), "imposto fixo por mês em reais (ex.: DAS do MEI); entra no rateio"),
        taxaRecebimentoPct: opt(z.number(), "% de taxa de recebimento"),
        taxaRecebimentoFixaReais: opt(z.number(), "tarifa fixa por recebimento, em reais"),
        regraRateio: opt(z.enum(["igual", "proporcional"]), "igual entre clientes ou proporcional ao valor"),
        tetoFaturamentoAnualReais: opt(z.number(), "teto anual de faturamento do regime, em reais"),
        avisoTetoPct: opt(z.number(), "avisar quando a projeção anual chegar a este % do teto"),
        ociosidadePct: opt(z.number(), "sócio com uso abaixo deste % da capacidade aparece com folga sobrando"),
        arredondamentoPropostaReais: opt(z.number(), "arredondar o valor da proposta para cima, em múltiplos deste valor"),
      },
    },
    async ({ impostoFixoMensalReais, taxaRecebimentoFixaReais, tetoFaturamentoAnualReais, arredondamentoPropostaReais, ...p }) =>
      executar(async () => {
        const repo = await obterRepo();
        const antes = await repo.carregarConfig();
        const reais = (v: number | null | undefined) => (v === undefined ? undefined : paraCentavos(v));
        const patch = {
          ...p,
          impostoFixoMensalCentavos: reais(impostoFixoMensalReais),
          taxaRecebimentoFixaCentavos: reais(taxaRecebimentoFixaReais),
          tetoFaturamentoAnualCentavos: reais(tetoFaturamentoAnualReais),
          arredondamentoPropostaCentavos: reais(arredondamentoPropostaReais),
        };
        return salvarDiferenca(repo, antes, { ...antes, empresa: aplicar(antes.empresa, patch) });
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

  // ─── Mês inteiro e saúde dos clientes ─────────────────────────────────────

  server.registerTool(
    "ver_visao_do_mes",
    {
      title: "Visão do mês (capacidade)",
      description:
        "Soma as horas de todos os clientes ativos (pelo escopo contratado) e compara com a capacidade de cada sócio: horas usadas, livres, afogado ou com folga. Também faturamento mensal e projeção contra o teto do regime. Use para responder se dá para pegar cliente novo.",
      inputSchema: {},
    },
    async () =>
      executar(async () => {
        const v = calcularVisaoMes(await (await obterRepo()).carregarConfig());
        return {
          socios: v.socios.map((s) => ({
            nome: s.nome,
            capacidadeHorasMes: s.capacidadeHorasMes,
            horasUsadasPelosClientes: s.horasUsadas,
            horasLivres: s.horasLivres,
            usoPct: s.usoPct,
            situacao: s.situacao,
          })),
          clientes: v.clientes.map((c) => ({ nome: c.nome, temEscopo: c.temEscopo, horasTotais: c.horasTotais, valorMensal: paraReais(c.valorMensalCentavos) })),
          clientesSemEscopo_horasNaoContadas: v.semEscopo,
          faturamentoMensal: paraReais(v.faturamentoMensalCentavos),
          tetoDoRegime: v.teto ? { projecaoAnual: paraReais(v.teto.anualCentavos), teto: paraReais(v.teto.tetoCentavos), pct: v.teto.pct, nivel: v.teto.nivel } : null,
        };
      }),
  );

  server.registerTool(
    "definir_escopo_cliente",
    {
      title: "Definir escopo contratado do cliente",
      description:
        "Guarda o escopo contratado de um cliente ativo (entregas, custos, tráfego…), no mesmo formato de calcular_cenario. É a base da visão do mês e da saúde do cliente. Confirme antes de substituir um escopo existente.",
      inputSchema: {
        cliente: z.string().describe("cliente (nome ou id)"),
        cenario: zCenarioConversa.nullable().describe("escopo; null remove"),
      },
    },
    async ({ cliente, cenario }) =>
      executar(async () => {
        const repo = await obterRepo();
        const config = await repo.carregarConfig();
        const alvo = resolver(config.clientes, cliente, "Cliente");
        const escopo = cenario ? { ...cenarioParaInterno(cenario, config), clienteId: alvo.id } : null;
        await repo.definirEscopoCliente(alvo.id, escopo);
        return { cliente: alvo.nome, escopoDefinido: !!escopo };
      }),
  );

  const zCompetencia = z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional()
    .describe("mês no formato AAAA-MM (padrão: mês atual)");

  server.registerTool(
    "ver_saude_clientes",
    {
      title: "Saúde dos clientes no mês",
      description:
        "Para cada cliente ativo: previsto (escopo + contrato) × realizado (horas reais e valor recebido do mês), valor por hora real de cada sócio e se ficou abaixo do piso (prejuízo silencioso).",
      inputSchema: { competencia: zCompetencia },
    },
    async ({ competencia }) =>
      executar(async () => {
        const repo = await obterRepo();
        const mes = competencia ?? competenciaAtual();
        const [config, registros] = await Promise.all([repo.carregarConfig(), repo.carregarMes(mes)]);
        return {
          competencia: mes,
          clientes: config.clientes
            .filter((c) => c.ativo)
            .map((c) => {
              const s = calcularSaudeCliente(config, c, registros[c.id] ?? null);
              return {
                nome: s.nome,
                temEscopo: s.temEscopo,
                valorContrato: paraReais(s.valorContratoCentavos),
                valorRecebido: paraReais(s.valorRecebidoCentavos),
                horasLancadas: s.horasLancadas,
                horasPrevistas: s.horasPrevistas,
                horasReais: s.horasReais,
                pagaPorHoraPrevisto: paraReais(s.valorCobradoHoraPrevisto),
                pagaPorHoraReal: paraReais(s.valorCobradoHoraReal),
                prejuizoSilencioso: s.prejuizoSilencioso,
                contratadoAbaixoDoPiso: s.contratadoAbaixoDoPiso,
                socios: s.socios.map((x) => ({
                  nome: x.nome,
                  piso: paraReais(x.piso),
                  horasPrevistas: x.horasPrevistas,
                  horasReais: x.horasReais,
                  porHoraPrevisto: paraReais(x.valorHoraPrevisto),
                  porHoraReal: paraReais(x.valorHoraReal),
                  abaixoDoPiso: x.abaixoPisoReal,
                })),
              };
            }),
        };
      }),
  );

  server.registerTool(
    "registrar_mes_cliente",
    {
      title: "Registrar horas reais e valor recebido",
      description:
        "Lança, para um cliente e um mês, as horas reais de cada sócio e (opcional) quanto entrou de fato. Só registre números que foram informados na conversa.",
      inputSchema: {
        cliente: z.string().describe("cliente (nome ou id)"),
        competencia: zCompetencia,
        valorRecebidoReais: opt(z.number(), "quanto entrou no mês; vazio = valor do contrato"),
        horas: z.record(z.string(), z.number().nullable()).optional().describe("sócio (nome ou id) → horas reais no mês"),
      },
    },
    async ({ cliente, competencia, valorRecebidoReais, horas }) =>
      executar(async () => {
        const repo = await obterRepo();
        const mes = competencia ?? competenciaAtual();
        const config = await repo.carregarConfig();
        const alvo = resolver(config.clientes, cliente, "Cliente");
        const socios = config.pessoas.filter((p) => p.socio);
        const atual = (await repo.carregarMes(mes))[alvo.id] ?? { valorRecebidoCentavos: null, horas: {} };
        const registro = {
          valorRecebidoCentavos: valorRecebidoReais === undefined ? atual.valorRecebidoCentavos : paraCentavos(valorRecebidoReais),
          horas: {
            ...atual.horas,
            ...Object.fromEntries(Object.entries(horas ?? {}).map(([ref, h]) => [resolver(socios, ref, "Sócio").id, h])),
          },
        };
        await repo.salvarMesCliente(mes, alvo.id, registro);
        const s = calcularSaudeCliente(config, alvo, registro);
        return { cliente: alvo.nome, competencia: mes, prejuizoSilencioso: s.prejuizoSilencioso, pagaPorHoraReal: paraReais(s.valorCobradoHoraReal) };
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
