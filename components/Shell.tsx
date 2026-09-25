"use client";

import {
  BadgeCheck,
  Briefcase,
  Calculator,
  CalendarRange,
  HeartPulse,
  ClipboardList,
  FileSignature,
  History,
  LineChart,
  LogOut,
  Menu,
  MessagesSquare,
  Moon,
  Scale,
  Settings2,
  Sun,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useDados, useVariaveisFaltando } from "@/lib/dados/contexto";
import { Marca } from "./Marca";
import { Badge, cx } from "./ui";

interface Item {
  href: string;
  rotulo: string;
  icone: LucideIcon;
  emBreve?: boolean;
}

// Áreas do sistema. As marcadas "em breve" são as fases seguintes do plano.
const GRUPOS: { titulo: string; itens: Item[] }[] = [
  {
    titulo: "Comercial",
    itens: [
      { href: "/calculadora", rotulo: "Calculadora de projeto", icone: Calculator },
      { href: "#crm", rotulo: "CRM e leads", icone: MessagesSquare, emBreve: true },
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
    titulo: "Operação",
    itens: [
      { href: "/mes", rotulo: "Visão do mês", icone: CalendarRange },
      { href: "#producao", rotulo: "Produção e capacidade", icone: ClipboardList, emBreve: true },
      { href: "#aprovacao", rotulo: "Aprovações do cliente", icone: BadgeCheck, emBreve: true },
    ],
  },
  {
    titulo: "Financeiro",
    itens: [
      { href: "/saude", rotulo: "Saúde dos clientes", icone: HeartPulse },
      { href: "#financeiro", rotulo: "Financeiro", icone: Wallet, emBreve: true },
      { href: "#relatorios", rotulo: "Relatórios de resultado", icone: LineChart, emBreve: true },
    ],
  },
  {
    titulo: "Sistema",
    itens: [
      { href: "/configuracoes", rotulo: "Configurações", icone: Settings2 },
      { href: "/historico", rotulo: "Histórico de alterações", icone: History },
    ],
  },
];

function Navegacao({ aoNavegar }: { aoNavegar?: () => void }) {
  const caminho = usePathname();
  return (
    <nav className="flex flex-col gap-5" aria-label="Áreas do sistema">
      {GRUPOS.map((g) => (
        <div key={g.titulo}>
          <p className="mb-1.5 px-3 text-[10px] font-bold tracking-[0.16em] text-texto-suave/80 uppercase">{g.titulo}</p>
          <ul className="flex flex-col gap-0.5">
            {g.itens.map((i) => {
              const ativo = caminho.startsWith(i.href);
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
                    <span className="truncate">{i.rotulo}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
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
      <span className="flex size-9 items-center justify-center rounded-full bg-marca-suave text-sm font-bold text-marca-forte">
        {(usuario?.nome ?? "?").slice(0, 1).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold">{usuario?.nome}</p>
        <p className="truncate text-[11px] text-texto-suave">{repo.modo === "local" ? "dados só neste navegador" : "sócio · admin"}</p>
      </div>
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
      </div>
    </div>
  );
}
