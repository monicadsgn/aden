"use client";

// Seção "regras" das Configurações (movida da página sem mudar a tela).

import { Lock } from "lucide-react";
import { OQueQuerDizer } from "@/components/Alertas";
import { CampoMoeda, CampoNumero, CampoPct, Segmentado, Selecao } from "@/components/ui";
import { Explica, Alvo, Bloco } from "./auxiliares";
import type { ContextoConfig } from "./contexto";

export function SecaoRegras({ ctx }: { ctx: ContextoConfig }) {
  const { original, rascunho, e, setE, dobro, irPara } = ctx;
  return (
    <>
              <div className="flex flex-col gap-5">
                <Bloco titulo="Regime e imposto">
                  <Alvo campo="regime" className="sm:col-span-2">
                    <Segmentado
                      rotulo="Regime da empresa"
                      valor={e.regime ?? null}
                      aoMudar={(v) => setE({ regime: v })}
                      opcoes={[
                        { valor: "mei", rotulo: "MEI (imposto fixo por mês)" },
                        { valor: "outro", rotulo: "Outro (imposto em % do que entra)" },
                      ]}
                    />
                  </Alvo>
                  {e.regime !== "outro" && (
                    <>
                      <Alvo campo="impostoFixoMensalCentavos">
                        <CampoMoeda rotulo="Imposto fixo por mês (ex.: DAS do MEI)" valor={e.impostoFixoMensalCentavos ?? null} aoMudar={(v) => setE({ impostoFixoMensalCentavos: v })} />
                      </Alvo>
                      <Explica>O que a empresa paga de imposto todo mês, tenha o faturamento que tiver. Entra dividido entre os clientes, junto com os custos fixos. Ex.: R$ 70 por mês.</Explica>
                    </>
                  )}
                  {e.regime !== "mei" && (
                    <>
                      <Alvo campo="impostoPct">
                        <CampoPct rotulo="Imposto em % do faturamento" valor={e.impostoPct} aoMudar={(v) => setE({ impostoPct: v })} />
                      </Alvo>
                      <Explica>Para regimes em que o imposto é uma porcentagem do que entra. Ex.: 6% de R$ 1.000 são R$ 60.</Explica>
                    </>
                  )}
                  {e.regime == null && <p className="text-[12px] text-aviso sm:col-span-2">Escolha o regime: no MEI, o campo de imposto em % some e não entra na conta.</p>}
                  {dobro && (
                    <div className="flex flex-wrap items-center gap-2 rounded-bloco bg-erro-suave px-3 py-2 text-xs font-medium text-erro sm:col-span-2">
                      <span className="flex-1">{dobro.texto}</span>
                      <button type="button" className="rounded-botao bg-erro px-2.5 py-1 text-[11px] font-bold text-superficie" onClick={() => irPara("custos")}>
                        Ver custos fixos
                      </button>
                      <OQueQuerDizer explica={dobro.explica} />
                    </div>
                  )}
                </Bloco>

                <Bloco titulo="Como dividir o custo fixo entre os clientes">
                  <Alvo campo="regraRateio" className="sm:col-span-2">
                    <Segmentado
                      rotulo="Regra da divisão dos custos fixos"
                      valor={e.regraRateio}
                      aoMudar={(v) => setE({ regraRateio: v })}
                      opcoes={[
                        { valor: "igual", rotulo: "Igual entre clientes" },
                        { valor: "proporcional", rotulo: "Proporcional ao valor" },
                      ]}
                    />
                  </Alvo>
                  <p className="text-[12px] leading-snug text-texto-suave sm:col-span-2">
                    <strong className="text-texto">Igual:</strong> cada cliente paga a mesma parte. <strong className="text-texto">Proporcional:</strong> quem paga mais leva uma parte maior.
                    Na calculadora, o cliente que está sendo simulado conta como mais um. Sem regra escolhida, a calculadora não mostra resultado, porque o custo fixo sumiria da conta.
                  </p>
                </Bloco>

                <Bloco titulo="Reinvestimento">
                  <Alvo campo="reinvestimentoPct">
                    <CampoPct rotulo="Reinvestimento (% da sobra)" valor={e.reinvestimentoPct} aoMudar={(v) => setE({ reinvestimentoPct: v })} />
                  </Alvo>
                  <Explica>Quanto da sobra de cada cliente fica guardado na empresa antes da divisão entre os sócios. Ex.: 10% de uma sobra de R$ 1.000 são R$ 100 guardados. Vazio = nada fica guardado.</Explica>
                </Bloco>

                <Bloco titulo="Taxa de recebimento">
                  <Alvo campo="taxaRecebimentoPct">
                    <CampoPct rotulo="Taxa (%)" valor={e.taxaRecebimentoPct} aoMudar={(v) => setE({ taxaRecebimentoPct: v })} />
                  </Alvo>
                  <Explica>Quanto o meio de pagamento desconta de cada cobrança, em porcentagem. Ex.: 3% de R$ 1.000 são R$ 30.</Explica>
                  <CampoMoeda rotulo="Tarifa fixa por cobrança" valor={e.taxaRecebimentoFixaCentavos ?? null} aoMudar={(v) => setE({ taxaRecebimentoFixaCentavos: v })} />
                  <Explica>Valor fixo por cobrança, se houver. Ex.: R$ 2 por boleto. Quando o InfinitePay for integrado, estes dois campos recebem a taxa real.</Explica>
                </Bloco>

                <Bloco titulo="Ordem de distribuição dos pagamentos">
                  <Alvo campo="ordemDistribuicao" className="sm:col-span-2">
                    <Segmentado
                      rotulo="Ordem de distribuição"
                      valor={e.ordemDistribuicao ?? null}
                      aoMudar={(v) => setE({ ordemDistribuicao: v })}
                      opcoes={[
                        { valor: "custo_primeiro", rotulo: "Custo primeiro" },
                        { valor: "proporcional", rotulo: "Proporcional" },
                      ]}
                    />
                  </Alvo>
                  <p className="text-[12px] leading-snug text-texto-suave sm:col-span-2">
                    <strong className="text-texto">Custo primeiro:</strong> o que entra paga primeiro os custos do mês daquele cliente; só o que passar disso vai para os sócios.{" "}
                    <strong className="text-texto">Proporcional:</strong> cada real que entra já é dividido entre custos e sócios, na mesma proporção do mês inteiro.
                    {e.ordemDistribuicao == null && <span className="font-semibold text-aviso"> Enquanto estiver vazia, o sistema não distribui os pagamentos.</span>}
                  </p>
                </Bloco>

                <Bloco titulo="Mês do onboarding">
                  <div className="sm:col-span-2">
                    <Segmentado
                      rotulo="O mês do onboarding cobra mensalidade?"
                      valor={e.mensalidadeNoOnboarding == null ? null : e.mensalidadeNoOnboarding ? "sim" : "nao"}
                      aoMudar={(v) => setE({ mensalidadeNoOnboarding: v == null ? null : v === "sim" })}
                      opcoes={[
                        { valor: "sim", rotulo: "Cobra" },
                        { valor: "nao", rotulo: "Não cobra" },
                      ]}
                    />
                  </div>
                  <p className="text-[12px] leading-snug text-texto-suave sm:col-span-2">
                    O primeiro mês do cliente, enquanto acontece o onboarding. Aparece no checklist de fechamento da ficha.
                    {e.mensalidadeNoOnboarding == null && <span className="font-semibold text-aviso"> Vazio = ainda a definir entre os sócios.</span>}
                  </p>
                </Bloco>

                <Bloco titulo="Divisão entre os sócios">
                  <p className="text-[12px] leading-snug text-texto-suave sm:col-span-2">
                    Antes da virada, um sócio recebe um % do que entra (depois do imposto em %). Do resto saem a taxa e os custos; o que sobra fica com o outro sócio, que
                    escolhe quanto disso vai para o tráfego da Aden. Quando entrar no mês o valor da virada, a sobra passa a ser dividida pelo % de cada sócio e o tráfego
                    fica com o mínimo. <Lock size={11} className="inline" /> Os números são protegidos: mudar vale depois da aprovação.
                  </p>
                  <Alvo campo="sociedade">
                    <Selecao
                      rotulo="Quem recebe o % antes da virada"
                      valor={e.socioPercentualId ?? null}
                      vazio="Escolha o sócio…"
                      disabled={!!original.empresa.socioPercentualId}
                      opcoes={rascunho.pessoas.filter((p) => p.socio && p.ativo).map((p) => ({ valor: p.id, rotulo: p.nome }))}
                      aoMudar={(v) => setE({ socioPercentualId: v })}
                    />
                  </Alvo>
                  <div>
                    <CampoPct rotulo={<span className="flex items-center gap-1"><Lock size={11} /> % do que entra</span>} valor={e.sociedadePctSocio ?? null} aoMudar={(v) => setE({ sociedadePctSocio: v })} />
                    <p className="mt-1 text-[12px] leading-snug text-texto-suave">Parte do que entra no mês que vai para esse sócio, antes da virada. Ex.: 30% de R$ 1.000 são R$ 300.</p>
                  </div>
                  <Selecao
                    rotulo="Quem fica com a sobra"
                    valor={e.socioSobraId ?? null}
                    vazio="Escolha o sócio…"
                    disabled={!!original.empresa.socioSobraId}
                    opcoes={rascunho.pessoas.filter((p) => p.socio && p.ativo && p.id !== e.socioPercentualId).map((p) => ({ valor: p.id, rotulo: p.nome }))}
                    aoMudar={(v) => setE({ socioSobraId: v })}
                  />
                  <div>
                    <CampoPct
                      rotulo={<span className="flex items-center gap-1"><Lock size={11} /> Da sobra, vai para o tráfego</span>}
                      valor={e.sociedadeSobraTrafegoPct ?? null}
                      aoMudar={(v) => setE({ sociedadeSobraTrafegoPct: v })}
                    />
                    <p className="mt-1 text-[12px] leading-snug text-texto-suave">Parte da sobra que vira anúncio da própria Aden. Ex.: 20% de uma sobra de R$ 500 são R$ 100.</p>
                  </div>
                  <div>
                    <CampoMoeda
                      rotulo={<span className="flex items-center gap-1"><Lock size={11} /> Virada: quando entrar no mês</span>}
                      valor={e.sociedadeTetoViradaCentavos ?? null}
                      aoMudar={(v) => setE({ sociedadeTetoViradaCentavos: v })}
                    />
                    <p className="mt-1 text-[12px] leading-snug text-texto-suave">Quando o que entrou no mês chegar a este valor, a sobra passa a ser dividida pelo % de cada sócio. Ex.: R$ 10.000.</p>
                  </div>
                  <div>
                    <CampoMoeda
                      rotulo={<span className="flex items-center gap-1"><Lock size={11} /> Parte acima disso vira bônus</span>}
                      valor={e.sociedadeAvisoBonusCentavos ?? null}
                      aoMudar={(v) => setE({ sociedadeAvisoBonusCentavos: v })}
                    />
                    <p className="mt-1 text-[12px] leading-snug text-texto-suave">Quando a parte de quem recebe o % passar deste valor, o que passar aparece como bônus. Ex.: R$ 3.000.</p>
                  </div>
                  <div>
                    <CampoMoeda
                      rotulo={<span className="flex items-center gap-1"><Lock size={11} /> Mínimo do tráfego próprio por mês</span>}
                      valor={e.trafegoProprioMinimoCentavos ?? null}
                      aoMudar={(v) => setE({ trafegoProprioMinimoCentavos: v })}
                    />
                    <p className="mt-1 text-[12px] leading-snug text-texto-suave">O menor valor por mês que vai para o anúncio da própria Aden. Ex.: R$ 200 por mês.</p>
                  </div>
                  <Explica>
                    Quem escolhe quanto da sobra vai para o tráfego é quem fica com ela: mudar esse % pede a aprovação só dele. Os outros números pedem a aprovação dos
                    dois. Depois de escolhidos, quem recebe o % e quem fica com a sobra não mudam por aqui.
                  </Explica>
                </Bloco>

                <Bloco titulo="Oferta padrão (tráfego com garantia)">
                  <p className="text-[12px] leading-snug text-texto-suave sm:col-span-2">
                    O cliente só paga a gestão do tráfego quando o resultado vier. Estes valores aparecem na Proposta para o cliente e servem de aviso interno.
                  </p>
                  <div>
                    <CampoMoeda rotulo="Verba de mídia indicada: de" valor={e.ofertaVerbaMinCentavos ?? null} aoMudar={(v) => setE({ ofertaVerbaMinCentavos: v })} />
                    <p className="mt-1 text-[12px] leading-snug text-texto-suave">O menor valor de anúncio por mês que a Proposta indica ao cliente. Ex.: R$ 500.</p>
                  </div>
                  <div>
                    <CampoMoeda rotulo="até" valor={e.ofertaVerbaMaxCentavos ?? null} aoMudar={(v) => setE({ ofertaVerbaMaxCentavos: v })} />
                    <p className="mt-1 text-[12px] leading-snug text-texto-suave">O maior valor de anúncio por mês da faixa indicada. Ex.: R$ 1.500.</p>
                  </div>
                  <div>
                    <CampoMoeda
                      rotulo="Gestão depois do resultado"
                      valor={e.ofertaGestaoAposResultadoCentavos ?? null}
                      aoMudar={(v) => setE({ ofertaGestaoAposResultadoCentavos: v })}
                    />
                    <p className="mt-1 text-[12px] leading-snug text-texto-suave">Quanto o cliente passa a pagar por mês pela gestão quando o resultado vier. Ex.: R$ 800.</p>
                  </div>
                  <div>
                    <CampoMoeda
                      rotulo="Social media + tráfego não fecha abaixo de"
                      valor={e.ofertaMinimoSocialTrafegoCentavos ?? null}
                      aoMudar={(v) => setE({ ofertaMinimoSocialTrafegoCentavos: v })}
                    />
                    <p className="mt-1 text-[12px] leading-snug text-texto-suave">Menor mensalidade para os dois serviços juntos; abaixo disso a Proposta avisa. Ex.: R$ 2.000.</p>
                  </div>
                  <Explica>A verba é paga pelo cliente direto na plataforma e nunca entra no faturamento. Abaixo do mínimo, a Proposta só avisa (sem pedido de exceção).</Explica>
                </Bloco>

                <Bloco titulo="Projeto avulso (sem mensalidade)">
                  <CampoPct rotulo="Pago no início do projeto" valor={e.avulsoSinalPct ?? null} aoMudar={(v) => setE({ avulsoSinalPct: v })} />
                  <Explica>
                    Quanto do valor do projeto avulso o cliente paga para começar; o resto vem na entrega. Aparece na Proposta e no PDF. Ex.: 50% = metade no início e
                    metade na entrega. Vazio = a proposta não mostra as parcelas.
                  </Explica>
                </Bloco>

                <Bloco titulo="Leads">
                  <CampoNumero rotulo="Follow-ups do &quot;vou ver&quot; antes de sugerir perda" valor={e.followUpsMaximo ?? null} aoMudar={(v) => setE({ followUpsMaximo: v })} />
                  <Explica>Depois desse número de follow-ups sem resposta, a ficha do lead sugere marcar como perdido. Ex.: 3 follow-ups. Só sugere; vazio = nunca.</Explica>
                </Bloco>
              </div>
    </>
  );
}
