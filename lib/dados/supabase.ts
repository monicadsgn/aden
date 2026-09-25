// Implementação real: Supabase (Postgres + Auth). As permissões e o registro
// de auditoria são garantidos pelo banco (RLS + triggers), não por este código.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Cenario, ClienteBase, Configuracao, CustoFixo, Pessoa, ResultadoCenario, Servico, TipoEntrega } from "../calculo/tipos";
import type { AlteracoesConfig, RegistroAuditoria, Repositorio, ResumoSimulacao, Simulacao, Usuario } from "./repositorio";

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
    if (!m) return { id: user.id, nome: user.email ?? "", email: user.email ?? "", papel: "sem_vinculo" };
    this.orgId = m.org_id as string;
    this.usuario = { id: user.id, nome: m.nome as string, email: m.email as string, papel: m.papel as string };
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
        reinvestimentoPct: num(e?.reinvestimento_pct),
        impostoPct: num(e?.imposto_pct),
        taxaRecebimentoPct: num(e?.taxa_recebimento_pct),
        regraRateio: (e?.regra_rateio as Configuracao["empresa"]["regraRateio"]) ?? null,
      },
      pessoas: ((pes.data ?? []) as Linha[]).map((p) => ({
        id: p.id as string,
        nome: p.nome as string,
        socio: p.socio as boolean,
        percentualPadrao: num(p.percentual_padrao),
        pisoHoraCentavos: num(p.piso_hora_centavos),
        capacidadeHorasMes: num(p.capacidade_horas_mes),
        ativo: p.ativo as boolean,
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
        };
      }),
    };
  }

  async salvarConfig(a: AlteracoesConfig) {
    const org_id = await this.org();

    if (a.empresa) {
      const { error } = await this.sb.from("configuracoes_empresa").upsert({
        org_id,
        reinvestimento_pct: a.empresa.reinvestimentoPct,
        imposto_pct: a.empresa.impostoPct,
        taxa_recebimento_pct: a.empresa.taxaRecebimentoPct,
        regra_rateio: a.empresa.regraRateio,
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
}
