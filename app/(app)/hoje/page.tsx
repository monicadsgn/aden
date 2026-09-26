"use client";

// Visão do dia: a primeira tela de cada login. O que eu tenho para resolver hoje, o que
// depende de mim e um resumo de tudo (metas, comercial, financeiro). Sócios podem olhar
// as pendências um do outro quando quiserem, pelo seletor "De quem".

import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock,
  Flag,
  Hourglass,
  Package,
  Plus,
  Rocket,
  ShieldCheck,
  Sparkles,
  Sun,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { podeVer } from "@/lib/acesso";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { DetalheTarefa } from "@/components/tarefas/DetalheTarefa";
import { LinhaTarefa } from "@/components/tarefas/LinhaTarefa";
import { useTarefas } from "@/components/tarefas/useTarefas";
import { Avatar } from "@/components/Avatar";
import { BotaoAjudaTela } from "@/components/Ajuda";
import { Card, cx } from "@/components/ui";
import { hojeISO, montarVisaoDoDia, somarDias } from "@/lib/calculo/dia";
import { calcularVisaoMes } from "@/lib/calculo/mes";
import { calcularTrilha, espacoPraVender, unidadeDoCriterio } from "@/lib/calculo/metas";
import { novoId } from "@/lib/calculo/novo";
import { pacotePadrao } from "@/lib/calculo/pacotes";
import { distribuirPagamentos, type Pagamento } from "@/lib/calculo/pagamentos";
import { novaTarefa, type Tarefa } from "@/lib/calculo/tarefas";
import { useDados } from "@/lib/dados/contexto";
import type { AvisoSocio, Pedido, ResumoSimulacao } from "@/lib/dados/repositorio";
import { formatarMoeda, formatarPct, primeiraMaiuscula } from "@/lib/formato";
import { linkConfig } from "@/lib/navegacao";

type Chave = "hoje" | "atrasadas" | "semana" | "aprovacao" | "concluidas";

function saudacao(d = new Date()) {
  const h = d.getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

const mesDe = (iso: string) => iso.slice(0, 7);

function Cartao({ rotulo, valor, icone: Ic, tom, ativo, aoClicar }: { rotulo: string; valor: number; icone: LucideIcon; tom?: "alerta" | "destaque"; ativo: boolean; aoClicar: () => void }) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      aria-pressed={ativo}
      className={cx(
        "relative flex flex-col items-start gap-1 rounded-bloco border p-3 text-left transition-colors",
        ativo ? "border-marca bg-marca-tinta" : "border-linha bg-superficie hover:border-marca/50",
      )}
    >
      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-texto-suave">
        <Ic size={13} /> {rotulo}
      </span>
      <span className={cx("numero text-2xl font-extrabold", tom === "alerta" && valor > 0 && "text-erro", tom === "destaque" && "text-marca-forte")}>{valor}</span>
      {tom === "alerta" && valor > 0 && <span className="absolute top-2.5 right-2.5 size-2 rounded-full bg-erro" aria-hidden />}
    </button>
  );
}

function Bloco({ titulo, icone: Ic, acao, children }: { titulo: string; icone: LucideIcon; acao?: ReactNode; children: ReactNode }) {
  return (
    <Card>
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <Ic size={16} className="text-marca-forte" />
        <h2 className="flex-1 text-sm font-bold">{titulo}</h2>
        {acao}
      </div>
      <div className="px-4 pb-4">{children}</div>
    </Card>
  );
}

function LinkPequeno({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-[11px] font-semibold text-marca-forte hover:underline">
      {children} <ArrowRight size={11} />
    </Link>
  );
}

export default function VisaoDoDia() {
  const a = useTarefas();
  const { repo, usuario } = useDados();
  const router = useRouter();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [avisos, setAvisos] = useState<AvisoSocio[]>([]);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [sims, setSims] = useState<ResumoSimulacao[]>([]);
  const [deQuem, setDeQuem] = useState<string | null | undefined>(undefined);
  const [aberto, setAberto] = useState<Chave | null>(null);
  const [tarefaAberta, setTarefaAberta] = useState<string | null>(null);
  const [rapida, setRapida] = useState("");

  // quem não é sócio (ex.: contador) começa na área dele
  useEffect(() => {
    if (usuario && !podeVer(usuario.papel, "hoje")) router.replace(podeVer(usuario.papel, "pagamentos") ? "/pagamentos" : "/entrar");
  }, [usuario, router]);

  useEffect(() => {
    Promise.all([repo.listarPedidos(), repo.listarAvisos(), repo.listarPagamentos(), repo.listarSimulacoes()])
      .then(([p, av, pg, s]) => {
        setPedidos(p);
        setAvisos(av);
        setPagamentos(pg);
        setSims(s);
      })
      .catch(() => {});
  }, [repo]);

  const cfg = a.config;
  const eu = usuario?.pessoaId ?? null;
  const pessoa = deQuem === undefined ? eu : deQuem;
  const socios = cfg.pessoas.filter((p) => p.ativo && p.socio);
  const hoje = hojeISO();
  const v = useMemo(() => montarVisaoDoDia(a.tarefas, pessoa, hoje), [a.tarefas, pessoa, hoje]);

  const meu = (id: string) => (repo.modo === "local" ? true : id === eu);
  const aprovacoes = pedidos.filter((p) => p.status === "pendente" && p.afetados.some((x) => meu(x) && !p.aprovacoes.some((y) => y.pessoaId === x)));
  const avisosNovos = avisos.filter((x) => !x.lidoEm && meu(x.pessoaId));

  const visaoMes = useMemo(() => calcularVisaoMes(cfg), [cfg]);
  const trilha = useMemo(() => calcularTrilha(cfg, visaoMes), [cfg, visaoMes]);
  const padrao = pacotePadrao(cfg);
  const espaco = useMemo(() => (padrao ? espacoPraVender(cfg, padrao, visaoMes) : null), [cfg, padrao, visaoMes]);

  const financeiro = useMemo(() => {
    const clientes = cfg.clientes.filter((c) => c.ativo && !c.interno);
    const mes = mesDe(hoje);
    const anterior = mesDe(somarDias(`${mes}-01`, -1));
    const doMes = clientes.map((c) => distribuirPagamentos(cfg, c, mes, pagamentos, hoje));
    const atrasados = clientes.map((c) => distribuirPagamentos(cfg, c, anterior, pagamentos, hoje)).filter((d) => d.situacao === "atrasado");
    return {
      recebido: doMes.reduce((s, d) => s + d.recebidoCentavos, 0),
      contratado: clientes.reduce((s, c) => s + (c.valorMensalCentavos ?? 0), 0),
      atrasados,
    };
  }, [cfg, pagamentos, hoje]);

  if (!a.carregado) return null;

  const listas: Record<Chave, Tarefa[]> = {
    hoje: v.hoje,
    atrasadas: v.atrasadas,
    semana: v.semana,
    aprovacao: v.emAprovacao,
    concluidas: v.concluidasHoje,
  };
  const paraResolver = [...v.atrasadas, ...v.hoje, ...v.emAndamento];
  const nomeDe = (id: string | null) => cfg.pessoas.find((p) => p.id === id)?.nome ?? "";
  const minhaVisao = pessoa != null && pessoa === eu;
  const quem = pessoa == null ? "de todo mundo" : minhaVisao ? "" : `de ${nomeDe(pessoa)}`;
  const tarefa = a.tarefas.find((t) => t.id === tarefaAberta) ?? null;
  const degrau = trilha.atual != null ? trilha.degraus[trilha.atual] : null;
  const fmtMeta = (val: number | null) =>
    val == null || !degrau?.meta.criterio ? "—" : unidadeDoCriterio(degrau.meta.criterio) === "moeda" ? formatarMoeda(val) : unidadeDoCriterio(degrau.meta.criterio) === "pct" ? formatarPct(val) : String(Math.round(val));

  const criar = async () => {
    if (!rapida.trim()) return;
    await a.salvar(novaTarefa(novoId(), rapida.trim(), { responsavelId: pessoa ?? eu, vencimento: hoje }));
    setRapida("");
  };

  // próximos 7 dias, agrupados por dia
  const agenda = new Map<string, Tarefa[]>();
  for (const t of v.semana) agenda.set(t.vencimento!, [...(agenda.get(t.vencimento!) ?? []), t]);

  return (
    <div className="pb-16">
      <div className="relative overflow-hidden border-b border-linha bg-marca-tinta/60">
        <div className="relative mx-auto flex max-w-[1300px] flex-wrap items-center gap-4 px-4 py-6 sm:px-6 lg:px-8">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-bloco bg-marca text-sobre-marca shadow-card">
            <Sun size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-texto-suave">
              {primeiraMaiuscula(new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }))}
            </p>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
              {saudacao()}
              {usuario?.nome && repo.modo !== "local" ? `, ${usuario.nome.split(" ")[0]}` : ""}
            </h1>
          </div>
          {socios.length > 1 && (
            <div className="flex items-center gap-1 rounded-botao bg-superficie-2 p-1" role="radiogroup" aria-label="De quem">
              {[...socios.map((p) => ({ id: p.id as string | null, nome: p.id === eu ? "Minhas" : p.nome, foto: p.fotoUrl })), { id: null, nome: "Todos", foto: undefined }].map((o) => (
                <button
                  key={o.id ?? "todos"}
                  type="button"
                  role="radio"
                  aria-checked={pessoa === o.id}
                  onClick={() => setDeQuem(o.id)}
                  className={cx(
                    "inline-flex items-center gap-1.5 rounded-botao px-3 py-1.5 text-xs font-semibold transition-all",
                    pessoa === o.id ? "bg-superficie text-marca-forte shadow-card" : "text-texto-suave hover:text-texto",
                  )}
                >
                  {o.id && <Avatar nome={o.nome} foto={o.foto} tamanho="sm" />}
                  {o.nome}
                </button>
              ))}
            </div>
          )}
          <BotaoAjudaTela />
        </div>
      </div>

      <div className="mx-auto flex max-w-[1300px] flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
        {a.erro && !tarefa && <p className="rounded-card bg-erro-suave px-4 py-3 text-sm text-erro">{a.erro}</p>}

        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            <Cartao rotulo="Para hoje" valor={v.hoje.length} icone={Sun} tom="destaque" ativo={aberto === "hoje"} aoClicar={() => setAberto(aberto === "hoje" ? null : "hoje")} />
            <Cartao rotulo="Atrasadas" valor={v.atrasadas.length} icone={AlertTriangle} tom="alerta" ativo={aberto === "atrasadas"} aoClicar={() => setAberto(aberto === "atrasadas" ? null : "atrasadas")} />
            <Cartao rotulo="Próximos 7 dias" valor={v.semana.length} icone={CalendarDays} ativo={aberto === "semana"} aoClicar={() => setAberto(aberto === "semana" ? null : "semana")} />
            <Cartao rotulo="Em aprovação" valor={v.emAprovacao.length} icone={Hourglass} ativo={aberto === "aprovacao"} aoClicar={() => setAberto(aberto === "aprovacao" ? null : "aprovacao")} />
            <Cartao rotulo="Concluídas hoje" valor={v.concluidasHoje.length} icone={CheckCircle2} ativo={aberto === "concluidas"} aoClicar={() => setAberto(aberto === "concluidas" ? null : "concluidas")} />
          </div>
          {aberto && (
            <Card>
              <div className="p-2">
                {listas[aberto].length === 0 ? (
                  <p className="py-3 text-center text-xs text-texto-suave">Nada aqui. 🌿</p>
                ) : (
                  listas[aberto].map((t) => <LinhaTarefa key={t.id} t={t} a={a} abrir={() => setTarefaAberta(t.id)} />)
                )}
              </div>
            </Card>
          )}
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
          {/* coluna principal */}
          <div className="flex flex-col gap-5">
            <Bloco
              titulo={minhaVisao ? "O que eu tenho para resolver" : `O que ${pessoa == null ? "todo mundo tem" : `${nomeDe(pessoa)} tem`} para resolver`}
              icone={Flag}
              acao={<LinkPequeno href="/tarefas">Todas as tarefas</LinkPequeno>}
            >
              <div className="mb-2 flex items-center gap-2 rounded-botao border border-linha bg-superficie px-3 focus-within:border-marca focus-within:ring-2 focus-within:ring-marca/20">
                <Plus size={15} className="text-texto-suave" />
                <input
                  className="h-10 flex-1 bg-transparent text-sm outline-none placeholder:text-texto-suave sem-contorno"
                  placeholder={`Anotar algo para hoje ${quem}… (Enter)`}
                  value={rapida}
                  onChange={(e) => setRapida(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void criar()}
                  aria-label="Nova tarefa para hoje"
                />
              </div>
              {paraResolver.length === 0 ? (
                <p className="rounded-bloco bg-ok-suave px-4 py-6 text-center text-sm text-ok">Tudo em dia por aqui. 🎉</p>
              ) : (
                <div className="flex flex-col">
                  {v.atrasadas.length > 0 && <p className="px-2 pt-1 text-[11px] font-bold tracking-wide text-erro uppercase">Atrasadas</p>}
                  {v.atrasadas.map((t) => (
                    <LinhaTarefa key={t.id} t={t} a={a} abrir={() => setTarefaAberta(t.id)} />
                  ))}
                  {v.hoje.length > 0 && <p className="px-2 pt-2 text-[11px] font-bold tracking-wide text-texto-suave uppercase">Hoje</p>}
                  {v.hoje.map((t) => (
                    <LinhaTarefa key={t.id} t={t} a={a} abrir={() => setTarefaAberta(t.id)} />
                  ))}
                  {v.emAndamento.length > 0 && <p className="px-2 pt-2 text-[11px] font-bold tracking-wide text-texto-suave uppercase">Em produção, sem prazo</p>}
                  {v.emAndamento.map((t) => (
                    <LinhaTarefa key={t.id} t={t} a={a} abrir={() => setTarefaAberta(t.id)} />
                  ))}
                </div>
              )}
              {v.semResponsavel.length > 0 && (
                <p className="mt-3 rounded-bloco bg-aviso-suave px-3 py-2 text-xs text-aviso">
                  {v.semResponsavel.length} tarefa(s) sem responsável.{" "}
                  <Link href="/tarefas" className="font-semibold underline">
                    Distribuir
                  </Link>
                </p>
              )}
            </Bloco>

            <Bloco titulo="Próximos dias" icone={CalendarDays} acao={<LinkPequeno href="/calendario">Calendário</LinkPequeno>}>
              {agenda.size === 0 ? (
                <p className="text-xs text-texto-suave">Nada com prazo nos próximos 7 dias.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {[...agenda].map(([dia, ts]) => (
                    <div key={dia}>
                      <p className="px-2 text-[11px] font-bold text-texto-suave">
                        {primeiraMaiuscula(new Date(`${dia}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "short" }))}
                      </p>
                      {ts.map((t) => (
                        <LinhaTarefa key={t.id} t={t} a={a} abrir={() => setTarefaAberta(t.id)} />
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </Bloco>
          </div>

          {/* coluna lateral: o que depende de mim e o resumo de tudo */}
          <div className="flex flex-col gap-5">
            {minhaVisao && (
              <Bloco titulo="Depende de mim" icone={ShieldCheck}>
                {aprovacoes.length === 0 && avisosNovos.length === 0 ? (
                  <p className="text-xs text-texto-suave">Nenhuma aprovação nem aviso esperando você.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {aprovacoes.length > 0 && (
                      <Link href="/aprovacoes" className="flex items-center gap-2 rounded-bloco bg-aviso-suave px-3 py-2 text-xs font-semibold text-aviso hover:opacity-90">
                        <ShieldCheck size={15} />
                        <span className="flex-1">{aprovacoes.length === 1 ? "1 pedido esperando sua aprovação" : `${aprovacoes.length} pedidos esperando sua aprovação`}</span>
                        <ArrowRight size={13} />
                      </Link>
                    )}
                    {avisosNovos.length > 0 && (
                      <Link href="/avisos" className="flex items-center gap-2 rounded-bloco bg-info-suave px-3 py-2 text-xs font-semibold text-info hover:opacity-90">
                        <Bell size={15} />
                        <span className="flex-1">{avisosNovos.length === 1 ? "1 aviso novo" : `${avisosNovos.length} avisos novos`}</span>
                        <ArrowRight size={13} />
                      </Link>
                    )}
                  </div>
                )}
              </Bloco>
            )}

            <Bloco titulo="Metas" icone={Rocket} acao={<LinkPequeno href="/mes">Visão do mês</LinkPequeno>}>
              {!trilha.degraus.length ? (
                <p className="text-xs text-texto-suave">
                  A trilha de crescimento ainda não foi definida.{" "}
                  <Link href={linkConfig("metas")} className="font-semibold text-marca-forte underline">
                    Definir
                  </Link>
                </p>
              ) : degrau ? (
                <div>
                  <p className="text-sm font-bold">{degrau.meta.nome}</p>
                  {degrau.progressoPct != null && (
                    <>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-superficie-2">
                        <div className="h-full rounded-full bg-marca" style={{ width: `${degrau.progressoPct}%` }} />
                      </div>
                      <p className="mt-1 text-[11px] text-texto-suave">
                        {fmtMeta(degrau.valor)} de {fmtMeta(degrau.meta.alvo)} · faltam {fmtMeta(degrau.falta)}
                      </p>
                    </>
                  )}
                  {degrau.meta.acao && <p className="mt-2 text-xs">Ao chegar: {degrau.meta.acao}</p>}
                </div>
              ) : (
                <p className="text-xs text-ok">Todos os degraus conquistados!</p>
              )}
            </Bloco>

            <Bloco titulo="Comercial" icone={Sparkles} acao={<LinkPequeno href="/negociacao">Negociar</LinkPequeno>}>
              {espaco?.cabem != null ? (
                <p className="text-sm">
                  {espaco.cabem > 0 ? (
                    <>
                      <strong className="numero text-marca-forte">+{espaco.cabem}</strong> cliente{espaco.cabem === 1 ? "" : "s"} do pacote {padrao!.nome} ainda cabe
                      {espaco.cabem === 1 ? "" : "m"}.
                    </>
                  ) : (
                    "Horas bem usadas: hora do próximo passo da trilha."
                  )}
                </p>
              ) : (
                <p className="text-xs text-texto-suave">
                  {padrao ? "Complete os tempos e as horas dos sócios para ver quantos clientes ainda cabem." : "Marque um pacote padrão para ver o espaço para vender."}
                </p>
              )}
              {sims.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1 text-[11px] font-bold text-texto-suave uppercase">Propostas recentes</p>
                  {sims.slice(0, 3).map((s) => (
                    <Link key={s.id} href={`/calculadora?sim=${s.id}`} className="flex items-center gap-2 rounded-item px-2 py-1 text-xs hover:bg-superficie-2">
                      <Package size={12} className="text-texto-suave" />
                      <span className="flex-1 truncate">{s.nome}</span>
                      <span className="text-[10px] text-texto-suave">{new Date(s.atualizadoEm).toLocaleDateString("pt-BR")}</span>
                    </Link>
                  ))}
                </div>
              )}
            </Bloco>

            <Bloco titulo="Financeiro do mês" icone={Wallet} acao={<LinkPequeno href="/pagamentos">Registrar pagamento</LinkPequeno>}>
              <p className="text-[11px] text-texto-suave">Recebido este mês</p>
              <p className="numero text-xl font-extrabold">
                {formatarMoeda(financeiro.recebido)}
                <span className="text-xs font-semibold text-texto-suave"> de {formatarMoeda(financeiro.contratado)}</span>
              </p>
              {financeiro.contratado > 0 && (
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-superficie-2">
                  <div className="h-full rounded-full bg-ok" style={{ width: `${Math.min(100, (financeiro.recebido / financeiro.contratado) * 100)}%` }} />
                </div>
              )}
              {financeiro.atrasados.length > 0 && (
                <p className="mt-3 flex items-start gap-1.5 rounded-bloco bg-erro-suave px-3 py-2 text-xs text-erro">
                  <Clock size={13} className="mt-px shrink-0" />
                  Mês passado em aberto: {financeiro.atrasados.map((d) => `${d.nome} (falta ${formatarMoeda(d.faltaReceberCentavos)})`).join(", ")}.
                </p>
              )}
            </Bloco>
          </div>
        </div>
      </div>
      <DetalheTarefa tarefa={tarefa} a={a} aoFechar={() => setTarefaAberta(null)} />
    </div>
  );
}
