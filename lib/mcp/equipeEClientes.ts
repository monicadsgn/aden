// Ferramentas do conector: equipeEClientes. Movidas de servidor.ts sem mudar nenhuma.

import type { RepositorioSupabase } from "../dados/supabase";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PAPEIS } from "../acesso";
import { contratoVazio, fimDaFidelidade, prazoDoAvisoPrevio } from "../calculo/clientes";
import { rotuloStatus } from "../calculo/tarefas";
import type {  } from "../calculo/tarefas";
import { PAINEL_CLIENTE_ATIVO } from "../recursos";
import { conferirPrazoDaPeca, MENSAGEM_SEM_DIA_DA_POSTAGEM, semDiaDaPostagem } from "../regras/prazoPostagem";
import { barraProducao, faltaParaComecar } from "../regras/prontoParaComecar";
import { paraReais, resolver } from "./traducao";
import { z } from "zod";
import { executar, notaParaConector } from "./comum";

export function registrarEquipeEClientes(server: McpServer, obterRepo: () => Promise<RepositorioSupabase>, origem: string) {
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
        "Cria o convite por e-mail. A pessoa entra em /entrar → 'Primeiro acesso? Criar senha' com esse e-mail. Acessos: colaborador (equipe: todas as tarefas, sem valores), freelancer (só as tarefas dele), contador (só financeiro). Confirme o acesso com quem está conversando. Convidar sócio (admin) só pelo site.",
      inputSchema: { nome: z.string(), email: z.string().email(), acesso: z.enum(["colaborador", "freelancer", "contador"]) },
    },
    async ({ nome, email, acesso }) =>
      executar(async () => {
        await (await obterRepo()).convidar(nome, email, acesso);
        return { convidado: nome, email: email.toLowerCase(), comoEntrar: `${origem}/entrar → "Primeiro acesso? Criar senha"` };
      }),
  );

  // ─── Painel do cliente ────────────────────────────────────────────────────
  // Liga e desliga em lib/recursos.ts; cliente por cliente, só quem tem link do painel.
  if (PAINEL_CLIENTE_ATIVO) {

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
          if (c.interno) throw new Error(`${c.nome} é a própria Aden: não tem painel de cliente.`);
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
          const cli = (await repo.carregarConfig()).clientes.find((c) => c.id === t.clienteId);
          if (cli?.interno) throw new Error(`${cli.nome} é a própria Aden: não tem painel de cliente.`);
          if (!cli?.painelToken) throw new Error(`${cli?.nome ?? "Este cliente"} ainda não tem painel: crie o link na ficha dele (ou com link_painel_cliente) antes de enviar.`);
          if (semDiaDaPostagem(t)) throw new Error(`${MENSAGEM_SEM_DIA_DA_POSTAGEM} Use salvar_tarefa com publicarEm e tente de novo.`);
          await repo.salvarTarefa({ ...conferirPrazoDaPeca(t).tarefa, visivelCliente: true, ...(legenda != null && { legenda }) });
          await repo.enviarParaCliente(t.id);
          return { enviada: t.titulo };
        }),
    );
  }


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
        const [tarefas, pagamentos, leads, contexto, briefing] = await Promise.all([
          repo.listarTarefas(),
          repo.listarPagamentos(),
          repo.listarLeads(),
          repo.listarContexto(c.id),
          repo.listarRespostasBriefing(c.id).catch(() => []),
        ]);
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
          faltaParaComecar: faltaParaComecar(c).map((f) => f.item),
          bloqueadoParaProduzir: barraProducao(c),
          atalhosDoPainel: c.atalhos ?? null,
          contexto: contexto.slice(0, 10).map(notaParaConector),
          contextoTotal: contexto.length,
          // M15: a conversa inicial (briefing) respondida, para o Claude sugerir com base nela
          conversaInicial: briefing.filter((b) => b.resposta?.trim()).map((b) => ({ pergunta: b.perguntaTexto, resposta: b.resposta })),
        };
      }),
  );
}
