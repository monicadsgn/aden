"use client";

// Contrato do cliente (Fase 5, passo 3): mostra o texto montado com a ficha e o modelo de Configurações, diz o que
// falta, manda para assinatura pela Autentique e confere quem já assinou. Assinado por todos → o passo "Contrato
// assinado" do fechamento é marcado sozinho. Ao abrir a aba, confere sozinho o que estiver esperando assinatura.

import { FileSignature, RefreshCw, Send } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge, Botao } from "../ui";
import { montarContrato, type ContratoEnviado, type DocumentoContrato } from "@/lib/calculo/contrato";
import type { Configuracao } from "@/lib/calculo/tipos";
import { useDados } from "@/lib/dados/contexto";

const quando = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
const ROTULO = { enviado: "esperando assinatura", assinado: "assinado", recusado: "recusado", cancelado: "substituído" } as const;
const TOM = { enviado: "aviso", assinado: "ok", recusado: "erro", cancelado: "neutro" } as const;

export function ContratoCliente({ config, clienteId }: { config: Configuracao; clienteId: string }) {
  const { repo } = useDados();
  const [doc, setDoc] = useState<DocumentoContrato | null>(null);
  const [enviados, setEnviados] = useState<ContratoEnviado[]>([]);
  const [ligada, setLigada] = useState<{ sim: boolean; teste?: boolean } | null>(null);
  const [msg, setMsg] = useState<{ texto: string; erro?: boolean } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const conferiu = useRef(false);

  const carregar = useCallback(async () => {
    const [modelo, lista] = await Promise.all([repo.obterModeloContrato(), repo.listarContratosAssinatura(clienteId)]);
    setDoc(montarContrato(config, clienteId, modelo));
    setEnviados(lista);
    return lista;
  }, [repo, config, clienteId]);

  const pedir = useCallback(
    async (acao: "enviar" | "conferir", reenviar?: boolean) => {
      setOcupado(true);
      setMsg(null);
      try {
        const r = await repo.contratoNoServidor({ acao, clienteId, reenviar });
        setMsg(r.mensagem ? { texto: r.mensagem } : null);
      } catch (e) {
        setMsg({ texto: e instanceof Error ? e.message : "Não deu certo.", erro: true });
      } finally {
        setOcupado(false);
        await carregar().catch(() => undefined);
      }
    },
    [repo, clienteId, carregar],
  );

  useEffect(() => {
    void (async () => {
      const lista = await carregar();
      const s = await repo.contratoNoServidor({ acao: "situacao" }).catch(() => ({ autentiqueLigada: false, teste: false }));
      setLigada({ sim: s.autentiqueLigada, teste: s.teste });
      // confere sozinho uma vez ao abrir, se houver contrato esperando assinatura
      if (s.autentiqueLigada && !conferiu.current && lista.some((c) => c.situacao === "enviado")) {
        conferiu.current = true;
        await pedir("conferir");
      }
    })().catch((e) => setMsg({ texto: e instanceof Error ? e.message : "Não deu para carregar.", erro: true }));
  }, [carregar, repo, pedir]);

  if (!doc) return null;
  const aberto = enviados.find((c) => c.situacao === "enviado");
  const assinado = enviados.find((c) => c.situacao === "assinado");
  const pronto = doc.faltando.length === 0;

  return (
    <div className="flex flex-col gap-2 rounded-bloco border border-linha p-3">
      <div className="flex flex-wrap items-center gap-2">
        <FileSignature size={15} className="text-marca-forte" />
        <strong className="text-sm">Contrato</strong>
        {assinado ? (
          <Badge tom="ok">assinado em {quando(assinado.assinadoEm ?? assinado.enviadoEm)}</Badge>
        ) : aberto ? (
          <Badge tom="aviso">esperando assinatura</Badge>
        ) : pronto ? (
          <Badge tom="marca">pronto para enviar</Badge>
        ) : (
          <Badge tom="aviso">falta preencher {doc.faltando.length}</Badge>
        )}
        {ligada?.teste && <Badge>Autentique em modo teste</Badge>}
      </div>
      <p className="text-[12px] text-texto-suave">
        O contrato sai da ficha (partes, o que está incluso, valor, prazo e condições) e do modelo em{" "}
        <Link href="/configuracoes?secao=contrato" className="font-semibold text-marca-forte underline">
          Configurações → Contrato
        </Link>{" "}
        (obrigações, disposições e quem assina). A Autentique manda por e-mail para o cliente e para quem assina pela Aden.
      </p>

      {!pronto && (
        <ul className="list-disc pl-5 text-[12px] text-texto-suave">
          {doc.faltando.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      )}

      <details className="rounded-item bg-superficie-2/60 px-3 py-2 text-[13px]">
        <summary className="cursor-pointer font-semibold">Ver o texto do contrato</summary>
        <div className="mt-2 flex flex-col gap-3">
          <p className="font-bold">{doc.titulo}</p>
          {doc.secoes.map((s, i) => (
            <div key={s.titulo}>
              <p className="font-semibold">
                {i + 1}. {s.titulo}
              </p>
              {s.itens?.map((it) => (
                <p key={it.rotulo} className="pl-3">
                  {it.rotulo}: {it.valor}
                </p>
              ))}
              {s.paragrafos?.map((p, j) => (
                <p key={j} className="pl-3 pt-1">
                  {p}
                </p>
              ))}
            </div>
          ))}
          <p className="text-texto-suave">Assinam: {doc.signatarios.map((s) => `${s.nome} (${s.email})`).join(", ") || "—"}</p>
        </div>
      </details>

      <div className="flex flex-wrap items-center gap-2">
        {!aberto && (
          <Botao
            pequeno
            variante="primario"
            icone={Send}
            disabled={!pronto || !ligada?.sim || ocupado}
            onClick={() => confirm(`Mandar o contrato para ${doc.signatarios.map((s) => s.email).join(", ")} assinar?`) && void pedir("enviar")}
          >
            {assinado ? "Enviar um contrato novo" : "Enviar para assinatura"}
          </Botao>
        )}
        {aberto && (
          <>
            <Botao pequeno icone={RefreshCw} disabled={ocupado || !ligada?.sim} onClick={() => void pedir("conferir")}>
              Conferir assinatura
            </Botao>
            <Botao
              pequeno
              variante="fantasma"
              disabled={!pronto || ocupado || !ligada?.sim}
              onClick={() => confirm("Mandar um contrato novo no lugar do que está esperando assinatura? O anterior fica como substituído aqui (cancele também na Autentique).") && void pedir("enviar", true)}
            >
              Reenviar com os dados atuais
            </Botao>
          </>
        )}
        {ligada && !ligada.sim && <span className="text-[12px] text-texto-suave">A Autentique ainda não está ligada (falta a chave na Vercel).</span>}
      </div>
      {msg && <p className={`text-xs ${msg.erro ? "font-semibold text-erro" : "text-texto-suave"}`}>{msg.texto}</p>}

      {enviados.length > 0 && (
        <ul className="flex flex-col gap-1 text-[12px] text-texto-suave">
          {enviados.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-2">
              <Badge tom={TOM[c.situacao]}>{ROTULO[c.situacao]}</Badge>
              enviado em {quando(c.enviadoEm)} por {c.enviadoPorNome ?? "?"}
              {c.situacao === "enviado" && c.faltam.length > 0 && <span>· falta: {c.faltam.join(", ")}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
