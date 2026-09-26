// Implementação real: Supabase (Postgres + Auth). As permissões e o registro
// de auditoria são garantidos pelo banco (RLS + triggers), não por este código.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Medicao } from "../calculo/calibragem";
import type { Tarefa } from "../calculo/tarefas";
import type { RegistroMesCliente } from "../calculo/mes";
import type { Pagamento } from "../calculo/pagamentos";
import type { Cenario, ClienteBase, Configuracao, CustoFixo, Pessoa, ResultadoCenario, Servico, TipoEntrega } from "../calculo/tipos";
import { separarProtegidas, type ItemProtegido } from "../regras/aprovacao";
import { avisosDaMudanca } from "./acoes";
import type {
  AlteracoesConfig,
  AvisoSocio,
  DadosExcecao,
  Membro,
  NovoAviso,
  Pedido,
  RegistroAuditoria,
  Repositorio,
  ResultadoPedido,
  ResultadoSalvarConfig,
  ResumoSimulacao,
  Simulacao,
  StatusPedido,
  Usuario,
} from "./repositorio";

type Linha = Record<string, unknown>;

const num = (v: unknown): number | null => (v == null ? null : Number(v));

function erro(e: { message: string } | null) {
  if (e) throw new Error(e.message);
}

export class RepositorioSupabase implements Repositorio {
  readonly modo = "supabase" as const;
  private sb: SupabaseClient;
  private orgId: string | null = null;
  private usuario: Usuario | null = null;

  /** `servidor`: sem guardar sessão no navegador (uso pelo conector MCP). */
  constructor(url: string, chave: string, opcoes: { servidor?: boolean } = {}) {
    this.sb = createClient(url, chave, {
      auth: opcoes.servidor
        ? { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
        : { persistSession: true, autoRefreshToken: true },
    });
  }

  private async org(): Promise<string> {
    if (this.orgId) return this.orgId;
    await this.usuarioAtual();
    if (!this.orgId) throw new Error("Seu usuário não está vinculado à Aden. Peça a um sócio para vincular.");
    return this.orgId;
  }

  async usuarioAtual(): Promise<Usuario | null> {
    if (this.usuario) return this.usuario;
    const { data } = await this.sb.auth.getSession();
    const user = data.session?.user;
    if (!user) return null;
    const { data: m, error } = await this.sb
      .from("membros")
      .select("id, org_id, nome, email, papel")
      .eq("user_id", user.id)
      .eq("ativo", true)
      .limit(1)
      .maybeSingle();
    erro(error);
    if (!m) return { id: user.id, nome: user.email ?? "", email: user.email ?? "", papel: "sem_vinculo", pessoaId: null };
    this.orgId = m.org_id as string;
    const pes = await this.sb.from("pessoas").select("id, foto_url").eq("membro_id", m.id as string).limit(1).maybeSingle();
    this.usuario = {
      id: user.id,
      nome: m.nome as string,
      email: m.email as string,
      papel: m.papel as string,
      pessoaId: (pes.data?.id as string | undefined) ?? null,
      fotoUrl: (pes.data?.foto_url as string | undefined) ?? null,
    };
    return this.usuario;
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
    const [emp, pes, ser, div, tip, cus, cli, con] = await Promise.all([
      this.sb.from("configuracoes_empresa").select("*").eq("org_id", org).maybeSingle(),
      this.sb.from("pessoas").select("*").eq("org_id", org).order("ordem"),
      this.sb.from("servicos").select("*").eq("org_id", org).order("ordem"),
      this.sb.from("servico_divisao").select("*").eq("org_id", org),
      this.sb.from("tipos_entrega").select("*").eq("org_id", org).order("ordem"),
      this.sb.from("custos_fixos").select("*").eq("org_id", org).order("nome"),
      this.sb.from("clientes").select("*").eq("org_id", org).order("nome"),
      this.sb.from("contratos").select("*").eq("org_id", org).eq("status", "ativo"),
    ]);
    for (const r of [emp, pes, ser, div, tip, cus, cli, con]) erro(r.error);

    const e = emp.data as Linha | null;
    const divisoes = (div.data ?? []) as Linha[];
    const contratos = (con.data ?? []) as Linha[];

    return {
      empresa: {
        regime: (e?.regime as Configuracao["empresa"]["regime"]) ?? null,
        ordemDistribuicao: (e?.ordem_distribuicao as Configuracao["empresa"]["ordemDistribuicao"]) ?? null,
        medicoesCalibragem: num(e?.medicoes_calibragem),
        diferencaSugerirPct: num(e?.diferenca_sugerir_pct),
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
      })),
      custosFixos: ((cus.data ?? []) as Linha[]).map((c) => ({
        id: c.id as string,
        nome: c.nome as string,
        valorMensalCentavos: num(c.valor_mensal_centavos),
        ativo: c.ativo as boolean,
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
        };
      }),
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
        p_itens: sep.itens.map(itemParaBanco),
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
        medicoes_calibragem: a.empresa.medicoesCalibragem ?? null,
        diferenca_sugerir_pct: a.empresa.diferencaSugerirPct ?? null,
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
      })),
    );
    // valor mensal mora no contrato ativo do cliente
    for (const c of a.clientes.salvar) {
      const { data, error } = await this.sb
        .from("contratos")
        .select("id, valor_mensal_centavos")
        .eq("cliente_id", c.id)
        .eq("status", "ativo")
        .maybeSingle();
      erro(error);
      if (data) {
        if (num(data.valor_mensal_centavos) !== c.valorMensalCentavos) {
          const r = await this.sb.from("contratos").update({ valor_mensal_centavos: c.valorMensalCentavos }).eq("id", data.id);
          erro(r.error);
        }
      } else if (c.valorMensalCentavos != null) {
        const r = await this.sb
          .from("contratos")
          .insert({ org_id, cliente_id: c.id, status: "ativo", valor_mensal_centavos: c.valorMensalCentavos });
        erro(r.error);
      }
    }

    // remoções por último, na ordem inversa das dependências
    await this.remover("clientes", a.clientes.remover);
    await this.remover("custos_fixos", a.custosFixos.remover);
    await this.remover("tipos_entrega", a.tiposEntrega.remover);
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
    }));
  }

  async salvarTarefa(t: Tarefa) {
    const org_id = await this.org();
    const { error } = await this.sb.from("tarefas").upsert({
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
    });
    erro(error);
  }

  async removerTarefa(id: string) {
    await this.remover("tarefas", [id]);
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
    });
    erro(error);
  }

  async removerPagamento(id: string) {
    await this.remover("pagamentos", [id]);
  }
}

// ─── Conversões dos pedidos ─────────────────────────────────────────────────

function itemParaBanco(i: ItemProtegido): Linha {
  return { tabela: i.tabela, registro_id: i.registroId, pessoa_id: i.pessoaId ?? null, campo: i.campo, antes: i.antes, depois: i.depois, descricao: i.descricao };
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
