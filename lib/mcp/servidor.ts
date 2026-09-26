// Servidor MCP da Aden: dá ao Claude (projeto no claude.ai) o mesmo acesso que
// um sócio tem no site. Ele entra com um usuário próprio ("Claude (conector)"),
// então as permissões do banco (RLS) valem e tudo o que ele alterar aparece no
// Histórico com o nome dele.

import "server-only";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { pacoteQueCabe } from "../calculo/apresentacao";
import { calcularCalibragem, segundosDaMedicao, type Medicao } from "../calculo/calibragem";
import { documentoContador } from "../calculo/documentos";
import { calcularSaudeCliente, calcularVisaoMes, rotuloOrigemHoras } from "../calculo/mes";
import { calcularCenario } from "../calculo/motor";
import { novoId } from "../calculo/novo";
import { distribuirPagamentos, repasseDosSocios, somaPagamentos } from "../calculo/pagamentos";
import { calcularSolucoes } from "../calculo/solucoes";
import { clienteNoMes, contratoVazio, fimDaFidelidade, prazoDoAvisoPrevio } from "../calculo/clientes";
import { diasNaEtapa, etapaAberta, moverLead, novoLead, resumoFunil, rotuloEtapa, type Lead } from "../calculo/crm";
import { PAPEIS } from "../acesso";
import { hojeISO, montarVisaoDoDia } from "../calculo/dia";
import { calcularTrilha, espacoPraVender, unidadeDoCriterio } from "../calculo/metas";
import { frasesParaCliente, pacoteParaCenario, pacotePadrao, precoDoPacote } from "../calculo/pacotes";
import { estimativaHoras, medicaoDaTarefa, mudarStatus, novaTarefa, rotuloStatus, situacaoPeca, type Tarefa } from "../calculo/tarefas";
import type { Configuracao, Meta, Pacote } from "../calculo/tipos";
import { descreverItem, ganharLead, guardarEscopo } from "../dados/acoes";
import { competenciaAtual, diferenca, temAlteracoes, type AlteracoesConfig } from "../dados/repositorio";
import { REGRAS_PROTECAO } from "../regras/aprovacao";
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

const INSTRUCOES = `Aden: a central da agência (assessoria de marketing e performance, sócios Moni e Áleff). Tudo num lugar só:
tarefas, calendário, comercial (pacotes, negociação, calculadora), financeiro, metas e configurações.
Você tem o mesmo acesso de um sócio. Para "o que tenho pra hoje?", comece por ver_visao_do_dia.

Regras que você deve seguir:
- NUNCA invente número de negócio (percentual, preço, piso, prazo, horas por entrega, modelo de cobrança).
  Só grave números que a Moni ou o Áleff disseram na conversa. Se faltar, pergunte.
- Dinheiro é sempre em REAIS nas ferramentas. Percentuais de 0 a 100.
- Verba de mídia do cliente nunca é faturamento da Aden (não entra em receita, imposto nem taxa).
- Audiovisual (edição, motion, legenda, corte) nunca gera horas dos sócios: é tipo de entrega "audiovisual" + custo de terceiro.
  Roteiro e direção de gravação são tipos normais, com horas.
- Entrada do cliente (uma vez só) é separada da rotina mensal.
- Ferramentas e estrutura vão EMBUTIDAS na mensalidade (rateio). Na proposta, um valor só; nunca assinatura à parte.
- Para saber se cabe cliente novo, use ver_visao_do_mes. Para ver cliente dando prejuízo e os caminhos para resolver, ver_saude_clientes.
- Tempo por entrega é em MINUTOS (minutosPorUnidade). 20 min, 40 min…
- Proteção dos sócios: ${REGRAS_PROTECAO}
  Você (o conector) não é sócio: toda mudança sua em piso, % dos sócios, divisão de horas ou tempo por entrega
  vira pedido de aprovação para o sócio afetado (exceto campo que estava vazio). Diga isso a quem está conversando.
  Você nunca aprova pedidos; quem aprova é o sócio, no site (Sócios → Pedidos e avisos).
- Escopo abaixo do piso de um sócio não é gravado direto: vira pedido de exceção para ele aprovar.
- Pagamentos: registrar_pagamento (cada um que cai, com mês de referência e data). ver_pagamentos_do_mes mostra para
  onde foi cada real e quanto cada sócio já recebeu. Se a ordem de distribuição estiver vazia, a distribuição fica bloqueada.
- Equipe: ver_equipe e convidar_pessoa (cada papel vê só o que é dele; o banco garante).
- Painel do cliente: link_painel_cliente (link para o cliente ver e aprovar) e enviar_para_cliente_aprovar.
  listar_tarefas mostra o que o cliente respondeu (aprovou ou pediu ajuste).
- Clientes: ver_cliente (ficha completa) e salvar_ficha_cliente (contato e condições do contrato).
- CRM: listar_leads, salvar_lead, mover_lead, registrar_conversa_lead; quando fechar, ganhar_lead (cria o cliente).
- O Aden é a central da agência (tarefas, calendário, comercial, financeiro, metas). "O que tenho pra hoje?" → ver_visao_do_dia.
- Tarefas: listar_tarefas, salvar_tarefa (cria ou edita: cliente, tipo de entrega, quantidade, responsável, prazo, checklist)
  e mudar_status_tarefa. O cronômetro fica DENTRO da tarefa (botão Start no site); você não liga relógio, mas pode
  registrar um tempo que a pessoa disse com registrar_medicao. ver_calibragem mostra a média medida.
- Pacotes: ver_pacotes mostra os preços CALCULADOS (nunca digitados). salvar_pacote só guarda o que é entregue.
- Terceiros (salvar_terceiro): custo por saída + deslocamento, só do cliente que recebe; o cliente nunca vê o valor.
- Metas (ver_metas, salvar_meta): trilha de crescimento em degraus. Só cadastre metas que os sócios definiram.
- Sem regra de rateio (com custo fixo cadastrado) a calculadora não calcula: diga o motivo, não invente o resultado.
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
    terceiros: diferenca(antes.terceiros ?? [], depois.terceiros ?? []),
    pacotes: diferenca(antes.pacotes ?? [], depois.pacotes ?? []),
    metas: diferenca(antes.metas ?? [], depois.metas ?? []),
  };
  if (!temAlteracoes(alt)) return "Nada mudou.";
  const r = await repo.salvarConfig(alt);
  const config = await repo.carregarConfig();
  const nome = (id: string) => config.pessoas.find((p) => p.id === id)?.nome ?? id;
  return {
    protegido:
      r.pedido == null
        ? null
        : r.pedido.status === "pendente"
          ? `As mudanças protegidas (${r.itensProtegidos.map(descreverItem).join("; ")}) ficaram PENDENTES: só valem depois que ${r.pedido.aguardando.map(nome).join(" e ")} aprovar no site. Até lá vale o valor antigo.`
          : "A mudança protegida já valeu.",
    configuracao: configParaConversa(config),
  };
}

const opt = <T extends z.ZodTypeAny>(t: T, d: string) => t.nullable().optional().describe(`${d} (null apaga, ausente mantém)`);

/** Aplica só os campos informados (undefined = mantém). */
function aplicar<T extends object>(alvo: T, patch: Partial<Record<keyof T, unknown>>): T {
  const out = { ...alvo };
  for (const [k, v] of Object.entries(patch)) if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  return out;
}

export function criarServidorMcp(obterRepo: () => Promise<RepositorioSupabase>, origem = ""): McpServer {
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
        regime: opt(z.enum(["mei", "outro"]), "mei = imposto fixo por mês (o imposto em % é ignorado); outro = imposto em %"),
        ordemDistribuicao: opt(
          z.enum(["custo_primeiro", "proporcional"]),
          "como cada pagamento é distribuído: custo_primeiro (paga os custos do mês antes dos sócios) ou proporcional. Só grave o que os sócios decidirem",
        ),
        medicoesCalibragem: opt(z.number().int().positive(), "quantas medições de cronômetro calibram cada tipo de entrega"),
        diferencaSugerirPct: opt(z.number(), "sugerir novo tempo quando a média medida diferir mais que este %"),
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
        minutosPorUnidade: opt(z.number(), "tempo por entrega, em minutos (campo protegido)"),
        horasPorUnidade: opt(z.number(), "tempo por entrega em horas (prefira minutosPorUnidade)"),
        audiovisual: z.boolean().optional(),
        terceiro: opt(z.string(), "terceiro que cobra por saída (nome ou id): cada unidade = 1 saída"),
        ativo: z.boolean().optional(),
      },
    },
    async ({ id, servico, minutosPorUnidade, terceiro, ...resto }) =>
      executar(async () => {
        const repo = await obterRepo();
        const antes = await repo.carregarConfig();
        const patch = {
          ...resto,
          ...(minutosPorUnidade !== undefined ? { horasPorUnidade: minutosPorUnidade == null ? null : minutosPorUnidade / 60 } : {}),
          ...(servico !== undefined ? { servicoId: servico == null ? null : resolver(antes.servicos, servico, "Serviço").id } : {}),
          ...(terceiro !== undefined ? { terceiroId: terceiro == null ? null : resolver(antes.terceiros ?? [], terceiro, "Terceiro").id } : {}),
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
        "Espaço para vender: quantos clientes do pacote padrão ainda cabem (pelas horas livres), a trilha de metas (degrau atual e quanto falta), horas de cada sócio e de cada cliente, faturamento e teto do regime. Fale em tom de crescimento: quando não couber mais, é hora do próximo passo da trilha.",
      inputSchema: {},
    },
    async () =>
      executar(async () => {
        const config = await (await obterRepo()).carregarConfig();
        const v = calcularVisaoMes(config);
        const padrao = pacotePadrao(config);
        const espaco = padrao ? espacoPraVender(config, padrao, v) : null;
        const trilha = calcularTrilha(config, v);
        const atual = trilha.atual != null ? trilha.degraus[trilha.atual] : null;
        return {
          espacoParaVender: espaco
            ? { pacotePadrao: padrao!.nome, cabemMais: espaco.cabem, faltaParaCalcular: espaco.faltando }
            : "nenhum pacote padrão marcado",
          degrauAtual: atual ? { nome: atual.meta.nome, progressoPct: atual.progressoPct == null ? null : Math.round(atual.progressoPct), acao: atual.meta.acao } : null,
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
        "Guarda o escopo contratado de um cliente ativo (entregas, custos, tráfego…), no mesmo formato de calcular_cenario, e o valor como mensalidade do contrato. Se algum sócio ficar abaixo do piso, NÃO grava: vira pedido de exceção para o sócio afetado aprovar. Confirme antes de substituir um escopo existente.",
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
        if (!cenario) {
          await repo.definirEscopoCliente(alvo.id, null);
          return { cliente: alvo.nome, escopoRemovido: true };
        }
        const r = await guardarEscopo(repo, config, alvo.id, { ...cenarioParaInterno(cenario, config), clienteId: alvo.id });
        const nome = (id: string) => config.pessoas.find((p) => p.id === id)?.nome ?? id;
        return {
          cliente: alvo.nome,
          valorMensal: paraReais(r.valorCentavos),
          gravado: r.gravado || r.pedido?.status === "aplicado",
          abaixoDoPiso: r.abaixo.map((x) => ({ socio: x.nome, perdaPorMes: paraReais(x.perdaMensalCentavos) })),
          situacao: r.gravado
            ? "Escopo guardado."
            : r.pedido?.status === "aplicado"
              ? "Guardado como exceção (o afetado é quem pediu)."
              : `Não gravado: fica abaixo do piso. Pedido de exceção esperando ${r.pedido?.aguardando.map(nome).join(" e ")} aprovar no site.`,
        };
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
        "Para cada cliente ativo: previsto (escopo + contrato) × realizado (horas lançadas, ou média medida, ou previsão; valor dos pagamentos), valor por hora de cada sócio contra o piso, de onde vem cada número de horas e, quando há problema, os caminhos calculados: subir o valor, cortar escopo, misto, ou aceitar a exceção (quanto cada sócio perde por mês).",
      inputSchema: { competencia: zCompetencia },
    },
    async ({ competencia }) =>
      executar(async () => {
        const repo = await obterRepo();
        const mes = competencia ?? competenciaAtual();
        const [config, registros, pagamentos, medicoes] = await Promise.all([repo.carregarConfig(), repo.carregarMes(mes), repo.listarPagamentos(), repo.listarMedicoes()]);
        const calibragem = calcularCalibragem(config, medicoes);
        return {
          competencia: mes,
          clientes: config.clientes
            .filter((c) => c.ativo)
            .map((c) => {
              const s = calcularSaudeCliente(config, c, registros[c.id] ?? null, {
                calibragem,
                pagamentosCentavos: somaPagamentos(pagamentos, c.id, mes),
                mesFechado: mes < competenciaAtual(),
              });
              const sol = calcularSolucoes(config, c, s, calibragem);
              return {
                nome: s.nome,
                bloqueado: s.bloqueio?.texto ?? null,
                temEscopo: s.temEscopo,
                valorContrato: paraReais(s.valorContratoCentavos),
                valorUsadoNoMes: paraReais(s.valorRealCentavos),
                deOndeVemOValor: s.origemValor,
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
                  origemDasHoras: rotuloOrigemHoras(x.origemHoras),
                  semRegistro: x.semRegistro,
                  recebe: paraReais(x.valorReal),
                  porHoraPrevisto: paraReais(x.valorHoraPrevisto),
                  porHoraReal: paraReais(x.valorHoraReal),
                  abaixoDoPiso: x.abaixoPisoReal,
                  recebeSemHoras: x.recebeSemHoras,
                })),
                caminhos: sol.temProblema
                  ? {
                      calculadoCom: sol.base === "real" ? "horas reais do mês" : "o contrato",
                      faltaDado: sol.faltando,
                      subirOValor: sol.subir ? { mensalidade: paraReais(sol.subir.mensalidadeCentavos), aMais: paraReais(sol.subir.aMaisCentavos) } : null,
                      cortarEscopo: sol.cortar.map((x) => ({ tirar: x.tirar, entrega: x.nome })),
                      corteDeUmTipoSoNaoResolve: sol.corteSozinhoNaoResolve,
                      misto: sol.misto.map((x) => ({ tirar: x.tirar, entrega: x.nome, mensalidade: paraReais(x.mensalidadeCentavos), aMais: paraReais(x.aMaisCentavos) })),
                      aceitarExcecao: sol.excecao.map((x) => ({ socio: x.nome, perdePorMes: paraReais(x.perdaMensalCentavos), precisaAprovacaoDe: x.nome })),
                    }
                  : null,
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
        "Lança, para um cliente e um mês, as horas reais de cada sócio (lançamento manual). Para dinheiro que entrou, use registrar_pagamento. Só registre números que foram informados na conversa.",
      inputSchema: {
        cliente: z.string().describe("cliente (nome ou id)"),
        competencia: zCompetencia,
        valorRecebidoReais: opt(z.number(), "lançamento antigo de quanto entrou; prefira registrar_pagamento"),
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

  // ─── Equipe e acessos ─────────────────────────────────────────────────────

  server.registerTool(
    "ver_equipe",
    {
      title: "Equipe e acessos",
      description: "Quem tem acesso ao Aden (sócio, equipe, freelancer, contador), se está ativo, e os convites esperando o primeiro acesso.",
      inputSchema: {},
    },
    async () =>
      executar(async () => {
        const r = await (await obterRepo()).listarEquipe();
        return {
          membros: r.membros.map((m) => ({ nome: m.nome, email: m.email, acesso: PAPEIS.find((p) => p.valor === m.papel)?.rotulo ?? m.papel, ativo: m.ativo })),
          convitesAbertos: r.convites.map((c) => ({ nome: c.nome, email: c.email, acesso: PAPEIS.find((p) => p.valor === c.papel)?.rotulo ?? c.papel })),
        };
      }),
  );

  server.registerTool(
    "convidar_pessoa",
    {
      title: "Convidar alguém para o Aden",
      description:
        "Cria o convite por e-mail. A pessoa entra em /entrar → 'Primeiro acesso? Criar senha' com esse e-mail. Acessos: admin (sócio, tudo), colaborador (equipe: todas as tarefas, sem valores), freelancer (só as tarefas dele), contador (só financeiro). Confirme o acesso com quem está conversando; sócio só se pedirem explicitamente.",
      inputSchema: { nome: z.string(), email: z.string().email(), acesso: z.enum(["admin", "colaborador", "freelancer", "contador"]) },
    },
    async ({ nome, email, acesso }) =>
      executar(async () => {
        await (await obterRepo()).convidar(nome, email, acesso);
        return { convidado: nome, email: email.toLowerCase(), comoEntrar: `${origem}/entrar → "Primeiro acesso? Criar senha"` };
      }),
  );

  // ─── Painel do cliente ────────────────────────────────────────────────────

  server.registerTool(
    "link_painel_cliente",
    {
      title: "Link do painel do cliente",
      description:
        "Devolve o link do painel do cliente (onde ele vê e aprova as peças). Cria o link se ainda não existir. novo=true troca o link (o antigo para de funcionar): só se a pessoa pedir.",
      inputSchema: { cliente: z.string().describe("nome ou id"), novo: z.boolean().optional() },
    },
    async ({ cliente, novo }) =>
      executar(async () => {
        const repo = await obterRepo();
        const c = resolver((await repo.carregarConfig()).clientes, cliente, "Cliente");
        const token = c.painelToken && !novo ? c.painelToken : await repo.gerarLinkPainel(c.id);
        return { cliente: c.nome, link: `${origem}/c/${token}` };
      }),
  );

  server.registerTool(
    "enviar_para_cliente_aprovar",
    {
      title: "Enviar peça para o cliente aprovar",
      description:
        "Marca a tarefa para aparecer no painel do cliente e manda para aprovação (status Com o cliente). Opcional: a legenda que o cliente vai ler. As artes são anexadas pelo site.",
      inputSchema: { id: z.string().describe("id da tarefa"), legenda: z.string().optional() },
    },
    async ({ id, legenda }) =>
      executar(async () => {
        const repo = await obterRepo();
        const t = (await repo.listarTarefas()).find((x) => x.id === id);
        if (!t) throw new Error("Tarefa não encontrada.");
        if (!t.clienteId) throw new Error("A tarefa não tem cliente: ligue a um cliente antes.");
        await repo.salvarTarefa({ ...t, visivelCliente: true, ...(legenda != null && { legenda }) });
        await repo.enviarParaCliente(t.id);
        return { enviada: t.titulo };
      }),
  );

  // ─── Clientes e contratos ─────────────────────────────────────────────────

  server.registerTool(
    "ver_cliente",
    {
      title: "Ficha do cliente",
      description: "Tudo de um cliente: contato, contrato (valor, dia do pagamento, datas, prazos), escopo contratado, tarefas abertas, pagamentos recentes e o lead de origem.",
      inputSchema: { cliente: z.string().describe("nome ou id") },
    },
    async ({ cliente }) =>
      executar(async () => {
        const repo = await obterRepo();
        const config = await repo.carregarConfig();
        const c = resolver(config.clientes, cliente, "Cliente");
        const [tarefas, pagamentos, leads] = await Promise.all([repo.listarTarefas(), repo.listarPagamentos(), repo.listarLeads()]);
        const k = c.contrato ?? contratoVazio();
        const lead = leads.find((l) => l.clienteId === c.id);
        return {
          nome: c.nome,
          ativo: c.ativo,
          segmento: c.segmento || null,
          contato: { pessoa: c.contato || null, telefone: c.telefone || null, email: c.email || null, instagram: c.instagram || null },
          clienteDesde: c.clienteDesde ?? null,
          observacoes: c.observacoes || null,
          contrato: {
            valorMensal: paraReais(c.valorMensalCentavos),
            ...k,
            fidelidadeAte: fimDaFidelidade(k),
            avisarSeNaoRenovarAte: prazoDoAvisoPrevio(k),
          },
          escopo: (c.escopo?.entregas ?? [])
            .filter((l) => (l.quantidade ?? 0) > 0)
            .map((l) => ({ entrega: config.tiposEntrega.find((t) => t.id === l.tipoEntregaId)?.nome ?? "?", quantidadeMes: l.quantidade })),
          tarefasAbertas: tarefas.filter((t) => t.clienteId === c.id && t.status !== "concluida").map((t) => ({ titulo: t.titulo, status: rotuloStatus(t.status), vencimento: t.vencimento })),
          pagamentosRecentes: pagamentos
            .filter((p) => p.clienteId === c.id)
            .sort((a, b) => b.recebidoEm.localeCompare(a.recebidoEm))
            .slice(0, 6)
            .map((p) => ({ valor: paraReais(p.valorCentavos), recebidoEm: p.recebidoEm, mes: p.competencia })),
          veioDoCrm: lead ? { lead: lead.nome, origem: lead.origem || null, fechadoEm: lead.fechadoEm } : null,
        };
      }),
  );

  server.registerTool(
    "salvar_ficha_cliente",
    {
      title: "Editar a ficha e o contrato do cliente",
      description:
        "Muda dados de contato e condições do contrato de um cliente existente (para criar cliente use salvar_cliente). Só os campos enviados mudam. Só grave o que foi combinado de verdade. Datas em AAAA-MM-DD.",
      inputSchema: {
        cliente: z.string().describe("nome ou id"),
        contato: z.string().optional(),
        telefone: z.string().optional(),
        email: z.string().optional(),
        instagram: z.string().optional(),
        segmento: z.string().optional(),
        observacoes: z.string().optional(),
        clienteDesde: z.string().nullable().optional(),
        inicioContrato: z.string().nullable().optional(),
        fimContrato: z.string().nullable().optional(),
        prazoMinimoMeses: z.number().int().positive().nullable().optional(),
        diaPagamento: z.number().int().min(1).max(31).nullable().optional(),
        avisoPrevioDias: z.number().int().nonnegative().nullable().optional(),
        limiteRodadas: z.number().int().nonnegative().nullable().optional(),
        prazoAprovacaoDias: z.number().int().nonnegative().nullable().optional(),
        prazoEntregaDias: z.number().int().nonnegative().nullable().optional(),
        inicioCobranca: z.string().optional(),
        condicoes: z.string().optional().describe("outras condições do contrato"),
      },
    },
    async (e) =>
      executar(async () => {
        const repo = await obterRepo();
        const config = await repo.carregarConfig();
        const c = resolver(config.clientes, e.cliente, "Cliente");
        for (const d of [e.clienteDesde, e.inicioContrato, e.fimContrato]) if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error(`Data inválida: ${d}. Use AAAA-MM-DD.`);
        const k = c.contrato ?? contratoVazio();
        const def = <T,>(v: T | undefined, atual: T) => (v === undefined ? atual : v);
        const novo = {
          ...c,
          contato: def(e.contato, c.contato),
          telefone: def(e.telefone, c.telefone),
          email: def(e.email, c.email),
          instagram: def(e.instagram, c.instagram),
          segmento: def(e.segmento, c.segmento),
          observacoes: def(e.observacoes, c.observacoes),
          clienteDesde: def(e.clienteDesde, c.clienteDesde ?? null),
          contrato: {
            ...k,
            inicio: def(e.inicioContrato, k.inicio),
            fim: def(e.fimContrato, k.fim),
            prazoMinimoMeses: def(e.prazoMinimoMeses, k.prazoMinimoMeses),
            diaPagamento: def(e.diaPagamento, k.diaPagamento),
            avisoPrevioDias: def(e.avisoPrevioDias, k.avisoPrevioDias),
            limiteRodadas: def(e.limiteRodadas, k.limiteRodadas),
            prazoAprovacaoDias: def(e.prazoAprovacaoDias, k.prazoAprovacaoDias),
            prazoEntregaDias: def(e.prazoEntregaDias, k.prazoEntregaDias),
            inicioCobranca: def(e.inicioCobranca, k.inicioCobranca),
            observacoes: def(e.condicoes, k.observacoes),
          },
        };
        return salvarDiferenca(repo, config, { ...config, clientes: config.clientes.map((x) => (x.id === c.id ? novo : x)) });
      }),
  );

  // ─── CRM ──────────────────────────────────────────────────────────────────

  server.registerTool(
    "listar_leads",
    {
      title: "Listar leads do CRM",
      description: "Leads do funil com etapa, dias na etapa, valor estimado, próximo contato e responsável. Por padrão só os em aberto. Inclui o resumo do funil.",
      inputSchema: { incluirFechados: z.boolean().optional() },
    },
    async ({ incluirFechados }) =>
      executar(async () => {
        const repo = await obterRepo();
        const config = await repo.carregarConfig();
        const leads = await repo.listarLeads();
        const nome = (id: string | null) => (id ? (config.pessoas.find((p) => p.id === id)?.nome ?? null) : null);
        const r = resumoFunil(leads);
        return {
          resumo: { ...r, valorEmAberto: paraReais(r.valorEmAbertoCentavos), valorGanhoNoMes: paraReais(r.valorGanhoNoMesCentavos) },
          leads: leads
            .filter((l) => incluirFechados || etapaAberta(l.etapa))
            .map((l) => ({
              id: l.id,
              nome: l.nome,
              etapa: rotuloEtapa(l.etapa),
              diasNaEtapa: diasNaEtapa(l),
              valorEstimadoMensal: paraReais(l.valorEstimadoCentavos),
              pacote: (config.pacotes ?? []).find((p) => p.id === l.pacoteId)?.nome ?? null,
              responsavel: nome(l.responsavelId),
              proximoContato: l.proximoContato,
              proximaAcao: l.proximaAcao,
              contato: [l.contato, l.telefone, l.instagram, l.email].filter(Boolean).join(" · "),
              origem: l.origem,
              observacoes: l.observacoes,
              motivoPerda: l.motivoPerda || null,
            })),
        };
      }),
  );

  server.registerTool(
    "salvar_lead",
    {
      title: "Criar ou editar lead",
      description:
        "Cria um lead (sem id) ou edita (com id). Só os campos enviados mudam. Valor estimado em reais por mês; só grave o que a pessoa disse (ou o preço calculado do pacote). Datas em AAAA-MM-DD.",
      inputSchema: {
        id: z.string().optional().describe("id ou nome do lead"),
        nome: z.string().optional(),
        contato: z.string().optional(),
        telefone: z.string().optional(),
        email: z.string().optional(),
        instagram: z.string().optional(),
        origem: z.string().optional(),
        pacote: z.string().nullable().optional().describe("pacote de interesse (nome ou id)"),
        valorEstimadoReais: opt(z.number(), "valor estimado por mês"),
        responsavel: z.string().nullable().optional().describe("sócio (nome ou id)"),
        proximoContato: z.string().nullable().optional(),
        proximaAcao: z.string().optional(),
        observacoes: z.string().optional(),
      },
    },
    async (e) =>
      executar(async () => {
        const repo = await obterRepo();
        const config = await repo.carregarConfig();
        const leads = await repo.listarLeads();
        const antes = e.id ? resolver(leads.map((l) => ({ ...l })), e.id, "Lead") : null;
        if (!antes && !e.nome) throw new Error("Informe o nome do lead novo.");
        if (e.proximoContato && !/^\d{4}-\d{2}-\d{2}$/.test(e.proximoContato)) throw new Error("Data inválida. Use AAAA-MM-DD.");
        const base = antes ?? novoLead(novoId(), e.nome!);
        const l: Lead = {
          ...base,
          ...(e.nome != null && { nome: e.nome }),
          ...(e.contato != null && { contato: e.contato }),
          ...(e.telefone != null && { telefone: e.telefone }),
          ...(e.email != null && { email: e.email }),
          ...(e.instagram != null && { instagram: e.instagram }),
          ...(e.origem != null && { origem: e.origem }),
          ...(e.pacote !== undefined && { pacoteId: e.pacote ? resolver(config.pacotes ?? [], e.pacote, "Pacote").id : null }),
          ...(e.valorEstimadoReais !== undefined && { valorEstimadoCentavos: paraCentavos(e.valorEstimadoReais) }),
          ...(e.responsavel !== undefined && { responsavelId: e.responsavel ? resolver(config.pessoas, e.responsavel, "Sócio").id : null }),
          ...(e.proximoContato !== undefined && { proximoContato: e.proximoContato }),
          ...(e.proximaAcao != null && { proximaAcao: e.proximaAcao }),
          ...(e.observacoes != null && { observacoes: e.observacoes }),
        };
        await repo.salvarLead(l);
        return { salvo: l.nome, id: l.id, criado: !antes };
      }),
  );

  server.registerTool(
    "mover_lead",
    {
      title: "Mudar a etapa do lead",
      description:
        "lead_recebido, contato_feito, proposta_enviada ou perdido (com motivo). Para GANHO use ganhar_lead, que também cria o cliente.",
      inputSchema: {
        id: z.string().describe("id ou nome do lead"),
        etapa: z.enum(["lead_recebido", "contato_feito", "proposta_enviada", "perdido"]),
        motivoPerda: z.string().optional(),
      },
    },
    async ({ id, etapa, motivoPerda }) =>
      executar(async () => {
        const repo = await obterRepo();
        const l = resolver(await repo.listarLeads(), id, "Lead");
        const novo = { ...moverLead(l, etapa), ...(etapa === "perdido" && { motivoPerda: motivoPerda ?? "" }) };
        await repo.salvarLead(novo);
        return { lead: l.nome, etapa: rotuloEtapa(etapa) };
      }),
  );

  server.registerTool(
    "ganhar_lead",
    {
      title: "Lead fechou: virar cliente",
      description:
        "Marca o lead como ganho e cria o cliente, guardando o escopo a partir da proposta ligada (ou do pacote) com o valor estimado. Abaixo do piso de um sócio, o escopo vira pedido de exceção. Confirme com quem está conversando antes.",
      inputSchema: { id: z.string().describe("id ou nome do lead") },
    },
    async ({ id }) =>
      executar(async () => {
        const repo = await obterRepo();
        const config = await repo.carregarConfig();
        const l = resolver(await repo.listarLeads(), id, "Lead");
        const r = await ganharLead(repo, config, l);
        return {
          cliente: l.nome,
          clienteId: r.clienteId,
          escopo: r.escopo == null ? "sem proposta nem pacote ligado" : r.escopo.gravado ? "guardado" : `esperando aprovação de ${r.escopo.abaixo.map((a) => a.nome).join(" e ")}`,
        };
      }),
  );

  server.registerTool(
    "registrar_conversa_lead",
    {
      title: "Registrar conversa com o lead",
      description: "Anota no histórico do lead o que foi conversado (nota, whatsapp, ligação, reunião, e-mail ou proposta). Opcional: já marca o próximo contato.",
      inputSchema: {
        id: z.string().describe("id ou nome do lead"),
        texto: z.string(),
        tipo: z.enum(["nota", "ligacao", "whatsapp", "reuniao", "email", "proposta"]).optional(),
        proximoContato: z.string().optional().describe("AAAA-MM-DD"),
        proximaAcao: z.string().optional(),
      },
    },
    async ({ id, texto, tipo, proximoContato, proximaAcao }) =>
      executar(async () => {
        const repo = await obterRepo();
        const l = resolver(await repo.listarLeads(), id, "Lead");
        await repo.salvarInteracao({ id: novoId(), leadId: l.id, tipo: tipo ?? "nota", texto, em: new Date().toISOString(), autorNome: "Claude (conector)" });
        if (proximoContato || proximaAcao)
          await repo.salvarLead({ ...l, ...(proximoContato && { proximoContato }), ...(proximaAcao != null && { proximaAcao }) });
        return { registrado: l.nome };
      }),
  );

  // ─── Terceiros, pacotes e metas ───────────────────────────────────────────

  server.registerTool(
    "salvar_terceiro",
    {
      title: "Criar ou alterar terceiro (cobrado por saída)",
      description:
        "Serviço terceirizado cobrado por saída (ex.: Audiovisual: grava e edita). Custo do cliente = saídas × (valor por saída + deslocamento). Nunca rateado. Só grave valores que a pessoa disse. Ligue a um tipo de entrega com salvar_tipo_entrega (terceiro).",
      inputSchema: {
        id: z.string().optional().describe("id ou nome do terceiro a alterar; vazio = novo"),
        nome: z.string().optional(),
        inclui: z.string().optional(),
        fraseCliente: z.string().optional().describe("o que o cliente lê, ex.: gravação e edição mensal inclusa"),
        valorPorSaidaReais: opt(z.number(), "valor por saída em reais"),
        deslocamentoMedioReais: opt(z.number(), "deslocamento médio por saída em reais"),
        ativo: z.boolean().optional(),
      },
    },
    async ({ id, valorPorSaidaReais, deslocamentoMedioReais, ...resto }) =>
      executar(async () => {
        const repo = await obterRepo();
        const antes = await repo.carregarConfig();
        const lista = antes.terceiros ?? [];
        const patch = {
          ...resto,
          ...(valorPorSaidaReais !== undefined ? { valorPorSaidaCentavos: paraCentavos(valorPorSaidaReais) } : {}),
          ...(deslocamentoMedioReais !== undefined ? { deslocamentoMedioCentavos: paraCentavos(deslocamentoMedioReais) } : {}),
        };
        let terceiros;
        if (id) {
          const alvo = resolver(lista, id, "Terceiro");
          terceiros = lista.map((t) => (t.id === alvo.id ? aplicar(t, patch) : t));
        } else {
          if (!resto.nome) throw new Error("Informe o nome do serviço terceirizado.");
          terceiros = [
            ...lista,
            aplicar({ id: novoId(), nome: resto.nome, inclui: "", fraseCliente: "", valorPorSaidaCentavos: null, deslocamentoMedioCentavos: null, ativo: true }, patch),
          ];
        }
        return salvarDiferenca(repo, antes, { ...antes, terceiros });
      }),
  );

  server.registerTool(
    "ver_pacotes",
    {
      title: "Pacotes e preços calculados",
      description:
        "Pacotes fechados da negociação: frases que o cliente lê, entregas (rotina e primeiro mês) e os preços CALCULADOS (manutenção mensal e primeiro mês). Preço nunca é digitado.",
      inputSchema: {},
    },
    async () =>
      executar(async () => {
        const config = await (await obterRepo()).carregarConfig();
        const nome = (id: string) => config.tiposEntrega.find((t) => t.id === id)?.nome ?? id;
        return (config.pacotes ?? []).map((p) => {
          const preco = precoDoPacote(config, p);
          return {
            id: p.id,
            nome: p.nome,
            padrao: p.padrao,
            ativo: p.ativo,
            descricao: p.descricao,
            oQueOClienteLe: frasesParaCliente(config, p, pacoteParaCenario(p)),
            rotinaMensal: p.rotina.map((i) => ({ entrega: nome(i.tipoEntregaId), quantidade: i.quantidade })),
            primeiroMes: p.entrada.map((i) => ({ entrega: nome(i.tipoEntregaId), quantidade: i.quantidade ?? "a confirmar" })),
            manutencaoMensal: paraReais(preco.mensalCentavos),
            primeiroMesValor: preco.entradaAConfirmar ? "a confirmar (faltam quantidades)" : paraReais(preco.entradaCentavos),
            motivoSemPreco: preco.motivo,
          };
        });
      }),
  );

  server.registerTool(
    "salvar_pacote",
    {
      title: "Criar ou alterar pacote",
      description:
        "Pacote fechado para a negociação: nome, descrição para o cliente, frases do que está incluso e as entregas (rotina mensal e primeiro mês). NÃO existe campo de preço: sai do cálculo. Quantidade null = a confirmar. Listas enviadas substituem as antigas.",
      inputSchema: {
        id: z.string().optional().describe("id ou nome do pacote a alterar; vazio = novo"),
        nome: z.string().optional(),
        descricao: z.string().optional(),
        frasesCliente: z.array(z.string()).optional(),
        rotina: z.array(z.object({ entrega: z.string(), quantidade: z.number().nonnegative().nullable() })).optional(),
        primeiroMes: z.array(z.object({ entrega: z.string(), quantidade: z.number().nonnegative().nullable() })).optional(),
        padrao: z.boolean().optional(),
        ativo: z.boolean().optional(),
      },
    },
    async ({ id, nome, descricao, frasesCliente, rotina, primeiroMes, padrao, ativo }) =>
      executar(async () => {
        const repo = await obterRepo();
        const antes = await repo.carregarConfig();
        const lista = antes.pacotes ?? [];
        const itens = (l: { entrega: string; quantidade: number | null }[]) =>
          l.map((i) => ({ tipoEntregaId: resolver(antes.tiposEntrega, i.entrega, "Tipo de entrega").id, quantidade: i.quantidade }));
        const alvo = id ? resolver(lista, id, "Pacote") : null;
        if (!alvo && !nome) throw new Error("Informe o nome do pacote novo.");
        const base: Pacote = alvo ?? { id: novoId(), nome: nome!, descricao: "", itensCliente: [], rotina: [], entrada: [], padrao: lista.length === 0, ativo: true };
        const novo: Pacote = {
          ...base,
          ...(nome != null && { nome }),
          ...(descricao != null && { descricao }),
          ...(frasesCliente && { itensCliente: frasesCliente }),
          ...(rotina && { rotina: itens(rotina) }),
          ...(primeiroMes && { entrada: itens(primeiroMes) }),
          ...(padrao != null && { padrao }),
          ...(ativo != null && { ativo }),
        };
        const pacotes = alvo ? lista.map((p) => (p.id === alvo.id ? novo : novo.padrao ? { ...p, padrao: false } : p)) : [...lista.map((p) => (novo.padrao ? { ...p, padrao: false } : p)), novo];
        await salvarDiferenca(repo, antes, { ...antes, pacotes });
        const preco = precoDoPacote({ ...antes, pacotes }, novo);
        return { salvo: novo.nome, manutencaoMensal: paraReais(preco.mensalCentavos), primeiroMes: preco.entradaAConfirmar ? "a confirmar" : paraReais(preco.entradaCentavos) };
      }),
  );

  server.registerTool(
    "salvar_meta",
    {
      title: "Criar ou alterar degrau da trilha de metas",
      description:
        "Degrau da trilha de crescimento (Visão do mês). SÓ cadastre metas que os sócios definiram na conversa; nunca invente. Critério: faturamento_mensal (alvo em reais), clientes (quantidade), recebido_socio (reais por sócio no mês), uso_capacidade (%). A ordem é a da lista (posicao começa em 1).",
      inputSchema: {
        id: z.string().optional().describe("id ou nome do degrau a alterar; vazio = novo"),
        nome: z.string().optional(),
        criterio: z.enum(["faturamento_mensal", "clientes", "recebido_socio", "uso_capacidade"]).optional(),
        alvo: z.number().positive().optional().describe("reais, quantidade de clientes ou %"),
        acao: z.string().optional().describe("o que fazer ao chegar lá"),
        posicao: z.number().int().positive().optional(),
      },
    },
    async ({ id, nome, criterio, alvo, acao, posicao }) =>
      executar(async () => {
        const repo = await obterRepo();
        const antes = await repo.carregarConfig();
        let lista = [...(antes.metas ?? [])];
        const existente = id ? resolver(lista, id, "Meta") : null;
        if (!existente && !nome) throw new Error("Informe o nome do degrau.");
        const crit = criterio ?? existente?.criterio ?? null;
        const alvoInterno = alvo === undefined ? undefined : crit && unidadeDoCriterio(crit) === "moeda" ? paraCentavos(alvo) : alvo;
        const m: Meta = {
          ...(existente ?? { id: novoId(), nome: nome!, criterio: null, alvo: null, acao: "", conquistadaEm: null }),
          ...(nome != null && { nome }),
          ...(criterio != null && { criterio }),
          ...(alvoInterno !== undefined && { alvo: alvoInterno }),
          ...(acao != null && { acao }),
        };
        lista = lista.filter((x) => x.id !== m.id);
        const pos = posicao != null ? Math.min(posicao - 1, lista.length) : existente ? (antes.metas ?? []).findIndex((x) => x.id === m.id) : lista.length;
        lista.splice(pos, 0, m);
        return salvarDiferenca(repo, antes, { ...antes, metas: lista });
      }),
  );

  server.registerTool(
    "ver_metas",
    {
      title: "Trilha de metas",
      description: "Degraus da trilha de crescimento: valor atual, alvo, progresso, quanto falta, conquistados (com data), o degrau atual e quantos clientes do pacote padrão ainda cabem.",
      inputSchema: {},
    },
    async () =>
      executar(async () => {
        const config = await (await obterRepo()).carregarConfig();
        const visao = calcularVisaoMes(config);
        const t = calcularTrilha(config, visao);
        const fmt = (crit: Meta["criterio"], v: number | null) => (v == null || !crit ? v : unidadeDoCriterio(crit) === "moeda" ? paraReais(v) : Math.round(v * 10) / 10);
        const padrao = pacotePadrao(config);
        const espaco = padrao ? espacoPraVender(config, padrao, visao) : null;
        return {
          degraus: t.degraus.map((d, i) => ({
            posicao: i + 1,
            nome: d.meta.nome,
            criterio: d.meta.criterio,
            alvo: fmt(d.meta.criterio, d.meta.alvo),
            atual: fmt(d.meta.criterio, d.valor),
            falta: fmt(d.meta.criterio, d.falta),
            progressoPct: d.progressoPct == null ? null : Math.round(d.progressoPct),
            conquistada: d.batida,
            conquistadaEm: d.meta.conquistadaEm,
            acao: d.meta.acao,
          })),
          degrauAtual: t.atual == null ? null : t.atual + 1,
          cabemMaisDoPacotePadrao: espaco ? { pacote: espaco.pacote.nome, cabem: espaco.cabem, faltaParaCalcular: espaco.faltando } : "nenhum pacote padrão",
        };
      }),
  );

  // ─── Tarefas ──────────────────────────────────────────────────────────────

  server.registerTool(
    "ver_visao_do_dia",
    {
      title: "Visão do dia",
      description:
        "O que uma pessoa tem para resolver: tarefas de hoje, atrasadas, próximos 7 dias, com o cliente e concluídas hoje; mais aprovações pendentes que dependem dela. Sem 'socio' = de todo mundo. Use para responder 'o que eu tenho pra hoje?'.",
      inputSchema: { socio: z.string().optional().describe("sócio (nome ou id); vazio = todo mundo") },
    },
    async ({ socio }) =>
      executar(async () => {
        const repo = await obterRepo();
        const config = await repo.carregarConfig();
        const pessoaId = socio ? resolver(config.pessoas, socio, "Sócio").id : null;
        const [tarefas, pedidos] = await Promise.all([repo.listarTarefas(), repo.listarPedidos()]);
        const v = montarVisaoDoDia(tarefas, pessoaId, hojeISO());
        const cli = (id: string | null) => (id ? (config.clientes.find((c) => c.id === id)?.nome ?? null) : null);
        const resumo = (l: typeof tarefas) => l.map((t) => ({ id: t.id, titulo: t.titulo, cliente: cli(t.clienteId), vencimento: t.vencimento, status: rotuloStatus(t.status) }));
        return {
          hoje: resumo(v.hoje),
          atrasadas: resumo(v.atrasadas),
          proximos7Dias: resumo(v.semana),
          emAprovacao: resumo(v.emAprovacao),
          emProducaoSemPrazo: resumo(v.emAndamento),
          semResponsavel: resumo(v.semResponsavel),
          concluidasHoje: v.concluidasHoje.length,
          aprovacoesEsperando: pessoaId
            ? pedidos.filter((p) => p.status === "pendente" && p.afetados.includes(pessoaId) && !p.aprovacoes.some((a) => a.pessoaId === pessoaId)).map((p) => p.descricao)
            : pedidos.filter((p) => p.status === "pendente").map((p) => p.descricao),
        };
      }),
  );

  server.registerTool(
    "listar_tarefas",
    {
      title: "Listar tarefas",
      description: "Tarefas com status, cliente, entrega, responsável, prazo, checklist e tempo já medido. Por padrão só as abertas.",
      inputSchema: {
        cliente: z.string().optional().describe("filtrar por cliente (nome ou id)"),
        incluirConcluidas: z.boolean().optional(),
      },
    },
    async ({ cliente, incluirConcluidas }) =>
      executar(async () => {
        const repo = await obterRepo();
        const config = await repo.carregarConfig();
        const [tarefas, medicoes] = await Promise.all([repo.listarTarefas(), repo.listarMedicoes()]);
        const cid = cliente ? resolver(config.clientes, cliente, "Cliente").id : null;
        const nome = <T extends { id: string; nome: string }>(l: T[], id: string | null) => (id ? (l.find((x) => x.id === id)?.nome ?? null) : null);
        return tarefas
          .filter((t) => (incluirConcluidas || t.status !== "concluida") && (!cid || t.clienteId === cid))
          .map((t) => {
            const m = medicaoDaTarefa(t, medicoes);
            const est = estimativaHoras(t, config);
            return {
              id: t.id,
              titulo: t.titulo,
              status: rotuloStatus(t.status),
              cliente: nome(config.clientes, t.clienteId),
              entrega: nome(config.tiposEntrega, t.tipoEntregaId),
              quantidade: t.quantidade,
              responsavel: nome(config.pessoas, t.responsavelId),
              prioridade: t.prioridade,
              inicio: t.inicio,
              vencimento: t.vencimento,
              checklist: t.etapas.map((e) => `${e.feita ? "[x]" : "[ ]"} ${e.titulo}`),
              estimativaMin: est == null ? null : Math.round(est * 60),
              tempoMedidoMin: m ? Math.round(segundosDaMedicao(m) / 60) : 0,
              relogio: m?.estado ?? "nunca ligado",
              ...(t.visivelCliente && {
                noPainelDoCliente: situacaoPeca(t),
                pedidoDoCliente: situacaoPeca(t) === "ajuste" ? t.feedbackCliente : null,
                ajustesPedidos: t.rodadas ?? 0,
              }),
            };
          });
      }),
  );

  server.registerTool(
    "salvar_tarefa",
    {
      title: "Criar ou editar tarefa",
      description:
        "Cria uma tarefa (sem id) ou edita (com id). Só os campos enviados mudam. Datas em AAAA-MM-DD. checklist substitui a lista inteira.",
      inputSchema: {
        id: z.string().optional(),
        titulo: z.string().optional(),
        cliente: z.string().nullable().optional().describe("nome ou id; null tira"),
        entrega: z.string().nullable().optional().describe("tipo de entrega (nome ou id)"),
        quantidade: z.number().int().positive().optional(),
        responsavel: z.string().nullable().optional().describe("sócio (nome ou id)"),
        prioridade: z.enum(["urgente", "alta", "normal", "baixa"]).nullable().optional(),
        inicio: z.string().nullable().optional(),
        vencimento: z.string().nullable().optional(),
        descricao: z.string().optional(),
        checklist: z.array(z.object({ titulo: z.string(), feita: z.boolean().optional() })).optional(),
      },
    },
    async (e) =>
      executar(async () => {
        const repo = await obterRepo();
        const config = await repo.carregarConfig();
        const tarefas = await repo.listarTarefas();
        const antes = e.id ? tarefas.find((t) => t.id === e.id) : null;
        if (e.id && !antes) throw new Error("Tarefa não encontrada.");
        if (!antes && !e.titulo) throw new Error("Informe o título da tarefa nova.");
        const data = (v: string | null | undefined) => {
          if (v == null) return v;
          if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error(`Data inválida: ${v}. Use AAAA-MM-DD.`);
          return v;
        };
        const base = antes ?? novaTarefa(novoId(), e.titulo!);
        const t: Tarefa = {
          ...base,
          ...(e.titulo != null && { titulo: e.titulo }),
          ...(e.cliente !== undefined && { clienteId: e.cliente ? resolver(config.clientes, e.cliente, "Cliente").id : null }),
          ...(e.entrega !== undefined && { tipoEntregaId: e.entrega ? resolver(config.tiposEntrega, e.entrega, "Tipo de entrega").id : null }),
          ...(e.quantidade != null && { quantidade: e.quantidade }),
          ...(e.responsavel !== undefined && { responsavelId: e.responsavel ? resolver(config.pessoas, e.responsavel, "Sócio").id : null }),
          ...(e.prioridade !== undefined && { prioridade: e.prioridade }),
          ...(e.inicio !== undefined && { inicio: data(e.inicio) ?? null }),
          ...(e.vencimento !== undefined && { vencimento: data(e.vencimento) ?? null }),
          ...(e.descricao != null && { descricao: e.descricao }),
          ...(e.checklist && { etapas: e.checklist.map((c) => ({ id: novoId(), titulo: c.titulo, feita: !!c.feita })) }),
        };
        await repo.salvarTarefa(t);
        return { salva: t.titulo, id: t.id, criada: !antes };
      }),
  );

  server.registerTool(
    "mudar_status_tarefa",
    {
      title: "Mudar o status de uma tarefa",
      description: "a_fazer, em_producao, revisao (com o cliente, esperando a aprovação dele) ou concluida. Concluir encerra o tempo medido (conta na calibragem).",
      inputSchema: { id: z.string(), status: z.enum(["a_fazer", "em_producao", "revisao", "concluida"]) },
    },
    async ({ id, status }) =>
      executar(async () => {
        const repo = await obterRepo();
        const [tarefas, medicoes] = await Promise.all([repo.listarTarefas(), repo.listarMedicoes()]);
        const t = tarefas.find((x) => x.id === id);
        if (!t) throw new Error("Tarefa não encontrada.");
        const r = mudarStatus(t, status, medicaoDaTarefa(t, medicoes), new Date());
        await repo.salvarTarefa(r.tarefa);
        if (r.medicao) await repo.salvarMedicao(r.medicao);
        return { tarefa: t.titulo, status: rotuloStatus(status) };
      }),
  );

  // ─── Cronômetro e calibragem ──────────────────────────────────────────────

  server.registerTool(
    "ver_calibragem",
    {
      title: "Calibragem das horas",
      description:
        "Para cada tipo de entrega: tempo cadastrado, média medida pelo cronômetro, quantas medições, se está calibrado e se o sistema sugere atualizar o tempo.",
      inputSchema: {},
    },
    async () =>
      executar(async () => {
        const repo = await obterRepo();
        const config = await repo.carregarConfig();
        return calcularCalibragem(config, await repo.listarMedicoes()).map((c) => ({
          entrega: c.nome,
          situacao: c.situacao,
          medicoes: c.medicoes,
          medicoesPedidas: c.alvo,
          tempoCadastradoMin: c.padraoMinutos == null ? null : Math.round(c.padraoMinutos),
          mediaMedidaMin: c.mediaMinutos == null ? null : Math.round(c.mediaMinutos),
          diferencaPct: c.diferencaPct == null ? null : Math.round(c.diferencaPct),
          sugestao: c.sugestao,
        }));
      }),
  );

  server.registerTool(
    "registrar_medicao",
    {
      title: "Registrar quanto uma entrega levou",
      description: "Guarda uma medição (uma entrega) em minutos, como se fosse o cronômetro. Só registre tempos que a pessoa disse.",
      inputSchema: {
        entrega: z.string().describe("tipo de entrega (nome ou id)"),
        minutos: z.number().positive(),
        cliente: z.string().optional().describe("cliente (nome ou id), se houver"),
        socio: z.string().optional().describe("quem fez (nome ou id)"),
      },
    },
    async ({ entrega, minutos, cliente, socio }) =>
      executar(async () => {
        const repo = await obterRepo();
        const config = await repo.carregarConfig();
        const tipo = resolver(config.tiposEntrega, entrega, "Tipo de entrega");
        const agora = new Date().toISOString();
        const m: Medicao = {
          id: novoId(),
          clienteId: cliente ? resolver(config.clientes, cliente, "Cliente").id : null,
          tipoEntregaId: tipo.id,
          pessoaId: socio ? resolver(config.pessoas.filter((p) => p.socio), socio, "Sócio").id : null,
          estado: "concluido",
          acumuladoSegundos: minutos * 60,
          retomadoEm: null,
          fim: agora,
          criadoEm: agora,
        };
        await repo.salvarMedicao(m);
        const c = calcularCalibragem(config, await repo.listarMedicoes()).find((x) => x.tipoEntregaId === tipo.id);
        return { registrada: `${tipo.nome}: ${minutos} min`, medicoes: c?.medicoes, situacao: c?.situacao, sugestao: c?.sugestao ?? null };
      }),
  );

  server.registerTool(
    "recalibrar_tipo",
    {
      title: "Recalibrar um tipo de entrega",
      description: "Quando o processo mudou: as medições antigas deixam de contar e o cronômetro volta a pedir medições. Confirme antes.",
      inputSchema: { entrega: z.string().describe("tipo de entrega (nome ou id)") },
    },
    async ({ entrega }) =>
      executar(async () => {
        const repo = await obterRepo();
        const antes = await repo.carregarConfig();
        const tipo = resolver(antes.tiposEntrega, entrega, "Tipo de entrega");
        const agora = new Date().toISOString();
        await salvarDiferenca(repo, antes, { ...antes, tiposEntrega: antes.tiposEntrega.map((t) => (t.id === tipo.id ? { ...t, calibrarDesde: agora } : t)) });
        return { recalibrando: tipo.nome, desde: agora };
      }),
  );

  // ─── Pagamentos ───────────────────────────────────────────────────────────

  server.registerTool(
    "registrar_pagamento",
    {
      title: "Registrar pagamento que caiu",
      description:
        "Cada pagamento que cai (inteiro, parcial ou atrasado). competencia = mês de referência que o cliente está pagando; recebidoEm = data em que caiu. Mostra para onde vai cada real. Só registre valores informados na conversa.",
      inputSchema: {
        cliente: z.string().describe("cliente (nome ou id)"),
        valorReais: z.number().positive(),
        competencia: zCompetencia,
        recebidoEm: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .describe("data em que caiu, AAAA-MM-DD (padrão: hoje)"),
        observacao: z.string().optional(),
      },
    },
    async ({ cliente, valorReais, competencia, recebidoEm, observacao }) =>
      executar(async () => {
        const repo = await obterRepo();
        const config = await repo.carregarConfig();
        const alvo = resolver(config.clientes, cliente, "Cliente");
        const mes = competencia ?? competenciaAtual();
        const hoje = new Date().toISOString().slice(0, 10);
        const id = novoId();
        await repo.salvarPagamento({ id, clienteId: alvo.id, competencia: mes, valorCentavos: paraCentavos(valorReais)!, recebidoEm: recebidoEm ?? hoje, observacao: observacao ?? null });
        const d = distribuirPagamentos(config, alvo, mes, await repo.listarPagamentos(), hoje);
        const parte = d.partes.find((x) => x.pagamentoId === id);
        const nome = (pid: string) => config.pessoas.find((p) => p.id === pid)?.nome ?? pid;
        return {
          registrado: `${alvo.nome}: ${valorReais} reais referente a ${mes}`,
          situacaoDoMes: d.situacao,
          faltaReceber: paraReais(d.faltaReceberCentavos),
          distribuicaoBloqueada: d.bloqueio?.texto ?? null,
          paraOndeVai: parte
            ? {
                imposto: paraReais(parte.impostoCentavos),
                taxa: paraReais(parte.taxaCentavos),
                custosDoMes: paraReais(parte.custosCentavos),
                reinvestimento: paraReais(parte.reinvestimentoCentavos),
                socios: Object.fromEntries(Object.entries(parte.socios).map(([k, v]) => [nome(k), paraReais(v)])),
                chegouAtrasado: parte.atrasado,
              }
            : null,
        };
      }),
  );

  server.registerTool(
    "ver_pagamentos_do_mes",
    {
      title: "Pagamentos e repasse do mês",
      description: "Por cliente: contrato, quanto entrou, quanto falta, se está em atraso e para onde foi o dinheiro. Por sócio: quanto já recebeu no mês e quanto falta.",
      inputSchema: { competencia: zCompetencia },
    },
    async ({ competencia }) =>
      executar(async () => {
        const repo = await obterRepo();
        const mes = competencia ?? competenciaAtual();
        const [config, pagamentos] = await Promise.all([repo.carregarConfig(), repo.listarPagamentos()]);
        const hoje = new Date().toISOString().slice(0, 10);
        const dist = config.clientes.filter((c) => c.ativo && !c.interno && clienteNoMes(c, mes)).map((c) => distribuirPagamentos(config, c, mes, pagamentos, hoje));
        return {
          competencia: mes,
          clientes: dist.map((d) => ({
            nome: d.nome,
            contrato: paraReais(d.contratoCentavos),
            entrou: paraReais(d.recebidoCentavos),
            falta: paraReais(d.faltaReceberCentavos),
            situacao: d.situacao,
            bloqueado: d.bloqueio?.texto ?? null,
            pagamentos: pagamentos
              .filter((p) => p.clienteId === d.clienteId && p.competencia === mes)
              .map((p) => ({ id: p.id, valor: paraReais(p.valorCentavos), caiuEm: p.recebidoEm })),
          })),
          socios: repasseDosSocios(config, dist).map((r) => ({
            nome: r.nome,
            jaRecebeu: paraReais(r.recebidoCentavos),
            falta: paraReais(r.faltaCentavos),
            mesCheio: paraReais(r.planejadoCentavos),
          })),
        };
      }),
  );

  server.registerTool(
    "remover_pagamento",
    {
      title: "Remover pagamento lançado errado",
      description: "Apaga um pagamento (a exclusão fica no histórico). Use o id de ver_pagamentos_do_mes. Confirme antes.",
      inputSchema: { id: z.string() },
    },
    async ({ id }) =>
      executar(async () => {
        await (await obterRepo()).removerPagamento(id);
        return { removido: id };
      }),
  );

  server.registerTool(
    "ver_resumo_contador",
    {
      title: "Resumo do mês para o contador",
      description: "Recebimentos do mês (pela data em que caíram) por cliente, custos fixos, imposto fixo do MEI e posição no teto do ano. Sem dados internos dos sócios.",
      inputSchema: { competencia: zCompetencia },
    },
    async ({ competencia }) =>
      executar(async () => {
        const repo = await obterRepo();
        const [config, pagamentos] = await Promise.all([repo.carregarConfig(), repo.listarPagamentos()]);
        const d = documentoContador(config, pagamentos, competencia ?? competenciaAtual());
        return {
          mes: d.mesReferencia,
          recebidoNoMes: paraReais(d.faturamentoCentavos),
          porCliente: d.porCliente.map((c) => ({ cliente: c.cliente, valor: paraReais(c.valorCentavos) })),
          custosFixos: d.custosFixos.map((c) => ({ nome: c.nome, valor: paraReais(c.valorCentavos) })),
          impostoFixo: paraReais(d.impostoFixoCentavos),
          teto: d.teto ? { teto: paraReais(d.teto.tetoCentavos), recebidoNoAno: paraReais(d.teto.acumuladoAnoCentavos), pct: Math.round(d.teto.pct * 10) / 10 } : null,
          pdf: "No site: Dinheiro e mês → Relatórios → Resumo para o contador.",
        };
      }),
  );

  // ─── Aprovações ───────────────────────────────────────────────────────────

  server.registerTool(
    "ver_aprovacoes",
    {
      title: "Pedidos de aprovação e avisos dos sócios",
      description: "Pedidos pendentes e decididos (mudanças protegidas e exceções abaixo do piso), quem precisa aprovar e os últimos avisos. Você não aprova: quem aprova é o sócio afetado, no site.",
      inputSchema: {},
    },
    async () =>
      executar(async () => {
        const repo = await obterRepo();
        const [config, pedidos, avisos] = await Promise.all([repo.carregarConfig(), repo.listarPedidos(), repo.listarAvisos()]);
        const nome = (id: string | null) => config.pessoas.find((p) => p.id === id)?.nome ?? "—";
        return {
          regras: REGRAS_PROTECAO,
          pedidos: pedidos.slice(0, 30).map((p) => ({
            descricao: p.descricao,
            status: p.status,
            pediuQuem: p.autorNome,
            mudancas: p.itens.map(descreverItem),
            perdasPorMes: p.dados?.perdas.map((x) => ({ socio: x.nome, perde: paraReais(x.perdaMensalCentavos) })) ?? [],
            afetados: p.afetados.map((a) => {
              const d = p.aprovacoes.find((x) => x.pessoaId === a);
              return { socio: nome(a), decisao: d?.decisao ?? "falta decidir" };
            }),
            motivo: p.motivo,
            em: p.criadoEm,
          })),
          avisos: avisos.slice(0, 20).map((a) => ({ para: nome(a.pessoaId), titulo: a.titulo, texto: a.texto, lido: !!a.lidoEm, em: a.criadoEm })),
        };
      }),
  );

  // ─── Negociação ───────────────────────────────────────────────────────────

  server.registerTool(
    "montar_pacote_que_cabe",
    {
      title: "Contraproposta: só tenho R$ X",
      description:
        "Parte de um pacote (mesmo formato de calcular_cenario) e tira entregas, uma por vez, até todos os sócios ficarem no piso e dentro das horas no valor informado. Devolve o pacote que cabe.",
      inputSchema: { cenario: zCenarioConversa, valorReais: z.number().positive() },
    },
    async ({ cenario, valorReais }) =>
      executar(async () => {
        const config = await (await obterRepo()).carregarConfig();
        const r = pacoteQueCabe(config, cenarioParaInterno(cenario, config), paraCentavos(valorReais)!);
        return { cabe: r.cabe, tirou: r.tirados.map((t) => `${t.quantidade} ${t.nome}`), pacote: cenarioParaConversa(r.cenario, config) };
      }),
  );

  return server;
}
