// Ferramentas do conector: fechamento. Movidas de servidor.ts sem mudar nenhuma.

import type { RepositorioSupabase } from "../dados/supabase";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { mensagemPedirDados } from "../calculo/contrato";
import { hojeISO } from "../calculo/dia";
import { montarFechamento } from "../calculo/fechamento";
import { novaTarefa } from "../calculo/tarefas";
import { novoId } from "../calculo/novo";
import { montarOnboarding } from "../calculo/onboarding";
import { conferirContratos, contratoDoCliente, enviarContrato } from "../contrato/acoes";
import { chaveAutentique } from "../contrato/autentique";
import { resolver } from "./traducao";
import { z } from "zod";
import { executar, salvarDiferenca } from "./comum";

export function registrarFechamento(server: McpServer, obterRepo: () => Promise<RepositorioSupabase>) {
  // ─── Fechamento do cliente (Fase 5) ─────────────────────────────────────────

  server.registerTool(
    "ver_fechamento",
    {
      title: "Checklist de fechamento do cliente",
      description:
        "Os 7 passos do fechamento, na ordem combinada: onboarding → contrato assinado → cobrança criada (plano no app da InfinitePay) → pasta no Drive → briefing → kickoff → link do painel. Mostra o que foi feito, por quem e quando, e o próximo passo. Sem cliente: todos os fechamentos em andamento.",
      inputSchema: { cliente: z.string().optional().describe("nome ou id; vazio = todos os fechamentos abertos") },
    },
    async ({ cliente }) =>
      executar(async () => {
        const repo = await obterRepo();
        const config = await repo.carregarConfig();
        const alvo = cliente ? [resolver(config.clientes, cliente, "Cliente")] : config.clientes.filter((c) => c.ativo && c.fechamentoIniciadoEm);
        const saida = [];
        for (const c of alvo) {
          if (!c.fechamentoIniciadoEm) {
            saida.push({ cliente: c.nome, fechamento: "sem checklist (cliente anterior ao fechamento); abra com marcar_passo_fechamento" });
            continue;
          }
          const f = montarFechamento(await repo.listarFechamento(c.id), !!c.painelToken);
          if (!cliente && f.completo) continue;
          saida.push({
            cliente: c.nome,
            feitos: `${f.feitos} de ${f.total}`,
            proximo: f.proximo?.rotulo ?? null,
            passos: f.itens.map((i) => ({
              passo: i.passo,
              rotulo: i.rotulo,
              feito: i.feito,
              ...(i.feitoEm && { quem: i.feitoPorNome, quando: i.feitoEm }),
              ...(i.link && { link: i.link }),
              ...(i.data && { data: i.data }),
            })),
          });
        }
        return {
          mensalidadeNoOnboarding: config.empresa.mensalidadeNoOnboarding == null ? "a definir" : config.empresa.mensalidadeNoOnboarding ? "cobra" : "não cobra",
          fechamentos: saida,
        };
      }),
  );

  server.registerTool(
    "marcar_passo_fechamento",
    {
      title: "Marcar passo do fechamento",
      description:
        "Marca (ou desmarca com feito=false) um passo do fechamento do cliente. Quem fez é gravado pelo banco. link (https://) guarda o contrato, o link da cobrança ou a pasta no Drive; data (AAAA-MM-DD) é a do kickoff e cria a tarefa da reunião. O link do painel não se marca aqui: ele se confere pelo link criado (link_painel_cliente). Se o cliente ainda não tinha checklist, abre.",
      inputSchema: {
        cliente: z.string().describe("nome ou id"),
        passo: z.enum(["onboarding", "contrato", "pagamento", "pasta_drive", "briefing", "kickoff"]),
        feito: z.boolean().optional().describe("padrão true"),
        link: z.string().nullable().optional(),
        data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().describe("kickoff: AAAA-MM-DD"),
      },
    },
    async ({ cliente, passo, feito, link, data }) =>
      executar(async () => {
        const repo = await obterRepo();
        const antes = await repo.carregarConfig();
        const c = resolver(antes.clientes, cliente, "Cliente");
        if (link && !/^https:\/\/\S+$/.test(link.trim())) throw new Error("O link precisa ser completo, começando com https://");
        if (!c.fechamentoIniciadoEm) {
          const depois = structuredClone(antes);
          depois.clientes = depois.clientes.map((x) => (x.id === c.id ? { ...x, fechamentoIniciadoEm: new Date().toISOString() } : x));
          await salvarDiferenca(repo, antes, depois);
        }
        const registros = await repo.listarFechamento(c.id);
        const jaTinhaKickoff = !!registros.find((r) => r.passo === "kickoff")?.feitoEm;
        const marcar = feito ?? true;
        await repo.salvarPassoFechamento({ clienteId: c.id, passo, feito: marcar, ...(link !== undefined && { link }), ...(data !== undefined && { data }) });
        let tarefa: string | null = null;
        if (passo === "kickoff" && marcar && data && !jaTinhaKickoff) {
          const eu = await repo.usuarioAtual();
          const t = { ...novaTarefa(novoId(), `Kickoff · ${c.nome}`, { clienteId: c.id, responsavelId: eu?.pessoaId ?? null }), vencimento: data, descricao: "Reunião de início com o cliente (checklist de fechamento)." };
          await repo.salvarTarefa(t);
          tarefa = t.titulo;
        }
        const f = montarFechamento(await repo.listarFechamento(c.id), !!c.painelToken);
        return { cliente: c.nome, passo, feito: marcar, ...(tarefa && { tarefaCriada: tarefa }), feitos: `${f.feitos} de ${f.total}`, proximo: f.proximo?.rotulo ?? null };
      }),
  );

  // ─── Onboarding (Fase 5, passo 5) ─────────────────────────────────────────

  server.registerTool(
    "ver_onboarding",
    {
      title: "Ver o onboarding do cliente",
      description:
        "Mostra o onboarding do cliente montado com o texto dos sócios (Configurações → Onboarding), o pacote, os serviços contratados, a garantia e o contrato, e o que ainda falta preencher. O PDF sai no site: ficha → Comercial → Fechamento → Gerar onboarding. Sem cliente: só o texto guardado.",
      inputSchema: { cliente: z.string().optional().describe("nome ou id") },
    },
    async ({ cliente }) =>
      executar(async () => {
        const repo = await obterRepo();
        const [config, modelo] = await Promise.all([repo.carregarConfig(), repo.obterModeloOnboarding()]);
        if (!cliente) return { modelo };
        const c = resolver(config.clientes, cliente, "Cliente");
        const d = montarOnboarding(config, c.id, modelo, hojeISO());
        return { pronto: d.faltando.length === 0, faltando: d.faltando, secoes: d.secoes, comoGerarPdf: "ficha do cliente → Comercial → Fechamento → Gerar onboarding" };
      }),
  );

  server.registerTool(
    "salvar_modelo_onboarding",
    {
      title: "Salvar o texto do onboarding",
      description:
        "Guarda contato e atendimento do onboarding, a frase da garantia e como funciona cada serviço (servico: nome ou id). Só os campos enviados mudam. NUNCA escreva texto por conta própria: grave só o que os sócios passaram. Títulos e textos das seções se editam no site (Configurações → Onboarding).",
      inputSchema: {
        whatsapp: z.string().nullable().optional(),
        instagram: z.string().nullable().optional(),
        email: z.string().nullable().optional(),
        atendimento: z.string().nullable().optional().describe("dias e horário de atendimento"),
        textoGarantia: z.string().nullable().optional(),
        servicos: z.array(z.object({ servico: z.string(), texto: z.string() })).optional(),
      },
    },
    async ({ servicos, ...campos }) =>
      executar(async () => {
        const repo = await obterRepo();
        const [config, atual] = await Promise.all([repo.carregarConfig(), repo.obterModeloOnboarding()]);
        const textoServico = { ...atual.textoServico };
        for (const s of servicos ?? []) textoServico[resolver(config.servicos, s.servico, "Serviço").id] = s.texto;
        const novo = { ...atual, ...Object.fromEntries(Object.entries(campos).filter(([, v]) => v !== undefined)), textoServico };
        await repo.salvarModeloOnboarding(novo);
        return { salvo: true };
      }),
  );

  // ─── Contrato (Fase 5, passo 3) ───────────────────────────────────────────

  server.registerTool(
    "mensagem_pedir_dados_cliente",
    {
      title: "Mensagem pedindo os dados do contrato",
      description:
        "Mensagem pronta para mandar ao cliente pelo WhatsApp pedindo só o que o contrato precisa: nome completo (ou razão social), CPF ou CNPJ, e-mail e endereço. Quando o cliente responder, grave com salvar_ficha_cliente (razaoSocial, documento, email, endereco, contato) e confira com ver_contrato.",
      inputSchema: { cliente: z.string().describe("nome ou id") },
    },
    async ({ cliente }) =>
      executar(async () => {
        const repo = await obterRepo();
        const config = await repo.carregarConfig();
        const c = resolver(config.clientes, cliente, "Cliente");
        return { cliente: c.nome, mensagem: mensagemPedirDados(c) };
      }),
  );

  server.registerTool(
    "ver_contrato",
    {
      title: "Ver o contrato do cliente",
      description:
        "Mostra o contrato montado com a ficha do cliente e o modelo da Aden (obrigações, disposições e quem assina), o que ainda falta preencher, se a Autentique está ligada e os contratos já enviados com a situação da assinatura. Sem cliente: só o modelo.",
      inputSchema: { cliente: z.string().optional().describe("nome ou id") },
    },
    async ({ cliente }) =>
      executar(async () => {
        const repo = await obterRepo();
        const [config, modelo] = await Promise.all([repo.carregarConfig(), repo.obterModeloContrato()]);
        const autentique = chaveAutentique() ? (process.env.AUTENTIQUE_SANDBOX?.trim() === "1" ? "ligada (modo teste)" : "ligada") : "não ligada (falta a chave na Vercel)";
        if (!cliente) return { autentique, modelo };
        const c = resolver(config.clientes, cliente, "Cliente");
        const doc = await contratoDoCliente(repo, c.id);
        const enviados = await repo.listarContratosAssinatura(c.id);
        return {
          autentique,
          pronto: doc.faltando.length === 0,
          faltando: doc.faltando,
          contrato: doc,
          enviados: enviados.map((x) => ({ situacao: x.situacao, enviadoEm: x.enviadoEm, por: x.enviadoPorNome, assinadoEm: x.assinadoEm, faltam: x.faltam })),
        };
      }),
  );

  server.registerTool(
    "salvar_modelo_contrato",
    {
      title: "Salvar o modelo do contrato",
      description:
        "Guarda o que é igual em todo contrato da Aden: dados da contratada, quem assina pela Aden e o texto de obrigações e disposições gerais (uma cláusula por linha; a numeração é do contrato; linhas \"a)\" viram subitens). Só os campos enviados mudam. NUNCA escreva cláusula por conta própria: grave só o texto que os sócios passaram.",
      inputSchema: {
        contratadaNome: z.string().nullable().optional(),
        contratadaDocumento: z.string().nullable().optional().describe("CNPJ"),
        contratadaEndereco: z.string().nullable().optional(),
        cidade: z.string().nullable().optional().describe("cidade de assinatura, do cabeçalho e do rodapé (ex.: Recife - Pernambuco)"),
        obrigacoes: z.string().nullable().optional(),
        disposicoes: z.string().nullable().optional(),
        signatariosAden: z.array(z.object({ nome: z.string(), email: z.string().email() })).optional().describe("lista completa de quem assina pela Aden"),
      },
    },
    async (e) =>
      executar(async () => {
        const repo = await obterRepo();
        const atual = await repo.obterModeloContrato();
        const novo = { ...atual, ...Object.fromEntries(Object.entries(e).filter(([, v]) => v !== undefined)) };
        await repo.salvarModeloContrato(novo);
        return { salvo: true, modelo: await repo.obterModeloContrato() };
      }),
  );

  server.registerTool(
    "enviar_contrato",
    {
      title: "Enviar o contrato para assinatura",
      description:
        "Monta o PDF do contrato com a ficha e o modelo e manda pela Autentique para o cliente e para quem assina pela Aden (cada um recebe por e-mail). Não envia se faltar algo (use ver_contrato antes) ou se já houver um esperando assinatura (reenviar=true substitui). Confirme com o sócio antes de enviar: o cliente recebe na hora.",
      inputSchema: { cliente: z.string().describe("nome ou id"), reenviar: z.boolean().optional() },
    },
    async ({ cliente, reenviar }) =>
      executar(async () => {
        const repo = await obterRepo();
        const config = await repo.carregarConfig();
        const c = resolver(config.clientes, cliente, "Cliente");
        return await enviarContrato(repo, c.id, { reenviar });
      }),
  );

  server.registerTool(
    "conferir_contrato",
    {
      title: "Conferir a assinatura do contrato",
      description: "Pergunta à Autentique quem já assinou o contrato do cliente. Assinado por todos → marca sozinho o passo \"Contrato assinado\" do fechamento.",
      inputSchema: { cliente: z.string().describe("nome ou id") },
    },
    async ({ cliente }) =>
      executar(async () => {
        const repo = await obterRepo();
        const config = await repo.carregarConfig();
        const c = resolver(config.clientes, cliente, "Cliente");
        const r = await conferirContratos(repo, c.id);
        return r.length ? r : { mensagem: "Nenhum contrato esperando assinatura." };
      }),
  );
}
