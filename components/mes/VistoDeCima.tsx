"use client";

// Mês visto de cima: o que entrou, para onde foi e quanto fica para cada sócio,
// pela regra da sociedade (lib/calculo/sociedade.ts). Substitui a aba Sócios (29/09/2026).

import { ArrowDown, Gift, Megaphone, Receipt, Rocket, PieChart } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { BotaoAcao, OQueQuerDizer } from "@/components/Alertas";
import { CabecalhoPagina } from "@/components/Shell";
import { Badge, Card, TituloCard, cx } from "@/components/ui";
import { configVazia } from "@/lib/calculo/novo";
import type { Pagamento } from "@/lib/calculo/pagamentos";
import { calcularMesDeCima, mesQueEstouraOTeto } from "@/lib/calculo/sociedade";
import type { Configuracao } from "@/lib/calculo/tipos";
import { useDados } from "@/lib/dados/contexto";
import { competenciaAtual } from "@/lib/dados/repositorio";
import { formatarMoeda } from "@/lib/formato";

const nomeDoMes = (m: string) => new Date(`${m}-15T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

function Linha({ rotulo, frase, valor, sinal, forte, children }: { rotulo: string; frase: string; valor: number; sinal?: "-" | "="; forte?: boolean; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start gap-x-3 gap-y-1 border-b border-linha/60 py-3 last:border-0">
      <div className="min-w-0 flex-1 basis-60">
        <p className={cx("text-[14px]", forte ? "font-bold" : "font-semibold")}>{rotulo}</p>
        <p className="text-[12px] text-texto-suave">{frase}</p>
        {children}
      </div>
      <p className={cx("numero text-right text-[15px]", forte ? "font-extrabold" : "font-bold", valor < -0.5 && "text-erro")}>
        {sinal === "-" && valor > 0.5 ? "− " : ""}
        {formatarMoeda(Math.round(sinal === "-" ? Math.abs(valor) : valor))}
      </p>
    </div>
  );
}

export default function VistoDeCima() {
  const { repo } = useDados();
  const [config, setConfig] = useState<Configuracao>(configVazia());
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [mes, setMes] = useState(competenciaAtual);
  const [carregado, setCarregado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setConfig(await repo.carregarConfig());
        setPagamentos(await repo.listarPagamentos());
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro ao carregar.");
      } finally {
        setCarregado(true);
      }
    })();
  }, [repo]);

  const m = useMemo(() => calcularMesDeCima(config, pagamentos, mes), [config, pagamentos, mes]);
  const estouro = useMemo(() => mesQueEstouraOTeto(config, pagamentos, new Date().toISOString().slice(0, 10)), [config, pagamentos]);
  if (!carregado) return null;

  const socioPct = m.divisao === "percentual" ? m.socios[0] : null;
  const outros = m.divisao === "percentual" ? m.socios.slice(1) : m.socios;
  const pctVirada = m.tetoViradaCentavos ? Math.min(100, (m.entrouCentavos / m.tetoViradaCentavos) * 100) : null;

  return (
    <div className="pb-16">
      <CabecalhoPagina
        icone={PieChart}
        selo="Dinheiro e mês"
        titulo="Mês visto de cima"
        descricao="O que entrou, para onde foi e quanto fica para cada sócio."
        acoes={
          <input
            type="month"
            aria-label="Mês"
            value={mes}
            onChange={(e) => e.target.value && setMes(e.target.value)}
            className="h-10 rounded-campo border border-linha bg-superficie px-3 text-sm focus:border-marca focus:outline-none"
          />
        }
      />
      <div className="mx-auto flex max-w-[1100px] flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
        {erro && <p className="rounded-card bg-erro-suave px-4 py-3 text-sm text-erro">{erro}</p>}

        {m.alertas.map((a) => (
          <div
            key={a.texto}
            className={cx(
              "flex flex-wrap items-center gap-2 rounded-card px-4 py-3 text-xs font-medium",
              a.nivel === "aviso" || a.nivel === "erro" ? "bg-aviso-suave text-aviso" : "bg-info-suave text-info",
            )}
          >
            <span className="flex-1">{a.texto}</span>
            <BotaoAcao a={a} />
            <OQueQuerDizer explica={a.explica} />
          </div>
        ))}
        {estouro && (
          <p className="rounded-card bg-aviso-suave px-4 py-3 text-xs font-medium text-aviso">
            No ritmo de hoje, o faturamento do ano passa do teto do MEI em {nomeDoMes(estouro)}. Bom momento para falar com o contador antes disso.
          </p>
        )}

        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Card>
            <TituloCard icone={Receipt} titulo={`Para onde foi o dinheiro de ${nomeDoMes(mes)}`} descricao="De cima para baixo: o que entrou, o que saiu e o que ficou para cada um." />
            <div className="px-5 pb-4">
              <Linha rotulo="Entrou" frase="Pagamentos que caíram na conta neste mês, de todos os clientes." valor={m.entrouCentavos} forte>
                {m.porCliente.length > 0 && (
                  <p className="mt-1 text-[12px] text-texto-suave">{m.porCliente.map((c) => `${c.nome}: ${formatarMoeda(c.centavos)}`).join(" · ")}</p>
                )}
              </Linha>
              {m.impostoCentavos > 0.5 && <Linha rotulo="Imposto" frase="O imposto em % sobre o que entrou. Sai antes de qualquer divisão." valor={m.impostoCentavos} sinal="-" />}
              {socioPct && (
                <Linha rotulo={`Parte de ${socioPct.nome}`} frase={`${socioPct.regra}. Sai logo depois do imposto.`} valor={socioPct.parteCentavos} sinal="-">
                  {socioPct.bonusCentavos != null && (
                    <p className="mt-1 inline-flex items-center gap-1.5 rounded-botao bg-ok-suave px-2.5 py-1 text-[12px] font-bold text-ok">
                      <Gift size={13} /> {formatarMoeda(Math.round(socioPct.bonusCentavos))} de bônus: o que passou do combinado. Dá para planejar a virada.
                    </p>
                  )}
                </Linha>
              )}
              {m.impostoFixoCentavos > 0.5 && <Linha rotulo="DAS do MEI" frase="O imposto fixo do mês, pago pelo caixa da Aden." valor={m.impostoFixoCentavos} sinal="-" />}
              {m.taxasCentavos > 0.5 && <Linha rotulo="Taxas de recebimento" frase="O que o banco cobrou para receber (Pix não cobra; cartão, sim)." valor={m.taxasCentavos} sinal="-" />}
              <Linha rotulo="Custos da Aden" frase="Ferramentas e serviços que a Aden paga todo mês." valor={m.custosFixosCaixaCentavos} sinal="-" />
              {m.custosClientesCentavos > 0.5 && (
                <Linha rotulo="Custos dos clientes" frase="Terceiros e outros custos que estão no escopo de cada cliente (ex.: gravação)." valor={m.custosClientesCentavos} sinal="-" />
              )}
              <Linha
                rotulo="Tráfego próprio da Aden"
                frase={
                  m.divisao === "percentual"
                    ? "A parte da sobra que vai para anunciar a Aden."
                    : m.trafegoMinimoCentavos != null
                      ? "Fica com o mínimo combinado; o resto é dividido."
                      : "Sem mínimo configurado."
                }
                valor={m.trafegoProprioCentavos}
                sinal="-"
              >
                {m.completaTrafego && (
                  <p className="mt-1 text-[12px] font-semibold text-aviso">
                    Para chegar ao mínimo, {m.completaTrafego.nome} completa {formatarMoeda(Math.round(m.completaTrafego.centavos))}.
                  </p>
                )}
              </Linha>
              {outros.map((s) => (
                <Linha key={s.pessoaId} rotulo={`Fica para ${s.nome}`} frase={s.regra} valor={s.parteCentavos} forte />
              ))}
            </div>
          </Card>

          <div className="flex flex-col gap-4">
            {m.tetoViradaCentavos != null && (
              <Card>
                <TituloCard icone={Rocket} titulo="Até a virada" descricao="Quando entrar este valor num mês, a divisão passa a ser meio a meio da sobra." />
                <div className="px-5 pb-5">
                  <p className="numero text-2xl font-extrabold">
                    {formatarMoeda(m.entrouCentavos)} <span className="text-sm font-semibold text-texto-suave">de {formatarMoeda(m.tetoViradaCentavos)}</span>
                  </p>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-superficie-2">
                    <div className="h-full rounded-full bg-marca" style={{ width: `${pctVirada ?? 0}%` }} />
                  </div>
                  <p className="mt-2 text-[12px] text-texto-suave">
                    {m.divisao === "virada" ? "Virada batida neste mês: a sobra foi dividida pelo % de cada sócio." : `Faltam ${formatarMoeda(m.faltaParaViradaCentavos)} para a virada.`}
                  </p>
                </div>
              </Card>
            )}

            {m.bancadoPor.length > 0 && (
              <Card>
                <TituloCard icone={ArrowDown} titulo="Bancado por cada sócio" descricao="Custos que um sócio paga do próprio bolso. Contam no preço das propostas, mas não saem do caixa da Aden." />
                <div className="flex flex-col gap-2 px-5 pb-5">
                  {m.bancadoPor.map((b) => (
                    <div key={b.pessoaId} className="rounded-bloco bg-superficie-2/70 px-3 py-2">
                      <p className="flex justify-between text-[13px] font-semibold">
                        <span>{b.nome}</span>
                        <span className="numero">{formatarMoeda(b.centavos)}/mês</span>
                      </p>
                      <p className="text-[12px] text-texto-suave">{b.itens.join(", ")}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {m.planejados.length > 0 && (
              <Card>
                <TituloCard icone={Megaphone} titulo="Custos planejados" descricao="Guardados para quando o caixa permitir. Acendem quando a sobra do mês cobre o valor e ainda deixa o tráfego no mínimo." />
                <div className="flex flex-col gap-2 px-5 pb-5">
                  {m.planejados.map((p) => (
                    <div key={p.id} className="flex flex-wrap items-center gap-2 text-[13px]">
                      <span className="flex-1 font-semibold">{p.nome}</span>
                      <span className="numero">{formatarMoeda(p.centavos)}/mês</span>
                      <Badge tom={p.cabe ? "ok" : "neutro"}>{p.cabe ? "já cabe" : "ainda não"}</Badge>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
