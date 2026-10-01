// Servidor MCP da Aden: dá ao Claude (projeto no claude.ai) o mesmo acesso que
// um sócio tem no site. Ele entra com um usuário próprio ("Claude (conector)"),
// então as permissões do banco (RLS) valem. Com o código pessoal do sócio (Fase 4),
// tudo o que ele alterar aparece no Histórico no nome do sócio, "pelo Claude".

import "server-only";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { pacoteQueCabe } from "../calculo/apresentacao";
import { calcularCalibragem, segundosDaMedicao, type Medicao } from "../calculo/calibragem";
import { documentoContador } from "../calculo/documentos";
import { calcularSaudeCliente, calcularVisaoMes, horasInvestidasNaAden, rotuloOrigemHoras } from "../calculo/mes";
import { calcularCenario } from "../calculo/motor";
import { novoId } from "../calculo/novo";
import { distribuirPagamentos, repasseDosSocios, somaPagamentos } from "../calculo/pagamentos";
import { calcularMesDeCima, mesQueEstouraOTeto } from "../calculo/sociedade";
import { calcularSolucoes } from "../calculo/solucoes";
import { clienteNoMes, contratoVazio, fimDaFidelidade, prazoDoAvisoPrevio } from "../calculo/clientes";
import { diasNaEtapa, etapaAberta, moverLead, novoLead, resumoFunil, rotuloEtapa, situacaoFollowUp, type Lead } from "../calculo/crm";
import { PAPEIS } from "../acesso";
import { avisosDePublicacao, hojeISO, montarVisaoDoDia } from "../calculo/dia";
import { calcularTrilha, espacoPraVender, unidadeDoCriterio } from "../calculo/metas";
import { frasesParaCliente, pacoteParaCenario, pacotePadrao, parcelasDoProjeto, prazoDoProjeto, precoDoPacote, projetosQueCabem, textoParcelas } from "../calculo/pacotes";
import { ROTULO_PECA, estimativaHoras, medicaoDaTarefa, mudarStatus, novaTarefa, publicar, rotuloStatus, situacaoPeca, type Tarefa } from "../calculo/tarefas";
import type { AtalhosPainel, Configuracao, Meta, Pacote } from "../calculo/tipos";
import { datasDoPlanejamento, type DataComemorativa, type ItemDoPlanejamento } from "../calculo/datas";
import { montarFechamento } from "../calculo/fechamento";
import { montarBriefing, servicosDoCliente } from "../calculo/briefing";
import { montarOnboarding } from "../calculo/onboarding";
import { mensagemPedirDados } from "../calculo/contrato";
import { conferirContratos, contratoDoCliente, enviarContrato } from "../contrato/acoes";
import { formatarDocumento } from "../formato";
import { chaveAutentique } from "../contrato/autentique";
import { descreverItem, ganharLead, guardarEscopo } from "../dados/acoes";
import { competenciaAtual, diferenca, temAlteracoes, type AlteracoesConfig, type NotaContexto, type TipoContexto } from "../dados/repositorio";
import { motivoNaoApagar, REGRAS_PROTECAO } from "../regras/aprovacao";
import { conferirPrazoDoPedido } from "../regras/prazoPedido";
import { COMO_ATUALIZAR, NOVIDADES, VERSAO_FERRAMENTAS } from "./novidades";
import { PAINEL_CLIENTE_ATIVO } from "../recursos";
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
  Você age em nome do sócio dono do código do conector (o Histórico mostra "Nome (pelo Claude)"). Mudança em piso, % dos sócios,
  divisão de horas, tempo por entrega ou números da sociedade que só afeta esse sócio vale na hora, igual no site; se afeta o
  outro sócio, vira pedido de aprovação para ele (campo vazio pode ser preenchido direto). Diga isso a quem está conversando.
  Pelo endereço antigo (sem código pessoal) você não é sócio: toda mudança protegida vira pedido.
  Você nunca aprova pedidos; quem aprova é o sócio, no site (Sócios → Pedidos e avisos).
- Contexto do cliente (memória): antes de falar de um cliente, leia ver_contexto_cliente. Quando surgir uma decisão, preferência,
  pendência ou algo que valha lembrar, ofereça anotar com anotar_contexto_cliente (quem anotou fica guardado). Nada se apaga:
  o que não vale mais é marcado com resolver_nota_contexto e sai da lista principal. Só os sócios veem.
- Escopo abaixo do piso de um sócio não é gravado direto: vira pedido de exceção para ele aprovar.
- Sociedade (decidida em 29/09/2026): antes da virada, um sócio recebe um % do que entra (depois do imposto em %)
  e o outro fica com a sobra, escolhendo quanto dela vai para o tráfego próprio da Aden; da virada para cima, a sobra
  é dividida pelo % padrão e o tráfego fica com o mínimo. Os números estão em definir_regras_sociedade e são protegidos.
  "Como está o mês?" → ver_mes_visto_de_cima (entrou, custos, bancado por cada sócio, tráfego próprio, parte de cada um).
- Custos pagos do bolso de um sócio: salvar_custo_fixo com pagoPor (só registro, sem reembolso).
- Tráfego com garantia: modelo "garantia" (a gestão só é cobrada depois do resultado). Antes de oferecer, confirme se o
  comercial do cliente está estruturado (salvar_lead comercialEstruturado). O resultado e o prazo vão no contrato.
- WhatsApp continua com o nome Alfall (número do Áleff): não troque essas referências para Aden.
- Pagamentos: registrar_pagamento (cada um que cai, com mês de referência e data; taxaReais só quando foi cartão). ver_pagamentos_do_mes mostra para
  onde foi cada real e quanto cada sócio já recebeu. Se a ordem de distribuição estiver vazia, a distribuição fica bloqueada.
- Equipe: ver_equipe e convidar_pessoa (cada papel vê só o que é dele; o banco garante).
- Aprovação de conteúdo pelo cliente: pelo painel do cliente do Aden (link criado na ficha; só quem tem link vê peças).
  enviar_para_cliente_aprovar manda a peça; tarefa em status revisao = "com o cliente", esperando a aprovação dele.
- Clientes: ver_cliente (ficha completa) e salvar_ficha_cliente (contato e condições do contrato).
- Leads: listar_leads, salvar_lead, mover_lead, registrar_conversa_lead; quando fechar, ganhar_lead (cria o cliente).
- O Aden é a central da agência (tarefas, calendário, comercial, financeiro, metas). "O que tenho pra hoje?" → ver_visao_do_dia.
- Tarefas: listar_tarefas, salvar_tarefa (cria ou edita: cliente, tipo de entrega, quantidade, responsável, prazo, checklist)
  e mudar_status_tarefa. As horas vêm do TEMPO CADASTRADO de cada tipo de entrega. O cronômetro é OPCIONAL
  (botão "Medir o tempo" dentro da tarefa no site), nunca liga sozinho e o sistema não pede medições: serve só para
  quando ninguém sabe quanto uma entrega leva. Você não liga relógio; pode registrar um tempo que a pessoa disse com
  registrar_medicao. ver_calibragem mostra a média medida, que nunca entra sozinha nas contas.
  Tarefa pedida ao outro sócio tem prazo mínimo em dias úteis (configuração): sem prazo, entra sozinho; menor só como urgência (pergunte, e se for, prioridade "urgente").
- Projetos de marca (logo, identidade visual, branding) levam dias ou semanas e não se medem em minutos: nunca invente
  um tempo em minutos para eles; pergunte aos sócios.
- Peças de conteúdo são tarefas: legenda e publicarEm (salvar_tarefa) dão a etapa planejado → produção → esperando
  aprovação → aprovada → agendada → publicada (marcar_publicada, que conclui a tarefa).
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

/** "AAAA-MM-DD HH:MM" no horário de Brasília → ISO. null tira a data. */
/** "AAAA-MM-DD" (dia em Brasília) de um instante ISO. */
export function dataDeBrasilia(iso: string): string {
  return new Date(new Date(iso).getTime() - 3 * 3600000).toISOString().slice(0, 10);
}

export function dataHoraBrasilia(v: string | null): string | null {
  if (v == null) return null;
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})$/.exec(v.trim());
  if (!m) throw new Error(`Data e hora inválidas: ${v}. Use AAAA-MM-DD HH:MM.`);
  return new Date(`${m[1]}T${m[2]}:00-03:00`).toISOString();
}

/** acha a data pelo id, pelo nome (se só houver uma) ou por "Nome AAAA-MM-DD" */
function acharData(datas: DataComemorativa[], ref: string): DataComemorativa {
  const r = ref.trim().toLowerCase();
  const porId = datas.find((d) => d.id === ref.trim());
  if (porId) return porId;
  const exata = datas.filter((d) => `${d.nome} ${d.data}`.toLowerCase() === r);
  if (exata.length === 1) return exata[0];
  const porNome = datas.filter((d) => d.nome.toLowerCase() === r);
  if (porNome.length === 1) return porNome[0];
  if (porNome.length > 1) throw new Error(`Há mais de uma "${ref}": use o id ou "Nome AAAA-MM-DD" (${porNome.map((d) => d.data).join(", ")}).`);
  throw new Error(`Data comemorativa não encontrada: ${ref}. Cadastre com salvar_data_comemorativa.`);
}

const ROTULO_CONTEXTO: Record<TipoContexto, string> = { decisao: "decisão", preferencia: "preferência", pendencia: "pendência", nota: "nota" };

function notaParaConector(n: NotaContexto) {
  return {
    id: n.id,
    tipo: ROTULO_CONTEXTO[n.tipo],
    texto: n.texto,
    quem: n.autorNome,
    quando: n.criadoEm,
    ...(n.resolvidoEm ? { resolvida: { em: n.resolvidoEm, por: n.resolvidoPorNome } } : {}),
  };
}

export function criarServidorMcp(obterRepo: () => Promise<RepositorioSupabase>, origem = ""): McpServer {
  const server = new McpServer({ name: "aden", version: VERSAO_FERRAMENTAS }, { instructions: INSTRUCOES });

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
        diferencaSugerirPct: opt(z.number(), "sugerir novo tempo quando a média medida diferir mais que este %"),
        followUpsMaximo: opt(z.number().int().positive(), "depois de quantos follow-ups do \"vou ver\" o sistema sugere marcar o lead como perdido"),
        avulsoSinalPct: opt(z.number().min(0).max(100), "projeto avulso: % do valor pago no início (o resto na entrega); só grave o que os sócios decidirem"),
        prazoMinimoPedidoDiasUteis: opt(z.number().int().positive(), "prazo mínimo, em dias úteis, de tarefa pedida ao outro sócio (sem prazo entra sozinho; menor só como urgência)"),
        ofertaVerbaIndicadaDeReais: opt(z.number(), "oferta padrão: verba de mídia indicada ao cliente, a partir de (reais)"),
        ofertaVerbaIndicadaAteReais: opt(z.number(), "oferta padrão: verba de mídia indicada, até (reais)"),
        ofertaGestaoDepoisDoResultadoReais: opt(z.number(), "oferta padrão: valor da gestão de tráfego depois do resultado (reais)"),
        ofertaMinimoSocialMaisTrafegoReais: opt(z.number(), "oferta padrão: social media + tráfego abaixo disso mostra um aviso na Proposta (reais)"),
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
        tetoDaViradaReais: opt(z.number(), "o que entrou no mês a partir do qual a divisão vira pelo % padrão (reais)"),
        avisoDeBonusReais: opt(z.number(), "parte do sócio acima deste valor aparece destacada como bônus (reais)"),
        socioDaSobra: z.string().optional().describe("sócio que fica com a sobra antes da virada (nome ou id)"),
        percentualDaSobraParaTrafego: opt(z.number().min(0).max(100), "% da sobra desse sócio que vai para o tráfego próprio"),
        trafegoProprioMinimoReais: opt(z.number(), "mínimo por mês do tráfego próprio da Aden (reais)"),
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
        valorMensalReais: opt(z.number(), "valor mensal em reais"),
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
        "Remove um serviço, tipo de entrega, custo fixo ou cliente. Confirme antes com quem está conversando. Sócio não se apaga; serviço com divisão de horas e tipo de entrega com tempo cadastrado também não (protegidos): para esses, desative com salvar_servico/salvar_tipo_entrega (ativo=false).",
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
          depois.clientes = antes.clientes.filter((p) => p.id !== a.id);
        }
        return salvarDiferenca(repo, antes, depois);
      }),
  );

  // ─── Mês inteiro e saúde dos clientes ─────────────────────────────────────

  server.registerTool(
    "ver_visao_do_mes",
    {
      title: "Mês: resumo e capacidade",
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
        "Guarda o escopo contratado de um cliente ativo (entregas, custos, tráfego…), no mesmo formato de calcular_cenario, e o valor como mensalidade do contrato. Atalho: pacote (nome ou id, ver_pacotes) usa as entregas do pacote e mantém o valor mensal já combinado do cliente, igual à ficha. Se algum sócio ficar abaixo do piso, NÃO grava: vira pedido de exceção para o sócio afetado aprovar. Confirme antes de substituir um escopo existente.",
      inputSchema: {
        cliente: z.string().describe("cliente (nome ou id)"),
        cenario: zCenarioConversa.nullable().optional().describe("escopo; null remove"),
        pacote: z.string().optional().describe("no lugar do cenario: nome ou id do pacote"),
      },
    },
    async ({ cliente, cenario, pacote }) =>
      executar(async () => {
        const repo = await obterRepo();
        const config = await repo.carregarConfig();
        const alvo = resolver(config.clientes, cliente, "Cliente");
        if (pacote) {
          const pk = resolver(config.pacotes ?? [], pacote, "Pacote");
          if (pk.avulso) throw new Error(`${pk.nome} é projeto avulso (pago uma vez): não vira entregas do contrato mensal. Para fechar o projeto, use salvar_lead com o pacote e ganhar_lead.`);
          const base = pacoteParaCenario(pk);
          const cen = alvo.valorMensalCentavos ? { ...base, modo: "valor" as const, mensalidadeCentavos: alvo.valorMensalCentavos } : base;
          const r = await guardarEscopo(repo, config, alvo.id, { ...cen, clienteId: alvo.id });
          return {
            cliente: alvo.nome,
            pacote: pk.nome,
            valorMensal: paraReais(r.valorCentavos),
            gravado: r.gravado || r.pedido?.status === "aplicado",
            situacao: r.gravado ? "Escopo do pacote guardado." : `Ficou abaixo do piso de ${r.abaixo.map((x) => x.nome).join(" e ")}: pedido de exceção esperando aprovação no site.`,
          };
        }
        if (cenario === undefined) throw new Error("Mande o cenario ou o pacote.");
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
      title: "Mês: cada cliente (saúde)",
      description:
        "Para cada cliente pagante ativo: previsto (escopo + contrato) × realizado (horas corrigidas à mão ou, sem correção, entregas do contrato × tempo cadastrado; o cronômetro é opcional e não entra na conta; valor dos pagamentos), valor por hora de cada sócio contra o piso, de onde vem cada número de horas e, quando há problema, os caminhos calculados: subir o valor, cortar escopo, misto, ou aceitar a exceção (quanto cada sócio perde por mês). A própria Aden (cliente interno) fica fora da lista: suas horas vêm em investidoNaAden.",
      inputSchema: { competencia: zCompetencia },
    },
    async ({ competencia }) =>
      executar(async () => {
        const repo = await obterRepo();
        const mes = competencia ?? competenciaAtual();
        const [config, registros, pagamentos, tarefas] = await Promise.all([repo.carregarConfig(), repo.carregarMes(mes), repo.listarPagamentos(), repo.listarTarefas()]);
        return {
          competencia: mes,
          investidoNaAden: config.clientes.some((c) => c.ativo && c.interno)
            ? horasInvestidasNaAden(config, tarefas, mes).map((x) => ({ socio: x.nome, horas: Math.round(x.horas * 10) / 10, tarefasConcluidas: x.tarefas, semTempoCadastrado: x.semTempo }))
            : null,
          clientes: config.clientes
            .filter((c) => c.ativo && !c.interno)
            .map((c) => {
              const s = calcularSaudeCliente(config, c, registros[c.id] ?? null, {
                pagamentosCentavos: somaPagamentos(pagamentos, c.id, mes),
                mesFechado: mes < competenciaAtual(),
              });
              const sol = calcularSolucoes(config, c, s);
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
        const interno = cenarioParaInterno(cenario, config);
        const r = resultadoParaConversa(calcularCenario(config, interno));
        // projeto avulso no modo valor: os pacotes de projeto que cabem no valor (mesma conta de ver_projetos_que_cabem)
        if (interno.avulso && interno.modo === "valor")
          return {
            ...r,
            projetosQueCabem: projetosQueCabem(config, interno.mensalidadeCentavos).map((p) => ({ pacote: p.nome, valorMinimo: paraReais(p.precoCentavos), prazoDiasUteis: p.prazoDiasUteis, cabe: p.cabe })),
          };
        return r;
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
          await repo.salvarTarefa({ ...t, visivelCliente: true, ...(legenda != null && { legenda }) });
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
          atalhosDoPainel: c.atalhos ?? null,
          contexto: contexto.slice(0, 10).map(notaParaConector),
          contextoTotal: contexto.length,
          // M15: a conversa inicial (briefing) respondida, para o Claude sugerir com base nela
          conversaInicial: briefing.filter((b) => b.resposta?.trim()).map((b) => ({ pergunta: b.perguntaTexto, resposta: b.resposta })),
        };
      }),
  );

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
        "O que o cliente abre no painel dele: PDF do planejamento do mês (com o texto do botão, ex.: 'Planejamento de outubro'), pasta de fotos no Drive, pasta da identidade visual e o texto 'O que está incluso' (o que o serviço cobre e o que é extra; quebras de linha são mantidas). Só os campos enviados mudam; texto vazio limpa. Links precisam começar com https://. Todo mês, troque o planejamento.",
      inputSchema: {
        cliente: z.string().describe("nome ou id"),
        planejamentoUrl: z.string().optional(),
        planejamentoRotulo: z.string().optional(),
        fotosUrl: z.string().optional(),
        identidadeUrl: z.string().optional(),
        inclusoTexto: z.string().optional(),
      },
    },
    async ({ cliente, ...campos }) =>
      executar(async () => {
        const repo = await obterRepo();
        const antes = await repo.carregarConfig();
        const c = resolver(antes.clientes, cliente, "Cliente");
        for (const k of ["planejamentoUrl", "fotosUrl", "identidadeUrl"] as const) {
          const v = campos[k]?.trim();
          if (v && !/^https:\/\/\S+$/.test(v)) throw new Error(`${k} precisa ser um link completo começando com https://`);
        }
        const atual: AtalhosPainel = c.atalhos ?? { planejamentoUrl: null, planejamentoRotulo: null, fotosUrl: null, identidadeUrl: null, inclusoTexto: null };
        const novo: AtalhosPainel = { ...atual };
        for (const [k, v] of Object.entries(campos) as [keyof AtalhosPainel, string | undefined][]) if (v !== undefined) novo[k] = v.trim() || null;
        const depois = structuredClone(antes);
        depois.clientes = depois.clientes.map((x) => (x.id === c.id ? { ...x, atalhos: novo } : x));
        await salvarDiferenca(repo, antes, depois);
        return { cliente: c.nome, atalhos: novo, painel: c.painelToken ? "já aparece no painel" : "este cliente ainda não tem link do painel" };
      }),
  );

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

  // ─── CRM ──────────────────────────────────────────────────────────────────

  server.registerTool(
    "listar_leads",
    {
      title: "Listar leads",
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
        origem: z.string().optional().describe("como chegou: Indicação, Instagram, Quiz, Landing ou Outro"),
        pacote: z.string().nullable().optional().describe("pacote de interesse (nome ou id)"),
        simulacao: z.string().nullable().optional().describe("proposta salva ligada ao lead (nome ou id da simulação); é dela que ganhar_lead tira as entregas do contrato"),
        valorEstimadoReais: opt(z.number(), "valor estimado por mês"),
        responsavel: z.string().nullable().optional().describe("sócio (nome ou id)"),
        proximoContato: z.string().nullable().optional(),
        proximaAcao: z.string().optional(),
        observacoes: z.string().optional(),
        comercialEstruturado: z
          .boolean()
          .nullable()
          .optional()
          .describe("o comercial do cliente está estruturado (quem atende e vende os leads)? Condição para oferecer tráfego com garantia"),
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
          ...(e.simulacao !== undefined && { simulacaoId: e.simulacao ? resolver(await repo.listarSimulacoes(), e.simulacao, "Proposta salva").id : null }),
          ...(e.responsavel !== undefined && { responsavelId: e.responsavel ? resolver(config.pessoas, e.responsavel, "Sócio").id : null }),
          ...(e.proximoContato !== undefined && { proximoContato: e.proximoContato }),
          ...(e.proximaAcao != null && { proximaAcao: e.proximaAcao }),
          ...(e.observacoes != null && { observacoes: e.observacoes }),
          ...(e.comercialEstruturado !== undefined && { comercialEstruturado: e.comercialEstruturado }),
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
        "lead_recebido, pesquisa (pesquisa de nicho e concorrência), contato_feito, reuniao (reunião comercial), proposta_enviada ou perdido (com motivo). Para GANHO use ganhar_lead, que também cria o cliente.",
      inputSchema: {
        id: z.string().describe("id ou nome do lead"),
        etapa: z.enum(["lead_recebido", "pesquisa", "contato_feito", "reuniao", "proposta_enviada", "perdido"]),
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
        "Marca o lead como ganho e cria o cliente, guardando o escopo a partir da proposta ligada (ou do pacote) com o valor estimado. Abaixo do piso de um sócio, o escopo vira pedido de exceção. Pacote de projeto avulso: o cliente nasce sem mensalidade, com o projeto fechado na ficha e uma tarefa por entrega do projeto (prazo em dias úteis). Confirme com quem está conversando antes.",
      inputSchema: { id: z.string().describe("id ou nome do lead") },
    },
    async ({ id }) =>
      executar(async () => {
        const repo = await obterRepo();
        const config = await repo.carregarConfig();
        const l = resolver(await repo.listarLeads(), id, "Lead");
        // M16: sem proposta ligada, sem pacote e sem valor, o cliente nasceria sem valor nem entregas
        if (!l.simulacaoId && !l.pacoteId && l.valorEstimadoCentavos == null)
          throw new Error(
            `${l.nome} ainda não tem proposta, pacote nem valor. Antes de fechar, grave com salvar_lead o pacote (pacote) e o valor combinado (valorEstimadoReais), ou ligue a proposta salva (simulacao).`,
          );
        const r = await ganharLead(repo, config, l);
        if (r.tarefasDoProjeto)
          return {
            cliente: l.nome,
            clienteId: r.clienteId,
            projetoAvulso: "cliente sem mensalidade, com o projeto fechado guardado na ficha",
            tarefasCriadas: r.tarefasDoProjeto.map((t) => ({ titulo: t.titulo, responsavel: config.pessoas.find((p) => p.id === t.responsavelId)?.nome ?? null, prazo: t.vencimento })),
            contrato: "o contrato de valor único ainda não está pronto no Aden: avise quem está conversando",
          };
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
      description:
        "Anota no histórico do lead o que foi conversado (nota, whatsapp, ligação, reunião, e-mail, proposta ou follow_up do \"vou ver\"). Opcional: já marca o próximo contato. Passando do máximo de follow-ups configurado, a resposta sugere marcar como perdido (só sugere).",
      inputSchema: {
        id: z.string().describe("id ou nome do lead"),
        texto: z.string(),
        tipo: z.enum(["nota", "ligacao", "whatsapp", "reuniao", "email", "proposta", "follow_up"]).optional(),
        proximoContato: z.string().optional().describe("AAAA-MM-DD"),
        proximaAcao: z.string().optional(),
      },
    },
    async ({ id, texto, tipo, proximoContato, proximaAcao }) =>
      executar(async () => {
        const repo = await obterRepo();
        const l = resolver(await repo.listarLeads(), id, "Lead");
        await repo.salvarInteracao({ id: novoId(), leadId: l.id, tipo: tipo ?? "nota", texto, em: new Date().toISOString(), autorNome: (await repo.usuarioAtual())?.nome ?? "Claude (conector)" });
        if (proximoContato || proximaAcao)
          await repo.salvarLead({ ...l, ...(proximoContato && { proximoContato }), ...(proximaAcao != null && { proximaAcao }) });
        const config = await repo.carregarConfig();
        const fu = situacaoFollowUp(l, await repo.listarInteracoes(l.id), config.empresa.followUpsMaximo);
        return {
          registrado: l.nome,
          followUpsFeitos: fu.feitos,
          sugestao: fu.sugerirPerda ? `Já foram ${fu.feitos} follow-ups (o máximo combinado). Pergunte se é hora de marcar ${l.nome} como perdido.` : null,
        };
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
        "Pacotes fechados da negociação: frases que o cliente lê, entregas (rotina e primeiro mês) e os preços CALCULADOS (manutenção mensal e primeiro mês). Pacote de projeto avulso (avulso=true): sem mensalidade, valor único do projeto, prazo em dias úteis e parcelas (% no início, resto na entrega). Preço nunca é digitado.",
      inputSchema: {},
    },
    async () =>
      executar(async () => {
        const config = await (await obterRepo()).carregarConfig();
        const nome = (id: string) => config.tiposEntrega.find((t) => t.id === id)?.nome ?? id;
        return (config.pacotes ?? []).map((p) => {
          const preco = precoDoPacote(config, p);
          if (p.avulso) {
            const parc = parcelasDoProjeto(config, preco.mensalCentavos);
            return {
              id: p.id,
              nome: p.nome,
              avulso: true,
              ativo: p.ativo,
              descricao: p.descricao,
              oQueOClienteLe: frasesParaCliente(config, p, pacoteParaCenario(p)),
              projetoEExtras: p.rotina.map((i) => ({ entrega: nome(i.tipoEntregaId), quantidade: i.quantidade })),
              valorMinimoDoProjeto: paraReais(preco.mensalCentavos),
              prazoDiasUteis: prazoDoProjeto(config, p.rotina),
              pagamento: parc ? textoParcelas(parc) : "sem o % pago no início na configuração",
              motivoSemPreco: preco.motivo,
            };
          }
          return {
            id: p.id,
            nome: p.nome,
            avulso: false,
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
        "Pacote fechado para a negociação: nome, descrição para o cliente, frases do que está incluso e as entregas (rotina mensal e primeiro mês). avulso=true = projeto avulso sem mensalidade: as entregas do projeto (e os extras) vão em rotina, e primeiroMes fica vazio. NÃO existe campo de preço: sai do cálculo. Quantidade null = a confirmar. Listas enviadas substituem as antigas.",
      inputSchema: {
        id: z.string().optional().describe("id ou nome do pacote a alterar; vazio = novo"),
        nome: z.string().optional(),
        descricao: z.string().optional(),
        frasesCliente: z.array(z.string()).optional(),
        rotina: z.array(z.object({ entrega: z.string(), quantidade: z.number().nonnegative().nullable() })).optional(),
        primeiroMes: z.array(z.object({ entrega: z.string(), quantidade: z.number().nonnegative().nullable() })).optional(),
        padrao: z.boolean().optional(),
        ativo: z.boolean().optional(),
        avulso: z.boolean().optional().describe("true = projeto avulso (pago uma vez, sem mensalidade)"),
      },
    },
    async ({ id, nome, descricao, frasesCliente, rotina, primeiroMes, padrao, ativo, avulso }) =>
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
          ...(avulso != null && { avulso }),
        };
        if (novo.avulso) {
          novo.entrada = [];
          novo.padrao = false;
        }
        const pacotes = alvo ? lista.map((p) => (p.id === alvo.id ? novo : novo.padrao ? { ...p, padrao: false } : p)) : [...lista.map((p) => (novo.padrao ? { ...p, padrao: false } : p)), novo];
        await salvarDiferenca(repo, antes, { ...antes, pacotes });
        const preco = precoDoPacote({ ...antes, pacotes }, novo);
        if (novo.avulso) return { salvo: novo.nome, avulso: true, valorMinimoDoProjeto: paraReais(preco.mensalCentavos), prazoDiasUteis: prazoDoProjeto({ ...antes, pacotes }, novo.rotina) };
        return { salvo: novo.nome, manutencaoMensal: paraReais(preco.mensalCentavos), primeiroMes: preco.entradaAConfirmar ? "a confirmar" : paraReais(preco.entradaCentavos) };
      }),
  );

  server.registerTool(
    "ver_projetos_que_cabem",
    {
      title: "Projetos avulsos que cabem no valor do cliente",
      description:
        "Modo valor para projeto pago uma vez: com quanto o cliente pode pagar (reais), lista os pacotes de projeto avulso ativos do mais barato ao mais caro, o valor mínimo calculado de cada um, o prazo em dias úteis, se cabe, quanto sobra ou falta e o valor por hora de cada sócio nesse valor. Sem valor: só a lista com os preços.",
      inputSchema: { valorReais: z.number().positive().optional().describe("quanto o cliente pode pagar pelo projeto, em reais") },
    },
    async ({ valorReais }) =>
      executar(async () => {
        const config = await (await obterRepo()).carregarConfig();
        const lista = projetosQueCabem(config, valorReais != null ? paraCentavos(valorReais) : null);
        if (!lista.length) return { projetos: [], aviso: "Nenhum pacote de projeto avulso ativo (Configurações → Pacotes)." };
        return {
          projetos: lista.map((p) => ({
            pacote: p.nome,
            valorMinimo: paraReais(p.precoCentavos),
            prazoDiasUteis: p.prazoDiasUteis,
            cabe: p.cabe,
            ...(p.folgaCentavos != null && (p.folgaCentavos >= 0 ? { sobra: paraReais(p.folgaCentavos) } : { falta: paraReais(-p.folgaCentavos) })),
            porHora: p.porHora.map((x) => ({ socio: x.nome, porHora: paraReais(x.valorHoraCentavos), abaixoDoPiso: x.abaixoPiso })),
          })),
        };
      }),
  );

  server.registerTool(
    "salvar_meta",
    {
      title: "Criar ou alterar degrau da trilha de metas",
      description:
        "Degrau da trilha de crescimento (tela Mês, aba Resumo). SÓ cadastre metas que os sócios definiram na conversa; nunca invente. Critério: faturamento_mensal (alvo em reais), clientes (quantidade), recebido_socio (reais por sócio no mês), uso_capacidade (%). A ordem é a da lista (posicao começa em 1).",
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
        "O que uma pessoa tem para resolver: tarefas de hoje, atrasadas, próximos 7 dias, sem prazo (em produção ou pedidas por outro sócio, com pedidaPor), com o cliente e concluídas hoje; o que vai ao ar hoje e peças que o cliente não aprovou no prazo; mais aprovações pendentes que dependem dela. Sem 'socio' = de todo mundo. Use para responder 'o que eu tenho pra hoje?'.",
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
      description: "Tarefas com status, cliente, entrega, responsável, prazo, checklist e tempo já medido. Por padrão só as abertas.",
      inputSchema: {
        cliente: z.string().optional().describe("filtrar por cliente (nome ou id)"),
        lote: z.string().optional().describe("filtrar por lote do planejamento (ex.: Calendário Outubro — Olinda)"),
        incluirConcluidas: z.boolean().optional(),
      },
    },
    async ({ cliente, lote, incluirConcluidas }) =>
      executar(async () => {
        const repo = await obterRepo();
        const config = await repo.carregarConfig();
        const [tarefas, medicoes] = await Promise.all([repo.listarTarefas(), repo.listarMedicoes()]);
        const cid = cliente ? resolver(config.clientes, cliente, "Cliente").id : null;
        const nome = <T extends { id: string; nome: string }>(l: T[], id: string | null) => (id ? (l.find((x) => x.id === id)?.nome ?? null) : null);
        return tarefas
          .filter(
            (t) =>
              (incluirConcluidas || t.status !== "concluida") &&
              (!cid || t.clienteId === cid) &&
              (!lote || (t.lote ?? "").toLowerCase() === lote.trim().toLowerCase()),
          )
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
              // M15: o que está escrito na tarefa e o que o cliente já respondeu, para o Claude sugerir com base nisso
              ...(t.descricao?.trim() && { descricao: t.descricao.trim().slice(0, 600) }),
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
              ...((t.visivelCliente || t.publicarEm || t.publicadaEm) && {
                etapaDaPeca: ROTULO_PECA[situacaoPeca(t)],
                vaiAoArEm: t.publicarEm ?? null,
                publicadaEm: t.publicadaEm ?? null,
              }),
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
        "Cria uma tarefa (sem id) ou edita (com id). Só os campos enviados mudam. Datas em AAAA-MM-DD. Pedido ao outro sócio (responsavel = o outro): tem prazo mínimo em dias úteis (configuração); sem vencimento, entra sozinho com o mínimo; vencimento menor que o mínimo só como urgência: pergunte antes se é urgente e, se for, mande prioridade \"urgente\". checklist substitui a lista inteira. Peça de conteúdo: textoArte, legenda, publicarEm (quando vai ao ar) e agendada (já programada). Com data, fica 'planejado' antes de aprovar; aprovada vira 'agendada' quando marcada como programada.",
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
        checklist: z.array(z.object({ titulo: z.string(), feita: z.boolean().optional() })).optional(),
        legenda: z.string().optional().describe("texto que vai junto com a peça (legenda do post)"),
        textoArte: z.string().optional().describe("o que vai escrito dentro da arte (o cliente lê antes da legenda)"),
        agendada: z.boolean().optional().describe("true = o post já foi programado (aprovada → agendada); false desfaz"),
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
        // pedido ao outro sócio: prazo mínimo em dias úteis (sem prazo entra sozinho; menor só como urgência)
        const eu = await repo.usuarioAtual();
        const prazo = conferirPrazoDoPedido({ config, antes, depois: t, eu: eu?.pessoaId, hoje: dataDeBrasilia(new Date().toISOString()) });
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
        };
      }),
  );

  server.registerTool(
    "importar_planejamento_mensal",
    {
      title: "Importar o planejamento mensal",
      description:
        "Cria as peças de um planejamento que a Moni já fechou com o cliente, todas de uma vez, na etapa 'planejado' (o cliente já vê em 'Vem por aí' no painel dele). Use o nome do tipo de entrega do Aden em 'tipo' (ex.: Post simples, Reels, Carrossel, Stories, Card de jogo). Preencha textoArte e publicarEm sempre que o plano trouxer; lote agrupa o calendário (ex.: Calendário Outubro — Olinda). Rede e lote são internos. Se uma peça tiver erro, nenhuma é gravada.",
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
              publicarEm: z.string().optional().describe("AAAA-MM-DD ou AAAA-MM-DD HH:MM (horário de Brasília); só a data = meio-dia"),
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
          if (p.publicarEm) {
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
            vencimento: publicarEm ? dataDeBrasilia(publicarEm) : null,
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
          pecas: novas.map((t) => ({ id: t.id, titulo: t.titulo, vaiAoArEm: t.publicarEm, etapa: ROTULO_PECA[situacaoPeca(t)] })),
          painelDoCliente: c.painelToken ? "aparecem em 'Vem por aí'" : "este cliente ainda não tem link do painel",
        };
      }),
  );

  server.registerTool(
    "marcar_publicada",
    {
      title: "Marcar peça como publicada",
      description: "A peça foi ao ar: fica 'publicada' e a tarefa é concluída (o relógio para). publicada=false desfaz.",
      inputSchema: { id: z.string(), publicada: z.boolean().optional().describe("padrão true") },
    },
    async ({ id, publicada }) =>
      executar(async () => {
        const repo = await obterRepo();
        const [tarefas, medicoes] = await Promise.all([repo.listarTarefas(), repo.listarMedicoes()]);
        const t = tarefas.find((x) => x.id === id);
        if (!t) throw new Error("Tarefa não encontrada.");
        const r = publicar(t, medicaoDaTarefa(t, medicoes), new Date(), publicada ?? true);
        await repo.salvarTarefa(r.tarefa);
        if (r.medicao) await repo.salvarMedicao(r.medicao);
        return { tarefa: t.titulo, etapa: ROTULO_PECA[situacaoPeca(r.tarefa)] };
      }),
  );

  server.registerTool(
    "mudar_status_tarefa",
    {
      title: "Mudar o status de uma tarefa",
      description: "a_fazer, em_producao, revisao (com o cliente, esperando a aprovação dele) ou concluida. Concluir encerra o tempo medido, se alguém estava medindo (cronômetro opcional).",
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
        const hoje = new Date().toISOString().slice(0, 10);
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
