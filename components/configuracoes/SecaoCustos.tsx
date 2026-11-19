"use client";

// Seção "custos" das Configurações (movida da página sem mudar a tela).

import { Plus, Trash2 } from "lucide-react";
import { OQueQuerDizer } from "@/components/Alertas";
import { Badge, Botao, CampoMoeda, CampoTexto, Interruptor, Selecao, cx } from "@/components/ui";
import { novoId } from "@/lib/calculo/novo";
import { formatarMoeda } from "@/lib/formato";
import { atualizar } from "./auxiliares";
import type { ContextoConfig } from "./contexto";

export function SecaoCustos({ ctx }: { ctx: ContextoConfig }) {
  const { rascunho, set, totalFixo, dobro, irPara } = ctx;
  return (
    <>
              <div className="flex flex-col gap-3">
                {dobro && (
                  <div className="flex flex-wrap items-center gap-2 rounded-bloco bg-erro-suave px-3 py-2 text-xs font-medium text-erro">
                    <span className="flex-1">{dobro.texto}</span>
                    <OQueQuerDizer explica={dobro.explica} />
                  </div>
                )}
                <p className="text-[12px] text-texto-suave">
                  O imposto do MEI não entra aqui: ele tem campo próprio em{" "}
                  <button type="button" className="font-semibold text-marca-forte underline" onClick={() => irPara("regras")}>
                    Regras da empresa
                  </button>
                  , e o sistema já soma os dois na hora de dividir entre os clientes.
                </p>
                <p className="text-[12px] text-texto-suave">
                  <strong className="text-texto">Quem paga:</strong> se um sócio paga do próprio bolso, o custo continua contando no preço das propostas, mas no mês visto de cima
                  aparece em &quot;bancado por&quot; e não sai do caixa da Aden. <strong className="text-texto">Planejado:</strong> custo guardado para quando o caixa permitir; fica
                  desligado e avisa quando a sobra do mês cobre.
                </p>
                <p className="text-[12px] text-texto-suave">
                  <strong className="text-texto">Valor:</strong> quanto o custo sai por mês. Ex.: R$ 60 por mês de uma ferramenta.
                </p>
                {rascunho.custosFixos.map((c) => (
                  <div key={c.id} className={cx("flex flex-col gap-2 rounded-bloco bg-superficie-2/60 p-3", !c.ativo && "opacity-70")}>
                    <div className="grid grid-cols-[1fr_9rem_auto] items-end gap-2">
                      <CampoTexto ariaLabel="Nome do custo" placeholder="Ex.: nome da assinatura" valor={c.nome} aoMudar={(v) => set({ custosFixos: atualizar(rascunho.custosFixos, c.id, { nome: v }) })} />
                      <CampoMoeda ariaLabel="Valor mensal" valor={c.valorMensalCentavos} aoMudar={(v) => set({ custosFixos: atualizar(rascunho.custosFixos, c.id, { valorMensalCentavos: v }) })} />
                      <Botao variante="perigo" icone={Trash2} aria-label="Remover custo" onClick={() => set({ custosFixos: rascunho.custosFixos.filter((x) => x.id !== c.id) })} />
                    </div>
                    <div className="flex flex-wrap items-end gap-4">
                      <Selecao
                        className="w-48"
                        rotulo="Quem paga"
                        valor={c.pagoPorPessoaId ?? null}
                        vazio="A Aden (caixa)"
                        opcoes={rascunho.pessoas.filter((p) => p.socio && p.ativo).map((p) => ({ valor: p.id, rotulo: `${p.nome} (do bolso)` }))}
                        aoMudar={(v) => set({ custosFixos: atualizar(rascunho.custosFixos, c.id, { pagoPorPessoaId: v }) })}
                      />
                      <Interruptor
                        ligado={c.ativo}
                        rotulo="Ligado"
                        aoMudar={(v) => set({ custosFixos: atualizar(rascunho.custosFixos, c.id, { ativo: v, planejado: v ? false : c.planejado }) })}
                      />
                      <Interruptor
                        ligado={!!c.planejado}
                        rotulo="Planejado (para quando o caixa permitir)"
                        aoMudar={(v) => set({ custosFixos: atualizar(rascunho.custosFixos, c.id, { planejado: v, ativo: v ? false : c.ativo }) })}
                      />
                    </div>
                  </div>
                ))}
                <div className="flex flex-wrap items-center gap-3">
                  <Botao icone={Plus} pequeno onClick={() => set({ custosFixos: [...rascunho.custosFixos, { id: novoId(), nome: "", valorMensalCentavos: null, ativo: true }] })}>
                    Adicionar custo fixo
                  </Botao>
                  {totalFixo > 0 && <Badge tom="marca">total: {formatarMoeda(totalFixo)}/mês</Badge>}
                </div>
              </div>
    </>
  );
}
