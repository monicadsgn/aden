"use client";

// Seção "servicos" das Configurações (movida da página sem mudar a tela).

import { Layers, Lock, Plus, Trash2 } from "lucide-react";
import { Botao, CampoPct, CampoTexto, Vazio } from "@/components/ui";
import { novoId } from "@/lib/calculo/novo";
import { descreverItem } from "@/lib/dados/acoes";
import { motivoNaoApagar } from "@/lib/regras/aprovacao";
import { atualizar, SomaPct, Alvo } from "./auxiliares";
import type { ContextoConfig } from "./contexto";

export function SecaoServicos({ ctx }: { ctx: ContextoConfig }) {
  const { original, rascunho, set, socios, adicionarCitados, pendentes } = ctx;
  return (
    <>
              <div className="flex flex-col gap-3">
                <p className="text-[12px] text-texto-suave">
                  <Lock size={10} className="inline" /> A divisão de horas é protegida: diz quem trabalha em cada serviço e, por isso, quanto cada hora dele vale.
                </p>
                {rascunho.servicos.length === 0 && (
                  <Vazio icone={Layers} titulo="Nenhum serviço">
                    Use a lista do briefing (só os nomes dos serviços e tipos de entrega; horas, divisão e vínculo ficam vazios) ou adicione um por um.
                    <div className="mt-3">
                      <Botao pequeno icone={Plus} onClick={adicionarCitados}>
                        Usar a lista do briefing
                      </Botao>
                    </div>
                  </Vazio>
                )}
                {rascunho.servicos.map((s) => {
                  const soma = socios.reduce((a, p) => a + (s.divisaoPadrao[p.id] ?? 0), 0);
                  const pend = pendentes.flatMap((x) => x.itens).filter((i) => i.tabela === "servico_divisao" && i.registroId === s.id);
                  return (
                    <div key={s.id} className="rounded-bloco bg-superficie-2/60 p-3">
                      <div className="flex items-end gap-2">
                        <CampoTexto className="flex-1" rotulo="Serviço" valor={s.nome} aoMudar={(v) => set({ servicos: atualizar(rascunho.servicos, s.id, { nome: v }) })} />
                        {motivoNaoApagar(original, "servico", s.id) ? (
                          <Botao variante="secundario" title={motivoNaoApagar(original, "servico", s.id) ?? ""} onClick={() => set({ servicos: atualizar(rascunho.servicos, s.id, { ativo: !s.ativo }) })}>
                            {s.ativo ? "Desativar" : "Reativar"}
                          </Botao>
                        ) : (
                          <Botao variante="perigo" icone={Trash2} aria-label="Remover serviço" onClick={() => set({ servicos: rascunho.servicos.filter((x) => x.id !== s.id) })} />
                        )}
                      </div>
                      {socios.length > 0 && (
                        <Alvo campo="divisao" className="mt-2 flex flex-wrap items-end gap-2">
                          {socios.map((p) => (
                            <CampoPct
                              key={p.id}
                              className="w-32"
                              rotulo={`% das horas · ${p.nome || "Sócio"}`}
                              valor={s.divisaoPadrao[p.id] ?? null}
                              aoMudar={(v) => set({ servicos: atualizar(rascunho.servicos, s.id, { divisaoPadrao: { ...s.divisaoPadrao, [p.id]: v } }) })}
                            />
                          ))}
                          <div className="pb-2.5">
                            <SomaPct soma={soma} total={soma === 0 ? 0 : 1} />
                          </div>
                        </Alvo>
                      )}
                      {socios.length > 0 && (
                        <p className="mt-1 text-[12px] leading-snug text-texto-suave">Quanto das horas deste serviço cada sócio faz; a soma dá 100%. Ex.: 70% para um e 30% para o outro.</p>
                      )}
                      {pend.length > 0 && (
                        <p className="mt-1 text-[12px] font-semibold text-aviso">alteração pendente de aprovação: {pend.map(descreverItem).join("; ")}</p>
                      )}
                    </div>
                  );
                })}
                {rascunho.servicos.length > 0 && (
                  <div>
                    <Botao icone={Plus} pequeno onClick={() => set({ servicos: [...rascunho.servicos, { id: novoId(), nome: "", divisaoPadrao: {}, ativo: true }] })}>
                      Adicionar serviço
                    </Botao>
                  </div>
                )}
              </div>
    </>
  );
}
