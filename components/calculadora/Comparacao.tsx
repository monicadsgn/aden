"use client";

import { AlertOctagon, CheckCircle2, Columns3, TrendingDown } from "lucide-react";
import type { Cenario, Configuracao, ResultadoCenario } from "@/lib/calculo/tipos";
import { formatarHoras, formatarMoeda, formatarPct } from "@/lib/formato";
import { Badge, Card, TituloCard, cx } from "../ui";

interface Linha {
  rotulo: string;
  grupo?: boolean;
  valores: (React.ReactNode | null)[];
  forte?: boolean;
}

export function Comparacao({
  cenarios,
  resultados,
  config,
  ativoId,
  aoSelecionar,
}: {
  cenarios: Cenario[];
  resultados: ResultadoCenario[];
  config: Configuracao;
  ativoId: string;
  aoSelecionar: (id: string) => void;
}) {
  const socios = config.pessoas.filter((p) => p.ativo && p.socio);
  const moeda = (v: number | null | undefined, k?: number) => <span key={k} className="numero">{formatarMoeda(v)}</span>;

  const linhas: Linha[] = [
    {
      rotulo: "Modo",
      valores: cenarios.map((c) => (
        <Badge key={c.id} tom="marca">
          {c.modo === "escopo" ? "escopo → mínimo" : "valor → o que cabe"}
        </Badge>
      )),
    },
    {
      rotulo: "Mensalidade",
      forte: true,
      valores: resultados.map((r, i) => (
        <span key={i} className="numero">
          {formatarMoeda(r.mes?.receitaMensalidadeCentavos)}
          {r.modo === "escopo" && <span className="ml-1 text-[10px] font-semibold text-texto-suave">mínima</span>}
        </span>
      )),
    },
    { rotulo: "Receita bruta", valores: resultados.map((r, i) => moeda(r.mes?.receitaBrutaCentavos, i)) },
    { rotulo: "Impostos e taxas", valores: resultados.map((r, i) => moeda(r.mes ? r.mes.impostosCentavos + r.mes.taxasCentavos : null, i)) },
    { rotulo: "Custos do projeto", valores: resultados.map((r, i) => moeda(r.mes?.custosProjetoCentavos, i)) },
    { rotulo: "Custo fixo rateado", valores: resultados.map((r, i) => moeda(r.mes?.rateio.quotaCentavos, i)) },
    {
      rotulo: "Sobra depois dos custos",
      forte: true,
      valores: resultados.map((r, i) => (
        <span key={i} className={cx("numero", r.mes && r.mes.sobraCentavos < 0 && "text-erro")}>
          {formatarMoeda(r.mes?.sobraCentavos)}
        </span>
      )),
    },
    { rotulo: "Reinvestimento", valores: resultados.map((r, i) => moeda(r.mes?.reinvestimentoCentavos, i)) },
    { rotulo: "Sócios", grupo: true, valores: [] },
    ...socios.flatMap((s) => [
      {
        rotulo: `${s.nome} · no mês`,
        valores: resultados.map((r, i) => {
          const p = r.mes?.pessoas.find((x) => x.id === s.id);
          return (
            <span key={i} className="numero">
              {formatarMoeda(p?.valorCentavos)}
              {p?.percentualSobreposto && (
                <span className="ml-1">
                  <Badge tom="aviso">{formatarPct(p.percentual)}</Badge>
                </span>
              )}
            </span>
          );
        }),
      },
      {
        rotulo: `${s.nome} · por hora`,
        forte: true,
        valores: resultados.map((r, i) => {
          const p = r.mes?.pessoas.find((x) => x.id === s.id);
          if (!p || p.horas <= 0) return <span key={i} className="text-texto-suave">—</span>;
          return (
            <span key={i} className="inline-flex items-center gap-1.5">
              <span className="numero">{formatarMoeda(p.valorHoraCentavos)}</span>
              {p.abaixoPiso && <TrendingDown size={14} className="text-erro" aria-label="abaixo do piso" />}
            </span>
          );
        }),
      },
      {
        rotulo: `${s.nome} · capacidade`,
        valores: resultados.map((r, i) => {
          const p = r.mes?.pessoas.find((x) => x.id === s.id);
          return (
            <span key={i} className="numero text-texto-suave">
              {formatarHoras(p?.horas)} {p?.consumoCapacidadePct != null && `· ${formatarPct(p.consumoCapacidadePct)}`}
            </span>
          );
        }),
      },
    ]),
    { rotulo: "Por hora", grupo: true, valores: [] },
    { rotulo: "Horas no mês", valores: resultados.map((r, i) => <span key={i} className="numero">{formatarHoras(r.mes?.horasTotais)}</span>) },
    { rotulo: "Valor cobrado por hora", valores: resultados.map((r, i) => moeda(r.mes?.valorCobradoHoraCentavos, i)) },
    { rotulo: "Custo por hora", valores: resultados.map((r, i) => moeda(r.mes?.custoHoraCentavos, i)) },
    { rotulo: "Sobra por hora", valores: resultados.map((r, i) => moeda(r.mes?.sobraHoraCentavos, i)) },
    {
      rotulo: "Situação",
      valores: resultados.map((r, i) => {
        const erros = r.alertas.filter((a) => a.nivel === "erro").length;
        return erros ? (
          <Badge key={i} tom="erro" icone={AlertOctagon}>
            {erros} alerta{erros > 1 ? "s" : ""}
          </Badge>
        ) : (
          <Badge key={i} tom="ok" icone={CheckCircle2}>
            ok
          </Badge>
        );
      }),
    },
  ];

  return (
    <Card>
      <TituloCard icone={Columns3} titulo="Comparação lado a lado" descricao="Os cenários desta simulação. Clique no nome para editar." />
      <div className="overflow-x-auto px-2 pb-4 sm:px-5">
        <table className="w-full min-w-[520px] border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-superficie py-2 pr-3 text-left text-[11px] font-bold tracking-wide text-texto-suave uppercase" />
              {cenarios.map((c) => (
                <th key={c.id} className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => aoSelecionar(c.id)}
                    className={cx(
                      "rounded-full px-3 py-1 text-xs font-bold transition-colors",
                      c.id === ativoId ? "bg-marca text-sobre-marca" : "bg-superficie-2 hover:bg-marca-suave",
                    )}
                  >
                    {c.nome}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, i) =>
              l.grupo ? (
                <tr key={i}>
                  <td colSpan={cenarios.length + 1} className="pt-4 pb-1 text-[10px] font-bold tracking-[0.14em] text-texto-suave uppercase">
                    {l.rotulo}
                  </td>
                </tr>
              ) : (
                <tr key={i} className="group">
                  <td className={cx("sticky left-0 z-10 border-b border-linha bg-superficie py-2 pr-3", l.forte ? "font-bold" : "text-texto-suave")}>{l.rotulo}</td>
                  {l.valores.map((v, j) => (
                    <td
                      key={j}
                      className={cx(
                        "border-b border-linha px-3 py-2 text-right whitespace-nowrap",
                        l.forte && "font-bold",
                        cenarios[j]?.id === ativoId && "bg-marca-tinta/60",
                      )}
                    >
                      {v}
                    </td>
                  ))}
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
