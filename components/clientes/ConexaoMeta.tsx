"use client";

// Cartão "Instagram e Facebook" na ficha do cliente (só sócios). Etapa 1: só leitura.
// Mostra o estado da conexão, confere com a Meta pelo servidor (o token nunca chega ao navegador),
// deixa escolher qual Página é do cliente e dá o passo a passo pronto para mandar a ele.
// Nada aqui publica, liga métricas ou mexe na conta do cliente.

import { Check, Copy, Pause, Play, PlugZap, RefreshCw, Send, Share2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge, Botao, type Tom } from "../ui";
import { useDados } from "@/lib/dados/contexto";
import {
  conexaoVazia,
  EXPLICA_STATUS_META,
  ROTULO_STATUS_META,
  type ConexaoMeta as Conexao,
  type ContaMeta,
  type RespostaPublicarMeta,
  type RespostaStatusMeta,
  type StatusConexaoMeta,
} from "@/lib/meta/estado";

const TOM: Record<StatusConexaoMeta, Tom> = { nao_conectado: "neutro", conectando: "aviso", conectado: "ok", com_problema: "erro", pausado: "neutro" };
const quando = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

export function ConexaoMeta({ clienteId }: { clienteId: string }) {
  const { repo } = useDados();
  const [conexao, setConexao] = useState<Conexao | null>(null);
  const [resposta, setResposta] = useState<RespostaStatusMeta | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [imagens, setImagens] = useState("");
  const [legenda, setLegenda] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [previa, setPrevia] = useState<RespostaPublicarMeta | null>(null);
  const [publicado, setPublicado] = useState<RespostaPublicarMeta | null>(null);

  const carregar = useCallback(async () => setConexao((await repo.obterConexaoMeta(clienteId)) ?? conexaoVazia(clienteId)), [repo, clienteId]);

  useEffect(() => {
    void (async () => {
      await carregar();
    })().catch((e) => setErro(e instanceof Error ? e.message : "Não deu para carregar."));
  }, [carregar]);

  const conferir = async () => {
    setOcupado(true);
    setErro(null);
    try {
      setResposta(await repo.metaNoServidor(clienteId));
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para conferir.");
    } finally {
      setOcupado(false);
    }
  };

  const salvar = async (mudanca: Partial<Conexao>, depoisConferir = true) => {
    if (!conexao) return;
    setOcupado(true);
    setErro(null);
    try {
      await repo.salvarConexaoMeta({ ...conexao, ...mudanca });
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para salvar.");
    } finally {
      setOcupado(false);
    }
    if (depoisConferir) await conferir();
  };

  const listaImagens = () => imagens.split(/\s+/).map((x) => x.trim()).filter(Boolean);
  const publicar = async (dryRun: boolean) => {
    setOcupado(true);
    setErro(null);
    try {
      const r = await repo.metaPublicarNoServidor({ clienteId, imagens: listaImagens(), legenda: legenda.trim() || undefined, dryRun, confirmacao: dryRun ? undefined : confirmacao });
      if (dryRun) {
        setPrevia(r);
        setPublicado(null);
      } else {
        setPublicado(r);
        setPrevia(null);
        setConfirmacao("");
      }
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para publicar.");
    } finally {
      setOcupado(false);
    }
  };

  const escolher = (c: ContaMeta) =>
    void salvar({ paginaId: c.paginaId, paginaNome: c.paginaNome, instagramId: c.instagramId, instagramUsuario: c.instagramUsuario, status: "conectando", ultimoErro: null });

  if (!conexao) return null;
  const ligada = resposta?.ativo === true;
  const cli = ligada ? resposta.cliente : undefined;
  const status = cli?.status ?? conexao.status;
  const motivo = cli ? cli.motivo : conexao.ultimoErro;
  const conferidoEm = cli?.conferidoEm ?? conexao.ultimaConferencia;
  const precisaPassos = status === "conectando" || status === "nao_conectado" || (status === "com_problema" && !!conexao.paginaId);

  return (
    <div className="flex flex-col gap-2 rounded-bloco border border-linha p-3">
      <div className="flex flex-wrap items-center gap-2">
        <PlugZap size={15} className="text-marca-forte" />
        <strong className="text-sm">Instagram e Facebook</strong>
        <Badge tom={TOM[status]}>{ROTULO_STATUS_META[status]}</Badge>
      </div>
      <p className="text-[12px] text-texto-suave">{EXPLICA_STATUS_META[status]}</p>

      {(conexao.paginaNome || conexao.instagramUsuario) && (
        <p className="text-[13px]">
          Página: <strong>{conexao.paginaNome ?? "?"}</strong>
          {" · "}Instagram: <strong>{conexao.instagramUsuario ? `@${conexao.instagramUsuario}` : "nenhum ligado"}</strong>
        </p>
      )}
      {motivo && <p className="rounded-bloco bg-aviso-suave px-3 py-2 text-[12px] text-aviso">{motivo}</p>}
      {erro && <p className="text-xs text-erro">{erro}</p>}

      {resposta?.ativo === false && (
        <p className="rounded-bloco bg-superficie-2/60 px-3 py-2 text-[12px] text-texto-suave">
          {resposta.motivo === "desligado"
            ? "A conexão com a Meta está desligada. Para ligar, um sócio cadastra META_CONEXAO_ATIVA=1 na Vercel e faz um Redeploy."
            : "Falta o acesso da Aden à Meta na Vercel (META_ACCESS_TOKEN). Um sócio cadastra e faz um Redeploy."}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {status !== "pausado" && (
          <Botao pequeno variante="primario" icone={RefreshCw} disabled={ocupado} onClick={() => void conferir()}>
            {ocupado ? "Conferindo…" : "Conferir conexão"}
          </Botao>
        )}
        {status === "pausado" ? (
          <Botao pequeno icone={Play} disabled={ocupado} onClick={() => void salvar({ status: conexao.paginaId ? "conectando" : "nao_conectado" })}>
            Reativar
          </Botao>
        ) : (
          (conexao.paginaId || status !== "nao_conectado") && (
            <Botao pequeno variante="fantasma" icone={Pause} disabled={ocupado} onClick={() => confirm("Pausar a conexão deste cliente? Nada é conferido até reativar.") && void salvar({ status: "pausado" }, false)}>
              Pausar
            </Botao>
          )
        )}
        {conferidoEm && <span className="text-[11px] text-texto-suave">Conferido em {quando(conferidoEm)}</span>}
      </div>

      {ligada && (
        <>
          {cli?.sugestao && cli.sugestao.paginaId !== conexao.paginaId && (
            <div className="flex flex-wrap items-center gap-2 rounded-bloco bg-info-suave px-3 py-2 text-[12px] text-info">
              <span>
                Achamos a Página <strong>{cli.sugestao.paginaNome}</strong> com o @{cli.sugestao.instagramUsuario}, igual ao da ficha.
              </span>
              <Botao pequeno icone={Check} disabled={ocupado} onClick={() => escolher(cli.sugestao!)}>
                É esta
              </Botao>
            </div>
          )}

          <details className="rounded-bloco border border-linha px-3 py-2 text-[12px]">
            <summary className="cursor-pointer font-semibold">Páginas que a Aden enxerga ({resposta.contas.length})</summary>
            {resposta.erroContas && <p className="mt-1 text-erro">{resposta.erroContas}</p>}
            {resposta.contas.length === 0 ? (
              <p className="mt-1 text-texto-suave">Nenhuma ainda. Cada cliente precisa liberar a Página e o Instagram para a Aden.</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-1.5">
                {resposta.contas.map((c) => (
                  <li key={c.paginaId} className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 flex-1">
                      {c.paginaNome} · {c.instagramUsuario ? `@${c.instagramUsuario}` : <em className="text-texto-suave">sem Instagram ligado</em>}
                    </span>
                    {c.paginaId === conexao.paginaId ? (
                      <Badge tom="ok">deste cliente</Badge>
                    ) : (
                      <Botao pequeno variante="fantasma" disabled={ocupado} onClick={() => escolher(c)}>
                        Usar neste cliente
                      </Botao>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </details>

          <details className="rounded-bloco border border-linha px-3 py-2 text-[12px]">
            <summary className="cursor-pointer font-semibold">
              Acesso da Aden: {resposta.token.valido ? "valendo" : "com problema"}
              {resposta.token.expiraEm ? `, vence em ${quando(resposta.token.expiraEm)}` : resposta.token.valido ? ", sem data para vencer" : ""}
            </summary>
            <p className="mt-1 text-texto-suave">O que cada etapa precisa de permissão. Faltando, um sócio gera o acesso de novo com a permissão marcada.</p>
            <ul className="mt-1.5 flex flex-col gap-1">
              {resposta.token.porEtapa.map((e) => (
                <li key={e.etapa}>
                  {e.faltam.length ? "⚠️" : "✅"} {e.rotulo}
                  {e.faltam.length > 0 && <span className="text-texto-suave"> (falta: {e.faltam.join(", ")})</span>}
                </li>
              ))}
            </ul>
          </details>
        </>
      )}

      {status === "conectado" && conexao.instagramUsuario && (
        <div className="flex flex-col gap-2 rounded-bloco border border-linha px-3 py-2 text-[12px]">
          <label className="flex items-center gap-2 font-semibold">
            <input type="checkbox" checked={conexao.publicarAtivo} disabled={ocupado} onChange={(e) => void salvar({ publicarAtivo: e.target.checked }, false)} />
            Permitir publicar no Instagram deste cliente
          </label>
          <p className="text-texto-suave">
            Desligado por padrão. Mesmo ligado aqui, só publica se um sócio também liberar na Vercel (META_PUBLICAR_ATIVO e META_PUBLICAR_CONTAS). Primeiro sempre aparece uma prévia, e você escreve a confirmação.
          </p>
          {conexao.publicarAtivo && (
            <>
              <label className="flex flex-col gap-1">
                Links das imagens (https, terminando em .jpg), um por linha
                <textarea className="rounded-campo border border-linha bg-superficie px-2 py-1.5" rows={3} value={imagens} onChange={(e) => setImagens(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1">
                Legenda
                <textarea className="rounded-campo border border-linha bg-superficie px-2 py-1.5" rows={3} value={legenda} onChange={(e) => setLegenda(e.target.value)} />
              </label>
              <div>
                <Botao pequeno icone={Send} disabled={ocupado || listaImagens().length === 0} onClick={() => void publicar(true)}>
                  Ver prévia (não publica)
                </Botao>
              </div>
              {previa?.ativo === false && <p className="rounded-bloco bg-aviso-suave px-3 py-2 text-aviso">Publicação desligada na Vercel ({previa.motivo}). Nada foi enviado.</p>}
              {previa?.ativo === true && previa.dryRun && (
                <div className="flex flex-col gap-2 rounded-bloco bg-superficie-2/60 px-3 py-2">
                  <p>
                    Prévia: {previa.tipo} com {previa.imagens} imagem(ns) em <strong>@{previa.conta}</strong>. Nada foi publicado.
                  </p>
                  <p>
                    Para publicar de verdade, escreva exatamente: <strong>{previa.confirmacaoNecessaria}</strong>
                  </p>
                  <input className="rounded-campo border border-linha bg-superficie px-2 py-1.5" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} placeholder="escreva a frase acima" />
                  <div>
                    <Botao pequeno variante="primario" icone={Send} disabled={ocupado || confirmacao.trim().toLowerCase() !== previa.confirmacaoNecessaria} onClick={() => void publicar(false)}>
                      Publicar agora
                    </Botao>
                  </div>
                </div>
              )}
              {publicado?.ativo === true && !publicado.dryRun && (
                <p className="rounded-bloco bg-ok-suave px-3 py-2 text-ok">
                  Publicado em @{publicado.conta}. {publicado.link && <a className="underline" href={publicado.link} target="_blank" rel="noreferrer">Ver o post</a>}
                </p>
              )}
            </>
          )}
        </div>
      )}

      {precisaPassos && cli?.passosParaCliente && (
        <details className="rounded-bloco border border-linha px-3 py-2 text-[12px]">
          <summary className="cursor-pointer font-semibold">
            <Share2 size={12} className="mr-1 inline" />
            Passo a passo para o cliente liberar o acesso
          </summary>
          <pre className="mt-2 font-sans whitespace-pre-wrap">{cli.passosParaCliente}</pre>
          <Botao
            pequeno
            className="mt-2"
            icone={copiado ? Check : Copy}
            onClick={() =>
              void navigator.clipboard?.writeText(cli.passosParaCliente).then(() => {
                setCopiado(true);
                setTimeout(() => setCopiado(false), 2000);
              })
            }
          >
            {copiado ? "Copiado" : "Copiar para o WhatsApp"}
          </Botao>
        </details>
      )}
    </div>
  );
}
