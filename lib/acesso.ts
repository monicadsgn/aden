// Perfis de acesso. Sócio (admin), equipe (colaborador), freelancer e contador.
// O que cada um vê de verdade é garantido pelo banco (RLS, migration 0018); aqui é o menu.

export type Papel = "admin" | "contador" | "colaborador" | "freelancer" | "cliente" | "sem_vinculo";

export type Area =
  | "clientes"
  | "crm"
  | "hoje"
  | "calendario"
  | "calculadora"
  | "negociacao"
  | "mes"
  | "capacidade"
  | "tarefas"
  | "calibragem"
  | "saude"
  | "pagamentos"
  | "repasse"
  | "pdfs"
  | "aprovacoes"
  | "avisos"
  | "configuracoes"
  | "historico"
  | "glossario";

/** O que cada perfil enxerga. O contador nunca vê piso, horas, divisão entre sócios nem negociação. */
const AREAS: Record<Papel, Area[] | "todas"> = {
  admin: "todas",
  contador: ["pagamentos", "pdfs", "glossario"],
  // equipe: o dia a dia (tarefas, calendário); o que ela vê dentro disso o banco filtra
  colaborador: ["hoje", "tarefas", "calendario", "glossario"],
  freelancer: ["hoje", "tarefas", "calendario", "glossario"],
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

/** Quem pode criar tarefa (freelancer só trabalha nas que recebe). */
export const podeCriarTarefa = (papel: string) => papel === "admin" || papel === "colaborador";

export const PAPEIS: { valor: Papel; rotulo: string; explica: string }[] = [
  { valor: "admin", rotulo: "Sócio", explica: "Vê e faz tudo: financeiro, comercial, configurações e aprovações." },
  { valor: "colaborador", rotulo: "Equipe", explica: "Vê e mexe em todas as tarefas e no calendário. Não vê valores, piso nem financeiro." },
  { valor: "freelancer", rotulo: "Freelancer", explica: "Vê só as tarefas em que é responsável. Não vê valores, piso nem financeiro." },
  { valor: "contador", rotulo: "Contador", explica: "Só o financeiro: pagamentos e o resumo para o contador." },
];
