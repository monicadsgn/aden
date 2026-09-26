"use client";

import {
  Building2,
  Check,
  Clock3,
  Gauge,
  Layers,
  Lock,
  Plus,
  Receipt,
  RotateCcw,
  Save,
  Scale,
  Settings2,
  Shapes,
  ShieldCheck,
  Trash2,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { TrocarFoto } from "@/components/Avatar";
import { OQueQuerDizer } from "@/components/Alertas";
import { CabecalhoPagina } from "@/components/Shell";
import {
  Badge,
  Botao,
  Card,
  CampoMinutos,
  CampoMoeda,
  CampoNumero,
  CampoPct,
  CampoTexto,
  Interruptor,
  Segmentado,
  Selecao,
  TituloCard,
  Vazio,
  cx,
  useParametro,
} from "@/components/ui";
import { verificarImpostoEmDobro } from "@/lib/calculo/motor";
import { configVazia, novoId } from "@/lib/calculo/novo";
import type { Configuracao, SecaoConfig } from "@/lib/calculo/tipos";
import { descreverItem } from "@/lib/dados/acoes";
import { useDados } from "@/lib/dados/contexto";
import { diferenca, temAlteracoes, type AlteracoesConfig, type Membro, type Pedido } from "@/lib/dados/repositorio";
import { formatarMoeda, formatarPct } from "@/lib/formato";
import { REGRAS_PROTECAO, type ItemProtegido } from "@/lib/regras/aprovacao";
import { camposFaltando } from "@/lib/regras/pendencias";

// Nomes citados pela Moni no briefing. Só nomes: horas e divisões ficam vazias.
const SERVICOS_CITADOS = ["Tráfego pago", "Criativos", "Social media", "Branding"];
const TIPOS_CITADOS = ["Post simples", "Carrossel", "PDF", "Peça de WhatsApp", "Criativo de tráfego com variações", "Planejamento mensal", "Relatório"];

const SECOES: { id: SecaoConfig; rotulo: string; icone: LucideIcon; frase: string }[] = [
  { id: "socios", rotulo: "Sócios", icone: Users, frase: "Quem divide o resultado, o piso por hora de cada um e quantas horas cada um tem no mês." },
  { id: "servicos", rotulo: "Serviços", icone: Layers, frase: "O que a Aden vende e quem executa as horas de cada serviço." },
  { id: "tipos", rotulo: "Tipos de entrega", icone: Shapes, frase: "Quanto tempo leva cada entrega (post, carrossel, roteiro…). É a base de todas as horas." },
  { id: "custos", rotulo: "Custos fixos", icone: Building2, frase: "O que a empresa paga todo mês, tenha cliente ou não. É dividido entre os clientes." },
  { id: "regras", rotulo: "Regras da empresa", icone: Scale, frase: "Regime e imposto, como dividir o custo fixo, reinvestimento, taxas e como distribuir cada pagamento." },
  { id: "limites", rotulo: "Limites e avisos", icone: Gauge, frase: "Quando o sistema acende um alerta. Vazio = sem aviso." },
  { id: "clientes", rotulo: "Clientes", icone: Receipt, frase: "Clientes ativos e o valor mensal de cada um. É a base do rateio e da visão do mês." },
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

function Explica({ children }: { children: ReactNode }) {
  return <p className="self-end pb-2 text-[11px] leading-snug text-texto-suave">{children}</p>;
}

/** Marca o campo para o botão dos avisos saber onde levar. */
function Alvo({ campo, children, className }: { campo: string; children: ReactNode; className?: string }) {
  return (
    <div data-campo={campo} className={cx("rounded-campo", className)}>
      {children}
    </div>
  );
}

/** Cadeado + alteração pendente, embaixo de um campo protegido. */
function Protegido({ pendente }: { pendente: ItemProtegido | null }) {
  if (!pendente) return null;
  return <p className="mt-1 text-[10px] leading-tight font-semibold text-aviso">alteração pendente de aprovação: {descreverItem(pendente).split(": ").slice(1).join(": ")}</p>;
}

export default function Configuracoes() {
  const { repo, usuario, atualizarUsuario } = useDados();
  const [original, setOriginal] = useState<Configuracao>(configVazia());
  const [rascunho, setRascunho] = useState<Configuracao>(configVazia());
  const [membros, setMembros] = useState<Membro[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [carregado, setCarregado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tom: "ok" | "erro" | "aviso"; texto: string } | null>(null);
  const secaoUrl = useParametro("secao") as SecaoConfig | null;
  const campoUrl = useParametro("campo");
  const [secao, setSecao] = useState<SecaoConfig>("socios");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a seção vem da URL (botões dos avisos)
    if (secaoUrl && SECOES.some((s) => s.id === secaoUrl)) setSecao(secaoUrl);
  }, [secaoUrl]);

  const carregar = useCallback(async () => {
    try {
      const c = await repo.carregarConfig();
      setOriginal(c);
      setRascunho(structuredClone(c));
      setMembros(await repo.listarMembros().catch(() => []));
      setPedidos(await repo.listarPedidos().catch(() => []));
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

  // leva até o campo que o aviso mandou resolver
  useEffect(() => {
    if (!carregado || !campoUrl) return;
    const t = setTimeout(() => {
      const alvos = [...document.querySelectorAll<HTMLElement>(`[data-campo="${campoUrl}"]`)];
      if (!alvos.length) return;
      const vazio = alvos.find((a) => a.querySelector("input")?.value === "") ?? alvos[0];
      vazio.scrollIntoView({ behavior: "smooth", block: "center" });
      for (const a of alvos) a.classList.add("destaque-alvo");
      vazio.querySelector("input")?.focus({ preventScroll: true });
      setTimeout(() => alvos.forEach((a) => a.classList.remove("destaque-alvo")), 2200);
    }, 150);
    return () => clearTimeout(t);
  }, [carregado, campoUrl, secao]);

  const irPara = (s: SecaoConfig) => {
    setSecao(s);
    try {
      window.history.replaceState(null, "", `/configuracoes?secao=${s}`);
    } catch {}
  };

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
  const faltando = useMemo(() => camposFaltando(rascunho), [rascunho]);
  const pendentes = pedidos.filter((p) => p.status === "pendente" && p.tipo === "campos");
  const itemPendente = (campo: ItemProtegido["campo"], registroId: string, pessoaId?: string) =>
    pendentes.flatMap((p) => p.itens).find((i) => i.campo === campo && i.registroId === registroId && (pessoaId == null || i.pessoaId === pessoaId)) ?? null;
  const nomePessoa = (id: string) => original.pessoas.find((p) => p.id === id)?.nome ?? "sócio";
  const nomes = (ids: string[]) => ids.map(nomePessoa).join(" e ");

  const salvar = async () => {
    setSalvando(true);
    setMensagem(null);
    try {
      const r = await repo.salvarConfig(alteracoes);
      await carregar();
      if (r.pedido?.status === "pendente")
        setMensagem({
          tom: "aviso",
          texto: `Salvo. ${r.itensProtegidos.length} mudança(s) protegida(s) esperando a aprovação de ${nomes(r.pedido.aguardando)}. Até lá vale o valor antigo.`,
        });
      else if (r.pedido?.status === "aplicado") setMensagem({ tom: "ok", texto: "Salvo. A mudança protegida valeu na hora, porque você é o único sócio afetado. Ficou no histórico." });
      else setMensagem({ tom: "ok", texto: "Configurações salvas. A alteração ficou registrada no histórico." });
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
  const setE = (patch: Partial<Configuracao["empresa"]>) => set({ empresa: { ...e, ...patch } });
  const dobro = verificarImpostoEmDobro(rascunho);
  const loginsUsados = new Set(rascunho.pessoas.map((p) => p.membroId).filter(Boolean));

  const adicionarCitados = () => {
    const servicos = [...rascunho.servicos];
    for (const nome of SERVICOS_CITADOS)
      if (!servicos.some((s) => s.nome.toLowerCase() === nome.toLowerCase())) servicos.push({ id: novoId(), nome, divisaoPadrao: {}, ativo: true });
    const tipos = [...rascunho.tiposEntrega];
    for (const nome of TIPOS_CITADOS)
      if (!tipos.some((t) => t.nome.toLowerCase() === nome.toLowerCase())) tipos.push({ id: novoId(), nome, servicoId: null, horasPorUnidade: null, audiovisual: false, ativo: true });
    set({ servicos, tiposEntrega: tipos });
  };

  if (!carregado) return null;
  const atual = SECOES.find((s) => s.id === secao)!;

  return (
    <div className="pb-28">
      <CabecalhoPagina
        icone={Settings2}
        selo="Sistema"
        titulo="Configurações"
        descricao="Regras padrão da empresa, uma seção de cada vez. Nada aqui vem preenchido. Toda alteração fica registrada com autor e data."
      />

      <div className="mx-auto flex max-w-[1200px] flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-start gap-3 rounded-card border border-marca/30 bg-marca-tinta px-4 py-3 text-xs leading-relaxed">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-marca-forte" />
          <p>
            <strong>Proteção da remuneração dos sócios.</strong> {REGRAS_PROTECAO} Os campos com <Lock size={11} className="inline" /> são os protegidos.
            {pendentes.length > 0 && (
              <>
                {" "}
                <Link href="/aprovacoes" className="font-bold text-marca-forte underline">
                  {pendentes.length} pedido(s) esperando aprovação.
                </Link>
              </>
            )}
          </p>
        </div>

        {/* abas */}
        <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Seções das configurações">
          {SECOES.map((s) => {
            const Ic = s.icone;
            const n = faltando[s.id].length;
            const sel = s.id === secao;
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={sel}
                onClick={() => irPara(s.id)}
                className={cx(
                  "flex shrink-0 items-center gap-1.5 rounded-botao border px-3.5 py-2 text-xs font-bold transition-all",
                  sel ? "border-marca bg-marca text-sobre-marca shadow-card" : "border-linha bg-superficie text-texto hover:border-marca/50",
                )}
              >
                <Ic size={14} />
                {s.rotulo}
                {n > 0 && (
                  <span className={cx("rounded-botao px-1.5 py-px text-[9px] font-bold uppercase", sel ? "bg-sobre-marca/25" : "bg-aviso-suave text-aviso")} title={faltando[s.id].join(", ")}>
                    falta preencher
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <Card>
          <TituloCard icone={atual.icone} titulo={atual.rotulo} descricao={atual.frase} />
          <div className="px-5 pb-5">
            {faltando[secao].length > 0 && (
              <p className="mb-3 rounded-bloco bg-aviso-suave px-3 py-2 text-[11px] font-medium text-aviso">Falta preencher: {faltando[secao].join(", ")}.</p>
            )}

            {secao === "socios" && (
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
                        <Botao className="mt-5" variante="perigo" icone={Trash2} aria-label={`Remover ${p.nome}`} onClick={() => set({ pessoas: rascunho.pessoas.filter((x) => x.id !== p.id) })} />
                      </div>
                      <div className="grid gap-2 sm:grid-cols-[1fr_1.4fr]">
                        <Selecao
                          rotulo="Login deste sócio (para aprovar o que o afeta)"
                          valor={p.membroId ?? null}
                          vazio="— sem login ligado —"
                          opcoes={membros
                            .filter((m) => m.papel === "admin" && (!loginsUsados.has(m.id) || m.id === p.membroId) && !/conector/i.test(m.nome))
                            .map((m) => ({ valor: m.id, rotulo: `${m.nome} (${m.email})` }))}
                          aoMudar={(v) => (orig?.membroId ? undefined : set({ pessoas: atualizar(rascunho.pessoas, p.id, { membroId: v }) }))}
                        />
                        <Explica>
                          {orig?.membroId
                            ? "Login ligado. Trocar o login de um sócio não é feito pela tela, para ninguém aprovar no lugar do outro."
                            : "Sem login ligado, os pedidos que afetam este sócio ficam esperando até ele ter acesso e aprovar."}
                        </Explica>
                      </div>
                    </div>
                  );
                })}
                <div className="grid gap-2 text-[11px] leading-snug text-texto-suave sm:grid-cols-3">
                  <p>
                    <strong className="text-texto">% da sobra:</strong> quanto do que sobra de cada cliente vai para cada sócio. Os dois precisam somar 100%.
                  </p>
                  <p>
                    <strong className="text-texto">Piso por hora:</strong> o mínimo que cada hora de trabalho precisa pagar. Abaixo disso, o sistema acende o alerta.
                  </p>
                  <p>
                    <strong className="text-texto">Horas no mês:</strong> quanto cada um consegue produzir por mês. A Visão do mês compara com o que os clientes pedem.
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
            )}

            {secao === "servicos" && (
              <div className="flex flex-col gap-3">
                <p className="text-[11px] text-texto-suave">
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
                        <Botao variante="perigo" icone={Trash2} aria-label="Remover serviço" onClick={() => set({ servicos: rascunho.servicos.filter((x) => x.id !== s.id) })} />
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
                      {pend.length > 0 && (
                        <p className="mt-1 text-[10px] font-semibold text-aviso">alteração pendente de aprovação: {pend.map(descreverItem).join("; ")}</p>
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
            )}

            {secao === "tipos" && (
              <div className="flex flex-col gap-2">
                <p className="text-[11px] text-texto-suave">
                  Digite o tempo em <strong>minutos</strong> (20 min, 40 min…). <Lock size={10} className="inline" /> É protegido: muda quanto cada hora vale. Roteiro e direção de
                  gravação são tipos normais, com tempo. Vídeo editado é de terceiro e não tem tempo dos sócios.{" "}
                  <Link href="/calibragem" className="font-semibold text-marca-forte underline">
                    Ver o tempo medido pelo cronômetro
                  </Link>
                  .
                </p>
                {rascunho.tiposEntrega.length === 0 && (
                  <Vazio icone={Clock3} titulo="Nenhum tipo de entrega">
                    Ex.: post simples, carrossel, PDF, peça de WhatsApp, criativo de tráfego com variações, planejamento mensal, relatório.
                  </Vazio>
                )}
                {rascunho.tiposEntrega.map((t) => (
                  <div key={t.id} className="grid grid-cols-[1fr_auto] items-start gap-2 rounded-bloco bg-superficie-2/60 p-3 sm:grid-cols-[1.4fr_1fr_8.5rem_auto]">
                    <CampoTexto className="col-span-2 sm:col-span-1" rotulo="Entrega" valor={t.nome} aoMudar={(v) => set({ tiposEntrega: atualizar(rascunho.tiposEntrega, t.id, { nome: v }) })} />
                    <Selecao
                      rotulo="Serviço"
                      valor={t.servicoId}
                      vazio="— sem serviço —"
                      opcoes={rascunho.servicos.map((s) => ({ valor: s.id, rotulo: s.nome || "(sem nome)" }))}
                      aoMudar={(v) => set({ tiposEntrega: atualizar(rascunho.tiposEntrega, t.id, { servicoId: v }) })}
                    />
                    {t.audiovisual ? (
                      <div className="pt-6 text-center text-[11px] leading-tight font-semibold text-texto-suave">sem tempo (terceiro)</div>
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
                    <Botao className="mt-5" variante="perigo" icone={Trash2} aria-label="Remover tipo" onClick={() => set({ tiposEntrega: rascunho.tiposEntrega.filter((x) => x.id !== t.id) })} />
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
                  <Botao
                    icone={Plus}
                    pequeno
                    onClick={() => set({ tiposEntrega: [...rascunho.tiposEntrega, { id: novoId(), nome: "", servicoId: null, horasPorUnidade: null, audiovisual: false, ativo: true }] })}
                  >
                    Adicionar tipo de entrega
                  </Botao>
                </div>
              </div>
            )}

            {secao === "custos" && (
              <div className="flex flex-col gap-3">
                {dobro && (
                  <div className="flex flex-wrap items-center gap-2 rounded-bloco bg-erro-suave px-3 py-2 text-xs font-medium text-erro">
                    <span className="flex-1">{dobro.texto}</span>
                    <OQueQuerDizer explica={dobro.explica} />
                  </div>
                )}
                <p className="text-[11px] text-texto-suave">
                  O imposto do MEI não entra aqui: ele tem campo próprio em{" "}
                  <button type="button" className="font-semibold text-marca-forte underline" onClick={() => irPara("regras")}>
                    Regras da empresa
                  </button>
                  , e o sistema já soma os dois na hora de dividir entre os clientes.
                </p>
                {rascunho.custosFixos.map((c) => (
                  <div key={c.id} className="grid grid-cols-[1fr_9rem_auto] items-end gap-2">
                    <CampoTexto ariaLabel="Nome do custo" placeholder="Ex.: nome da assinatura" valor={c.nome} aoMudar={(v) => set({ custosFixos: atualizar(rascunho.custosFixos, c.id, { nome: v }) })} />
                    <CampoMoeda ariaLabel="Valor mensal" valor={c.valorMensalCentavos} aoMudar={(v) => set({ custosFixos: atualizar(rascunho.custosFixos, c.id, { valorMensalCentavos: v }) })} />
                    <Botao variante="perigo" icone={Trash2} aria-label="Remover custo" onClick={() => set({ custosFixos: rascunho.custosFixos.filter((x) => x.id !== c.id) })} />
                  </div>
                ))}
                <div className="flex flex-wrap items-center gap-3">
                  <Botao icone={Plus} pequeno onClick={() => set({ custosFixos: [...rascunho.custosFixos, { id: novoId(), nome: "", valorMensalCentavos: null, ativo: true }] })}>
                    Adicionar custo fixo
                  </Botao>
                  {totalFixo > 0 && <Badge tom="marca">total: {formatarMoeda(totalFixo)}/mês</Badge>}
                </div>
              </div>
            )}

            {secao === "regras" && (
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
                      <Explica>O que a empresa paga de imposto todo mês, tenha o faturamento que tiver. Entra dividido entre os clientes, junto com os custos fixos.</Explica>
                    </>
                  )}
                  {e.regime !== "mei" && (
                    <>
                      <Alvo campo="impostoPct">
                        <CampoPct rotulo="Imposto em % do faturamento" valor={e.impostoPct} aoMudar={(v) => setE({ impostoPct: v })} />
                      </Alvo>
                      <Explica>Para regimes em que o imposto é uma porcentagem do que entra.</Explica>
                    </>
                  )}
                  {e.regime == null && <p className="text-[11px] text-aviso sm:col-span-2">Escolha o regime: no MEI, o campo de imposto em % some e não entra na conta.</p>}
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
                      rotulo="Regra de rateio"
                      valor={e.regraRateio}
                      aoMudar={(v) => setE({ regraRateio: v })}
                      opcoes={[
                        { valor: "igual", rotulo: "Igual entre clientes" },
                        { valor: "proporcional", rotulo: "Proporcional ao valor" },
                      ]}
                    />
                  </Alvo>
                  <p className="text-[11px] leading-snug text-texto-suave sm:col-span-2">
                    <strong className="text-texto">Igual:</strong> cada cliente paga a mesma parte. <strong className="text-texto">Proporcional:</strong> quem paga mais leva uma parte maior.
                    Na calculadora, o cliente que está sendo simulado conta como mais um. Sem regra escolhida, a calculadora não mostra resultado, porque o custo fixo sumiria da conta.
                  </p>
                </Bloco>

                <Bloco titulo="Reinvestimento">
                  <Alvo campo="reinvestimentoPct">
                    <CampoPct rotulo="Reinvestimento (% da sobra)" valor={e.reinvestimentoPct} aoMudar={(v) => setE({ reinvestimentoPct: v })} />
                  </Alvo>
                  <Explica>Quanto da sobra de cada cliente fica guardado na empresa antes da divisão entre os sócios. Vazio = nada fica guardado.</Explica>
                </Bloco>

                <Bloco titulo="Taxa de recebimento">
                  <Alvo campo="taxaRecebimentoPct">
                    <CampoPct rotulo="Taxa (%)" valor={e.taxaRecebimentoPct} aoMudar={(v) => setE({ taxaRecebimentoPct: v })} />
                  </Alvo>
                  <Explica>Quanto o meio de pagamento desconta de cada cobrança, em porcentagem.</Explica>
                  <CampoMoeda rotulo="Tarifa fixa por cobrança" valor={e.taxaRecebimentoFixaCentavos ?? null} aoMudar={(v) => setE({ taxaRecebimentoFixaCentavos: v })} />
                  <Explica>Valor fixo por cobrança, se houver. Quando o InfinitePay for integrado, estes dois campos recebem a taxa real.</Explica>
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
                  <p className="text-[11px] leading-snug text-texto-suave sm:col-span-2">
                    <strong className="text-texto">Custo primeiro:</strong> o que entra paga primeiro os custos do mês daquele cliente; só o que passar disso vai para os sócios.{" "}
                    <strong className="text-texto">Proporcional:</strong> cada real que entra já é dividido entre custos e sócios, na mesma proporção do mês inteiro.
                    {e.ordemDistribuicao == null && <span className="font-semibold text-aviso"> Enquanto estiver vazia, o sistema não distribui os pagamentos.</span>}
                  </p>
                </Bloco>
              </div>
            )}

            {secao === "limites" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Alvo campo="tetoFaturamentoAnualCentavos">
                  <CampoMoeda rotulo="Teto de faturamento no ano" valor={e.tetoFaturamentoAnualCentavos ?? null} aoMudar={(v) => setE({ tetoFaturamentoAnualCentavos: v })} />
                </Alvo>
                <Explica>O limite do regime (no MEI, o teto anual). Passar dele muda o regime inteiro da empresa.</Explica>
                <CampoPct rotulo="Avisar a partir de (% do teto)" valor={e.avisoTetoPct ?? null} aoMudar={(v) => setE({ avisoTetoPct: v })} />
                <Explica>Quando a soma do ano projetada chegar a esta porcentagem do teto, o sistema avisa antes de estourar.</Explica>
                <CampoPct rotulo="Folga sobrando abaixo de (% das horas)" valor={e.ociosidadePct ?? null} aoMudar={(v) => setE({ ociosidadePct: v })} />
                <Explica>Se os clientes usarem menos que isso das horas de um sócio, a Visão do mês mostra que ele tem espaço sobrando.</Explica>
                <CampoMoeda rotulo="Arredondar a proposta para cima, de" valor={e.arredondamentoPropostaCentavos ?? null} aoMudar={(v) => setE({ arredondamentoPropostaCentavos: v })} />
                <Explica>O valor que vai para o cliente sobe até o próximo múltiplo deste valor, para sair um número redondo.</Explica>
                <Alvo campo="medicoesCalibragem">
                  <CampoNumero rotulo="Medições para calibrar cada entrega" valor={e.medicoesCalibragem ?? null} aoMudar={(v) => setE({ medicoesCalibragem: v })} />
                </Alvo>
                <Explica>O cronômetro pede para medir as primeiras entregas de cada tipo. Depois desse número, para de pedir e passa a usar a média medida.</Explica>
                <CampoPct rotulo="Sugerir novo tempo quando a média diferir mais de" valor={e.diferencaSugerirPct ?? null} aoMudar={(v) => setE({ diferencaSugerirPct: v })} />
                <Explica>Vazio = qualquer diferença de 1 minuto ou mais já vira sugestão de atualizar o tempo cadastrado.</Explica>
              </div>
            )}

            {secao === "clientes" && (
              <div className="flex flex-col gap-2">
                {rascunho.clientes.length === 0 && (
                  <Vazio icone={Receipt} titulo="Nenhum cliente cadastrado">
                    Cadastre os clientes atuais. O escopo de cada um é guardado pela calculadora.
                  </Vazio>
                )}
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
                <p className="text-[11px] text-texto-suave">O valor mensal é a mensalidade do contrato, sem a cobrança de tráfego (que vem do escopo).</p>
                <div>
                  <Botao
                    icone={Plus}
                    pequeno
                    onClick={() => set({ clientes: [...rascunho.clientes, { id: novoId(), nome: "", interno: false, participaRateio: true, valorMensalCentavos: null, ativo: true }] })}
                  >
                    Adicionar cliente
                  </Botao>
                </div>
              </div>
            )}
          </div>
        </Card>

        {usuario?.pessoaId == null && repo.modo === "supabase" && usuario?.papel === "admin" && (
          <p className="text-[11px] text-texto-suave">
            Seu login ainda não está ligado a um sócio: mudanças em campos protegidos que você fizer vão esperar a aprovação de todos os afetados. Ligue em Sócios → Login deste sócio.
          </p>
        )}
      </div>

      {/* barra de salvar */}
      {(sujo || mensagem) && (
        <div className="nao-imprimir fixed inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-4 lg:pl-64">
          <div className="flex w-full max-w-2xl flex-wrap items-center gap-3 rounded-card border border-linha bg-superficie px-4 py-2 shadow-forte">
            <p className={cx("flex-1 text-xs font-semibold", mensagem?.tom === "erro" ? "text-erro" : mensagem?.tom === "aviso" ? "text-aviso" : sujo ? "text-texto" : "text-ok")}>
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

function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="rounded-bloco border border-linha p-4">
      <h3 className="mb-3 text-[13px] font-bold">{titulo}</h3>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}
