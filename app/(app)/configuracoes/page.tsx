"use client";

import {
  Building2,
  Check,
  Clock3,
  Layers,
  Percent,
  Plus,
  Receipt,
  RotateCcw,
  Save,
  Settings2,
  Shapes,
  Trash2,
  Users,
  Gauge,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CabecalhoPagina } from "@/components/Shell";
import {
  Badge,
  Botao,
  Card,
  CampoMoeda,
  CampoNumero,
  CampoPct,
  CampoTexto,
  Interruptor,
  Segmentado,
  Selecao,
  TituloCard,
  Vazio,
} from "@/components/ui";
import { configVazia, novoId } from "@/lib/calculo/novo";
import type { Configuracao } from "@/lib/calculo/tipos";
import { useDados } from "@/lib/dados/contexto";
import { diferenca, temAlteracoes, type AlteracoesConfig } from "@/lib/dados/repositorio";
import { formatarMoeda, formatarPct } from "@/lib/formato";

// Nomes citados pela Moni no briefing. Só nomes: horas e divisões ficam vazias.
const SERVICOS_CITADOS = ["Tráfego pago", "Criativos", "Social media", "Branding"];
const TIPOS_CITADOS = [
  "Post simples",
  "Carrossel",
  "PDF",
  "Peça de WhatsApp",
  "Criativo de tráfego com variações",
  "Planejamento mensal",
  "Relatório",
];

function atualizar<T extends { id: string }>(lista: T[], id: string, patch: Partial<T>): T[] {
  return lista.map((x) => (x.id === id ? { ...x, ...patch } : x));
}

function SomaPct({ soma, total }: { soma: number; total: number }) {
  if (total === 0) return null;
  const ok = Math.abs(soma - 100) < 0.005;
  return (
    <Badge tom={ok ? "ok" : "erro"} icone={ok ? Check : undefined}>
      soma {formatarPct(soma)}
    </Badge>
  );
}

function Explica({ children }: { children: React.ReactNode }) {
  return <p className="self-end pb-2 text-[11px] leading-snug text-texto-suave">{children}</p>;
}

export default function Configuracoes() {
  const { repo } = useDados();
  const [original, setOriginal] = useState<Configuracao>(configVazia());
  const [rascunho, setRascunho] = useState<Configuracao>(configVazia());
  const [carregado, setCarregado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tom: "ok" | "erro"; texto: string } | null>(null);

  const carregar = useCallback(async () => {
    try {
      const c = await repo.carregarConfig();
      setOriginal(c);
      setRascunho(structuredClone(c));
    } catch (e) {
      setMensagem({ tom: "erro", texto: e instanceof Error ? e.message : "Erro ao carregar." });
    } finally {
      setCarregado(true);
    }
  }, [repo]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial
    void carregar();
  }, [carregar]);

  const alteracoes: AlteracoesConfig = useMemo(
    () => ({
      empresa: JSON.stringify(original.empresa) !== JSON.stringify(rascunho.empresa) ? rascunho.empresa : undefined,
      pessoas: diferenca(original.pessoas, rascunho.pessoas),
      servicos: diferenca(original.servicos, rascunho.servicos),
      tiposEntrega: diferenca(original.tiposEntrega, rascunho.tiposEntrega),
      custosFixos: diferenca(original.custosFixos, rascunho.custosFixos),
      clientes: diferenca(original.clientes, rascunho.clientes),
    }),
    [original, rascunho],
  );
  const sujo = temAlteracoes(alteracoes);

  const salvar = async () => {
    setSalvando(true);
    setMensagem(null);
    try {
      await repo.salvarConfig(alteracoes);
      await carregar();
      setMensagem({ tom: "ok", texto: "Configurações salvas. A alteração ficou registrada no histórico." });
    } catch (e) {
      setMensagem({ tom: "erro", texto: e instanceof Error ? e.message : "Erro ao salvar." });
    } finally {
      setSalvando(false);
    }
  };

  const set = (patch: Partial<Configuracao>) => setRascunho((r) => ({ ...r, ...patch }));
  const socios = rascunho.pessoas.filter((p) => p.socio);
  const somaSocios = socios.filter((p) => p.ativo).reduce((a, p) => a + (p.percentualPadrao ?? 0), 0);
  const totalFixo = rascunho.custosFixos.filter((c) => c.ativo).reduce((a, c) => a + (c.valorMensalCentavos ?? 0), 0);
  const e = rascunho.empresa;

  const adicionarCitados = () => {
    const servicos = [...rascunho.servicos];
    for (const nome of SERVICOS_CITADOS)
      if (!servicos.some((s) => s.nome.toLowerCase() === nome.toLowerCase())) servicos.push({ id: novoId(), nome, divisaoPadrao: {}, ativo: true });
    const tipos = [...rascunho.tiposEntrega];
    for (const nome of TIPOS_CITADOS)
      if (!tipos.some((t) => t.nome.toLowerCase() === nome.toLowerCase()))
        tipos.push({ id: novoId(), nome, servicoId: null, horasPorUnidade: null, audiovisual: false, ativo: true });
    set({ servicos, tiposEntrega: tipos });
  };

  if (!carregado) return null;

  return (
    <div className="pb-28">
      <CabecalhoPagina
        icone={Settings2}
        titulo="Configurações"
        descricao="Regras padrão da empresa. Tudo começa vazio: nada aqui vem preenchido. Toda alteração fica registrada com autor e data."
      />

      <div className="mx-auto grid max-w-[1500px] gap-5 px-4 py-6 sm:px-6 lg:grid-cols-2 lg:px-8">
        {/* Sócios */}
        <Card className="lg:col-span-2">
          <TituloCard
            icone={Users}
            titulo="Sócios"
            descricao="Percentual padrão da divisão, piso de valor por hora e horas disponíveis por mês."
            acao={<SomaPct soma={somaSocios} total={socios.length} />}
          />
          <div className="flex flex-col gap-3 px-5 pb-5">
            {socios.length === 0 && (
              <Vazio icone={Users} titulo="Nenhum sócio cadastrado">
                Cadastre os sócios para a calculadora dividir o resultado.
              </Vazio>
            )}
            {socios.map((p) => (
              <div key={p.id} className="grid grid-cols-2 items-end gap-3 rounded-bloco bg-superficie-2/60 p-3 sm:grid-cols-[1.4fr_1fr_1fr_1fr_auto]">
                <CampoTexto className="col-span-2 sm:col-span-1" rotulo="Nome" valor={p.nome} aoMudar={(v) => set({ pessoas: atualizar(rascunho.pessoas, p.id, { nome: v }) })} />
                <CampoPct rotulo="% padrão" valor={p.percentualPadrao} aoMudar={(v) => set({ pessoas: atualizar(rascunho.pessoas, p.id, { percentualPadrao: v }) })} />
                <CampoMoeda rotulo="Piso por hora" valor={p.pisoHoraCentavos} aoMudar={(v) => set({ pessoas: atualizar(rascunho.pessoas, p.id, { pisoHoraCentavos: v }) })} />
                <CampoNumero rotulo="Horas/mês" sufixo="h" valor={p.capacidadeHorasMes} aoMudar={(v) => set({ pessoas: atualizar(rascunho.pessoas, p.id, { capacidadeHorasMes: v }) })} />
                <Botao variante="perigo" icone={Trash2} aria-label={`Remover ${p.nome}`} onClick={() => set({ pessoas: rascunho.pessoas.filter((x) => x.id !== p.id) })} />
              </div>
            ))}
            <div>
              <Botao
                icone={Plus}
                pequeno
                onClick={() =>
                  set({
                    pessoas: [
                      ...rascunho.pessoas,
                      { id: novoId(), nome: "", socio: true, percentualPadrao: null, pisoHoraCentavos: null, capacidadeHorasMes: null, ativo: true },
                    ],
                  })
                }
              >
                Adicionar sócio
              </Botao>
            </div>
          </div>
        </Card>

        {/* Percentuais da empresa */}
        <Card>
          <TituloCard icone={Percent} titulo="Percentuais, impostos e taxas" descricao="Padrão para todos os projetos. Cada cenário pode sobrepor, e a tela sinaliza quando isso acontece." />
          <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2">
            <CampoPct rotulo="Reinvestimento" valor={e.reinvestimentoPct} aoMudar={(v) => set({ empresa: { ...e, reinvestimentoPct: v } })} />
            <Explica>Quanto da sobra de cada cliente fica guardado na empresa antes da divisão.</Explica>
            <CampoMoeda
              rotulo="Imposto fixo por mês (ex.: MEI)"
              valor={e.impostoFixoMensalCentavos ?? null}
              aoMudar={(v) => set({ empresa: { ...e, impostoFixoMensalCentavos: v } })}
            />
            <Explica>Valor que a empresa paga todo mês, tenha o faturamento que tiver. Entra dividido entre os clientes, junto com os custos fixos.</Explica>
            <CampoPct rotulo="Imposto em % do faturamento" valor={e.impostoPct} aoMudar={(v) => set({ empresa: { ...e, impostoPct: v } })} />
            <Explica>Para regimes em que o imposto é uma porcentagem do que entra. No MEI, deixe vazio.</Explica>
            <CampoPct rotulo="Taxa de recebimento (%)" valor={e.taxaRecebimentoPct} aoMudar={(v) => set({ empresa: { ...e, taxaRecebimentoPct: v } })} />
            <Explica>Quanto o meio de pagamento desconta de cada cobrança, em porcentagem.</Explica>
            <CampoMoeda
              rotulo="Taxa de recebimento fixa (por cobrança)"
              valor={e.taxaRecebimentoFixaCentavos ?? null}
              aoMudar={(v) => set({ empresa: { ...e, taxaRecebimentoFixaCentavos: v } })}
            />
            <Explica>Tarifa fixa por cobrança, se houver. Quando o InfinitePay for integrado, estes dois campos recebem a taxa real.</Explica>
          </div>
        </Card>

        {/* Limites e avisos */}
        <Card>
          <TituloCard icone={Gauge} titulo="Limites e avisos" descricao="Quando o sistema deve acender um alerta. Vazio = sem aviso." />
          <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2">
            <CampoMoeda
              rotulo="Teto de faturamento no ano"
              valor={e.tetoFaturamentoAnualCentavos ?? null}
              aoMudar={(v) => set({ empresa: { ...e, tetoFaturamentoAnualCentavos: v } })}
            />
            <Explica>O limite do regime (no MEI, o teto anual). Passar dele muda o regime inteiro da empresa.</Explica>
            <CampoPct rotulo="Avisar a partir de (% do teto)" valor={e.avisoTetoPct ?? null} aoMudar={(v) => set({ empresa: { ...e, avisoTetoPct: v } })} />
            <Explica>Quando a soma do ano projetada chegar a esta porcentagem do teto, o sistema avisa antes de estourar.</Explica>
            <CampoPct rotulo="Folga sobrando abaixo de (% da capacidade)" valor={e.ociosidadePct ?? null} aoMudar={(v) => set({ empresa: { ...e, ociosidadePct: v } })} />
            <Explica>Se os clientes usarem menos que isso das horas de um sócio, a Visão do mês mostra que ele tem espaço sobrando.</Explica>
            <CampoMoeda
              rotulo="Arredondar a proposta para cima, de"
              valor={e.arredondamentoPropostaCentavos ?? null}
              aoMudar={(v) => set({ empresa: { ...e, arredondamentoPropostaCentavos: v } })}
            />
            <Explica>O valor que vai para o cliente sobe até o próximo múltiplo deste valor, para sair um número redondo.</Explica>
          </div>
        </Card>

        {/* Custos fixos */}
        <Card>
          <TituloCard
            icone={Building2}
            titulo="Custos fixos da empresa"
            descricao="Assinaturas, armazenamento, ferramentas de IA… Rateados entre os clientes ativos."
            acao={totalFixo > 0 ? <Badge tom="marca">{formatarMoeda(totalFixo)}/mês</Badge> : undefined}
          />
          <div className="flex flex-col gap-3 px-5 pb-5">
            <div>
              <p className="mb-1 text-xs font-semibold text-texto-suave">Regra de rateio</p>
              <Segmentado
                rotulo="Regra de rateio"
                valor={e.regraRateio}
                aoMudar={(v) => set({ empresa: { ...e, regraRateio: v } })}
                opcoes={[
                  { valor: "igual", rotulo: "Igual entre clientes" },
                  { valor: "proporcional", rotulo: "Proporcional ao valor" },
                ]}
              />
              {e.regraRateio == null && <p className="mt-1 text-[11px] text-aviso">Nenhuma regra escolhida.</p>}
            </div>
            {rascunho.custosFixos.map((c) => (
              <div key={c.id} className="grid grid-cols-[1fr_9rem_auto] items-end gap-2">
                <CampoTexto ariaLabel="Nome do custo" placeholder="Ex.: nome da assinatura" valor={c.nome} aoMudar={(v) => set({ custosFixos: atualizar(rascunho.custosFixos, c.id, { nome: v }) })} />
                <CampoMoeda ariaLabel="Valor mensal" valor={c.valorMensalCentavos} aoMudar={(v) => set({ custosFixos: atualizar(rascunho.custosFixos, c.id, { valorMensalCentavos: v }) })} />
                <Botao variante="perigo" icone={Trash2} aria-label="Remover custo" onClick={() => set({ custosFixos: rascunho.custosFixos.filter((x) => x.id !== c.id) })} />
              </div>
            ))}
            <div>
              <Botao icone={Plus} pequeno onClick={() => set({ custosFixos: [...rascunho.custosFixos, { id: novoId(), nome: "", valorMensalCentavos: null, ativo: true }] })}>
                Adicionar custo fixo
              </Botao>
            </div>
          </div>
        </Card>

        {/* Serviços */}
        <Card>
          <TituloCard
            icone={Layers}
            titulo="Serviços e quem executa"
            descricao="Divisão padrão das horas de cada serviço entre os sócios. Copy, aprovação e direção de criativo podem ser divididos."
            acao={
              rascunho.servicos.length === 0 ? (
                <Botao pequeno icone={Plus} onClick={adicionarCitados}>
                  Usar a lista do briefing
                </Botao>
              ) : undefined
            }
          />
          <div className="flex flex-col gap-3 px-5 pb-5">
            {rascunho.servicos.length === 0 && (
              <Vazio icone={Layers} titulo="Nenhum serviço">
                Use a lista do briefing (só os nomes dos serviços e tipos de entrega; horas, divisão e vínculo ficam vazios) ou adicione um por um.
              </Vazio>
            )}
            {rascunho.servicos.map((s) => {
              const soma = socios.reduce((a, p) => a + (s.divisaoPadrao[p.id] ?? 0), 0);
              return (
                <div key={s.id} className="rounded-bloco bg-superficie-2/60 p-3">
                  <div className="flex items-end gap-2">
                    <CampoTexto className="flex-1" rotulo="Serviço" valor={s.nome} aoMudar={(v) => set({ servicos: atualizar(rascunho.servicos, s.id, { nome: v }) })} />
                    <Botao variante="perigo" icone={Trash2} aria-label="Remover serviço" onClick={() => set({ servicos: rascunho.servicos.filter((x) => x.id !== s.id) })} />
                  </div>
                  {socios.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-end gap-2">
                      {socios.map((p) => (
                        <CampoPct
                          key={p.id}
                          className="w-28"
                          rotulo={p.nome || "Sócio"}
                          valor={s.divisaoPadrao[p.id] ?? null}
                          aoMudar={(v) => set({ servicos: atualizar(rascunho.servicos, s.id, { divisaoPadrao: { ...s.divisaoPadrao, [p.id]: v } }) })}
                        />
                      ))}
                      <div className="pb-2.5">
                        <SomaPct soma={soma} total={soma === 0 ? 0 : 1} />
                      </div>
                    </div>
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
        </Card>

        {/* Tipos de entrega */}
        <Card>
          <TituloCard
            icone={Shapes}
            titulo="Tipos de entrega"
            descricao="A unidade de esforço da calculadora: horas por entrega de cada tipo. Roteiro e direção de gravação são tipos normais, com horas. Vídeo editado é de terceiro."
          />
          <div className="flex flex-col gap-2 px-5 pb-5">
            {rascunho.tiposEntrega.length === 0 && (
              <Vazio icone={Clock3} titulo="Nenhum tipo de entrega">
                Ex.: post simples, carrossel, PDF, peça de WhatsApp, criativo de tráfego com variações, planejamento mensal, relatório.
              </Vazio>
            )}
            {rascunho.tiposEntrega.map((t) => (
              <div key={t.id} className="grid grid-cols-[1fr_auto] items-end gap-2 rounded-bloco bg-superficie-2/60 p-3 sm:grid-cols-[1.4fr_1fr_7rem_auto]">
                <CampoTexto className="col-span-2 sm:col-span-1" rotulo="Entrega" valor={t.nome} aoMudar={(v) => set({ tiposEntrega: atualizar(rascunho.tiposEntrega, t.id, { nome: v }) })} />
                <Selecao
                  rotulo="Serviço"
                  valor={t.servicoId}
                  vazio="— sem serviço —"
                  opcoes={rascunho.servicos.map((s) => ({ valor: s.id, rotulo: s.nome || "(sem nome)" }))}
                  aoMudar={(v) => set({ tiposEntrega: atualizar(rascunho.tiposEntrega, t.id, { servicoId: v }) })}
                />
                {t.audiovisual ? (
                  <div className="pb-2.5 text-center text-[11px] leading-tight font-semibold text-texto-suave">
                    sem horas
                    <br />
                    (terceiro)
                  </div>
                ) : (
                  <CampoNumero rotulo="Horas/un." sufixo="h" valor={t.horasPorUnidade} aoMudar={(v) => set({ tiposEntrega: atualizar(rascunho.tiposEntrega, t.id, { horasPorUnidade: v }) })} />
                )}
                <Botao variante="perigo" icone={Trash2} aria-label="Remover tipo" onClick={() => set({ tiposEntrega: rascunho.tiposEntrega.filter((x) => x.id !== t.id) })} />
                <div className="col-span-full">
                  <Interruptor
                    ligado={!!t.audiovisual}
                    rotulo="Vídeo de terceiro (edição, motion, legenda, corte): não gera horas"
                    aoMudar={(v) => set({ tiposEntrega: atualizar(rascunho.tiposEntrega, t.id, { audiovisual: v }) })}
                  />
                </div>
              </div>
            ))}
            <div>
              <Botao icone={Plus} pequeno onClick={() => set({ tiposEntrega: [...rascunho.tiposEntrega, { id: novoId(), nome: "", servicoId: null, horasPorUnidade: null, audiovisual: false, ativo: true }] })}>
                Adicionar tipo de entrega
              </Botao>
            </div>
          </div>
        </Card>

        {/* Clientes */}
        <Card>
          <TituloCard
            icone={Receipt}
            titulo="Clientes ativos (base do rateio)"
            descricao="Clientes atuais e o valor mensal de cada um. Na próxima fase isso vem direto dos contratos."
          />
          <div className="flex flex-col gap-2 px-5 pb-5">
            {rascunho.clientes.map((c) => (
              <div key={c.id} className="rounded-bloco bg-superficie-2/60 p-3">
                <div className="grid grid-cols-[1fr_9rem_auto] items-end gap-2">
                  <CampoTexto rotulo="Cliente" valor={c.nome} aoMudar={(v) => set({ clientes: atualizar(rascunho.clientes, c.id, { nome: v }) })} />
                  <CampoMoeda rotulo="Valor mensal" valor={c.valorMensalCentavos} aoMudar={(v) => set({ clientes: atualizar(rascunho.clientes, c.id, { valorMensalCentavos: v }) })} />
                  <Botao variante="perigo" icone={Trash2} aria-label="Remover cliente" onClick={() => set({ clientes: rascunho.clientes.filter((x) => x.id !== c.id) })} />
                </div>
                <div className="mt-2 flex flex-wrap gap-4">
                  <Interruptor ligado={c.ativo} rotulo="Ativo" aoMudar={(v) => set({ clientes: atualizar(rascunho.clientes, c.id, { ativo: v }) })} />
                  <Interruptor ligado={c.participaRateio} rotulo="Entra no rateio" aoMudar={(v) => set({ clientes: atualizar(rascunho.clientes, c.id, { participaRateio: v }) })} />
                  <Interruptor ligado={c.interno} rotulo="Interno (rede da própria Aden)" aoMudar={(v) => set({ clientes: atualizar(rascunho.clientes, c.id, { interno: v }) })} />
                  {c.escopo ? (
                    <Badge tom="ok" icone={Check}>
                      escopo contratado definido
                    </Badge>
                  ) : (
                    <Badge tom="aviso" title="Abra a calculadora, escolha este cliente no cenário e use 'Guardar como escopo contratado'.">
                      sem escopo: horas fora da Visão do mês
                    </Badge>
                  )}
                </div>
              </div>
            ))}
            <div>
              <Botao
                icone={Plus}
                pequeno
                onClick={() =>
                  set({ clientes: [...rascunho.clientes, { id: novoId(), nome: "", interno: false, participaRateio: true, valorMensalCentavos: null, ativo: true }] })
                }
              >
                Adicionar cliente
              </Botao>
            </div>
          </div>
        </Card>
      </div>

      {/* barra de salvar */}
      {(sujo || mensagem) && (
        <div className="nao-imprimir fixed inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-4 lg:pl-64">
          <div className="flex w-full max-w-2xl flex-wrap items-center gap-3 rounded-botao border border-linha bg-superficie px-4 py-2 shadow-forte">
            <p className={`flex-1 text-xs font-semibold ${mensagem?.tom === "erro" ? "text-erro" : sujo ? "text-texto" : "text-ok"}`}>
              {sujo ? "Há alterações não salvas." : mensagem?.texto}
              {sujo && mensagem?.tom === "erro" && <span className="block text-erro">{mensagem.texto}</span>}
            </p>
            {sujo && (
              <>
                <Botao pequeno variante="fantasma" icone={RotateCcw} onClick={() => setRascunho(structuredClone(original))}>
                  Descartar
                </Botao>
                <Botao pequeno variante="primario" icone={Save} disabled={salvando} onClick={salvar}>
                  {salvando ? "Salvando…" : "Salvar"}
                </Botao>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
