"use client";

// Painel do cliente (sem login: o link é o acesso). Mostra só as peças que a Aden marcou
// para o cliente e deixa aprovar ou pedir ajuste. Nada interno: nem valores, nem horas.

import { ArrowLeft, ArrowRight, Check, CheckCircle2, Clock, FileText, HelpCircle, MessageSquare, Pencil } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { Botao, cx } from "@/components/ui";
import { aprovarAte } from "@/lib/calculo/painel";
import { situacaoPeca, type SituacaoPeca } from "@/lib/calculo/tarefas";
import { useDados } from "@/lib/dados/contexto";
import type { PainelCliente } from "@/lib/dados/repositorio";

type Peca = PainelCliente["pecas"][number];

const GRUPOS: { sit: SituacaoPeca[]; titulo: string; frase: string }[] = [
  { sit: ["aguardando"], titulo: "Esperando sua aprovação", frase: "Dê uma olhada e aprove, ou peça o ajuste que precisar." },
  { sit: ["ajuste"], titulo: "Ajustando o que você pediu", frase: "Já estamos mexendo. Volta para você aprovar assim que ficar pronta." },
  { sit: ["producao"], titulo: "Em produção", frase: "O que está sendo feito agora." },
  { sit: ["aprovada", "entregue"], titulo: "Aprovadas", frase: "Tudo certo com estas." },
];

const TUTORIAL = [
  { titulo: "Boas-vindas ao seu painel", texto: "Aqui você acompanha tudo o que a Aden está produzindo para você, sem precisar procurar em conversa de WhatsApp." },
  { titulo: "Aprovar é um clique", texto: "As peças que precisam da sua aprovação aparecem no topo. Abra, veja a arte e o texto, e toque em Aprovar." },
  { titulo: "Pediu ajuste? Escreva aqui", texto: "Se algo precisa mudar, toque em Pedir ajuste e escreva o que você quer. A gente recebe na hora." },
  { titulo: "Sempre neste link", texto: "Guarde este endereço: ele é só seu. Sempre que tiver peça nova, ela aparece aqui. O botão ? mostra este passo a passo de novo." },
];

const dataBr = (iso: string | null | undefined) => (iso ? new Date(iso.length > 10 ? iso : `${iso}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" }) : "");

function Miniatura({ p }: { p: Peca }) {
  const img = p.arquivos.find((a) => a.tipo.startsWith("image/"));
  return (
    <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-item bg-superficie-2">
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element -- arte da peça
        <img src={img.url} alt={p.titulo} className="size-full object-cover" />
      ) : (
        <FileText size={28} className="text-texto-suave" />
      )}
    </div>
  );
}

export default function PainelDoCliente() {
  const { token } = useParams<{ token: string }>();
  const { repo, carregando } = useDados();
  const [painel, setPainel] = useState<PainelCliente | null | undefined>(undefined);
  const [aberta, setAberta] = useState<string | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  const [modo, setModo] = useState<"ver" | "ajustar">("ver");
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [passo, setPasso] = useState<number | null>(null);
  const chaveTutorial = `aden:painel-tutorial:${token}`;

  const carregar = useCallback(async () => {
    try {
      setPainel(await repo.painelCliente(token));
    } catch {
      setPainel(null);
    }
  }, [repo, token]);

  useEffect(() => {
    if (carregando) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- busca do painel no banco
    void carregar();
  }, [carregando, carregar]);

  useEffect(() => {
    if (!painel) return;
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- primeira visita lida do navegador
      if (localStorage.getItem(chaveTutorial) !== "1") setPasso(0);
    } catch {}
  }, [painel, chaveTutorial]);

  const fecharTutorial = () => {
    setPasso(null);
    try {
      localStorage.setItem(chaveTutorial, "1");
    } catch {}
  };

  if (painel === undefined) return <div className="min-h-screen bg-fundo" />;
  if (painel === null)
    return (
      <main className="flex min-h-screen items-center justify-center bg-fundo px-6 text-center">
        <div className="max-w-sm">
          <h1 className="text-xl font-bold">Este link não está mais valendo</h1>
          <p className="mt-2 text-sm text-texto-suave">Peça o link novo para a equipe da Aden.</p>
        </div>
      </main>
    );

  const pecas = painel.pecas.map((p) => ({ ...p, sit: situacaoPeca({ status: p.status, clienteAprovouEm: p.aprovadaEm, feedbackEm: p.feedbackEm, enviadaClienteEm: p.enviadaEm }) }));
  const peca = pecas.find((p) => p.id === aberta) ?? null;

  const responder = async (decisao: "aprovar" | "ajustar") => {
    if (!peca) return;
    setEnviando(true);
    setAviso(null);
    try {
      await repo.responderPeca(token, peca.id, decisao, texto);
      setAberta(null);
      setTexto("");
      setModo("ver");
      setAviso(decisao === "aprovar" ? "Aprovada! Obrigada. 🎉" : "Pedido de ajuste enviado. A gente te avisa quando voltar.");
      await carregar();
    } catch (e) {
      setAviso(e instanceof Error ? e.message.replace(/^.*?:\s*/, "") : "Não deu para enviar. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen bg-fundo pb-24">
      <header className="border-b border-linha bg-marca-tinta/60">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-6 sm:px-8">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold tracking-wide text-texto-suave uppercase">Aden · seu painel</p>
            <h1 className="text-2xl font-extrabold tracking-tight">Olá, {painel.cliente}</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-6 sm:px-8">
        {aviso && <p className="rounded-card bg-ok-suave px-4 py-3 text-sm font-semibold text-ok">{aviso}</p>}
        {pecas.length === 0 && <p className="py-12 text-center text-sm text-texto-suave">Ainda não tem nada por aqui. Assim que tiver peça nova, ela aparece neste painel.</p>}
        {GRUPOS.map((g) => {
          const lista = pecas.filter((p) => g.sit.includes(p.sit));
          if (!lista.length) return null;
          const destaque = g.sit[0] === "aguardando";
          return (
            <section key={g.titulo}>
              <h2 className={cx("text-lg font-bold", destaque && "text-marca-forte")}>
                {g.titulo} <span className="text-sm font-semibold text-texto-suave">{lista.length}</span>
              </h2>
              <p className="mb-3 text-xs text-texto-suave">{g.frase}</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {lista.map((p) => {
                  const ate = p.sit === "aguardando" ? aprovarAte(p.enviadaEm, painel.prazoAprovacaoDias) : null;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setAberta(p.id);
                        setModo("ver");
                        setTexto("");
                      }}
                      className={cx("flex flex-col gap-2 rounded-card border bg-superficie p-2 text-left shadow-card transition-colors hover:border-marca", destaque ? "border-marca/50" : "border-linha")}
                    >
                      <Miniatura p={p} />
                      <span className="px-1 text-[13px] font-semibold leading-snug">{p.titulo}</span>
                      <span className="px-1 pb-1 text-[11px] text-texto-suave">
                        {ate ? `aprovar até ${dataBr(ate)}` : p.sit === "aprovada" && p.aprovadaEm ? `aprovada em ${dataBr(p.aprovadaEm)}` : p.vencimento ? `para ${dataBr(p.vencimento)}` : "ver detalhes →"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </main>

      <button
        type="button"
        aria-label="Como funciona este painel"
        onClick={() => setPasso(0)}
        className="fixed right-4 bottom-4 flex size-12 items-center justify-center rounded-full bg-marca text-sobre-marca shadow-forte"
      >
        <HelpCircle size={22} />
      </button>

      <Modal
        aberto={!!peca && !zoom}
        aoFechar={() => setAberta(null)}
        largura="lg"
        titulo={peca?.titulo}
        subtitulo={peca?.vencimento ? `para ${dataBr(peca.vencimento)}` : undefined}
        rodape={
          peca?.sit === "aguardando" ? (
            modo === "ver" ? (
              <>
                <Botao icone={Pencil} onClick={() => setModo("ajustar")}>
                  Pedir ajuste
                </Botao>
                <Botao variante="primario" icone={Check} disabled={enviando} onClick={() => void responder("aprovar")}>
                  Aprovar
                </Botao>
              </>
            ) : (
              <>
                <Botao variante="fantasma" onClick={() => setModo("ver")}>
                  Voltar
                </Botao>
                <Botao variante="primario" disabled={enviando || !texto.trim()} onClick={() => void responder("ajustar")}>
                  Enviar pedido de ajuste
                </Botao>
              </>
            )
          ) : undefined
        }
      >
        {peca && (
          <div className="flex flex-col gap-4">
            {peca.arquivos.length > 0 && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {peca.arquivos.map((a) =>
                  a.tipo.startsWith("image/") ? (
                    <button key={a.url} type="button" onClick={() => setZoom(a.url)} className="overflow-hidden rounded-item border border-linha" aria-label="Ver a arte maior">
                      {/* eslint-disable-next-line @next/next/no-img-element -- arte da peça */}
                      <img src={a.url} alt={a.nome} className="w-full cursor-zoom-in object-cover" />
                    </button>
                  ) : (
                    <a key={a.url} href={a.url} target="_blank" rel="noreferrer" className="flex flex-col items-center justify-center gap-1 rounded-item border border-linha p-4 text-xs font-semibold">
                      <FileText size={22} /> {a.nome}
                    </a>
                  ),
                )}
              </div>
            )}
            {peca.legenda && (
              <div>
                <p className="mb-1 text-xs font-bold text-texto-suave">Texto</p>
                <p className="rounded-bloco bg-superficie-2/60 px-3 py-2 text-sm whitespace-pre-wrap">{peca.legenda}</p>
              </div>
            )}
            {peca.sit === "aguardando" && (
              <p className="flex items-center gap-2 text-xs text-texto-suave">
                <Clock size={13} />
                {aprovarAte(peca.enviadaEm, painel.prazoAprovacaoDias) ? `Aprovar até ${dataBr(aprovarAte(peca.enviadaEm, painel.prazoAprovacaoDias))}.` : "Esperando sua resposta."}
                {painel.limiteRodadas != null && ` Ajustes usados: ${peca.rodadas} de ${painel.limiteRodadas}.`}
              </p>
            )}
            {modo === "ajustar" && (
              <label className="flex flex-col gap-1 text-xs font-bold text-texto-suave">
                O que você quer mudar?
                <textarea
                  autoFocus
                  className="min-h-28 rounded-campo border border-linha bg-superficie px-3 py-2 text-sm font-normal text-texto focus:border-marca focus:outline-none"
                  placeholder="Ex.: trocar a foto de fundo, deixar o texto mais curto…"
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                />
              </label>
            )}
            {peca.sit === "aprovada" && (
              <p className="flex items-center gap-2 rounded-bloco bg-ok-suave px-3 py-2 text-sm text-ok">
                <CheckCircle2 size={16} /> Você aprovou em {dataBr(peca.aprovadaEm)}.
              </p>
            )}
            {peca.respostas.length > 0 && (
              <div>
                <p className="mb-1 flex items-center gap-1.5 text-xs font-bold text-texto-suave">
                  <MessageSquare size={12} /> Suas respostas
                </p>
                <ol className="flex flex-col gap-1.5 border-l-2 border-linha pl-3 text-[13px]">
                  {peca.respostas.map((r) => (
                    <li key={r.em}>
                      <span className="text-[11px] text-texto-suave">
                        {r.decisao === "aprovar" ? "Aprovou" : "Pediu ajuste"} · {dataBr(r.em)}
                      </span>
                      {r.texto && <p>{r.texto}</p>}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
      </Modal>

      {zoom && (
        <button type="button" className="fixed inset-0 z-[60] flex cursor-zoom-out items-center justify-center bg-texto/90 p-4" onClick={() => setZoom(null)} aria-label="Fechar">
          {/* eslint-disable-next-line @next/next/no-img-element -- arte ampliada */}
          <img src={zoom} alt="" className="max-h-full max-w-full object-contain" />
        </button>
      )}

      <Modal
        aberto={passo != null}
        aoFechar={fecharTutorial}
        largura="sm"
        titulo={passo != null ? TUTORIAL[passo].titulo : ""}
        subtitulo={passo != null ? `${passo + 1} de ${TUTORIAL.length}` : undefined}
        rodape={
          passo != null && (
            <>
              {passo > 0 && (
                <Botao pequeno icone={ArrowLeft} onClick={() => setPasso(passo - 1)}>
                  Voltar
                </Botao>
              )}
              <Botao pequeno variante="primario" onClick={() => (passo === TUTORIAL.length - 1 ? fecharTutorial() : setPasso(passo + 1))}>
                {passo === TUTORIAL.length - 1 ? "Entendi" : "Próximo"} {passo < TUTORIAL.length - 1 && <ArrowRight size={14} />}
              </Botao>
            </>
          )
        }
      >
        {passo != null && <p className="text-sm leading-relaxed">{TUTORIAL[passo].texto}</p>}
      </Modal>
    </div>
  );
}
