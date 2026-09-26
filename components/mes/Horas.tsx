"use client";

import { AlertOctagon, CalendarRange, CheckCircle2, Gauge, Info, Users, Waves, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CabecalhoPagina } from "@/components/Shell";
import { Badge, Card, EtiquetaOrigem, TituloCard, Vazio, cx, type Tom } from "@/components/ui";
import { calcularVisaoMes, type SituacaoSocio, type VisaoSocio } from "@/lib/calculo/mes";
import { Avatar } from "@/components/Avatar";
import { configVazia } from "@/lib/calculo/novo";
import type { Configuracao } from "@/lib/calculo/tipos";
import { useDados } from "@/lib/dados/contexto";
import { formatarHoras, formatarMoeda, formatarPct } from "@/lib/formato";

const SITUACAO: Record<SituacaoSocio, { tom: Tom; icone: LucideIcon; rotulo: string }> = {
  afogado: { tom: "erro", icone: AlertOctagon, rotulo: "passou das horas" },
  folga_sobrando: { tom: "info", icone: Waves, rotulo: "folga sobrando" },
  ok: { tom: "ok", icone: CheckCircle2, rotulo: "dentro da capacidade" },
  sem_capacidade: { tom: "neutro", icone: Info, rotulo: "capacidade não configurada" },
};

/** Uma frase por sócio: quanto usa e quanto sobra. */
function frase(s: VisaoSocio): string {
  const usadas = formatarHoras(s.horasUsadas);
  if (s.capacidadeHorasMes == null)
    return `${s.nome}: os clientes usam ${usadas} por mês, mas a capacidade dele(a) não está configurada. Preencha a capacidade para ver o espaço livre.`;
  const cap = formatarHoras(s.capacidadeHorasMes);
  if (s.situacao === "afogado")
    return `${s.nome}: os clientes pedem ${usadas}, mas ${s.nome} tem ${cap} no mês. Faltam ${formatarHoras(-s.horasLivres!)}. Hora de redistribuir ou de dar o próximo passo da trilha.`;
  return `${s.nome}: os clientes usam ${usadas} das ${cap} do mês. Sobram ${formatarHoras(s.horasLivres)} livres.`;
}

function Barra({ pct, tom }: { pct: number; tom: "erro" | "marca" | "info" }) {
  const cor = { erro: "bg-erro", marca: "bg-marca", info: "bg-info" }[tom];
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-superficie-2" role="presentation">
      <div className={cx("h-full rounded-full transition-all", cor)} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}

export default function Capacidade() {
  const { repo } = useDados();
  const [config, setConfig] = useState<Configuracao>(configVazia());
  const [carregado, setCarregado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    repo
      .carregarConfig()
      .then(setConfig)
      .catch((e) => setErro(e instanceof Error ? e.message : "Erro ao carregar."))
      .finally(() => setCarregado(true));
  }, [repo]);

  const v = useMemo(() => calcularVisaoMes(config), [config]);
  const socios = config.pessoas.filter((p) => p.ativo && p.socio);

  if (!carregado) return null;

  return (
    <div className="pb-16">
      <CabecalhoPagina
        icone={Gauge}
        selo="Operação"
        titulo="Capacidade"
        descricao="O detalhe das horas: quanto cada cliente pede de cada sócio por mês, contra as horas que cada um tem."
      />
      <div className="mx-auto flex max-w-[1100px] flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
        {erro && <p className="rounded-card bg-erro-suave px-4 py-3 text-sm text-erro">{erro}</p>}

        {v.semEscopo.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-card border border-aviso/30 bg-aviso-suave px-4 py-3 text-sm text-aviso">
            <Info size={17} />
            <span className="flex-1">
              <strong>Sem escopo contratado:</strong> {v.semEscopo.join(", ")}. As horas desses clientes <strong>não entram</strong> na soma abaixo, então a
              folga pode ser menor do que parece.
            </span>
            <Link href="/calculadora" className="rounded-botao bg-aviso px-3 py-1 text-xs font-bold text-superficie">
              Definir na calculadora
            </Link>
          </div>
        )}

        {/* Sócios */}
        <Card>
          <TituloCard icone={Users} titulo="Horas de cada sócio" descricao="Horas que os clientes ativos pedem por mês, de cada sócio." />
          <div className="grid gap-3 px-5 pb-5 md:grid-cols-2">
            {socios.length === 0 && (
              <Vazio icone={Users} titulo="Nenhum sócio cadastrado">
                Cadastre os sócios e a capacidade de cada um em Configurações.
              </Vazio>
            )}
            {v.socios.map((s) => {
              const st = SITUACAO[s.situacao];
              return (
                <div
                  key={s.id}
                  className={cx(
                    "flex flex-col gap-3 rounded-bloco border p-4",
                    s.situacao === "afogado" ? "border-erro/40 bg-erro-suave/40" : "border-linha",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Avatar nome={s.nome} foto={config.pessoas.find((x) => x.id === s.id)?.fotoUrl} />
                    <span className="flex-1 text-sm font-bold">{s.nome}</span>
                    <Badge tom={st.tom} icone={st.icone}>
                      {st.rotulo}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-[11px] font-semibold text-texto-suave">Clientes usam</p>
                      <EtiquetaOrigem texto="previsto no escopo" previsao />
                      <p className="numero text-xl font-extrabold">{formatarHoras(s.horasUsadas)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-texto-suave">Tem no mês</p>
                      <p className="numero text-xl font-extrabold">{formatarHoras(s.capacidadeHorasMes)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-texto-suave">{s.horasLivres != null && s.horasLivres < 0 ? "Faltam" : "Sobram"}</p>
                      <p className={cx("numero text-xl font-extrabold", s.horasLivres != null && s.horasLivres < 0 && "text-erro")}>
                        {s.horasLivres == null ? "—" : formatarHoras(Math.abs(s.horasLivres))}
                      </p>
                    </div>
                  </div>
                  {s.usoPct != null && (
                    <div>
                      <Barra pct={s.usoPct} tom={s.situacao === "afogado" ? "erro" : s.situacao === "folga_sobrando" ? "info" : "marca"} />
                      <p className="mt-1 text-right text-[11px] font-semibold text-texto-suave">{formatarPct(s.usoPct)} das horas do mês</p>
                    </div>
                  )}
                  <p className="text-xs leading-relaxed text-texto">{frase(s)}</p>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Clientes */}
        <Card>
          <TituloCard
            icone={CalendarRange}
            titulo="Horas por cliente"
            descricao="Quanto cada cliente ativo pede de cada sócio por mês, pelo escopo contratado."
            acao={<EtiquetaOrigem texto="previsto no escopo" previsao />}
          />
          <div className="overflow-x-auto px-2 pb-4 sm:px-5">
            {v.clientes.length === 0 ? (
              <Vazio icone={CalendarRange} titulo="Nenhum cliente ativo">
                Cadastre os clientes em Configurações e guarde o escopo contratado de cada um pela calculadora.
              </Vazio>
            ) : (
              <table className="w-full min-w-[480px] border-separate border-spacing-0 text-[13px]">
                <thead>
                  <tr className="text-left text-[11px] font-bold tracking-wide text-texto-suave uppercase">
                    <th className="py-2 pr-3">Cliente</th>
                    {socios.map((p) => (
                      <th key={p.id} className="px-3 py-2 text-right">
                        {p.nome}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-right">Total</th>
                    <th className="px-3 py-2 text-right">Valor/mês</th>
                  </tr>
                </thead>
                <tbody>
                  {v.clientes.map((c) => (
                    <tr key={c.id}>
                      <td className="border-t border-linha py-2 pr-3 font-semibold">
                        {c.nome}
                        {c.interno && <span className="ml-1.5"><Badge>interno</Badge></span>}
                        {!c.temEscopo && <span className="ml-1.5"><Badge tom="aviso">sem escopo</Badge></span>}
                      </td>
                      {socios.map((p) => (
                        <td key={p.id} className="numero border-t border-linha px-3 py-2 text-right">
                          {c.temEscopo ? formatarHoras(c.horasPorSocio[p.id] ?? 0) : "—"}
                        </td>
                      ))}
                      <td className="numero border-t border-linha px-3 py-2 text-right font-bold">{c.temEscopo ? formatarHoras(c.horasTotais) : "—"}</td>
                      <td className="numero border-t border-linha px-3 py-2 text-right">{formatarMoeda(c.valorMensalCentavos)}</td>
                    </tr>
                  ))}
                  <tr className="font-bold">
                    <td className="border-t-2 border-linha py-2 pr-3">Total</td>
                    {v.socios.map((s) => (
                      <td key={s.id} className="numero border-t-2 border-linha px-3 py-2 text-right">
                        {formatarHoras(s.horasUsadas)}
                      </td>
                    ))}
                    <td className="numero border-t-2 border-linha px-3 py-2 text-right">
                      {formatarHoras(v.clientes.reduce((a, c) => a + c.horasTotais, 0))}
                    </td>
                    <td className="numero border-t-2 border-linha px-3 py-2 text-right">{formatarMoeda(v.faturamentoMensalCentavos)}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </Card>

      </div>
    </div>
  );
}
