"use client";

// Tudo do quiz de conversão dentro do CRM: a etiqueta (no card e na ficha), as respostas do lead e o funil
// (onde as pessoas param). A regra de quem é qualificado mora na página do quiz; aqui só se mostra o resultado.

import type { ReactNode } from "react";
import { cx } from "@/components/ui";
import { ROTULO_QUALIFICACAO, type Lead, type Qualificacao } from "@/lib/calculo/crm";
import { resumoDoQuiz, type VisitaQuiz } from "@/lib/calculo/quizFunil";

const COR_ETIQUETA: Record<Qualificacao, string> = {
  qualificado: "bg-ok-suave text-ok",
  com_ressalva: "bg-aviso-suave text-aviso",
  desqualificado: "bg-erro-suave text-erro",
  social_media: "bg-marca-suave text-marca-forte",
};

export function EtiquetaQuiz({ qualificacao }: { qualificacao: Qualificacao }) {
  return <span className={cx("inline-flex w-fit rounded-botao px-2 py-0.5 text-[10px] font-bold", COR_ETIQUETA[qualificacao])}>{ROTULO_QUALIFICACAO[qualificacao]}</span>;
}

function Linha({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <dt className="shrink-0 text-[11px] font-semibold text-texto-suave sm:w-44">{rotulo}</dt>
      <dd className="text-[13px]">{children}</dd>
    </div>
  );
}

/** Bloco da ficha do lead: o que ele respondeu no quiz e o que pesou na etiqueta. */
export function RespostasDoQuiz({ lead }: { lead: Lead }) {
  const respostas = lead.respostasQuiz ?? [];
  if (!lead.qualificacao && respostas.length === 0 && !lead.empresa && !lead.cidade) return null;
  return (
    <section className="mb-3 rounded-bloco border border-linha bg-superficie-2/40 p-3" aria-label="Respostas do quiz">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <p className="text-xs font-bold uppercase">Quiz</p>
        {lead.qualificacao && <EtiquetaQuiz qualificacao={lead.qualificacao} />}
      </div>
      {lead.qualificacaoMotivos && <p className="mb-2 text-[12px] text-texto-suave">O que pesou na etiqueta: {lead.qualificacaoMotivos}.</p>}
      <dl className="flex flex-col gap-1.5">
        {lead.empresa && <Linha rotulo="Empresa">{lead.empresa}</Linha>}
        {lead.cidade && <Linha rotulo="Cidade">{lead.cidade}</Linha>}
        {respostas.map((r, i) => (
          <Linha key={`${r.pergunta}-${i}`} rotulo={r.pergunta}>
            {r.resposta}
          </Linha>
        ))}
      </dl>
    </section>
  );
}

/** Funil do quiz na tela de Leads. Só aparece quando já houve visitas. */
export function FunilDoQuiz({ visitas }: { visitas: VisitaQuiz[] }) {
  if (visitas.length === 0) return null;
  const r = resumoDoQuiz(visitas);
  return (
    <section className="rounded-bloco border border-linha bg-superficie p-4" aria-label="Funil do quiz">
      <h2 className="text-sm font-bold">Quiz de conversão</h2>
      <p className="mt-0.5 text-[12px] text-texto-suave">
        Cada barra mostra quantas pessoas chegaram naquela tela. A tela onde mais gente para sem enviar é a que vale mexer primeiro.
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-item bg-superficie-2/60 p-2.5">
          <p className="text-[11px] font-semibold text-texto-suave">Começaram</p>
          <p className="numero text-xl font-extrabold">{r.comecaram}</p>
        </div>
        <div className="rounded-item bg-superficie-2/60 p-2.5">
          <p className="text-[11px] font-semibold text-texto-suave">Enviaram o contato</p>
          <p className="numero text-xl font-extrabold">{r.enviaram}</p>
        </div>
        <div className="rounded-item bg-superficie-2/60 p-2.5">
          <p className="text-[11px] font-semibold text-texto-suave">Taxa de envio</p>
          <p className="numero text-xl font-extrabold">{r.taxaDeEnvio.toLocaleString("pt-BR")}%</p>
        </div>
      </div>
      {r.ondeMaisParam && (
        <p className="mt-3 rounded-item bg-aviso-suave px-3 py-2 text-[12px] font-medium text-aviso">
          Onde mais gente para: <strong>{r.ondeMaisParam.rotulo}</strong> ({r.ondeMaisParam.pararamAqui} {r.ondeMaisParam.pararamAqui === 1 ? "pessoa" : "pessoas"}).
        </p>
      )}
      <ol className="mt-3 flex flex-col gap-2">
        {r.telas.map((t) => (
          <li key={t.passo} className="text-[12px]">
            <div className="flex items-baseline gap-2">
              <span className="flex-1 font-semibold">{t.rotulo}</span>
              <span className="text-texto-suave">
                {t.viram} {t.viram === 1 ? "chegou" : "chegaram"}
                {t.pararamAqui > 0 && ` · ${t.pararamAqui} ${t.pararamAqui === 1 ? "parou" : "pararam"} aqui`}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-superficie-2" role="img" aria-label={`${t.pctDeQuemComecou}% de quem começou chegou em ${t.rotulo}`}>
              <div className="h-full rounded-full bg-marca" style={{ width: `${t.pctDeQuemComecou}%` }} />
            </div>
            {t.sePula && <p className="mt-0.5 text-[11px] text-texto-suave">{t.sePula}</p>}
          </li>
        ))}
      </ol>
      <p className="mt-3 text-[11px] text-texto-suave">
        Etiquetas de quem enviou: {r.porEtiqueta.qualificado} qualificado · {r.porEtiqueta.com_ressalva} com ressalva · {r.porEtiqueta.desqualificado} desqualificado · {r.porEtiqueta.social_media} só social media.
      </p>
    </section>
  );
}
