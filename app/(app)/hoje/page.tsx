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
  ClipboardCheck,
  Clock,
  Flag,
  Hourglass,
  Megaphone,
  MessagesSquare,
  Plus,
  ShieldCheck,
  Sparkle,
  Sun,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { podeCriarTarefa, podeVer } from "@/lib/acesso";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ConectarAgenda } from "@/components/agenda/ConectarAgenda";
import { horaDoEvento, useAgenda } from "@/components/agenda/useAgenda";
import { DetalheTarefa } from "@/components/tarefas/DetalheTarefa";
import { ListaTarefas } from "@/components/tarefas/LinhaTarefa";
import { montarFechamento } from "@/lib/calculo/fechamento";
import { COMO_ATUALIZAR, NOVIDADES, VERSAO_FERRAMENTAS } from "@/lib/mcp/novidades";
import { useTarefas } from "@/components/tarefas/useTarefas";
import { Avatar } from "@/components/Avatar";
import { BotaoAjudaTela } from "@/components/Ajuda";
import { Botao, Card, cx } from "@/components/ui";
import { clienteNoMes, lembretesDeContrato } from "@/lib/calculo/clientes";
import { contatosParaHoje, resumoFunil, type Lead } from "@/lib/calculo/crm";
import { avisosDePublicacao, hojeISO, montarVisaoDoDia, somarDias } from "@/lib/calculo/dia";
import { calcularVisaoMes } from "@/lib/calculo/mes";
import { calcularTrilha, espacoPraVender, unidadeDoCriterio } from "@/lib/calculo/metas";
import { novoId } from "@/lib/calculo/novo";
import { pacotePadrao } from "@/lib/calculo/pacotes";
import { distribuirPagamentos, type Pagamento } from "@/lib/calculo/pagamentos";
import { novaTarefa, situacaoPeca, type Tarefa } from "@/lib/calculo/tarefas";
import { useDados } from "@/lib/dados/contexto";
import type { AvisoSocio, Pedido } from "@/lib/dados/repositorio";
import { formatarMoeda, formatarPct, primeiraMaiuscula } from "@/lib/formato";
import { linkConfig } from "@/lib/navegacao";
import { calcularMesDeCima, mesQueEstouraOTeto } from "@/lib/calculo/sociedade";
import { passosParaComecar, type PassoComecar } from "@/lib/regras/pendencias";

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
        "relative flex min-w-[7.5rem] shrink-0 flex-col items-start gap-1 rounded-bloco border p-3 text-left transition-colors sm:min-w-0",
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

/**
 * Enquanto faltar o básico da configuração, uma linha só com o próximo passo (G1 da auditoria, 01/10/2026: configurar
 * não disputa espaço com o dia). A lista inteira, na ordem, fica em Configurações. Some quando tudo estiver pronto.
 */
function ParaComecar({ passos }: { passos: PassoComecar[] }) {
  const prontos = passos.filter((p) => p.faltando.length === 0).length;
  if (prontos === passos.length) return null;
  const proximo = passos.find((p) => p.faltando.length > 0)!;
  return (
    <Link
      href={linkConfig(proximo.secao)}
      title={`Falta: ${proximo.faltando.join(", ")}`}
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-card border border-linha bg-superficie px-4 py-3 text-[13px] hover:bg-superficie-2/70"
    >
      <Flag size={16} className="shrink-0 text-marca-forte" />
      <span className="min-w-0 flex-1">
        <strong>Configuração: {prontos} de {passos.length} prontos.</strong> <span className="text-texto-suave">Próximo: {proximo.rotulo}</span>
      </span>
      <span className="inline-flex items-center gap-1 text-xs font-bold text-marca-forte">
        Preencher <ArrowRight size={12} />
      </span>
    </Link>
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
  const [verProximos, setVerProximos] = useState(false);
  // M14: quando as ferramentas do Claude mudam, avisa cada sócio até ele marcar que atualizou o conector
  const [ferramentasVistas, setFerramentasVistas] = useState<string | null>(VERSAO_FERRAMENTAS);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- preferência guardada no navegador
      setFerramentasVistas(localStorage.getItem("aden:ferramentas-vistas"));
    } catch {}
  }, []);
  const marcarFerramentasVistas = () => {
    setFerramentasVistas(VERSAO_FERRAMENTAS);
    try {
      localStorage.setItem("aden:ferramentas-vistas", VERSAO_FERRAMENTAS);
    } catch {}
  };
  const [fechamentos, setFechamentos] = useState<{ clienteId: string; nome: string; proximo: string; feitos: number; total: number }[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [avisos, setAvisos] = useState<AvisoSocio[]>([]);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [deQuem, setDeQuem] = useState<string | null | undefined>(undefined);
  const [aberto, setAberto] = useState<Chave | null>(null);
  const [tarefaAberta, setTarefaAberta] = useState<string | null>(null);
  const [rapida, setRapida] = useState("");
  const [conectando, setConectando] = useState(false);
  const hojeAgenda = hojeISO();
  const agenda = useAgenda(hojeAgenda, hojeAgenda);

  // quem não é sócio (ex.: contador) começa na área dele
  useEffect(() => {
    if (usuario && !podeVer(usuario.papel, "hoje")) router.replace(podeVer(usuario.papel, "pagamentos") ? "/pagamentos" : "/entrar");
  }, [usuario, router]);

  useEffect(() => {
    repo.listarLeads().then(setLeads).catch(() => {});
    Promise.all([repo.listarPedidos(), repo.listarAvisos(), repo.listarPagamentos()])
      .then(([p, av, pg]) => {
        setPedidos(p);
        setAvisos(av);
        setPagamentos(pg);
      })
      .catch(() => {});
  }, [repo]);

  const cfg = a.config;

  // G6 (01/10/2026): fechamento de cliente em andamento aparece no dia, com o próximo passo
  const comFechamento = cfg.clientes.filter((c) => c.ativo && c.fechamentoIniciadoEm);
  const chaveFechamento = comFechamento.map((c) => `${c.id}:${c.painelToken ? 1 : 0}`).join(",");
  useEffect(() => {
    if (!comFechamento.length) return;
    Promise.all(
      comFechamento.map(async (c) => {
        const f = montarFechamento(await repo.listarFechamento(c.id), !!c.painelToken);
        return f.completo || !f.proximo ? null : { clienteId: c.id, nome: c.nome, proximo: f.proximo.rotulo, feitos: f.feitos, total: f.total };
      }),
    )
      .then((l) => setFechamentos(l.filter((x): x is NonNullable<typeof x> => !!x)))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarrega quando a lista de clientes em fechamento muda
  }, [repo, chaveFechamento]);
  const socio = usuario?.papel === "admin" || repo.modo === "local";
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

  const estouroTeto = useMemo(() => mesQueEstouraOTeto(cfg, pagamentos, hoje), [cfg, pagamentos, hoje]);

  const financeiro = useMemo(() => {
    const clientes = cfg.clientes.filter((c) => c.ativo && !c.interno);
    const mes = mesDe(hoje);
    const anterior = mesDe(somarDias(`${mes}-01`, -1));
    const doMes = clientes.filter((c) => clienteNoMes(c, mes)).map((c) => distribuirPagamentos(cfg, c, mes, pagamentos, hoje));
    const atrasados = clientes
      .filter((c) => clienteNoMes(c, anterior))
      .map((c) => distribuirPagamentos(cfg, c, anterior, pagamentos, hoje))
      .filter((d) => d.situacao === "atrasado");
    return {
      // M8 (01/10/2026): o caixa conta pelo dia em que o dinheiro caiu; o mês de referência só mostra quem deve
      entrou: calcularMesDeCima(cfg, pagamentos, mes).entrouCentavos,
      recebidoPor: new Map(doMes.map((d) => [d.clienteId, d.recebidoCentavos])),
      recebido: doMes.reduce((s, d) => s + d.recebidoCentavos, 0),
      contratado: clientes.filter((c) => clienteNoMes(c, mes)).reduce((s, c) => s + (c.valorMensalCentavos ?? 0), 0),
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
  const falarCom = contatosParaHoje(leads, pessoa, hoje);
  // o cliente respondeu pelo painel: ajuste pedido ou aprovada (ainda não concluída)
  const respostasCliente = a.tarefas.filter((t) => {
    if (!t.visivelCliente || t.status === "concluida" || (pessoa && t.responsavelId !== pessoa)) return false;
    const s = situacaoPeca(t);
    return s === "ajuste" || s === "aprovada";
  });
  const publicacao = avisosDePublicacao(a.tarefas, (id) => cfg.clientes.find((c) => c.id === id)?.contrato?.prazoAprovacaoDias ?? null, pessoa, hoje);
  const lembretes = lembretesDeContrato(cfg.clientes, (id) => financeiro.recebidoPor.get(id) ?? 0, hoje);
  const funil = resumoFunil(leads, hoje);
  const respondidas = new Set(respostasCliente.map((t) => t.id));
  const emAndamento = v.emAndamento.filter((t) => !respondidas.has(t.id));
  const paraResolver = [...v.atrasadas, ...v.hoje, ...emAndamento];
  const nomeDe = (id: string | null) => cfg.pessoas.find((p) => p.id === id)?.nome ?? "";
  const minhaVisao = pessoa != null && pessoa === eu;
  const quem = pessoa == null ? "de todo mundo" : minhaVisao ? "" : `de ${nomeDe(pessoa)}`;
  const tarefa = a.tarefas.find((t) => t.id === tarefaAberta) ?? null;
  const degrau = trilha.atual != null ? trilha.degraus[trilha.atual] : null;
  const fmtMeta = (val: number | null) =>
    val == null || !degrau?.meta.criterio ? "—" : unidadeDoCriterio(degrau.meta.criterio) === "moeda" ? formatarMoeda(val) : unidadeDoCriterio(degrau.meta.criterio) === "pct" ? formatarPct(val) : String(Math.round(val));

  // na visão do outro sócio vira pedido: sem data, entra o prazo mínimo de dias úteis
  const criar = async () => {
    if (!rapida.trim()) return;
    await a.salvar(novaTarefa(novoId(), rapida.trim(), { responsavelId: pessoa ?? eu, vencimento: pessoa && eu && pessoa !== eu ? null : hoje }));
    setRapida("");
  };

  // próximos 7 dias, agrupados por dia

  return (
    <div className="pb-16">
      <div className="relative overflow-hidden border-b border-linha bg-marca-tinta/60">
        <div className="relative mx-auto flex max-w-[1300px] flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-bloco bg-marca-cheio text-sobre-marca shadow-card sm:size-12">
            <Sun size={20} />
          </span>
          <div className="min-w-0 flex-1 basis-40">
            <p className="text-xs font-semibold text-texto-suave">
              {primeiraMaiuscula(new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }))}
            </p>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
              {saudacao()}
              {usuario?.nome && repo.modo !== "local" ? `, ${usuario.nome.split(" ")[0]}` : ""}
            </h1>
          </div>
          <span className="sm:order-last">
            <BotaoAjudaTela />
          </span>
          {socio && socios.length > 1 && (
            <div className="order-last flex w-full items-center gap-1 overflow-x-auto rounded-botao bg-superficie-2 p-1 sm:order-none sm:w-auto" role="radiogroup" aria-label="De quem">
              {[...socios.map((p) => ({ id: p.id as string | null, nome: p.id === eu ? "Minhas" : p.nome, foto: p.fotoUrl })), { id: null, nome: "Todos", foto: undefined }].map((o) => (
                <button
                  key={o.id ?? "todos"}
                  type="button"
                  role="radio"
                  aria-checked={pessoa === o.id}
                  onClick={() => setDeQuem(o.id)}
                  className={cx(
                    "inline-flex flex-1 items-center justify-center gap-1.5 rounded-botao px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all sm:flex-none",
                    pessoa === o.id ? "bg-superficie text-marca-forte shadow-card" : "text-texto-suave hover:text-texto",
                  )}
                >
                  {o.id && <Avatar nome={o.nome} foto={o.foto} tamanho="sm" />}
                  {o.nome}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto flex max-w-[1300px] flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
        {a.erro && !tarefa && <p className="rounded-card bg-erro-suave px-4 py-3 text-sm text-erro">{a.erro}</p>}

        {socio && <ParaComecar passos={passosParaComecar(cfg)} />}

        {socio && ferramentasVistas !== VERSAO_FERRAMENTAS && (
          <div className="flex flex-wrap items-start gap-3 rounded-card border border-info/30 bg-info-suave px-4 py-3 text-[13px] text-info">
            <Sparkle size={16} className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1 basis-64">
              <p className="font-semibold">As ferramentas do seu Claude mudaram ({VERSAO_FERRAMENTAS.split("-").reverse().slice(0, 2).join("/")}).</p>
              <p className="mt-0.5 text-[12px]">{NOVIDADES[0]?.texto}</p>
              <p className="mt-1 text-[12px]">{COMO_ATUALIZAR}</p>
            </div>
            <Botao pequeno onClick={marcarFerramentasVistas}>
              Já atualizei
            </Botao>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 sm:pb-0">
            <Cartao rotulo="Para hoje" valor={v.hoje.length} icone={Sun} tom="destaque" ativo={aberto === "hoje"} aoClicar={() => setAberto(aberto === "hoje" ? null : "hoje")} />
            <Cartao rotulo="Atrasadas" valor={v.atrasadas.length} icone={AlertTriangle} tom="alerta" ativo={aberto === "atrasadas"} aoClicar={() => setAberto(aberto === "atrasadas" ? null : "atrasadas")} />
            <Cartao rotulo="Com o cliente" valor={v.emAprovacao.length} icone={Hourglass} ativo={aberto === "aprovacao"} aoClicar={() => setAberto(aberto === "aprovacao" ? null : "aprovacao")} />
            <Cartao rotulo="Concluídas hoje" valor={v.concluidasHoje.length} icone={CheckCircle2} ativo={aberto === "concluidas"} aoClicar={() => setAberto(aberto === "concluidas" ? null : "concluidas")} />
          </div>
          {aberto && (
            <Card>
              <div className="p-2">
                {listas[aberto].length === 0 ? (
                  <p className="py-3 text-center text-xs text-texto-suave">Nada aqui. 🌿</p>
                ) : (
                  <ListaTarefas tarefas={listas[aberto]} a={a} abrir={setTarefaAberta} />
                )}
              </div>
            </Card>
          )}
        </div>

        <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          {/* coluna principal (min-w-0: título comprido não estica a coluna além da tela) */}
          <div className="flex min-w-0 flex-col gap-5">
            <Bloco
              titulo={minhaVisao ? "O que eu tenho para resolver" : `O que ${pessoa == null ? "todo mundo tem" : `${nomeDe(pessoa)} tem`} para resolver`}
              icone={Flag}
              acao={<LinkPequeno href="/tarefas">Todas as tarefas</LinkPequeno>}
            >
              {podeCriarTarefa(usuario?.papel ?? "admin") && <div className="mb-2 flex items-center gap-2 rounded-botao border border-linha bg-superficie px-3 focus-within:border-marca focus-within:ring-2 focus-within:ring-marca/20">
                <Plus size={15} className="text-texto-suave" />
                <input
                  className="h-10 flex-1 bg-transparent text-sm outline-none placeholder:text-texto-suave sem-contorno"
                  placeholder={`Anotar algo para hoje ${quem}… (Enter)`}
                  value={rapida}
                  onChange={(e) => setRapida(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void criar()}
                  aria-label="Nova tarefa para hoje"
                />
              </div>}
              {(publicacao.irAoAr.length > 0 || publicacao.aprovacaoVencida.length > 0) && (
                <div className="mb-2 flex flex-col">
                  <p className="px-2 pt-1 text-[11px] font-bold tracking-wide text-marca-forte uppercase">Publicação</p>
                  {publicacao.irAoAr.map(({ t, atrasada }) => (
                    <button key={t.id} type="button" onClick={() => setTarefaAberta(t.id)} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-item px-2 py-2 text-left hover:bg-superficie-2/70">
                      <Megaphone size={16} className={cx("shrink-0", atrasada ? "text-erro" : "text-marca-forte")} />
                      <span className="min-w-0 flex-1 basis-40 truncate text-[13px] font-medium">
                        {t.titulo}
                        <span className="font-normal text-texto-suave">
                          {" "}
                          · {cfg.clientes.find((c) => c.id === t.clienteId)?.nome}
                          {atrasada
                            ? ` · era para ${new Date(t.publicarEm!).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}, ainda não marcada como publicada`
                            : ` · vai ao ar hoje às ${new Date(t.publicarEm!).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
                        </span>
                      </span>
                    </button>
                  ))}
                  {publicacao.aprovacaoVencida.map(({ t, ate }) => (
                    <button key={t.id} type="button" onClick={() => setTarefaAberta(t.id)} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-item px-2 py-2 text-left hover:bg-superficie-2/70">
                      <Hourglass size={16} className="shrink-0 text-aviso" />
                      <span className="min-w-0 flex-1 basis-40 truncate text-[13px] font-medium">
                        {t.titulo}
                        <span className="font-normal text-texto-suave">
                          {" "}
                          · {cfg.clientes.find((c) => c.id === t.clienteId)?.nome} ainda não aprovou (prazo era {new Date(`${ate}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}). Vale lembrar.
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {respostasCliente.length > 0 && (
                <div className="mb-2 flex flex-col">
                  <p className="px-2 pt-1 text-[11px] font-bold tracking-wide text-marca-forte uppercase">O cliente respondeu</p>
                  {respostasCliente.map((t) => (
                    <button key={t.id} type="button" onClick={() => setTarefaAberta(t.id)} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-item px-2 py-2 text-left hover:bg-superficie-2/70">
                      {situacaoPeca(t) === "aprovada" ? <CheckCircle2 size={16} className="shrink-0 text-ok" /> : <AlertTriangle size={16} className="shrink-0 text-erro" />}
                      <span className="min-w-0 flex-1 basis-40 truncate text-[13px] font-medium">
                        {t.titulo}
                        <span className="font-normal text-texto-suave">
                          {" "}
                          · {cfg.clientes.find((c) => c.id === t.clienteId)?.nome}
                          {situacaoPeca(t) === "aprovada" ? " aprovou" : ` pediu: ${t.feedbackCliente ?? "ajuste"}`}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {socio && fechamentos.length > 0 && (
                <div className="mb-2 flex flex-col">
                  <p className="px-2 pt-1 text-[11px] font-bold tracking-wide text-marca-forte uppercase">Fechamento de cliente</p>
                  {fechamentos.map((f) => (
                    <Link key={f.clienteId} href={`/clientes?cliente=${f.clienteId}&aba=comercial`} className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 rounded-item px-2 py-2 hover:bg-superficie-2/70">
                      <ClipboardCheck size={16} className="shrink-0 text-marca-forte" />
                      <span className="min-w-0 flex-1 basis-40 truncate text-[13px] font-medium">
                        {f.nome}
                        <span className="font-normal text-texto-suave"> · próximo: {f.proximo.toLowerCase()}</span>
                      </span>
                      <span className="numero text-[11px] text-texto-suave">
                        {f.feitos} de {f.total}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
              {falarCom.length > 0 && (
                <div className="mb-2 flex flex-col">
                  <p className="px-2 pt-1 text-[11px] font-bold tracking-wide text-marca-forte uppercase">Falar com (leads)</p>
                  {falarCom.map((l) => (
                    <Link key={l.id} href={`/crm?lead=${l.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-item px-2 py-2 hover:bg-superficie-2/70">
                      <MessagesSquare size={16} className="shrink-0 text-marca-forte" />
                      <span className="min-w-0 flex-1 basis-40 truncate text-[13px] font-medium">
                        {l.nome}
                        {l.proximaAcao && <span className="font-normal text-texto-suave"> · {l.proximaAcao}</span>}
                      </span>
                      <span className={cx("text-[11px]", l.proximoContato! < hoje ? "font-semibold text-erro" : "text-texto-suave")}>
                        {l.proximoContato === hoje ? "hoje" : `desde ${new Date(`${l.proximoContato}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
              {paraResolver.length === 0 && falarCom.length === 0 && respostasCliente.length === 0 ? (
                <p className="rounded-bloco bg-ok-suave px-4 py-6 text-center text-sm text-ok">Tudo em dia por aqui. 🎉</p>
              ) : paraResolver.length === 0 ? null : (
                <div className="flex flex-col">
                  {v.atrasadas.length > 0 && <p className="px-2 pt-1 text-[11px] font-bold tracking-wide text-erro uppercase">Atrasadas</p>}
                  <ListaTarefas tarefas={v.atrasadas} a={a} abrir={setTarefaAberta} />
                  {v.hoje.length > 0 && <p className="px-2 pt-2 text-[11px] font-bold tracking-wide text-texto-suave uppercase">Hoje</p>}
                  <ListaTarefas tarefas={v.hoje} a={a} abrir={setTarefaAberta} />
                  {emAndamento.length > 0 && <p className="px-2 pt-2 text-[11px] font-bold tracking-wide text-texto-suave uppercase">Sem prazo</p>}
                  <ListaTarefas tarefas={emAndamento} a={a} abrir={setTarefaAberta} />
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

            {/* Fase 1: com pouco volume, cada bloco só aparece quando tem algo */}
            {/* G1: o que não é de hoje fica recolhido; as peças do mesmo calendário vêm juntas (G2) */}
            {v.semana.length > 0 && (
              <Bloco
                titulo="Próximos 7 dias"
                icone={CalendarDays}
                acao={
                  <button type="button" className="text-[11px] font-semibold text-marca-forte hover:underline" onClick={() => setVerProximos(!verProximos)} aria-expanded={verProximos}>
                    {verProximos ? "Recolher" : `Ver (${v.semana.length})`}
                  </button>
                }
              >
                {verProximos ? (
                  <ListaTarefas tarefas={v.semana} a={a} abrir={setTarefaAberta} />
                ) : (
                  <p className="text-[12px] text-texto-suave">
                    {v.semana.length === 1 ? "1 tarefa" : `${v.semana.length} tarefas`} com prazo nos próximos 7 dias. Abra quando quiser olhar adiante, ou veja no{" "}
                    <Link href="/calendario" className="font-semibold text-marca-forte underline">
                      calendário
                    </Link>
                    .
                  </p>
                )}
              </Bloco>
            )}
          </div>

          {/* coluna lateral: o que depende de mim e o resumo de tudo */}
          <div className="flex min-w-0 flex-col gap-5">
            {minhaVisao && (
              <Bloco
                titulo="Agenda de hoje"
                icone={CalendarDays}
                acao={
                  <button type="button" className="text-[11px] font-semibold text-marca-forte hover:underline" onClick={() => setConectando(true)}>
                    {agenda.conectada ? "Google Agenda" : "Conectar"}
                  </button>
                }
              >
                {agenda.conectada === false ? (
                  <p className="text-xs text-texto-suave">Conecte o seu Google Agenda para ver os compromissos do dia aqui.</p>
                ) : agenda.eventos.length === 0 ? (
                  <p className="text-xs text-texto-suave">{agenda.conectada ? "Nenhum compromisso hoje." : "…"}</p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {agenda.eventos.map((e) => (
                      <li key={e.id} className="flex items-baseline gap-2 text-[13px]">
                        <span className="w-14 shrink-0 text-[11px] font-semibold text-info tabular-nums">{horaDoEvento(e)}</span>
                        <span className="min-w-0 flex-1">
                          {e.titulo}
                          {e.local && <span className="block truncate text-[11px] text-texto-suave">{e.local}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Bloco>
            )}
            {minhaVisao && socio && (aprovacoes.length > 0 || avisosNovos.length > 0) && (
              <Bloco titulo="Depende de mim" icone={ShieldCheck}>
                {(
                  <div className="flex flex-col gap-2">
                    {aprovacoes.length > 0 && (
                      <Link href="/aprovacoes" className="flex items-center gap-2 rounded-bloco bg-aviso-suave px-3 py-2 text-xs font-semibold text-aviso hover:opacity-90">
                        <ShieldCheck size={15} />
                        <span className="flex-1">{aprovacoes.length === 1 ? "1 pedido esperando sua aprovação" : `${aprovacoes.length} pedidos esperando sua aprovação`}</span>
                        <ArrowRight size={13} />
                      </Link>
                    )}
                    {avisosNovos.length > 0 && (
                      <Link href="/aprovacoes?aba=avisos" className="flex items-center gap-2 rounded-bloco bg-info-suave px-3 py-2 text-xs font-semibold text-info hover:opacity-90">
                        <Bell size={15} />
                        <span className="flex-1">{avisosNovos.length === 1 ? "1 aviso novo" : `${avisosNovos.length} avisos novos`}</span>
                        <ArrowRight size={13} />
                      </Link>
                    )}
                  </div>
                )}
              </Bloco>
            )}

            {/* G1 (01/10/2026): metas, comercial e financeiro viram um resumo de uma linha cada; o detalhe fica nas telas deles */}
            {socio && (
              <Bloco titulo="Resumo do mês" icone={Wallet}>
                <div className="flex flex-col divide-y divide-linha">
                  <Link href="/mes?aba=cima" className="flex min-h-11 flex-col justify-center gap-1 py-2 hover:opacity-80">
                    <span className="flex items-baseline gap-2 text-[13px]">
                      <span className="flex-1 font-semibold">Entrou este mês</span>
                      <span className="numero font-bold">
                        {formatarMoeda(financeiro.entrou)} <span className="text-[12px] font-normal text-texto-suave">de {formatarMoeda(financeiro.contratado)}</span>
                      </span>
                    </span>
                    {financeiro.contratado > 0 && (
                      <span className="block h-1.5 overflow-hidden rounded-full bg-superficie-2">
                        <span className="block h-full rounded-full bg-ok" style={{ width: `${Math.min(100, (financeiro.entrou / financeiro.contratado) * 100)}%` }} />
                      </span>
                    )}
                    <span className="text-[12px] text-texto-suave">
                      {financeiro.contratado > financeiro.recebido
                        ? `Os clientes ainda devem ${formatarMoeda(financeiro.contratado - financeiro.recebido)} deste mês. A divisão dos sócios conta o que entrou.`
                        : "Os clientes já pagaram o mês. A divisão dos sócios conta o que entrou."}
                    </span>
                  </Link>
                  <Link href="/crm" className="flex min-h-11 items-center gap-2 py-2 text-[13px] hover:opacity-80">
                    <span className="flex-1 font-semibold">Comercial</span>
                    <span className="text-[12px] text-texto-suave">
                      {funil.abertos === 1 ? "1 lead em negociação" : `${funil.abertos} leads em negociação`}
                      {espaco?.cabem != null && espaco.cabem > 0 && ` · cabem +${espaco.cabem}`}
                    </span>
                    <ArrowRight size={13} className="text-texto-suave" />
                  </Link>
                  {trilha.degraus.length > 0 && (
                    <Link href="/mes" className="flex min-h-11 items-center gap-2 py-2 text-[13px] hover:opacity-80">
                      <span className="flex-1 font-semibold">Meta</span>
                      <span className="text-[12px] text-texto-suave">
                        {degrau ? (degrau.progressoPct != null ? `${degrau.meta.nome}: faltam ${fmtMeta(degrau.falta)}` : degrau.meta.nome) : "todos os degraus conquistados"}
                      </span>
                      <ArrowRight size={13} className="text-texto-suave" />
                    </Link>
                  )}
                </div>
                {(lembretes.length > 0 || estouroTeto || financeiro.atrasados.length > 0) && (
                  <div className="mt-2 flex flex-col gap-1.5">
                    {financeiro.atrasados.map((d) => (
                      <Link
                        key={d.clienteId}
                        href={`/pagamentos?cliente=${d.clienteId}&mes=${d.competencia}`}
                        title="O mês passado já acabou e este cliente não pagou tudo. Se o dinheiro já caiu, registre; se não, vale cobrar."
                        className="flex min-h-11 items-center gap-2 rounded-item bg-aviso-suave px-3 py-2 text-[12px] text-aviso hover:opacity-90"
                      >
                        <Clock size={13} className="shrink-0" />
                        <span className="flex-1">
                          <strong>{d.nome}</strong>: falta {formatarMoeda(d.faltaReceberCentavos)} do mês passado. Registrar o que caiu ou cobrar.
                        </span>
                        <ArrowRight size={13} />
                      </Link>
                    ))}
                    {lembretes.map((l) => (
                      <Link key={`${l.clienteId}-${l.texto}`} href={`/clientes?cliente=${l.clienteId}`} className="flex min-h-11 items-center gap-2 rounded-item bg-aviso-suave px-3 py-2 text-[12px] text-aviso hover:opacity-90">
                        <CalendarDays size={13} className="shrink-0" />
                        <span className="flex-1">
                          <strong>{l.cliente}</strong>: {l.texto}
                          {l.data !== hoje && ` (${new Date(`${l.data}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })})`}
                        </span>
                      </Link>
                    ))}
                    {estouroTeto && (
                      <Link href="/mes?aba=cima" className="flex min-h-11 items-center gap-2 rounded-item bg-aviso-suave px-3 py-2 text-[12px] text-aviso hover:opacity-90">
                        <Clock size={13} className="shrink-0" />
                        <span className="flex-1">
                          No ritmo de hoje, o faturamento do ano passa do teto do MEI em{" "}
                          {new Date(`${estouroTeto}-15T12:00:00`).toLocaleDateString("pt-BR", { month: "long" })}. Vale falar com o contador antes.
                        </span>
                      </Link>
                    )}
                  </div>
                )}
              </Bloco>
            )}
          </div>
        </div>
      </div>
      <DetalheTarefa tarefa={tarefa} a={a} aoFechar={() => setTarefaAberta(null)} />
      <ConectarAgenda aberto={conectando} aoFechar={() => setConectando(false)} aoMudar={() => void agenda.recarregar()} />
    </div>
  );
}
