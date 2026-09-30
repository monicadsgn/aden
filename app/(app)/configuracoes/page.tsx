"use client";

import {
  CalendarHeart,
  History,
  KeyRound,
  Timer,
  Package,
  Trophy,
  Truck,
  Building2,
  Check,
  Clock3,
  SlidersHorizontal,
  Layers,
  Lock,
  Plus,
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
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { TrocarFoto } from "@/components/Avatar";
import { OQueQuerDizer } from "@/components/Alertas";
import { SecaoDatas } from "@/components/configuracoes/SecaoDatas";
import { SecaoEquipe } from "@/components/configuracoes/SecaoEquipe";
import { SecaoMetas, SecaoPacotes, SecaoTerceiros } from "@/components/configuracoes/SecoesNovas";
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
import { COM_VOLUME } from "@/lib/recursos";

// Nomes citados pela Moni no briefing. Só nomes: horas e divisões ficam vazias.
const SERVICOS_CITADOS = ["Tráfego pago", "Criativos", "Social media", "Branding"];
const TIPOS_CITADOS = ["Post simples", "Carrossel", "PDF", "Peça de WhatsApp", "Criativo de tráfego com variações", "Planejamento mensal", "Relatório"];

const SECOES: { id: SecaoConfig; rotulo: string; icone: LucideIcon; frase: string }[] = [
  { id: "socios", rotulo: "Sócios", icone: Users, frase: "Quem divide o resultado, o piso por hora de cada um e quantas horas cada um tem no mês." },
  { id: "servicos", rotulo: "Serviços", icone: Layers, frase: "O que a Aden vende e quem executa as horas de cada serviço." },
  { id: "tipos", rotulo: "Tipos de entrega", icone: Shapes, frase: "Quanto tempo leva cada entrega (post, carrossel, roteiro…). É a base de todas as horas." },
  { id: "custos", rotulo: "Custos fixos", icone: Building2, frase: "O que a empresa paga todo mês, tenha cliente ou não. É dividido entre os clientes." },
  { id: "terceiros", rotulo: "Terceiros", icone: Truck, frase: "Serviços terceirizados cobrados por saída (ex.: audiovisual). Custo só do cliente que recebe." },
  { id: "pacotes", rotulo: "Pacotes", icone: Package, frase: "Pacotes fechados para a negociação. O preço sai do cálculo, nunca digitado." },
  { id: "datas", rotulo: "Datas comemorativas", icone: CalendarHeart, frase: "As datas que entram no planejamento de cada cliente, com a antecedência da campanha de cada um." },
  { id: "metas", rotulo: "Metas", icone: Trophy, frase: "A trilha de crescimento em degraus, com a ação de cada degrau. Aparece na tela Mês." },
  { id: "equipe", rotulo: "Equipe e acessos", icone: KeyRound, frase: "Quem entra no Aden e o que cada um vê: sócios, equipe, freelancers e contador." },
  { id: "regras", rotulo: "Regras da empresa", icone: Scale, frase: "Regime e imposto, como dividir o custo fixo, reinvestimento, taxas e como distribuir cada pagamento." },
  { id: "limites", rotulo: "Limites e avisos", icone: SlidersHorizontal, frase: "Quando o sistema acende um alerta. Vazio = sem aviso." },
];

const GRUPOS_SECOES: { titulo: string; ids: SecaoConfig[] }[] = [
  { titulo: "A empresa", ids: ["socios", "equipe", "regras", "custos", "metas", "limites"] },
  { titulo: "O que a Aden vende", ids: ["servicos", "tipos", "pacotes", "terceiros", "datas"] },
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
  return <p className="self-end pb-2 text-[12px] leading-snug text-texto-suave">{children}</p>;
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
  const router = useRouter();
  const secaoUrl = useParametro("secao") as SecaoConfig | null;
  const campoUrl = useParametro("campo");
  const [secao, setSecao] = useState<SecaoConfig>("socios");

  useEffect(() => {
    // os dados do cliente moram só na ficha (grave 5 da auditoria): o endereço antigo leva para lá
    if (secaoUrl === "clientes") {
      router.replace("/clientes");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a seção vem da URL (botões dos avisos)
    if (secaoUrl && SECOES.some((s) => s.id === secaoUrl)) setSecao(secaoUrl);
  }, [secaoUrl, router]);
  const [temMedicao, setTemMedicao] = useState(false);
  useEffect(() => {
    repo.listarMedicoes().then((m) => setTemMedicao(m.length > 0)).catch(() => {});
  }, [repo]);

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
      terceiros: diferenca(original.terceiros ?? [], rascunho.terceiros ?? []),
      pacotes: diferenca(original.pacotes ?? [], rascunho.pacotes ?? []),
      metas: diferenca(original.metas ?? [], rascunho.metas ?? []),
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
  // Fase 1: com poucos clientes, Metas e Limites ficam fora das abas até terem uso (ou se a URL pedir).
  const e0 = rascunho.empresa;
  const usa: Partial<Record<SecaoConfig, boolean>> = {
    metas: COM_VOLUME.secaoMetas || (rascunho.metas ?? []).length > 0,
    limites:
      COM_VOLUME.secaoLimites ||
      [e0.tetoFaturamentoAnualCentavos, e0.avisoTetoPct, e0.ociosidadePct, e0.arredondamentoPropostaCentavos, e0.medicoesCalibragem, e0.diferencaSugerirPct, e0.diasLeadParado].some(
        (v) => v != null,
      ),
  };
  const secoesVisiveis = SECOES.filter((s) => usa[s.id] !== false || s.id === secao);

  return (
    <div className="pb-28">
      <CabecalhoPagina
        icone={Settings2}
        selo="Ajustes"
        titulo="Configurações"
        descricao="Regras padrão da empresa, uma seção de cada vez. Nada aqui vem preenchido. Toda alteração fica registrada com autor e data."
        acoes={
          <Link href="/historico" className="inline-flex items-center gap-1.5 rounded-botao border border-linha bg-superficie px-3 py-2 text-xs font-semibold hover:border-marca">
            <History size={14} /> Histórico de alterações
          </Link>
        }
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

        {/* abas em dois grupos (médio 12): a empresa e o que ela vende */}
        <div className="flex flex-col gap-3 md:flex-row md:gap-6" role="tablist" aria-label="Seções das configurações">
          {GRUPOS_SECOES.map((g) => (
            <div key={g.titulo} className="flex min-w-0 flex-col gap-1.5">
              <p className="px-1 text-[11px] font-bold tracking-wide text-texto-suave uppercase">{g.titulo}</p>
              <div className="flex flex-wrap gap-1.5">
                {g.ids
                  .flatMap((id) => secoesVisiveis.filter((s) => s.id === id))
                  .map((s) => {
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
            </div>
          ))}
        </div>

        <Card>
          <TituloCard icone={atual.icone} titulo={atual.rotulo} descricao={atual.frase} />
          <div className="px-5 pb-5">
            {faltando[secao].length > 0 && (
              <p className="mb-3 rounded-bloco bg-aviso-suave px-3 py-2 text-[12px] font-medium text-aviso">Falta preencher: {faltando[secao].join(", ")}.</p>
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
                    <strong className="text-texto">Horas no mês:</strong> quanto cada um consegue produzir por mês. A tela Mês compara com o que os clientes pedem.
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
                      <div className="pt-6 text-center text-[11px] leading-tight font-semibold text-texto-suave">sem tempo dos sócios</div>
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
                    <CampoTexto
                      className="col-span-full sm:max-w-sm"
                      rotulo="Como o cliente vê (opcional)"
                      placeholder={t.nome || "igual ao nome"}
                      valor={t.nomeCliente ?? ""}
                      aoMudar={(v) => set({ tiposEntrega: atualizar(rascunho.tiposEntrega, t.id, { nomeCliente: v || null }) })}
                    />
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
            )}

            {secao === "custos" && (
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
            )}

            {secao === "terceiros" && <SecaoTerceiros rascunho={rascunho} set={set} />}
            {secao === "pacotes" && <SecaoPacotes rascunho={rascunho} set={set} />}
            {secao === "metas" && <SecaoMetas rascunho={rascunho} set={set} />}
            {secao === "equipe" && <SecaoEquipe />}
            {secao === "datas" && <SecaoDatas clientes={rascunho.clientes} />}

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
                      rotulo="Regra de rateio"
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
                  <p className="text-[12px] leading-snug text-texto-suave sm:col-span-2">
                    <strong className="text-texto">Custo primeiro:</strong> o que entra paga primeiro os custos do mês daquele cliente; só o que passar disso vai para os sócios.{" "}
                    <strong className="text-texto">Proporcional:</strong> cada real que entra já é dividido entre custos e sócios, na mesma proporção do mês inteiro.
                    {e.ordemDistribuicao == null && <span className="font-semibold text-aviso"> Enquanto estiver vazia, o sistema não distribui os pagamentos.</span>}
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
                  <CampoPct rotulo={<span className="flex items-center gap-1"><Lock size={11} /> % do que entra</span>} valor={e.sociedadePctSocio ?? null} aoMudar={(v) => setE({ sociedadePctSocio: v })} />
                  <Selecao
                    rotulo="Quem fica com a sobra"
                    valor={e.socioSobraId ?? null}
                    vazio="Escolha o sócio…"
                    disabled={!!original.empresa.socioSobraId}
                    opcoes={rascunho.pessoas.filter((p) => p.socio && p.ativo && p.id !== e.socioPercentualId).map((p) => ({ valor: p.id, rotulo: p.nome }))}
                    aoMudar={(v) => setE({ socioSobraId: v })}
                  />
                  <CampoPct
                    rotulo={<span className="flex items-center gap-1"><Lock size={11} /> Da sobra, vai para o tráfego</span>}
                    valor={e.sociedadeSobraTrafegoPct ?? null}
                    aoMudar={(v) => setE({ sociedadeSobraTrafegoPct: v })}
                  />
                  <CampoMoeda
                    rotulo={<span className="flex items-center gap-1"><Lock size={11} /> Virada: quando entrar no mês</span>}
                    valor={e.sociedadeTetoViradaCentavos ?? null}
                    aoMudar={(v) => setE({ sociedadeTetoViradaCentavos: v })}
                  />
                  <CampoMoeda
                    rotulo={<span className="flex items-center gap-1"><Lock size={11} /> Parte acima disso vira bônus</span>}
                    valor={e.sociedadeAvisoBonusCentavos ?? null}
                    aoMudar={(v) => setE({ sociedadeAvisoBonusCentavos: v })}
                  />
                  <CampoMoeda
                    rotulo={<span className="flex items-center gap-1"><Lock size={11} /> Mínimo do tráfego próprio por mês</span>}
                    valor={e.trafegoProprioMinimoCentavos ?? null}
                    aoMudar={(v) => setE({ trafegoProprioMinimoCentavos: v })}
                  />
                  <Explica>
                    Quem escolhe quanto da sobra vai para o tráfego é quem fica com ela: mudar esse % pede a aprovação só dele. Os outros números pedem a aprovação dos
                    dois. Depois de escolhidos, quem recebe o % e quem fica com a sobra não mudam por aqui.
                  </Explica>
                </Bloco>

                <Bloco titulo="Oferta padrão (tráfego com garantia)">
                  <p className="text-[12px] leading-snug text-texto-suave sm:col-span-2">
                    O cliente só paga a gestão do tráfego quando o resultado vier. Estes valores aparecem na Proposta para o cliente e servem de aviso interno.
                  </p>
                  <CampoMoeda rotulo="Verba de mídia indicada: de" valor={e.ofertaVerbaMinCentavos ?? null} aoMudar={(v) => setE({ ofertaVerbaMinCentavos: v })} />
                  <CampoMoeda rotulo="até" valor={e.ofertaVerbaMaxCentavos ?? null} aoMudar={(v) => setE({ ofertaVerbaMaxCentavos: v })} />
                  <CampoMoeda
                    rotulo="Gestão depois do resultado"
                    valor={e.ofertaGestaoAposResultadoCentavos ?? null}
                    aoMudar={(v) => setE({ ofertaGestaoAposResultadoCentavos: v })}
                  />
                  <CampoMoeda
                    rotulo="Social media + tráfego não fecha abaixo de"
                    valor={e.ofertaMinimoSocialTrafegoCentavos ?? null}
                    aoMudar={(v) => setE({ ofertaMinimoSocialTrafegoCentavos: v })}
                  />
                  <Explica>A verba é paga pelo cliente direto na plataforma e nunca entra no faturamento. Abaixo do mínimo, a Proposta só avisa (sem pedido de exceção).</Explica>
                </Bloco>

                <Bloco titulo="Leads">
                  <CampoNumero rotulo="Follow-ups do &quot;vou ver&quot; antes de sugerir perda" valor={e.followUpsMaximo ?? null} aoMudar={(v) => setE({ followUpsMaximo: v })} />
                  <Explica>Depois desse número de follow-ups sem resposta, a ficha do lead sugere marcar como perdido. Só sugere; vazio = nunca.</Explica>
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
                <Explica>Se os clientes usarem menos que isso das horas de um sócio, a tela Mês mostra que ele tem espaço sobrando.</Explica>
                <CampoMoeda rotulo="Arredondar a proposta para cima, de" valor={e.arredondamentoPropostaCentavos ?? null} aoMudar={(v) => setE({ arredondamentoPropostaCentavos: v })} />
                <Explica>O valor que vai para o cliente sobe até o próximo múltiplo deste valor, para sair um número redondo.</Explica>
                <Alvo campo="medicoesCalibragem">
                  <CampoNumero rotulo="Medições para calibrar cada entrega" valor={e.medicoesCalibragem ?? null} aoMudar={(v) => setE({ medicoesCalibragem: v })} />
                </Alvo>
                <Explica>O cronômetro pede para medir as primeiras entregas de cada tipo. Depois desse número, para de pedir e passa a usar a média medida.</Explica>
                <CampoPct rotulo="Sugerir novo tempo quando a média diferir mais de" valor={e.diferencaSugerirPct ?? null} aoMudar={(v) => setE({ diferencaSugerirPct: v })} />
                <Explica>Vazio = qualquer diferença de 1 minuto ou mais já vira sugestão de atualizar o tempo cadastrado.</Explica>
                <CampoNumero rotulo="Lead parado na etapa depois de" sufixo="dias" valor={e.diasLeadParado ?? null} aoMudar={(v) => setE({ diasLeadParado: v })} />
                <Explica>Em Leads, o card do lead fica em destaque quando passa esse tempo sem mudar de etapa. Vazio = nunca destaca.</Explica>
              </div>
            )}

          </div>
        </Card>

        {usuario?.pessoaId == null && repo.modo === "supabase" && usuario?.papel === "admin" && (
          <p className="text-[12px] text-texto-suave">
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
