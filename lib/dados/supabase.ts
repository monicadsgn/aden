// Implementação real: Supabase (Postgres + Auth). As permissões e o registro
// de auditoria são garantidos pelo banco (RLS + triggers), não por este código.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Medicao } from "../calculo/calibragem";
import { configVazia } from "../calculo/novo";
import type { ArquivoPeca, RespostaCliente, Tarefa } from "../calculo/tarefas";
import type { InteracaoLead, Lead } from "../calculo/crm";
import { enderecoDeAgendaValido, type EventoAgenda } from "../agenda/ics";
import type { RegistroMesCliente } from "../calculo/mes";
import type { Pagamento } from "../calculo/pagamentos";
import type { Cenario, ClienteBase, Configuracao, CustoFixo, Meta, Pacote, Pessoa, ResultadoCenario, Servico, Terceiro, TipoEntrega } from "../calculo/tipos";
import type { DataComemorativa, DataDoCliente } from "../calculo/datas";
import type { RegistroFechamento } from "../calculo/fechamento";
import type { PerguntaBriefing, RespostaBriefing } from "../calculo/briefing";
import { MODELO_VAZIO, type ContratoEnviado, type ModeloContrato, type SituacaoContrato } from "../calculo/contrato";
import { separarProtegidas, type ItemProtegido } from "../regras/aprovacao";
import { avisosDaMudanca } from "./acoes";
import type {
  AlteracoesConfig,
  AvisoSocio,
  DadosExcecao,
  Membro,
  Convite,
  MembroEquipe,
  NotaContexto,
  NovoAviso,
  PainelCliente,
  Pedido,
  RegistroAuditoria,
  Repositorio,
  ResultadoPedido,
  ResultadoSalvarConfig,
  ResumoSimulacao,
  Simulacao,
  StatusPedido,
  TipoContexto,
  UsoDoConector,
  Usuario,
} from "./repositorio";

type Linha = Record<string, unknown>;

const num = (v: unknown): number | null => (v == null ? null : Number(v));

function erro(e: { message: string } | null) {
  if (e) throw new Error(e.message);
}

function tarefaParaBanco(t: Tarefa, org_id: string) {
  return {
    id: t.id,
    org_id,
    titulo: t.titulo,
    cliente_id: t.clienteId,
    tipo_entrega_id: t.tipoEntregaId,
    quantidade: Math.max(1, t.quantidade),
    status: t.status,
    prioridade: t.prioridade,
    responsavel_id: t.responsavelId,
    inicio: t.inicio,
    vencimento: t.vencimento,
    descricao: t.descricao || null,
    etapas: t.etapas,
    criado_em: t.criadoEm,
    concluida_em: t.concluidaEm,
    // as respostas do cliente (rodadas, feedback, aprovação) só o banco escreve
    visivel_cliente: t.visivelCliente ?? false,
    legenda: t.legenda || null,
    texto_arte: t.textoArte || null,
    arquivos: t.arquivos ?? [],
    publicar_em: t.publicarEm ?? null,
    publicada_em: t.publicadaEm ?? null,
    agendada_em: t.agendadaEm ?? null,
    rede: t.rede?.trim() || null,
    lote: t.lote?.trim() || null,
  };
}

function notaDoBanco(n: Linha): NotaContexto {
  return {
    id: n.id as string,
    clienteId: n.cliente_id as string,
    tipo: n.tipo as TipoContexto,
    texto: n.texto as string,
    autorNome: (n.autor_nome as string) ?? null,
    peloClaude: n.pelo_claude === true,
    criadoEm: n.criado_em as string,
    resolvidoEm: (n.resolvido_em as string) ?? null,
    resolvidoPorNome: (n.resolvido_por_nome as string) ?? null,
  };
}

export class RepositorioSupabase implements Repositorio {
  readonly modo = "supabase" as const;
  private sb: SupabaseClient;
  private orgId: string | null = null;
  private usuario: Usuario | null = null;

  private codigoClaude: string | null;
  /** `tokenAcesso`: sessão de quem está no site, repassada a uma rota do servidor (ex.: /api/contrato) */
  private tokenAcesso: string | null;

  /**
   * `servidor`: sem guardar sessão no navegador (uso pelo conector MCP).
   * `codigoClaude`: código pessoal do sócio no conector; vai em toda chamada e o banco assina em nome dele (migration 0025).
   */
  constructor(url: string, chave: string, opcoes: { servidor?: boolean; codigoClaude?: string; tokenAcesso?: string } = {}) {
    this.codigoClaude = opcoes.codigoClaude ?? null;
    this.tokenAcesso = opcoes.tokenAcesso ?? null;
    const cabecalhos: Record<string, string> = {
      ...(this.codigoClaude && { "x-aden-conector": this.codigoClaude }),
      ...(this.tokenAcesso && { Authorization: `Bearer ${this.tokenAcesso}` }),
    };
    this.sb = createClient(url, chave, {
      auth: opcoes.servidor
        ? { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
        : { persistSession: true, autoRefreshToken: true },
      ...(Object.keys(cabecalhos).length ? { global: { headers: cabecalhos } } : {}),
    });
  }

  /** Com código do Claude: de quem é o código (null = inválido). Sem código: null. */
  async donoDoCodigoClaude(): Promise<{ pessoaId: string; nome: string } | null> {
    if (!this.codigoClaude) return null;
    const { data, error } = await this.sb.rpc("conector_quem");
    erro(error);
    return (data as { pessoaId: string; nome: string } | null) ?? null;
  }

  private async org(): Promise<string> {
    if (this.orgId) return this.orgId;
    await this.usuarioAtual();
    if (!this.orgId) throw new Error("Seu usuário não está vinculado à Aden. Peça a um sócio para vincular.");
    return this.orgId;
  }

  async usuarioAtual(): Promise<Usuario | null> {
    if (this.usuario) return this.usuario;
    const user = this.tokenAcesso ? (await this.sb.auth.getUser(this.tokenAcesso)).data.user : (await this.sb.auth.getSession()).data.session?.user;
    if (!user) return null;
    const buscar = () => this.sb.from("membros").select("id, org_id, nome, email, papel").eq("user_id", user.id).eq("ativo", true).limit(1).maybeSingle();
    let { data: m, error } = await buscar();
    erro(error);
    if (!m) {
      // primeiro acesso de quem foi convidado: vira membro com o papel do convite
      const { data: aceito } = await this.sb.rpc("aceitar_convite");
      if (aceito) ({ data: m, error } = await buscar());
      erro(error);
    }
    if (!m) return { id: user.id, nome: user.email ?? "", email: user.email ?? "", papel: "sem_vinculo", pessoaId: null };
    this.orgId = m.org_id as string;
    // pessoa ligada a este login (a equipe não lê a tabela de pessoas: vem pela função)
    const { data: pessoaId } = await this.sb.rpc("minha_pessoa", { org: this.orgId });
    let fotoUrl: string | null = null;
    if (pessoaId) {
      const nomes = await this.sb.rpc("equipe_nomes", { org: this.orgId });
      fotoUrl = ((nomes.data?.pessoas ?? []) as { id: string; fotoUrl: string | null }[]).find((p) => p.id === pessoaId)?.fotoUrl ?? null;
    }
    this.usuario = {
      id: user.id,
      nome: m.nome as string,
      email: m.email as string,
      papel: m.papel as string,
      pessoaId: (pessoaId as string | null) ?? null,
      fotoUrl,
    };
    // pelo Claude com código pessoal: quem age é o dono do código
    const dono = await this.donoDoCodigoClaude();
    if (dono) this.usuario = { ...this.usuario, nome: `${dono.nome} (pelo Claude)`, pessoaId: dono.pessoaId, fotoUrl: null };
    return this.usuario;
  }

  /** Primeiro acesso: cria a senha de quem foi convidado. "confirmar" = falta clicar no e-mail. */
  async criarConta(email: string, senha: string): Promise<"ok" | "confirmar"> {
    // o link de confirmação volta para o endereço onde a conta foi criada (nunca o "Site URL" padrão do Supabase)
    const volta = typeof window !== "undefined" ? `${window.location.origin}/` : undefined;
    const { data, error } = await this.sb.auth.signUp({
      email: email.trim().toLowerCase(),
      password: senha,
      ...(volta && { options: { emailRedirectTo: volta } }),
    });
    if (error) throw new Error(error.message.includes("already registered") ? "Esse e-mail já tem conta. Use Entrar." : error.message);
    this.usuario = null;
    this.orgId = null;
    return data.session ? "ok" : "confirmar";
  }

  async entrar(email: string, senha: string) {
    const { error } = await this.sb.auth.signInWithPassword({ email, password: senha });
    if (error) throw new Error(error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : error.message);
    this.usuario = null;
    this.orgId = null;
  }

  async sair() {
    await this.sb.auth.signOut();
    this.usuario = null;
    this.orgId = null;
  }

  // ─── Configuração ─────────────────────────────────────────────────────────

  async carregarConfig(): Promise<Configuracao> {
    const org = await this.org();
    if (this.usuario && (this.usuario.papel === "colaborador" || this.usuario.papel === "freelancer")) return this.configDaEquipe(org);
    const [emp, pes, ser, div, tip, cus, cli, con, ter, pac, met] = await Promise.all([
      this.sb.from("configuracoes_empresa").select("*").eq("org_id", org).maybeSingle(),
      this.sb.from("pessoas").select("*").eq("org_id", org).order("ordem"),
      this.sb.from("servicos").select("*").eq("org_id", org).order("ordem"),
      this.sb.from("servico_divisao").select("*").eq("org_id", org),
      this.sb.from("tipos_entrega").select("*").eq("org_id", org).order("ordem"),
      this.sb.from("custos_fixos").select("*").eq("org_id", org).order("nome"),
      this.sb.from("clientes").select("*").eq("org_id", org).order("nome"),
      this.sb.from("contratos").select("*").eq("org_id", org).eq("status", "ativo"),
      this.sb.from("terceiros").select("*").eq("org_id", org).order("ordem"),
      this.sb.from("pacotes").select("*").eq("org_id", org).order("ordem"),
      this.sb.from("metas").select("*").eq("org_id", org).order("ordem"),
    ]);
    for (const r of [emp, pes, ser, div, tip, cus, cli, con, ter, pac, met]) erro(r.error);

    const e = emp.data as Linha | null;
    const divisoes = (div.data ?? []) as Linha[];
    const contratos = (con.data ?? []) as Linha[];

    return {
      empresa: {
        regime: (e?.regime as Configuracao["empresa"]["regime"]) ?? null,
        ordemDistribuicao: (e?.ordem_distribuicao as Configuracao["empresa"]["ordemDistribuicao"]) ?? null,
        mensalidadeNoOnboarding: (e?.mensalidade_no_onboarding as boolean | null) ?? null,
        medicoesCalibragem: num(e?.medicoes_calibragem),
        diferencaSugerirPct: num(e?.diferenca_sugerir_pct),
        diasLeadParado: num(e?.dias_lead_parado),
        reinvestimentoPct: num(e?.reinvestimento_pct),
        impostoPct: num(e?.imposto_pct),
        taxaRecebimentoPct: num(e?.taxa_recebimento_pct),
        regraRateio: (e?.regra_rateio as Configuracao["empresa"]["regraRateio"]) ?? null,
        impostoFixoMensalCentavos: num(e?.imposto_fixo_mensal_centavos),
        taxaRecebimentoFixaCentavos: num(e?.taxa_recebimento_fixa_centavos),
        tetoFaturamentoAnualCentavos: num(e?.teto_faturamento_anual_centavos),
        avisoTetoPct: num(e?.aviso_teto_pct),
        ociosidadePct: num(e?.ociosidade_pct),
        arredondamentoPropostaCentavos: num(e?.arredondamento_proposta_centavos),
        followUpsMaximo: num(e?.follow_ups_maximo),
        socioPercentualId: (e?.socio_percentual_id as string) ?? null,
        sociedadePctSocio: num(e?.sociedade_pct_socio),
        sociedadeTetoViradaCentavos: num(e?.sociedade_teto_virada_centavos),
        sociedadeAvisoBonusCentavos: num(e?.sociedade_aviso_bonus_centavos),
        socioSobraId: (e?.socio_sobra_id as string) ?? null,
        sociedadeSobraTrafegoPct: num(e?.sociedade_sobra_trafego_pct),
        trafegoProprioMinimoCentavos: num(e?.trafego_proprio_minimo_centavos),
        ofertaVerbaMinCentavos: num(e?.oferta_verba_min_centavos),
        ofertaVerbaMaxCentavos: num(e?.oferta_verba_max_centavos),
        ofertaGestaoAposResultadoCentavos: num(e?.oferta_gestao_apos_resultado_centavos),
        ofertaMinimoSocialTrafegoCentavos: num(e?.oferta_minimo_social_trafego_centavos),
      },
      pessoas: ((pes.data ?? []) as Linha[]).map((p) => ({
        id: p.id as string,
        nome: p.nome as string,
        socio: p.socio as boolean,
        percentualPadrao: num(p.percentual_padrao),
        pisoHoraCentavos: num(p.piso_hora_centavos),
        capacidadeHorasMes: num(p.capacidade_horas_mes),
        ativo: p.ativo as boolean,
        membroId: (p.membro_id as string) ?? null,
        fotoUrl: (p.foto_url as string) ?? null,
      })),
      servicos: ((ser.data ?? []) as Linha[]).map((s) => ({
        id: s.id as string,
        nome: s.nome as string,
        ativo: s.ativo as boolean,
        divisaoPadrao: Object.fromEntries(
          divisoes.filter((d) => d.servico_id === s.id).map((d) => [d.pessoa_id as string, num(d.percentual)]),
        ),
      })),
      tiposEntrega: ((tip.data ?? []) as Linha[]).map((t) => ({
        id: t.id as string,
        nome: t.nome as string,
        servicoId: (t.servico_id as string) ?? null,
        horasPorUnidade: num(t.horas_por_unidade),
        audiovisual: (t.audiovisual as boolean) ?? false,
        ativo: t.ativo as boolean,
        calibrarDesde: (t.calibrar_desde as string) ?? null,
        terceiroId: (t.terceiro_id as string) ?? null,
        nomeCliente: (t.nome_cliente as string) ?? null,
      })),
      custosFixos: ((cus.data ?? []) as Linha[]).map((c) => ({
        id: c.id as string,
        nome: c.nome as string,
        valorMensalCentavos: num(c.valor_mensal_centavos),
        ativo: c.ativo as boolean,
        pagoPorPessoaId: (c.pago_por_pessoa_id as string) ?? null,
        planejado: (c.planejado as boolean) ?? false,
      })),
      clientes: ((cli.data ?? []) as Linha[]).map((c) => {
        const contrato = contratos.find((k) => k.cliente_id === c.id);
        return {
          id: c.id as string,
          nome: c.nome as string,
          interno: c.interno as boolean,
          participaRateio: c.participa_rateio as boolean,
          ativo: c.ativo as boolean,
          valorMensalCentavos: num(contrato?.valor_mensal_centavos),
          escopo: (contrato?.escopo as Cenario | null) ?? null,
          contato: (c.contato as string) ?? "",
          telefone: (c.telefone as string) ?? "",
          email: (c.email as string) ?? "",
          instagram: (c.instagram as string) ?? "",
          segmento: (c.segmento as string) ?? "",
          observacoes: (c.observacoes as string) ?? "",
          razaoSocial: (c.razao_social as string) ?? "",
          documento: (c.documento as string) ?? "",
          endereco: (c.endereco as string) ?? "",
          clienteDesde: (c.cliente_desde as string) ?? null,
          painelToken: (c.painel_token as string) ?? null,
          fechamentoIniciadoEm: (c.fechamento_iniciado_em as string) ?? null,
          atalhos: {
            planejamentoUrl: (c.painel_planejamento_url as string) ?? null,
            planejamentoRotulo: (c.painel_planejamento_rotulo as string) ?? null,
            fotosUrl: (c.painel_fotos_url as string) ?? null,
            identidadeUrl: (c.painel_identidade_url as string) ?? null,
            inclusoTexto: (c.painel_incluso as string) ?? null,
          },
          contrato: contrato
            ? {
                inicio: (contrato.inicio as string) ?? null,
                fim: (contrato.fim as string) ?? null,
                prazoMinimoMeses: num(contrato.prazo_minimo_meses),
                diaPagamento: num(contrato.dia_pagamento),
                avisoPrevioDias: num(contrato.aviso_previo_dias),
                limiteRodadas: num(contrato.limite_rodadas),
                prazoAprovacaoDias: num(contrato.prazo_aprovacao_dias),
                prazoEntregaDias: num(contrato.prazo_entrega_dias),
                inicioCobranca: (contrato.inicio_cobranca as string) ?? "",
                observacoes: (contrato.observacoes as string) ?? "",
                venceUltimoDiaUtil: (contrato.vence_ultimo_dia_util as boolean) ?? false,
                limiteReunioesMes: num(contrato.limite_reunioes_mes),
                garantiaResultado: (contrato.garantia_resultado as string) ?? "",
                garantiaAte: (contrato.garantia_ate as string) ?? null,
              }
            : null,
        };
      }),
      terceiros: ((ter.data ?? []) as Linha[]).map((t) => ({
        id: t.id as string,
        nome: t.nome as string,
        inclui: (t.inclui as string) ?? "",
        fraseCliente: (t.frase_cliente as string) ?? "",
        valorPorSaidaCentavos: num(t.valor_por_saida_centavos),
        deslocamentoMedioCentavos: num(t.deslocamento_medio_centavos),
        ativo: t.ativo as boolean,
      })),
      pacotes: ((pac.data ?? []) as Linha[]).map((p) => ({
        id: p.id as string,
        nome: p.nome as string,
        descricao: (p.descricao as string) ?? "",
        itensCliente: Array.isArray(p.itens_cliente) ? (p.itens_cliente as string[]) : [],
        rotina: Array.isArray(p.rotina) ? (p.rotina as Pacote["rotina"]) : [],
        entrada: Array.isArray(p.entrada) ? (p.entrada as Pacote["entrada"]) : [],
        padrao: (p.padrao as boolean) ?? false,
        ativo: p.ativo as boolean,
      })),
      metas: ((met.data ?? []) as Linha[]).map((m) => ({
        id: m.id as string,
        nome: m.nome as string,
        criterio: (m.criterio as Meta["criterio"]) ?? null,
        alvo: num(m.alvo),
        acao: (m.acao as string) ?? "",
        conquistadaEm: (m.conquistada_em as string) ?? null,
      })),
    };
  }

  async salvarConfig(alt: AlteracoesConfig): Promise<ResultadoSalvarConfig> {
    const org_id = await this.org();
    const antes = await this.carregarConfig();
    const autor = await this.usuarioAtual();
    // campos protegidos com valor mudam só por pedido de aprovação
    const sep = separarProtegidas(antes, alt);
    await this.gravarLivres(org_id, sep.alteracoes);

    let pedido: ResultadoPedido | null = null;
    if (sep.itens.length) {
      const { data, error } = await this.sb.rpc("propor_alteracao", {
        p_org: org_id,
        p_itens: sep.itens.map((i) => itemParaBanco(i, org_id)),
        p_impacto: null,
        p_descricao: sep.itens.map((i) => i.descricao).join(", "),
      });
      erro(error);
      pedido = pedidoDoBanco(data);
    }

    const depois = await this.carregarConfig();
    const naHora = [...sep.primeirosPreenchimentos, ...(pedido?.status === "aplicado" ? sep.itens : [])];
    const avisos = avisosDaMudanca({
      antes,
      depois,
      autor,
      itensPendentes: pedido?.status === "pendente" ? sep.itens : [],
      pedido,
      itensNaHora: naHora,
    });
    if (avisos.length) await this.criarAvisos(avisos);
    return { pedido, itensProtegidos: sep.itens };
  }

  private async gravarLivres(org_id: string, a: AlteracoesConfig) {

    if (a.empresa) {
      const { error } = await this.sb.from("configuracoes_empresa").upsert({
        org_id,
        regime: a.empresa.regime ?? null,
        ordem_distribuicao: a.empresa.ordemDistribuicao ?? null,
        mensalidade_no_onboarding: a.empresa.mensalidadeNoOnboarding ?? null,
        medicoes_calibragem: a.empresa.medicoesCalibragem ?? null,
        diferenca_sugerir_pct: a.empresa.diferencaSugerirPct ?? null,
        dias_lead_parado: a.empresa.diasLeadParado ?? null,
        reinvestimento_pct: a.empresa.reinvestimentoPct,
        imposto_pct: a.empresa.impostoPct,
        taxa_recebimento_pct: a.empresa.taxaRecebimentoPct,
        regra_rateio: a.empresa.regraRateio,
        imposto_fixo_mensal_centavos: a.empresa.impostoFixoMensalCentavos ?? null,
        taxa_recebimento_fixa_centavos: a.empresa.taxaRecebimentoFixaCentavos ?? null,
        teto_faturamento_anual_centavos: a.empresa.tetoFaturamentoAnualCentavos ?? null,
        aviso_teto_pct: a.empresa.avisoTetoPct ?? null,
        ociosidade_pct: a.empresa.ociosidadePct ?? null,
        arredondamento_proposta_centavos: a.empresa.arredondamentoPropostaCentavos ?? null,
        follow_ups_maximo: a.empresa.followUpsMaximo ?? null,
        socio_percentual_id: a.empresa.socioPercentualId ?? null,
        sociedade_pct_socio: a.empresa.sociedadePctSocio ?? null,
        sociedade_teto_virada_centavos: a.empresa.sociedadeTetoViradaCentavos ?? null,
        sociedade_aviso_bonus_centavos: a.empresa.sociedadeAvisoBonusCentavos ?? null,
        socio_sobra_id: a.empresa.socioSobraId ?? null,
        sociedade_sobra_trafego_pct: a.empresa.sociedadeSobraTrafegoPct ?? null,
        trafego_proprio_minimo_centavos: a.empresa.trafegoProprioMinimoCentavos ?? null,
        oferta_verba_min_centavos: a.empresa.ofertaVerbaMinCentavos ?? null,
        oferta_verba_max_centavos: a.empresa.ofertaVerbaMaxCentavos ?? null,
        oferta_gestao_apos_resultado_centavos: a.empresa.ofertaGestaoAposResultadoCentavos ?? null,
        oferta_minimo_social_trafego_centavos: a.empresa.ofertaMinimoSocialTrafegoCentavos ?? null,
      });
      erro(error);
    }

    // pessoas antes de serviços (a divisão referencia pessoas)
    await this.upsert(
      "pessoas",
      a.pessoas.salvar.map((p: Pessoa, i) => ({
        id: p.id,
        org_id,
        nome: p.nome,
        socio: p.socio,
        percentual_padrao: p.percentualPadrao,
        piso_hora_centavos: p.pisoHoraCentavos,
        capacidade_horas_mes: p.capacidadeHorasMes,
        ativo: p.ativo,
        membro_id: p.membroId ?? null,
        ordem: i,
      })),
    );

    await this.upsert(
      "servicos",
      a.servicos.salvar.map((s: Servico, i) => ({ id: s.id, org_id, nome: s.nome, ativo: s.ativo, ordem: i })),
    );
    for (const s of a.servicos.salvar) {
      const linhas = Object.entries(s.divisaoPadrao).map(([pessoa_id, percentual]) => ({
        org_id,
        servico_id: s.id,
        pessoa_id,
        percentual,
      }));
      if (linhas.length) {
        const { error } = await this.sb.from("servico_divisao").upsert(linhas, { onConflict: "servico_id,pessoa_id" });
        erro(error);
      }
    }

    // terceiros antes dos tipos de entrega (o tipo aponta para o terceiro)
    await this.upsert(
      "terceiros",
      (a.terceiros?.salvar ?? []).map((t: Terceiro, i) => ({
        id: t.id,
        org_id,
        nome: t.nome,
        inclui: t.inclui || null,
        frase_cliente: t.fraseCliente || null,
        valor_por_saida_centavos: t.valorPorSaidaCentavos,
        deslocamento_medio_centavos: t.deslocamentoMedioCentavos,
        ativo: t.ativo,
        ordem: i,
      })),
    );

    await this.upsert(
      "tipos_entrega",
      a.tiposEntrega.salvar.map((t: TipoEntrega, i) => ({
        id: t.id,
        org_id,
        nome: t.nome,
        servico_id: t.servicoId,
        horas_por_unidade: t.horasPorUnidade,
        audiovisual: t.audiovisual ?? false,
        ativo: t.ativo,
        calibrar_desde: t.calibrarDesde ?? null,
        terceiro_id: t.terceiroId ?? null,
        nome_cliente: t.nomeCliente?.trim() || null,
        ordem: i,
      })),
    );

    await this.upsert(
      "custos_fixos",
      a.custosFixos.salvar.map((c: CustoFixo) => ({
        id: c.id,
        org_id,
        nome: c.nome,
        valor_mensal_centavos: c.valorMensalCentavos,
        ativo: c.ativo,
        pago_por_pessoa_id: c.pagoPorPessoaId ?? null,
        planejado: c.planejado ?? false,
      })),
    );

    await this.upsert(
      "clientes",
      a.clientes.salvar.map((c: ClienteBase) => ({
        id: c.id,
        org_id,
        nome: c.nome,
        interno: c.interno,
        participa_rateio: c.participaRateio,
        ativo: c.ativo,
        contato: c.contato || null,
        telefone: c.telefone || null,
        email: c.email || null,
        instagram: c.instagram || null,
        segmento: c.segmento || null,
        observacoes: c.observacoes || null,
        razao_social: c.razaoSocial?.trim() || null,
        documento: c.documento?.trim() || null,
        endereco: c.endereco?.trim() || null,
        cliente_desde: c.clienteDesde ?? null,
        painel_planejamento_url: c.atalhos?.planejamentoUrl?.trim() || null,
        painel_planejamento_rotulo: c.atalhos?.planejamentoRotulo?.trim() || null,
        painel_fotos_url: c.atalhos?.fotosUrl?.trim() || null,
        painel_identidade_url: c.atalhos?.identidadeUrl?.trim() || null,
        painel_incluso: c.atalhos?.inclusoTexto?.trim() || null,
        fechamento_iniciado_em: c.fechamentoIniciadoEm ?? null,
      })),
    );
    // valor mensal e condições moram no contrato ativo do cliente
    for (const c of a.clientes.salvar) {
      const { data, error } = await this.sb.from("contratos").select("id, valor_mensal_centavos").eq("cliente_id", c.id).eq("status", "ativo").maybeSingle();
      erro(error);
      const k = c.contrato;
      const condicoes = k
        ? {
            inicio: k.inicio,
            fim: k.fim,
            prazo_minimo_meses: k.prazoMinimoMeses,
            dia_pagamento: k.diaPagamento,
            aviso_previo_dias: k.avisoPrevioDias,
            limite_rodadas: k.limiteRodadas,
            prazo_aprovacao_dias: k.prazoAprovacaoDias,
            prazo_entrega_dias: k.prazoEntregaDias,
            inicio_cobranca: k.inicioCobranca || null,
            observacoes: k.observacoes || null,
            vence_ultimo_dia_util: k.venceUltimoDiaUtil ?? false,
            limite_reunioes_mes: k.limiteReunioesMes ?? null,
            garantia_resultado: k.garantiaResultado || null,
            garantia_ate: k.garantiaAte ?? null,
          }
        : {};
      if (data) {
        const r = await this.sb.from("contratos").update({ valor_mensal_centavos: c.valorMensalCentavos, ...condicoes }).eq("id", data.id);
        erro(r.error);
      } else if (c.valorMensalCentavos != null || k) {
        const r = await this.sb.from("contratos").insert({ org_id, cliente_id: c.id, status: "ativo", valor_mensal_centavos: c.valorMensalCentavos, ...condicoes });
        erro(r.error);
      }
    }

    // só um pacote padrão: desmarca antes de marcar outro (índice único)
    const novoPadrao = (a.pacotes?.salvar ?? []).find((p) => p.padrao);
    if (novoPadrao) {
      const r = await this.sb.from("pacotes").update({ padrao: false }).eq("org_id", org_id).eq("padrao", true).neq("id", novoPadrao.id);
      erro(r.error);
    }
    await this.upsert(
      "pacotes",
      (a.pacotes?.salvar ?? []).map((p: Pacote, i) => ({
        id: p.id,
        org_id,
        nome: p.nome,
        descricao: p.descricao || null,
        itens_cliente: p.itensCliente,
        rotina: p.rotina,
        entrada: p.entrada,
        padrao: p.padrao,
        ativo: p.ativo,
        ordem: i,
      })),
    );
    await this.upsert(
      "metas",
      (a.metas?.salvar ?? []).map((m: Meta, i) => ({
        id: m.id,
        org_id,
        nome: m.nome,
        criterio: m.criterio,
        alvo: m.alvo,
        acao: m.acao || null,
        conquistada_em: m.conquistadaEm,
        ordem: i,
      })),
    );

    // remoções por último, na ordem inversa das dependências
    await this.remover("metas", a.metas?.remover ?? []);
    await this.remover("pacotes", a.pacotes?.remover ?? []);
    await this.remover("clientes", a.clientes.remover);
    await this.remover("custos_fixos", a.custosFixos.remover);
    await this.remover("tipos_entrega", a.tiposEntrega.remover);
    await this.remover("terceiros", a.terceiros?.remover ?? []);
    await this.remover("servicos", a.servicos.remover);
    await this.remover("pessoas", a.pessoas.remover);
  }

  private async upsert(tabela: string, linhas: Linha[]) {
    if (!linhas.length) return;
    const { error } = await this.sb.from(tabela).upsert(linhas);
    erro(error);
  }

  private async remover(tabela: string, ids: string[]) {
    if (!ids.length) return;
    const { error } = await this.sb.from(tabela).delete().in("id", ids);
    erro(error);
  }

  // ─── Simulações ───────────────────────────────────────────────────────────

  async listarSimulacoes(): Promise<ResumoSimulacao[]> {
    const org = await this.org();
    const { data, error } = await this.sb
      .from("simulacoes")
      .select("id, nome, atualizado_em, simulacao_cenarios(count)")
      .eq("org_id", org)
      .order("atualizado_em", { ascending: false });
    erro(error);
    return ((data ?? []) as Linha[]).map((s) => ({
      id: s.id as string,
      nome: s.nome as string,
      atualizadoEm: s.atualizado_em as string,
      cenarios: ((s.simulacao_cenarios as { count: number }[])?.[0]?.count as number) ?? 0,
    }));
  }

  async carregarSimulacao(id: string): Promise<Simulacao | null> {
    const { data, error } = await this.sb.from("simulacoes").select("id, nome").eq("id", id).maybeSingle();
    erro(error);
    if (!data) return null;
    const cen = await this.sb.from("simulacao_cenarios").select("entradas").eq("simulacao_id", id).order("ordem");
    erro(cen.error);
    return {
      id: data.id as string,
      nome: data.nome as string,
      cenarios: ((cen.data ?? []) as Linha[]).map((c) => c.entradas as Cenario),
    };
  }

  async salvarSimulacao(sim: Simulacao, resultados: ResultadoCenario[], config: Configuracao) {
    const org_id = await this.org();
    const r = await this.sb.from("simulacoes").upsert({ id: sim.id, org_id, nome: sim.nome });
    erro(r.error);

    const existentes = await this.sb.from("simulacao_cenarios").select("id").eq("simulacao_id", sim.id);
    erro(existentes.error);
    const ids = new Set(sim.cenarios.map((c) => c.id));
    const remover = ((existentes.data ?? []) as Linha[]).map((x) => x.id as string).filter((id) => !ids.has(id));
    await this.remover("simulacao_cenarios", remover);

    await this.upsert(
      "simulacao_cenarios",
      sim.cenarios.map((c, i) => ({
        id: c.id,
        org_id,
        simulacao_id: sim.id,
        ordem: i,
        nome: c.nome,
        entradas: c,
        resultado: resultados[i] ?? null,
        config_snapshot: config,
      })),
    );
  }

  async removerSimulacao(id: string) {
    await this.remover("simulacoes", [id]);
  }

  // ─── Escopo contratado e registros do mês ─────────────────────────────────

  async definirEscopoCliente(clienteId: string, escopo: Cenario | null) {
    const org_id = await this.org();
    const { data, error } = await this.sb.from("contratos").select("id").eq("cliente_id", clienteId).eq("status", "ativo").maybeSingle();
    erro(error);
    if (data) {
      const r = await this.sb.from("contratos").update({ escopo }).eq("id", data.id);
      erro(r.error);
    } else {
      const r = await this.sb.from("contratos").insert({ org_id, cliente_id: clienteId, status: "ativo", escopo });
      erro(r.error);
    }
  }

  async carregarMes(competencia: string): Promise<Record<string, RegistroMesCliente>> {
    const org = await this.org();
    const dia = `${competencia}-01`;
    const [meses, horas] = await Promise.all([
      this.sb.from("mes_cliente").select("cliente_id, valor_recebido_centavos").eq("org_id", org).eq("competencia", dia),
      this.sb.from("horas_realizadas").select("cliente_id, pessoa_id, horas").eq("org_id", org).eq("competencia", dia),
    ]);
    erro(meses.error);
    erro(horas.error);
    const out: Record<string, RegistroMesCliente> = {};
    const garantir = (id: string) => (out[id] ??= { valorRecebidoCentavos: null, horas: {} });
    for (const m of (meses.data ?? []) as Linha[]) garantir(m.cliente_id as string).valorRecebidoCentavos = num(m.valor_recebido_centavos);
    for (const h of (horas.data ?? []) as Linha[]) garantir(h.cliente_id as string).horas[h.pessoa_id as string] = num(h.horas);
    return out;
  }

  async salvarMesCliente(competencia: string, clienteId: string, registro: RegistroMesCliente) {
    const org_id = await this.org();
    const dia = `${competencia}-01`;
    const m = await this.sb
      .from("mes_cliente")
      .upsert(
        { org_id, cliente_id: clienteId, competencia: dia, valor_recebido_centavos: registro.valorRecebidoCentavos },
        { onConflict: "cliente_id,competencia" },
      );
    erro(m.error);
    const linhas = Object.entries(registro.horas).map(([pessoa_id, horas]) => ({
      org_id,
      cliente_id: clienteId,
      pessoa_id,
      competencia: dia,
      horas,
    }));
    if (linhas.length) {
      const h = await this.sb.from("horas_realizadas").upsert(linhas, { onConflict: "cliente_id,pessoa_id,competencia" });
      erro(h.error);
    }
  }

  // ─── Auditoria ────────────────────────────────────────────────────────────

  async listarAuditoria(limite: number): Promise<RegistroAuditoria[]> {
    const org = await this.org();
    const { data, error } = await this.sb
      .from("auditoria")
      .select("*")
      .eq("org_id", org)
      .order("em", { ascending: false })
      .limit(limite);
    erro(error);
    const { data: membros } = await this.sb.from("membros").select("user_id, nome").eq("org_id", org);
    const nomes = new Map(((membros ?? []) as Linha[]).map((m) => [m.user_id as string, m.nome as string]));
    return ((data ?? []) as Linha[]).map((a) => ({
      id: String(a.id),
      tabela: a.tabela as string,
      registroId: a.registro_id as string,
      acao: a.acao as RegistroAuditoria["acao"],
      antes: (a.antes as Record<string, unknown>) ?? null,
      depois: (a.depois as Record<string, unknown>) ?? null,
      autor: nomes.get(a.autor_id as string) ?? (a.autor_email as string) ?? "sistema",
      peloClaude: a.pelo_claude === true,
      em: a.em as string,
    }));
  }

  async listarMembros(): Promise<Membro[]> {
    const org = await this.org();
    const { data, error } = await this.sb.from("membros").select("id, nome, email, papel").eq("org_id", org).eq("ativo", true).order("nome");
    erro(error);
    return ((data ?? []) as Linha[]).map((m) => ({ id: m.id as string, nome: m.nome as string, email: m.email as string, papel: m.papel as string }));
  }

  async salvarFotoPessoa(pessoaId: string, imagem: Blob | null): Promise<string | null> {
    const org = await this.org();
    const bucket = this.sb.storage.from("avatares");
    const { data: antigos } = await bucket.list(org, { search: pessoaId });
    let url: string | null = null;
    if (imagem) {
      // nome novo a cada troca: o navegador não mostra a foto velha guardada em cache
      const caminho = `${org}/${pessoaId}-${Date.now()}.webp`;
      const { error } = await bucket.upload(caminho, imagem, { contentType: imagem.type || "image/webp", cacheControl: "31536000" });
      erro(error);
      url = bucket.getPublicUrl(caminho).data.publicUrl;
    }
    const { error } = await this.sb.from("pessoas").update({ foto_url: url }).eq("id", pessoaId);
    erro(error);
    const velhos = (antigos ?? []).map((f) => `${org}/${f.name}`).filter((c) => !url?.endsWith(c));
    if (velhos.length) await bucket.remove(velhos);
    this.usuario = null;
    return url;
  }

  // ─── Aprovações e avisos ──────────────────────────────────────────────────

  async listarPedidos(): Promise<Pedido[]> {
    const org = await this.org();
    const [ped, apr] = await Promise.all([
      this.sb.from("pedidos_alteracao").select("*").eq("org_id", org).order("criado_em", { ascending: false }).limit(200),
      this.sb.from("aprovacoes").select("*").eq("org_id", org),
    ]);
    erro(ped.error);
    erro(apr.error);
    const aprovacoes = (apr.data ?? []) as Linha[];
    return ((ped.data ?? []) as Linha[]).map((p) => ({
      id: p.id as string,
      tipo: p.tipo as Pedido["tipo"],
      descricao: p.descricao as string,
      itens: ((p.itens as Linha[]) ?? []).map(itemDoBanco),
      dados: dadosDoBanco(p.dados as Linha | null),
      assinatura: (p.assinatura as string) ?? null,
      clienteId: (p.cliente_id as string) ?? null,
      afetados: (p.afetados as string[]) ?? [],
      impacto: (p.impacto as Record<string, number>) ?? null,
      status: p.status as StatusPedido,
      motivo: (p.motivo as string) ?? null,
      autorNome: (p.autor_nome as string) ?? null,
      autorPessoaId: (p.autor_pessoa_id as string) ?? null,
      criadoEm: p.criado_em as string,
      decididoEm: (p.decidido_em as string) ?? null,
      aprovacoes: aprovacoes
        .filter((a) => a.pedido_id === p.id)
        .map((a) => ({ pessoaId: a.pessoa_id as string, decisao: a.decisao as "aprovado" | "recusado", automatica: a.automatica as boolean, em: a.em as string })),
    }));
  }

  async decidirPedido(id: string, decisao: "aprovado" | "recusado", motivo?: string | null): Promise<StatusPedido> {
    const { data, error } = await this.sb.rpc("decidir_pedido", { p_pedido: id, p_decisao: decisao, p_motivo: motivo ?? null });
    erro(error);
    return data as StatusPedido;
  }

  async cancelarPedido(id: string) {
    const { error } = await this.sb.rpc("cancelar_pedido", { p_pedido: id });
    erro(error);
  }

  async proporExcecao(p: { clienteId: string | null; afetados: string[]; assinatura: string; descricao: string; dados: DadosExcecao }): Promise<ResultadoPedido> {
    const org = await this.org();
    const { data, error } = await this.sb.rpc("propor_excecao", {
      p_org: org,
      p_cliente: p.clienteId,
      p_afetados: p.afetados,
      p_assinatura: p.assinatura,
      p_descricao: p.descricao,
      p_dados: { aplicar: p.dados.aplicar, cenario: p.dados.cenario, valor_centavos: p.dados.valorCentavos, perdas: p.dados.perdas },
    });
    erro(error);
    return pedidoDoBanco(data);
  }

  async listarAvisos(): Promise<AvisoSocio[]> {
    const org = await this.org();
    const { data, error } = await this.sb.from("avisos_socios").select("*").eq("org_id", org).order("criado_em", { ascending: false }).limit(200);
    erro(error);
    return ((data ?? []) as Linha[]).map((a) => ({
      id: a.id as string,
      pessoaId: a.pessoa_id as string,
      titulo: a.titulo as string,
      texto: a.texto as string,
      impactoCentavos: num(a.impacto_centavos),
      autorNome: (a.autor_nome as string) ?? null,
      pedidoId: (a.pedido_id as string) ?? null,
      criadoEm: a.criado_em as string,
      lidoEm: (a.lido_em as string) ?? null,
    }));
  }

  async criarAvisos(avisos: NovoAviso[]) {
    if (!avisos.length) return;
    const org_id = await this.org();
    const { error } = await this.sb.from("avisos_socios").insert(
      avisos.map((a) => ({
        org_id,
        pessoa_id: a.pessoaId,
        titulo: a.titulo,
        texto: a.texto,
        impacto_centavos: a.impactoCentavos,
        autor_nome: a.autorNome,
        pedido_id: a.pedidoId,
      })),
    );
    erro(error);
  }

  async marcarAvisoLido(id: string) {
    const { error } = await this.sb.from("avisos_socios").update({ lido_em: new Date().toISOString() }).eq("id", id);
    erro(error);
  }

  // ─── Cronômetro ───────────────────────────────────────────────────────────

  async listarMedicoes(): Promise<Medicao[]> {
    const org = await this.org();
    const { data, error } = await this.sb.from("medicoes").select("*").eq("org_id", org).order("criado_em", { ascending: false });
    erro(error);
    return ((data ?? []) as Linha[]).map((m) => ({
      id: m.id as string,
      clienteId: (m.cliente_id as string) ?? null,
      tipoEntregaId: m.tipo_entrega_id as string,
      pessoaId: (m.pessoa_id as string) ?? null,
      estado: m.estado as Medicao["estado"],
      acumuladoSegundos: Number(m.acumulado_segundos ?? 0),
      retomadoEm: (m.retomado_em as string) ?? null,
      fim: (m.fim as string) ?? null,
      criadoEm: m.criado_em as string,
      tarefaId: (m.tarefa_id as string) ?? null,
      unidades: Number(m.unidades ?? 1),
    }));
  }

  async salvarMedicao(m: Medicao) {
    const org_id = await this.org();
    const { error } = await this.sb.from("medicoes").upsert({
      id: m.id,
      org_id,
      cliente_id: m.clienteId,
      tipo_entrega_id: m.tipoEntregaId,
      pessoa_id: m.pessoaId,
      estado: m.estado,
      acumulado_segundos: m.acumuladoSegundos,
      retomado_em: m.retomadoEm,
      fim: m.fim,
      criado_em: m.criadoEm,
      tarefa_id: m.tarefaId ?? null,
      unidades: Math.max(1, m.unidades ?? 1),
    });
    erro(error);
  }

  async removerMedicao(id: string) {
    await this.remover("medicoes", [id]);
  }

  // ─── Tarefas ──────────────────────────────────────────────────────────────

  async listarTarefas(): Promise<Tarefa[]> {
    const org = await this.org();
    const { data, error } = await this.sb.from("tarefas").select("*").eq("org_id", org).order("criado_em", { ascending: false }).limit(1000);
    erro(error);
    return ((data ?? []) as Linha[]).map((t) => ({
      id: t.id as string,
      titulo: t.titulo as string,
      clienteId: (t.cliente_id as string) ?? null,
      tipoEntregaId: (t.tipo_entrega_id as string) ?? null,
      quantidade: Number(t.quantidade ?? 1),
      status: t.status as Tarefa["status"],
      prioridade: (t.prioridade as Tarefa["prioridade"]) ?? null,
      responsavelId: (t.responsavel_id as string) ?? null,
      inicio: (t.inicio as string) ?? null,
      vencimento: (t.vencimento as string) ?? null,
      descricao: (t.descricao as string) ?? "",
      etapas: Array.isArray(t.etapas) ? (t.etapas as Tarefa["etapas"]) : [],
      criadoEm: t.criado_em as string,
      concluidaEm: (t.concluida_em as string) ?? null,
      visivelCliente: (t.visivel_cliente as boolean) ?? false,
      legenda: (t.legenda as string) ?? "",
      textoArte: (t.texto_arte as string) ?? "",
      arquivos: Array.isArray(t.arquivos) ? (t.arquivos as ArquivoPeca[]) : [],
      enviadaClienteEm: (t.enviada_cliente_em as string) ?? null,
      rodadas: Number(t.rodadas ?? 0),
      feedbackCliente: (t.feedback_cliente as string) ?? null,
      feedbackEm: (t.feedback_em as string) ?? null,
      clienteAprovouEm: (t.cliente_aprovou_em as string) ?? null,
      respostasCliente: Array.isArray(t.respostas_cliente) ? (t.respostas_cliente as RespostaCliente[]) : [],
      publicarEm: (t.publicar_em as string) ?? null,
      publicadaEm: (t.publicada_em as string) ?? null,
      agendadaEm: (t.agendada_em as string) ?? null,
      rede: (t.rede as string) ?? null,
      lote: (t.lote as string) ?? null,
    }));
  }

  async salvarTarefa(t: Tarefa) {
    const org_id = await this.org();
    const { error } = await this.sb.from("tarefas").upsert(tarefaParaBanco(t, org_id));
    erro(error);
  }

  /** várias de uma vez, numa chamada só (se uma falhar, nenhuma é gravada) */
  async salvarTarefas(ts: Tarefa[]) {
    if (!ts.length) return;
    const org_id = await this.org();
    const { error } = await this.sb.from("tarefas").upsert(ts.map((t) => tarefaParaBanco(t, org_id)));
    erro(error);
  }

  async removerTarefa(id: string) {
    await this.remover("tarefas", [id]);
  }

  // ─── Fechamento do cliente ────────────────────────────────────────────────

  async listarFechamento(clienteId: string): Promise<RegistroFechamento[]> {
    const { data, error } = await this.sb.from("fechamento_passos").select("*").eq("cliente_id", clienteId);
    erro(error);
    return ((data ?? []) as Linha[]).map((r) => ({
      id: r.id as string,
      clienteId: r.cliente_id as string,
      passo: r.passo as RegistroFechamento["passo"],
      feitoEm: (r.feito_em as string) ?? null,
      feitoPorNome: (r.feito_por_nome as string) ?? null,
      link: (r.link as string) ?? null,
      data: (r.data as string) ?? null,
      observacao: (r.observacao as string) ?? null,
    }));
  }

  async salvarPassoFechamento(p: {
    clienteId: string;
    passo: RegistroFechamento["passo"];
    feito: boolean;
    link?: string | null;
    data?: string | null;
    observacao?: string | null;
  }) {
    const linha: Linha = {
      org_id: await this.org(),
      cliente_id: p.clienteId,
      passo: p.passo,
      // o banco guarda o momento e quem fez (trigger fechamento_autor)
      feito_em: p.feito ? new Date().toISOString() : null,
    };
    if (p.link !== undefined) linha.link = p.link?.trim() || null;
    if (p.data !== undefined) linha.data = p.data || null;
    if (p.observacao !== undefined) linha.observacao = p.observacao?.trim() || null;
    const { error } = await this.sb.from("fechamento_passos").upsert(linha, { onConflict: "cliente_id,passo" });
    erro(error);
  }

  // ─── Contrato (Autentique) ────────────────────────────────────────────────

  async obterModeloContrato(): Promise<ModeloContrato> {
    const { data, error } = await this.sb.from("contrato_modelo").select("*").eq("org_id", await this.org()).maybeSingle();
    erro(error);
    if (!data) return { ...MODELO_VAZIO, signatariosAden: [] };
    return {
      contratadaNome: (data.contratada_nome as string) ?? null,
      contratadaDocumento: (data.contratada_documento as string) ?? null,
      contratadaEndereco: (data.contratada_endereco as string) ?? null,
      obrigacoes: (data.obrigacoes as string) ?? null,
      disposicoes: (data.disposicoes as string) ?? null,
      signatariosAden: (data.signatarios_aden as ModeloContrato["signatariosAden"]) ?? [],
    };
  }

  async salvarModeloContrato(m: ModeloContrato) {
    const t = (x: string | null) => x?.trim() || null;
    const { error } = await this.sb.from("contrato_modelo").upsert(
      {
        org_id: await this.org(),
        contratada_nome: t(m.contratadaNome),
        contratada_documento: t(m.contratadaDocumento),
        contratada_endereco: t(m.contratadaEndereco),
        obrigacoes: t(m.obrigacoes),
        disposicoes: t(m.disposicoes),
        signatarios_aden: m.signatariosAden.map((s) => ({ nome: s.nome.trim(), email: s.email.trim().toLowerCase() })).filter((s) => s.nome || s.email),
      },
      { onConflict: "org_id" },
    );
    erro(error);
  }

  async listarContratosAssinatura(clienteId: string): Promise<ContratoEnviado[]> {
    const { data, error } = await this.sb.from("contratos_assinatura").select("*").eq("cliente_id", clienteId).order("enviado_em", { ascending: false });
    erro(error);
    return ((data ?? []) as Linha[]).map((r) => ({
      id: r.id as string,
      clienteId: r.cliente_id as string,
      autentiqueId: r.autentique_id as string,
      nome: r.nome as string,
      situacao: r.situacao as ContratoEnviado["situacao"],
      enviadoEm: r.enviado_em as string,
      enviadoPorNome: (r.enviado_por_nome as string) ?? null,
      assinadoEm: (r.assinado_em as string) ?? null,
      conferidoEm: (r.conferido_em as string) ?? null,
      faltam: (r.faltam as string[]) ?? [],
      signatarios: (r.signatarios as ContratoEnviado["signatarios"]) ?? [],
    }));
  }

  async registrarContratoAssinatura(c: { clienteId: string; autentiqueId: string; nome: string; signatarios: ContratoEnviado["signatarios"] }) {
    const { error } = await this.sb.from("contratos_assinatura").insert({
      org_id: await this.org(),
      cliente_id: c.clienteId,
      autentique_id: c.autentiqueId,
      nome: c.nome,
      signatarios: c.signatarios,
    });
    erro(error);
  }

  async atualizarContratoAssinatura(id: string, s: { situacao: SituacaoContrato | "cancelado"; assinadoEm: string | null; faltam: string[] }) {
    const { error } = await this.sb
      .from("contratos_assinatura")
      .update({ situacao: s.situacao, assinado_em: s.assinadoEm, faltam: s.faltam, conferido_em: new Date().toISOString() })
      .eq("id", id);
    erro(error);
  }

  async contratoNoServidor(pedido: { acao: "situacao" } | { acao: "enviar" | "conferir"; clienteId: string; reenviar?: boolean }) {
    const { data } = await this.sb.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Entre de novo no Aden para enviar o contrato.");
    const r = await fetch("/api/contrato", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(pedido),
    });
    const corpo = (await r.json().catch(() => null)) as { autentiqueLigada?: boolean; teste?: boolean; mensagem?: string; erro?: string } | null;
    if (!r.ok) throw new Error(corpo?.erro ?? "Não deu para falar com o servidor.");
    return { autentiqueLigada: !!corpo?.autentiqueLigada, teste: corpo?.teste, mensagem: corpo?.mensagem };
  }

  // ─── Briefing do cliente ──────────────────────────────────────────────────

  async listarPerguntasBriefing(): Promise<PerguntaBriefing[]> {
    const { data, error } = await this.sb.from("briefing_perguntas").select("*").eq("org_id", await this.org()).order("ordem");
    erro(error);
    return ((data ?? []) as Linha[]).map((p) => ({
      id: p.id as string,
      secao: p.secao as string,
      pergunta: p.pergunta as string,
      ajuda: (p.ajuda as string) ?? null,
      servicoId: (p.servico_id as string) ?? null,
      ordem: Number(p.ordem ?? 0),
      ativo: p.ativo as boolean,
    }));
  }

  async salvarPerguntaBriefing(p: PerguntaBriefing) {
    const { error } = await this.sb.from("briefing_perguntas").upsert({
      id: p.id,
      org_id: await this.org(),
      secao: p.secao.trim(),
      pergunta: p.pergunta.trim(),
      ajuda: p.ajuda?.trim() || null,
      servico_id: p.servicoId,
      ordem: p.ordem,
      ativo: p.ativo,
    });
    erro(error);
  }

  async removerPerguntaBriefing(id: string) {
    await this.remover("briefing_perguntas", [id]);
  }

  async listarRespostasBriefing(clienteId: string): Promise<RespostaBriefing[]> {
    const { data, error } = await this.sb.from("briefing_respostas").select("*").eq("cliente_id", clienteId);
    erro(error);
    return ((data ?? []) as Linha[]).map((r) => ({
      id: r.id as string,
      clienteId: r.cliente_id as string,
      perguntaId: r.pergunta_id as string,
      perguntaTexto: r.pergunta_texto as string,
      resposta: (r.resposta as string) ?? null,
      respondidoPorNome: (r.respondido_por_nome as string) ?? null,
      respondidoEm: (r.respondido_em as string) ?? null,
    }));
  }

  async responderBriefing(clienteId: string, perguntaId: string, resposta: string | null) {
    // pergunta_texto, quem e quando: o banco preenche (trigger briefing_resposta_autor)
    const { error } = await this.sb
      .from("briefing_respostas")
      .upsert(
        { org_id: await this.org(), cliente_id: clienteId, pergunta_id: perguntaId, pergunta_texto: "", resposta: resposta?.trim() || null },
        { onConflict: "cliente_id,pergunta_id" },
      );
    erro(error);
  }

  // ─── Datas comemorativas ──────────────────────────────────────────────────

  async listarDatas() {
    const org = await this.org();
    const [d, l] = await Promise.all([
      this.sb.from("datas_comemorativas").select("*").eq("org_id", org).order("data"),
      this.sb.from("datas_do_cliente").select("*").eq("org_id", org),
    ]);
    erro(d.error);
    erro(l.error);
    return {
      datas: ((d.data ?? []) as Linha[]).map((x) => ({ id: x.id as string, nome: x.nome as string, data: x.data as string, ativo: x.ativo as boolean })),
      ligacoes: ((l.data ?? []) as Linha[]).map((x) => ({
        id: x.id as string,
        dataId: x.data_id as string,
        clienteId: x.cliente_id as string,
        diasAntecedencia: x.dias_antecedencia == null ? null : Number(x.dias_antecedencia),
        nota: (x.nota as string) ?? null,
        escondida: x.escondida === true,
      })),
    };
  }

  async salvarDataComemorativa(d: DataComemorativa) {
    const { error } = await this.sb
      .from("datas_comemorativas")
      .upsert({ id: d.id, org_id: await this.org(), nome: d.nome.trim(), data: d.data, ativo: d.ativo });
    erro(error);
  }

  async removerDataComemorativa(id: string) {
    await this.remover("datas_comemorativas", [id]);
  }

  async salvarDataDoCliente(l: DataDoCliente) {
    const { error } = await this.sb.from("datas_do_cliente").upsert(
      {
        id: l.id,
        org_id: await this.org(),
        data_id: l.dataId,
        cliente_id: l.clienteId,
        dias_antecedencia: l.diasAntecedencia,
        nota: l.nota?.trim() || null,
        escondida: l.escondida,
      },
      { onConflict: "data_id,cliente_id" },
    );
    erro(error);
  }

  async removerDataDoCliente(id: string) {
    await this.remover("datas_do_cliente", [id]);
  }

  /** O que a equipe (não sócia) precisa para as tarefas: nomes, tipos de entrega e serviços. Nada de valores. */
  private async configDaEquipe(org: string): Promise<Configuracao> {
    const [nomes, tip, ser] = await Promise.all([
      this.sb.rpc("equipe_nomes", { org }),
      this.sb.from("tipos_entrega").select("*").eq("org_id", org).order("ordem"),
      this.sb.from("servicos").select("id, nome, ativo").eq("org_id", org).order("ordem"),
    ]);
    for (const r of [nomes, tip, ser]) erro(r.error);
    const n = (nomes.data ?? { pessoas: [], clientes: [] }) as { pessoas: { id: string; nome: string; socio: boolean; ativo: boolean; fotoUrl: string | null }[]; clientes: { id: string; nome: string; ativo: boolean }[] };
    const c = configVazia();
    c.pessoas = n.pessoas.map((p) => ({ id: p.id, nome: p.nome, socio: p.socio, ativo: p.ativo, fotoUrl: p.fotoUrl, percentualPadrao: null, pisoHoraCentavos: null, capacidadeHorasMes: null }));
    c.clientes = n.clientes.map((k) => ({ id: k.id, nome: k.nome, ativo: k.ativo, interno: false, participaRateio: false, valorMensalCentavos: null }));
    c.servicos = ((ser.data ?? []) as Linha[]).map((s) => ({ id: s.id as string, nome: s.nome as string, ativo: s.ativo as boolean, divisaoPadrao: {} }));
    c.tiposEntrega = ((tip.data ?? []) as Linha[]).map((t) => ({
      id: t.id as string,
      nome: t.nome as string,
      servicoId: (t.servico_id as string) ?? null,
      horasPorUnidade: num(t.horas_por_unidade),
      audiovisual: (t.audiovisual as boolean) ?? false,
      ativo: t.ativo as boolean,
      calibrarDesde: (t.calibrar_desde as string) ?? null,
      terceiroId: (t.terceiro_id as string) ?? null,
      nomeCliente: (t.nome_cliente as string) ?? null,
    }));
    return c;
  }

  // ─── Equipe e acessos ─────────────────────────────────────────────────────

  async listarEquipe(): Promise<{ membros: MembroEquipe[]; convites: Convite[] }> {
    const org = await this.org();
    const [m, c] = await Promise.all([
      this.sb.from("membros").select("id, nome, email, papel, ativo").eq("org_id", org).order("nome"),
      this.sb.from("convites").select("id, nome, email, papel, criado_em").eq("org_id", org).is("aceito_em", null).order("criado_em"),
    ]);
    erro(m.error);
    erro(c.error);
    return {
      membros: ((m.data ?? []) as Linha[]).map((x) => ({ id: x.id as string, nome: x.nome as string, email: x.email as string, papel: x.papel as string, ativo: x.ativo as boolean })),
      convites: ((c.data ?? []) as Linha[]).map((x) => ({ id: x.id as string, nome: x.nome as string, email: x.email as string, papel: x.papel as string, criadoEm: x.criado_em as string })),
    };
  }

  async convidar(nome: string, email: string, papel: string) {
    const org_id = await this.org();
    const { error } = await this.sb.from("convites").insert({ org_id, nome: nome.trim(), email: email.trim().toLowerCase(), papel });
    if (error?.code === "23505") throw new Error("Já existe um convite aberto para esse e-mail.");
    erro(error);
  }

  async cancelarConvite(id: string) {
    const { error } = await this.sb.from("convites").delete().eq("id", id);
    erro(error);
  }

  async mudarAcesso(membroId: string, patch: { papel?: string; ativo?: boolean }) {
    const eu = await this.usuarioAtual();
    const { data } = await this.sb.from("membros").select("user_id").eq("id", membroId).maybeSingle();
    if (data?.user_id === eu?.id) throw new Error("Você não pode mudar o seu próprio acesso.");
    const { error } = await this.sb.from("membros").update(patch).eq("id", membroId);
    erro(error);
  }

  // ─── Google Agenda ────────────────────────────────────────────────────────

  async listarPortas() {
    return this.listarCodigos("porta");
  }

  private async listarCodigos(uso: "porta" | "conector") {
    const { data, error } = await this.sb
      .from("portas")
      .select("id, inicio, criado_em, usado_em, cancelado_em")
      .eq("uso", uso)
      .order("criado_em", { ascending: false });
    erro(error);
    return ((data ?? []) as Linha[]).map((p) => ({
      id: p.id as string,
      inicio: p.inicio as string,
      criadoEm: p.criado_em as string,
      usadoEm: (p.usado_em as string) ?? null,
      canceladoEm: (p.cancelado_em as string) ?? null,
    }));
  }

  async gerarPorta() {
    const { data, error } = await this.sb.rpc("porta_gerar", { p_org: await this.org() });
    erro(error);
    return data as string;
  }

  async cancelarPorta(id: string) {
    const { error } = await this.sb.rpc("porta_cancelar", { p_id: id });
    erro(error);
  }

  // ─── Seu Claude (código pessoal do conector) ──────────────────────────────

  async listarCodigosClaude() {
    return this.listarCodigos("conector");
  }

  async gerarCodigoClaude() {
    const { data, error } = await this.sb.rpc("conector_gerar", { p_org: await this.org() });
    erro(error);
    return data as string;
  }

  async usoDoConector(): Promise<UsoDoConector[]> {
    const { data, error } = await this.sb.rpc("conector_uso", { p_org: await this.org() });
    erro(error);
    return (data as UsoDoConector[] | null) ?? [];
  }

  // ─── Contexto do cliente ──────────────────────────────────────────────────

  async listarContexto(clienteId: string, incluirResolvidas = false) {
    let q = this.sb.from("contexto_cliente").select("*").eq("cliente_id", clienteId).order("criado_em", { ascending: false });
    if (!incluirResolvidas) q = q.is("resolvido_em", null);
    const { data, error } = await q;
    erro(error);
    return ((data ?? []) as Linha[]).map(notaDoBanco);
  }

  async anotarContexto(n: { clienteId: string; tipo: TipoContexto; texto: string }) {
    // quem anotou vem do banco (trigger contexto_autor)
    const { data, error } = await this.sb
      .from("contexto_cliente")
      .insert({ org_id: await this.org(), cliente_id: n.clienteId, tipo: n.tipo, texto: n.texto.trim() })
      .select("*")
      .single();
    erro(error);
    return notaDoBanco(data as Linha);
  }

  async resolverContexto(id: string, resolvida: boolean) {
    const { error } = await this.sb
      .from("contexto_cliente")
      .update({ resolvido_em: resolvida ? new Date().toISOString() : null })
      .eq("id", id);
    erro(error);
  }

  async listarAgendas() {
    const { data, error } = await this.sb.from("agendas_externas").select("id, nome, url_ical").order("criado_em");
    erro(error);
    return ((data ?? []) as Linha[]).map((a) => ({ id: a.id as string, nome: a.nome as string, endereco: a.url_ical as string }));
  }

  async salvarAgenda(nome: string, enderecoIcal: string) {
    const url = enderecoIcal.trim();
    if (!enderecoDeAgendaValido(url)) throw new Error("Esse não parece o endereço secreto do Google Agenda (começa com https://calendar.google.com/calendar/ical/ e termina em .ics).");
    const org_id = await this.org();
    const { data: membro, error: e1 } = await this.sb.rpc("meu_membro", { org: org_id });
    erro(e1);
    const { error } = await this.sb.from("agendas_externas").insert({ org_id, membro_id: membro, nome: nome.trim() || "Minha agenda", url_ical: url });
    erro(error);
  }

  async removerAgenda(id: string) {
    const { error } = await this.sb.from("agendas_externas").delete().eq("id", id);
    erro(error);
  }

  async eventosAgenda(de: string, ate: string) {
    const { data } = await this.sb.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return { eventos: [], erros: [] };
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const r = await fetch(`/api/agenda?de=${de}&ate=${ate}&tz=${encodeURIComponent(tz)}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return { eventos: [], erros: ["agenda"] };
    return (await r.json()) as { eventos: EventoAgenda[]; erros: string[] };
  }

  // ─── Painel do cliente ────────────────────────────────────────────────────

  async gerarLinkPainel(clienteId: string): Promise<string> {
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    const token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    const { error } = await this.sb.from("clientes").update({ painel_token: token }).eq("id", clienteId);
    erro(error);
    return token;
  }

  async painelCliente(token: string): Promise<PainelCliente | null> {
    const { data, error } = await this.sb.rpc("painel_cliente", { p_token: token });
    erro(error);
    return (data as PainelCliente | null) ?? null;
  }

  async responderPeca(token: string, tarefaId: string, decisao: "aprovar" | "ajustar", texto: string) {
    const { error } = await this.sb.rpc("responder_peca", { p_token: token, p_tarefa: tarefaId, p_decisao: decisao, p_texto: texto });
    erro(error);
  }

  async enviarParaCliente(tarefaId: string) {
    const { error } = await this.sb
      .from("tarefas")
      .update({ status: "revisao", visivel_cliente: true, enviada_cliente_em: new Date().toISOString(), cliente_aprovou_em: null })
      .eq("id", tarefaId);
    erro(error);
  }

  async enviarArquivoPeca(tarefaId: string, arquivo: File): Promise<ArquivoPeca> {
    const org = await this.org();
    const ext = (arquivo.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
    const aleatorio = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, "0")).join("");
    const caminho = `${org}/${tarefaId}/${aleatorio}.${ext}`;
    const bucket = this.sb.storage.from("pecas");
    const { error } = await bucket.upload(caminho, arquivo, { contentType: arquivo.type, cacheControl: "31536000" });
    erro(error);
    return { url: bucket.getPublicUrl(caminho).data.publicUrl, nome: arquivo.name, tipo: arquivo.type };
  }

  // ─── CRM ──────────────────────────────────────────────────────────────────

  async listarLeads(): Promise<Lead[]> {
    const org = await this.org();
    const { data, error } = await this.sb.from("leads").select("*").eq("org_id", org).order("criado_em", { ascending: false }).limit(2000);
    erro(error);
    return ((data ?? []) as Linha[]).map((l) => ({
      id: l.id as string,
      nome: l.nome as string,
      contato: (l.contato as string) ?? "",
      telefone: (l.telefone as string) ?? "",
      email: (l.email as string) ?? "",
      instagram: (l.instagram as string) ?? "",
      origem: (l.origem as string) ?? "",
      etapa: l.etapa as Lead["etapa"],
      entrouNaEtapaEm: l.entrou_na_etapa_em as string,
      pacoteId: (l.pacote_id as string) ?? null,
      simulacaoId: (l.simulacao_id as string) ?? null,
      valorEstimadoCentavos: num(l.valor_estimado_centavos),
      responsavelId: (l.responsavel_id as string) ?? null,
      proximoContato: (l.proximo_contato as string) ?? null,
      proximaAcao: (l.proxima_acao as string) ?? "",
      observacoes: (l.observacoes as string) ?? "",
      motivoPerda: (l.motivo_perda as string) ?? "",
      clienteId: (l.cliente_id as string) ?? null,
      comercialEstruturado: (l.comercial_estruturado as boolean | null) ?? null,
      criadoEm: l.criado_em as string,
      fechadoEm: (l.fechado_em as string) ?? null,
    }));
  }

  async salvarLead(l: Lead) {
    const org_id = await this.org();
    const vazio = (t: string) => (t.trim() ? t : null);
    const { error } = await this.sb.from("leads").upsert({
      id: l.id,
      org_id,
      nome: l.nome,
      contato: vazio(l.contato),
      telefone: vazio(l.telefone),
      email: vazio(l.email),
      instagram: vazio(l.instagram),
      origem: vazio(l.origem),
      etapa: l.etapa,
      entrou_na_etapa_em: l.entrouNaEtapaEm,
      pacote_id: l.pacoteId,
      simulacao_id: l.simulacaoId,
      valor_estimado_centavos: l.valorEstimadoCentavos,
      responsavel_id: l.responsavelId,
      proximo_contato: l.proximoContato,
      proxima_acao: vazio(l.proximaAcao),
      observacoes: vazio(l.observacoes),
      motivo_perda: vazio(l.motivoPerda),
      cliente_id: l.clienteId,
      comercial_estruturado: l.comercialEstruturado ?? null,
      criado_em: l.criadoEm,
      fechado_em: l.fechadoEm,
    });
    erro(error);
  }

  async removerLead(id: string) {
    await this.remover("leads", [id]);
  }

  async listarInteracoes(leadId: string): Promise<InteracaoLead[]> {
    const { data, error } = await this.sb.from("lead_interacoes").select("*").eq("lead_id", leadId).order("em", { ascending: false });
    erro(error);
    return ((data ?? []) as Linha[]).map((i) => ({
      id: i.id as string,
      leadId: i.lead_id as string,
      tipo: i.tipo as InteracaoLead["tipo"],
      texto: i.texto as string,
      em: i.em as string,
      autorNome: (i.autor_nome as string) ?? null,
    }));
  }

  async salvarInteracao(i: InteracaoLead) {
    const org_id = await this.org();
    const autor = await this.usuarioAtual();
    const { error } = await this.sb.from("lead_interacoes").upsert({
      id: i.id,
      org_id,
      lead_id: i.leadId,
      tipo: i.tipo,
      texto: i.texto,
      em: i.em,
      autor_nome: i.autorNome ?? autor?.nome ?? null,
    });
    erro(error);
  }

  async removerInteracao(id: string) {
    await this.remover("lead_interacoes", [id]);
  }

  // ─── Pagamentos ───────────────────────────────────────────────────────────

  async listarPagamentos(): Promise<Pagamento[]> {
    const org = await this.org();
    const { data, error } = await this.sb.from("pagamentos").select("*").eq("org_id", org).order("recebido_em");
    erro(error);
    const { data: membros } = await this.sb.from("membros").select("user_id, nome").eq("org_id", org);
    const nomes = new Map(((membros ?? []) as Linha[]).map((m) => [m.user_id as string, m.nome as string]));
    return ((data ?? []) as Linha[]).map((p) => ({
      id: p.id as string,
      clienteId: p.cliente_id as string,
      competencia: (p.competencia as string).slice(0, 7),
      valorCentavos: Number(p.valor_centavos),
      recebidoEm: p.recebido_em as string,
      observacao: (p.observacao as string) ?? null,
      autor: nomes.get(p.criado_por as string) ?? null,
      criadoEm: p.criado_em as string,
      taxaCentavos: num(p.taxa_centavos),
    }));
  }

  async salvarPagamento(p: Pagamento) {
    const org_id = await this.org();
    const { error } = await this.sb.from("pagamentos").upsert({
      id: p.id,
      org_id,
      cliente_id: p.clienteId,
      competencia: `${p.competencia}-01`,
      valor_centavos: p.valorCentavos,
      recebido_em: p.recebidoEm,
      observacao: p.observacao ?? null,
      taxa_centavos: p.taxaCentavos ?? null,
    });
    erro(error);
  }

  async removerPagamento(id: string) {
    await this.remover("pagamentos", [id]);
  }
}

// ─── Conversões dos pedidos ─────────────────────────────────────────────────

function itemParaBanco(i: ItemProtegido, org_id: string): Linha {
  // os itens da sociedade são da própria configuração da organização: o registro é a organização
  const registro = i.tabela === "configuracoes_empresa" ? org_id : i.registroId;
  return { tabela: i.tabela, registro_id: registro, pessoa_id: i.pessoaId ?? null, campo: i.campo, antes: i.antes, depois: i.depois, descricao: i.descricao, org_id };
}

function itemDoBanco(i: Linha): ItemProtegido {
  return {
    tabela: i.tabela as ItemProtegido["tabela"],
    registroId: i.registro_id as string,
    pessoaId: (i.pessoa_id as string) ?? undefined,
    campo: i.campo as ItemProtegido["campo"],
    antes: num(i.antes),
    depois: num(i.depois),
    descricao: (i.descricao as string) ?? "",
  };
}

function dadosDoBanco(d: Linha | null): DadosExcecao | null {
  if (!d) return null;
  return {
    aplicar: d.aplicar as DadosExcecao["aplicar"],
    cenario: d.cenario as Cenario,
    valorCentavos: num(d.valor_centavos),
    perdas: (d.perdas as DadosExcecao["perdas"]) ?? [],
  };
}

function pedidoDoBanco(d: unknown): ResultadoPedido {
  const x = d as { pedido_id: string; status: StatusPedido; aguardando: string[] | null };
  return { pedidoId: x.pedido_id, status: x.status, aguardando: x.aguardando ?? [] };
}
