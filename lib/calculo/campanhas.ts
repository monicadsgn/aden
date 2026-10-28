// Campanhas (28/10/2026): cada página de captação, oferta ou anúncio tem uma ficha com status e história.
// Os textos são livres: as regras da oferta ainda vão ser definidas pelos sócios. Nada aqui tem número de negócio.
// Nada se apaga: campanha encerrada vira "arquivada".

export type StatusCampanha = "ativa" | "pausada" | "arquivada";
export type TipoCampanha = "quiz" | "outra";

export interface Campanha {
  id: string;
  nome: string;
  /** "quiz" é o quiz de conversão (a configuração dele mora em quiz_config); "outra" é qualquer outra página ou oferta */
  tipo: TipoCampanha;
  status: StatusCampanha;
  /** o que o anúncio e a página prometem para quem chega */
  promete: string;
  /** quem pode entrar (e quem não pode) */
  quemEntra: string;
  regras: string;
  /** serviços que a oferta cobre */
  servicos: string;
  /** quantos clientes dessa oferta cabem por vez; vazio = sem limite combinado */
  limiteClientes: number | null;
  paginaUrl: string;
  notas: string;
  criadaEm: string;
  arquivadaEm: string | null;
}

export const STATUS_CAMPANHA: { valor: StatusCampanha; rotulo: string; explica: string }[] = [
  { valor: "ativa", rotulo: "Ativa", explica: "Está rodando ou pronta para rodar." },
  { valor: "pausada", rotulo: "Pausada", explica: "Parada por enquanto; dá para reativar." },
  { valor: "arquivada", rotulo: "Arquivada", explica: "Encerrada. Fica guardada para consulta." },
];

export function rotuloStatus(s: StatusCampanha): string {
  return STATUS_CAMPANHA.find((x) => x.valor === s)?.rotulo ?? s;
}

export function novaCampanha(id: string, nome: string, base: Partial<Campanha> = {}, agora = new Date()): Campanha {
  return {
    id,
    nome: nome.trim(),
    tipo: "outra",
    status: "ativa",
    promete: "",
    quemEntra: "",
    regras: "",
    servicos: "",
    limiteClientes: null,
    paginaUrl: "",
    notas: "",
    criadaEm: agora.toISOString(),
    arquivadaEm: null,
    ...base,
  };
}

/** Muda o status guardando quando foi arquivada (e limpando se voltar). */
export function mudarStatusCampanha(c: Campanha, status: StatusCampanha, agora = new Date()): Campanha {
  if (c.status === status) return c;
  return { ...c, status, arquivadaEm: status === "arquivada" ? agora.toISOString() : null };
}

/** Só https, para o link da página nunca virar um endereço perigoso. Vazio é permitido. */
export function paginaUrlValida(url: string): boolean {
  const u = url.trim();
  if (!u) return true;
  if (u.length > 300) return false;
  return /^https:\/\/[^\s]+$/i.test(u);
}

/** Ativas primeiro, depois pausadas, depois arquivadas; dentro de cada grupo, a mais nova primeiro. */
export function ordenarCampanhas(lista: Campanha[]): Campanha[] {
  const peso: Record<StatusCampanha, number> = { ativa: 0, pausada: 1, arquivada: 2 };
  return [...lista].sort((a, b) => peso[a.status] - peso[b.status] || b.criadaEm.localeCompare(a.criadaEm));
}

/** O que a campanha ainda não diz (lembrete, nunca erro). */
export function faltaDefinir(c: Campanha): string[] {
  const f: string[] = [];
  if (!c.promete.trim()) f.push("o que a campanha promete");
  if (!c.quemEntra.trim()) f.push("quem pode entrar");
  if (!c.regras.trim()) f.push("as regras");
  if (c.limiteClientes == null) f.push("o limite de clientes");
  return f;
}
