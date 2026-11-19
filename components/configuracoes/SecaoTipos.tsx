"use client";

// Seção "tipos" das Configurações (movida da página sem mudar a tela).

import { Clock3, Lock, Plus, Timer, Trash2 } from "lucide-react";
import Link from "next/link";
import { Botao, CampoMinutos, CampoNumero, CampoTexto, Segmentado, Selecao, Vazio } from "@/components/ui";
import { novoId } from "@/lib/calculo/novo";
import { motivoNaoApagar } from "@/lib/regras/aprovacao";
import { COM_VOLUME } from "@/lib/recursos";
import { atualizar, Alvo, Protegido } from "./auxiliares";
import type { ContextoConfig } from "./contexto";

export function SecaoTipos({ ctx }: { ctx: ContextoConfig }) {
  const { original, rascunho, set, itemPendente, temMedicao } = ctx;
  return (
    <>
              <div className="flex flex-col gap-2">
                <p className="text-[12px] text-texto-suave">
                  Digite o tempo em <strong>minutos</strong> (20 min, 40 min…). <Lock size={10} className="inline" /> É protegido: muda quanto cada hora vale. Roteiro e direção de
                  gravação são feitos pelos sócios, com tempo. Entrega feita por um terceiro (ex.: gravação) não tem tempo dos sócios: escolha em &quot;Quem faz&quot;. &quot;Como o cliente vê&quot; troca o nome só no painel do cliente (ex.: Post).
                </p>
                {(COM_VOLUME.botaoCalibragem || temMedicao) && (
                  <Link
                    href="/calibragem"
                    className="inline-flex items-center gap-1.5 self-start rounded-botao border border-linha bg-superficie px-3 py-2 text-xs font-semibold hover:border-marca"
                  >
                    <Timer size={14} /> Calibragem: o tempo medido nas tarefas
                  </Link>
                )}
                {rascunho.tiposEntrega.length === 0 && (
                  <Vazio icone={Clock3} titulo="Nenhum tipo de entrega">
                    Ex.: post simples, carrossel, PDF, peça de WhatsApp, criativo de tráfego com variações, planejamento mensal, relatório.
                  </Vazio>
                )}
                {rascunho.tiposEntrega.map((t) => {
                  // "Quem faz": os sócios (tem tempo) ou um terceiro cadastrado (sem tempo dos sócios, vira custo do cliente)
                  const terceiros = rascunho.terceiros ?? [];
                  const semTerceiroEscolhido = !!t.audiovisual && !t.terceiroId;
                  const quemFaz = t.terceiroId ?? (semTerceiroEscolhido ? "__terceiro" : "socios");
                  return (
                  <div key={t.id} className="grid grid-cols-[1fr_auto] items-start gap-2 rounded-bloco bg-superficie-2/60 p-3 sm:grid-cols-[1.4fr_1fr_1fr_8.5rem_auto]">
                    <CampoTexto className="col-span-2 sm:col-span-1" rotulo="Entrega" valor={t.nome} aoMudar={(v) => set({ tiposEntrega: atualizar(rascunho.tiposEntrega, t.id, { nome: v }) })} />
                    <Selecao
                      rotulo="Serviço"
                      valor={t.servicoId}
                      vazio="— sem serviço —"
                      opcoes={rascunho.servicos.map((s) => ({ valor: s.id, rotulo: s.nome || "(sem nome)" }))}
                      aoMudar={(v) => set({ tiposEntrega: atualizar(rascunho.tiposEntrega, t.id, { servicoId: v }) })}
                    />
                    <Selecao
                      rotulo="Quem faz"
                      valor={quemFaz}
                      opcoes={[
                        { valor: "socios", rotulo: "Os sócios" },
                        ...(semTerceiroEscolhido ? [{ valor: "__terceiro", rotulo: "Um terceiro (escolha qual)" }] : []),
                        ...terceiros.map((x) => ({ valor: x.id, rotulo: x.nome || "(terceiro sem nome)" })),
                      ]}
                      aoMudar={(v) => {
                        if (!v || v === "__terceiro") return;
                        const patch = v === "socios" ? { audiovisual: false, terceiroId: null } : { audiovisual: true, terceiroId: v };
                        set({ tiposEntrega: atualizar(rascunho.tiposEntrega, t.id, patch) });
                      }}
                    />
                    {t.audiovisual ? (
                      <div className="pt-6 text-center text-[12px] leading-tight font-semibold text-texto-suave">sem tempo dos sócios</div>
                    ) : t.projeto ? (
                      <Alvo campo="horasPorUnidade">
                        <CampoNumero
                          rotulo={
                            <span className="inline-flex items-center gap-1">
                              <Lock size={10} /> Horas do projeto
                            </span>
                          }
                          sufixo="h"
                          valor={t.horasPorUnidade}
                          aoMudar={(v) => set({ tiposEntrega: atualizar(rascunho.tiposEntrega, t.id, { horasPorUnidade: v }) })}
                        />
                        <Protegido pendente={itemPendente("horas_por_unidade", t.id)} />
                      </Alvo>
                    ) : (
                      <Alvo campo="horasPorUnidade">
                        <CampoMinutos
                          rotulo={
                            <span className="inline-flex items-center gap-1">
                              <Lock size={10} /> Tempo por entrega
                            </span>
                          }
                          valor={t.horasPorUnidade}
                          aoMudar={(v) => set({ tiposEntrega: atualizar(rascunho.tiposEntrega, t.id, { horasPorUnidade: v }) })}
                        />
                        <Protegido pendente={itemPendente("horas_por_unidade", t.id)} />
                      </Alvo>
                    )}
                    {motivoNaoApagar(original, "tipo_entrega", t.id) ? (
                      <Botao className="mt-5" variante="secundario" title={motivoNaoApagar(original, "tipo_entrega", t.id) ?? ""} onClick={() => set({ tiposEntrega: atualizar(rascunho.tiposEntrega, t.id, { ativo: !t.ativo }) })}>
                        {t.ativo ? "Desativar" : "Reativar"}
                      </Botao>
                    ) : (
                      <Botao className="mt-5" variante="perigo" icone={Trash2} aria-label="Remover tipo" onClick={() => set({ tiposEntrega: rascunho.tiposEntrega.filter((x) => x.id !== t.id) })} />
                    )}
                    {!t.audiovisual && (
                      <div className="col-span-full flex flex-wrap items-end gap-3">
                        <Segmentado<"entrega" | "projeto">
                          rotulo="Como mede"
                          valor={t.projeto ? "projeto" : "entrega"}
                          aoMudar={(v) => v && set({ tiposEntrega: atualizar(rascunho.tiposEntrega, t.id, { projeto: v === "projeto", prazoDias: v === "projeto" ? t.prazoDias : null }) })}
                          opcoes={[
                            { valor: "entrega", rotulo: "Por entrega (minutos)" },
                            { valor: "projeto", rotulo: "Projeto (horas e prazo)" },
                          ]}
                        />
                        {t.projeto && (
                          <CampoNumero className="w-40" rotulo="Prazo de entrega" sufixo="dias úteis" valor={t.prazoDias ?? null} aoMudar={(v) => set({ tiposEntrega: atualizar(rascunho.tiposEntrega, t.id, { prazoDias: v }) })} />
                        )}
                        <p className="min-w-0 flex-1 basis-60 pb-2 text-[12px] text-texto-suave">
                          {t.projeto
                            ? "Projeto de marca (logo, identidade, estrutura visual): horas totais estimadas do projeto inteiro, com estudo, pesquisa, rascunho e teste. Ex.: 30 h e 15 dias. O prazo vai para o contrato."
                            : "Entrega do dia a dia (post, carrossel, roteiro): quanto leva uma unidade. Ex.: 20 min por post."}
                        </p>
                      </div>
                    )}
                    <CampoTexto
                      className="col-span-full sm:max-w-sm"
                      rotulo="Como o cliente vê (opcional)"
                      placeholder={t.nome || "igual ao nome"}
                      valor={t.nomeCliente ?? ""}
                      aoMudar={(v) => set({ tiposEntrega: atualizar(rascunho.tiposEntrega, t.id, { nomeCliente: v || null }) })}
                    />
                    <label className="col-span-full flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={t.semAprovacaoCliente ?? false}
                        onChange={(e) => set({ tiposEntrega: atualizar(rascunho.tiposEntrega, t.id, { semAprovacaoCliente: e.target.checked }) })}
                      />
                      <span>
                        Não precisa da aprovação do cliente
                        <span className="block text-xs text-texto-suave">Peça deste tipo vai direto: ao marcar como agendada, já fica agendada. Ex.: card de jogo.</span>
                      </span>
                    </label>
                    {t.terceiroId && (
                      <p className="col-span-full text-xs text-texto-suave">Não conta horas dos sócios. Vira custo do cliente, pelo valor cadastrado em Terceiros.</p>
                    )}
                    {semTerceiroEscolhido && (
                      <p className="col-span-full text-xs text-aviso">
                        Escolha em &quot;Quem faz&quot; qual terceiro faz esta entrega{terceiros.length === 0 ? " (cadastre antes na aba Terceiros)" : ""}.
                      </p>
                    )}
                  </div>
                  );
                })}
                <div>
                  <Botao
                    icone={Plus}
                    pequeno
                    onClick={() => set({ tiposEntrega: [...rascunho.tiposEntrega, { id: novoId(), nome: "", servicoId: null, horasPorUnidade: null, audiovisual: false, ativo: true }] })}
                  >
                    Adicionar tipo de entrega
                  </Botao>
                </div>
              </div>
    </>
  );
}
