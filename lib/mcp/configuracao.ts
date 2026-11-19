// Ferramentas do conector: configuracao. Movidas de servidor.ts sem mudar nenhuma.

import type { RepositorioSupabase } from "../dados/supabase";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { novoId } from "../calculo/novo";
import { motivoNaoApagar } from "../regras/aprovacao";
import { configParaConversa, paraCentavos, resolver } from "./traducao";
import { z } from "zod";
import { aplicar, executar, opt, salvarDiferenca } from "./comum";

export function registrarConfiguracao(server: McpServer, obterRepo: () => Promise<RepositorioSupabase>) {
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
        // M15: o link do painel e o CPF/CNPJ nunca saem crus
        const SENSIVEIS = new Set(["painel_token", "documento", "endereco", "hash", "codigo_hash"]);
        const limpar = (o: unknown) =>
          o && typeof o === "object" ? Object.fromEntries(Object.entries(o as Record<string, unknown>).map(([k, v]) => [k, SENSIVEIS.has(k) && v ? "(guardado)" : v])) : o;
        return regs.map((r) => ({ quando: r.em, quem: r.autor, acao: r.acao, onde: r.tabela, registro: r.registroId, antes: limpar(r.antes), depois: limpar(r.depois) }));
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
        reinvestimentoPct: opt(z.number().min(0).max(100), "% de reinvestimento"),
        impostoPct: opt(z.number().min(0).max(100), "% de imposto sobre faturamento"),
        impostoFixoMensalReais: opt(z.number().nonnegative(), "imposto fixo por mês em reais (ex.: DAS do MEI); entra no rateio"),
        taxaRecebimentoPct: opt(z.number().min(0).max(100), "% de taxa de recebimento"),
        taxaRecebimentoFixaReais: opt(z.number().nonnegative(), "tarifa fixa por recebimento, em reais"),
        regraRateio: opt(z.enum(["igual", "proporcional"]), "igual entre clientes ou proporcional ao valor"),
        tetoFaturamentoAnualReais: opt(z.number().nonnegative(), "teto anual de faturamento do regime, em reais"),
        avisoTetoPct: opt(z.number().min(0).max(100), "avisar quando a projeção anual chegar a este % do teto"),
        ociosidadePct: opt(z.number().min(0).max(100), "sócio com uso abaixo deste % da capacidade aparece com folga sobrando"),
        arredondamentoPropostaReais: opt(z.number().nonnegative(), "arredondar o valor da proposta para cima, em múltiplos deste valor"),
        regime: opt(z.enum(["mei", "outro"]), "mei = imposto fixo por mês (o imposto em % é ignorado); outro = imposto em %"),
        ordemDistribuicao: opt(
          z.enum(["custo_primeiro", "proporcional"]),
          "como cada pagamento é distribuído: custo_primeiro (paga os custos do mês antes dos sócios) ou proporcional. Só grave o que os sócios decidirem",
        ),
        diferencaSugerirPct: opt(z.number().min(0).max(100), "sugerir novo tempo quando a média medida diferir mais que este %"),
        followUpsMaximo: opt(z.number().int().positive(), "depois de quantos follow-ups do \"vou ver\" o sistema sugere marcar o lead como perdido"),
        avulsoSinalPct: opt(z.number().min(0).max(100), "projeto avulso: % do valor pago no início (o resto na entrega); só grave o que os sócios decidirem"),
        prazoMinimoPedidoDiasUteis: opt(z.number().int().positive(), "prazo mínimo, em dias úteis, de tarefa pedida ao outro sócio (sem prazo entra sozinho; menor só como urgência)"),
        ofertaVerbaIndicadaDeReais: opt(z.number().nonnegative(), "oferta padrão: verba de mídia indicada ao cliente, a partir de (reais)"),
        ofertaVerbaIndicadaAteReais: opt(z.number().nonnegative(), "oferta padrão: verba de mídia indicada, até (reais)"),
        ofertaGestaoDepoisDoResultadoReais: opt(z.number().nonnegative(), "oferta padrão: valor da gestão de tráfego depois do resultado (reais)"),
        ofertaMinimoSocialMaisTrafegoReais: opt(z.number().nonnegative(), "oferta padrão: social media + tráfego abaixo disso mostra um aviso na Proposta (reais)"),
        mensalidadeNoOnboarding: opt(z.boolean(), "o mês do onboarding cobra mensalidade? Só grave o que os sócios decidirem"),
      },
    },
    async ({
      impostoFixoMensalReais,
      taxaRecebimentoFixaReais,
      tetoFaturamentoAnualReais,
      arredondamentoPropostaReais,
      ofertaVerbaIndicadaDeReais,
      ofertaVerbaIndicadaAteReais,
      ofertaGestaoDepoisDoResultadoReais,
      ofertaMinimoSocialMaisTrafegoReais,
      ...p
    }) =>
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
          ofertaVerbaMinCentavos: reais(ofertaVerbaIndicadaDeReais),
          ofertaVerbaMaxCentavos: reais(ofertaVerbaIndicadaAteReais),
          ofertaGestaoAposResultadoCentavos: reais(ofertaGestaoDepoisDoResultadoReais),
          ofertaMinimoSocialTrafegoCentavos: reais(ofertaMinimoSocialMaisTrafegoReais),
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
        percentualPadrao: opt(z.number().min(0).max(100), "% padrão da divisão"),
        pisoHoraReais: opt(z.number().nonnegative(), "piso de valor por hora, em reais"),
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
        divisao: z.record(z.string(), z.number().min(0).max(100).nullable()).optional().describe("sócio (nome ou id) → % das horas"),
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
        "Unidade de esforço da calculadora (ex.: post simples, carrossel, roteiro). Projeto de marca (logo, identidade visual, branding, estrutura visual): projeto=true, com horasDoProjeto (horas totais estimadas, nunca minutos) e prazoDias (dias úteis, vai para o contrato); só grave horas que os sócios disseram. Quem faz: os sócios (padrão, com tempo) ou um terceiro cadastrado (terceiro=nome): aí não conta horas dos sócios e vira custo do cliente pelo valor do terceiro. terceiro=null volta para os sócios.",
      inputSchema: {
        id: z.string().optional().describe("id ou nome do tipo a alterar; vazio = novo"),
        nome: z.string().optional(),
        servico: opt(z.string(), "serviço (nome ou id)"),
        minutosPorUnidade: opt(z.number(), "tempo por entrega, em minutos (campo protegido)"),
        horasPorUnidade: opt(z.number(), "tempo por entrega em horas (prefira minutosPorUnidade)"),
        audiovisual: z.boolean().optional().describe("não use: é definido por 'terceiro'"),
        terceiro: opt(z.string(), "quem faz: terceiro cadastrado (nome ou id), cada unidade = 1 saída; null = os sócios"),
        nomeCliente: opt(z.string(), "como aparece no painel do cliente (ex.: Post, Carrossel); null = o próprio nome"),
        semAprovacaoCliente: z.boolean().optional().describe("true = peça deste tipo não espera aprovação do cliente (ex.: Card de jogo): marcou como agendada, está agendada"),
        projeto: z.boolean().optional().describe("true = projeto de marca: mede em horas totais do projeto e prazo em dias, não em minutos"),
        horasDoProjeto: opt(z.number().positive(), "horas totais estimadas do projeto (só para projeto; campo protegido)"),
        prazoDias: opt(z.number().int().positive(), "prazo de entrega do projeto em dias úteis (só para projeto; vai para o contrato)"),
        ativo: z.boolean().optional(),
      },
    },
    async ({ id, servico, minutosPorUnidade, terceiro, horasDoProjeto, ...resto }) =>
      executar(async () => {
        const repo = await obterRepo();
        const antes = await repo.carregarConfig();
        const patch = {
          ...resto,
          ...(minutosPorUnidade !== undefined ? { horasPorUnidade: minutosPorUnidade == null ? null : minutosPorUnidade / 60 } : {}),
          ...(horasDoProjeto !== undefined ? { horasPorUnidade: horasDoProjeto } : {}),
          ...(servico !== undefined ? { servicoId: servico == null ? null : resolver(antes.servicos, servico, "Serviço").id } : {}),
          // "quem faz": terceiro escolhido = sem horas dos sócios; null = volta para os sócios
          ...(terceiro !== undefined
            ? terceiro == null
              ? { terceiroId: null, audiovisual: false }
              : { terceiroId: resolver(antes.terceiros ?? [], terceiro, "Terceiro").id, audiovisual: true }
            : {}),
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
    "definir_regras_sociedade",
    {
      title: "Definir a regra da sociedade",
      description:
        "Divisão entre os sócios: antes da virada, um sócio recebe um % do que entra (depois do imposto em %); o outro fica com a sobra e escolhe quanto dela vai para o tráfego próprio da Aden. A partir do teto da virada (o que entrou no mês), a sobra é dividida pelo % padrão e o tráfego próprio fica com o mínimo. Os números são PROTEGIDOS: campo vazio vale na hora; mudar valor que existe vira pedido de aprovação (o % do tráfego, só de quem fica com a sobra). Quem é quem não muda depois de escolhido. Só grave o que os sócios decidiram.",
      inputSchema: {
        socioDoPercentual: z.string().optional().describe("sócio que recebe o % antes da virada (nome ou id)"),
        percentualDoSocio: opt(z.number().min(0).max(100), "% do que entra (depois do imposto) para esse sócio"),
        tetoDaViradaReais: opt(z.number().nonnegative(), "o que entrou no mês a partir do qual a divisão vira pelo % padrão (reais)"),
        avisoDeBonusReais: opt(z.number().nonnegative(), "parte do sócio acima deste valor aparece destacada como bônus (reais)"),
        socioDaSobra: z.string().optional().describe("sócio que fica com a sobra antes da virada (nome ou id)"),
        percentualDaSobraParaTrafego: opt(z.number().min(0).max(100), "% da sobra desse sócio que vai para o tráfego próprio"),
        trafegoProprioMinimoReais: opt(z.number().nonnegative(), "mínimo por mês do tráfego próprio da Aden (reais)"),
      },
    },
    async (e) =>
      executar(async () => {
        const repo = await obterRepo();
        const antes = await repo.carregarConfig();
        const reais = (v: number | null | undefined) => (v === undefined ? undefined : paraCentavos(v));
        const patch = {
          socioPercentualId: e.socioDoPercentual ? resolver(antes.pessoas, e.socioDoPercentual, "Sócio").id : undefined,
          sociedadePctSocio: e.percentualDoSocio,
          sociedadeTetoViradaCentavos: reais(e.tetoDaViradaReais),
          sociedadeAvisoBonusCentavos: reais(e.avisoDeBonusReais),
          socioSobraId: e.socioDaSobra ? resolver(antes.pessoas, e.socioDaSobra, "Sócio").id : undefined,
          sociedadeSobraTrafegoPct: e.percentualDaSobraParaTrafego,
          trafegoProprioMinimoCentavos: reais(e.trafegoProprioMinimoReais),
        };
        return salvarDiferenca(repo, antes, { ...antes, empresa: aplicar(antes.empresa, patch) });
      }),
  );

  server.registerTool(
    "salvar_custo_fixo",
    {
      title: "Criar ou alterar custo fixo da empresa",
      description:
        "Custos mensais da empresa (assinaturas, armazenamento, IA…), rateados entre clientes ativos. pagoPor = sócio que paga do próprio bolso (só registro, sem reembolso: conta no preço, mas no mês visto de cima aparece em \"bancado por\" e não sai do caixa). planejado = custo guardado, desligado, que acende aviso quando a sobra do mês cobre.",
      inputSchema: {
        id: z.string().optional().describe("id ou nome do custo a alterar; vazio = novo"),
        nome: z.string().optional(),
        valorMensalReais: opt(z.number().nonnegative(), "valor mensal em reais"),
        ativo: z.boolean().optional(),
        pagoPor: z.string().nullable().optional().describe('sócio que paga do bolso (nome ou id); "Aden" ou null = a Aden paga'),
        planejado: z.boolean().optional().describe("custo planejado (fica desligado até os sócios decidirem ligar)"),
      },
    },
    async ({ id, valorMensalReais, pagoPor, ...resto }) =>
      executar(async () => {
        const repo = await obterRepo();
        const antes = await repo.carregarConfig();
        const pagoPorPessoaId =
          pagoPor === undefined ? undefined : !pagoPor || pagoPor.toLowerCase() === "aden" ? null : resolver(antes.pessoas, pagoPor, "Sócio").id;
        const patch = {
          ...resto,
          ...(resto.planejado ? { ativo: false } : {}),
          ...(pagoPorPessoaId !== undefined ? { pagoPorPessoaId } : {}),
          ...(valorMensalReais !== undefined ? { valorMensalCentavos: paraCentavos(valorMensalReais) } : {}),
        };
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
      description: "Cliente ativo e valor mensal do contrato vigente. interno=true para a própria Aden: sem mensalidade, fora do faturamento, do rateio, da sociedade e do teto do MEI, sem pedido de exceção de piso; tarefas iguais às dos outros; horas (tempo cadastrado das tarefas concluídas) contadas como investidas na Aden.",
      inputSchema: {
        id: z.string().optional().describe("id ou nome do cliente a alterar; vazio = novo"),
        nome: z.string().optional(),
        valorMensalReais: opt(z.number().nonnegative(), "valor mensal em reais"),
        interno: z.boolean().optional(),
        participaRateio: z.boolean().optional(),
        ativo: z.boolean().optional(),
      },
    },
    async ({ id, valorMensalReais, ...resto }) =>
      executar(async () => {
        const repo = await obterRepo();
        const antes = await repo.carregarConfig();
        const patch = {
          ...resto,
          // a própria Aden não divide custo fixo
          ...(resto.interno ? { participaRateio: false } : {}),
          ...(valorMensalReais !== undefined ? { valorMensalCentavos: paraCentavos(valorMensalReais) } : {}),
        };
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
      description:
        "Remove um serviço, tipo de entrega ou custo fixo. Cliente não se apaga por aqui (desative com salvar_cliente, ativo=false). Confirme antes com quem está conversando. Sócio não se apaga; serviço com divisão de horas e tipo de entrega com tempo cadastrado também não (protegidos): para esses, desative com salvar_servico/salvar_tipo_entrega (ativo=false).",
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
          const motivo = motivoNaoApagar(antes, "socio", a.id);
          if (motivo) throw new Error(motivo);
          depois.pessoas = antes.pessoas.filter((p) => p.id !== a.id);
        } else if (tipo === "servico") {
          const a = resolver(antes.servicos, id, "Serviço");
          const motivo = motivoNaoApagar(antes, "servico", a.id);
          if (motivo) throw new Error(motivo);
          depois.servicos = antes.servicos.filter((p) => p.id !== a.id);
        } else if (tipo === "tipo_entrega") {
          const a = resolver(antes.tiposEntrega, id, "Tipo de entrega");
          const motivo = motivoNaoApagar(antes, "tipo_entrega", a.id);
          if (motivo) throw new Error(motivo);
          depois.tiposEntrega = antes.tiposEntrega.filter((p) => p.id !== a.id);
        } else if (tipo === "custo_fixo") {
          const a = resolver(antes.custosFixos, id, "Custo fixo");
          depois.custosFixos = antes.custosFixos.filter((p) => p.id !== a.id);
        } else {
          const a = resolver(antes.clientes, id, "Cliente");
          throw new Error(
            `${a.nome}: cliente não se apaga pelo Claude, porque levaria junto pagamentos, horas, contexto, contratos e fechamentos. Para tirar da lista, desative com salvar_cliente (ativo=false). Apagar de vez é só no site, por um sócio.`,
          );
        }
        return salvarDiferenca(repo, antes, depois);
      }),
  );
}
