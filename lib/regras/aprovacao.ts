// Proteção da remuneração dos sócios. As regras valem igual para os dois.
//
// Campos protegidos: piso por hora, % de cada sócio, divisão de horas por serviço,
// horas por tipo de entrega e os números da regra da sociedade (29/09/2026). Mudar um deles só vale depois que o sócio afetado aprovar;
// até lá vale o valor antigo. Se quem mudou é o próprio (e único) afetado, vale na hora.
// Primeiro preenchimento (campo vazio) vale na hora, com aviso. O banco repete essas
// regras (supabase/migrations/0004 a 0009) — aqui é a mesma conta, para a tela e o modo local.

import { calcularComReceita, prepararMes } from "../calculo/motor";
import { escopoDoCliente } from "../calculo/mes";
import type { Cenario, Configuracao, Id, ResultadoCenario } from "../calculo/tipos";
import type { AlteracoesConfig } from "../dados/repositorio";

export type TabelaProtegida = "pessoas" | "servico_divisao" | "tipos_entrega" | "configuracoes_empresa";
export type CampoProtegido =
  | "piso_hora_centavos"
  | "percentual_padrao"
  | "percentual"
  | "horas_por_unidade"
  // regra da sociedade (29/09/2026)
  | "sociedade_pct_socio"
  | "sociedade_teto_virada_centavos"
  | "sociedade_aviso_bonus_centavos"
  | "trafego_proprio_minimo_centavos"
  | "sociedade_sobra_trafego_pct";

/** Campos protegidos da regra da sociedade: coluna no banco ↔ campo na configuração. */
export const CAMPOS_SOCIEDADE: { campo: CampoProtegido; chave: keyof Configuracao["empresa"]; rotulo: string }[] = [
  { campo: "sociedade_pct_socio", chave: "sociedadePctSocio", rotulo: "Percentual do sócio antes da virada" },
  { campo: "sociedade_teto_virada_centavos", chave: "sociedadeTetoViradaCentavos", rotulo: "Faturamento da virada para a divisão igual" },
  { campo: "sociedade_aviso_bonus_centavos", chave: "sociedadeAvisoBonusCentavos", rotulo: "Valor a partir do qual a parte vira bônus" },
  { campo: "trafego_proprio_minimo_centavos", chave: "trafegoProprioMinimoCentavos", rotulo: "Mínimo do tráfego próprio" },
  { campo: "sociedade_sobra_trafego_pct", chave: "sociedadeSobraTrafegoPct", rotulo: "Parte da sobra que vai para o tráfego" },
];

export interface ItemProtegido {
  tabela: TabelaProtegida;
  /** pessoa, serviço ou tipo de entrega */
  registroId: Id;
  /** só na divisão de serviço: de qual sócio */
  pessoaId?: Id;
  campo: CampoProtegido;
  antes: number | null;
  depois: number | null;
  /** frase curta: "Piso por hora de Mônica" */
  descricao: string;
}

export const REGRAS_PROTECAO =
  "Piso, percentual de cada sócio, divisão de horas por serviço, tempo por entrega e os números da regra da sociedade são protegidos: mudar só vale depois que o sócio afetado aprovar. Até lá vale o valor antigo. Se quem mudou é o próprio afetado, vale na hora. Campo vazio pode ser preenchido direto. Todo sócio afetado é avisado de quanto muda no bolso dele, e o histórico não se apaga.";

const socio = (c: Configuracao, id: Id) => c.pessoas.find((p) => p.id === id);

/** Quem é afetado por um item (pessoas). */
export function afetadosDoItem(config: Configuracao, item: ItemProtegido): Id[] {
  switch (item.campo) {
    case "piso_hora_centavos":
      return [item.registroId];
    case "percentual_padrao":
      return config.pessoas.filter((p) => p.ativo && p.socio).map((p) => p.id);
    case "percentual":
      return item.pessoaId ? [item.pessoaId] : [];
    case "horas_por_unidade": {
      const tipo = config.tiposEntrega.find((t) => t.id === item.registroId);
      const serv = config.servicos.find((s) => s.id === tipo?.servicoId);
      return Object.entries(serv?.divisaoPadrao ?? {})
        .filter(([, v]) => v != null && v > 0)
        .map(([id]) => id);
    }
    // quanto da sobra vai para o tráfego: só quem fica com a sobra decide
    case "sociedade_sobra_trafego_pct":
      return config.empresa.socioSobraId ? [config.empresa.socioSobraId] : config.pessoas.filter((p) => p.ativo && p.socio).map((p) => p.id);
    // os outros números da sociedade mexem no bolso dos dois
    default:
      return config.pessoas.filter((p) => p.ativo && p.socio).map((p) => p.id);
  }
}

export function afetados(config: Configuracao, itens: ItemProtegido[]): Id[] {
  return [...new Set(itens.flatMap((i) => afetadosDoItem(config, i)))];
}

/** Quem ainda precisa aprovar: os afetados, menos quem fez a mudança. */
export function aprovadoresPendentes(config: Configuracao, itens: ItemProtegido[], autorPessoaId: Id | null): Id[] {
  return afetados(config, itens).filter((id) => id !== autorPessoaId);
}

const igual = (a: number | null | undefined, b: number | null | undefined) =>
  (a ?? null) === (b ?? null) || (a != null && b != null && Math.abs(a - b) < 1e-9);

export interface Separacao {
  /** o que pode ser salvo agora (campos protegidos com mudança pendente voltam ao valor antigo) */
  alteracoes: AlteracoesConfig;
  /** mudanças protegidas que precisam de aprovação (ou valem na hora se o autor é o único afetado) */
  itens: ItemProtegido[];
  /** campos protegidos que estavam vazios: valem na hora, mas geram aviso */
  primeirosPreenchimentos: ItemProtegido[];
}

/**
 * Separa o que é mudança protegida. Mudanças de % dos sócios andam juntas (senão a soma
 * quebra), e o mesmo vale para a divisão de um serviço: se uma linha do grupo precisa de
 * aprovação, o grupo inteiro espera junto.
 */
export function separarProtegidas(antes: Configuracao, alt: AlteracoesConfig): Separacao {
  const itens: ItemProtegido[] = [];
  const primeiros: ItemProtegido[] = [];
  const out: AlteracoesConfig = structuredClone(alt);

  // Sócios: piso (individual) e % (em grupo)
  const grupoPct: { item: ItemProtegido; idx: number }[] = [];
  out.pessoas.salvar = out.pessoas.salvar.map((p, idx) => {
    const a = socio(antes, p.id);
    if (!a) return p;
    const nova = { ...p };
    if (!igual(a.pisoHoraCentavos, p.pisoHoraCentavos)) {
      const item: ItemProtegido = {
        tabela: "pessoas",
        registroId: p.id,
        campo: "piso_hora_centavos",
        antes: a.pisoHoraCentavos,
        depois: p.pisoHoraCentavos,
        descricao: `Piso por hora de ${a.nome}`,
      };
      if (a.pisoHoraCentavos == null) primeiros.push(item);
      else {
        itens.push(item);
        nova.pisoHoraCentavos = a.pisoHoraCentavos;
      }
    }
    if (!igual(a.percentualPadrao, p.percentualPadrao))
      grupoPct.push({
        idx,
        item: {
          tabela: "pessoas",
          registroId: p.id,
          campo: "percentual_padrao",
          antes: a.percentualPadrao,
          depois: p.percentualPadrao,
          descricao: `Percentual de ${a.nome}`,
        },
      });
    return nova;
  });
  if (grupoPct.some((g) => g.item.antes != null)) {
    for (const g of grupoPct) {
      itens.push(g.item);
      out.pessoas.salvar[g.idx] = { ...out.pessoas.salvar[g.idx], percentualPadrao: g.item.antes };
    }
  } else primeiros.push(...grupoPct.map((g) => g.item));

  // Serviços: divisão de horas (em grupo por serviço)
  out.servicos.salvar = out.servicos.salvar.map((s) => {
    const a = antes.servicos.find((x) => x.id === s.id);
    if (!a) return s;
    const ids = new Set([...Object.keys(a.divisaoPadrao), ...Object.keys(s.divisaoPadrao)]);
    const grupo: ItemProtegido[] = [];
    for (const pid of ids) {
      const va = a.divisaoPadrao[pid] ?? null;
      const vd = s.divisaoPadrao[pid] ?? null;
      if (igual(va, vd)) continue;
      grupo.push({
        tabela: "servico_divisao",
        registroId: s.id,
        pessoaId: pid,
        campo: "percentual",
        antes: va,
        depois: vd,
        descricao: `Horas de ${socio(antes, pid)?.nome ?? "sócio"} em ${a.nome}`,
      });
    }
    if (!grupo.some((g) => g.antes != null)) {
      primeiros.push(...grupo);
      return s;
    }
    itens.push(...grupo);
    return { ...s, divisaoPadrao: { ...a.divisaoPadrao } };
  });

  // Tipos de entrega: tempo por entrega
  out.tiposEntrega.salvar = out.tiposEntrega.salvar.map((t) => {
    const a = antes.tiposEntrega.find((x) => x.id === t.id);
    if (!a || igual(a.horasPorUnidade, t.horasPorUnidade)) return t;
    const item: ItemProtegido = {
      tabela: "tipos_entrega",
      registroId: t.id,
      campo: "horas_por_unidade",
      antes: a.horasPorUnidade,
      depois: t.horasPorUnidade,
      descricao: `Tempo por entrega de ${a.nome}`,
    };
    if (a.horasPorUnidade == null) {
      primeiros.push(item);
      return t;
    }
    itens.push(item);
    return { ...t, horasPorUnidade: a.horasPorUnidade };
  });

  // Regra da sociedade: números protegidos; quem é quem não muda depois de escolhido
  if (out.empresa) {
    const ea = antes.empresa;
    const ed = { ...out.empresa };
    for (const f of CAMPOS_SOCIEDADE) {
      const va = ea[f.chave] as number | null | undefined;
      const vd = ed[f.chave] as number | null | undefined;
      if (igual(va, vd)) continue;
      const item: ItemProtegido = { tabela: "configuracoes_empresa", registroId: "empresa", campo: f.campo, antes: va ?? null, depois: vd ?? null, descricao: f.rotulo };
      if (va == null) primeiros.push(item);
      else {
        itens.push(item);
        (ed as unknown as Record<string, unknown>)[f.chave] = va;
      }
    }
    if (ea.socioPercentualId) ed.socioPercentualId = ea.socioPercentualId;
    if (ea.socioSobraId) ed.socioSobraId = ea.socioSobraId;
    out.empresa = ed;
  }

  // linhas que ficaram iguais ao original não precisam ir para o banco
  const mesmo = <T extends { id: string }>(lista: T[], orig: T[]) => lista.filter((x) => JSON.stringify(orig.find((o) => o.id === x.id)) !== JSON.stringify(x));
  out.pessoas.salvar = mesmo(out.pessoas.salvar, antes.pessoas);
  out.servicos.salvar = mesmo(out.servicos.salvar, antes.servicos);
  out.tiposEntrega.salvar = mesmo(out.tiposEntrega.salvar, antes.tiposEntrega);

  return { alteracoes: out, itens, primeirosPreenchimentos: primeiros };
}

/** Aplica itens protegidos numa configuração (para calcular impacto, ou no modo local). */
export function aplicarItens(config: Configuracao, itens: ItemProtegido[], valor: "antes" | "depois" = "depois"): Configuracao {
  const c = structuredClone(config);
  for (const i of itens) {
    const v = i[valor];
    if (i.tabela === "pessoas") {
      const p = c.pessoas.find((x) => x.id === i.registroId);
      if (!p) continue;
      if (i.campo === "piso_hora_centavos") p.pisoHoraCentavos = v;
      else p.percentualPadrao = v;
    } else if (i.tabela === "servico_divisao") {
      const s = c.servicos.find((x) => x.id === i.registroId);
      if (s && i.pessoaId) s.divisaoPadrao = { ...s.divisaoPadrao, [i.pessoaId]: v };
    } else if (i.tabela === "configuracoes_empresa") {
      const f = CAMPOS_SOCIEDADE.find((x) => x.campo === i.campo);
      if (f) (c.empresa as unknown as Record<string, unknown>)[f.chave] = v;
    } else {
      const t = c.tiposEntrega.find((x) => x.id === i.registroId);
      if (t) t.horasPorUnidade = v;
    }
  }
  return c;
}

/** Quanto cada sócio recebe por mês somando os clientes ativos com escopo e valor. */
export function recebeNoMes(config: Configuracao): Record<Id, number> {
  const out: Record<Id, number> = {};
  for (const cli of config.clientes.filter((c) => c.ativo && c.valorMensalCentavos != null)) {
    const prep = prepararMes(config, escopoDoCliente(cli));
    if (prep.bloqueio) continue;
    const r = calcularComReceita(prep, cli.valorMensalCentavos!);
    for (const p of r.pessoas) if (p.valorCentavos != null) out[p.id] = (out[p.id] ?? 0) + p.valorCentavos;
  }
  return out;
}

/** Quanto muda no bolso de cada sócio por mês (depois − antes), pelos clientes de hoje. */
export function impactoNoBolso(antes: Configuracao, depois: Configuracao): Record<Id, number> {
  const a = recebeNoMes(antes);
  const d = recebeNoMes(depois);
  const ids = new Set([...Object.keys(a), ...Object.keys(d), ...depois.pessoas.filter((p) => p.socio).map((p) => p.id)]);
  return Object.fromEntries([...ids].map((id) => [id, (d[id] ?? 0) - (a[id] ?? 0)]));
}

// ─── Exceção: escopo ou proposta abaixo do piso ─────────────────────────────

export interface SocioAbaixo {
  pessoaId: Id;
  nome: string;
  valorHoraCentavos: number | null;
  pisoHoraCentavos: number;
  /** quanto falta por mês para chegar ao piso */
  perdaMensalCentavos: number;
}

export function sociosAbaixoDoPiso(config: Configuracao, r: ResultadoCenario): SocioAbaixo[] {
  if (!r.mes) return [];
  return r.mes.pessoas
    .filter((p) => p.abaixoPiso && p.pisoHoraCentavos != null && config.pessoas.find((x) => x.id === p.id)?.socio)
    .map((p) => ({
      pessoaId: p.id,
      nome: p.nome,
      valorHoraCentavos: p.valorHoraCentavos,
      pisoHoraCentavos: p.pisoHoraCentavos!,
      perdaMensalCentavos: Math.max(0, p.horas * p.pisoHoraCentavos! - (p.valorCentavos ?? 0)),
    }));
}

/** Impressão digital do conteúdo do cenário (sem id e nome): a exceção aprovada vale só para este conteúdo. */
export function assinaturaCenario(c: Cenario): string {
  const semId = (x: unknown): unknown =>
    Array.isArray(x)
      ? x.map(semId)
      : x && typeof x === "object"
        ? Object.fromEntries(
            Object.entries(x as Record<string, unknown>)
              .filter(([k]) => k !== "id" && k !== "nome")
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, v]) => [k, semId(v)]),
          )
        : x;
  const texto = JSON.stringify(semId(c));
  let h = 5381;
  for (let i = 0; i < texto.length; i++) h = ((h << 5) + h + texto.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/**
 * Apagar também é mudar (G8 da auditoria, 01/10/2026): sócio, serviço com divisão de horas e tipo de entrega com tempo
 * cadastrado não se apagam, só se desativam (o número continua guardado). O banco trava igual (migration 0034).
 * Devolve a frase do motivo, ou null quando pode apagar.
 */
export function motivoNaoApagar(config: Configuracao, tipo: "socio" | "servico" | "tipo_entrega", id: string): string | null {
  if (tipo === "socio") {
    const p = config.pessoas.find((x) => x.id === id);
    return p?.socio ? `${p.nome} é sócio: apagar muda a divisão entre os sócios. Isso só se decide com os dois.` : null;
  }
  if (tipo === "servico") {
    const s = config.servicos.find((x) => x.id === id);
    return s && Object.values(s.divisaoPadrao).some((v) => (v ?? 0) > 0)
      ? `O serviço "${s.nome}" tem divisão de horas entre os sócios (protegida): desative em vez de apagar.`
      : null;
  }
  const t = config.tiposEntrega.find((x) => x.id === id);
  return t && t.horasPorUnidade != null ? `O tipo "${t.nome}" tem tempo cadastrado (protegido): desative em vez de apagar.` : null;
}
