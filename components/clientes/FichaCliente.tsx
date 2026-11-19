"use client";

// Página do cliente (/clientes/[id]): partes separadas por assunto, com a visão geral só para ler.

import { barraProducao, faltaParaComecar } from "@/lib/regras/prontoParaComecar";
import { ArrowLeft, BookMarked, Calculator, FileQuestion, ClipboardList, FileSignature, Handshake, LayoutDashboard, MessageCircle, Package, Plus, Share2, SlidersHorizontal, User, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CabecalhoPagina } from "../Shell";
import { BriefingCliente } from "./BriefingCliente";
import { campo, ComDica, dataBr, Rot, Texto } from "./campos";
import { DadosCliente } from "./DadosCliente";
import { PainelRedes } from "./PainelRedes";
import { VisaoCliente } from "./VisaoCliente";
import { ContextoCliente } from "./ContextoCliente";
import { ContratoCliente } from "./ContratoCliente";
import { FechamentoCliente } from "./FechamentoCliente";
import { DetalheTarefa } from "../tarefas/DetalheTarefa";
import { LinhaTarefa } from "../tarefas/LinhaTarefa";
import type { AcoesTarefas } from "../tarefas/useTarefas";
import { Badge, Botao, CampoMoeda, CampoNumero, cx, Interruptor, Selecao } from "../ui";
import { contratoVazio, fimDaFidelidade, prazoDoAvisoPrevio, proximoVencimento } from "@/lib/calculo/clientes";
import { rotuloEtapa, TIPOS_INTERACAO, type InteracaoLead, type Lead } from "@/lib/calculo/crm";
import { hojeISO } from "@/lib/calculo/dia";
import { novoCenario, novoId } from "@/lib/calculo/novo";
import { pacoteParaCenario } from "@/lib/calculo/pacotes";
import type { Pagamento, SituacaoPagamento } from "@/lib/calculo/pagamentos";
import { novaTarefa } from "@/lib/calculo/tarefas";
import type { ClienteBase, Configuracao, DadosContrato } from "@/lib/calculo/tipos";
import { guardarEscopo } from "@/lib/dados/acoes";
import { useDados } from "@/lib/dados/contexto";
import { formatarMoeda } from "@/lib/formato";
import { enviarCenario } from "@/lib/navegacao";

export type Aba = "visao" | "dados" | "contrato" | "tarefas" | "contexto" | "briefing" | "financeiro" | "painel" | "comercial";

/** Nomes antigos de aba (links e passos do fechamento) viram os atuais. */
export const abaDeTexto = (v: string | null | undefined): Aba | null =>
  v === "resumo" ? "dados" : v === "visao" || v === "dados" || v === "contrato" || v === "tarefas" || v === "contexto" || v === "briefing" || v === "financeiro" || v === "painel" || v === "comercial" ? v : null;

export const SITUACAO_PAGAMENTO: Record<SituacaoPagamento, { rotulo: string; tom: "ok" | "aviso" | "erro" | "neutro" }> = {
  pago: { rotulo: "pago", tom: "ok" },
  parcial: { rotulo: "pago em parte", tom: "aviso" },
  a_receber: { rotulo: "a receber", tom: "neutro" },
  atrasado: { rotulo: "atrasado", tom: "erro" },
  sem_contrato: { rotulo: "sem valor", tom: "neutro" },
};

export function FichaCliente({
  cliente,
  config,
  a,
  pagamentos,
  situacaoMes,
  leads,
  aoSalvar,
  aoRecarregar,
  abaInicial,
}: {
  cliente: ClienteBase | null;
  config: Configuracao;
  a: AcoesTarefas;
  pagamentos: Pagamento[];
  situacaoMes: SituacaoPagamento | null;
  leads: Lead[];
  aoSalvar: (c: ClienteBase) => Promise<void>;
  aoRecarregar: () => Promise<void>;
  /** aba que abre primeiro (ex.: voltando da Proposta, abre no Contrato) */
  abaInicial?: Aba | null;
}) {
  const { repo } = useDados();
  const router = useRouter();
  const [aba, setAba] = useState<Aba>(abaInicial ?? "visao");
  const clienteId = cliente?.id ?? null;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- abre na aba pedida pelo endereço
    if (abaInicial && clienteId) setAba(abaInicial);
  }, [abaInicial, clienteId]);
  const [interacoes, setInteracoes] = useState<InteracaoLead[]>([]);
  const [novaT, setNovaT] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [tarefaAberta, setTarefaAberta] = useState<string | null>(null);
  const lead = cliente ? (leads.find((l) => l.clienteId === cliente.id) ?? null) : null;
  const leadId = lead?.id;

  useEffect(() => {
    if (!leadId) return;
    repo.listarInteracoes(leadId).then(setInteracoes).catch(() => {});
  }, [leadId, repo]);

  if (!cliente) return null;
  const c = cliente;
  const k: DadosContrato = c.contrato ?? contratoVazio();
  const set = (patch: Partial<ClienteBase>) => void aoSalvar({ ...c, ...patch }).catch((e) => setMsg(e instanceof Error ? e.message : "Não deu para salvar."));
  const setK = (patch: Partial<DadosContrato>) => set({ contrato: { ...k, ...patch } });
  const tarefas = a.tarefas.filter((t) => t.clienteId === c.id);
  const abertas = tarefas.filter((t) => t.status !== "concluida");
  const pags = pagamentos.filter((p) => p.clienteId === c.id).sort((x, y) => y.recebidoEm.localeCompare(x.recebidoEm));
  const nomeTipo = (id: string | null) => config.tiposEntrega.find((t) => t.id === id)?.nome ?? "entrega";
  const entregas = (c.escopo?.entregas ?? []).filter((l) => (l.quantidade ?? 0) > 0);
  const fidelidade = fimDaFidelidade(k);
  const aviso = prazoDoAvisoPrevio(k);
  const hoje = hojeISO();
  const entrouNoMes = pags.filter((p) => p.competencia === hoje.slice(0, 7)).reduce((a, p) => a + p.valorCentavos, 0);

  const escopoDoPacote = async (pacoteId: string | null) => {
    const p = (config.pacotes ?? []).find((x) => x.id === pacoteId);
    if (!p) return;
    if (c.escopo && !confirm(`Trocar as entregas do contrato de ${c.nome} pelas do pacote ${p.nome}?`)) return;
    try {
      const base = pacoteParaCenario(p);
      const cen = c.valorMensalCentavos != null ? { ...base, modo: "valor" as const, mensalidadeCentavos: c.valorMensalCentavos } : base;
      const r = await guardarEscopo(repo, config, c.id, cen);
      await aoRecarregar();
      setMsg(r.gravado ? `Entregas do pacote ${p.nome} guardadas no contrato.` : `Ficou abaixo do piso de ${r.abaixo.map((x) => x.nome).join(" e ")}: espera aprovação em Sócios → Pedidos e avisos.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Não deu para guardar as entregas do contrato.");
    }
  };

  const GRUPOS: { titulo: string; itens: { valor: Aba; rotulo: string; icone: typeof User; mostrar?: boolean }[] }[] = [
    { titulo: "Visão", itens: [{ valor: "visao", rotulo: "Visão geral", icone: LayoutDashboard }] },
    {
      titulo: "Cadastro",
      itens: [
        { valor: "dados", rotulo: "Dados", icone: User },
        { valor: "contrato", rotulo: "Contrato e entregas", icone: FileSignature },
        { valor: "painel", rotulo: "Painel e redes", icone: Share2, mostrar: !c.interno },
      ],
    },
    {
      titulo: "Trabalho",
      itens: [
        { valor: "tarefas", rotulo: `Tarefas${abertas.length ? ` (${abertas.length})` : ""}`, icone: ClipboardList },
        { valor: "contexto", rotulo: "Contexto", icone: BookMarked },
        { valor: "briefing", rotulo: "Briefing", icone: FileQuestion },
      ],
    },
    {
      titulo: "Dinheiro e venda",
      itens: [
        { valor: "financeiro", rotulo: "Pagamentos", icone: Wallet },
        { valor: "comercial", rotulo: "Fechamento e lead", icone: Handshake },
      ],
    },
  ];
  const irAba = (v: Aba) => {
    setAba(v);
    if (typeof window !== "undefined") window.history.replaceState(null, "", `/clientes/${c.id}${v === "visao" ? "" : `?aba=${v}`}`);
  };
  const pendencias = c.interno ? [] : faltaParaComecar(c);

  return (
    <div className="pb-16">
      <CabecalhoPagina
        icone={User}
        selo="Cliente"
        titulo={c.nome}
        ajuda="clientes"
        descricao={
          <span className="flex flex-wrap items-center gap-2">
            {c.segmento && <span>{c.segmento}</span>}
            {c.projetoAvulso ? (
              <span className="numero font-semibold text-texto">projeto avulso · {formatarMoeda(c.projetoAvulso.valorCentavos)}</span>
            ) : (
              c.valorMensalCentavos != null && <span className="numero font-semibold text-texto">{formatarMoeda(c.valorMensalCentavos)}/mês</span>
            )}
            {situacaoMes && <Badge tom={SITUACAO_PAGAMENTO[situacaoMes].tom}>este mês: {SITUACAO_PAGAMENTO[situacaoMes].rotulo}</Badge>}
            {!c.ativo && <Badge>inativo</Badge>}
          </span>
        }
        acoes={
          <Link href="/clientes" className="inline-flex h-10 items-center gap-1.5 rounded-botao border border-linha bg-superficie px-3 text-xs font-semibold hover:bg-superficie-2">
            <ArrowLeft size={14} aria-hidden /> Todos os clientes
          </Link>
        }
      />
      <div className="mx-auto grid max-w-[1300px] grid-cols-[minmax(0,1fr)] gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8 lg:px-8">
        <nav aria-label="Partes da ficha" className="min-w-0 lg:sticky lg:top-4 lg:self-start">
          <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:gap-4 lg:overflow-visible lg:px-0 lg:pb-0">
            {GRUPOS.map((g) => {
              const itens = g.itens.filter((i) => i.mostrar !== false);
              if (!itens.length) return null;
              return (
                <div key={g.titulo} className="flex gap-1.5 lg:flex-col lg:gap-0.5">
                  {g.titulo !== "Visão" && <p className="hidden px-3 pb-1 text-[11px] font-bold tracking-wide text-texto-suave uppercase lg:block">{g.titulo}</p>}
                  {itens.map((i) => {
                    const Ic = i.icone;
                    const ativo = aba === i.valor;
                    return (
                      <button
                        key={i.valor}
                        type="button"
                        aria-current={ativo ? "page" : undefined}
                        onClick={() => irAba(i.valor)}
                        className={cx(
                          "flex min-h-10 shrink-0 items-center gap-2 rounded-botao px-3 text-left text-[13px] font-semibold whitespace-nowrap transition-colors pointer-coarse:min-h-11",
                          ativo ? "bg-marca-suave text-marca-forte" : "text-texto-suave hover:bg-superficie-2 hover:text-texto",
                        )}
                      >
                        <Ic size={15} aria-hidden /> {i.rotulo}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </nav>

        <div className="flex min-w-0 flex-col gap-4">
          {msg && <p className="rounded-bloco bg-info-suave px-3 py-2 text-xs text-info">{msg}</p>}
          {aba === "visao" && (
            <>
              {c.projetoAvulso && (
                <div className="rounded-bloco bg-marca-tinta px-3 py-2 text-[13px]">
                  <p className="font-semibold">
                    Projeto avulso: {c.projetoAvulso.nome} · {formatarMoeda(c.projetoAvulso.valorCentavos)}
                    {c.projetoAvulso.prazoDiasUteis != null && ` · entrega em até ${c.projetoAvulso.prazoDiasUteis} dias úteis`}
                  </p>
                  <p className="text-[12px] text-texto-suave">
                    Sem mensalidade e fora da divisão dos custos fixos do mês. Fechado em {new Date(c.projetoAvulso.fechadoEm).toLocaleDateString("pt-BR")}
                    {c.projetoAvulso.sinalPct != null && `; ${c.projetoAvulso.sinalPct}% no início e o resto na entrega`}. Registre cada parte em Pagamentos quando cair.
                  </p>
                </div>
              )}
              {pendencias.length > 0 && (
                <div className={cx("rounded-bloco px-3 py-2.5 text-[13px]", barraProducao(c) ? "bg-erro-suave text-erro" : "bg-aviso-suave text-aviso")} role="status">
                  <p className="font-semibold">
                    {barraProducao(c) ? "Falta pra começar. O Claude não cria tarefa pra este cliente até preencher:" : "Falta preencher na ficha (não trava, é cliente antigo):"}
                  </p>
                  <ul className="mt-1.5 flex flex-wrap gap-1.5">
                    {pendencias.map((f) => (
                      <li key={f.item}>
                        <button type="button" onClick={() => irAba(abaDeTexto(f.aba) ?? "dados")} className="rounded-botao border border-current/30 px-2 py-0.5 text-[12px] font-semibold hover:bg-superficie/60">
                          {f.item}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <VisaoCliente c={c} contrato={k} entregas={entregas} abertas={abertas} entrouNoMes={entrouNoMes} situacaoMes={situacaoMes} nomeTipo={nomeTipo} irPara={irAba} abrirTarefa={setTarefaAberta} />
            </>
          )}

          {aba === "dados" && <DadosCliente c={c} set={set} />}

          {aba === "painel" && !c.interno && <PainelRedes c={c} set={set} aoRecarregar={aoRecarregar} />}

        {aba === "contrato" && (
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <ComDica dica="Quanto o cliente paga por mês. Ex.: R$ 1.500.">
                <CampoMoeda rotulo="Valor mensal" valor={c.valorMensalCentavos} aoMudar={(v) => set({ valorMensalCentavos: v })} />
              </ComDica>
              {k.venceUltimoDiaUtil ? (
                <Rot rotulo="Vencimento">
                  <p className="flex h-10 items-center text-sm text-texto-suave">último dia útil do mês</p>
                </Rot>
              ) : (
                <ComDica dica="Dia do mês em que a mensalidade vence. Ex.: 10.">
                <CampoNumero rotulo="Dia do pagamento" valor={k.diaPagamento} aoMudar={(v) => setK({ diaPagamento: v == null ? null : Math.min(31, Math.max(1, Math.round(v))) })} />
              </ComDica>
              )}
              <Rot rotulo="Início da cobrança">
                <Texto valor={k.inicioCobranca} aoSalvar={(v) => setK({ inicioCobranca: v })} placeholder="ex.: na assinatura" />
              </Rot>
              <Rot rotulo="Início do contrato">
                <input type="date" className={campo} value={k.inicio ?? ""} onChange={(e) => setK({ inicio: e.target.value || null })} />
              </Rot>
              <Rot rotulo="Fim do contrato">
                <input type="date" className={campo} value={k.fim ?? ""} onChange={(e) => setK({ fim: e.target.value || null })} />
              </Rot>
              <ComDica dica="Tempo mínimo de contrato (fidelidade). Ex.: 6 meses.">
                <CampoNumero rotulo="Prazo mínimo" sufixo="meses" valor={k.prazoMinimoMeses} aoMudar={(v) => setK({ prazoMinimoMeses: v })} />
              </ComDica>
              <ComDica dica="Quantos dias antes o cliente avisa se não for renovar. Ex.: 30 dias.">
                <CampoNumero rotulo="Aviso prévio" sufixo="dias" valor={k.avisoPrevioDias} aoMudar={(v) => setK({ avisoPrevioDias: v })} />
              </ComDica>
              <ComDica dica="Quantas vezes o cliente pode pedir ajuste na mesma peça. Ex.: 2 rodadas.">
                <CampoNumero rotulo="Rodadas de alteração por peça" valor={k.limiteRodadas} aoMudar={(v) => setK({ limiteRodadas: v })} />
              </ComDica>
              <ComDica dica="Dias que o cliente tem para aprovar uma peça. Ex.: 2 dias.">
                <CampoNumero rotulo="Prazo para o cliente aprovar" sufixo="dias" valor={k.prazoAprovacaoDias} aoMudar={(v) => setK({ prazoAprovacaoDias: v })} />
              </ComDica>
              <ComDica dica="Dias para a Aden entregar depois do pedido. Ex.: 5 dias.">
                <CampoNumero rotulo="Prazo de entrega" sufixo="dias" valor={k.prazoEntregaDias} aoMudar={(v) => setK({ prazoEntregaDias: v })} />
              </ComDica>
              <ComDica dica="Condição do contrato: quantas reuniões cabem no mês. Ex.: 2 reuniões.">
                <CampoNumero rotulo="Máximo de reuniões por mês" valor={k.limiteReunioesMes ?? null} aoMudar={(v) => setK({ limiteReunioesMes: v })} />
              </ComDica>
              <div className="flex items-end pb-2 sm:col-span-2">
                <Interruptor ligado={!!k.venceUltimoDiaUtil} rotulo="Vence no último dia útil do mês" aoMudar={(v) => setK({ venceUltimoDiaUtil: v })} />
              </div>
            </div>
            {c.escopo?.trafego.modelo === "garantia" || k.garantiaResultado || k.garantiaAte ? (
              <div className="grid gap-3 rounded-bloco border border-linha p-3 sm:grid-cols-[1fr_12rem]">
                <p className="text-sm font-bold sm:col-span-2">Tráfego com garantia</p>
                <label className="flex flex-col gap-1 text-xs font-semibold text-texto-suave">
                  O que conta como resultado
                  <textarea
                    key={`${c.id}-g`}
                    className="min-h-14 rounded-campo border border-linha bg-superficie px-3 py-2 text-sm font-normal text-texto focus:border-marca focus:outline-none"
                    defaultValue={k.garantiaResultado ?? ""}
                    placeholder="O número combinado com o cliente (ex.: quantas vendas ou contatos)"
                    onBlur={(e) => e.target.value !== (k.garantiaResultado ?? "") && setK({ garantiaResultado: e.target.value })}
                  />
                </label>
                <Rot rotulo="A garantia vale até">
                  <input type="date" className={campo} value={k.garantiaAte ?? ""} onChange={(e) => setK({ garantiaAte: e.target.value || null })} />
                </Rot>
                <p className="text-[12px] text-texto-suave sm:col-span-2">Enquanto o resultado não vem, a gestão do tráfego não é cobrada. Escreva o que foi combinado para ninguém discutir depois.</p>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2 text-xs">
              {proximoVencimento(k, hoje) && <Badge>próximo vencimento: {dataBr(proximoVencimento(k, hoje)!)}</Badge>}
              {fidelidade && <Badge tom={fidelidade > hoje ? "info" : "neutro"}>fidelidade até {dataBr(fidelidade)}</Badge>}
              {aviso && <Badge tom={aviso >= hoje ? "aviso" : "neutro"}>avisar se não renovar até {dataBr(aviso)}</Badge>}
            </div>
            <label className="flex flex-col gap-1 text-xs font-semibold text-texto-suave">
              Outras condições
              <textarea
                key={`${c.id}-k`}
                className="min-h-16 rounded-campo border border-linha bg-superficie px-3 py-2 text-sm font-normal text-texto focus:border-marca focus:outline-none"
                defaultValue={k.observacoes}
                onBlur={(e) => e.target.value !== k.observacoes && setK({ observacoes: e.target.value })}
              />
              <span className="text-[12px] leading-snug font-normal">Vai para o contrato que o cliente assina, como cláusula de observações.</span>
            </label>

            <div className="rounded-bloco border border-linha p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <p className="flex-1 text-sm font-bold">Entregas do contrato</p>
                <Botao
                  pequeno
                  variante="primario"
                  icone={SlidersHorizontal}
                  onClick={() => {
                    // abre com o valor do contrato travado: mexer nas entregas não muda o preço assinado,
                    // a não ser que a pessoa escolha "o valor segue o pacote" na Proposta
                    const base = c.escopo ? { ...c.escopo, clienteId: c.id } : { ...novoCenario(`Entregas do contrato · ${c.nome}`), clienteId: c.id };
                    const cen = c.valorMensalCentavos != null ? { ...base, modo: "valor" as const, mensalidadeCentavos: c.valorMensalCentavos } : base;
                    enviarCenario({ origem: "ficha", nome: `Entregas do contrato · ${c.nome}`, cenarios: [cen] });
                    router.push(`/negociacao?volta=${encodeURIComponent(`/clientes/${c.id}?aba=contrato`)}`);
                  }}
                >
                  Personalizar entregas
                </Botao>
                <Botao
                  pequeno
                  icone={Calculator}
                  title="Números internos: piso, horas e divisão"
                  onClick={() => {
                    enviarCenario({ origem: "saude", nome: `Entregas do contrato · ${c.nome}`, cenarios: [c.escopo ? { ...c.escopo, clienteId: c.id } : { ...novoCenario(`Entregas do contrato · ${c.nome}`), clienteId: c.id }] });
                    router.push("/calculadora");
                  }}
                >
                  Na calculadora
                </Botao>
              </div>
              {entregas.length ? (
                <ul className="grid gap-1 text-[13px] sm:grid-cols-2">
                  {entregas.map((l) => (
                    <li key={l.id} className="flex items-center justify-between gap-2 rounded-item bg-superficie-2/60 px-2 py-1">
                      <span>{nomeTipo(l.tipoEntregaId)}</span>
                      <span className="numero font-bold">{l.quantidade}/mês</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-texto-suave">Sem entregas do contrato guardadas: as horas deste cliente não entram na tela Mês.</p>
              )}
              {(config.pacotes ?? []).some((p) => p.ativo && !p.avulso) && (
                <div className="mt-3 flex items-center gap-2">
                  <Package size={14} className="text-texto-suave" />
                  <Selecao
                    className="flex-1"
                    ariaLabel="Usar um pacote como entregas do contrato"
                    valor={null}
                    vazio="Usar as entregas de um pacote…"
                    opcoes={(config.pacotes ?? []).filter((p) => p.ativo && !p.avulso).map((p) => ({ valor: p.id, rotulo: p.nome }))}
                    aoMudar={(v) => void escopoDoPacote(v)}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {aba === "tarefas" && (
          <div>
            <div className="mb-2 flex items-center gap-2 rounded-botao border border-linha px-3 focus-within:border-marca focus-within:ring-2 focus-within:ring-marca/20">
              <Plus size={15} className="text-texto-suave" />
              <input
                className="sem-contorno h-10 flex-1 bg-transparent text-sm outline-none placeholder:text-texto-suave"
                placeholder={`Nova tarefa de ${c.nome} (Enter)`}
                value={novaT}
                onChange={(e) => setNovaT(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key !== "Enter" || !novaT.trim()) return;
                  await a.salvar(novaTarefa(novoId(), novaT.trim(), { clienteId: c.id, responsavelId: a.usuario?.pessoaId ?? null }));
                  setNovaT("");
                }}
              />
            </div>
            {tarefas.length === 0 ? (
              <p className="py-3 text-center text-xs text-texto-suave">Nenhuma tarefa deste cliente.</p>
            ) : (
              [...abertas, ...tarefas.filter((t) => t.status === "concluida").slice(0, 10)].map((t) => <LinhaTarefa key={t.id} t={t} a={a} abrir={() => setTarefaAberta(t.id)} />)
            )}
          </div>
        )}

        {aba === "contexto" && <ContextoCliente clienteId={c.id} />}

        {aba === "briefing" && <BriefingCliente clienteId={c.id} config={config} />}

        {aba === "financeiro" && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <Link href={`/pagamentos?cliente=${c.id}`} className="inline-flex items-center gap-1.5 rounded-botao bg-marca-cheio px-3 py-1.5 text-xs font-semibold text-sobre-marca">
                <Wallet size={13} /> Registrar pagamento
              </Link>
              <Link href={`/mes?aba=clientes&cliente=${c.id}`} className="inline-flex items-center gap-1.5 rounded-botao border border-linha px-3 py-1.5 text-xs font-semibold">
                Ver a saúde deste cliente
              </Link>
            </div>
            {c.valorMensalCentavos != null && (
              <div className="rounded-bloco bg-superficie-2/70 px-3 py-2 text-[13px]">
                <p>
                  Este mês entrou <strong className="numero">{formatarMoeda(entrouNoMes)}</strong> de <strong className="numero">{formatarMoeda(c.valorMensalCentavos)}</strong>
                  {entrouNoMes < c.valorMensalCentavos ? (
                    <>
                      {" "}
                      · falta <strong className="numero text-aviso">{formatarMoeda(c.valorMensalCentavos - entrouNoMes)}</strong>
                    </>
                  ) : (
                    " · mês pago"
                  )}
                  .
                </p>
                <p className="text-[12px] text-texto-suave">Conta os pagamentos com referência a este mês, mesmo que tenham caído em partes.</p>
              </div>
            )}
            {pags.length === 0 ? (
              <p className="text-xs text-texto-suave">Nenhum pagamento registrado ainda.</p>
            ) : (
              <div className="divide-y divide-linha rounded-bloco border border-linha">
                {pags.slice(0, 24).map((p) => (
                  <div key={p.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-[13px]">
                    <span className="numero w-28 font-bold">{formatarMoeda(p.valorCentavos)}</span>
                    <span className="flex-1 text-texto-suave">
                      recebido em {dataBr(p.recebidoEm)} · referente a {p.competencia.split("-").reverse().join("/")}
                    </span>
                    {p.observacao && <span className="text-[11px] text-texto-suave">{p.observacao}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {aba === "comercial" && (
          <div className="flex flex-col gap-3">
            {!c.interno && (
              <FechamentoCliente
                cliente={c}
                a={a}
                mensalidadeNoOnboarding={config.empresa.mensalidadeNoOnboarding}
                aoAbrir={() => set({ fechamentoIniciadoEm: new Date().toISOString() })}
                irPara={(x) => irAba(abaDeTexto(x) ?? "dados")}
              />
            )}
            {!c.interno && <ContratoCliente config={config} clienteId={c.id} />}
            {!lead ? (
              <p className="text-xs text-texto-suave">Este cliente não veio pelos leads do Aden.</p>
            ) : (
              <>
                <p className="text-sm">
                  Veio dos leads{lead.origem && ` (por ${lead.origem})`}: {rotuloEtapa(lead.etapa)}
                  {lead.fechadoEm && ` em ${new Date(lead.fechadoEm).toLocaleDateString("pt-BR")}`}.{" "}
                  <Link href={`/crm?lead=${lead.id}`} className="font-semibold text-marca-forte underline">
                    Abrir o lead
                  </Link>
                </p>
                {lead.observacoes && <p className="rounded-bloco bg-superficie-2/60 px-3 py-2 text-xs whitespace-pre-wrap">{lead.observacoes}</p>}
                <p className="flex items-center gap-1.5 text-xs font-semibold text-texto-suave">
                  <MessageCircle size={13} /> Conversas antes de fechar
                </p>
                {interacoes.length === 0 ? (
                  <p className="text-xs text-texto-suave">Nada registrado.</p>
                ) : (
                  <ol className="flex flex-col gap-2 border-l-2 border-linha pl-3">
                    {interacoes.map((i) => (
                      <li key={i.id} className="text-[13px]">
                        <p className="text-[12px] text-texto-suave">
                          <strong className="text-texto">{TIPOS_INTERACAO.find((t) => t.valor === i.tipo)?.rotulo}</strong> · {new Date(i.em).toLocaleDateString("pt-BR")}
                          {i.autorNome && ` · ${i.autorNome}`}
                        </p>
                        <p className="whitespace-pre-wrap">{i.texto}</p>
                      </li>
                    ))}
                  </ol>
                )}
              </>
            )}
          </div>
        )}
        </div>
      </div>
      {tarefaAberta && <TarefaDaFicha id={tarefaAberta} a={a} aoFechar={() => setTarefaAberta(null)} />}
    </div>
  );
}

function TarefaDaFicha({ id, a, aoFechar }: { id: string; a: AcoesTarefas; aoFechar: () => void }) {
  return <DetalheTarefa tarefa={a.tarefas.find((t) => t.id === id) ?? null} a={a} aoFechar={aoFechar} />;
}
