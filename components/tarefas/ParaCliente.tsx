"use client";

// Parte da tarefa que vai para o cliente: mostrar no painel, legenda, artes, enviar
// para aprovação e as respostas dele (aprovou / pediu ajuste, rodadas usadas).

import { CheckCircle2, Eye, EyeOff, FileText, ImagePlus, Loader2, MessageSquareWarning, Send, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { Badge, Botao, cx } from "../ui";
import { aprovarAte } from "@/lib/calculo/painel";
import { situacaoPeca, type Tarefa } from "@/lib/calculo/tarefas";
import type { AcoesTarefas } from "./useTarefas";

const dataBr = (iso: string | null | undefined) => (iso ? new Date(iso.length > 10 ? iso : `${iso}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "");

export function ParaCliente({ t, a }: { t: Tarefa; a: AcoesTarefas }) {
  const entrada = useRef<HTMLInputElement>(null);
  const [subindo, setSubindo] = useState(false);
  const cliente = a.config.clientes.find((c) => c.id === t.clienteId);
  if (!cliente) return null;
  const sit = situacaoPeca(t);
  const limite = cliente.contrato?.limiteRodadas ?? null;
  const rodadas = t.rodadas ?? 0;
  const prazo = sit === "aguardando" ? aprovarAte(t.enviadaClienteEm ?? null, cliente.contrato?.prazoAprovacaoDias ?? null) : null;
  const arquivos = t.arquivos ?? [];

  return (
    <div className={cx("mt-4 rounded-bloco border p-3", t.visivelCliente ? "border-marca/40 bg-marca-tinta/40" : "border-dashed border-linha")}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex-1 text-xs font-bold">Para o cliente ({cliente.nome})</p>
        {t.visivelCliente && (
          <Badge tom={sit === "aprovada" ? "ok" : sit === "ajuste" ? "erro" : sit === "aguardando" ? "aviso" : "neutro"}>
            {sit === "aprovada" ? "aprovada pelo cliente" : sit === "ajuste" ? "cliente pediu ajuste" : sit === "aguardando" ? "esperando o cliente" : sit === "entregue" ? "entregue" : "em produção"}
          </Badge>
        )}
        <button
          type="button"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-texto-suave hover:text-texto"
          onClick={() => void a.salvar({ ...t, visivelCliente: !t.visivelCliente })}
        >
          {t.visivelCliente ? <Eye size={13} /> : <EyeOff size={13} />}
          {t.visivelCliente ? "aparece no painel do cliente" : "não aparece para o cliente"}
        </button>
      </div>

      {(t.visivelCliente || arquivos.length > 0 || t.legenda) && (
        <>
          <label className="mt-3 flex flex-col gap-1 text-xs font-semibold text-texto-suave">
            Legenda / texto que o cliente vai ler
            <textarea
              key={`${t.id}-leg`}
              className="min-h-16 rounded-campo border border-linha bg-superficie px-3 py-2 text-sm font-normal text-texto focus:border-marca focus:outline-none"
              defaultValue={t.legenda ?? ""}
              onBlur={(e) => e.target.value !== (t.legenda ?? "") && void a.salvar({ ...t, legenda: e.target.value })}
            />
          </label>

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
                  className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-superficie/90 text-erro opacity-0 group-hover:opacity-100 focus:opacity-100"
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
          {sit === "aprovada" && (
            <p className="mt-3 flex items-center gap-2 rounded-item bg-ok-suave px-3 py-2 text-xs text-ok">
              <CheckCircle2 size={14} /> Aprovada pelo cliente em {dataBr(t.clienteAprovouEm)}. Pode concluir quando publicar.
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {sit !== "aguardando" && sit !== "aprovada" && (
              <Botao pequeno variante="primario" icone={Send} onClick={() => void a.enviarParaCliente(t)}>
                {rodadas > 0 ? "Reenviar para o cliente aprovar" : "Enviar para o cliente aprovar"}
              </Botao>
            )}
            {sit === "aguardando" && <span className="text-[11px] text-texto-suave">Enviada em {dataBr(t.enviadaClienteEm)}{prazo && ` · aprovar até ${dataBr(prazo)}`}</span>}
            {(rodadas > 0 || limite != null) && (
              <span className={cx("text-[11px]", limite != null && rodadas > limite ? "font-semibold text-erro" : "text-texto-suave")}>
                {rodadas} ajuste{rodadas === 1 ? "" : "s"}
                {limite != null && ` de ${limite} combinado${limite === 1 ? "" : "s"}`}
                {limite != null && rodadas > limite && " (passou do contrato)"}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
