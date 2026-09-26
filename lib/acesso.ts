// Perfis de acesso. Hoje só existe "sócio" (admin). O perfil "contador" já está previsto
// no banco (papel 'contador', só leitura da área financeira) e aqui; falta só o convite.

export type Papel = "admin" | "contador" | "colaborador" | "freelancer" | "cliente" | "sem_vinculo";

export type Area =
  | "calculadora"
  | "negociacao"
  | "mes"
  | "tarefas"
  | "calibragem"
  | "saude"
  | "pagamentos"
  | "repasse"
  | "pdfs"
  | "aprovacoes"
  | "avisos"
  | "configuracoes"
  | "historico";

/** O que cada perfil enxerga. O contador nunca vê piso, horas, divisão entre sócios nem negociação. */
const AREAS: Record<Papel, Area[] | "todas"> = {
  admin: "todas",
  contador: ["pagamentos", "pdfs"],
  colaborador: [],
  freelancer: [],
  cliente: [],
  sem_vinculo: [],
};

export function podeVer(papel: string, area: Area): boolean {
  const a = AREAS[(papel as Papel) in AREAS ? (papel as Papel) : "sem_vinculo"];
  return a === "todas" || a.includes(area);
}

/** PDFs que cada perfil pode gerar. */
export function pdfsPermitidos(papel: string): ("proposta" | "contador" | "socio")[] {
  if (papel === "admin") return ["proposta", "contador", "socio"];
  if (papel === "contador") return ["contador"];
  return [];
}

export const ehSocio = (papel: string) => papel === "admin";
