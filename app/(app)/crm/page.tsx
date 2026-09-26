"use client";

// CRM: o funil de vendas. Colunas por etapa (arrastar muda a etapa), tempo parado em
// cada etapa, próximo contato e valor estimado. Clicar no lead abre a ficha.

import { CalendarClock, Coins, Handshake, Plus, Target, Trophy, XCircle, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { COR_ETAPA, DetalheLead } from "@/components/crm/DetalheLead";
import { CabecalhoPagina } from "@/components/Shell";
import { cx } from "@/components/ui";
import { contatosParaHoje, diasNaEtapa, ETAPAS, leadParado, moverLead, novoLead, resumoFunil, type EtapaLead, type Lead } from "@/lib/calculo/crm";
import { hojeISO } from "@/lib/calculo/dia";
import { configVazia, novoId } from "@/lib/calculo/novo";
import type { Configuracao } from "@/lib/calculo/tipos";
import { ganharLead } from "@/lib/dados/acoes";
import { useDados } from "@/lib/dados/contexto";
import type { ResumoSimulacao } from "@/lib/dados/repositorio";
import { formatarMoeda, formatarPct } from "@/lib/formato";

function Numero({ icone: Ic, rotulo, valor, sub }: { icone: LucideIcon; rotulo: string; valor: string; sub?: string }) {
  return (
    <div className="rounded-bloco border border-linha bg-superficie p-3">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-texto-suave">
        <Ic size={13} /> {rotulo}
      </p>
      <p className="numero text-xl font-extrabold">{valor}</p>
      {sub && <p className="text-[10px] text-texto-suave">{sub}</p>}
    </div>
  );
}

export default function Crm() {
  const { repo, usuario } = useDados();
  const [config, setConfig] = useState<Configuracao>(configVazia());
  const [leads, setLeads] = useState<Lead[]>([]);
  const [sims, setSims] = useState<ResumoSimulacao[]>([]);
  const [carregado, setCarregado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [rapido, setRapido] = useState("");
  const [sobre, setSobre] = useState<EtapaLead | null>(null);
  const [verPerdidos, setVerPerdidos] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [c, l, s] = await Promise.all([repo.carregarConfig(), repo.listarLeads(), repo.listarSimulacoes()]);
        setConfig(c);
        setLeads(l);
        setSims(s);
        // link direto: /crm?lead=id
        const id = new URLSearchParams(window.location.search).get("lead");
        if (id) setAberto(id);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro ao carregar o CRM.");
      } finally {
        setCarregado(true);
      }
    })();
  }, [repo]);

  const hoje = hojeISO();
  const resumo = useMemo(() => resumoFunil(leads, hoje), [leads, hoje]);
  const paraHoje = useMemo(() => contatosParaHoje(leads, null, hoje), [leads, hoje]);

  const salvar = async (l: Lead) => {
    setErro(null);
    setLeads((ls) => (ls.some((x) => x.id === l.id) ? ls.map((x) => (x.id === l.id ? l : x)) : [l, ...ls]));
    try {
      await repo.salvarLead(l);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para salvar.");
      setLeads(await repo.listarLeads());
    }
  };

  const criar = async (nome: string, abrir: boolean) => {
    const l = novoLead(novoId(), nome, { responsavelId: usuario?.pessoaId ?? null });
    await salvar(l);
    if (abrir) setAberto(l.id);
  };

  const ganhar = async (l: Lead) => {
    const r = await ganharLead(repo, config, l);
    const [c, ls] = await Promise.all([repo.carregarConfig(), repo.listarLeads()]);
    setConfig(c);
    setLeads(ls);
    if (r.escopo && !r.escopo.gravado)
      setErro(`${l.nome} virou cliente. O escopo ficou abaixo do piso de ${r.escopo.abaixo.map((a) => a.nome).join(" e ")}: espera a aprovação em Sócios → Aprovações.`);
  };

  if (!carregado) return null;

  const lead = leads.find((l) => l.id === aberto) ?? null;
  const colunas = ETAPAS.filter((e) => e.valor !== "perdido");
  const perdidos = leads.filter((l) => l.etapa === "perdido");

  return (
    <div className="pb-16">
      <CabecalhoPagina
        icone={Handshake}
        selo="Comercial"
        titulo="CRM"
        descricao="Cada pessoa interessada na Aden, da primeira mensagem até fechar. Arraste o card para mudar de etapa; clique para ver a ficha."
      />
      <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
        {erro && <p className="rounded-card bg-aviso-suave px-4 py-3 text-sm text-aviso">{erro}</p>}

        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Numero icone={Target} rotulo="Em negociação" valor={String(resumo.abertos)} sub={resumo.abertos ? `${formatarMoeda(resumo.valorEmAbertoCentavos)}/mês somando os valores estimados` : undefined} />
          <Numero icone={CalendarClock} rotulo="Contatos para hoje" valor={String(paraHoje.length)} sub={paraHoje.length ? paraHoje.map((l) => l.nome).slice(0, 3).join(", ") : "nenhum atrasado"} />
          <Numero icone={Trophy} rotulo="Fechados este mês" valor={String(resumo.ganhosNoMes)} sub={resumo.ganhosNoMes ? `${formatarMoeda(resumo.valorGanhoNoMesCentavos)}/mês` : undefined} />
          <Numero icone={Coins} rotulo="Taxa de fechamento" valor={resumo.taxaGanhoPct == null ? "—" : formatarPct(resumo.taxaGanhoPct)} sub="ganhos ÷ (ganhos + perdidos)" />
        </div>

        <div className="flex items-center gap-2 rounded-botao border border-linha bg-superficie px-4 focus-within:border-marca focus-within:ring-2 focus-within:ring-marca/20">
          <Plus size={15} className="text-texto-suave" />
          <input
            className="sem-contorno h-11 flex-1 bg-transparent text-sm outline-none placeholder:text-texto-suave"
            placeholder="Novo lead: escreva o nome e aperte Enter"
            value={rapido}
            onChange={(e) => setRapido(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && rapido.trim()) {
                void criar(rapido.trim(), true);
                setRapido("");
              }
            }}
            aria-label="Novo lead"
          />
        </div>

        <div className="-mx-1 grid gap-3 overflow-x-auto px-1 pb-2" style={{ gridTemplateColumns: `repeat(${colunas.length}, minmax(15rem, 1fr))` }}>
          {colunas.map((c) => {
            const itens = leads.filter((l) => l.etapa === c.valor);
            const soma = itens.reduce((a, l) => a + (l.valorEstimadoCentavos ?? 0), 0);
            return (
              <div
                key={c.valor}
                onDragOver={(e) => {
                  e.preventDefault();
                  setSobre(c.valor);
                }}
                onDragLeave={() => setSobre(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setSobre(null);
                  const l = leads.find((x) => x.id === e.dataTransfer.getData("text/plain"));
                  if (!l || l.etapa === c.valor) return;
                  if (c.valor === "ganho") setAberto(l.id);
                  void salvar(moverLead(l, c.valor));
                }}
                className={cx("flex min-h-48 flex-col gap-2 rounded-bloco bg-superficie-2/60 p-2 transition-colors", sobre === c.valor && "bg-marca-suave")}
              >
                <div className="flex items-center gap-2 px-1 pt-1">
                  <span className={cx("size-2.5 rounded-full", COR_ETAPA[c.valor])} aria-hidden />
                  <p className="flex-1 text-[11px] font-bold uppercase">{c.rotulo}</p>
                  <span className="text-[11px] font-semibold text-texto-suave">{itens.length}</span>
                </div>
                {soma > 0 && <p className="-mt-1 px-1 text-[10px] text-texto-suave">{formatarMoeda(soma)}/mês</p>}
                {itens.map((l) => {
                  const resp = config.pessoas.find((p) => p.id === l.responsavelId);
                  const parado = leadParado(l, config.empresa.diasLeadParado);
                  const dias = diasNaEtapa(l);
                  const atrasado = l.proximoContato != null && l.proximoContato < hoje && c.aberta;
                  return (
                    <div
                      key={l.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("text/plain", l.id)}
                      role="button"
                      tabIndex={0}
                      onClick={() => setAberto(l.id)}
                      onKeyDown={(e) => e.key === "Enter" && setAberto(l.id)}
                      className={cx(
                        "flex cursor-grab flex-col gap-1.5 rounded-item border bg-superficie p-3 shadow-card hover:border-marca/50 active:cursor-grabbing",
                        parado ? "border-aviso" : "border-linha",
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <span className="min-w-0 flex-1 text-[13px] font-semibold">{l.nome}</span>
                        {resp && <Avatar nome={resp.nome} foto={resp.fotoUrl} tamanho="sm" />}
                      </div>
                      {l.valorEstimadoCentavos != null && <span className="numero text-xs font-bold text-marca-forte">{formatarMoeda(l.valorEstimadoCentavos)}/mês</span>}
                      {l.proximaAcao && <span className="text-[11px] text-texto-suave">→ {l.proximaAcao}</span>}
                      <div className="flex flex-wrap items-center gap-2 text-[10px]">
                        {c.aberta && (
                          <span className={cx("rounded-botao px-2 py-0.5 font-semibold", parado ? "bg-aviso text-superficie" : "bg-superficie-2 text-texto-suave")}>
                            {dias === 0 ? "entrou hoje" : `há ${dias} dia${dias === 1 ? "" : "s"} aqui`}
                          </span>
                        )}
                        {l.proximoContato && c.aberta && (
                          <span className={cx("inline-flex items-center gap-1", atrasado ? "font-semibold text-erro" : "text-texto-suave")}>
                            <CalendarClock size={11} />
                            {l.proximoContato === hoje ? "falar hoje" : new Date(`${l.proximoContato}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {itens.length === 0 && <p className="px-1 py-6 text-center text-[11px] text-texto-suave">vazio</p>}
              </div>
            );
          })}
        </div>

        {perdidos.length > 0 && (
          <div>
            <button type="button" className="inline-flex items-center gap-1.5 text-xs font-semibold text-texto-suave hover:text-texto" onClick={() => setVerPerdidos(!verPerdidos)}>
              <XCircle size={13} /> {verPerdidos ? "Esconder" : "Ver"} {perdidos.length} perdido(s)
            </button>
            {verPerdidos && (
              <div className="mt-2 flex flex-col divide-y divide-linha rounded-bloco border border-linha bg-superficie">
                {perdidos.map((l) => (
                  <button key={l.id} type="button" onClick={() => setAberto(l.id)} className="flex flex-wrap items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-superficie-2/60">
                    <span className="flex-1 font-semibold">{l.nome}</span>
                    <span className="text-[11px] text-texto-suave">{l.motivoPerda || "sem motivo registrado"}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <DetalheLead
        lead={lead}
        config={config}
        simulacoes={sims}
        aoSalvar={salvar}
        aoRemover={async (l) => {
          setLeads((ls) => ls.filter((x) => x.id !== l.id));
          await repo.removerLead(l.id);
        }}
        aoGanhar={ganhar}
        aoFechar={() => setAberto(null)}
      />
    </div>
  );
}
