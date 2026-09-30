"use client";

// Modelo do contrato (Fase 5, passo 3): o que é igual em todo contrato da Aden. O texto é dos sócios: o sistema
// não escreve cláusula. As partes que mudam a cada cliente saem da ficha. Salva ao sair do campo.

import { Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge, Botao } from "../ui";
import type { ModeloContrato } from "@/lib/calculo/contrato";
import { useDados } from "@/lib/dados/contexto";

const campo = "h-9 rounded-campo border border-linha bg-superficie px-2 text-sm outline-none focus:border-marca focus:ring-2 focus:ring-marca/20";
const area = "min-h-40 rounded-campo border border-linha bg-superficie px-3 py-2 text-sm outline-none focus:border-marca focus:ring-2 focus:ring-marca/20";

export function SecaoContrato() {
  const { repo } = useDados();
  const [m, setM] = useState<ModeloContrato | null>(null);
  const [autentique, setAutentique] = useState<{ ligada: boolean; teste?: boolean } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  const carregar = useCallback(async () => setM(await repo.obterModeloContrato()), [repo]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- dados vindos do banco
    void carregar().catch((e) => setErro(e instanceof Error ? e.message : "Não deu para carregar."));
    void repo
      .contratoNoServidor({ acao: "situacao" })
      .then((r) => setAutentique({ ligada: r.autentiqueLigada, teste: r.teste }))
      .catch(() => setAutentique({ ligada: false }));
  }, [carregar, repo]);

  if (!m) return erro ? <p className="text-xs font-semibold text-erro">{erro}</p> : null;

  const salvar = async (patch: Partial<ModeloContrato>) => {
    const novo = { ...m, ...patch };
    setM(novo);
    setErro(null);
    setSalvo(false);
    try {
      await repo.salvarModeloContrato(novo);
      setSalvo(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para salvar.");
    }
  };

  const texto = (k: keyof Omit<ModeloContrato, "signatariosAden">, rotulo: string, dica?: string) => (
    <label className="flex min-w-60 flex-1 flex-col gap-1 text-xs font-semibold text-texto-suave">
      {rotulo}
      <input key={`${k}-${m[k] ?? ""}`} className={campo} defaultValue={m[k] ?? ""} onBlur={(e) => e.target.value.trim() !== (m[k] ?? "") && void salvar({ [k]: e.target.value })} />
      {dica && <span className="text-[11px] font-normal">{dica}</span>}
    </label>
  );

  const paragrafo = (k: "obrigacoes" | "disposicoes", rotulo: string, dica: string) => (
    <label className="flex flex-col gap-1 text-xs font-semibold text-texto-suave">
      {rotulo}
      <span className="text-[12px] font-normal">{dica}</span>
      <textarea key={`${k}-${m[k] ?? ""}`} className={area} defaultValue={m[k] ?? ""} onBlur={(e) => e.target.value.trim() !== (m[k] ?? "") && void salvar({ [k]: e.target.value })} />
    </label>
  );

  const signatarios = m.signatariosAden.length ? m.signatariosAden : [];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[12px] text-texto-suave">
        O contrato de cada cliente sai daqui e da ficha dele (partes, o que está incluso, valor, vencimento, prazo e condições). Obrigações e disposições gerais
        são o texto de vocês: o Aden não escreve cláusula. Enquanto algo estiver vazio, a ficha mostra o que falta e não deixa enviar.
      </p>
      <p className="flex flex-wrap items-center gap-2 text-[12px] text-texto-suave">
        Assinatura eletrônica:
        {autentique == null ? (
          <Badge>conferindo…</Badge>
        ) : autentique.ligada ? (
          <Badge tom="ok">Autentique ligada{autentique.teste ? " (modo teste)" : ""}</Badge>
        ) : (
          <Badge tom="aviso">Autentique ainda não ligada</Badge>
        )}
        {autentique && !autentique.ligada && <span>Falta salvar a chave da API da conta da Aden na Vercel (AUTENTIQUE_TOKEN).</span>}
      </p>

      <div className="flex flex-col gap-2 rounded-bloco border border-linha p-3">
        <strong className="text-sm">Contratada</strong>
        <div className="flex flex-wrap gap-2">
          {texto("contratadaNome", "Nome (razão social)")}
          {texto("contratadaDocumento", "CNPJ")}
          {texto("contratadaEndereco", "Endereço")}
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-bloco border border-linha p-3">
        <strong className="text-sm">Quem assina pela Aden</strong>
        <p className="text-[12px] text-texto-suave">Cada pessoa recebe o contrato por e-mail da Autentique, junto com o cliente.</p>
        {signatarios.map((s, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <input
              key={`n-${i}-${s.nome}`}
              aria-label="Nome"
              placeholder="Nome"
              className={`${campo} min-w-48 flex-1`}
              defaultValue={s.nome}
              onBlur={(e) => e.target.value !== s.nome && void salvar({ signatariosAden: signatarios.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)) })}
            />
            <input
              key={`e-${i}-${s.email}`}
              aria-label="E-mail"
              placeholder="e-mail"
              type="email"
              className={`${campo} min-w-60 flex-1`}
              defaultValue={s.email}
              onBlur={(e) => e.target.value !== s.email && void salvar({ signatariosAden: signatarios.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)) })}
            />
            <Botao pequeno variante="fantasma" icone={Trash2} aria-label="Tirar" onClick={() => void salvar({ signatariosAden: signatarios.filter((_, j) => j !== i) })} />
          </div>
        ))}
        <div>
          <Botao pequeno icone={Plus} onClick={() => setM({ ...m, signatariosAden: [...signatarios, { nome: "", email: "" }] })}>
            Adicionar quem assina
          </Botao>
        </div>
      </div>

      {paragrafo("obrigacoes", "Obrigações das partes", "O que a Aden faz e o que o cliente precisa fazer. Um parágrafo por cláusula, separados por uma linha em branco.")}
      {paragrafo("disposicoes", "Disposições gerais", "Rescisão, confidencialidade, foro etc. Um parágrafo por cláusula, separados por uma linha em branco.")}

      {erro && <p className="text-xs font-semibold text-erro">{erro}</p>}
      {salvo && !erro && <p className="text-xs text-texto-suave">Salvo.</p>}
    </div>
  );
}
