"use client";

// Texto do onboarding (Fase 5, passo 5): é dos sócios, o sistema não escreve. Cada seção tem título e texto;
// as marcadas como automáticas ganham a parte que vem do cliente (pacote, serviços, contrato, contato). Salva ao sair do campo.

import { useCallback, useEffect, useState } from "react";
import { Badge } from "../ui";
import type { ChaveSecao, ModeloOnboarding } from "@/lib/calculo/onboarding";
import type { Servico } from "@/lib/calculo/tipos";
import { useDados } from "@/lib/dados/contexto";

const campo = "h-9 rounded-campo border border-linha bg-superficie px-2 text-sm outline-none focus:border-marca focus:ring-2 focus:ring-marca/20";
const area = "min-h-24 rounded-campo border border-linha bg-superficie px-3 py-2 text-sm outline-none focus:border-marca focus:ring-2 focus:ring-marca/20";

const AUTOMATICO: Record<ChaveSecao, string | null> = {
  livre: null,
  incluso: "+ o que está incluso, do pacote do cliente",
  servicos: "+ como funciona cada serviço contratado (abaixo) e a garantia, se o contrato tiver",
  prazos: "+ ajustes por peça, prazo de aprovação e reuniões por mês, do contrato",
  contato: "+ WhatsApp, Instagram, e-mail e atendimento (abaixo)",
};

export function SecaoOnboarding({ servicos }: { servicos: Servico[] }) {
  const { repo } = useDados();
  const [m, setM] = useState<ModeloOnboarding | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  const carregar = useCallback(async () => setM(await repo.obterModeloOnboarding()), [repo]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- dados vindos do banco
    void carregar().catch((e) => setErro(e instanceof Error ? e.message : "Não deu para carregar."));
  }, [carregar]);

  if (!m) return erro ? <p className="text-xs font-semibold text-erro">{erro}</p> : null;

  const salvar = async (novo: ModeloOnboarding) => {
    setM(novo);
    setErro(null);
    setSalvo(false);
    try {
      await repo.salvarModeloOnboarding(novo);
      setSalvo(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para salvar.");
    }
  };

  const linha = (k: "whatsapp" | "instagram" | "email" | "atendimento" | "textoGarantia", rotulo: string, dica?: string) => (
    <label className="flex min-w-60 flex-1 flex-col gap-1 text-xs font-semibold text-texto-suave">
      {rotulo}
      <input key={`${k}-${m[k] ?? ""}`} className={campo} defaultValue={m[k] ?? ""} onBlur={(e) => e.target.value.trim() !== (m[k] ?? "") && void salvar({ ...m, [k]: e.target.value })} />
      {dica && <span className="text-[12px] font-normal">{dica}</span>}
    </label>
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[12px] text-texto-suave">
        O onboarding que cada cliente recebe (ficha do cliente → Comercial → Fechamento → Gerar onboarding). O texto é de vocês; o Aden só junta com o que é do
        cliente. No texto: &quot;- &quot; no começo da linha vira lista, &quot;1. &quot; vira lista numerada, linha em branco separa parágrafos, e {"{atendimento}"} é
        trocado pelos dias e horário.
      </p>

      {m.secoes.map((s, i) => (
        <div key={i} className="flex flex-col gap-1.5 rounded-bloco border border-linha p-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              key={`t-${i}-${s.titulo}`}
              aria-label="Título da seção"
              className={`${campo} min-w-60 flex-1 font-semibold`}
              defaultValue={s.titulo}
              onBlur={(e) => e.target.value.trim() && e.target.value !== s.titulo && void salvar({ ...m, secoes: m.secoes.map((x, j) => (j === i ? { ...x, titulo: e.target.value } : x)) })}
            />
            {AUTOMATICO[s.chave] && <Badge tom="info">automático</Badge>}
          </div>
          {AUTOMATICO[s.chave] && <p className="text-[12px] text-texto-suave">{AUTOMATICO[s.chave]}</p>}
          <textarea
            key={`x-${i}-${s.texto}`}
            aria-label={`Texto de ${s.titulo}`}
            className={area}
            defaultValue={s.texto}
            onBlur={(e) => e.target.value !== s.texto && void salvar({ ...m, secoes: m.secoes.map((x, j) => (j === i ? { ...x, texto: e.target.value } : x)) })}
          />
        </div>
      ))}

      <div className="flex flex-col gap-2 rounded-bloco border border-linha p-3">
        <strong className="text-sm">Como funciona cada serviço</strong>
        <p className="text-[12px] text-texto-suave">Entra só o serviço que o cliente contratou.</p>
        {servicos
          .filter((s) => s.ativo)
          .map((s) => (
            <label key={s.id} className="flex flex-col gap-1 text-xs font-semibold text-texto-suave">
              {s.nome}
              <textarea
                key={`s-${s.id}-${m.textoServico[s.id] ?? ""}`}
                className={area}
                defaultValue={m.textoServico[s.id] ?? ""}
                onBlur={(e) => e.target.value !== (m.textoServico[s.id] ?? "") && void salvar({ ...m, textoServico: { ...m.textoServico, [s.id]: e.target.value } })}
              />
            </label>
          ))}
        {linha("textoGarantia", "Frase da garantia", "Entra quando o contrato do cliente tem garantia, seguida do que conta como resultado (da ficha).")}
      </div>

      <div className="flex flex-col gap-2 rounded-bloco border border-linha p-3">
        <strong className="text-sm">Contato e atendimento</strong>
        <div className="flex flex-wrap gap-2">
          {linha("whatsapp", "WhatsApp")}
          {linha("instagram", "Instagram")}
          {linha("email", "E-mail")}
          {linha("atendimento", "Dias e horário de atendimento", "ex.: segunda a sexta, das … às …")}
        </div>
      </div>

      {erro && <p className="text-xs font-semibold text-erro">{erro}</p>}
      {salvo && !erro && <p className="text-xs text-texto-suave">Salvo.</p>}
    </div>
  );
}
