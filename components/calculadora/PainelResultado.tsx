"use client";

import {
  AlertOctagon,
  AlertTriangle,
  ArrowDown,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Coins,
  Gauge,
  Gem,
  Info,
  PiggyBank,
  Scale,
  Shapes,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { ajustarQuantidade } from "@/lib/calculo/motor";
import type { Alerta, Cenario, Configuracao, ResultadoCenario, ResultadoMes, ResultadoPessoa } from "@/lib/calculo/tipos";
import { formatarHoras, formatarMoeda, formatarPct } from "@/lib/formato";
import { Badge, Card, Forma, IconeBadge, Passo, TituloCard, cx, type Tom } from "../ui";

// ─── Alertas ────────────────────────────────────────────────────────────────

const ICONE_ALERTA: Record<Alerta["nivel"], { icone: LucideIcon; tom: Tom; rotulo: string }> = {
  erro: { icone: AlertOctagon, tom: "erro", rotulo: "Atenção" },
  aviso: { icone: AlertTriangle, tom: "aviso", rotulo: "Aviso" },
  info: { icone: Info, tom: "info", rotulo: "Info" },
};

export function ListaAlertas({ alertas }: { alertas: Alerta[] }) {
  const [verInfo, setVerInfo] = useState(false);
  const principais = alertas.filter((a) => a.nivel !== "info");
  const infos = alertas.filter((a) => a.nivel === "info");
  if (!alertas.length) return null;
  return (
    <div className="flex flex-col gap-1.5">
      {[...principais, ...(verInfo ? infos : [])].map((a) => {
        const s = ICONE_ALERTA[a.nivel];
        const Ic = s.icone;
        return (
          <div
            key={a.texto}
            className={cx(
              "flex items-start gap-2 rounded-2xl px-3 py-2 text-xs leading-snug font-medium",
              a.nivel === "erro" ? "bg-erro-suave text-erro" : a.nivel === "aviso" ? "bg-aviso-suave text-aviso" : "bg-info-suave text-info",
            )}
          >
            <Ic size={15} className="mt-px shrink-0" aria-label={s.rotulo} />
            <span>{a.texto}</span>
          </div>
        );
      })}
      {infos.length > 0 && (
        <button type="button" className="self-start px-1 text-[11px] font-semibold text-texto-suave hover:text-texto" onClick={() => setVerInfo(!verInfo)}>
          {verInfo ? "Ocultar observações" : `+ ${infos.length} observação(ões)`}
        </button>
      )}
    </div>
  );
}

// ─── Blocos ─────────────────────────────────────────────────────────────────

function Destaque({
  rotulo,
  valor,
  sub,
  icone,
  grande,
}: {
  rotulo: string;
  valor: string;
  sub?: React.ReactNode;
  icone: LucideIcon;
  grande?: boolean;
}) {
  const Ic = icone;
  return (
    <div className="relative overflow-hidden rounded-card bg-marca p-5 text-sobre-marca shadow-forte">
      <Forma className="-top-16 -right-12 size-52 text-sobre-marca/10" variante={2} />
      <Forma className="-bottom-20 left-1/3 size-40 text-destaque/25" variante={3} />
      <div className="relative">
        <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase opacity-85">
          <Ic size={14} /> {rotulo}
        </p>
        <p className={cx("numero mt-1 font-extrabold tracking-tight", grande ? "text-5xl sm:text-6xl" : "text-4xl")}>{valor}</p>
        {sub && <div className="mt-2 text-xs font-medium opacity-90">{sub}</div>}
      </div>
    </div>
  );
}

function LinhaCascata({ rotulo, valor, sinal, forte, sub }: { rotulo: string; valor: number; sinal?: "-" | "="; forte?: boolean; sub?: React.ReactNode }) {
  return (
    <div className={cx("flex items-baseline justify-between gap-3 py-1.5", forte && "border-t border-linha pt-2.5")}>
      <span className={cx("text-[13px]", forte ? "font-bold" : "text-texto-suave")}>
        {sinal === "-" && <span className="mr-1 text-texto-suave">−</span>}
        {rotulo}
        {sub && <span className="ml-1.5">{sub}</span>}
      </span>
      <span className={cx("numero text-sm whitespace-nowrap", forte ? "font-bold" : "font-semibold", forte && valor < 0 && "text-erro")}>
        {formatarMoeda(sinal === "-" ? -valor : valor)}
      </span>
    </div>
  );
}

function Cascata({ m }: { m: ResultadoMes }) {
  const c = m.custosPorCategoria;
  return (
    <div>
      <LinhaCascata rotulo="Mensalidade" valor={m.receitaMensalidadeCentavos} />
      {m.receitaTrafegoCentavos > 0 && <LinhaCascata rotulo="Cobrança de tráfego" valor={m.receitaTrafegoCentavos} />}
      <LinhaCascata rotulo="Receita bruta" valor={m.receitaBrutaCentavos} forte />
      <LinhaCascata
        rotulo={`Imposto (${formatarPct(m.impostoPct)})`}
        valor={m.impostosCentavos}
        sinal="-"
        sub={m.impostoPctSobreposto ? <Badge tom="aviso">≠ padrão</Badge> : undefined}
      />
      <LinhaCascata
        rotulo={`Taxa de recebimento (${formatarPct(m.taxaRecebimentoPct)})`}
        valor={m.taxasCentavos}
        sinal="-"
        sub={m.taxaRecebimentoPctSobreposta ? <Badge tom="aviso">≠ padrão</Badge> : undefined}
      />
      {c.ferramenta > 0 && <LinhaCascata rotulo="Ferramentas" valor={c.ferramenta} sinal="-" />}
      {c.audiovisual > 0 && <LinhaCascata rotulo="Audiovisual" valor={c.audiovisual} sinal="-" />}
      {c.terceiro > 0 && <LinhaCascata rotulo="Terceiros" valor={c.terceiro} sinal="-" />}
      {m.custoPontualDiluidoCentavos > 0 && <LinhaCascata rotulo="Pontual diluído (custos)" valor={m.custoPontualDiluidoCentavos} sinal="-" />}
      <LinhaCascata
        rotulo="Custo fixo da empresa (rateio)"
        valor={m.rateio.quotaCentavos}
        sinal="-"
        sub={
          m.rateio.totalFixoCentavos > 0 && m.rateio.regra ? (
            <span className="text-[11px] text-texto-suave">
              {m.rateio.regra === "igual" ? `÷ ${m.rateio.clientesNaBase} clientes` : "proporcional ao valor"} de {formatarMoeda(m.rateio.totalFixoCentavos)}
            </span>
          ) : undefined
        }
      />
      <LinhaCascata rotulo="Sobra depois dos custos" valor={m.sobraCentavos} forte />
      <LinhaCascata
        rotulo={`Reinvestimento (${formatarPct(m.reinvestimentoPct)})`}
        valor={m.reinvestimentoCentavos}
        sinal="-"
        sub={m.reinvestimentoPctSobreposto ? <Badge tom="aviso">≠ padrão</Badge> : undefined}
      />
      <LinhaCascata rotulo="Para dividir entre os sócios" valor={m.distribuivelCentavos} forte />
    </div>
  );
}

function Barra({ pct, alerta }: { pct: number; alerta: boolean }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-superficie-2" role="presentation">
      <div className={cx("h-full rounded-full transition-all", alerta ? "bg-erro" : "bg-marca")} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}

function CartaoSocio({ p, grande }: { p: ResultadoPessoa; grande?: boolean }) {
  const semPiso = p.pisoHoraCentavos == null;
  const status: { tom: Tom; icone: LucideIcon; texto: string } | null =
    p.valorHoraCentavos == null
      ? null
      : semPiso
        ? { tom: "neutro", icone: Info, texto: "sem piso configurado" }
        : p.abaixoPiso
          ? { tom: "erro", icone: TrendingDown, texto: `abaixo do piso de ${formatarMoeda(p.pisoHoraCentavos)}/h` }
          : { tom: "ok", icone: CheckCircle2, texto: `acima do piso de ${formatarMoeda(p.pisoHoraCentavos)}/h` };
  return (
    <div className={cx("relative overflow-hidden rounded-2xl border p-4", p.abaixoPiso ? "border-erro/40 bg-erro-suave/40" : "border-linha bg-superficie")}>
      <span className="pointer-events-none absolute -top-6 -right-6 size-16 rounded-full bg-marca-suave/70" aria-hidden />
      <div className="relative flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-full bg-marca text-xs font-bold text-sobre-marca">{p.nome.slice(0, 1).toUpperCase()}</span>
        <span className="flex-1 truncate text-sm font-bold">{p.nome}</span>
        {p.percentual != null && (
          <Badge tom={p.percentualSobreposto ? "aviso" : "marca"} title={p.percentualSobreposto ? "Percentual diferente do padrão" : undefined}>
            {formatarPct(p.percentual)}
            {p.percentualSobreposto && " ≠ padrão"}
          </Badge>
        )}
      </div>
      <div className="relative mt-3 flex flex-col gap-1.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <p className="text-[11px] font-semibold text-texto-suave">Recebe no mês</p>
          <p className={cx("numero font-extrabold", grande ? "text-3xl" : "text-xl")}>{formatarMoeda(p.valorCentavos)}</p>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <p className="text-[11px] font-semibold text-texto-suave">Por hora</p>
          <p className={cx("numero font-extrabold", grande ? "text-3xl" : "text-xl")}>{p.horas > 0 ? formatarMoeda(p.valorHoraCentavos) : "—"}</p>
        </div>
      </div>
      {status && (
        <div className="relative mt-2">
          <Badge tom={status.tom} icone={status.icone}>
            {status.texto}
          </Badge>
        </div>
      )}
      <div className="relative mt-3">
        <div className="mb-1 flex justify-between text-[11px] font-semibold text-texto-suave">
          <span>{formatarHoras(p.horas)} no projeto</span>
          {p.consumoCapacidadePct != null ? <span>{formatarPct(p.consumoCapacidadePct)} do mês</span> : <span>capacidade não configurada</span>}
        </div>
        {p.consumoCapacidadePct != null && <Barra pct={p.consumoCapacidadePct} alerta={p.consumoCapacidadePct > 100} />}
      </div>
    </div>
  );
}

function Indicador({ icone, rotulo, valor, dica }: { icone: LucideIcon; rotulo: string; valor: string; dica: string }) {
  return (
    <div className="rounded-2xl bg-superficie-2/70 p-3" title={dica}>
      <div className="flex items-center gap-2">
        <IconeBadge icone={icone} tamanho="sm" />
        <span className="text-[11px] leading-tight font-semibold text-texto-suave">{rotulo}</span>
      </div>
      <p className="numero mt-2 text-lg font-extrabold">{valor}</p>
      <p className="mt-0.5 text-[10px] leading-tight text-texto-suave">{dica}</p>
    </div>
  );
}

// ─── Painel ─────────────────────────────────────────────────────────────────

export function PainelResultado({
  resultado: r,
  cenario,
  config,
  aoMudar,
  grande,
}: {
  resultado: ResultadoCenario;
  cenario: Cenario;
  config: Configuracao;
  aoMudar: (c: Cenario) => void;
  grande?: boolean;
}) {
  const m = r.mes;
  const limitante = config.pessoas.find((p) => p.id === r.minimo.limitantePessoaId);
  const socios = m?.pessoas.filter((p) => config.pessoas.find((x) => x.id === p.id)?.socio) ?? [];

  let destaque: React.ReactNode;
  if (r.modo === "escopo") {
    destaque = (
      <Destaque
        grande={grande}
        icone={Scale}
        rotulo="Valor mínimo mensal"
        valor={r.minimo.possivel ? formatarMoeda(r.minimo.mensalidadeMinimaCentavos) : "—"}
        sub={
          r.minimo.possivel ? (
            <>
              {r.minimo.criterio === "piso"
                ? `O menor valor em que todos os sócios com horas atingem o piso (quem define o mínimo: ${limitante?.nome ?? "—"}).`
                : "Ponto de equilíbrio: cobre custos, impostos e taxas. Não há piso configurado para quem tem horas."}
              {m && m.receitaTrafegoCentavos > 0 && (
                <span className="mt-1 block">+ {formatarMoeda(m.receitaTrafegoCentavos)} da cobrança de tráfego = receita de {formatarMoeda(m.receitaBrutaCentavos)}</span>
              )}
            </>
          ) : (
            r.minimo.motivo
          )
        }
      />
    );
  } else {
    const dif = m && r.minimo.possivel ? m.receitaMensalidadeCentavos - (r.minimo.mensalidadeMinimaCentavos ?? 0) : null;
    destaque = (
      <Destaque
        grande={grande}
        icone={PiggyBank}
        rotulo="Sobra do mês depois dos custos"
        valor={m ? formatarMoeda(m.sobraCentavos) : "—"}
        sub={
          r.minimo.possivel && dif != null ? (
            <span className="inline-flex flex-wrap items-center gap-1.5">
              Valor mínimo para este escopo: <strong className="numero">{formatarMoeda(r.minimo.mensalidadeMinimaCentavos)}</strong>
              <span className="inline-flex items-center gap-1 rounded-full bg-sobre-marca/20 px-2 py-0.5 font-bold">
                {dif >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {dif >= 0 ? `${formatarMoeda(dif)} acima` : `${formatarMoeda(-dif)} abaixo`}
              </span>
            </span>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {destaque}
      <ListaAlertas alertas={r.alertas} />

      {m && (
        <>
          {socios.length > 0 && (
            <Card>
              <TituloCard icone={Users} titulo="Cada sócio" descricao="Valor do mês e por hora trabalhada neste projeto." />
              <div className={cx("grid gap-3 px-5 pb-5", socios.length > 1 && "sm:grid-cols-2")}>
                {socios.map((p) => (
                  <CartaoSocio key={p.id} p={p} grande={grande} />
                ))}
              </div>
            </Card>
          )}

          <Card>
            <TituloCard icone={Gauge} titulo="Indicadores por hora" descricao={`${formatarHoras(m.horasTotais)} de produção por mês neste projeto.`} />
            <div className="grid grid-cols-2 gap-2 px-5 pb-5">
              <Indicador icone={Clock3} rotulo="Horas no mês" valor={formatarHoras(m.horasTotais)} dica="Soma das entregas × horas por entrega." />
              <Indicador icone={Coins} rotulo="Valor cobrado por hora" valor={formatarMoeda(m.valorCobradoHoraCentavos)} dica="Receita bruta ÷ horas." />
              <Indicador icone={ArrowDown} rotulo="Custo por hora" valor={formatarMoeda(m.custoHoraCentavos)} dica="(Custos do projeto + rateio) ÷ horas." />
              <Indicador icone={Sparkles} rotulo="Sobra por hora" valor={formatarMoeda(m.sobraHoraCentavos)} dica="Sobra ÷ horas. Informativo." />
            </div>
          </Card>

          {r.encaixe && (
            <Card>
              <TituloCard
                icone={Shapes}
                titulo="O que cabe neste valor"
                descricao="Ajuste a mistura de entregas. A folga considera o piso por hora e a capacidade de cada sócio."
                acao={
                  r.encaixe.disponivel ? (
                    <Badge tom={r.encaixe.cabe ? "ok" : "erro"} icone={r.encaixe.cabe ? CheckCircle2 : AlertOctagon}>
                      {r.encaixe.cabe ? "cabe" : "não cabe"}
                    </Badge>
                  ) : undefined
                }
              />
              <div className="px-5 pb-5">
                {!r.encaixe.disponivel && <p className="mb-3 rounded-2xl bg-info-suave px-3 py-2 text-xs font-medium text-info">{r.encaixe.motivo}</p>}
                {r.encaixe.disponivel && (
                  <div className="mb-4 flex flex-col gap-2.5">
                    {r.encaixe.pessoas
                      .filter((p) => p.horasPagasNoPiso != null || p.capacidadeHorasMes != null)
                      .map((p) => {
                        const teto = Math.min(p.horasPagasNoPiso ?? Infinity, p.capacidadeHorasMes ?? Infinity);
                        const pct = Number.isFinite(teto) && teto > 0 ? (p.horas / teto) * 100 : p.horas > 0 ? 101 : 0;
                        return (
                          <div key={p.id}>
                            <div className="mb-1 flex flex-wrap justify-between gap-2 text-[11px] font-semibold">
                              <span>{p.nome}</span>
                              <span className="text-texto-suave">
                                {formatarHoras(p.horas)} usadas
                                {p.horasPagasNoPiso != null && ` · o valor paga ${formatarHoras(p.horasPagasNoPiso)} no piso`}
                                {p.capacidadeHorasMes != null && ` · capacidade ${formatarHoras(p.capacidadeHorasMes)}`}
                              </span>
                            </div>
                            <Barra pct={pct} alerta={pct > 100} />
                          </div>
                        );
                      })}
                  </div>
                )}
                <div className="flex flex-col divide-y divide-linha">
                  {r.encaixe.tipos.map((t) => (
                    <div key={t.tipoEntregaId} className="flex flex-wrap items-center gap-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold">{t.nome}</p>
                        <p className="text-[11px] text-texto-suave">{t.horasPorUnidade != null ? `${formatarHoras(t.horasPorUnidade)} por entrega` : "sem horas configuradas"}</p>
                      </div>
                      <Passo
                        ariaLabel={t.nome}
                        valor={t.quantidade}
                        aoMudar={(v) => aoMudar(ajustarQuantidade(cenario, t.tipoEntregaId, (v ?? 0) - t.quantidade))}
                      />
                      <div className="w-32 text-right">
                        {t.folga == null ? (
                          <span className="text-[11px] text-texto-suave">{r.encaixe!.disponivel ? "sem limite" : "—"}</span>
                        ) : t.folga > 0 ? (
                          <Badge tom="ok">+{t.folga >= 9999 ? "9999" : t.folga} cabe{t.folga === 1 ? "" : "m"}</Badge>
                        ) : t.folga === 0 ? (
                          <Badge tom="aviso">no limite</Badge>
                        ) : t.naoResolve ? (
                          <Badge tom="neutro" title="Mesmo zerando só este tipo, o cenário continua não cabendo. Combine com outros ou revise o valor.">sozinho não resolve</Badge>
                        ) : (
                          <Badge tom="erro">tirar {-t.folga}</Badge>
                        )}
                        {t.limite && t.folga != null && t.folga >= 0 && <p className="mt-0.5 text-[10px] text-texto-suave">limite: {t.limite}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          <Card>
            <TituloCard icone={Coins} titulo="Do faturamento à divisão" descricao="Passo a passo do cálculo do mês." />
            <div className="px-5 pb-5">
              <Cascata m={m} />
            </div>
          </Card>
        </>
      )}

      {r.horizonte && (
        <Card>
          <TituloCard
            icone={CalendarClock}
            titulo={`Horizonte de ${r.horizonte.meses} meses`}
            descricao={`${r.horizonte.semCobranca} mês(es) sem cobrança. Só simulação.`}
          />
          <div className="flex flex-col gap-3 px-5 pb-5">
            {r.horizonte.mensalidadeNecessariaCentavos != null && r.horizonte.semCobranca > 0 && (
              <div className="rounded-2xl bg-marca-tinta p-3">
                <p className="text-[11px] font-semibold text-texto-suave">Mensalidade necessária nos meses pagantes para compensar</p>
                <p className="numero text-xl font-extrabold">{formatarMoeda(r.horizonte.mensalidadeNecessariaCentavos)}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 text-[13px]">
              <div>
                <p className="text-[11px] font-semibold text-texto-suave">Receita no período</p>
                <p className="numero font-bold">{formatarMoeda(r.horizonte.receitaTotalCentavos)}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-texto-suave">Sobra no período</p>
                <p className={cx("numero font-bold", r.horizonte.sobraTotalCentavos < 0 && "text-erro")}>{formatarMoeda(r.horizonte.sobraTotalCentavos)}</p>
              </div>
              {r.horizonte.pessoas.map((p) => (
                <div key={p.id} className="col-span-2 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-superficie-2/70 px-3 py-2">
                  <span className="font-semibold">{p.nome}</span>
                  <span className="numero text-texto-suave">
                    {formatarMoeda(p.valorTotalCentavos)} no período · média {formatarMoeda(p.valorHoraMedioCentavos)}/h
                  </span>
                  {p.abaixoPiso && (
                    <Badge tom="erro" icone={TrendingDown}>
                      abaixo do piso
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {r.pontuaisFora.map((pf) => (
        <Card key={pf.id}>
          <TituloCard icone={Gem} titulo={pf.nome} descricao="Projeto pontual cobrado fora da mensalidade (sem rateio de custo fixo)." />
          <div className="grid grid-cols-2 gap-3 px-5 pb-5 text-[13px]">
            <div>
              <p className="text-[11px] font-semibold text-texto-suave">Horas do projeto</p>
              <p className="numero font-bold">{formatarHoras(pf.horasTotais)}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-texto-suave">Custos do projeto</p>
              <p className="numero font-bold">{formatarMoeda(pf.custosCentavos)}</p>
            </div>
            <div className="col-span-2 rounded-2xl bg-marca-tinta p-3">
              <p className="text-[11px] font-semibold text-texto-suave">Valor mínimo do projeto</p>
              <p className="numero text-xl font-extrabold">{pf.minimo.possivel ? formatarMoeda(pf.minimo.mensalidadeMinimaCentavos) : "—"}</p>
              {!pf.minimo.possivel && <p className="text-[11px] text-erro">{pf.minimo.motivo}</p>}
            </div>
            {pf.resultado?.pessoas
              .filter((p) => p.horas > 0)
              .map((p) => (
                <div key={p.id} className="col-span-2 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-superficie-2/70 px-3 py-2">
                  <span className="font-semibold">{p.nome}</span>
                  <span className="numero text-texto-suave">
                    {formatarMoeda(p.valorCentavos)} · {formatarMoeda(p.valorHoraCentavos)}/h
                  </span>
                  {p.abaixoPiso && (
                    <Badge tom="erro" icone={TrendingDown}>
                      abaixo do piso
                    </Badge>
                  )}
                </div>
              ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
