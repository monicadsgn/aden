// Ferramentas do conector: financeiro. Movidas de servidor.ts sem mudar nenhuma.

import type { RepositorioSupabase } from "../dados/supabase";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { pacoteQueCabe } from "../calculo/apresentacao";
import { calcularCalibragem } from "../calculo/calibragem";
import type { Medicao } from "../calculo/calibragem";
import { clienteNoMes } from "../calculo/clientes";
import { hojeISO } from "../calculo/dia";
import { documentoContador } from "../calculo/documentos";
import { novoId } from "../calculo/novo";
import { distribuirPagamentos, repasseDosSocios } from "../calculo/pagamentos";
import { calcularMesDeCima, mesQueEstouraOTeto } from "../calculo/sociedade";
import { descreverItem } from "../dados/acoes";
import { competenciaAtual } from "../dados/repositorio";
import { REGRAS_PROTECAO } from "../regras/aprovacao";
import { cenarioParaConversa, cenarioParaInterno, paraCentavos, paraReais, resolver, zCenarioConversa } from "./traducao";
import { z } from "zod";
import { dataDeBrasilia, executar, salvarDiferenca, zCompetencia } from "./comum";

export function registrarFinanceiro(server: McpServer, obterRepo: () => Promise<RepositorioSupabase>) {
  // ─── Cronômetro e calibragem ──────────────────────────────────────────────

  server.registerTool(
    "ver_calibragem",
    {
      title: "Calibragem das horas",
      description:
        "Para cada tipo de entrega: tempo cadastrado, média medida pelo cronômetro (opcional: só existe se alguém mediu), quantas medições e se o sistema sugere atualizar o tempo cadastrado. A média nunca entra sozinha nas contas.",
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
      description: "Quando o processo mudou: as medições antigas deixam de contar na média da Calibragem (o cronômetro continua opcional e não pede nada). Confirme antes.",
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
    "ver_mes_visto_de_cima",
    {
      title: "Mês visto de cima",
      description:
        "O mês inteiro da Aden: o que entrou (pagamentos que caíram no mês), imposto, taxas, custos do caixa, custos bancados do bolso de cada sócio, tráfego próprio, parte de cada sócio pela regra da sociedade (com bônus e quanto falta para a virada), custos planejados que já cabem e em que mês o teto anual do MEI estoura.",
      inputSchema: { competencia: zCompetencia },
    },
    async ({ competencia }) =>
      executar(async () => {
        const repo = await obterRepo();
        const mes = competencia ?? competenciaAtual();
        const [config, pagamentos] = await Promise.all([repo.carregarConfig(), repo.listarPagamentos()]);
        const m = calcularMesDeCima(config, pagamentos, mes);
        const r = (v: number | null) => paraReais(v == null ? null : Math.round(v));
        return {
          mes,
          entrou: r(m.entrouCentavos),
          porCliente: m.porCliente.map((x) => ({ cliente: x.nome, entrou: r(x.centavos) })),
          imposto: r(m.impostoCentavos),
          dasDoMei: r(m.impostoFixoCentavos),
          taxasDeRecebimento: r(m.taxasCentavos),
          custosFixosDoCaixa: r(m.custosFixosCaixaCentavos),
          custosDosClientes: r(m.custosClientesCentavos),
          bancadoPor: m.bancadoPor.map((b) => ({ socio: b.nome, valor: r(b.centavos), itens: b.itens })),
          divisao: m.divisao === "percentual" ? "antes da virada" : m.divisao === "virada" ? "depois da virada" : "regra da sociedade não preenchida",
          socios: m.socios.map((x) => ({ socio: x.nome, parte: r(x.parteCentavos), regra: x.regra, bonus: r(x.bonusCentavos) })),
          trafegoProprio: r(m.trafegoProprioCentavos),
          trafegoMinimo: r(m.trafegoMinimoCentavos),
          completaOTrafego: m.completaTrafego ? { socio: m.completaTrafego.nome, valor: r(m.completaTrafego.centavos) } : null,
          faltaParaAVirada: r(m.faltaParaViradaCentavos),
          custosPlanejados: m.planejados.map((x) => ({ nome: x.nome, valor: r(x.centavos), jaCabe: x.cabe })),
          tetoAnualEstouraEm: mesQueEstouraOTeto(config, pagamentos, hojeISO()),
          avisos: m.alertas.map((a) => a.texto),
        };
      }),
  );

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
        taxaReais: z.number().nonnegative().optional().describe("taxa real deste pagamento (ex.: cartão), em reais. Ausente = taxa padrão da configuração"),
      },
    },
    async ({ cliente, valorReais, competencia, recebidoEm, observacao, taxaReais }) =>
      executar(async () => {
        const repo = await obterRepo();
        const config = await repo.carregarConfig();
        const alvo = resolver(config.clientes, cliente, "Cliente");
        if (alvo.interno) throw new Error(`${alvo.nome} é a própria Aden (cliente interno): não tem mensalidade nem pagamento.`);
        const mes = competencia ?? competenciaAtual();
        const hoje = dataDeBrasilia(new Date().toISOString());
        const id = novoId();
        await repo.salvarPagamento({ id, clienteId: alvo.id, competencia: mes, valorCentavos: paraCentavos(valorReais)!, recebidoEm: recebidoEm ?? hoje, observacao: observacao ?? null, taxaCentavos: taxaReais === undefined ? null : paraCentavos(taxaReais) });
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
                trafegoProprio: paraReais(parte.trafegoProprioCentavos),
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
      title: "Quem está devendo no mês",
      description:
        "Pelo mês de referência (o mês que o cliente está pagando): por cliente, contrato, quanto entrou, quanto falta e se está em atraso. Serve para saber QUEM DEVE. A divisão dos sócios e o caixa contam pelo mês em que o dinheiro entrou: para isso use ver_mes_visto_de_cima (regra de 01/10/2026). Os campos de repasse por sócio daqui são a conta antiga e não valem para a divisão.",
      inputSchema: { competencia: zCompetencia },
    },
    async ({ competencia }) =>
      executar(async () => {
        const repo = await obterRepo();
        const mes = competencia ?? competenciaAtual();
        const [config, pagamentos] = await Promise.all([repo.carregarConfig(), repo.listarPagamentos()]);
        const hoje = dataDeBrasilia(new Date().toISOString());
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
}
