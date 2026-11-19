// Peças que as ferramentas do conector dividem (instruções, respostas, ajudantes). Movido de servidor.ts.

import "server-only";
import type { DataComemorativa } from "../calculo/datas";
import { passaPelaAprovacao } from "../calculo/tarefas";
import type { Tarefa } from "../calculo/tarefas";
import type { Configuracao } from "../calculo/tipos";
import { descreverItem } from "../dados/acoes";
import { diferenca, temAlteracoes } from "../dados/repositorio";
import type { AlteracoesConfig, NotaContexto, TipoContexto } from "../dados/repositorio";
import type { RepositorioSupabase } from "../dados/supabase";
import { PAINEL_CLIENTE_ATIVO } from "../recursos";
import { REGRAS_PROTECAO } from "../regras/aprovacao";
import {  } from "../regras/prontoParaComecar";
import { configParaConversa } from "./traducao";
import { z } from "zod";

export const INSTRUCOES = `Aden: a central da agência (assessoria de marketing e performance, sócios Moni e Áleff). Tudo num lugar só:
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
- Leads: listar_leads, salvar_lead, mover_lead, registrar_conversa_lead; quando fechar, ganhar_lead (cria o cliente). ganhar_lead só funciona com o básico do lead preenchido (contato, WhatsApp ou e-mail, valor mensal): se faltar, avise o que falta e pergunte, nunca invente.
- Cliente novo (vindo do fechamento de lead) só começa a produzir com a ficha pronta: ver_cliente traz "faltaParaComecar". Se a lista não estiver vazia, NÃO crie tarefa nem peça: diga o que falta e peça os dados. Aviso prévio e prazo mínimo são decisão dos sócios, nunca chute.
- O Aden é a central da agência (tarefas, calendário, comercial, financeiro, metas). "O que tenho pra hoje?" → ver_visao_do_dia.
- Tarefas: listar_tarefas, salvar_tarefa (cria ou edita: cliente, tipo de entrega, quantidade, responsável, prazo, checklist),
  concluir_tarefa, marcar_agendada e mudar_status_tarefa. As horas vêm do TEMPO CADASTRADO de cada tipo de entrega. O cronômetro é OPCIONAL
  (botão "Medir o tempo" dentro da tarefa no site), nunca liga sozinho e o sistema não pede medições: serve só para
  quando ninguém sabe quanto uma entrega leva. Você não liga relógio; pode registrar um tempo que a pessoa disse com
  registrar_medicao. ver_calibragem mostra a média medida, que nunca entra sozinha nas contas.
  Tarefa pedida ao outro sócio tem prazo mínimo em dias úteis (configuração): sem prazo, entra sozinho; menor só como urgência (pergunte, e se for, prioridade "urgente").
- Projetos de marca (logo, identidade visual, branding) levam dias ou semanas e não se medem em minutos: nunca invente
  um tempo em minutos para eles; pergunte aos sócios.
- Peças de conteúdo são tarefas: legenda e publicarEm (salvar_tarefa) dão a etapa planejado → produção → esperando
  aprovação → aprovada → agendada → publicada (marcar_publicada, que conclui a tarefa). Cliente aprovou fora do painel
  (ex.: no grupo do WhatsApp): registrar_aprovacao_fora_do_painel com a lista de peças leva direto para agendada, sem
  avisar o cliente. Post já programado: marcar_agendada (ou mudar_status_tarefa com "agendada"). Cliente que aprova pelo
  painel (link criado na ficha) só agenda depois de aprovar (senão dá erro); a própria Aden e cliente sem link agendam direto.
- Peça de calendário (do planejamento mensal) SEMPRE tem o dia da postagem (publicarEm): o planejamento já nasce com ele. O prazo da
  tarefa (vencimento) é pelo menos 1 dia ANTES da postagem (a véspera): vazio ou no dia da postagem, o Aden ajusta sozinho para a
  véspera. Peça sem o dia da postagem não vai para o cliente aprovar: pergunte o dia e preencha antes.
- Pacotes: ver_pacotes mostra os preços CALCULADOS (nunca digitados). salvar_pacote só guarda o que é entregue.
- Terceiros (salvar_terceiro): custo por saída + deslocamento, só do cliente que recebe; o cliente nunca vê o valor.
- Quiz de conversão: ver_funil_quiz (onde as pessoas param e por campanha), ver_config_quiz e salvar_config_quiz (WhatsApp, Instagram e códigos de pixel da Meta e do Google; só o que a pessoa mandou), gerar_link_quiz (link de anúncio com campanha). Nunca invente código de pixel nem número.
- Campanhas (listar_campanhas, salvar_campanha): cada página ou oferta (o quiz, uma LP, um mês grátis) com status ativa/pausada/arquivada, o que promete, quem entra, regras, serviços, limite de clientes, link e notas. Nada se apaga: arquivar. Pausar é só registro, não tira a página do ar. Só grave o que os sócios disseram; as regras do mês grátis ainda estão sendo definidas.
- Instagram e Facebook (ver_conexao_meta): etapa 1, só leitura. Confere o acesso da Aden à Meta e o estado de cada cliente. Escolher qual Página é do cliente, pausar e reativar é na ficha do cliente, no site. Nunca peça, mostre ou grave token; nada é publicado por aqui.
- Metas (ver_metas, salvar_meta): trilha de crescimento em degraus. Só cadastre metas que os sócios definiram.
- Sem regra de rateio (com custo fixo cadastrado) a calculadora não calcula: diga o motivo, não invente o resultado.
- Antes de alterar configurações, confirme com quem está conversando o que vai mudar.
- Tudo o que você alterar fica registrado no Histórico com o seu nome.
Comece por ver_configuracao para saber o que existe (nomes de sócios, serviços, tipos de entrega, clientes).`;

export type Texto = { content: { type: "text"; text: string }[]; isError?: boolean };

export function responder(dados: unknown): Texto {
  return { content: [{ type: "text", text: typeof dados === "string" ? dados : JSON.stringify(dados, null, 2) }] };
}

export async function executar(fn: () => Promise<unknown>): Promise<Texto> {
  try {
    return responder(await fn());
  } catch (e) {
    return { content: [{ type: "text", text: `Erro: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
  }
}

/** Salva a diferença entre duas configurações (só o que mudou vai para o banco e o histórico). */
export async function salvarDiferenca(repo: RepositorioSupabase, antes: Configuracao, depois: Configuracao) {
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

export const opt = <T extends z.ZodTypeAny>(t: T, d: string) => t.nullable().optional().describe(`${d} (null apaga, ausente mantém)`);

/** Aplica só os campos informados (undefined = mantém). */
export function aplicar<T extends object>(alvo: T, patch: Partial<Record<keyof T, unknown>>): T {
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
export function acharData(datas: DataComemorativa[], ref: string): DataComemorativa {
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

/** A aprovação desta tarefa passa pelo painel do cliente? (senão "agendada" não espera aprovação) */
export const passaDe = (config: Configuracao, t: Pick<Tarefa, "clienteId"> & Partial<Pick<Tarefa, "tipoEntregaId">>) =>
  passaPelaAprovacao(
    config.clientes.find((c) => c.id === t.clienteId),
    PAINEL_CLIENTE_ATIVO,
    config.tiposEntrega.find((x) => x.id === t.tipoEntregaId),
  );

export const ROTULO_CONTEXTO: Record<TipoContexto, string> = { decisao: "decisão", preferencia: "preferência", pendencia: "pendência", nota: "nota" };

export function notaParaConector(n: NotaContexto) {
  return {
    id: n.id,
    tipo: ROTULO_CONTEXTO[n.tipo],
    texto: n.texto,
    quem: n.autorNome,
    quando: n.criadoEm,
    ...(n.resolvidoEm ? { resolvida: { em: n.resolvidoEm, por: n.resolvidoPorNome } } : {}),
  };
}


export   const zCompetencia = z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional()
    .describe("mês no formato AAAA-MM (padrão: mês atual)");


