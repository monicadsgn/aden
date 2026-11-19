// Ferramentas do conector: briefingEContexto. Movidas de servidor.ts sem mudar nenhuma.

import type { RepositorioSupabase } from "../dados/supabase";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { montarBriefing, servicosDoCliente } from "../calculo/briefing";
import { contratoVazio } from "../calculo/clientes";
import { novoId } from "../calculo/novo";
import { formatarDocumento } from "../formato";
import { resolver } from "./traducao";
import { z } from "zod";
import { executar, notaParaConector, salvarDiferenca } from "./comum";

export function registrarBriefingEContexto(server: McpServer, obterRepo: () => Promise<RepositorioSupabase>) {
  // ─── Briefing do cliente (Fase 5) ──────────────────────────────────────────

  server.registerTool(
    "ver_briefing",
    {
      title: "Briefing do cliente",
      description:
        "O briefing da ficha do cliente, por seção: cada pergunta, a resposta, quem respondeu e quando. O cliente não preenche: o Áleff responde na reunião dele e a Moni completa na dela. Use o id da pergunta em responder_briefing.",
      inputSchema: { cliente: z.string().describe("nome ou id") },
    },
    async ({ cliente }) =>
      executar(async () => {
        const repo = await obterRepo();
        const config = await repo.carregarConfig();
        const c = resolver(config.clientes, cliente, "Cliente");
        const [perguntas, respostas] = await Promise.all([repo.listarPerguntasBriefing(), repo.listarRespostasBriefing(c.id)]);
        const b = montarBriefing(perguntas, respostas, servicosDoCliente(config, c.id));
        return {
          cliente: c.nome,
          respondidas: `${b.respondidas} de ${b.total}`,
          secoes: b.secoes.map((s) => ({
            secao: s.secao,
            perguntas: s.itens.map(({ pergunta: p, resposta: r }) => ({
              id: p.id,
              pergunta: p.pergunta,
              resposta: r?.resposta ?? null,
              ...(r?.resposta && { quem: r.respondidoPorNome, quando: r.respondidoEm }),
            })),
          })),
        };
      }),
  );

  server.registerTool(
    "responder_briefing",
    {
      title: "Responder o briefing do cliente",
      description:
        "Grava respostas do briefing (várias de uma vez). pergunta = id (de ver_briefing) ou o texto exato da pergunta. Resposta vazia apaga. Quem respondeu é gravado pelo banco. Grave só o que a pessoa disse na conversa ou na reunião.",
      inputSchema: {
        cliente: z.string().describe("nome ou id"),
        respostas: z.array(z.object({ pergunta: z.string(), resposta: z.string() })).min(1),
      },
    },
    async ({ cliente, respostas }) =>
      executar(async () => {
        const repo = await obterRepo();
        const config = await repo.carregarConfig();
        const c = resolver(config.clientes, cliente, "Cliente");
        const perguntas = (await repo.listarPerguntasBriefing()).filter((p) => p.ativo);
        const achar = (ref: string) =>
          perguntas.find((p) => p.id === ref.trim()) ?? perguntas.find((p) => p.pergunta.trim().toLowerCase() === ref.trim().toLowerCase());
        const faltam = respostas.filter((r) => !achar(r.pergunta)).map((r) => r.pergunta);
        if (faltam.length) throw new Error(`Pergunta não encontrada: ${faltam.join("; ")}. Veja os ids em ver_briefing.`);
        for (const r of respostas) await repo.responderBriefing(c.id, achar(r.pergunta)!.id, r.resposta);
        const b = montarBriefing(perguntas, await repo.listarRespostasBriefing(c.id), servicosDoCliente(config, c.id));
        return { cliente: c.nome, gravadas: respostas.length, respondidas: `${b.respondidas} de ${b.total}` };
      }),
  );

  server.registerTool(
    "salvar_pergunta_briefing",
    {
      title: "Criar ou alterar pergunta do briefing",
      description:
        "A lista de perguntas do briefing (Configurações → Briefing). O texto é dos sócios: só grave perguntas que a Moni ou o Áleff aprovaram. servico = nome do serviço (vale só para quem contratou); null = todos. ativo=false tira da lista sem apagar respostas.",
      inputSchema: {
        id: z.string().optional().describe("id da pergunta a alterar; vazio = nova"),
        secao: z.string().optional(),
        pergunta: z.string().optional(),
        servico: z.string().nullable().optional(),
        ordem: z.number().int().optional(),
        ativo: z.boolean().optional(),
      },
    },
    async ({ id, secao, pergunta, servico, ordem, ativo }) =>
      executar(async () => {
        const repo = await obterRepo();
        const config = await repo.carregarConfig();
        const todas = await repo.listarPerguntasBriefing();
        const antes = id ? todas.find((p) => p.id === id) : null;
        if (id && !antes) throw new Error("Pergunta não encontrada.");
        if (!antes && (!secao?.trim() || !pergunta?.trim())) throw new Error("Pergunta nova precisa de seção e texto.");
        const p = {
          id: antes?.id ?? novoId(),
          secao: (secao ?? antes!.secao).trim(),
          pergunta: (pergunta ?? antes!.pergunta).trim(),
          ajuda: antes?.ajuda ?? null,
          servicoId: servico !== undefined ? (servico ? resolver(config.servicos, servico, "Serviço").id : null) : (antes?.servicoId ?? null),
          ordem: ordem ?? antes?.ordem ?? Math.max(0, ...todas.map((x) => x.ordem)) + 10,
          ativo: ativo ?? antes?.ativo ?? true,
        };
        await repo.salvarPerguntaBriefing(p);
        return { salva: p.pergunta, id: p.id, secao: p.secao, criada: !antes };
      }),
  );

  // ─── Contexto do cliente (memória, Fase 4) ─────────────────────────────────

  server.registerTool(
    "ver_contexto_cliente",
    {
      title: "Contexto do cliente",
      description:
        "Memória do cliente: decisões, preferências, pendências e notas, com quem anotou e quando. Leia antes de falar de um cliente. Por padrão só as ativas; resolvidas=true traz também as resolvidas.",
      inputSchema: {
        cliente: z.string().describe("nome ou id"),
        tipo: z.enum(["decisao", "preferencia", "pendencia", "nota"]).optional().describe("filtra por tipo"),
        resolvidas: z.boolean().optional(),
      },
    },
    async ({ cliente, tipo, resolvidas }) =>
      executar(async () => {
        const repo = await obterRepo();
        const c = resolver((await repo.carregarConfig()).clientes, cliente, "Cliente");
        const notas = (await repo.listarContexto(c.id, resolvidas === true)).filter((n) => !tipo || n.tipo === tipo);
        return { cliente: c.nome, notas: notas.map(notaParaConector) };
      }),
  );

  server.registerTool(
    "anotar_contexto_cliente",
    {
      title: "Anotar no contexto do cliente",
      description:
        "Guarda uma anotação na memória do cliente. tipo: decisao (algo decidido), preferencia (como o cliente gosta), pendencia (algo esperando alguém), nota (o resto). Quem anotou é gravado pelo banco. Confirme o texto com quem está conversando antes de gravar.",
      inputSchema: {
        cliente: z.string().describe("nome ou id"),
        tipo: z.enum(["decisao", "preferencia", "pendencia", "nota"]),
        texto: z.string().min(1),
      },
    },
    async ({ cliente, tipo, texto }) =>
      executar(async () => {
        const repo = await obterRepo();
        const c = resolver((await repo.carregarConfig()).clientes, cliente, "Cliente");
        const nota = await repo.anotarContexto({ clienteId: c.id, tipo, texto });
        return { cliente: c.nome, anotado: notaParaConector(nota) };
      }),
  );

  server.registerTool(
    "resolver_nota_contexto",
    {
      title: "Marcar anotação como resolvida",
      description:
        "Tira a anotação da lista principal sem apagar (fica no histórico e aparece com resolvidas=true). reabrir=true volta ela para a lista. Use o id que vem de ver_contexto_cliente.",
      inputSchema: { id: z.string(), reabrir: z.boolean().optional() },
    },
    async ({ id, reabrir }) =>
      executar(async () => {
        const repo = await obterRepo();
        await repo.resolverContexto(id, reabrir !== true);
        return { ok: true, situacao: reabrir ? "ativa de novo" : "resolvida" };
      }),
  );

  server.registerTool(
    "salvar_ficha_cliente",
    {
      title: "Editar a ficha e o contrato do cliente",
      description:
        "Muda dados de contato, os dados do contrato (nome no contrato, CPF/CNPJ, endereço) e as condições do contrato de um cliente existente. Cliente novo, do zero: salvar_cliente (nome e valor mensal) → salvar_ficha_cliente (contato e contrato) → definir_escopo_cliente (pacote ou escopo) → ver_contrato (o que falta). Para pedir os dados ao cliente: mensagem_pedir_dados_cliente. CPF/CNPJ é gravado com ponto, barra e traço. Só os campos enviados mudam. Só grave o que foi combinado de verdade. Datas em AAAA-MM-DD.",
      inputSchema: {
        cliente: z.string().describe("nome ou id"),
        contato: z.string().optional(),
        telefone: z.string().optional(),
        email: z.string().optional(),
        instagram: z.string().optional(),
        segmento: z.string().optional(),
        observacoes: z.string().optional(),
        razaoSocial: z.string().optional().describe("nome no contrato (razão social ou nome completo); vazio = o nome do cliente"),
        documento: z.string().optional().describe("CPF ou CNPJ do cliente, vai no contrato"),
        endereco: z.string().optional().describe("endereço do cliente, vai no contrato"),
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
        venceUltimoDiaUtil: z.boolean().optional().describe("vence no último dia útil do mês (no lugar do dia do pagamento)"),
        limiteReunioesMes: z.number().int().nonnegative().nullable().optional().describe("máximo de reuniões por mês combinado no contrato"),
        garantiaResultado: z.string().optional().describe("tráfego com garantia: o que conta como resultado"),
        garantiaAte: z.string().nullable().optional().describe("tráfego com garantia: até quando vale, AAAA-MM-DD"),
      },
    },
    async (e) =>
      executar(async () => {
        const repo = await obterRepo();
        const config = await repo.carregarConfig();
        const c = resolver(config.clientes, e.cliente, "Cliente");
        for (const d of [e.clienteDesde, e.inicioContrato, e.fimContrato, e.garantiaAte]) if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error(`Data inválida: ${d}. Use AAAA-MM-DD.`);
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
          razaoSocial: def(e.razaoSocial, c.razaoSocial),
          documento: e.documento === undefined ? c.documento : formatarDocumento(e.documento),
          endereco: def(e.endereco, c.endereco),
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
            venceUltimoDiaUtil: def(e.venceUltimoDiaUtil, k.venceUltimoDiaUtil ?? false),
            limiteReunioesMes: def(e.limiteReunioesMes, k.limiteReunioesMes ?? null),
            garantiaResultado: def(e.garantiaResultado, k.garantiaResultado ?? ""),
            garantiaAte: def(e.garantiaAte, k.garantiaAte ?? null),
          },
        };
        return salvarDiferenca(repo, config, { ...config, clientes: config.clientes.map((x) => (x.id === c.id ? novo : x)) });
      }),
  );
}
