"use client";

// Ficha do cliente: tudo de um cliente num lugar só (dados, contrato e escopo, tarefas,
// pagamentos e a conversa que veio do CRM). Edita no lugar e salva ao sair do campo.

import { BookMarked, Calculator, FileQuestion, ClipboardList, FileSignature, Handshake, MessageCircle, Package, Plus, SlidersHorizontal, User, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Modal } from "../Modal";
import { PAINEL_CLIENTE_ATIVO } from "@/lib/recursos";
import { BriefingCliente } from "./BriefingCliente";
import { ContextoCliente } from "./ContextoCliente";
import { ContratoCliente } from "./ContratoCliente";
import { FechamentoCliente } from "./FechamentoCliente";
import { LinkPainel } from "./LinkPainel";
import { DetalheTarefa } from "../tarefas/DetalheTarefa";
import { LinhaTarefa } from "../tarefas/LinhaTarefa";
import type { AcoesTarefas } from "../tarefas/useTarefas";
import { Badge, Botao, CampoMoeda, CampoNumero, Interruptor, Segmentado, Selecao } from "../ui";
import { contratoVazio, fimDaFidelidade, prazoDoAvisoPrevio, proximoVencimento } from "@/lib/calculo/clientes";
import { rotuloEtapa, TIPOS_INTERACAO, type InteracaoLead, type Lead } from "@/lib/calculo/crm";
import { hojeISO } from "@/lib/calculo/dia";
import { novoCenario, novoId } from "@/lib/calculo/novo";
import { pacoteParaCenario } from "@/lib/calculo/pacotes";
import type { Pagamento, SituacaoPagamento } from "@/lib/calculo/pagamentos";
import { novaTarefa } from "@/lib/calculo/tarefas";
import type { AtalhosPainel, ClienteBase, Configuracao, DadosContrato } from "@/lib/calculo/tipos";
import { guardarEscopo } from "@/lib/dados/acoes";
import { useDados } from "@/lib/dados/contexto";
import { formatarDocumento, formatarMoeda } from "@/lib/formato";
import { enviarCenario } from "@/lib/navegacao";

export type Aba = "resumo" | "contrato" | "tarefas" | "contexto" | "briefing" | "financeiro" | "comercial";

export const SITUACAO_PAGAMENTO: Record<SituacaoPagamento, { rotulo: string; tom: "ok" | "aviso" | "erro" | "neutro" }> = {
  pago: { rotulo: "pago", tom: "ok" },
  parcial: { rotulo: "pago em parte", tom: "aviso" },
  a_receber: { rotulo: "a receber", tom: "neutro" },
  atrasado: { rotulo: "atrasado", tom: "erro" },
  sem_contrato: { rotulo: "sem valor", tom: "neutro" },
};

const campo =
  "sem-contorno h-9 w-full rounded-campo border border-linha bg-superficie px-3 text-sm placeholder:text-texto-suave/70 focus:border-marca focus:outline-none focus:ring-2 focus:ring-marca/20";

const ATALHOS_VAZIOS: AtalhosPainel = { planejamentoUrl: null, planejamentoRotulo: null, fotosUrl: null, identidadeUrl: null, inclusoTexto: null };

function Rot({ rotulo, children, dica }: { rotulo: string; children: ReactNode; dica?: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold text-texto-suave">
      {rotulo}
      {children}
      {dica && <span className="text-[10px] font-normal">{dica}</span>}
    </label>
  );
}

/** Texto que salva ao sair do campo. */
function Texto({ valor, aoSalvar, placeholder, tipo = "text" }: { valor: string; aoSalvar: (v: string) => void; placeholder?: string; tipo?: string }) {
  return (
    <input
      key={valor}
      type={tipo}
      className={campo}
      placeholder={placeholder}
      defaultValue={valor}
      onBlur={(e) => e.target.value !== valor && aoSalvar(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    />
  );
}

const dataBr = (iso: string | null) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR") : "—");

export function FichaCliente({
  cliente,
  config,
  a,
  pagamentos,
  situacaoMes,
  leads,
  aoSalvar,
  aoRecarregar,
  aoFechar,
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
  aoFechar: () => void;
  /** aba que abre primeiro (ex.: voltando da Proposta, abre no Contrato) */
  abaInicial?: Aba | null;
}) {
  const { repo } = useDados();
  const router = useRouter();
  const [aba, setAba] = useState<Aba>(abaInicial ?? "resumo");
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
    if (c.escopo && !confirm(`Trocar o escopo de ${c.nome} pelo pacote ${p.nome}?`)) return;
    try {
      const base = pacoteParaCenario(p);
      const cen = c.valorMensalCentavos != null ? { ...base, modo: "valor" as const, mensalidadeCentavos: c.valorMensalCentavos } : base;
      const r = await guardarEscopo(repo, config, c.id, cen);
      await aoRecarregar();
      setMsg(r.gravado ? `Escopo do pacote ${p.nome} guardado.` : `Ficou abaixo do piso de ${r.abaixo.map((x) => x.nome).join(" e ")}: espera aprovação em Sócios → Pedidos e avisos.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Não deu para guardar o escopo.");
    }
  };

  return (
    <>
      <Modal
        aberto={!tarefaAberta}
        aoFechar={aoFechar}
        largura="lg"
        expandivel
        titulo={c.nome}
        subtitulo={
          <span className="flex flex-wrap items-center gap-2">
            {c.segmento && <span>{c.segmento}</span>}
            {c.valorMensalCentavos != null && <span className="numero font-semibold text-texto">{formatarMoeda(c.valorMensalCentavos)}/mês</span>}
            {situacaoMes && <Badge tom={SITUACAO_PAGAMENTO[situacaoMes].tom}>este mês: {SITUACAO_PAGAMENTO[situacaoMes].rotulo}</Badge>}
            {!c.ativo && <Badge>inativo</Badge>}
          </span>
        }
      >
        <div className="mb-4">
          <Segmentado<Aba>
            rotulo="Parte da ficha"
            valor={aba}
            aoMudar={setAba}
            opcoes={[
              { valor: "resumo", rotulo: "Dados", icone: User },
              { valor: "contrato", rotulo: "Contrato", icone: FileSignature },
              { valor: "tarefas", rotulo: `Tarefas${abertas.length ? ` (${abertas.length})` : ""}`, icone: ClipboardList },
              { valor: "contexto", rotulo: "Contexto", icone: BookMarked },
              { valor: "briefing", rotulo: "Briefing", icone: FileQuestion },
              { valor: "financeiro", rotulo: "Pagamentos", icone: Wallet },
              { valor: "comercial", rotulo: "Comercial", icone: Handshake },
            ]}
          />
        </div>
        {msg && <p className="mb-3 rounded-bloco bg-info-suave px-3 py-2 text-xs text-info">{msg}</p>}

        {aba === "resumo" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Rot rotulo="Nome">
              <Texto valor={c.nome} aoSalvar={(v) => v.trim() && set({ nome: v.trim() })} />
            </Rot>
            <Rot rotulo="Segmento">
              <Texto valor={c.segmento ?? ""} aoSalvar={(v) => set({ segmento: v })} placeholder="ex.: moda, saúde, loja física" />
            </Rot>
            <Rot rotulo="Pessoa de contato">
              <Texto valor={c.contato ?? ""} aoSalvar={(v) => set({ contato: v })} />
            </Rot>
            <Rot rotulo="Telefone / WhatsApp">
              <Texto valor={c.telefone ?? ""} aoSalvar={(v) => set({ telefone: v })} />
            </Rot>
            <Rot rotulo="Instagram">
              <Texto valor={c.instagram ?? ""} aoSalvar={(v) => set({ instagram: v })} placeholder="@perfil" />
            </Rot>
            <Rot rotulo="E-mail">
              <Texto valor={c.email ?? ""} aoSalvar={(v) => set({ email: v })} />
            </Rot>
            <Rot rotulo="Nome no contrato" dica="Razão social ou nome completo. Vazio = o nome do cliente.">
              <Texto valor={c.razaoSocial ?? ""} aoSalvar={(v) => set({ razaoSocial: v })} />
            </Rot>
            <Rot rotulo="CPF ou CNPJ" dica="Vai no contrato.">
              <Texto valor={c.documento ?? ""} aoSalvar={(v) => set({ documento: formatarDocumento(v) })} />
            </Rot>
            <Rot rotulo="Endereço" dica="Vai no contrato.">
              <Texto valor={c.endereco ?? ""} aoSalvar={(v) => set({ endereco: v })} />
            </Rot>
            <Rot rotulo="Cliente desde">
              <input type="date" className={campo} value={c.clienteDesde ?? ""} onChange={(e) => set({ clienteDesde: e.target.value || null })} />
            </Rot>
            <div className="flex flex-col justify-end gap-2 pb-1">
              <Interruptor ligado={c.ativo} rotulo="Cliente ativo" aoMudar={(v) => set({ ativo: v })} />
              {!c.interno && <Interruptor ligado={c.participaRateio} rotulo="Divide os custos fixos (rateio)" aoMudar={(v) => set({ participaRateio: v })} />}
              <Interruptor
                ligado={c.interno}
                rotulo="É a própria Aden (cliente interno)"
                aoMudar={(v) => set(v ? { interno: true, participaRateio: false } : { interno: false })}
              />
              {c.interno && (
                <p className="text-[12px] text-texto-suave">
                  Sem mensalidade: fica fora do faturamento, do rateio, da divisão entre sócios e do teto do MEI, e não pede exceção de piso. Tarefas e cronômetro funcionam igual; as horas
                  aparecem no Mês como investidas na Aden.
                </p>
              )}
            </div>
            <div className="sm:col-span-2">
              {PAINEL_CLIENTE_ATIVO && !c.interno && <LinkPainel clienteId={c.id} token={c.painelToken} aoMudar={(t) => void aoRecarregar().then(() => setMsg(t ? "Link do painel pronto." : null))} />}
            </div>
            {PAINEL_CLIENTE_ATIVO && !c.interno && c.painelToken && (
              <div className="grid gap-3 rounded-bloco border border-linha p-3 sm:col-span-2 sm:grid-cols-2">
                <p className="text-[12px] text-texto-suave sm:col-span-2">
                  <strong className="text-texto">Atalhos do painel.</strong> O que o cliente abre direto no painel, sem pedir por fora. Links completos, começando com https://. Vazio = não
                  aparece. Todo mês, troque o planejamento.
                </p>
                {(
                  [
                    ["planejamentoUrl", "PDF do planejamento do mês", "https://…"],
                    ["planejamentoRotulo", "Texto do botão do planejamento", "ex.: Planejamento de outubro"],
                    ["fotosUrl", "Pasta de fotos (Drive)", "https://…"],
                    ["identidadeUrl", "Pasta da identidade visual", "https://…"],
                  ] as const
                ).map(([k, rotulo, dica]) => (
                  <Rot key={k} rotulo={rotulo}>
                    <Texto
                      valor={c.atalhos?.[k] ?? ""}
                      placeholder={dica}
                      aoSalvar={(v) => {
                        const limpo = v.trim();
                        if (k !== "planejamentoRotulo" && limpo && !/^https:\/\/\S+$/.test(limpo)) return setMsg("O link precisa ser completo, começando com https://.");
                        set({ atalhos: { ...ATALHOS_VAZIOS, ...c.atalhos, [k]: limpo || null } });
                      }}
                    />
                  </Rot>
                ))}
                <label className="flex flex-col gap-1 text-xs font-semibold text-texto-suave sm:col-span-2">
                  O que está incluso (o cliente lê no painel)
                  <textarea
                    key={`incluso-${c.id}`}
                    className="min-h-20 rounded-campo border border-linha bg-superficie px-3 py-2 text-sm font-normal text-texto focus:border-marca focus:outline-none"
                    defaultValue={c.atalhos?.inclusoTexto ?? ""}
                    placeholder="O que o serviço cobre e o que é extra."
                    onBlur={(e) =>
                      e.target.value.trim() !== (c.atalhos?.inclusoTexto ?? "") && set({ atalhos: { ...ATALHOS_VAZIOS, ...c.atalhos, inclusoTexto: e.target.value.trim() || null } })
                    }
                  />
                </label>
              </div>
            )}
            <label className="flex flex-col gap-1 text-xs font-semibold text-texto-suave sm:col-span-2">
              Observações
              <textarea
                key={c.id}
                className="min-h-20 rounded-campo border border-linha bg-superficie px-3 py-2 text-sm font-normal text-texto focus:border-marca focus:outline-none"
                defaultValue={c.observacoes ?? ""}
                placeholder="Preferências, acessos, combinados…"
                onBlur={(e) => e.target.value !== (c.observacoes ?? "") && set({ observacoes: e.target.value })}
              />
            </label>
          </div>
        )}

        {aba === "contrato" && (
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <CampoMoeda rotulo="Valor mensal" valor={c.valorMensalCentavos} aoMudar={(v) => set({ valorMensalCentavos: v })} />
              {k.venceUltimoDiaUtil ? (
                <Rot rotulo="Vencimento">
                  <p className="flex h-10 items-center text-sm text-texto-suave">último dia útil do mês</p>
                </Rot>
              ) : (
                <CampoNumero rotulo="Dia do pagamento" valor={k.diaPagamento} aoMudar={(v) => setK({ diaPagamento: v == null ? null : Math.min(31, Math.max(1, Math.round(v))) })} />
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
              <CampoNumero rotulo="Prazo mínimo" sufixo="meses" valor={k.prazoMinimoMeses} aoMudar={(v) => setK({ prazoMinimoMeses: v })} />
              <CampoNumero rotulo="Aviso prévio" sufixo="dias" valor={k.avisoPrevioDias} aoMudar={(v) => setK({ avisoPrevioDias: v })} />
              <CampoNumero rotulo="Rodadas de alteração por peça" valor={k.limiteRodadas} aoMudar={(v) => setK({ limiteRodadas: v })} />
              <CampoNumero rotulo="Prazo para o cliente aprovar" sufixo="dias" valor={k.prazoAprovacaoDias} aoMudar={(v) => setK({ prazoAprovacaoDias: v })} />
              <CampoNumero rotulo="Prazo de entrega" sufixo="dias" valor={k.prazoEntregaDias} aoMudar={(v) => setK({ prazoEntregaDias: v })} />
              <CampoNumero rotulo="Máximo de reuniões por mês" valor={k.limiteReunioesMes ?? null} aoMudar={(v) => setK({ limiteReunioesMes: v })} />
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
            </label>

            <div className="rounded-bloco border border-linha p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <p className="flex-1 text-sm font-bold">Escopo contratado</p>
                <Botao
                  pequeno
                  variante="primario"
                  icone={SlidersHorizontal}
                  onClick={() => {
                    // abre com o valor do contrato travado: mexer nas entregas não muda o preço assinado,
                    // a não ser que a pessoa escolha "o valor segue o pacote" na Proposta
                    const base = c.escopo ? { ...c.escopo, clienteId: c.id } : { ...novoCenario(`Escopo · ${c.nome}`), clienteId: c.id };
                    const cen = c.valorMensalCentavos != null ? { ...base, modo: "valor" as const, mensalidadeCentavos: c.valorMensalCentavos } : base;
                    enviarCenario({ origem: "ficha", nome: `Escopo · ${c.nome}`, cenarios: [cen] });
                    router.push(`/negociacao?volta=${encodeURIComponent(`/clientes?cliente=${c.id}&aba=contrato`)}`);
                  }}
                >
                  Personalizar escopo
                </Botao>
                <Botao
                  pequeno
                  icone={Calculator}
                  title="Números internos: piso, horas e divisão"
                  onClick={() => {
                    enviarCenario({ origem: "saude", nome: `Escopo · ${c.nome}`, cenarios: [c.escopo ? { ...c.escopo, clienteId: c.id } : { ...novoCenario(`Escopo · ${c.nome}`), clienteId: c.id }] });
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
                <p className="text-xs text-texto-suave">Sem escopo guardado: as horas deste cliente não entram na tela Mês.</p>
              )}
              {(config.pacotes ?? []).some((p) => p.ativo) && (
                <div className="mt-3 flex items-center gap-2">
                  <Package size={14} className="text-texto-suave" />
                  <Selecao
                    className="flex-1"
                    ariaLabel="Usar um pacote como escopo"
                    valor={null}
                    vazio="Usar um pacote como escopo…"
                    opcoes={(config.pacotes ?? []).filter((p) => p.ativo).map((p) => ({ valor: p.id, rotulo: p.nome }))}
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
              <Link href={`/pagamentos?cliente=${c.id}`} className="inline-flex items-center gap-1.5 rounded-botao bg-marca px-3 py-1.5 text-xs font-semibold text-sobre-marca">
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
                irPara={setAba}
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
      </Modal>
      {tarefaAberta && <TarefaDaFicha id={tarefaAberta} a={a} aoFechar={() => setTarefaAberta(null)} />}
    </>
  );
}

function TarefaDaFicha({ id, a, aoFechar }: { id: string; a: AcoesTarefas; aoFechar: () => void }) {
  return <DetalheTarefa tarefa={a.tarefas.find((t) => t.id === id) ?? null} a={a} aoFechar={aoFechar} />;
}
