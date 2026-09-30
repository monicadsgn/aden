"use client";

// Painel do cliente (sem login: o link é o acesso). Um quadro com colunas que deslizam para o
// lado, na ordem do caminho do post (vem por aí → produção → aprovação → aprovada → agendada →
// publicado), para o cliente ver tudo de uma vez sem descer a página. Mostra só as peças que a
// Aden marcou para ele; aprova ou pede ajuste. Nada interno: nem valores, nem horas, nem notas.

import { CalendarClock, FileText, FolderOpen, HelpCircle, Image as ImageIcon, Layers, ListChecks, Palette, Sparkles, Video, type LucideIcon } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Modal } from "@/components/Modal";
import { cx } from "@/components/ui";
import { aprovarAte, montarQuadro, resumoDoMes, situacaoDaPecaPainel } from "@/lib/calculo/painel";
import { useDados } from "@/lib/dados/contexto";
import type { PainelCliente } from "@/lib/dados/repositorio";
import { PAINEL_CLIENTE_ATIVO } from "@/lib/recursos";

type Peca = PainelCliente["pecas"][number];

const estiloAtalho =
  "inline-flex items-center gap-1.5 rounded-botao border border-linha px-3 py-1.5 text-xs font-semibold text-texto-suave transition hover:border-marca/50 hover:text-texto";

const MOTIVOS_TEXTO = ["Muito longo", "Muito formal", "Emoji demais", "Não parece a nossa voz", "Falta informação"];

/** Ícone e tom do formato, pelo nome do tipo de entrega (sem nome = arte). */
function formato(tipo: string | null | undefined): { icone: LucideIcon; tom: string } {
  const t = (tipo ?? "").toLowerCase();
  if (t.includes("reels") || t.includes("vídeo") || t.includes("video")) return { icone: Video, tom: "bg-info-suave text-info" };
  if (t.includes("carrossel")) return { icone: Layers, tom: "bg-aviso-suave text-aviso" };
  if (t.includes("stor")) return { icone: Sparkles, tom: "bg-destaque/20 text-texto" };
  return { icone: ImageIcon, tom: "bg-marca-tinta text-marca-forte" };
}

const diaCurto = (iso: string | null | undefined) =>
  iso ? new Date(iso.length > 10 ? iso : `${iso}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "") : "";

/** "Entra dia 04 out" (a entrar) ou "Entrou dia 28 set" (publicado). */
function faixaData(p: Peca): string | null {
  if (p.publicadaEm) return `Entrou dia ${diaCurto(p.publicadaEm)}`;
  if (p.publicarEm) return `Entra dia ${diaCurto(p.publicarEm)}`;
  if (p.vencimento) return `Entra dia ${diaCurto(p.vencimento)}`;
  return null;
}

function passosDoTutorial(temPlanejado: boolean) {
  return [
    { titulo: "Seu painel de aprovação", texto: "Aqui você acompanha o que a Aden está preparando para o seu Instagram, sem precisar pedir por WhatsApp." },
    ...(temPlanejado ? [{ titulo: "Vem por aí", texto: "São os posts previstos no calendário, ainda sem arte. Toque para ver o que está planejado." }] : []),
    { titulo: "Em produção", texto: "É o que já está sendo feito. Só para você acompanhar o andamento, sem precisar mexer em nada." },
    { titulo: "Aguardando sua aprovação", texto: "São os posts prontos para você olhar. Toque em cada um para ver a arte e a legenda, e aprove ou peça ajuste." },
    { titulo: "Aprovada e Agendada", texto: "Depois que você aprova, o post vai para Aprovada. Quando ganha data, vai para Agendada: é só esperar ir ao ar." },
    { titulo: "Publicado recentemente", texto: "Os últimos posts que já foram ao ar, com a data em que entraram no feed." },
    { titulo: "Arraste para o lado", texto: "Cada etapa é uma coluna. No celular, arraste para o lado para passar de uma para outra; as bolinhas mostram onde você está." },
    { titulo: "Este link é só seu", texto: "Guarde este endereço, não precisa pedir de novo. O botão ? sempre reabre este passo a passo." },
  ];
}

export default function PainelDoCliente() {
  const { token } = useParams<{ token: string }>();
  const { repo, carregando } = useDados();
  const [painel, setPainel] = useState<PainelCliente | null | undefined>(undefined);
  const [aberta, setAberta] = useState<string | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  const [ajuste, setAjuste] = useState<{ tipo: "arte" | "texto"; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [recebido, setRecebido] = useState<string | null>(null);
  const [resumoAberto, setResumoAberto] = useState(false);
  const [inclusoAberto, setInclusoAberto] = useState(false);
  const [passo, setPasso] = useState<number | null>(null);
  const [colunaVisivel, setColunaVisivel] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chaveTutorial = `aden:painel-tutorial:${token}`;

  const carregar = useCallback(async () => {
    // painel desligado (lib/recursos.ts): nenhum link abre
    if (!PAINEL_CLIENTE_ATIVO) return setPainel(null);
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

  const confirmar = (texto: string) => {
    setRecebido(texto);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setRecebido(null), 5000);
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

  const colunas = montarQuadro(painel.pecas);
  const peca = painel.pecas.find((p) => p.id === aberta) ?? null;
  const sit = peca ? situacaoDaPecaPainel(peca) : null;
  const mes = new Date().toISOString().slice(0, 7);
  const resumo = resumoDoMes(painel.pecas, mes);
  const temResumo = resumo.publicados + resumo.agendados + resumo.emAndamento + resumo.ajustesPedidos > 0;
  const at = painel.atalhos;
  const temAtalho = !!(at?.planejamentoUrl || at?.fotosUrl || at?.identidadeUrl || at?.inclusoTexto);
  const tutorial = passosDoTutorial(colunas.some((c) => c.id === "planejado"));
  const passoAtual = passo == null ? null : Math.min(passo, tutorial.length - 1);

  const fechar = () => {
    setAberta(null);
    setAjuste(null);
    setErro(null);
  };

  const responder = async (decisao: "aprovar" | "ajustar") => {
    if (!peca) return;
    setEnviando(true);
    setErro(null);
    try {
      // o ajuste vai com o que mudar (arte ou texto) na frente, para a equipe saber na hora
      const texto = decisao === "ajustar" && ajuste ? `${ajuste.tipo === "arte" ? "Arte" : "Texto"}: ${ajuste.texto.trim()}` : "";
      await repo.responderPeca(token, peca.id, decisao, texto);
      fechar();
      confirmar(decisao === "aprovar" ? "Recebido! Post aprovado, a Aden já segue com ele." : "Recebido! A Aden vai ajustar e o post volta aqui para você aprovar.");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message.replace(/^.*?:\s*/, "") : "Não deu para enviar. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  };

  const imagens = peca?.arquivos.filter((a) => a.tipo.startsWith("image/")) ?? [];
  const outros = peca?.arquivos.filter((a) => !a.tipo.startsWith("image/")) ?? [];
  const prazo = peca && sit === "aguardando" ? aprovarAte(peca.enviadaEm, painel.prazoAprovacaoDias) : null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 bg-fundo px-4 pt-8 pb-28 sm:px-8">
      <header className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-item bg-marca text-lg font-extrabold text-sobre-marca">a</span>
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight">Olá, {painel.cliente}</h1>
          <p className="text-sm text-texto-suave">Seus posts com a Aden</p>
        </div>
      </header>

      {(temResumo || temAtalho) && (
        <nav aria-label="Atalhos" className="-mt-2 flex flex-wrap items-center gap-2">
          {at?.planejamentoUrl && (
            <a href={at.planejamentoUrl} target="_blank" rel="noreferrer" className={cx(estiloAtalho, "border-marca/40 text-texto")}>
              <FileText size={13} /> {at.planejamentoRotulo || "Planejamento do mês"}
            </a>
          )}
          {at?.fotosUrl && (
            <a href={at.fotosUrl} target="_blank" rel="noreferrer" className={estiloAtalho}>
              <FolderOpen size={13} /> Fotos
            </a>
          )}
          {at?.identidadeUrl && (
            <a href={at.identidadeUrl} target="_blank" rel="noreferrer" className={estiloAtalho}>
              <Palette size={13} /> Identidade visual
            </a>
          )}
          {at?.inclusoTexto && (
            <button type="button" onClick={() => setInclusoAberto(true)} className={estiloAtalho}>
              <ListChecks size={13} /> O que está incluso
            </button>
          )}
          {temResumo && (
            <button type="button" onClick={() => setResumoAberto(true)} className={estiloAtalho}>
              Resumo do mês
            </button>
          )}
        </nav>
      )}

      {/* o quadro: no celular, uma coluna por tela (arrasta para o lado); no computador, todas lado a lado */}
      <div
        onScroll={(e) => {
          const el = e.currentTarget;
          const primeira = el.firstElementChild as HTMLElement | null;
          if (primeira) setColunaVisivel(Math.round(el.scrollLeft / (primeira.offsetWidth + 16)));
        }}
        className="-mx-4 flex snap-x snap-mandatory items-start gap-4 overflow-x-auto px-4 pb-2 sm:-mx-8 sm:snap-none sm:px-8"
      >
        {colunas.map((c) => (
          <Coluna key={c.id} titulo={c.titulo} vazio={c.vazio} quantos={c.pecas.length} destaque={c.id === "aguardando"}>
            {c.pecas.map((p) => (
              <CardPeca
                key={p.id}
                p={p}
                acao={c.id === "aguardando" ? "Revisar →" : c.id === "aprovada" || c.id === "agendada" ? "Ver arte →" : "Ver detalhes →"}
                ajuste={situacaoDaPecaPainel(p) === "ajuste"}
                aoAbrir={() => setAberta(p.id)}
              />
            ))}
          </Coluna>
        ))}
      </div>

      {colunas.length > 1 && (
        <div className="-mt-3 flex justify-center gap-1.5 sm:hidden" aria-hidden>
          {colunas.map((c, i) => (
            <span key={c.id} className={cx("h-1.5 rounded-full transition-all", i === colunaVisivel ? "w-4 bg-texto/60" : "w-1.5 bg-texto/20")} />
          ))}
        </div>
      )}

      {recebido && (
        <p role="status" className="fixed inset-x-4 bottom-20 z-40 mx-auto max-w-md rounded-card bg-marca px-4 py-3 text-center text-sm font-semibold text-sobre-marca shadow-forte">
          {recebido}
        </p>
      )}

      <button
        type="button"
        aria-label="Como funciona este painel"
        onClick={() => setPasso(0)}
        className="fixed right-5 bottom-5 flex size-11 items-center justify-center rounded-full bg-marca text-sobre-marca shadow-forte"
      >
        <HelpCircle size={20} />
      </button>

      {/* a peça aberta */}
      <Modal
        aberto={!!peca && !zoom}
        aoFechar={fechar}
        largura="md"
        titulo={peca?.titulo}
        subtitulo={peca?.tipo ?? undefined}
        rodape={
          // os botões ficam no rodapé da janela: com carrossel longo, não somem lá embaixo
          sit === "aguardando" && !ajuste ? (
            <div className="flex w-full items-center justify-between gap-2">
              <div className="flex gap-1.5">
                <BotaoLinha onClick={() => setAjuste({ tipo: "arte", texto: "" })}>Ajustar arte</BotaoLinha>
                <BotaoLinha onClick={() => setAjuste({ tipo: "texto", texto: "" })}>Ajustar texto</BotaoLinha>
              </div>
              <button
                type="button"
                disabled={enviando}
                onClick={() => void responder("aprovar")}
                className="shrink-0 rounded-botao bg-marca px-4 py-1.5 text-xs font-semibold text-sobre-marca disabled:opacity-40"
              >
                Aprovar
              </button>
            </div>
          ) : undefined
        }
      >
        {peca && (
          <div className="flex flex-col gap-3">
            {(sit === "planejado" || sit === "producao") && (
              <p className="rounded-bloco border border-dashed border-linha bg-superficie-2/60 p-3 text-xs text-texto-suave">
                {sit === "planejado" ? "Já está no planejamento" : "A Aden já está produzindo este post"}
                {peca.publicarEm ? `, previsto para ${diaCurto(peca.publicarEm)}` : ""}. Assim que a arte estiver pronta, você vai poder ver e aprovar aqui.
              </p>
            )}
            {sit === "ajuste" && peca.feedback && (
              <p className="rounded-bloco border border-dashed border-linha bg-superficie-2/60 p-3 text-xs text-texto-suave">
                Você pediu: “{peca.feedback}”. A Aden está ajustando e o post volta aqui para você aprovar.
              </p>
            )}
            {imagens.length > 0 && (
              <div className="flex flex-col gap-1">
                <div className={imagens.length > 1 ? "flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1" : "flex flex-col"}>
                  {imagens.map((a) => (
                    <button key={a.url} type="button" onClick={() => setZoom(a.url)} aria-label="Ver a arte maior" className={cx("shrink-0 snap-center", imagens.length > 1 ? "max-w-[85%]" : "w-full")}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- arte da peça */}
                      <img src={a.url} alt={a.nome} className={cx("cursor-zoom-in rounded-bloco border border-linha bg-superficie-2 object-contain", imagens.length > 1 ? "h-56 w-auto" : "max-h-80 w-full")} />
                    </button>
                  ))}
                </div>
                {imagens.length > 1 && <p className="text-[12px] text-texto-suave">{imagens.length} imagens: arraste para o lado para ver todas. O texto está logo abaixo.</p>}
              </div>
            )}
            {outros.map((a) => (
              <a key={a.url} href={a.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-bloco border border-linha px-3 py-2 text-xs font-semibold">
                <FileText size={16} /> {a.nome}
              </a>
            ))}
            {peca.textoArte && (
              <div className="flex flex-col gap-1">
                <p className="text-xs font-semibold tracking-wide text-texto-suave uppercase">Texto da arte</p>
                <p className="rounded-bloco border border-linha bg-superficie-2/60 p-3 text-sm whitespace-pre-wrap">{peca.textoArte}</p>
              </div>
            )}
            {peca.legenda && (
              <div className="flex flex-col gap-1">
                <p className="text-xs font-semibold tracking-wide text-texto-suave uppercase">Legenda</p>
                <p className="rounded-bloco border border-linha bg-superficie-2/60 p-3 text-sm whitespace-pre-wrap">{peca.legenda}</p>
              </div>
            )}
            {(sit === "aprovada" || sit === "agendada") && (
              <p className="rounded-bloco bg-ok-suave px-3 py-2 text-sm text-ok">
                Você aprovou em {diaCurto(peca.aprovadaEm)}.{sit === "agendada" && peca.publicarEm ? ` Entra dia ${diaCurto(peca.publicarEm)}.` : ""}
              </p>
            )}
            {sit === "aguardando" && (prazo || painel.limiteRodadas != null) && (
              <p className="flex items-center gap-1.5 text-[12px] text-texto-suave">
                <CalendarClock size={13} />
                {prazo ? `Aprovar até ${diaCurto(prazo)}.` : ""}
                {painel.limiteRodadas != null ? ` Ajustes usados: ${peca.rodadas} de ${painel.limiteRodadas}.` : ""}
              </p>
            )}
            {erro && <p className="text-xs font-semibold text-erro">{erro}</p>}

            {sit === "aguardando" &&
              (ajuste ? (
                <div className="flex flex-col gap-2 border-t border-linha pt-3">
                  <p className="text-xs font-semibold tracking-wide text-texto-suave uppercase">{ajuste.tipo === "arte" ? "O que ajustar na arte?" : "O que ajustar no texto?"}</p>
                  {ajuste.tipo === "texto" && (
                    <div className="flex flex-wrap gap-1.5">
                      {MOTIVOS_TEXTO.map((m) => {
                        const marcado = ajuste.texto.includes(m);
                        return (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setAjuste({ ...ajuste, texto: marcado ? ajuste.texto.replace(`${m}. `, "").replace(m, "").trimStart() : `${m}. ${ajuste.texto}` })}
                            className={cx("rounded-botao border px-2.5 py-1 text-[12px] font-medium transition", marcado ? "border-marca bg-marca-tinta text-texto" : "border-linha text-texto-suave hover:text-texto")}
                          >
                            {m}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <textarea
                    autoFocus
                    rows={3}
                    maxLength={2000}
                    value={ajuste.texto}
                    onChange={(e) => setAjuste({ ...ajuste, texto: e.target.value })}
                    placeholder={ajuste.tipo === "texto" ? "Toque num motivo acima ou escreva como prefere. Se puder, cole um exemplo de texto que você gosta." : "Escreva aqui o que você quer mudar…"}
                    className="w-full resize-none rounded-campo border border-linha bg-superficie px-3 py-2 text-sm focus:border-marca focus:outline-none"
                  />
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setAjuste(null)} className="rounded-botao px-4 py-1.5 text-xs font-medium text-texto-suave hover:text-texto">
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={enviando || !ajuste.texto.trim()}
                      onClick={() => void responder("ajustar")}
                      className="rounded-botao bg-marca px-4 py-1.5 text-xs font-semibold text-sobre-marca disabled:opacity-40"
                    >
                      Enviar
                    </button>
                  </div>
                </div>
              ) : null)}
          </div>
        )}
      </Modal>

      {zoom && (
        <button type="button" className="fixed inset-0 z-[60] flex cursor-zoom-out items-center justify-center bg-texto/90 p-4" onClick={() => setZoom(null)} aria-label="Fechar">
          {/* eslint-disable-next-line @next/next/no-img-element -- arte ampliada */}
          <img src={zoom} alt="" className="max-h-full max-w-full rounded-item object-contain" />
        </button>
      )}

      {/* o que está incluso */}
      <Modal
        aberto={inclusoAberto}
        aoFechar={() => setInclusoAberto(false)}
        largura="sm"
        titulo="O que está incluso"
        subtitulo="O que o seu plano cobre e o que é à parte."
      >
        <p className="text-sm leading-relaxed whitespace-pre-line">{at?.inclusoTexto}</p>
      </Modal>

      {/* resumo do mês */}
      <Modal
        aberto={resumoAberto}
        aoFechar={() => setResumoAberto(false)}
        largura="sm"
        titulo={`Resumo de ${new Date().toLocaleDateString("pt-BR", { month: "long" })}`}
        subtitulo="O que já foi feito neste mês, até agora."
      >
        <dl className="flex flex-col gap-2 text-sm">
          {(
            [
              ["Já foram ao ar", resumo.publicados],
              ["Agendados", resumo.agendados],
              ["Em andamento (produção e aprovação)", resumo.emAndamento],
              ["Pedidos de ajuste", resumo.ajustesPedidos],
            ] as const
          ).map(([rotulo, valor]) => (
            <div key={rotulo} className="flex items-center justify-between gap-3 rounded-bloco border border-linha bg-superficie-2/60 px-3 py-2">
              <dt className="text-texto-suave">{rotulo}</dt>
              <dd className="numero font-semibold">{valor}</dd>
            </div>
          ))}
        </dl>
        {resumo.porTipo.length > 0 && (
          <div className="mt-3 flex flex-col gap-1.5">
            <p className="text-xs font-semibold tracking-wide text-texto-suave uppercase">Publicados e agendados, por formato</p>
            <div className="flex flex-wrap gap-1.5">
              {resumo.porTipo.map(({ tipo, quantidade }) => (
                <span key={tipo} className={cx("rounded-botao px-2.5 py-1 text-xs font-semibold", formato(tipo).tom)}>
                  {tipo} × {quantidade}
                </span>
              ))}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        aberto={passoAtual != null}
        aoFechar={fecharTutorial}
        largura="sm"
        titulo={passoAtual != null ? tutorial[passoAtual].titulo : ""}
        subtitulo={passoAtual != null ? `${passoAtual + 1} de ${tutorial.length}` : undefined}
        rodape={
          passoAtual != null && (
            <>
              {passoAtual > 0 && <BotaoLinha onClick={() => setPasso(passoAtual - 1)}>Voltar</BotaoLinha>}
              <button
                type="button"
                onClick={() => (passoAtual === tutorial.length - 1 ? fecharTutorial() : setPasso(passoAtual + 1))}
                className="rounded-botao bg-marca px-4 py-1.5 text-xs font-semibold text-sobre-marca"
              >
                {passoAtual === tutorial.length - 1 ? "Entendi" : "Próximo"}
              </button>
            </>
          )
        }
      >
        {passoAtual != null && <p className="text-sm leading-relaxed">{tutorial[passoAtual].texto}</p>}
      </Modal>
    </main>
  );
}

function BotaoLinha({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-botao border border-linha px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-texto-suave hover:border-marca/50 hover:text-texto"
    >
      {children}
    </button>
  );
}

function Coluna({ titulo, vazio, quantos, destaque, children }: { titulo: string; vazio: string; quantos: number; destaque?: boolean; children: ReactNode }) {
  return (
    // "Aguardando sua aprovação" vem primeiro no celular
    <section className={cx("flex max-h-[70vh] w-full shrink-0 snap-center flex-col gap-2 sm:max-h-[65vh] sm:w-64", destaque && "order-first sm:order-none")}>
      <h2 className={cx("shrink-0 text-sm font-semibold tracking-wide uppercase", destaque ? "text-marca-forte" : "text-texto-suave")}>
        {titulo}
      </h2>
      {quantos > 0 ? (
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">{children}</div>
      ) : (
        vazio && <p className="rounded-card border border-dashed border-linha px-4 py-6 text-center text-sm text-texto-suave">{vazio}</p>
      )}
    </section>
  );
}

function CardPeca({ p, acao, ajuste, aoAbrir }: { p: Peca; acao: string; ajuste: boolean; aoAbrir: () => void }) {
  const img = p.arquivos.find((a) => a.tipo.startsWith("image/"));
  const data = faixaData(p);
  const f = formato(p.tipo);
  const Icone = f.icone;
  const etiqueta = p.tipo && (
    <span className={cx("inline-flex items-center gap-1 rounded-botao px-1.5 text-[11px] font-medium", f.tom)}>
      <Icone size={10} /> {p.tipo}
    </span>
  );
  return (
    <button type="button" onClick={aoAbrir} className="flex shrink-0 flex-col overflow-hidden rounded-card border border-linha bg-superficie text-left shadow-card transition hover:border-marca/50">
      {img ? (
        <>
          <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-superficie-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- arte da peça */}
            <img src={img.url} alt="" loading="lazy" className="size-full object-cover" />
            {data && <span className="absolute inset-x-0 bottom-0 bg-marca/90 px-2.5 py-1 text-center text-[11px] font-semibold tracking-wide text-sobre-marca uppercase">{data}</span>}
          </div>
          <div className="flex items-center gap-2 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{p.titulo}</p>
              {etiqueta}
            </div>
            <span className="shrink-0 text-xs font-semibold text-marca-forte">{acao}</span>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-2 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className={cx("flex size-9 shrink-0 items-center justify-center rounded-full", f.tom)}>
              <Icone size={16} />
            </span>
            <p className="min-w-0 flex-1 truncate text-sm font-medium">{p.titulo}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {etiqueta}
            {data && <span className="rounded-botao border border-linha px-1.5 text-[11px] text-texto-suave">{data}</span>}
            <span className="ml-auto shrink-0 text-xs font-semibold text-marca-forte">{acao}</span>
          </div>
        </div>
      )}
      {ajuste && <span className="border-t border-linha bg-aviso-suave px-4 py-1.5 text-[11px] font-semibold text-aviso">Ajustando o que você pediu</span>}
    </button>
  );
}
