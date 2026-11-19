// Ferramentas do conector: tarefas. Movidas de servidor.ts sem mudar nenhuma.

import type { RepositorioSupabase } from "../dados/supabase";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { segundosDaMedicao } from "../calculo/calibragem";
import type {  } from "../calculo/crm";
import { avisosDePublicacao, hojeISO, montarVisaoDoDia } from "../calculo/dia";
import { novoId } from "../calculo/novo";
import { ONDE_APROVACAO_PADRAO, ROTULO_PECA, erroAgendarSemAprovacao, estimativaHoras, etapaDaTela, irParaEtapa, medicaoDaTarefa, mudarStatus, novaTarefa, publicar, rotuloStatus, situacaoPeca } from "../calculo/tarefas";
import type { Tarefa } from "../calculo/tarefas";
import { conferirPrazoDoPedido } from "../regras/prazoPedido";
import { MENSAGEM_SEM_DIA_DA_POSTAGEM, conferirPrazoDaPeca, semDiaDaPostagem, vesperaDaPostagem } from "../regras/prazoPostagem";
import { barraProducao, mensagemNaoPodeComecar } from "../regras/prontoParaComecar";
import { COMO_ATUALIZAR, NOVIDADES, VERSAO_FERRAMENTAS } from "./novidades";
import { resolver } from "./traducao";
import { z } from "zod";
import { dataDeBrasilia, dataHoraBrasilia, executar, passaDe } from "./comum";

export function registrarTarefas(server: McpServer, obterRepo: () => Promise<RepositorioSupabase>) {
  // ─── Tarefas ──────────────────────────────────────────────────────────────

  server.registerTool(
    "ver_avisos",
    {
      title: "Avisos do sócio",
      description:
        "Os avisos que o Aden mandou para o sócio dono deste código (tarefa pedida pelo outro sócio, mudança protegida aprovada ou esperando, quanto muda no bolso). Por padrão só os não lidos. Use no começo do chat para contar o que chegou de novo.",
      inputSchema: { todos: z.boolean().optional().describe("true = inclui os já lidos (até 30)") },
    },
    async ({ todos }) =>
      executar(async () => {
        const repo = await obterRepo();
        const [eu, avisos] = await Promise.all([repo.usuarioAtual(), repo.listarAvisos()]);
        const meus = avisos.filter((x) => !eu?.pessoaId || x.pessoaId === eu.pessoaId).filter((x) => todos || !x.lidoEm);
        return meus.slice(0, 30).map((x) => ({ titulo: x.titulo, texto: x.texto, de: x.autorNome, quando: x.criadoEm, lido: !!x.lidoEm }));
      }),
  );

  server.registerTool(
    "marcar_aviso_lido",
    {
      title: "Marcar aviso como lido",
      description: "Marca um aviso do sócio como lido (id vem de ver_avisos). Sem id, marca todos os não lidos deste sócio.",
      inputSchema: { id: z.string().optional() },
    },
    async ({ id }) =>
      executar(async () => {
        const repo = await obterRepo();
        const [eu, avisos] = await Promise.all([repo.usuarioAtual(), repo.listarAvisos()]);
        const meus = avisos.filter((x) => !x.lidoEm && (!eu?.pessoaId || x.pessoaId === eu.pessoaId)).filter((x) => !id || x.id === id);
        if (id && !meus.length) throw new Error("Aviso não encontrado entre os seus não lidos.");
        for (const a of meus) await repo.marcarAvisoLido(a.id);
        return { marcados: meus.length };
      }),
  );

  server.registerTool(
    "cancelar_pedido",
    {
      title: "Cancelar um pedido que você fez",
      description: "Cancela um pedido de aprovação que ainda está pendente (id vem de ver_aprovacoes). Só o pedido de quem está usando o conector. Não aprova nem recusa nada.",
      inputSchema: { id: z.string() },
    },
    async ({ id }) =>
      executar(async () => {
        const repo = await obterRepo();
        const pedidos = await repo.listarPedidos();
        const p = pedidos.find((x) => x.id === id);
        if (!p) throw new Error("Pedido não encontrado.");
        if (p.status !== "pendente") throw new Error("Só dá para cancelar pedido pendente.");
        await repo.cancelarPedido(id);
        return { cancelado: p.descricao };
      }),
  );

  server.registerTool(
    "ver_historico_lead",
    {
      title: "Histórico de conversas do lead",
      description: "As conversas e follow-ups já registrados de um lead, da mais nova para a mais antiga. Para registrar uma nova, use registrar_conversa_lead.",
      inputSchema: { lead: z.string().describe("id ou nome do lead") },
    },
    async ({ lead }) =>
      executar(async () => {
        const repo = await obterRepo();
        const l = resolver(await repo.listarLeads(), lead, "Lead");
        const itens = await repo.listarInteracoes(l.id);
        return {
          lead: l.nome,
          conversas: [...itens].sort((a, b) => b.em.localeCompare(a.em)).map((i) => ({ tipo: i.tipo, texto: i.texto, quando: i.em, quem: i.autorNome })),
        };
      }),
  );

  server.registerTool(
    "ver_agenda",
    {
      title: "Eventos do Google Agenda",
      description: "Os eventos das agendas ligadas ao Aden (as agendas que cada pessoa conectou), de uma data a outra. Só leitura.",
      inputSchema: { de: z.string().describe("AAAA-MM-DD"), ate: z.string().describe("AAAA-MM-DD") },
    },
    async ({ de, ate }) =>
      executar(async () => {
        const repo = await obterRepo();
        const r = await repo.eventosAgenda(de, ate);
        return { eventos: r.eventos.map((e) => ({ titulo: e.titulo, inicio: e.inicio, fim: e.fim, diaInteiro: e.diaInteiro, local: e.local, agenda: e.agenda })), avisos: r.erros };
      }),
  );

  server.registerTool(
    "remover_tarefa",
    {
      title: "Apagar uma tarefa",
      description: "Apaga de vez uma tarefa (e o tempo medido nela). Confirme com quem está conversando antes. Para só encerrar, use concluir_tarefa.",
      inputSchema: { id: z.string().describe("id da tarefa") },
    },
    async ({ id }) =>
      executar(async () => {
        const repo = await obterRepo();
        const t = (await repo.listarTarefas()).find((x) => x.id === id);
        if (!t) throw new Error("Tarefa não encontrada. Use o id de listar_tarefas.");
        await repo.removerTarefa(id);
        return { apagada: t.titulo };
      }),
  );

  server.registerTool(
    "quem_sou_eu",
    {
      title: "Quem está usando o conector",
      description:
        "Diz de qual sócio é o código deste conector (quem está conversando com você): nome e papel, e a versão das ferramentas com o que mudou. Use no começo do chat para saber quem é \"eu\" (ex.: \"o que eu tenho pra fazer?\" → ver_visao_do_dia com este nome) e quem é o outro sócio. Se a versão for mais nova do que a que você conhece nesta conversa, diga ao sócio o que mudou e como atualizar o conector.",
      inputSchema: {},
    },
    async () =>
      executar(async () => {
        const repo = await obterRepo();
        const [eu, config] = await Promise.all([repo.usuarioAtual(), repo.carregarConfig()]);
        if (!eu) throw new Error("Não deu para saber de quem é este código.");
        const nome = eu.nome.replace(/\s*\(pelo Claude\)$/, "");
        const socios = config.pessoas.filter((p) => p.socio && p.ativo);
        const pessoa = socios.find((p) => p.id === eu.pessoaId);
        return {
          voce: pessoa?.nome ?? nome,
          papel: eu.papel === "admin" ? "sócio" : eu.papel,
          outrosSocios: socios.filter((p) => p.id !== eu.pessoaId).map((p) => p.nome),
          versaoFerramentas: VERSAO_FERRAMENTAS,
          novidades: NOVIDADES.slice(0, 3),
          comoAtualizar: COMO_ATUALIZAR,
        };
      }),
  );

  server.registerTool(
    "ver_visao_do_dia",
    {
      title: "Visão do dia",
      description:
        "O que tem para resolver hoje: tarefas de hoje e atrasadas, próximos 7 dias, sem prazo, com o cliente, o que vai ao ar hoje e as aprovações que dependem do sócio. Sem 'socio' = de todo mundo. Use para \"o que eu tenho pra hoje?\".",
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
        const resumo = (l: typeof tarefas) =>
          l.map((t) => ({ id: t.id, titulo: t.titulo, cliente: cli(t.clienteId), vencimento: t.vencimento, status: rotuloStatus(t.status), ...(t.pedidaPorNome ? { pedidaPor: t.pedidaPorNome } : {}) }));
        return {
          hoje: resumo(v.hoje),
          atrasadas: resumo(v.atrasadas),
          proximos7Dias: resumo(v.semana),
          emAprovacao: resumo(v.emAprovacao),
          semPrazo: resumo(v.emAndamento),
          semResponsavel: resumo(v.semResponsavel),
          concluidasHoje: v.concluidasHoje.length,
          publicacao: (() => {
            const p = avisosDePublicacao(tarefas, (id) => config.clientes.find((c) => c.id === id)?.contrato?.prazoAprovacaoDias ?? null, pessoaId, hojeISO());
            return {
              vaiAoArHoje: p.irAoAr.filter((x) => !x.atrasada).map((x) => ({ ...resumo([x.t])[0], vaiAoArEm: x.t.publicarEm })),
              passouDoDiaSemPublicar: p.irAoAr.filter((x) => x.atrasada).map((x) => ({ ...resumo([x.t])[0], eraPara: x.t.publicarEm })),
              clienteNaoAprovouNoPrazo: p.aprovacaoVencida.map((x) => ({ ...resumo([x.t])[0], prazoEra: x.ate })),
            };
          })(),
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
      description: "Lista as tarefas (só as abertas, a menos que peça as concluídas) com cliente, responsável, prazo e, nas peças, a etapa.",
      inputSchema: {
        cliente: z.string().optional().describe("só deste cliente (nome ou id)"),
        responsavel: z.string().optional().describe("só deste sócio (nome ou id)"),
        etapa: z
          .enum(["a_fazer", "em_producao", "revisao", "agendada", "concluida"])
          .optional()
          .describe("só desta etapa (agendada = peça já programada)"),
        lote: z.string().optional().describe("só deste calendário do planejamento (ex.: Calendário Outubro — Olinda)"),
        incluirConcluidas: z.boolean().optional(),
      },
    },
    async ({ cliente, responsavel, etapa, lote, incluirConcluidas }) =>
      executar(async () => {
        const repo = await obterRepo();
        const config = await repo.carregarConfig();
        const [tarefas, medicoes] = await Promise.all([repo.listarTarefas(), repo.listarMedicoes()]);
        const cid = cliente ? resolver(config.clientes, cliente, "Cliente").id : null;
        const rid = responsavel ? resolver(config.pessoas, responsavel, "Sócio").id : null;
        const nome = <T extends { id: string; nome: string }>(l: T[], id: string | null) => (id ? (l.find((x) => x.id === id)?.nome ?? null) : null);
        return tarefas
          .filter(
            (t) =>
              (incluirConcluidas || etapa === "concluida" || t.status !== "concluida") &&
              (!cid || t.clienteId === cid) &&
              (!rid || t.responsavelId === rid) &&
              (!etapa || etapaDaTela(t, passaDe(config, t)) === etapa) &&
              (!lote || (t.lote ?? "").toLowerCase() === lote.trim().toLowerCase()),
          )
          .map((t) => {
            const m = medicaoDaTarefa(t, medicoes);
            const est = estimativaHoras(t, config);
            const passa = passaDe(config, t);
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
              // M15: o que está escrito na tarefa e o que o cliente já respondeu, para o Claude sugerir com base nisso
              ...(t.descricao?.trim() && { descricao: t.descricao.trim().slice(0, 4000) }),
              ...(t.legenda?.trim() && { legenda: t.legenda.trim().slice(0, 600) }),
              ...(t.textoArte?.trim() && { textoDaArte: t.textoArte.trim().slice(0, 300) }),
              ...((t.respostasCliente?.length ?? 0) > 0 && {
                respostasDoCliente: t.respostasCliente!.slice(-3).map((r) => ({ decisao: r.decisao === "aprovar" ? "aprovou" : "pediu ajuste", texto: r.texto, em: r.em })),
              }),
              ...(t.rede && { rede: t.rede }),
              ...(t.lote && { lote: t.lote }),
              ...(t.pedidaPorNome && { pedidaPor: t.pedidaPorNome }),
              estimativaMin: est == null ? null : Math.round(est * 60),
              tempoMedidoMin: m ? Math.round(segundosDaMedicao(m) / 60) : 0,
              relogio: m?.estado ?? "nunca ligado",
              ...((t.visivelCliente || t.publicarEm || t.publicadaEm || t.agendadaEm) && {
                etapaDaPeca: ROTULO_PECA[situacaoPeca(t, passa)],
                vaiAoArEm: t.publicarEm ?? null,
                publicadaEm: t.publicadaEm ?? null,
              }),
              ...(t.aprovadaForaOnde && { aprovadaForaDoPainel: `${t.aprovadaForaOnde} (registrado por ${t.aprovadaForaPor ?? "um sócio"})` }),
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
        "Cria uma tarefa (sem id) ou edita (com id). Só os campos enviados mudam. Datas em AAAA-MM-DD. Pedido ao outro sócio: prazo mínimo em dias úteis, menor só como urgência (pergunte antes). Peça de conteúdo: legenda, textoArte, publicarEm.",
      inputSchema: {
        id: z.string().optional(),
        titulo: z.string().optional(),
        cliente: z.string().nullable().optional().describe("nome ou id; null tira"),
        entrega: z.string().nullable().optional().describe("tipo de entrega (nome ou id)"),
        quantidade: z.number().int().positive().optional(),
        responsavel: z.string().nullable().optional().describe("sócio (nome ou id)"),
        prioridade: z
          .enum(["urgente", "alta", "normal", "baixa"])
          .nullable()
          .optional()
          .describe("urgente = selo urgente; é a única forma de pedir ao outro sócio com prazo menor que o mínimo (confirme antes)"),
        inicio: z.string().nullable().optional(),
        vencimento: z.string().nullable().optional(),
        descricao: z.string().optional(),
        checklist: z.array(z.object({ titulo: z.string(), feita: z.boolean().optional() })).optional().describe("troca a lista inteira"),
        legenda: z.string().optional().describe("texto que vai junto com a peça (legenda do post)"),
        textoArte: z.string().optional().describe("o que vai escrito dentro da arte (o cliente lê antes da legenda)"),
        agendada: z
          .boolean()
          .optional()
          .describe("true = o post já foi programado (o mesmo que marcar_agendada); false desfaz"),
        publicarEm: z.string().nullable().optional().describe("quando a peça vai ao ar: AAAA-MM-DD HH:MM (horário de Brasília); null tira"),
        rede: z.string().nullable().optional().describe("rede onde vai sair (ex.: instagram); interno, o cliente não vê"),
        lote: z.string().nullable().optional().describe("calendário que agrupa as peças (ex.: Calendário Outubro — Olinda); interno"),
        mostrarAoCliente: z.boolean().optional().describe("true = aparece no painel do cliente (planejada entra em 'Vem por aí'); false esconde"),
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
          ...(e.legenda != null && { legenda: e.legenda }),
          ...(e.textoArte != null && { textoArte: e.textoArte }),
          ...(e.agendada != null && { agendadaEm: e.agendada ? (base.agendadaEm ?? new Date().toISOString()) : null }),
          ...(e.publicarEm !== undefined && { publicarEm: dataHoraBrasilia(e.publicarEm) }),
          ...(e.rede !== undefined && { rede: e.rede?.trim() || null }),
          ...(e.lote !== undefined && { lote: e.lote?.trim() || null }),
          ...(e.mostrarAoCliente != null && { visivelCliente: e.mostrarAoCliente }),
        };
        // cliente novo (nascido do fechamento de lead) só começa a produzir com o essencial da ficha preenchido
        const clienteDaTarefa = t.clienteId ? config.clientes.find((c) => c.id === t.clienteId) : null;
        if (!antes && clienteDaTarefa && barraProducao(clienteDaTarefa)) throw new Error(mensagemNaoPodeComecar(clienteDaTarefa));
        // "agendada": peça de cliente; se a aprovação passa pelo painel, só depois de aprovada (nada muda em silêncio)
        if (e.agendada && !t.clienteId) throw new Error("Só peça de cliente pode ser agendada: informe o cliente da tarefa.");
        const semAprovar = erroAgendarSemAprovacao(base, e.agendada, passaDe(config, t));
        if (semAprovar) throw new Error(semAprovar);
        // peça com dia de postagem: o prazo da tarefa é 1 dia antes dele (vazio ou no dia da postagem vira a véspera)
        const peca = conferirPrazoDaPeca(t);
        // pedido ao outro sócio: prazo mínimo em dias úteis (sem prazo entra sozinho; menor só como urgência)
        const eu = await repo.usuarioAtual();
        const prazo = conferirPrazoDoPedido({ config, antes, depois: peca.tarefa, eu: eu?.pessoaId, hoje: dataDeBrasilia(new Date().toISOString()) });
        if (prazo.pedeUrgencia)
          throw new Error(
            `Pedido ao outro sócio tem prazo mínimo de ${prazo.dias} dias úteis (a partir de ${prazo.minimo}). Prazo menor só como urgência: confirme com quem pediu se é urgente e mande de novo com prioridade "urgente", ou use ${prazo.minimo} ou depois.`,
          );
        await repo.salvarTarefa(prazo.tarefa);
        return {
          salva: t.titulo,
          id: t.id,
          criada: !antes,
          ...(prazo.minimo && { prazo: prazo.tarefa.vencimento, prazoMinimo: prazo.preencheu ? `entrou sozinho: ${prazo.dias} dias úteis a partir do pedido` : undefined }),
          ...(prazo.minimo && prazo.tarefa.prioridade === "urgente" && { urgente: true }),
          ...(peca.ajuste && {
            prazoDaPeca: prazo.tarefa.vencimento,
            prazoAjustado: peca.ajuste === "preencheu" ? "entrou sozinho: 1 dia antes da postagem" : `era ${peca.prazoAnterior} (dia da postagem ou depois): passou para 1 dia antes da postagem`,
          }),
          ...(semDiaDaPostagem(t) && { aviso: `Peça de calendário sem o dia da postagem. ${MENSAGEM_SEM_DIA_DA_POSTAGEM} Pergunte o dia e mande publicarEm.` }),
        };
      }),
  );

  server.registerTool(
    "importar_planejamento_mensal",
    {
      title: "Importar o planejamento mensal",
      description:
        "Cria de uma vez as peças de um planejamento já fechado com o cliente, na etapa planejado (o cliente vê em 'Vem por aí'). 'tipo' é o nome do tipo de entrega do Aden. Se uma peça tiver erro, nenhuma é gravada.",
      inputSchema: {
        cliente: z.string().describe("nome ou id"),
        lote: z.string().describe("nome curto do calendário, ex.: Calendário Outubro — Olinda"),
        pecas: z
          .array(
            z.object({
              titulo: z.string().min(1).describe("tema do post (referência interna)"),
              tipo: z.string().describe("tipo de entrega do Aden (nome ou id)"),
              textoArte: z.string().optional().describe("o que vai escrito dentro da arte"),
              legenda: z.string().optional(),
              rede: z.string().optional().describe("ex.: instagram (interno)"),
              publicarEm: z.string().describe("OBRIGATÓRIO: o dia em que a peça vai ao ar, AAAA-MM-DD ou AAAA-MM-DD HH:MM (horário de Brasília); só a data = meio-dia. O prazo da tarefa fica 1 dia antes."),
            }),
          )
          .min(1),
      },
    },
    async ({ cliente, lote, pecas }) =>
      executar(async () => {
        const repo = await obterRepo();
        const config = await repo.carregarConfig();
        const c = resolver(config.clientes, cliente, "Cliente");
        const eu = await repo.usuarioAtual();
        const tipos = config.tiposEntrega.filter((t) => t.ativo);
        const erros: string[] = [];
        const novas: Tarefa[] = pecas.map((p, i) => {
          let tipoId: string | null = null;
          try {
            tipoId = resolver(tipos, p.tipo, "Tipo de entrega").id;
          } catch {
            erros.push(`peça ${i + 1} (${p.titulo}): tipo "${p.tipo}" não existe`);
          }
          let publicarEm: string | null = null;
          if (!p.publicarEm?.trim()) {
            erros.push(`peça ${i + 1} (${p.titulo}): falta o dia da postagem (publicarEm)`);
          } else {
            const v = /^\d{4}-\d{2}-\d{2}$/.test(p.publicarEm.trim()) ? `${p.publicarEm.trim()} 12:00` : p.publicarEm;
            try {
              publicarEm = dataHoraBrasilia(v);
            } catch {
              erros.push(`peça ${i + 1} (${p.titulo}): data "${p.publicarEm}" inválida (AAAA-MM-DD ou AAAA-MM-DD HH:MM)`);
            }
          }
          const t = novaTarefa(novoId(), p.titulo.trim(), { clienteId: c.id, responsavelId: eu?.pessoaId ?? null });
          return {
            ...t,
            tipoEntregaId: tipoId,
            textoArte: p.textoArte ?? "",
            legenda: p.legenda ?? "",
            rede: p.rede?.trim() || null,
            lote: lote.trim(),
            publicarEm,
            // prazo da tarefa: 1 dia antes da postagem (a arte tem que estar pronta e aprovada antes de ir ao ar)
            vencimento: publicarEm ? vesperaDaPostagem(publicarEm) : null,
            visivelCliente: true,
          };
        });
        if (erros.length)
          throw new Error(`Nada foi gravado. Corrija: ${erros.join("; ")}. Tipos que existem: ${tipos.map((t) => t.nome).join(", ")}.`);
        await repo.salvarTarefas(novas);
        return {
          cliente: c.nome,
          lote: lote.trim(),
          criadas: novas.length,
          pecas: novas.map((t) => ({ id: t.id, titulo: t.titulo, vaiAoArEm: t.publicarEm, prazo: t.vencimento, etapa: ROTULO_PECA[situacaoPeca(t, passaDe(config, t))] })),
          painelDoCliente: c.painelToken ? "aparecem em 'Vem por aí'" : "este cliente ainda não tem link do painel",
        };
      }),
  );

  server.registerTool(
    "registrar_aprovacao_fora_do_painel",
    {
      title: "Registrar que o cliente aprovou fora do painel",
      description:
        'O cliente aprovou fora do painel (ex.: no grupo do WhatsApp): as peças vão direto para agendada (ou aprovada, com agendar=false), sem avisar o cliente. Aceita várias de uma vez; cada peça volta com a etapa nova ou o motivo de não ter mudado. Confirme antes com quem está conversando.',
      inputSchema: {
        ids: z.array(z.string()).min(1).describe("ids das peças (de listar_tarefas)"),
        onde: z.string().optional().describe(`onde o cliente aprovou; padrão "${ONDE_APROVACAO_PADRAO}"`),
        agendar: z.boolean().optional().describe("padrão true: aprova e agenda (precisa da data de ir ao ar); false = só aprovada"),
      },
    },
    async ({ ids, onde, agendar }) =>
      executar(async () => {
        const repo = await obterRepo();
        const r = await repo.registrarAprovacaoFora(ids, onde?.trim() || ONDE_APROVACAO_PADRAO, agendar ?? true);
        const mudaram = r.filter((x) => x.mudou);
        const naoMudaram = r.filter((x) => !x.mudou);
        if (mudaram.length === 0) throw new Error(`Nenhuma peça mudou. ${naoMudaram.map((x) => `${x.titulo ?? x.id}: ${x.motivo}`).join(" ")}`);
        return {
          mudaram: mudaram.map((x) => ({ peca: x.titulo, etapa: x.etapa })),
          ...(naoMudaram.length > 0 && { naoMudaram: naoMudaram.map((x) => ({ peca: x.titulo ?? x.id, motivo: x.motivo })) }),
          clienteAvisado: false,
        };
      }),
  );

  server.registerTool(
    "marcar_publicada",
    {
      title: "Marcar peça como publicada",
      description: "A peça foi ao ar: fica publicada e a tarefa é concluída. publicada=false desfaz.",
      inputSchema: { id: z.string(), publicada: z.boolean().optional().describe("padrão true") },
    },
    async ({ id, publicada }) =>
      executar(async () => {
        const repo = await obterRepo();
        const [tarefas, medicoes, config] = await Promise.all([repo.listarTarefas(), repo.listarMedicoes(), repo.carregarConfig()]);
        const t = tarefas.find((x) => x.id === id);
        if (!t) throw new Error("Tarefa não encontrada.");
        const r = publicar(t, medicaoDaTarefa(t, medicoes), new Date(), publicada ?? true);
        await repo.salvarTarefa(r.tarefa);
        if (r.medicao) await repo.salvarMedicao(r.medicao);
        return { tarefa: t.titulo, etapa: ROTULO_PECA[situacaoPeca(r.tarefa, passaDe(config, r.tarefa))] };
      }),
  );

  server.registerTool(
    "marcar_agendada",
    {
      title: "Marcar peça como agendada",
      description:
        "O post já está programado (ainda não foi ao ar). Aceita várias peças de uma vez. agendada=false desfaz. Cliente que aprova pelo painel só agenda depois de aprovar; se aprovou fora do painel, use registrar_aprovacao_fora_do_painel.",
      inputSchema: {
        ids: z.array(z.string()).min(1).describe("ids das peças (de listar_tarefas)"),
        agendada: z.boolean().optional().describe("padrão true; false desfaz o agendamento"),
      },
    },
    async ({ ids, agendada }) =>
      executar(async () => {
        const repo = await obterRepo();
        const [tarefas, medicoes, config] = await Promise.all([repo.listarTarefas(), repo.listarMedicoes(), repo.carregarConfig()]);
        const mudaram: { peca: string; etapa: string }[] = [];
        const naoMudaram: { peca: string; motivo: string }[] = [];
        for (const id of ids) {
          const t = tarefas.find((x) => x.id === id);
          if (!t) {
            naoMudaram.push({ peca: id, motivo: "Tarefa não encontrada." });
            continue;
          }
          try {
            const r =
              agendada === false
                ? { tarefa: { ...t, agendadaEm: null }, medicao: null }
                : irParaEtapa(t, "agendada", medicaoDaTarefa(t, medicoes), new Date(), passaDe(config, t));
            await repo.salvarTarefa(r.tarefa);
            if (r.medicao) await repo.salvarMedicao(r.medicao);
            mudaram.push({ peca: t.titulo, etapa: ROTULO_PECA[situacaoPeca(r.tarefa, passaDe(config, r.tarefa))] });
          } catch (e) {
            naoMudaram.push({ peca: t.titulo, motivo: e instanceof Error ? e.message : String(e) });
          }
        }
        if (mudaram.length === 0) throw new Error(`Nenhuma peça mudou. ${naoMudaram.map((x) => `${x.peca}: ${x.motivo}`).join(" ")}`);
        return { mudaram, ...(naoMudaram.length > 0 && { naoMudaram }) };
      }),
  );

  server.registerTool(
    "concluir_tarefa",
    {
      title: "Concluir tarefa",
      description: "Marca a tarefa como concluída (reabrir = mudar_status_tarefa com em_producao). Se alguém estava medindo o tempo, o relógio para.",
      inputSchema: { id: z.string() },
    },
    async ({ id }) =>
      executar(async () => {
        const repo = await obterRepo();
        const [tarefas, medicoes] = await Promise.all([repo.listarTarefas(), repo.listarMedicoes()]);
        const t = tarefas.find((x) => x.id === id);
        if (!t) throw new Error("Tarefa não encontrada.");
        const r = mudarStatus(t, "concluida", medicaoDaTarefa(t, medicoes), new Date());
        await repo.salvarTarefa(r.tarefa);
        if (r.medicao) await repo.salvarMedicao(r.medicao);
        return { tarefa: t.titulo, status: rotuloStatus("concluida") };
      }),
  );

  server.registerTool(
    "mudar_status_tarefa",
    {
      title: "Mudar o status de uma tarefa",
      description:
        "a_fazer, em_producao, revisao (com o cliente, esperando a aprovação dele), agendada (peça já programada) ou concluida. Sair de agendada desfaz o agendamento.",
      inputSchema: { id: z.string(), status: z.enum(["a_fazer", "em_producao", "revisao", "agendada", "concluida"]) },
    },
    async ({ id, status }) =>
      executar(async () => {
        const repo = await obterRepo();
        const [tarefas, medicoes, config] = await Promise.all([repo.listarTarefas(), repo.listarMedicoes(), repo.carregarConfig()]);
        const t = tarefas.find((x) => x.id === id);
        if (!t) throw new Error("Tarefa não encontrada.");
        const r = irParaEtapa(t, status, medicaoDaTarefa(t, medicoes), new Date(), passaDe(config, t));
        await repo.salvarTarefa(r.tarefa);
        if (r.medicao) await repo.salvarMedicao(r.medicao);
        return { tarefa: t.titulo, status: status === "agendada" ? "Agendada" : rotuloStatus(status) };
      }),
  );
}
