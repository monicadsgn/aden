"use client";

// Seção "socios" das Configurações (movida da página sem mudar a tela).

import { Lock, Plus, Trash2, Users } from "lucide-react";
import { TrocarFoto } from "@/components/Avatar";
import { Botao, CampoMoeda, CampoNumero, CampoPct, CampoTexto, Selecao, Vazio } from "@/components/ui";
import { novoId } from "@/lib/calculo/novo";
import { atualizar, SomaPct, Explica, Alvo, Protegido } from "./auxiliares";
import type { ContextoConfig } from "./contexto";

export function SecaoSocios({ ctx }: { ctx: ContextoConfig }) {
  const { original, rascunho, membros, set, socios, somaSocios, loginsUsados, itemPendente, usuario, atualizarUsuario, setOriginal } = ctx;
  return (
    <>
              <div className="flex flex-col gap-3">
                <div className="flex justify-end">
                  <SomaPct soma={somaSocios} total={socios.length} />
                </div>
                {socios.length === 0 && (
                  <Vazio icone={Users} titulo="Nenhum sócio cadastrado">
                    Cadastre os sócios para a calculadora dividir o resultado.
                  </Vazio>
                )}
                {socios.map((p) => {
                  const orig = original.pessoas.find((x) => x.id === p.id);
                  return (
                    <div key={p.id} className="flex flex-col gap-3 rounded-bloco bg-superficie-2/60 p-3">
                      {orig && (
                        <TrocarFoto
                          pessoaId={p.id}
                          nome={p.nome}
                          foto={p.fotoUrl}
                          aoTrocar={(url) => {
                            // foto é salva na hora: atualiza o rascunho e o original para não parecer mudança pendente
                            setOriginal((o) => ({ ...o, pessoas: atualizar(o.pessoas, p.id, { fotoUrl: url }) }));
                            set({ pessoas: atualizar(rascunho.pessoas, p.id, { fotoUrl: url }) });
                            if (p.id === usuario?.pessoaId) void atualizarUsuario();
                          }}
                        />
                      )}
                      <div className="grid grid-cols-2 items-start gap-3 sm:grid-cols-[1.4fr_1fr_1fr_1fr_auto]">
                        <CampoTexto className="col-span-2 sm:col-span-1" rotulo="Nome" valor={p.nome} aoMudar={(v) => set({ pessoas: atualizar(rascunho.pessoas, p.id, { nome: v }) })} />
                        <Alvo campo="percentualPadrao">
                          <CampoPct
                            rotulo={
                              <span className="inline-flex items-center gap-1">
                                <Lock size={10} /> % da sobra
                              </span>
                            }
                            valor={p.percentualPadrao}
                            aoMudar={(v) => set({ pessoas: atualizar(rascunho.pessoas, p.id, { percentualPadrao: v }) })}
                          />
                          <Protegido pendente={itemPendente("percentual_padrao", p.id)} />
                        </Alvo>
                        <Alvo campo="pisoHoraCentavos">
                          <CampoMoeda
                            rotulo={
                              <span className="inline-flex items-center gap-1">
                                <Lock size={10} /> Piso por hora
                              </span>
                            }
                            valor={p.pisoHoraCentavos}
                            aoMudar={(v) => set({ pessoas: atualizar(rascunho.pessoas, p.id, { pisoHoraCentavos: v }) })}
                          />
                          <Protegido pendente={itemPendente("piso_hora_centavos", p.id)} />
                        </Alvo>
                        <Alvo campo="capacidadeHorasMes">
                          <CampoNumero rotulo="Horas no mês" sufixo="h" valor={p.capacidadeHorasMes} aoMudar={(v) => set({ pessoas: atualizar(rascunho.pessoas, p.id, { capacidadeHorasMes: v }) })} />
                        </Alvo>
                        {/* sócio já salvo não se apaga (G8): muda a divisão e só se decide com os dois */}
                        {!orig ? (
                          <Botao className="mt-5" variante="perigo" icone={Trash2} aria-label={`Remover ${p.nome}`} onClick={() => set({ pessoas: rascunho.pessoas.filter((x) => x.id !== p.id) })} />
                        ) : (
                          <span />
                        )}
                      </div>
                      <div className="grid gap-2 sm:grid-cols-[1fr_1.4fr]">
                        <Selecao
                          rotulo="Acesso deste sócio (para aprovar o que o afeta)"
                          valor={p.membroId ?? null}
                          vazio="— sem login ligado —"
                          opcoes={membros
                            .filter((m) => m.papel === "admin" && (!loginsUsados.has(m.id) || m.id === p.membroId) && !/conector/i.test(m.nome))
                            .map((m) => ({ valor: m.id, rotulo: `${m.nome} (${m.email})` }))}
                          aoMudar={(v) => (orig?.membroId ? undefined : set({ pessoas: atualizar(rascunho.pessoas, p.id, { membroId: v }) }))}
                        />
                        <Explica>
                          {orig?.membroId
                            ? "Acesso ligado. Trocar o acesso de um sócio não é feito pela tela, para ninguém aprovar no lugar do outro."
                            : "Sem login ligado, os pedidos que afetam este sócio ficam esperando até ele ter acesso e aprovar."}
                        </Explica>
                      </div>
                    </div>
                  );
                })}
                <div className="grid gap-2 text-[12px] leading-snug text-texto-suave sm:grid-cols-3">
                  <p>
                    <strong className="text-texto">% da sobra:</strong> quanto do que sobra de cada cliente vai para cada sócio. Os dois precisam somar 100%. Ex.: 60% e 40%.
                  </p>
                  <p>
                    <strong className="text-texto">Piso por hora:</strong> o mínimo que cada hora de trabalho precisa pagar. Abaixo disso, o sistema acende o alerta. Ex.: R$ 50 por hora.
                  </p>
                  <p>
                    <strong className="text-texto">Horas no mês:</strong> quanto cada um consegue produzir por mês. A tela Mês compara com o que os clientes pedem. Ex.: 100 h no mês.
                  </p>
                </div>
                <div>
                  <Botao
                    icone={Plus}
                    pequeno
                    onClick={() =>
                      set({
                        pessoas: [...rascunho.pessoas, { id: novoId(), nome: "", socio: true, percentualPadrao: null, pisoHoraCentavos: null, capacidadeHorasMes: null, ativo: true }],
                      })
                    }
                  >
                    Adicionar sócio
                  </Botao>
                </div>
              </div>
    </>
  );
}
