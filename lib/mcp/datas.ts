// Ferramentas do conector: datas. Movidas de servidor.ts sem mudar nenhuma.

import type { RepositorioSupabase } from "../dados/supabase";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { datasDoPlanejamento } from "../calculo/datas";
import type { ItemDoPlanejamento } from "../calculo/datas";
import { novoId } from "../calculo/novo";
import type { AtalhosPainel } from "../calculo/tipos";
import { resolver } from "./traducao";
import { z } from "zod";
import { acharData, executar, salvarDiferenca } from "./comum";

export function registrarDatas(server: McpServer, obterRepo: () => Promise<RepositorioSupabase>) {
  // ─── Datas comemorativas (planejamento mensal) ─────────────────────────────

  server.registerTool(
    "datas_do_mes",
    {
      title: "Datas comemorativas do planejamento",
      description:
        "Antes de montar o planejamento mensal de um cliente, chame com o mês (AAAA-MM). Devolve datasDoMes (caem no mês: o post da data entra neste planejamento) e campanhasQueComecam (a data é depois, mas a janela de antecedência desse cliente abre ou já está aberta neste mês: entra ao menos um post de aquecimento). Cada item traz a nota de ideia. Nunca invente data que não veio daqui; se achar que falta alguma, sugira à Moni.",
      inputSchema: {
        mes: z.string().regex(/^\d{4}-\d{2}$/).describe("mês do planejamento, AAAA-MM"),
        cliente: z.string().optional().describe("nome ou id; vazio = todos"),
      },
    },
    async ({ mes, cliente }) =>
      executar(async () => {
        const repo = await obterRepo();
        const config = await repo.carregarConfig();
        const cid = cliente ? resolver(config.clientes, cliente, "Cliente").id : null;
        const { datas, ligacoes } = await repo.listarDatas();
        const r = datasDoPlanejamento(mes, datas, ligacoes, cid);
        const nomeCli = (id: string) => config.clientes.find((c) => c.id === id)?.nome ?? "?";
        const item = (i: ItemDoPlanejamento) => ({
          nome: i.nome,
          data: i.data,
          ...(cid ? {} : { cliente: nomeCli(i.clienteId) }),
          diasAntecedencia: i.diasAntecedencia,
          ...(i.nota && { nota: i.nota }),
          ...(i.janelaAbreEm && { janelaAbreEm: i.janelaAbreEm, situacao: i.situacao }),
        });
        return { mes, ...(cid && { cliente: nomeCli(cid) }), datasDoMes: r.datasDoMes.map(item), campanhasQueComecam: r.campanhasQueComecam.map(item) };
      }),
  );

  server.registerTool(
    "salvar_data_comemorativa",
    {
      title: "Criar ou alterar data comemorativa",
      description:
        "A data em si (nome e dia, do ano certo: Black Friday muda todo ano). Para valer para um cliente, ligue com ligar_data_ao_cliente. ativo=false tira de todos os planejamentos sem apagar. Só grave datas que a Moni ou o Áleff confirmaram.",
      inputSchema: {
        id: z.string().optional().describe("id ou nome da data a alterar; vazio = nova"),
        nome: z.string().optional(),
        data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("AAAA-MM-DD"),
        ativo: z.boolean().optional(),
      },
    },
    async ({ id, nome, data, ativo }) =>
      executar(async () => {
        const repo = await obterRepo();
        const { datas } = await repo.listarDatas();
        const original = id ? acharData(datas, id) : null;
        if (!original && (!nome || !data)) throw new Error("Data nova precisa de nome e data (AAAA-MM-DD).");
        const d = { id: original?.id ?? novoId(), nome: (nome ?? original!.nome).trim(), data: data ?? original!.data, ativo: ativo ?? original?.ativo ?? true };
        await repo.salvarDataComemorativa(d);
        return { salva: `${d.nome} (${d.data})`, id: d.id, criada: !original };
      }),
  );

  server.registerTool(
    "ligar_data_ao_cliente",
    {
      title: "Ligar data comemorativa a um cliente",
      description:
        "Diz que a data vale para o cliente, com os dias de antecedência da campanha dele (cada cliente tem a sua janela) e uma nota de ideia. escondida=true tira do planejamento desse cliente sem apagar; desligar=true tira a ligação. Só grave números que a Moni ou o Áleff disseram.",
      inputSchema: {
        data: z.string().describe("id da data, ou nome (se houver mais de uma com o mesmo nome, use 'Nome AAAA-MM-DD')"),
        cliente: z.string().describe("nome ou id"),
        diasAntecedencia: z.number().int().min(0).nullable().optional().describe("dias antes da data em que a campanha começa; null = só o post do dia"),
        nota: z.string().nullable().optional(),
        escondida: z.boolean().optional(),
        desligar: z.boolean().optional(),
      },
    },
    async ({ data, cliente, diasAntecedencia, nota, escondida, desligar }) =>
      executar(async () => {
        const repo = await obterRepo();
        const config = await repo.carregarConfig();
        const c = resolver(config.clientes, cliente, "Cliente");
        const { datas, ligacoes } = await repo.listarDatas();
        const d = acharData(datas, data);
        const antes = ligacoes.find((l) => l.dataId === d.id && l.clienteId === c.id);
        if (desligar) {
          if (antes) await repo.removerDataDoCliente(antes.id);
          return { data: `${d.nome} (${d.data})`, cliente: c.nome, ligada: false };
        }
        const l = {
          id: antes?.id ?? novoId(),
          dataId: d.id,
          clienteId: c.id,
          diasAntecedencia: diasAntecedencia !== undefined ? diasAntecedencia : (antes?.diasAntecedencia ?? null),
          nota: nota !== undefined ? nota : (antes?.nota ?? null),
          escondida: escondida ?? antes?.escondida ?? false,
        };
        await repo.salvarDataDoCliente(l);
        return { data: `${d.nome} (${d.data})`, cliente: c.nome, diasAntecedencia: l.diasAntecedencia, nota: l.nota, escondida: l.escondida };
      }),
  );

  server.registerTool(
    "ver_datas_comemorativas",
    {
      title: "Ver datas comemorativas cadastradas",
      description: "Todas as datas, com os clientes ligados a cada uma (antecedência, nota, escondida). Use para achar o id antes de alterar.",
      inputSchema: { cliente: z.string().optional().describe("filtrar por cliente (nome ou id)") },
    },
    async ({ cliente }) =>
      executar(async () => {
        const repo = await obterRepo();
        const config = await repo.carregarConfig();
        const cid = cliente ? resolver(config.clientes, cliente, "Cliente").id : null;
        const { datas, ligacoes } = await repo.listarDatas();
        return datas
          .map((d) => ({
            id: d.id,
            nome: d.nome,
            data: d.data,
            ativo: d.ativo,
            clientes: ligacoes
              .filter((l) => l.dataId === d.id && (!cid || l.clienteId === cid))
              .map((l) => ({
                cliente: config.clientes.find((c) => c.id === l.clienteId)?.nome ?? "?",
                diasAntecedencia: l.diasAntecedencia,
                nota: l.nota,
                escondida: l.escondida,
              })),
          }))
          .filter((d) => !cid || d.clientes.length > 0);
      }),
  );

  // ─── Atalhos do painel do cliente ──────────────────────────────────────────

  server.registerTool(
    "atualizar_atalhos_painel",
    {
      title: "Atalhos do painel do cliente",
      description:
        "O que o cliente abre no painel dele: PDF do planejamento do mês (com o texto do botão, ex.: 'Planejamento de outubro'), pasta de fotos no Drive, pasta dos cards de jogo do mês (botão 'Cards de jogo', troca todo mês; não substitui as fotos), pasta da identidade visual e o texto 'O que está incluso' (o que o serviço cobre e o que é extra; quebras de linha são mantidas). Só os campos enviados mudam; texto vazio limpa. Links precisam começar com https://. Todo mês, troque o planejamento e, se o cliente tiver cards de jogo, a pasta JOGOS do mês.",
      inputSchema: {
        cliente: z.string().describe("nome ou id"),
        planejamentoUrl: z.string().optional(),
        planejamentoRotulo: z.string().optional(),
        fotosUrl: z.string().optional(),
        cardsJogoUrl: z.string().optional().describe("pasta JOGOS do mês no Drive (cards de jogo, feed e story). Botão 'Cards de jogo' no painel; troque todo mês. Não substitui as fotos."),
        identidadeUrl: z.string().optional(),
        inclusoTexto: z.string().optional(),
      },
    },
    async ({ cliente, ...campos }) =>
      executar(async () => {
        const repo = await obterRepo();
        const antes = await repo.carregarConfig();
        const c = resolver(antes.clientes, cliente, "Cliente");
        for (const k of ["planejamentoUrl", "fotosUrl", "cardsJogoUrl", "identidadeUrl"] as const) {
          const v = campos[k]?.trim();
          if (v && !/^https:\/\/\S+$/.test(v)) throw new Error(`${k} precisa ser um link completo começando com https://`);
        }
        const atual: AtalhosPainel = c.atalhos ?? { planejamentoUrl: null, planejamentoRotulo: null, fotosUrl: null, cardsJogoUrl: null, identidadeUrl: null, inclusoTexto: null };
        const novo: AtalhosPainel = { ...atual };
        for (const [k, v] of Object.entries(campos) as [keyof AtalhosPainel, string | undefined][]) if (v !== undefined) novo[k] = v.trim() || null;
        const depois = structuredClone(antes);
        depois.clientes = depois.clientes.map((x) => (x.id === c.id ? { ...x, atalhos: novo } : x));
        await salvarDiferenca(repo, antes, depois);
        return { cliente: c.nome, atalhos: novo, painel: c.painelToken ? "já aparece no painel" : "este cliente ainda não tem link do painel" };
      }),
  );
}
