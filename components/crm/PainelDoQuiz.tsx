"use client";

// Painel do quiz na tela de Leads: o Áleff (ou qualquer sócio) troca WhatsApp, Instagram e códigos de pixel
// e monta links de anúncio com campanha, sem pedir mudança no código. A página pública do quiz lê isso do Aden.

import { Check, ChevronDown, Copy, Link2, Megaphone } from "lucide-react";
import { useEffect, useState } from "react";
import { Botao, CampoTexto, cx } from "@/components/ui";
import { configQuizVazia, linkDoQuiz, normalizarConfigQuiz, type ConfigQuiz, type ErrosConfigQuiz } from "@/lib/calculo/quizConfig";
import type { Repositorio } from "@/lib/dados/repositorio";

function Linha({ ligado, nome, texto }: { ligado: boolean; nome: string; texto: string }) {
  return (
    <li className="flex items-baseline gap-2 text-[12px]">
      <span className={cx("inline-block size-2 shrink-0 translate-y-px rounded-full", ligado ? "bg-ok" : "bg-linha")} aria-hidden />
      <span className="font-semibold">{nome}</span>
      <span className="text-texto-suave">{texto}</span>
    </li>
  );
}

export function PainelDoQuiz({ repo, podeEditar }: { repo: Repositorio; podeEditar: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [salvo, setSalvo] = useState<ConfigQuiz>(configQuizVazia());
  const [campos, setCampos] = useState<ConfigQuiz>(configQuizVazia());
  const [erros, setErros] = useState<ErrosConfigQuiz>({});
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pronto, setPronto] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  // gerador de link com campanha
  const [fonte, setFonte] = useState("");
  const [midia, setMidia] = useState("");
  const [campanha, setCampanha] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    // sem a migration 0047 o painel simplesmente abre vazio
    repo
      .carregarConfigQuiz()
      .then((c) => {
        setSalvo(c);
        setCampos(c);
      })
      .catch(() => undefined)
      .finally(() => setPronto(true));
  }, [repo]);

  const mudou = (Object.keys(campos) as (keyof ConfigQuiz)[]).some((k) => campos[k] !== salvo[k]);
  const set = (k: keyof ConfigQuiz) => (v: string) => {
    setCampos((c) => ({ ...c, [k]: v }));
    setMsg(null);
  };

  const guardar = async () => {
    const r = normalizarConfigQuiz(campos);
    setErros(r.erros);
    setCampos(r.config);
    if (Object.keys(r.erros).length > 0) {
      setMsg({ ok: false, texto: "Confira os campos em vermelho. Nada foi salvo." });
      return;
    }
    setOcupado(true);
    try {
      await repo.salvarConfigQuiz(r.config);
      setSalvo(r.config);
      setMsg({ ok: true, texto: "Salvo. A página do quiz passa a usar isso em até 1 minuto." });
    } catch (e) {
      setMsg({ ok: false, texto: e instanceof Error ? e.message : "Não deu para salvar." });
    } finally {
      setOcupado(false);
    }
  };

  const base = typeof window === "undefined" ? "" : `${window.location.origin}/quiz`;
  const link = base ? linkDoQuiz(base, { fonte, midia, campanha, conteudo }) : null;
  const copiar = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false); // sem permissão para copiar: a pessoa seleciona o link à mão
    }
  };

  return (
    <section className="rounded-bloco border border-linha bg-superficie" aria-label="Configurar o quiz">
      <button type="button" aria-expanded={aberto} onClick={() => setAberto((a) => !a)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <Megaphone size={16} className="shrink-0 text-marca" aria-hidden />
        <span className="flex-1">
          <span className="block text-sm font-bold">Configurar o quiz</span>
          <span className="block text-[12px] text-texto-suave">
            {pronto ? (
              <>
                Pixel da Meta: <strong className={salvo.metaPixel ? "text-ok" : "text-aviso"}>{salvo.metaPixel ? "ligado" : "desligado"}</strong> · Google:{" "}
                <strong className={salvo.googleTag ? "text-ok" : "text-aviso"}>{salvo.googleTag ? "ligado" : "desligado"}</strong>. Clique para colocar os códigos, o WhatsApp e gerar links de anúncio.
              </>
            ) : (
              "WhatsApp, Instagram, códigos dos anúncios e links com campanha. Tudo editável aqui, sem mexer no código."
            )}
          </span>
        </span>
        <ChevronDown size={16} className={cx("shrink-0 text-texto-suave transition-transform", aberto && "rotate-180")} aria-hidden />
      </button>

      {aberto && pronto && (
        <div className="border-t border-linha px-4 py-4">
          <p className="text-[12px] text-texto-suave">
            Campo vazio = o quiz usa o valor que já vem na página. Os códigos de pixel avisam o anúncio quando chega um lead: assim a Meta e o Google aprendem quem é o seu público.
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <CampoTexto rotulo="WhatsApp do botão do quiz" valor={campos.whatsapp} aoMudar={set("whatsapp")} placeholder="(81) 99999-9999" />
              {erros.whatsapp && <p className="mt-1 text-[11px] text-erro">{erros.whatsapp}</p>}
            </div>
            <div>
              <CampoTexto rotulo="Instagram" valor={campos.instagramUrl} aoMudar={set("instagramUrl")} placeholder="@grupoaden" />
              {erros.instagramUrl && <p className="mt-1 text-[11px] text-erro">{erros.instagramUrl}</p>}
            </div>
            <div>
              <CampoTexto rotulo="Código do pixel da Meta" valor={campos.metaPixel} aoMudar={set("metaPixel")} placeholder="só números" />
              {erros.metaPixel && <p className="mt-1 text-[11px] text-erro">{erros.metaPixel}</p>}
            </div>
            <div>
              <CampoTexto rotulo="Código do Google (tag ou Google Ads)" valor={campos.googleTag} aoMudar={set("googleTag")} placeholder="G-..., AW-... ou GTM-..." />
              {erros.googleTag && <p className="mt-1 text-[11px] text-erro">{erros.googleTag}</p>}
            </div>
          </div>

          <ul className="mt-3 flex flex-col gap-1" aria-label="O que está ligado">
            <Linha ligado={Boolean(salvo.metaPixel)} nome="Pixel da Meta" texto={salvo.metaPixel ? "ligado no quiz" : "desligado (cole o código acima)"} />
            <Linha ligado={Boolean(salvo.googleTag)} nome="Google" texto={salvo.googleTag ? "ligado no quiz" : "desligado (cole o código acima)"} />
          </ul>
          <p className="mt-2 text-[11px] text-texto-suave">
            Quem envia o contato como qualificado ou com ressalva conta como <strong>Lead</strong> nos anúncios. Quem quer só social media vai como evento separado, para não bagunçar a otimização.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Botao variante="primario" disabled={!podeEditar || !mudou || ocupado} onClick={() => void guardar()}>
              {ocupado ? "Salvando…" : "Salvar"}
            </Botao>
            {!podeEditar && <span className="text-[12px] text-texto-suave">Só os sócios editam.</span>}
            {msg && (
              <span className={cx("text-[12px] font-medium", msg.ok ? "text-ok" : "text-erro")} role="status">
                {msg.texto}
              </span>
            )}
          </div>

          <div className="mt-5 border-t border-linha pt-4">
            <p className="flex items-center gap-1.5 text-sm font-bold">
              <Link2 size={14} aria-hidden /> Link para o anúncio
            </p>
            <p className="mt-0.5 text-[12px] text-texto-suave">
              Use este link no anúncio. Quando alguém responder o quiz, o lead já aparece com o nome da campanha, e você vê qual anúncio traz gente boa.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <CampoTexto rotulo="Onde o anúncio roda" valor={fonte} aoMudar={setFonte} placeholder="meta, google, instagram…" />
              <CampoTexto rotulo="Nome da campanha" valor={campanha} aoMudar={setCampanha} placeholder="captação outubro" />
              <CampoTexto rotulo="Tipo (opcional)" valor={midia} aoMudar={setMidia} placeholder="pago, story, orgânico…" />
              <CampoTexto rotulo="Qual anúncio (opcional)" valor={conteudo} aoMudar={setConteudo} placeholder="vídeo 1" />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded-item bg-superficie-2/60 px-3 py-2 text-[12px]">{link ?? "Preencha onde roda e o nome da campanha para gerar o link."}</code>
              <Botao pequeno icone={copiado ? Check : Copy} disabled={!link} onClick={() => void copiar()}>
                {copiado ? "Copiado" : "Copiar link"}
              </Botao>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
