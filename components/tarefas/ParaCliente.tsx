"use client";

// Parte da tarefa que vai para o cliente: mostrar no painel, legenda, artes, enviar
// para aprovação e as respostas dele (aprovou / pediu ajuste, rodadas usadas).

import { CalendarClock, CheckCircle2, Eye, EyeOff, FileText, ImagePlus, Loader2, MessageCircle, MessageSquareWarning, Megaphone, Send, Trash2, Undo2 } from "lucide-react";
import { useRef, useState } from "react";
import { Badge, Botao, cx } from "../ui";
import { aprovarAte } from "@/lib/calculo/painel";
import { linkWhatsapp, mensagemPecaNoPainel } from "@/lib/calculo/avisoCliente";
import { ehPeca, ROTULO_PECA, situacaoPeca, type Tarefa } from "@/lib/calculo/tarefas";
import { semDiaDaPostagem } from "@/lib/regras/prazoPostagem";
import { AprovadoFora } from "./AprovadoFora";
import type { AcoesTarefas } from "./useTarefas";

/** ISO → valor do campo datetime-local, na hora local */
const paraCampo = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

const dataBr = (iso: string | null | undefined) => (iso ? new Date(iso.length > 10 ? iso : `${iso}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "");

export function ParaCliente({ t, a }: { t: Tarefa; a: AcoesTarefas }) {
  const entrada = useRef<HTMLInputElement>(null);
  const [subindo, setSubindo] = useState(false);
  const [aberto, setAberto] = useState(false);
  const cliente = a.config.clientes.find((c) => c.id === t.clienteId);
  if (!cliente) return null;
  // sem painel (a própria Aden, painel desligado ou cliente ainda sem link): só legenda, artes e publicação,
  // e "agendada" não espera aprovação
  const interno = !a.passa(t);
  const sit = situacaoPeca(t, !interno);
  const limite = cliente.contrato?.limiteRodadas ?? null;
  const rodadas = t.rodadas ?? 0;
  const prazo = sit === "aguardando" ? aprovarAte(t.enviadaClienteEm ?? null, cliente.contrato?.prazoAprovacaoDias ?? null) : null;
  const arquivos = t.arquivos ?? [];
  // peça de calendário sem o dia da postagem: avisa e não deixa enviar para o cliente
  const faltaDia = semDiaDaPostagem(t);
  // M12: tarefa de um calendário do planejamento já é peça: o bloco abre sozinho
  const ehPecaAberta = aberto || ehPeca(t);
  // com painel, a peça passa pela aprovação do cliente antes de agendar ou publicar
  const semAprovar = !interno && !t.clienteAprovouEm;
  const confirmarSemAprovar = (acao: string) =>
    !semAprovar || confirm(`${cliente.nome} ainda não aprovou esta peça pelo painel. ${acao} mesmo assim? (Use se a aprovação veio por outro caminho.)`);

  if (!ehPecaAberta)
    return (
      <Botao className="mt-4" pequeno icone={Megaphone} onClick={() => setAberto(true)}>
        É uma peça de conteúdo: pôr legenda, arte e o dia de ir ao ar
      </Botao>
    );

  return (
    <div className={cx("mt-4 rounded-bloco border p-3", t.visivelCliente ? "border-marca/40 bg-marca-tinta/40" : "border-dashed border-linha")}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex-1 text-xs font-bold">{cliente.interno ? "Peça da própria Aden" : interno ? `Peça de ${cliente.nome}` : `Para o cliente (${cliente.nome})`}</p>
        {(t.visivelCliente || interno) && (
          <Badge tom={sit === "aprovada" || sit === "agendada" || sit === "publicada" ? "ok" : sit === "ajuste" ? "erro" : sit === "aguardando" ? "aviso" : "neutro"}>
            {sit === "aprovada" ? "aprovada pelo cliente" : sit === "ajuste" ? "cliente pediu ajuste" : sit === "aguardando" ? "esperando o cliente" : ROTULO_PECA[sit]}
          </Badge>
        )}
        {!interno && (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-texto-suave hover:text-texto"
            onClick={() => void a.salvar({ ...t, visivelCliente: !t.visivelCliente })}
          >
            {t.visivelCliente ? <Eye size={13} /> : <EyeOff size={13} />}
            {t.visivelCliente ? "aparece no painel do cliente" : "não aparece para o cliente"}
          </button>
        )}
      </div>

        <label className="mt-3 flex flex-col gap-1 text-xs font-semibold text-texto-suave">
          Texto da arte (o que vai escrito dentro dela; o cliente lê antes da legenda)
          <textarea
            key={`${t.id}-arte`}
            className="min-h-12 rounded-campo border border-linha bg-superficie px-3 py-2 text-sm font-normal text-texto focus:border-marca focus:outline-none"
            defaultValue={t.textoArte ?? ""}
            onBlur={(e) => e.target.value !== (t.textoArte ?? "") && void a.salvar({ ...t, textoArte: e.target.value })}
          />
        </label>
        <label className="mt-3 flex flex-col gap-1 text-xs font-semibold text-texto-suave">
          Legenda / texto que o cliente vai ler
          <textarea
            key={`${t.id}-leg`}
            className="min-h-16 rounded-campo border border-linha bg-superficie px-3 py-2 text-sm font-normal text-texto focus:border-marca focus:outline-none"
            defaultValue={t.legenda ?? ""}
            onBlur={(e) => e.target.value !== (t.legenda ?? "") && void a.salvar({ ...t, legenda: e.target.value })}
          />
        </label>

        {faltaDia && (
          <p className="mt-3 flex items-start gap-2 rounded-item bg-erro-suave px-3 py-2 text-xs text-erro">
            <CalendarClock size={14} className="mt-px shrink-0" />
            <span>
              <strong>Falta o dia da postagem.</strong> Preencha &quot;Vai ao ar em&quot; (logo abaixo). O prazo da tarefa vira 1 dia antes dele, e a peça só vai para o cliente com o dia preenchido.
            </span>
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {arquivos.map((f, i) => (
            <div key={f.url} className="group relative size-20 overflow-hidden rounded-item border border-linha bg-superficie-2">
              {f.tipo.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element -- arte da peça, vinda do Storage
                <img src={f.url} alt={f.nome} className="size-full object-cover" />
              ) : (
                <a href={f.url} target="_blank" rel="noreferrer" className="flex size-full flex-col items-center justify-center gap-1 p-1 text-center text-[9px]">
                  <FileText size={18} /> {f.nome}
                </a>
              )}
              <button
                type="button"
                aria-label={`Tirar ${f.nome}`}
                className="absolute top-1 right-1 flex size-7 items-center justify-center rounded-full bg-superficie/90 text-erro opacity-0 group-hover:opacity-100 focus:opacity-100 pointer-coarse:size-11 pointer-coarse:opacity-100"
                onClick={() => void a.salvar({ ...t, arquivos: arquivos.filter((_, j) => j !== i) })}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => entrada.current?.click()}
            disabled={subindo}
            className="flex size-20 flex-col items-center justify-center gap-1 rounded-item border border-dashed border-linha text-[10px] font-semibold text-texto-suave hover:border-marca hover:text-marca-forte"
          >
            {subindo ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
            {subindo ? "enviando" : "arte"}
          </button>
          <input
            ref={entrada}
            type="file"
            multiple
            accept="image/*,application/pdf"
            className="hidden"
            onChange={async (e) => {
              const fs = Array.from(e.target.files ?? []);
              e.target.value = "";
              if (!fs.length) return;
              setSubindo(true);
              await a.anexarArquivos(t, fs);
              setSubindo(false);
            }}
          />
        </div>

        {sit === "ajuste" && t.feedbackCliente && (
          <p className="mt-3 flex items-start gap-2 rounded-item bg-erro-suave px-3 py-2 text-xs text-erro">
            <MessageSquareWarning size={14} className="mt-px shrink-0" />
            <span>
              <strong>O cliente pediu:</strong> {t.feedbackCliente} <span className="opacity-70">({dataBr(t.feedbackEm)})</span>
            </span>
          </p>
        )}
        {(sit === "aprovada" || sit === "agendada") && t.clienteAprovouEm && (
          <p className="mt-3 flex items-center gap-2 rounded-item bg-ok-suave px-3 py-2 text-xs text-ok">
            <CheckCircle2 size={14} /> Aprovada pelo cliente em {dataBr(t.clienteAprovouEm)}. {sit === "agendada" ? "Já está programada." : "Quando programar o post, marque como agendada."}
          </p>
        )}

        {/* planejamento: rede e calendário (internos, o cliente não vê); recolhido, abre sozinho se já tem dado */}
        <details className="mt-3" open={!!(t.rede || t.lote)}>
          <summary className="flex min-h-9 cursor-pointer items-center text-xs font-semibold text-texto-suave hover:text-texto">Dados internos do planejamento (rede e calendário)</summary>
          <div className="flex flex-wrap items-end gap-3">
            {(
              [
                ["rede", "Rede (interno)", "ex.: instagram"],
                ["lote", "Calendário do planejamento (interno)", "ex.: Calendário Outubro — Olinda"],
              ] as const
            ).map(([k, rotulo, dica]) => (
              <label key={k} className="flex min-w-40 flex-1 flex-col gap-1 text-xs font-semibold text-texto-suave">
                {rotulo}
                <input
                  key={`${t.id}-${k}-${t[k] ?? ""}`}
                  className="h-9 rounded-campo border border-linha bg-superficie px-2 text-sm font-normal text-texto focus:border-marca focus:outline-none"
                  placeholder={dica}
                  defaultValue={t[k] ?? ""}
                  onBlur={(e) => e.target.value.trim() !== (t[k] ?? "") && void a.salvar({ ...t, [k]: e.target.value.trim() || null })}
                />
              </label>
            ))}
          </div>
        </details>

        {/* publicação: quando vai ao ar e quando foi */}
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-semibold text-texto-suave">
            <span className={cx("inline-flex items-center gap-1", faltaDia && "text-erro")}>
              <CalendarClock size={13} /> Vai ao ar em{faltaDia && " (falta preencher)"}
            </span>
            <input
              key={`${t.id}-pub-${t.publicarEm ?? ""}`}
              type="datetime-local"
              className="h-9 rounded-campo border border-linha bg-superficie px-2 text-sm font-normal text-texto focus:border-marca focus:outline-none"
              defaultValue={paraCampo(t.publicarEm)}
              onBlur={(e) => {
                const v = e.target.value ? new Date(e.target.value).toISOString() : null;
                if (v !== (t.publicarEm ?? null)) void a.salvar({ ...t, publicarEm: v });
              }}
            />
          </label>
          {t.publicadaEm ? (
            <>
              <span className="pb-2 text-[12px] font-semibold text-ok">Foi ao ar em {dataBr(t.publicadaEm)}.</span>
              <Botao pequeno icone={Undo2} onClick={() => void a.marcarPublicada(t, false)}>
                Desfazer
              </Botao>
            </>
          ) : (
            <>
              {/* sem aprovação, "agendada" não muda a etapa: o caminho é registrar a aprovação de fora (já agenda) */}
              {semAprovar ? (
                <AprovadoFora pecas={[t]} a={a} />
              ) : (
                <Botao
                  pequeno
                  icone={CalendarClock}
                  variante={t.agendadaEm ? "primario" : undefined}
                  onClick={() => void (t.agendadaEm ? a.salvar({ ...t, agendadaEm: null }) : a.etapa(t, "agendada"))}
                >
                  {t.agendadaEm ? "Agendada (desfazer)" : "Marcar como agendada"}
                </Botao>
              )}
              <Botao pequeno icone={Megaphone} onClick={() => confirmarSemAprovar("Marcar como publicada") && void a.marcarPublicada(t, true)}>
                Marcar como publicada
              </Botao>
            </>
          )}
        </div>
        {t.aprovadaForaOnde && t.clienteAprovouEm && (
          <p className="mt-2 text-[12px] font-semibold text-ok">
            Aprovado em {dataBr(t.clienteAprovouEm)} pelo {t.aprovadaForaOnde}
            {t.aprovadaForaPor ? ` (registrado por ${t.aprovadaForaPor})` : ""}.
          </p>
        )}
        <p className="mt-1 text-[12px] text-texto-suave">
          {interno ? "Agendada é quando o post já está programado. Publicada conclui a tarefa." : "Agendada é quando o post aprovado já está programado. Publicada conclui a tarefa."}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {!interno && (sit === "planejado" || sit === "producao" || sit === "ajuste") && (
            <Botao pequeno variante="primario" icone={Send} disabled={faltaDia} title={faltaDia ? "Preencha o dia da postagem (Vai ao ar em) primeiro" : undefined} onClick={() => void a.enviarParaCliente(t)}>
              {rodadas > 0 ? "Reenviar para o cliente aprovar" : "Enviar para o cliente aprovar"}
            </Botao>
          )}
          {sit === "aguardando" && <span className="text-[12px] text-texto-suave">Enviada em {dataBr(t.enviadaClienteEm)}{prazo && ` · aprovar até ${dataBr(prazo)}`}</span>}
          {/* M13: avisar o cliente de que tem peça esperando (o sócio manda pelo WhatsApp de sempre) */}
          {sit === "aguardando" && cliente.painelToken && (
            <a
              href={linkWhatsapp(cliente.telefone, mensagemPecaNoPainel(cliente.contato, `${window.location.origin}/c/${cliente.painelToken}`))}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-botao border border-linha bg-superficie px-3 text-xs font-semibold hover:bg-superficie-2"
              title={cliente.telefone ? "Abre o WhatsApp com a mensagem pronta" : "Sem telefone na ficha: o WhatsApp abre para escolher o contato"}
            >
              <MessageCircle size={14} /> Avisar no WhatsApp
            </a>
          )}
          {(rodadas > 0 || limite != null) && (
            <span className={cx("text-[11px]", limite != null && rodadas > limite ? "font-semibold text-erro" : "text-texto-suave")}>
              {rodadas} ajuste{rodadas === 1 ? "" : "s"}
              {limite != null && ` de ${limite} combinado${limite === 1 ? "" : "s"}`}
              {limite != null && rodadas > limite && " (passou do contrato)"}
            </span>
          )}
        </div>
    </div>
  );
}
