"use client";

// Visão do mês: tom de crescimento. Primeiro a trilha de metas (onde estamos, quanto falta,
// o próximo degrau); depois o espaço para vender ("cabem mais N do pacote padrão").
// O detalhe de horas por sócio e por cliente fica na aba Horas da tela Mês.

import { ArrowRight, CalendarRange, Coins, Flag, Gauge, Package, Rocket, Sparkles, Star, Trophy } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CabecalhoPagina } from "@/components/Shell";
import { Card, TituloCard, cx } from "@/components/ui";
import { calcularVisaoMes } from "@/lib/calculo/mes";
import { calcularTrilha, espacoPraVender, unidadeDoCriterio, type DegrauTrilha } from "@/lib/calculo/metas";
import { configVazia } from "@/lib/calculo/novo";
import { pacotePadrao } from "@/lib/calculo/pacotes";
import type { Configuracao, Meta } from "@/lib/calculo/tipos";
import { useDados } from "@/lib/dados/contexto";
import { formatarMoeda, formatarPct } from "@/lib/formato";
import { linkConfig } from "@/lib/navegacao";

function valorDaMeta(m: Meta, v: number | null): string {
  if (v == null || !m.criterio) return "—";
  const u = unidadeDoCriterio(m.criterio);
  if (u === "moeda") return formatarMoeda(v);
  if (u === "pct") return formatarPct(v);
  const n = Math.round(v);
  return `${n} cliente${n === 1 ? "" : "s"}`;
}

function Barra({ pct }: { pct: number }) {
  return (
    <div className="h-3 w-full overflow-hidden rounded-full bg-sobre-marca/20" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-sobre-marca transition-all" style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}

function Trilha({ degraus, atual }: { degraus: DegrauTrilha[]; atual: number | null }) {
  if (!degraus.length)
    return (
      <Card>
        <div className="flex flex-col items-start gap-3 p-6">
          <span className="flex size-12 items-center justify-center rounded-bloco bg-marca-suave text-marca-forte">
            <Trophy size={22} />
          </span>
          <h2 className="text-lg font-bold">Monte a trilha de crescimento da Aden</h2>
          <p className="max-w-xl text-sm text-texto-suave">
            Metas em degraus, com o que fazer ao chegar em cada uma (ex.: primeira terceirização, contratar alguém pra equipe). Vocês definem juntos; o sistema
            acompanha o progresso e marca cada conquista.
          </p>
          <Link href={linkConfig("metas")} className="inline-flex items-center gap-1.5 rounded-botao bg-marca px-4 py-2 text-sm font-semibold text-sobre-marca">
            Definir os degraus <ArrowRight size={14} />
          </Link>
        </div>
      </Card>
    );

  const d = atual != null ? degraus[atual] : null;
  const proximo = atual != null ? degraus[atual + 1] : null;
  return (
    <div className="flex flex-col gap-3">
      {/* degraus */}
      <ol className="flex flex-wrap items-center gap-1.5" aria-label="Trilha de metas">
        {degraus.map((g, i) => (
          <li key={g.meta.id} className="flex items-center gap-1.5">
            <span
              className={cx(
                "inline-flex items-center gap-1.5 rounded-botao px-3 py-1 text-xs font-semibold",
                g.batida ? "bg-ok-suave text-ok" : i === atual ? "bg-marca text-sobre-marca" : "bg-superficie-2 text-texto-suave",
              )}
              title={g.meta.conquistadaEm ? `Conquistada em ${new Date(g.meta.conquistadaEm).toLocaleDateString("pt-BR")}` : undefined}
            >
              {g.batida ? <Star size={12} /> : i === atual ? <Flag size={12} /> : <span className="tabular-nums">{i + 1}</span>}
              {g.meta.nome || `Degrau ${i + 1}`}
            </span>
            {i < degraus.length - 1 && <span className="h-px w-3 bg-linha" aria-hidden />}
          </li>
        ))}
      </ol>

      {d ? (
        <div className="relative overflow-hidden rounded-card bg-marca p-6 text-sobre-marca shadow-forte">
          <p className="flex items-center gap-1.5 text-xs font-bold tracking-wide uppercase opacity-85">
            <Flag size={13} /> Degrau atual · {atual! + 1} de {degraus.length}
          </p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">{d.meta.nome || `Degrau ${atual! + 1}`}</h2>
          {d.progressoPct != null ? (
            <>
              <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2">
                <span className="numero text-3xl font-extrabold">{valorDaMeta(d.meta, d.valor)}</span>
                <span className="text-sm opacity-90">de {valorDaMeta(d.meta, d.meta.alvo)}</span>
              </div>
              <div className="mt-2">
                <Barra pct={d.progressoPct} />
              </div>
              <p className="mt-2 text-sm font-semibold">
                {Math.round(d.progressoPct)}% do caminho · faltam {valorDaMeta(d.meta, d.falta)}
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm opacity-90">
              Falta escolher o critério e o alvo deste degrau.{" "}
              <Link href={linkConfig("metas")} className="font-bold underline">
                Completar
              </Link>
            </p>
          )}
          {d.meta.acao && (
            <p className="mt-4 inline-flex items-center gap-2 rounded-botao bg-sobre-marca/15 px-3 py-1.5 text-sm font-semibold">
              <Rocket size={15} /> Ao chegar aqui: {d.meta.acao}
            </p>
          )}
          {proximo && <p className="mt-3 text-xs opacity-85">Depois vem: {proximo.meta.nome || `Degrau ${atual! + 2}`}.</p>}
        </div>
      ) : (
        <div className="rounded-card bg-ok-suave p-6 text-ok">
          <p className="flex items-center gap-2 text-lg font-bold">
            <Trophy size={20} /> Todos os degraus conquistados!
          </p>
          <p className="mt-1 text-sm">Hora de desenhar os próximos com os sócios.</p>
        </div>
      )}

      {degraus.some((g) => g.meta.conquistadaEm) && (
        <div className="flex flex-wrap gap-2">
          {degraus
            .filter((g) => g.meta.conquistadaEm)
            .map((g) => (
              <span key={g.meta.id} className="inline-flex items-center gap-1.5 rounded-botao bg-ok-suave px-3 py-1 text-[11px] font-semibold text-ok">
                <Star size={11} /> {g.meta.nome} · conquistada em {new Date(g.meta.conquistadaEm!).toLocaleDateString("pt-BR")}
              </span>
            ))}
        </div>
      )}
    </div>
  );
}

export default function VisaoDoMes() {
  const { repo, usuario } = useDados();
  const [config, setConfig] = useState<Configuracao>(configVazia());
  const [carregado, setCarregado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const guardando = useRef(false);

  useEffect(() => {
    repo
      .carregarConfig()
      .then(setConfig)
      .catch((e) => setErro(e instanceof Error ? e.message : "Erro ao carregar."))
      .finally(() => setCarregado(true));
  }, [repo]);

  const v = useMemo(() => calcularVisaoMes(config), [config]);
  const trilha = useMemo(() => calcularTrilha(config, v), [config, v]);
  const padrao = pacotePadrao(config);
  const espaco = useMemo(() => (padrao ? espacoPraVender(config, padrao, v) : null), [config, padrao, v]);

  // degrau batido pela primeira vez: guarda a conquista com a data
  useEffect(() => {
    const novas = trilha.degraus.filter((d) => d.conquistarAgora);
    if (!novas.length || guardando.current || usuario?.papel !== "admin") return;
    guardando.current = true;
    const agora = new Date().toISOString();
    const metas = (config.metas ?? []).map((m) => (novas.some((d) => d.meta.id === m.id) ? { ...m, conquistadaEm: agora } : m));
    repo
      .salvarConfig({
        pessoas: { salvar: [], remover: [] },
        servicos: { salvar: [], remover: [] },
        tiposEntrega: { salvar: [], remover: [] },
        custosFixos: { salvar: [], remover: [] },
        clientes: { salvar: [], remover: [] },
        metas: { salvar: metas.filter((m) => novas.some((d) => d.meta.id === m.id)), remover: [] },
      })
      .then(() => setConfig((c) => ({ ...c, metas })))
      .catch(() => {})
      .finally(() => (guardando.current = false));
  }, [trilha, config.metas, repo, usuario?.papel]);

  if (!carregado) return null;

  const degrauAtual = trilha.atual != null ? trilha.degraus[trilha.atual] : null;
  const limitante = espaco?.limitantePessoaId ? config.pessoas.find((p) => p.id === espaco.limitantePessoaId)?.nome : null;

  return (
    <div className="pb-16">
      <CabecalhoPagina
        icone={CalendarRange}
        selo="Operação"
        titulo="Visão do mês"
        descricao="Onde a Aden está na trilha de crescimento e quanto espaço ainda tem para vender."
      />
      <div className="mx-auto flex max-w-[1100px] flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
        {erro && <p className="rounded-card bg-erro-suave px-4 py-3 text-sm text-erro">{erro}</p>}

        <Trilha degraus={trilha.degraus} atual={trilha.atual} />

        {/* Espaço pra vender */}
        <Card>
          <TituloCard icone={Sparkles} titulo="Espaço para vender" descricao="Com as horas livres de hoje, quantos clientes do pacote padrão ainda cabem." />
          <div className="px-5 pb-5">
            {!padrao ? (
              <p className="rounded-bloco bg-superficie-2/60 px-4 py-3 text-sm">
                Marque um pacote como padrão para ver quantos clientes ainda cabem.{" "}
                <Link href={linkConfig("pacotes")} className="font-semibold text-marca-forte underline">
                  Ir para Pacotes
                </Link>
              </p>
            ) : espaco?.cabem == null ? (
              <p className="rounded-bloco bg-superficie-2/60 px-4 py-3 text-sm">
                Para fazer a conta, falta preencher: {espaco?.faltando.join(", ")}.{" "}
                <Link href={linkConfig(espaco?.faltando.some((f) => f.startsWith("horas por mês")) ? "socios" : "tipos")} className="font-semibold text-marca-forte underline">
                  Completar
                </Link>
              </p>
            ) : espaco.cabem > 0 ? (
              <div className="flex flex-wrap items-center gap-4 rounded-bloco bg-marca-tinta p-5">
                <span className="numero text-5xl font-extrabold text-marca-forte">+{espaco.cabem}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-bold">
                    {espaco.cabem === 1 ? "Cabe mais 1 cliente" : `Cabem mais ${espaco.cabem} clientes`} do pacote {padrao.nome}
                  </p>
                  <p className="text-sm text-texto-suave">
                    {espaco.cabem === 1
                      ? `Depois dele, é hora do próximo passo${degrauAtual?.meta.acao ? `: ${degrauAtual.meta.acao}` : " da trilha"}.`
                      : `Calculado pelas horas livres de cada sócio${limitante ? ` (quem enche primeiro: ${limitante})` : ""}.`}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-4 rounded-bloco bg-destaque/20 p-5">
                <Rocket size={36} className="shrink-0 text-marca-forte" />
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-bold">Hora do próximo passo</p>
                  <p className="text-sm">
                    As horas de hoje estão bem usadas.{" "}
                    {degrauAtual?.meta.acao
                      ? `O próximo passo da trilha é: ${degrauAtual.meta.acao}.`
                      : "Defina na trilha qual é o próximo passo (terceirizar, trazer alguém pra equipe)."}
                  </p>
                </div>
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-4 text-xs">
              <Link href="/mes?aba=horas" className="inline-flex items-center gap-1 font-semibold text-marca-forte underline">
                <Gauge size={13} /> Ver as horas em detalhe
              </Link>
              <Link href="/negociacao" className="inline-flex items-center gap-1 font-semibold text-marca-forte underline">
                <Package size={13} /> Abrir a proposta
              </Link>
            </div>
          </div>
        </Card>

        {/* Faturamento e teto */}
        <Card>
          <TituloCard icone={Coins} titulo="Faturamento" descricao="Quanto entra por mês com os clientes de hoje, e o espaço até o teto do regime." />
          <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
            <div className="rounded-bloco bg-marca-tinta p-4">
              <p className="text-[11px] font-semibold text-texto-suave">Por mês (soma dos contratos)</p>
              <p className="numero text-2xl font-extrabold">{formatarMoeda(v.faturamentoMensalCentavos)}</p>
              <p className="mt-1 text-[11px] text-texto-suave">No ano, mantendo esses clientes: {formatarMoeda(v.faturamentoMensalCentavos * 12)}.</p>
            </div>
            {v.teto ? (
              <div className="rounded-bloco bg-superficie-2/60 p-4">
                <p className="text-[11px] font-semibold text-texto-suave">Teto do ano: {formatarMoeda(v.teto.tetoCentavos)}</p>
                <p className="numero text-2xl font-extrabold">{formatarPct(v.teto.pct)} do teto</p>
                <p className="mt-1 text-[11px] leading-snug">
                  {v.teto.anualCentavos < v.teto.tetoCentavos
                    ? `Ainda há ${formatarMoeda(v.teto.tetoCentavos - v.teto.anualCentavos)} de espaço no ano dentro do regime.`
                    : "O faturamento do ano chegou ao teto: hora de conversar com o contador sobre o próximo regime."}
                </p>
              </div>
            ) : (
              <div className="rounded-bloco border border-dashed border-linha p-4 text-xs text-texto-suave">
                Informe o teto anual do regime em{" "}
                <Link href={linkConfig("limites")} className="font-semibold text-marca-forte underline">
                  Limites e avisos
                </Link>{" "}
                para ver o espaço até ele.
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
