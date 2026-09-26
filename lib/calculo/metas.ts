// Trilha de crescimento (Visão do mês).
//
// Metas em degraus, definidas pelos sócios (o sistema nunca cadastra sozinho). Cada degrau
// tem um critério, um alvo e uma ação ligada ("primeira terceirização"…). Valor atual:
// - faturamento_mensal: soma do valor mensal dos clientes ativos (não internos)
// - clientes: quantos clientes ativos (não internos)
// - recebido_socio: o MENOR valor mensal entre os sócios (a meta vale para cada um),
//   somando o que cada contrato ativo com escopo deixa para ele
// - uso_capacidade: horas usadas ÷ capacidade, somando todos os sócios (%)
//
// Espaço pra vender: "cabem mais N clientes do pacote padrão" = para cada sócio com horas
// no pacote, horas livres ÷ horas do pacote; N = o menor (arredondado para baixo).

import { calcularVisaoMes, escopoDoCliente, type VisaoMes } from "./mes";
import { calcularCenario } from "./motor";
import { pacoteParaCenario } from "./pacotes";
import type { Configuracao, CriterioMeta, Id, Meta, Pacote } from "./tipos";

const v0 = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? 0 : v);
const EPS = 1e-6;

export const CRITERIOS: { valor: CriterioMeta; rotulo: string; unidade: "moeda" | "numero" | "pct" }[] = [
  { valor: "faturamento_mensal", rotulo: "Faturamento mensal", unidade: "moeda" },
  { valor: "clientes", rotulo: "Número de clientes", unidade: "numero" },
  { valor: "recebido_socio", rotulo: "Quanto cada sócio recebe no mês", unidade: "moeda" },
  { valor: "uso_capacidade", rotulo: "Uso da capacidade", unidade: "pct" },
];
export const unidadeDoCriterio = (c: CriterioMeta) => CRITERIOS.find((x) => x.valor === c)!.unidade;

/** Quanto cada sócio recebe por mês somando os contratos ativos que têm escopo e valor. */
export function recebidoPorSocio(config: Configuracao): Map<Id, number> {
  const socios = config.pessoas.filter((p) => p.ativo && p.socio);
  const out = new Map<Id, number>(socios.map((p) => [p.id, 0]));
  for (const c of config.clientes.filter((x) => x.ativo && x.escopo && v0(x.valorMensalCentavos) > 0)) {
    const r = calcularCenario(config, { ...escopoDoCliente(c), modo: "valor", mensalidadeCentavos: c.valorMensalCentavos });
    for (const p of r.mes?.pessoas ?? []) if (out.has(p.id)) out.set(p.id, out.get(p.id)! + v0(p.valorCentavos));
  }
  return out;
}

export function valorAtualDaMeta(config: Configuracao, criterio: CriterioMeta, visao: VisaoMes = calcularVisaoMes(config)): number | null {
  const pagantes = config.clientes.filter((c) => c.ativo && !c.interno);
  switch (criterio) {
    case "faturamento_mensal":
      return pagantes.reduce((a, c) => a + v0(c.valorMensalCentavos), 0);
    case "clientes":
      return pagantes.length;
    case "recebido_socio": {
      const v = [...recebidoPorSocio(config).values()];
      return v.length ? Math.min(...v) : null;
    }
    case "uso_capacidade": {
      const com = visao.socios.filter((s) => s.capacidadeHorasMes != null);
      const cap = com.reduce((a, s) => a + s.capacidadeHorasMes!, 0);
      return cap > 0 ? (com.reduce((a, s) => a + s.horasUsadas, 0) / cap) * 100 : null;
    }
  }
}

export interface DegrauTrilha {
  meta: Meta;
  valor: number | null;
  /** 0 a 100 */
  progressoPct: number | null;
  /** quanto falta para o alvo (0 quando batido) */
  falta: number | null;
  batida: boolean;
  /** batida agora mas ainda sem data guardada: a tela guarda a conquista */
  conquistarAgora: boolean;
}

export interface Trilha {
  degraus: DegrauTrilha[];
  /** índice do degrau em que a empresa está (o primeiro não conquistado); null = todos conquistados ou sem metas */
  atual: number | null;
}

export function calcularTrilha(config: Configuracao, visao: VisaoMes = calcularVisaoMes(config)): Trilha {
  const metas = config.metas ?? [];
  const degraus = metas.map((meta): DegrauTrilha => {
    if (!meta.criterio || meta.alvo == null || meta.alvo <= 0)
      return { meta, valor: null, progressoPct: null, falta: null, batida: !!meta.conquistadaEm, conquistarAgora: false };
    const valor = valorAtualDaMeta(config, meta.criterio, visao);
    const batidaAgora = valor != null && valor >= meta.alvo - EPS;
    return {
      meta,
      valor,
      progressoPct: valor == null ? null : Math.max(0, Math.min(100, (valor / meta.alvo) * 100)),
      falta: valor == null ? null : Math.max(0, meta.alvo - valor),
      // conquista fica guardada: se o número cair depois, o degrau continua conquistado
      batida: !!meta.conquistadaEm || batidaAgora,
      conquistarAgora: batidaAgora && !meta.conquistadaEm,
    };
  });
  const i = degraus.findIndex((d) => !d.batida);
  return { degraus, atual: i >= 0 ? i : null };
}

export interface EspacoPraVender {
  pacote: Pacote;
  /** null = não dá para saber (falta capacidade de alguém que trabalha no pacote, ou o pacote não tem horas) */
  cabem: number | null;
  /** sócio que limita (o que tem menos espaço) */
  limitantePessoaId: Id | null;
  /** o que falta para dar a conta */
  faltando: string[];
}

export function espacoPraVender(config: Configuracao, pacote: Pacote, visao: VisaoMes = calcularVisaoMes(config)): EspacoPraVender {
  const r = calcularCenario(config, pacoteParaCenario(pacote));
  const horasPacote = new Map<Id, number>();
  for (const s of r.mes?.pessoas ?? []) if (s.horas > EPS) horasPacote.set(s.id, s.horas);
  const faltando: string[] = [];
  if (!r.mes) faltando.push("configuração para calcular o pacote");
  else if (!horasPacote.size) faltando.push(`tempo das entregas do pacote "${pacote.nome}"`);
  let cabem: number | null = null;
  let limitante: Id | null = null;
  for (const [id, h] of horasPacote) {
    const s = visao.socios.find((x) => x.id === id);
    if (!s) continue;
    if (s.horasLivres == null) {
      faltando.push(`horas por mês de ${s.nome}`);
      continue;
    }
    const n = Math.max(0, Math.floor(s.horasLivres / h + EPS));
    if (cabem == null || n < cabem) {
      cabem = n;
      limitante = id;
    }
  }
  return { pacote, cabem: faltando.length ? null : cabem, limitantePessoaId: faltando.length ? null : limitante, faltando };
}
