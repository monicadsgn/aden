"use client";

import {
  AlertOctagon,
  AlertTriangle,
  ArrowDown,
  CalendarClock,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Copy,
  Send,
  DoorOpen,
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
import type {
  Alerta,
  Cenario,
  Configuracao,
  LimiteEncaixe,
  ResultadoCenario,
  ResultadoEntrada,
  ResultadoHorizonte,
  ResultadoMes,
  ResultadoPessoa,
  SuspensaoSemCobranca,
} from "@/lib/calculo/tipos";
import { formatarHoras, formatarMoeda, formatarPct } from "@/lib/formato";
import { Badge, Botao, Card, Forma, IconeBadge, Passo, TituloCard, cx, type Tom } from "../ui";

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
              "flex items-start gap-2 rounded-bloco px-3 py-2 text-xs leading-snug font-medium",
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

// ─── Limites do encaixe ─────────────────────────────────────────────────────
// Piso é preço (decisão comercial), capacidade é gente (decisão de equipe).

function ChipLimite({ l, estourado }: { l: LimiteEncaixe; estourado?: boolean }) {
  const piso = l.tipo === "piso";
  return (
    <Badge
      tom={estourado ? "erro" : "aviso"}
      icone={piso ? Coins : Users}
      title={piso ? "Limite de preço: o valor não paga o piso por hora deste sócio." : "Limite de gente: as horas passam da capacidade deste sócio."}
    >
      {piso ? `piso de ${l.nome} · preço` : `capacidade de ${l.nome} · gente`}
    </Badge>
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

function Cascata({ m, taxaFixa }: { m: ResultadoMes; taxaFixa: number | null }) {
  const c = m.custosPorCategoria;
  return (
    <div>
      <LinhaCascata rotulo="Mensalidade" valor={m.receitaMensalidadeCentavos} />
      {m.receitaTrafegoCentavos > 0 && <LinhaCascata rotulo="Cobrança de tráfego" valor={m.receitaTrafegoCentavos} />}
      <LinhaCascata rotulo="Receita bruta" valor={m.receitaBrutaCentavos} forte />
      {m.verbaMidiaCentavos != null && m.verbaMidiaCentavos > 0 && (
        <div className="my-1 flex items-baseline justify-between gap-3 rounded-item border border-dashed border-linha px-3 py-1.5 text-texto-suave">
          <span className="text-[12px]">
            Verba de mídia do cliente <span className="text-[11px]">(paga direto na plataforma, fora de qualquer soma)</span>
          </span>
          <span className="numero text-[13px] whitespace-nowrap">{formatarMoeda(m.verbaMidiaCentavos)}</span>
        </div>
      )}
      <LinhaCascata
        rotulo={`Imposto (${formatarPct(m.impostoPct)})`}
        valor={m.impostosCentavos}
        sinal="-"
        sub={m.impostoPctSobreposto ? <Badge tom="aviso">≠ padrão</Badge> : undefined}
      />
      <LinhaCascata
        rotulo={`Taxa de recebimento (${formatarPct(m.taxaRecebimentoPct)}${taxaFixa ? ` + ${formatarMoeda(taxaFixa)}` : ""})`}
        valor={m.taxasCentavos}
        sinal="-"
        sub={m.taxaRecebimentoPctSobreposta ? <Badge tom="aviso">≠ padrão</Badge> : undefined}
      />
      {c.ferramenta > 0 && <LinhaCascata rotulo="Ferramentas" valor={c.ferramenta} sinal="-" />}
      {c.audiovisual > 0 && <LinhaCascata rotulo="Audiovisual" valor={c.audiovisual} sinal="-" />}
      {c.terceiro > 0 && <LinhaCascata rotulo="Terceiros" valor={c.terceiro} sinal="-" />}
      {(c.outro ?? 0) > 0 && <LinhaCascata rotulo="Outros custos do caso (diária, deslocamento…)" valor={c.outro} sinal="-" />}
      {m.custoPontualDiluidoCentavos > 0 && <LinhaCascata rotulo="Pontual diluído (custos)" valor={m.custoPontualDiluidoCentavos} sinal="-" />}
      <LinhaCascata
        rotulo="Custo fixo da empresa (rateio)"
        valor={m.rateio.quotaCentavos}
        sinal="-"
        sub={
          m.rateio.totalFixoCentavos > 0 && m.rateio.regra ? (
            <span className="text-[11px] text-texto-suave">
              {m.rateio.regra === "igual" ? `÷ ${m.rateio.clientesNaBase} clientes` : "proporcional ao valor"} de {formatarMoeda(m.rateio.totalFixoCentavos)}
              {m.rateio.impostoFixoCentavos > 0 && ` (inclui ${formatarMoeda(m.rateio.impostoFixoCentavos)} de imposto fixo)`}
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
    <div className={cx("relative overflow-hidden rounded-bloco border p-4", p.abaixoPiso ? "border-erro/40 bg-erro-suave/40" : "border-linha bg-superficie")}>
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
    <div className="rounded-bloco bg-superficie-2/70 p-3" title={dica}>
      <div className="flex items-center gap-2">
        <IconeBadge icone={icone} tamanho="sm" />
        <span className="text-[11px] leading-tight font-semibold text-texto-suave">{rotulo}</span>
      </div>
      <p className="numero mt-2 text-lg font-extrabold">{valor}</p>
      <p className="mt-0.5 text-[10px] leading-tight text-texto-suave">{dica}</p>
    </div>
  );
}

// ─── Entrada do cliente (uma vez só) ────────────────────────────────────────

function BlocoEntrada({ e, mesesDesejados }: { e: ResultadoEntrada; mesesDesejados: number | null }) {
  const fmtMeses = (m: number) => (m <= 1 ? "1 mês" : `${m.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} meses`);
  return (
    <Card>
      <TituloCard
        icone={DoorOpen}
        titulo="Entrada do cliente"
        descricao="Uma vez só, separada da rotina. Custo = dinheiro + horas dos sócios no piso − o que for cobrado pela entrada."
        acao={<Badge tom="aviso">uma vez</Badge>}
      />
      <div className="flex flex-col gap-3 px-5 pb-5">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-bloco bg-marca-tinta p-3">
            <p className="text-[11px] font-semibold text-texto-suave">Custo da entrada</p>
            <p className="numero text-2xl font-extrabold">{formatarMoeda(e.custoEntradaCentavos)}</p>
          </div>
          <div className={cx("rounded-bloco p-3", e.mesesParaSePagar == null ? "bg-erro-suave" : "bg-ok-suave")}>
            <p className="text-[11px] font-semibold text-texto-suave">Se paga em</p>
            <p className={cx("numero text-2xl font-extrabold", e.mesesParaSePagar == null ? "text-erro" : "text-texto")}>
              {e.mesesParaSePagar == null ? "não se paga" : e.mesesParaSePagar === 0 ? "já está paga" : fmtMeses(e.mesesParaSePagar)}
            </p>
            <p className="mt-0.5 text-[10px] leading-tight text-texto-suave">
              {e.folgaMensalRotinaCentavos != null
                ? `a rotina gera ${formatarMoeda(Math.max(0, e.folgaMensalRotinaCentavos))}/mês acima do piso de todos`
                : "defina os percentuais e o valor da rotina"}
            </p>
          </div>
        </div>
        {e.mensalidadeParaPagarCentavos != null && mesesDesejados != null && (
          <div className="rounded-bloco border border-marca/40 p-3">
            <p className="text-[11px] font-semibold text-texto-suave">Mensalidade para a entrada se pagar em {fmtMeses(mesesDesejados)}</p>
            <p className="numero text-xl font-extrabold">{formatarMoeda(e.mensalidadeParaPagarCentavos)}</p>
          </div>
        )}
        <div className="text-[13px]">
          <div className="flex justify-between py-1">
            <span className="text-texto-suave">Custos em dinheiro (terceiros, audiovisual…)</span>
            <span className="numero font-semibold">{formatarMoeda(e.custosDinheiroCentavos)}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-texto-suave">Horas dos sócios no piso ({formatarHoras(e.horasTotais)})</span>
            <span className="numero font-semibold">{formatarMoeda(e.horasNoPisoCentavos)}</span>
          </div>
          {e.cobradoLiquidoCentavos > 0 && (
            <div className="flex justify-between py-1">
              <span className="text-texto-suave">− Cobrado pela entrada (sem imposto e taxa)</span>
              <span className="numero font-semibold">−{formatarMoeda(e.cobradoLiquidoCentavos)}</span>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-bold tracking-wide text-texto-suave uppercase">1º mês = rotina + entrada</p>
          {e.pessoas
            .filter((p) => p.horasPrimeiroMes > 0)
            .map((p) => (
              <div key={p.id}>
                <div className="mb-1 flex flex-wrap justify-between gap-2 text-[11px] font-semibold">
                  <span>{p.nome}</span>
                  <span className="text-texto-suave">
                    {formatarHoras(p.horasPrimeiroMes)} ({formatarHoras(p.horas)} da entrada)
                    {p.consumoPrimeiroMesPct != null && ` · ${formatarPct(p.consumoPrimeiroMesPct)} do mês`}
                  </span>
                </div>
                {p.consumoPrimeiroMesPct != null && <Barra pct={p.consumoPrimeiroMesPct} alerta={p.consumoPrimeiroMesPct > 100} />}
              </div>
            ))}
        </div>
      </div>
    </Card>
  );
}

// ─── Para o cliente: um valor só ────────────────────────────────────────────

function BlocoProposta({
  valor,
  arredondado,
  incluiTrafego,
  verba,
  cliente,
  jaEEscopo,
  aoGuardarEscopo,
}: {
  valor: number;
  arredondado: boolean;
  incluiTrafego: boolean;
  verba: number | null;
  cliente: string | null;
  jaEEscopo: boolean;
  aoGuardarEscopo?: () => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const texto = `Investimento mensal: ${formatarMoeda(valor)}. Inclui ${incluiTrafego ? "gestão de tráfego, " : ""}produção, planejamento e todas as ferramentas, sem cobranças separadas.${verba ? " A verba de anúncios é paga por vocês direto na plataforma." : ""}`;
  return (
    <Card>
      <TituloCard
        icone={Send}
        titulo="Para o cliente"
        descricao="O valor único que vai na proposta. As ferramentas e a estrutura já estão dentro dele, nunca como cobrança à parte."
      />
      <div className="flex flex-col gap-3 px-5 pb-5">
        <div className="rounded-bloco bg-marca-tinta p-4">
          <p className="text-[11px] font-semibold text-texto-suave">Investimento mensal</p>
          <p className="numero text-3xl font-extrabold">{formatarMoeda(valor)}</p>
          {arredondado && <p className="mt-1 text-[11px] text-texto-suave">Arredondado para cima, como definido nas configurações.</p>}
        </div>
        <p className="rounded-bloco border border-dashed border-linha px-3 py-2 text-xs leading-relaxed text-texto-suave">{texto}</p>
        <div className="flex flex-wrap gap-2">
          <Botao
            pequeno
            icone={copiado ? Check : Copy}
            onClick={() => {
              navigator.clipboard?.writeText(texto).then(() => {
                setCopiado(true);
                setTimeout(() => setCopiado(false), 2000);
              });
            }}
          >
            {copiado ? "Copiado" : "Copiar texto"}
          </Botao>
          {aoGuardarEscopo &&
            (cliente ? (
              jaEEscopo ? (
                <Badge tom="ok" icone={CheckCircle2}>
                  é o escopo contratado de {cliente}
                </Badge>
              ) : (
                <Botao pequeno variante="primario" icone={ClipboardCheck} onClick={aoGuardarEscopo}>
                  Guardar como escopo contratado de {cliente}
                </Botao>
              )
            ) : (
              <span className="self-center text-[11px] text-texto-suave">Para guardar como escopo contratado, escolha o cliente em “Como calcular”.</span>
            ))}
        </div>
      </div>
    </Card>
  );
}

// ─── Horizonte: opção A × opção B ───────────────────────────────────────────

const ROTULO_SUSPENSAO: Record<SuspensaoSemCobranca, { letra: string; texto: string }> = {
  tudo: { letra: "A", texto: "não paga nada" },
  mensalidade: { letra: "B", texto: "paga só a gestão de tráfego" },
};

function BlocoHorizonte({ h }: { h: ResultadoHorizonte }) {
  const opcoes: SuspensaoSemCobranca[] = ["tudo", "mensalidade"];
  return (
    <Card>
      <TituloCard
        icone={CalendarClock}
        titulo={`Horizonte de ${h.meses} meses`}
        descricao={`${h.semCobranca} mês(es) sem cobrança. Só simulação: compara o que fica suspenso nesses meses.`}
      />
      <div className="px-5 pb-5">
        {h.opcoesIguais && h.semCobranca > 0 && (
          <p className="mb-3 rounded-bloco bg-info-suave px-3 py-2 text-xs font-medium text-info">
            Este cenário não tem cobrança de tráfego, então as opções A e B dão o mesmo resultado.
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {opcoes.map((o) => {
            const v = h.opcoes[o];
            const escolhida = h.escolhida === o;
            return (
              <div key={o} className={cx("flex flex-col gap-2 rounded-bloco border p-3", escolhida ? "border-marca bg-marca-tinta" : "border-linha")}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-full bg-marca text-[11px] font-bold text-sobre-marca">{ROTULO_SUSPENSAO[o].letra}</span>
                  <span className="text-[13px] font-bold">{ROTULO_SUSPENSAO[o].texto}</span>
                  {escolhida && (
                    <Badge tom="marca" icone={CheckCircle2}>
                      vale neste cenário
                    </Badge>
                  )}
                </div>
                {h.semCobranca > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-texto-suave">Mensalidade necessária nos meses pagantes</p>
                    <p className="numero text-lg font-extrabold">{formatarMoeda(v.mensalidadeNecessariaCentavos)}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[11px] font-semibold text-texto-suave">Receita no período</p>
                    <p className="numero text-[13px] font-bold">{formatarMoeda(v.receitaTotalCentavos)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-texto-suave">Sobra no período</p>
                    <p className={cx("numero text-[13px] font-bold", v.sobraTotalCentavos < 0 && "text-erro")}>{formatarMoeda(v.sobraTotalCentavos)}</p>
                  </div>
                </div>
                {v.pessoas.map((p) => (
                  <div key={p.id} className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 rounded-item bg-superficie-2/70 px-3 py-2 text-[12px]">
                    <span className="font-semibold">{p.nome}</span>
                    <span className="numero text-texto-suave">
                      {formatarMoeda(p.valorTotalCentavos)} · média {formatarMoeda(p.valorHoraMedioCentavos)}/h
                    </span>
                    {p.abaixoPiso && (
                      <Badge tom="erro" icone={TrendingDown}>
                        abaixo do piso
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

// ─── Painel ─────────────────────────────────────────────────────────────────

export function PainelResultado({
  resultado: r,
  cenario,
  config,
  aoMudar,
  grande,
  aoGuardarEscopo,
}: {
  resultado: ResultadoCenario;
  cenario: Cenario;
  config: Configuracao;
  aoMudar: (c: Cenario) => void;
  grande?: boolean;
  /** guarda este cenário como escopo contratado do cliente escolhido */
  aoGuardarEscopo?: () => void;
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
        rotulo="Valor mínimo mensal · rotina"
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
        rotulo="Sobra do mês da rotina"
        valor={m ? formatarMoeda(m.sobraCentavos) : "—"}
        sub={
          r.minimo.possivel && dif != null ? (
            <span className="inline-flex flex-wrap items-center gap-1.5">
              Valor mínimo para este escopo: <strong className="numero">{formatarMoeda(r.minimo.mensalidadeMinimaCentavos)}</strong>
              <span className="inline-flex items-center gap-1 rounded-botao bg-sobre-marca/20 px-2 py-0.5 font-bold">
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
      {r.proposta && (
        <BlocoProposta
          valor={r.proposta.valorCentavos}
          arredondado={r.proposta.arredondado}
          incluiTrafego={r.proposta.incluiTrafego}
          verba={r.proposta.verbaMidiaCentavos}
          cliente={config.clientes.find((c) => c.id === cenario.clienteId)?.nome ?? null}
          jaEEscopo={!!cenario.clienteId && JSON.stringify(config.clientes.find((c) => c.id === cenario.clienteId)?.escopo ?? null) === JSON.stringify(cenario)}
          aoGuardarEscopo={aoGuardarEscopo}
        />
      )}

      {m && (
        <>
          {socios.length > 0 && (
            <Card>
              <TituloCard icone={Users} titulo="Cada sócio · rotina mensal" descricao="Valor do mês e por hora trabalhada na rotina deste projeto." />
              <div className={cx("grid gap-3 px-5 pb-5", socios.length > 1 && "sm:grid-cols-2")}>
                {socios.map((p) => (
                  <CartaoSocio key={p.id} p={p} grande={grande} />
                ))}
              </div>
            </Card>
          )}

          {r.entrada && <BlocoEntrada e={r.entrada} mesesDesejados={cenario.entrada?.mesesParaPagar ?? null} />}

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
                {!r.encaixe.disponivel && <p className="mb-3 rounded-bloco bg-info-suave px-3 py-2 text-xs font-medium text-info">{r.encaixe.motivo}</p>}
                {r.encaixe.disponivel && !r.encaixe.cabe && (
                  <div className="mb-4 flex flex-wrap items-center gap-1.5 rounded-bloco bg-erro-suave/60 px-3 py-2">
                    <span className="text-xs font-bold text-erro">Está travando:</span>
                    {r.encaixe.limitantes.map((l) => (
                      <ChipLimite key={l.tipo + l.pessoaId} l={l} estourado />
                    ))}
                  </div>
                )}
                {r.encaixe.disponivel && (
                  <div className="mb-4 flex flex-col gap-2.5">
                    {r.encaixe.pessoas
                      .filter((p) => p.horasPagasNoPiso != null || p.capacidadeHorasMes != null)
                      .map((p) => {
                        const teto = Math.min(p.horasPagasNoPiso ?? Infinity, p.capacidadeHorasMes ?? Infinity);
                        const tetoPor: "piso" | "capacidade" =
                          (p.horasPagasNoPiso ?? Infinity) <= (p.capacidadeHorasMes ?? Infinity) ? "piso" : "capacidade";
                        const pct = Number.isFinite(teto) && teto > 0 ? (p.horas / teto) * 100 : p.horas > 0 ? 101 : 0;
                        return (
                          <div key={p.id}>
                            <div className="mb-1 flex flex-wrap justify-between gap-2 text-[11px] font-semibold">
                              <span>
                                {p.nome}
                                {Number.isFinite(teto) && (
                                  <span className="ml-1.5 font-medium text-texto-suave">
                                    · teto pelo {tetoPor === "piso" ? "piso (preço)" : "capacidade (gente)"}
                                  </span>
                                )}
                              </span>
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
                        <p className="text-[11px] text-texto-suave">
                          {config.tiposEntrega.find((x) => x.id === t.tipoEntregaId)?.audiovisual
                            ? "vídeo de terceiro · só custo"
                            : t.horasPorUnidade != null
                              ? `${formatarHoras(t.horasPorUnidade)} por entrega`
                              : "sem horas configuradas"}
                        </p>
                      </div>
                      <Passo
                        ariaLabel={t.nome}
                        valor={t.quantidade}
                        aoMudar={(v) => aoMudar(ajustarQuantidade(cenario, t.tipoEntregaId, (v ?? 0) - t.quantidade))}
                      />
                      <div className="flex w-48 flex-col items-end gap-1 text-right">
                        {t.folga == null && t.naoResolve ? (
                          <span className="text-[11px] text-texto-suave">nada a tirar</span>
                        ) : t.folga == null ? (
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
                        {t.folga != null && t.folga >= 0 && t.folga < 9999 && t.limites.length > 0 && (
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="text-[10px] text-texto-suave">o próximo esbarra em</span>
                            {t.limites.map((l) => (
                              <ChipLimite key={l.tipo + l.pessoaId} l={l} />
                            ))}
                          </div>
                        )}
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
              <Cascata m={m} taxaFixa={config.empresa.taxaRecebimentoFixaCentavos ?? null} />
            </div>
          </Card>
        </>
      )}

      {r.horizonte && <BlocoHorizonte h={r.horizonte} />}

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
            <div className="col-span-2 rounded-bloco bg-marca-tinta p-3">
              <p className="text-[11px] font-semibold text-texto-suave">Valor mínimo do projeto</p>
              <p className="numero text-xl font-extrabold">{pf.minimo.possivel ? formatarMoeda(pf.minimo.mensalidadeMinimaCentavos) : "—"}</p>
              {!pf.minimo.possivel && <p className="text-[11px] text-erro">{pf.minimo.motivo}</p>}
            </div>
            {pf.resultado?.pessoas
              .filter((p) => p.horas > 0)
              .map((p) => (
                <div key={p.id} className="col-span-2 flex flex-wrap items-center justify-between gap-2 rounded-item bg-superficie-2/70 px-3 py-2">
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
