// O que o cliente vê na negociação ao vivo. Recebe só a VistaApresentacao, que já não
// carrega nada interno (horas, piso, divisão, custo fixo, reinvestimento).
// O sinal para o operador é um ponto que muda de cor, sem nenhuma palavra.

import { Minus, Plus } from "lucide-react";
import type { VistaApresentacao } from "@/lib/calculo/apresentacao";
import type { Id } from "@/lib/calculo/tipos";
import { formatarMoeda } from "@/lib/formato";
import { cx } from "../ui";

export function SinalDiscreto({ sinal }: { sinal: VistaApresentacao["sinal"] }) {
  return (
    <span
      aria-hidden
      data-sinal={sinal}
      className={cx("inline-block size-2.5 rounded-full transition-colors", sinal === "ok" ? "bg-ok" : sinal === "atencao" ? "bg-erro" : "bg-linha")}
    />
  );
}

export function VistaCliente({
  vista,
  aoMudarQuantidade,
  aoAlternarServico,
}: {
  vista: VistaApresentacao;
  aoMudarQuantidade?: (tipoId: Id, delta: number) => void;
  aoAlternarServico?: (servicoId: Id) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="relative overflow-hidden rounded-card bg-marca p-6 text-sobre-marca shadow-forte">
        <p className="text-xs font-bold tracking-[0.14em] uppercase opacity-80">Investimento mensal</p>
        <p className="numero mt-1 text-5xl font-extrabold tracking-tight sm:text-6xl">{vista.valorCentavos != null ? formatarMoeda(vista.valorCentavos) : "—"}</p>
        {vista.valorCentavos == null ? (
          <p className="mt-2 text-sm opacity-90">Escolha as entregas abaixo para ver o investimento.</p>
        ) : (
        <p className="mt-2 text-sm opacity-90">
          Um valor só, com {vista.incluiTrafego ? "gestão de tráfego, " : ""}produção, planejamento e todas as ferramentas incluídos.
          {vista.verbaMidiaCentavos ? " A verba de anúncios é paga por vocês direto na plataforma." : ""}
        </p>
        )}
        <span className="absolute top-4 right-4">
          <SinalDiscreto sinal={vista.sinal} />
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {vista.servicos.map((s) => (
          <section key={s.servicoId ?? "outras"} className={cx("rounded-card border bg-superficie p-5 shadow-card transition-opacity", s.ligado ? "border-linha" : "border-dashed border-linha opacity-60")}>
            <div className="mb-3 flex items-center gap-3">
              <h3 className="flex-1 text-lg font-bold">{s.nome}</h3>
              {s.servicoId && aoAlternarServico && (
                <button
                  type="button"
                  role="switch"
                  aria-checked={s.ligado}
                  onClick={() => aoAlternarServico(s.servicoId!)}
                  className={cx("relative h-7 w-12 shrink-0 rounded-full transition-colors", s.ligado ? "bg-marca" : "bg-linha")}
                  aria-label={`${s.ligado ? "Tirar" : "Incluir"} ${s.nome}`}
                >
                  <span className={cx("absolute top-1 size-5 rounded-full bg-superficie shadow transition-all", s.ligado ? "left-6" : "left-1")} />
                </button>
              )}
            </div>
            {s.ligado && (
              <ul className="flex flex-col gap-2">
                {s.itens.map((i) => (
                  <li key={i.tipoEntregaId} className="flex items-center gap-3 rounded-bloco bg-superficie-2/60 px-3 py-2">
                    <span className="min-w-0 flex-1 text-[15px] font-semibold">{i.nome}</span>
                    {aoMudarQuantidade && (
                      <button
                        type="button"
                        aria-label={`Menos ${i.nome}`}
                        disabled={i.quantidade <= 0}
                        onClick={() => aoMudarQuantidade(i.tipoEntregaId, -1)}
                        className="flex size-11 items-center justify-center rounded-full border border-linha bg-superficie text-texto hover:bg-superficie-2 disabled:opacity-30"
                      >
                        <Minus size={20} />
                      </button>
                    )}
                    <span className="numero w-10 text-center text-2xl font-extrabold">{i.quantidade}</span>
                    {aoMudarQuantidade && (
                      <button
                        type="button"
                        aria-label={`Mais ${i.nome}`}
                        onClick={() => aoMudarQuantidade(i.tipoEntregaId, 1)}
                        className="flex size-11 items-center justify-center rounded-full bg-marca text-sobre-marca hover:bg-marca-forte"
                      >
                        <Plus size={20} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
