"use client";

// Contexto do cliente (Fase 4): a memória do que já se sabe dele. Decisões, preferências, pendências e notas,
// com quem anotou. Nada se apaga: o que não vale mais é marcado como resolvido e sai da lista principal.

import { Check, CheckCircle2, Plus, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge, Botao, Selecao, type Tom } from "../ui";
import { useDados } from "@/lib/dados/contexto";
import type { NotaContexto, TipoContexto } from "@/lib/dados/repositorio";

export const TIPOS_CONTEXTO: { valor: TipoContexto; rotulo: string; tom: Tom; ajuda: string }[] = [
  { valor: "decisao", rotulo: "Decisão", tom: "marca", ajuda: "algo que ficou decidido" },
  { valor: "preferencia", rotulo: "Preferência", tom: "info", ajuda: "como o cliente gosta" },
  { valor: "pendencia", rotulo: "Pendência", tom: "aviso", ajuda: "algo esperando alguém" },
  { valor: "nota", rotulo: "Nota", tom: "neutro", ajuda: "o resto que vale lembrar" },
];
const tipoDe = (t: TipoContexto) => TIPOS_CONTEXTO.find((x) => x.valor === t) ?? TIPOS_CONTEXTO[3];
const quando = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

export function ContextoCliente({ clienteId }: { clienteId: string }) {
  const { repo } = useDados();
  const [notas, setNotas] = useState<NotaContexto[]>([]);
  const [verResolvidas, setVerResolvidas] = useState(false);
  const [tipo, setTipo] = useState<TipoContexto>("nota");
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => setNotas(await repo.listarContexto(clienteId, true)), [repo, clienteId]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lista vinda do banco
    void carregar().catch((e) => setErro(e instanceof Error ? e.message : "Não deu para carregar."));
  }, [carregar]);

  const ativas = notas.filter((n) => !n.resolvidoEm);
  const resolvidas = notas.filter((n) => n.resolvidoEm);

  const anotar = async () => {
    if (!texto.trim()) return;
    setErro(null);
    try {
      await repo.anotarContexto({ clienteId, tipo, texto });
      setTexto("");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para anotar.");
    }
  };

  const resolver = async (n: NotaContexto, resolvida: boolean) => {
    try {
      await repo.resolverContexto(n.id, resolvida);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para mudar.");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12px] text-texto-suave">
        O que já se sabe deste cliente, para ninguém (nem o Claude) precisar perguntar de novo. Cada anotação guarda quem anotou. Nada se apaga: o que não vale
        mais é marcado como resolvido e sai desta lista. Só os sócios veem.
      </p>

      <div className="flex flex-col gap-2 rounded-bloco border border-linha p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Selecao
            rotulo="Tipo"
            className="min-w-60"
            valor={tipo}
            aoMudar={(v) => v && setTipo(v as TipoContexto)}
            opcoes={TIPOS_CONTEXTO.map((t) => ({ valor: t.valor, rotulo: `${t.rotulo}: ${t.ajuda}` }))}
          />
        </div>
        <textarea
          className="min-h-20 w-full rounded-campo border border-linha bg-superficie px-3 py-2 text-sm outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
          placeholder="Ex.: a Regi aprova, a Paula só opina."
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <div>
          <Botao pequeno icone={Plus} onClick={() => void anotar()} disabled={!texto.trim()}>
            Anotar
          </Botao>
        </div>
      </div>
      {erro && <p className="text-xs font-semibold text-erro">{erro}</p>}

      {ativas.length === 0 ? (
        <p className="py-3 text-center text-xs text-texto-suave">Nada anotado ainda.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {ativas.map((n) => (
            <Linha key={n.id} n={n}>
              <Botao pequeno icone={Check} onClick={() => void resolver(n, true)}>
                Resolvido
              </Botao>
            </Linha>
          ))}
        </div>
      )}

      {resolvidas.length > 0 && (
        <div>
          <button type="button" className="text-xs font-semibold text-texto-suave underline" onClick={() => setVerResolvidas((v) => !v)}>
            {verResolvidas ? "Esconder resolvidas" : `Ver resolvidas (${resolvidas.length})`}
          </button>
          {verResolvidas && (
            <div className="mt-2 flex flex-col gap-1.5 opacity-70">
              {resolvidas.map((n) => (
                <Linha key={n.id} n={n}>
                  <Botao pequeno icone={RotateCcw} onClick={() => void resolver(n, false)}>
                    Voltar
                  </Botao>
                </Linha>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Linha({ n, children }: { n: NotaContexto; children: React.ReactNode }) {
  const t = tipoDe(n.tipo);
  return (
    <div className="flex flex-wrap items-start gap-2 rounded-item bg-superficie-2/60 px-3 py-2 text-[13px]">
      <Badge tom={t.tom}>{t.rotulo}</Badge>
      <div className="min-w-0 flex-1">
        <p className="whitespace-pre-wrap">{n.texto}</p>
        <p className="mt-0.5 text-[12px] text-texto-suave">
          {n.autorNome ?? "sem autor"} · {quando(n.criadoEm)}
          {n.resolvidoEm && (
            <span className="ml-1 inline-flex items-center gap-1">
              <CheckCircle2 size={12} /> resolvida por {n.resolvidoPorNome ?? "?"} em {quando(n.resolvidoEm)}
            </span>
          )}
        </p>
      </div>
      {children}
    </div>
  );
}
