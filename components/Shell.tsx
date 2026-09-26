"use client";

import {
  CalendarDays,
  BookOpen,
  HelpCircle,
  BadgeCheck,
  Bell,
  Briefcase,
  Calculator,
  CalendarRange,
  ChevronDown,
  ListChecks,
  FileDown,
  FileSignature,
  Gauge,
  HandCoins,
  HeartPulse,
  History,
  LogOut,
  Menu,
  MessagesSquare,
  Moon,
  Presentation,
  Scale,
  Settings2,
  ShieldCheck,
  Sun,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { podeVer, type Area } from "@/lib/acesso";
import { useDados, useVariaveisFaltando } from "@/lib/dados/contexto";
import type { Repositorio, Usuario } from "@/lib/dados/repositorio";
import { Avatar, TrocarFoto } from "./Avatar";
import { Marca } from "./Marca";
import { RelogioRodando } from "./tarefas/RelogioRodando";
import { abrirTour, BotaoAjudaTela, Tour } from "./Ajuda";
import { Badge, cx } from "./ui";

interface Item {
  href: string;
  rotulo: string;
  icone: LucideIcon;
  area?: Area;
  emBreve?: boolean;
  contador?: "aprovacoes" | "avisos";
}

// Áreas do sistema (aprovadas pela Moni em 25/09/2026). Cada item é uma tela com um assunto só.
// O dia a dia vem primeiro e fica sempre aberto: é por onde cada um começa o dia.
const GRUPOS: { titulo: string; itens: Item[]; fixo?: boolean }[] = [
  {
    titulo: "Dia a dia",
    fixo: true,
    itens: [
      { href: "/hoje", rotulo: "Visão do dia", icone: Sun, area: "hoje" },
      { href: "/tarefas", rotulo: "Tarefas", icone: ListChecks, area: "tarefas" },
      { href: "/calendario", rotulo: "Calendário", icone: CalendarDays, area: "calendario" },
    ],
  },
  {
    titulo: "Comercial",
    itens: [
      { href: "/crm", rotulo: "CRM e leads", icone: MessagesSquare, area: "crm" },
      { href: "/negociacao", rotulo: "Negociação ao vivo", icone: Presentation, area: "negociacao" },
      { href: "/calculadora", rotulo: "Calculadora de projeto", icone: Calculator, area: "calculadora" },
    ],
  },
  {
    titulo: "Operação",
    itens: [
      { href: "/mes", rotulo: "Visão do mês e metas", icone: CalendarRange, area: "mes" },
      { href: "/capacidade", rotulo: "Capacidade", icone: Gauge, area: "capacidade" },
      { href: "/calibragem", rotulo: "Calibragem das horas", icone: Gauge, area: "calibragem" },
      { href: "#aprovacao", rotulo: "Aprovações do cliente", icone: BadgeCheck, emBreve: true },
    ],
  },
  {
    titulo: "Financeiro",
    itens: [
      { href: "/saude", rotulo: "Saúde dos clientes", icone: HeartPulse, area: "saude" },
      { href: "/pagamentos", rotulo: "Registrar pagamento", icone: Wallet, area: "pagamentos" },
      { href: "/repasse", rotulo: "Repasse dos sócios", icone: HandCoins, area: "repasse" },
      { href: "/pdfs", rotulo: "PDFs e relatórios", icone: FileDown, area: "pdfs" },
    ],
  },
  {
    titulo: "Sócios",
    itens: [
      { href: "/aprovacoes", rotulo: "Aprovações", icone: ShieldCheck, area: "aprovacoes", contador: "aprovacoes" },
      { href: "/avisos", rotulo: "Avisos", icone: Bell, area: "avisos", contador: "avisos" },
    ],
  },
  {
    titulo: "Administrativo",
    itens: [
      { href: "#clientes", rotulo: "Clientes e contratos", icone: FileSignature, emBreve: true },
      { href: "#decisoes", rotulo: "Decisões", icone: Scale, emBreve: true },
    ],
  },
  {
    titulo: "Sistema",
    itens: [
      { href: "/configuracoes", rotulo: "Configurações", icone: Settings2, area: "configuracoes" },
      { href: "/historico", rotulo: "Histórico de alterações", icone: History, area: "historico" },
    ],
  },
  {
    titulo: "Ajuda",
    itens: [{ href: "/glossario", rotulo: "Glossário", icone: BookOpen, area: "glossario" }],
  },
];

const CHAVE_MENU = "aden:menu-aberto";

/** Quantas aprovações esperam por mim e quantos avisos meus não foram lidos. */
async function contarPendencias(repo: Repositorio, u: Usuario | null) {
  const [pedidos, avisos] = await Promise.all([repo.listarPedidos(), repo.listarAvisos()]);
  const meu = (pessoa: string) => (repo.modo === "local" ? true : pessoa === u?.pessoaId);
  return {
    aprovacoes: pedidos.filter((p) => p.status === "pendente" && p.afetados.some((a) => meu(a) && !p.aprovacoes.some((x) => x.pessoaId === a))).length,
    avisos: avisos.filter((a) => !a.lidoEm && meu(a.pessoaId)).length,
  };
}

function Navegacao({ aoNavegar }: { aoNavegar?: () => void }) {
  const caminho = usePathname();
  const { repo, usuario } = useDados();
  const papel = usuario?.papel ?? "sem_vinculo";
  const grupos = GRUPOS.map((g) => ({ ...g, itens: g.itens.filter((i) => i.emBreve ? papel === "admin" : i.area && podeVer(papel, i.area)) })).filter((g) => g.itens.length);
  const doCaminho = grupos.find((g) => g.itens.some((i) => !i.emBreve && caminho.startsWith(i.href)))?.titulo;
  const [abertos, setAbertos] = useState<string[]>([]);
  const [contagem, setContagem] = useState({ aprovacoes: 0, avisos: 0 });

  useEffect(() => {
    let salvo: string[] = [];
    try {
      salvo = JSON.parse(localStorage.getItem(CHAVE_MENU) ?? "[]");
    } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lê o menu lembrado só no cliente
    setAbertos(doCaminho && !salvo.includes(doCaminho) ? [...salvo, doCaminho] : salvo);
  }, [doCaminho]);

  useEffect(() => {
    if (papel !== "admin") return;
    contarPendencias(repo, usuario).then(setContagem).catch(() => {});
  }, [repo, usuario, caminho, papel]);

  const alternar = (t: string) => {
    const novo = abertos.includes(t) ? abertos.filter((x) => x !== t) : [...abertos, t];
    setAbertos(novo);
    try {
      localStorage.setItem(CHAVE_MENU, JSON.stringify(novo));
    } catch {}
  };

  return (
    <nav className="flex flex-col gap-1" aria-label="Áreas do sistema">
      {grupos.map((g) => {
        const aberto = g.fixo || abertos.includes(g.titulo);
        const total = g.itens.reduce((a, i) => a + (i.contador ? contagem[i.contador] : 0), 0);
        const temAtivo = g.titulo === doCaminho;
        return (
          <div key={g.titulo}>
            {!g.fixo && (
            <button
              type="button"
              aria-expanded={aberto}
              onClick={() => alternar(g.titulo)}
              className={cx(
                "flex w-full items-center gap-2 rounded-item px-3 py-2 text-left text-[12px] font-bold tracking-[0.08em] uppercase transition-colors",
                temAtivo ? "text-marca-forte" : "text-texto-suave hover:text-texto",
              )}
            >
              <span className="flex-1">{g.titulo}</span>
              {!aberto && total > 0 && <span className="flex size-5 items-center justify-center rounded-full bg-erro text-[10px] text-superficie">{total}</span>}
              <ChevronDown size={15} className={cx("transition-transform", aberto && "rotate-180")} />
            </button>
            )}
            {aberto && (
              <ul className="mb-2 flex flex-col gap-0.5 pl-1">
                {g.itens.map((i) => {
                  const ativo = !i.emBreve && caminho.startsWith(i.href);
                  const Ic = i.icone;
                  if (i.emBreve)
                    return (
                      <li key={i.href}>
                        <span className="flex cursor-default items-center gap-2.5 rounded-item px-3 py-2 text-[13px] font-medium text-texto-suave/60" title="Próximas fases">
                          <Ic size={17} strokeWidth={1.9} />
                          <span className="flex-1 truncate">{i.rotulo}</span>
                          <span className="text-[9px] font-bold tracking-wide uppercase">breve</span>
                        </span>
                      </li>
                    );
                  const n = i.contador ? contagem[i.contador] : 0;
                  return (
                    <li key={i.href}>
                      <Link
                        href={i.href}
                        onClick={aoNavegar}
                        className={cx(
                          "flex items-center gap-2.5 rounded-item px-3 py-2 text-[13px] font-semibold transition-colors",
                          ativo ? "bg-marca text-sobre-marca shadow-card" : "text-texto hover:bg-marca-suave/60",
                        )}
                      >
                        <Ic size={17} strokeWidth={2} />
                        <span className="flex-1 truncate">{i.rotulo}</span>
                        {n > 0 && (
                          <span className={cx("flex size-5 items-center justify-center rounded-full text-[10px] font-bold", ativo ? "bg-sobre-marca text-marca-forte" : "bg-erro text-superficie")}>
                            {n}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}

function AlternarTema() {
  const [escuro, setEscuro] = useState(false);
  useEffect(() => {
    let salvo: string | null = null;
    try {
      salvo = localStorage.getItem("aden:tema");
    } catch {}
    const e = salvo ? salvo === "escuro" : matchMedia("(prefers-color-scheme: dark)").matches;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lê preferência só no cliente
    setEscuro(e);
  }, []);
  const trocar = () => {
    const novo = !escuro;
    setEscuro(novo);
    document.documentElement.dataset.tema = novo ? "escuro" : "claro";
    try {
      localStorage.setItem("aden:tema", novo ? "escuro" : "claro");
    } catch {}
  };
  return (
    <button type="button" onClick={trocar} aria-label="Alternar tema claro/escuro" className="flex size-9 items-center justify-center rounded-item text-texto-suave hover:bg-superficie-2 hover:text-texto">
      {escuro ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const { repo, usuario, carregando, atualizarUsuario } = useDados();
  const faltando = useVariaveisFaltando();
  const router = useRouter();
  const [menuAberto, setMenuAberto] = useState(false);

  useEffect(() => {
    if (!carregando && repo.modo === "supabase" && !usuario) router.replace("/entrar");
  }, [carregando, usuario, repo.modo, router]);

  if (carregando || (repo.modo === "supabase" && !usuario)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Marca />
      </div>
    );
  }

  if (usuario?.papel === "sem_vinculo") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <Marca />
        <p className="max-w-sm text-sm text-texto-suave">
          Seu login ({usuario.email}) ainda não está vinculado à Aden. Peça a um sócio para vincular seu acesso.
        </p>
        <button className="text-sm font-semibold text-marca-forte underline" onClick={async () => { await repo.sair(); await atualizarUsuario(); }}>
          Sair
        </button>
      </div>
    );
  }

  const rodape = (
    <div className="flex items-center gap-2 border-t border-linha pt-4">
      {usuario?.pessoaId && usuario.papel === "admin" ? (
        <TrocarFoto pessoaId={usuario.pessoaId} nome={usuario.nome} foto={usuario.fotoUrl} tamanho="lg" tom="suave" comTexto={false} aoTrocar={() => void atualizarUsuario()} />
      ) : (
        <Avatar nome={usuario?.nome} foto={usuario?.fotoUrl} tamanho="lg" tom="suave" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold">{usuario?.nome}</p>
        <p className="truncate text-[11px] text-texto-suave">
          {repo.modo === "local" ? "dados só neste navegador" : usuario?.papel === "contador" ? "contador · só leitura" : "sócio"}
        </p>
      </div>
      <button
        type="button"
        aria-label="Rever o tour do sistema"
        title="Rever o tour do sistema"
        className="flex size-9 items-center justify-center rounded-item text-texto-suave hover:bg-superficie-2 hover:text-texto"
        onClick={abrirTour}
      >
        <HelpCircle size={17} />
      </button>
      <AlternarTema />
      {repo.modo === "supabase" && (
        <button
          type="button"
          aria-label="Sair"
          className="flex size-9 items-center justify-center rounded-item text-texto-suave hover:bg-superficie-2 hover:text-texto"
          onClick={async () => {
            await repo.sair();
            await atualizarUsuario();
          }}
        >
          <LogOut size={17} />
        </button>
      )}
    </div>
  );

  return (
    <div className="flex min-h-screen">
      {/* lateral — desktop */}
      <aside className="nao-imprimir sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-6 overflow-y-auto border-r border-linha bg-superficie/70 px-3 py-5 backdrop-blur lg:flex">
        <div className="px-2">
          <Marca />
        </div>
        <div className="flex-1">
          <Navegacao />
        </div>
        {rodape}
      </aside>

      {/* topo — celular */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="nao-imprimir sticky top-0 z-30 flex items-center justify-between border-b border-linha bg-fundo/90 px-4 py-3 backdrop-blur lg:hidden">
          <Marca compacta />
          <button type="button" aria-label="Abrir menu" onClick={() => setMenuAberto(true)} className="flex size-10 items-center justify-center rounded-item hover:bg-superficie-2">
            <Menu size={20} />
          </button>
        </header>
        {menuAberto && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button aria-label="Fechar menu" className="absolute inset-0 bg-texto/30" onClick={() => setMenuAberto(false)} />
            <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col gap-6 overflow-y-auto bg-superficie px-3 py-5 shadow-forte">
              <div className="flex items-center justify-between px-2">
                <Marca />
                <button aria-label="Fechar menu" onClick={() => setMenuAberto(false)} className="flex size-9 items-center justify-center rounded-item hover:bg-superficie-2">
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1">
                <Navegacao aoNavegar={() => setMenuAberto(false)} />
              </div>
              {rodape}
            </div>
          </div>
        )}
        {repo.modo === "local" && (
          <div className="nao-imprimir flex flex-wrap items-center justify-center gap-x-2 bg-aviso-suave px-4 py-1.5 text-center text-[11px] font-semibold text-aviso">
            <Briefcase size={13} /> Modo demonstração: sem banco conectado. Os dados ficam só neste navegador.
            {faltando.length > 0 && <span className="font-medium">O servidor não encontrou: {faltando.join(" e ")}.</span>}
          </div>
        )}
        <main className="min-w-0 flex-1">{children}</main>
        <RelogioRodando />
        <Tour />
      </div>
    </div>
  );
}

export function CabecalhoPagina({
  icone: Icone,
  titulo,
  descricao,
  acoes,
  selo,
}: {
  icone: LucideIcon;
  titulo: string;
  descricao?: ReactNode;
  acoes?: ReactNode;
  selo?: string;
}) {
  return (
    <div className="relative overflow-hidden border-b border-linha bg-marca-tinta/60">
      <svg className="pointer-events-none absolute -top-24 -right-16 size-72 text-marca/10" viewBox="-100 -100 200 200" aria-hidden>
        <path fill="currentColor" d="M44.7,-58.3C57.1,-49.7,66.2,-36.1,70.6,-21C75,-5.9,74.7,10.8,68.4,24.8C62.1,38.8,49.8,50.2,35.7,58.3C21.6,66.4,5.7,71.2,-10.8,70.1C-27.3,69,-44.5,62,-56.4,49.6C-68.3,37.2,-75,19.4,-74.4,2.2C-73.8,-15,-65.9,-31.6,-54,-40.6C-42.1,-49.6,-26.2,-51,-11.6,-56.3C3,-61.6,32.3,-66.9,44.7,-58.3Z" />
      </svg>
      <span className="pointer-events-none absolute right-48 -bottom-10 size-24 rounded-full bg-destaque/15" aria-hidden />
      <div className="relative mx-auto flex max-w-[1500px] flex-wrap items-center gap-4 px-4 py-6 sm:px-6 lg:px-8">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-bloco bg-marca text-sobre-marca shadow-card">
          <Icone size={22} />
        </span>
        <div className="min-w-0 flex-1">
          {selo && <Badge tom="marca">{selo}</Badge>}
          <h1 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">{titulo}</h1>
          {descricao && <p className="mt-0.5 max-w-2xl text-sm text-texto-suave">{descricao}</p>}
        </div>
        {acoes && <div className="nao-imprimir flex w-full flex-wrap items-center gap-2 sm:w-auto">{acoes}</div>}
        <BotaoAjudaTela />
      </div>
    </div>
  );
}
