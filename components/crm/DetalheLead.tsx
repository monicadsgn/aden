"use client";

// Janela do lead: contato, etapa, interesse (pacote/proposta), próximo contato e o
// histórico da conversa. Ganhou → vira cliente. Perdeu → guarda o motivo.

import {
  ArrowRight,
  AtSign,
  CalendarClock,
  Calculator,
  CheckCircle2,
  Camera,
  Mail,
  MessageCircle,
  Package,
  Phone,
  Presentation,
  Trash2,
  User,
  UserPlus,
  Users,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Avatar } from "../Avatar";
import { Modal } from "../Modal";
import { Botao, CampoMoeda, cx } from "../ui";
import { ETAPAS, moverLead, TIPOS_INTERACAO, type InteracaoLead, type Lead, type TipoInteracao } from "@/lib/calculo/crm";
import { novoId } from "@/lib/calculo/novo";
import { precoDoPacote } from "@/lib/calculo/pacotes";
import type { Configuracao } from "@/lib/calculo/tipos";
import { useDados } from "@/lib/dados/contexto";
import type { ResumoSimulacao } from "@/lib/dados/repositorio";
import { formatarMoeda } from "@/lib/formato";

export const COR_ETAPA: Record<Lead["etapa"], string> = {
  lead_recebido: "bg-superficie-2 text-texto",
  contato_feito: "bg-info text-superficie",
  proposta_enviada: "bg-aviso text-superficie",
  ganho: "bg-ok text-superficie",
  perdido: "bg-erro text-superficie",
};

const campo =
  "sem-contorno h-8 w-full min-w-0 rounded-item border border-transparent bg-transparent px-2 text-[13px] text-texto placeholder:text-texto-suave/70 hover:border-linha hover:bg-superficie-2/60 focus:border-marca focus:bg-superficie focus:outline-none";

function Linha({ icone: Ic, rotulo, children }: { icone: LucideIcon; rotulo: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] items-center gap-2 py-1 text-[13px]">
      <span className="flex items-center gap-2 text-texto-suave">
        <Ic size={14} aria-hidden /> {rotulo}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Campo de texto que salva ao sair (para não gravar a cada letra). */
function Texto({ valor, aoSalvar, placeholder, rotulo }: { valor: string; aoSalvar: (v: string) => void; placeholder?: string; rotulo: string }) {
  return (
    <input
      key={valor}
      aria-label={rotulo}
      className={campo}
      placeholder={placeholder ?? "—"}
      defaultValue={valor}
      onBlur={(e) => e.target.value !== valor && aoSalvar(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    />
  );
}

export function DetalheLead({
  lead,
  config,
  simulacoes,
  aoSalvar,
  aoRemover,
  aoGanhar,
  aoFechar,
}: {
  lead: Lead | null;
  config: Configuracao;
  simulacoes: ResumoSimulacao[];
  aoSalvar: (l: Lead) => Promise<void>;
  aoRemover: (l: Lead) => Promise<void>;
  aoGanhar: (l: Lead) => Promise<void>;
  aoFechar: () => void;
}) {
  const { repo } = useDados();
  const [interacoes, setInteracoes] = useState<InteracaoLead[]>([]);
  const [nota, setNota] = useState("");
  const [tipoNota, setTipoNota] = useState<TipoInteracao>("nota");
  const [perdendo, setPerdendo] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [confirmarApagar, setConfirmarApagar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const id = lead?.id;

  useEffect(() => {
    if (!id) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- troca de lead: zera o que era do anterior
    setPerdendo(false);
    setConfirmarApagar(false);
    setErro(null);
    repo.listarInteracoes(id).then(setInteracoes).catch(() => setInteracoes([]));
  }, [id, repo]);

  if (!lead) return null;
  const l = lead;
  const set = (patch: Partial<Lead>) => void aoSalvar({ ...l, ...patch }).catch((e) => setErro(e instanceof Error ? e.message : "Não deu para salvar."));
  const pacotes = (config.pacotes ?? []).filter((p) => p.ativo || p.id === l.pacoteId);
  const pacote = pacotes.find((p) => p.id === l.pacoteId);
  const precoPacote = pacote ? precoDoPacote(config, pacote).mensalCentavos : null;
  const resp = config.pessoas.find((p) => p.id === l.responsavelId);
  const hoje = new Date().toISOString().slice(0, 10);

  const registrar = async () => {
    if (!nota.trim()) return;
    const i: InteracaoLead = { id: novoId(), leadId: l.id, tipo: tipoNota, texto: nota.trim(), em: new Date().toISOString(), autorNome: null };
    try {
      await repo.salvarInteracao(i);
      setInteracoes(await repo.listarInteracoes(l.id));
      setNota("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para registrar.");
    }
  };

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      largura="lg"
      expandivel
      titulo={<Texto rotulo="Nome do lead" valor={l.nome} aoSalvar={(v) => v.trim() && set({ nome: v.trim() })} />}
      subtitulo={<span className="px-2">{[l.origem && `veio por ${l.origem}`, l.contato].filter(Boolean).join(" · ") || "Lead"}</span>}
      rodape={
        <>
          {confirmarApagar ? (
            <span className="mr-auto flex items-center gap-2 text-xs">
              Apagar de vez?
              <Botao pequeno variante="perigo" onClick={() => void aoRemover(l).then(aoFechar)}>
                Sim, apagar
              </Botao>
              <Botao pequeno variante="fantasma" onClick={() => setConfirmarApagar(false)}>
                Cancelar
              </Botao>
            </span>
          ) : (
            <Botao pequeno variante="perigo" icone={Trash2} className="mr-auto" onClick={() => setConfirmarApagar(true)}>
              Apagar
            </Botao>
          )}
          {l.etapa !== "perdido" && l.etapa !== "ganho" && (
            <Botao icone={XCircle} onClick={() => setPerdendo(true)}>
              Perdemos
            </Botao>
          )}
          {l.clienteId ? (
            <Link href={`/clientes?cliente=${l.clienteId}`} className="inline-flex h-10 items-center gap-1.5 rounded-botao bg-ok px-4 text-sm font-semibold text-superficie">
              <Users size={16} /> Ver o cliente
            </Link>
          ) : (
            <Botao variante="primario" icone={UserPlus} onClick={() => void aoGanhar(l).catch((e) => setErro(e instanceof Error ? e.message : "Não deu para criar o cliente."))}>
              Fechou! Virar cliente
            </Botao>
          )}
        </>
      }
    >
      {erro && <p className="mb-3 rounded-bloco bg-erro-suave px-3 py-2 text-xs text-erro">{erro}</p>}

      <div className="mb-3 flex flex-wrap gap-1">
        {ETAPAS.map((e) => (
          <button
            key={e.valor}
            type="button"
            aria-pressed={e.valor === l.etapa}
            onClick={() => (e.valor === "perdido" ? setPerdendo(true) : e.valor !== l.etapa && set(moverLead(l, e.valor)))}
            className={cx(
              "rounded-botao px-2.5 py-1 text-[11px] font-bold uppercase transition-opacity",
              e.valor === l.etapa ? COR_ETAPA[e.valor] : "bg-superficie-2/60 text-texto-suave opacity-70 hover:opacity-100",
            )}
          >
            {e.rotulo}
          </button>
        ))}
      </div>

      {perdendo && (
        <div className="mb-3 flex flex-col gap-2 rounded-bloco bg-erro-suave/60 p-3">
          <p className="text-xs font-semibold text-erro">Por que não fechou? Ajuda a entender o funil depois.</p>
          <input className={cx(campo, "border-linha bg-superficie")} placeholder="Ex.: achou caro, fechou com outra agência, sumiu…" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Botao pequeno variante="fantasma" onClick={() => setPerdendo(false)}>
              Cancelar
            </Botao>
            <Botao
              pequeno
              variante="perigo"
              onClick={() => {
                set({ ...moverLead(l, "perdido"), motivoPerda: motivo.trim() });
                setPerdendo(false);
                setMotivo("");
              }}
            >
              Marcar como perdido
            </Botao>
          </div>
        </div>
      )}
      {l.etapa === "perdido" && l.motivoPerda && <p className="mb-3 text-xs text-erro">Motivo: {l.motivoPerda}</p>}

      <div className="grid gap-x-8 md:grid-cols-2">
        <div>
          <Linha icone={User} rotulo="Contato">
            <Texto rotulo="Pessoa de contato" valor={l.contato} aoSalvar={(v) => set({ contato: v })} placeholder="quem fala pelo cliente" />
          </Linha>
          <Linha icone={Phone} rotulo="Telefone">
            <Texto rotulo="Telefone" valor={l.telefone} aoSalvar={(v) => set({ telefone: v })} />
          </Linha>
          <Linha icone={Camera} rotulo="Instagram">
            <Texto rotulo="Instagram" valor={l.instagram} aoSalvar={(v) => set({ instagram: v })} placeholder="@perfil" />
          </Linha>
          <Linha icone={Mail} rotulo="E-mail">
            <Texto rotulo="E-mail" valor={l.email} aoSalvar={(v) => set({ email: v })} />
          </Linha>
          <Linha icone={AtSign} rotulo="Como chegou">
            <Texto rotulo="Origem" valor={l.origem} aoSalvar={(v) => set({ origem: v })} placeholder="indicação, Instagram…" />
          </Linha>
        </div>
        <div>
          <Linha icone={User} rotulo="Responsável">
            <div className="flex items-center gap-1.5">
              {resp && <Avatar nome={resp.nome} foto={resp.fotoUrl} tamanho="sm" />}
              <select className={campo} aria-label="Responsável" value={l.responsavelId ?? ""} onChange={(e) => set({ responsavelId: e.target.value || null })}>
                <option value="">Vazio</option>
                {config.pessoas
                  .filter((p) => p.ativo)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
              </select>
            </div>
          </Linha>
          <Linha icone={CalendarClock} rotulo="Próximo contato">
            <input
              type="date"
              aria-label="Próximo contato"
              className={cx(campo, l.proximoContato && l.proximoContato < hoje && "font-semibold text-erro")}
              value={l.proximoContato ?? ""}
              onChange={(e) => set({ proximoContato: e.target.value || null })}
            />
          </Linha>
          <Linha icone={ArrowRight} rotulo="O que fazer">
            <Texto rotulo="Próxima ação" valor={l.proximaAcao} aoSalvar={(v) => set({ proximaAcao: v })} placeholder="ex.: mandar proposta" />
          </Linha>
          <Linha icone={Package} rotulo="Pacote">
            <select
              className={campo}
              aria-label="Pacote de interesse"
              value={l.pacoteId ?? ""}
              onChange={(e) => {
                const p = pacotes.find((x) => x.id === e.target.value);
                const preco = p ? precoDoPacote(config, p).mensalCentavos : null;
                // valor estimado acompanha o pacote quando ainda estava vazio
                set({ pacoteId: p?.id ?? null, valorEstimadoCentavos: l.valorEstimadoCentavos ?? preco });
              }}
            >
              <option value="">Nenhum</option>
              {pacotes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </Linha>
          <Linha icone={Calculator} rotulo="Proposta">
            <select className={campo} aria-label="Simulação ligada" value={l.simulacaoId ?? ""} onChange={(e) => set({ simulacaoId: e.target.value || null })}>
              <option value="">Nenhuma</option>
              {simulacoes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
          </Linha>
        </div>
      </div>

      <div className="mt-3 grid items-end gap-3 rounded-bloco bg-marca-tinta p-3 sm:grid-cols-[14rem_1fr]">
        <CampoMoeda rotulo="Valor estimado por mês" valor={l.valorEstimadoCentavos} aoMudar={(v) => set({ valorEstimadoCentavos: v })} />
        <div className="flex flex-wrap items-center gap-3 pb-2 text-xs">
          {precoPacote != null && l.valorEstimadoCentavos !== precoPacote && (
            <button type="button" className="font-semibold text-marca-forte underline" onClick={() => set({ valorEstimadoCentavos: precoPacote })}>
              Usar o valor do pacote ({formatarMoeda(precoPacote)})
            </button>
          )}
          <Link href={`/negociacao?cliente=${encodeURIComponent(l.nome)}`} className="inline-flex items-center gap-1 font-semibold text-marca-forte underline">
            <Presentation size={13} /> Abrir a negociação
          </Link>
          {l.simulacaoId && (
            <Link href={`/calculadora?sim=${l.simulacaoId}`} className="inline-flex items-center gap-1 font-semibold text-marca-forte underline">
              <Calculator size={13} /> Ver a proposta na calculadora
            </Link>
          )}
        </div>
      </div>

      <label className="mt-4 flex flex-col gap-1 text-xs font-semibold text-texto-suave">
        Observações
        <textarea
          className="min-h-16 rounded-campo border border-linha bg-superficie px-3 py-2 text-sm font-normal text-texto focus:border-marca focus:outline-none"
          defaultValue={l.observacoes}
          key={l.id}
          placeholder="O que o cliente precisa, condições combinadas…"
          onBlur={(e) => e.target.value !== l.observacoes && set({ observacoes: e.target.value })}
        />
      </label>

      <div className="mt-4">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-texto-suave">
          <MessageCircle size={13} /> Histórico da conversa
        </p>
        <div className="mb-3 flex flex-col gap-2 rounded-bloco border border-linha p-2 sm:flex-row">
          <select className={cx(campo, "sm:w-32")} aria-label="Tipo" value={tipoNota} onChange={(e) => setTipoNota(e.target.value as TipoInteracao)}>
            {TIPOS_INTERACAO.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.rotulo}
              </option>
            ))}
          </select>
          <input
            className={cx(campo, "flex-1")}
            placeholder="O que foi conversado? (Enter)"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void registrar()}
          />
        </div>
        {interacoes.length === 0 ? (
          <p className="text-xs text-texto-suave">Nada registrado ainda.</p>
        ) : (
          <ol className="flex flex-col gap-2 border-l-2 border-linha pl-3">
            {interacoes.map((i) => (
              <li key={i.id} className="text-[13px]">
                <p className="text-[11px] text-texto-suave">
                  <strong className="text-texto">{TIPOS_INTERACAO.find((t) => t.valor === i.tipo)?.rotulo}</strong> ·{" "}
                  {new Date(i.em).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  {i.autorNome && ` · ${i.autorNome}`}
                </p>
                <p className="whitespace-pre-wrap">{i.texto}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
      {l.etapa === "ganho" && !l.clienteId && (
        <p className="mt-4 flex items-center gap-2 rounded-bloco bg-ok-suave px-3 py-2 text-xs text-ok">
          <CheckCircle2 size={14} /> Ganho! Clique em &quot;Fechou! Virar cliente&quot; para criar a ficha do cliente.
        </p>
      )}
    </Modal>
  );
}
