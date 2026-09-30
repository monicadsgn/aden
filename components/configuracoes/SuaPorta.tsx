"use client";

// Sua porta de acesso: um código pessoal para outro sistema ver e mexer nas SUAS tarefas.
// O código aparece uma vez só; o Aden guarda só o começo dele. Cancelar fecha a porta na hora.

import { Copy, KeyRound, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge, Botao } from "../ui";
import { useDados } from "@/lib/dados/contexto";
import type { PortaDeAcesso } from "@/lib/dados/repositorio";
import { COMO_USAR_PORTA } from "@/lib/porta";

const quando = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "nunca");

export function SuaPorta() {
  const { repo, usuario } = useDados();
  const [portas, setPortas] = useState<PortaDeAcesso[]>([]);
  const [novo, setNovo] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tom: "ok" | "erro"; texto: string } | null>(null);

  const carregar = useCallback(async () => setPortas(await repo.listarPortas()), [repo]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lista vinda do banco
    void carregar().catch(() => {});
  }, [carregar]);

  if (repo.modo === "local" || !usuario?.pessoaId || usuario.papel !== "admin") return null;
  const endereco = typeof window !== "undefined" ? `${window.location.origin}/api/porta` : "/api/porta";
  const abertas = portas.filter((p) => !p.canceladoEm);

  const gerar = async () => {
    setMsg(null);
    try {
      setNovo(await repo.gerarPorta());
      await carregar();
    } catch (e) {
      setMsg({ tom: "erro", texto: e instanceof Error ? e.message : "Não deu para gerar." });
    }
  };

  const cancelar = async (p: PortaDeAcesso) => {
    if (!confirm(`Cancelar o código ${p.inicio}…? Quem usa ele perde o acesso na hora.`)) return;
    try {
      await repo.cancelarPorta(p.id);
      await carregar();
      setMsg({ tom: "ok", texto: "Código cancelado." });
    } catch (e) {
      setMsg({ tom: "erro", texto: e instanceof Error ? e.message : "Não deu para cancelar." });
    }
  };

  return (
    <div className="rounded-bloco border border-linha p-3">
      <p className="mb-1 flex items-center gap-1.5 text-sm font-bold">
        <KeyRound size={15} /> Sua porta de acesso
      </p>
      <p className="mb-3 text-[12px] text-texto-suave">
        Um código só seu, para outro sistema ver e mexer nas suas tarefas (as que têm você como responsável) sem entrar no Aden. Tudo o que chegar por ele fica no
        Histórico no seu nome. Não abre valores, piso nem financeiro. Cancele quando não precisar mais.
      </p>

      {novo && (
        <div className="mb-3 rounded-bloco bg-aviso-suave p-3 text-xs text-aviso">
          <p className="font-bold">Copie agora: este código não aparece de novo.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 rounded-item bg-superficie px-2 py-1.5 text-[12px] break-all text-texto">{novo}</code>
            <Botao pequeno icone={Copy} onClick={() => void navigator.clipboard?.writeText(novo).then(() => setMsg({ tom: "ok", texto: "Código copiado." }))}>
              Copiar
            </Botao>
          </div>
          <p className="mt-2 text-[12px]">
            Endereço: <code className="break-all">{endereco}</code>
          </p>
        </div>
      )}

      {abertas.length > 0 && (
        <div className="mb-3 flex flex-col gap-1.5">
          {abertas.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-item bg-superficie-2/60 px-3 py-2 text-[12px]">
              <code className="font-semibold">{p.inicio}…</code>
              <span className="flex-1 text-texto-suave">
                criado {quando(p.criadoEm)} · último uso {quando(p.usadoEm)}
              </span>
              <Badge tom="ok">ativo</Badge>
              <Botao pequeno variante="perigo" icone={XCircle} onClick={() => void cancelar(p)}>
                Cancelar
              </Botao>
            </div>
          ))}
        </div>
      )}

      <Botao pequeno icone={KeyRound} onClick={() => void gerar()}>
        {abertas.length ? "Gerar outro código" : "Gerar meu código"}
      </Botao>
      {msg && <p className={`mt-2 text-xs font-semibold ${msg.tom === "erro" ? "text-erro" : "text-ok"}`}>{msg.texto}</p>}

      <details className="mt-3 text-[12px] text-texto-suave">
        <summary className="cursor-pointer font-semibold">Como o outro sistema usa</summary>
        <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
          <li>{COMO_USAR_PORTA.autenticacao}</li>
          <li>{COMO_USAR_PORTA.ler}</li>
          <li>{COMO_USAR_PORTA.salvar}</li>
          <li>{COMO_USAR_PORTA.status}</li>
        </ul>
      </details>
    </div>
  );
}
