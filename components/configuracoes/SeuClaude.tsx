"use client";

// Seu Claude: código pessoal do conector (Fase 4). Cada sócio gera o seu e cola o endereço no claude.ai.
// Com ele, tudo o que o Claude faz fica no Histórico no nome do sócio, "pelo Claude". O código aparece uma vez só.

import { Bot, Copy, KeyRound, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge, Botao } from "../ui";
import { useDados } from "@/lib/dados/contexto";
import type { PortaDeAcesso, UsoDoConector } from "@/lib/dados/repositorio";

const quando = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "nunca");

export function SeuClaude() {
  const { repo, usuario } = useDados();
  const [codigos, setCodigos] = useState<PortaDeAcesso[]>([]);
  const [uso, setUso] = useState<UsoDoConector[]>([]);
  const [novo, setNovo] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tom: "ok" | "erro"; texto: string } | null>(null);

  const carregar = useCallback(async () => {
    const [c, u] = await Promise.all([repo.listarCodigosClaude(), repo.usoDoConector()]);
    setCodigos(c);
    setUso(u);
  }, [repo]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lista vinda do banco
    void carregar().catch(() => {});
  }, [carregar]);

  if (repo.modo === "local" || !usuario?.pessoaId || usuario.papel !== "admin") return null;
  const origem = typeof window !== "undefined" ? window.location.origin : "";
  const endereco = novo ? `${origem}/api/mcp/${novo}` : null;
  const abertos = codigos.filter((p) => !p.canceladoEm);

  const gerar = async () => {
    setMsg(null);
    if (abertos.length && !confirm("Gerar um código novo? O anterior continua valendo até você cancelar.")) return;
    try {
      setNovo(await repo.gerarCodigoClaude());
      await carregar();
    } catch (e) {
      setMsg({ tom: "erro", texto: e instanceof Error ? e.message : "Não deu para gerar." });
    }
  };

  const cancelar = async (p: PortaDeAcesso) => {
    if (!confirm(`Cancelar o código ${p.inicio}…? O Claude que usa ele perde o acesso na hora.`)) return;
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
        <Bot size={15} /> Seu Claude
      </p>
      <p className="mb-3 text-[12px] text-texto-suave">
        O endereço para o Claude (claude.ai) usar o Aden como você. Tudo o que ele fizer fica no Histórico no seu nome, com “pelo Claude”. Mudança
        protegida que só afeta você vale na hora; se afeta o outro sócio, vira pedido para ele. O Claude nunca aprova pedido.
      </p>

      {uso.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {uso.map((u) => (
            <Badge key={u.pessoaId} tom={u.ultimoUso ? "ok" : u.temCodigo ? "aviso" : "neutro"}>
              {u.nome}: {u.ultimoUso ? `usando (último uso ${quando(u.ultimoUso)})` : u.temCodigo ? "código criado, ainda não usou" : "sem código"}
            </Badge>
          ))}
        </div>
      )}

      {endereco && (
        <div className="mb-3 rounded-bloco bg-aviso-suave p-3 text-xs text-aviso">
          <p className="font-bold">Copie agora: este endereço não aparece de novo.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 rounded-item bg-superficie px-2 py-1.5 text-[12px] break-all text-texto">{endereco}</code>
            <Botao pequeno icone={Copy} onClick={() => void navigator.clipboard?.writeText(endereco).then(() => setMsg({ tom: "ok", texto: "Endereço copiado." }))}>
              Copiar
            </Botao>
          </div>
          <p className="mt-2 text-[12px]">Ele funciona como uma senha: não mande por grupo nem para outra pessoa.</p>
        </div>
      )}

      {abertos.length > 0 && (
        <div className="mb-3 flex flex-col gap-1.5">
          {abertos.map((p) => (
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
        {abertos.length ? "Gerar outro endereço" : "Gerar meu endereço"}
      </Botao>
      {msg && <p className={`mt-2 text-xs font-semibold ${msg.tom === "erro" ? "text-erro" : "text-ok"}`}>{msg.texto}</p>}

      <details className="mt-3 text-[12px] text-texto-suave">
        <summary className="cursor-pointer font-semibold">Passo a passo para ligar no claude.ai</summary>
        <ol className="mt-2 flex list-decimal flex-col gap-1 pl-5">
          <li>Aqui: clique em “Gerar meu endereço” e em “Copiar”.</li>
          <li>No claude.ai (com a sua conta): Configurações → Conectores → Adicionar conector personalizado.</li>
          <li>Nome: Aden. Endereço: cole o que você copiou. Salve.</li>
          <li>Numa conversa nova, ligue o conector Aden (botão de ferramentas, embaixo da caixa de texto).</li>
          <li>Teste: pergunte “o que tenho pra hoje?”. A resposta vem da Visão do dia.</li>
          <li>Confira: depois de o Claude mudar alguma coisa, ela aparece no Histórico com o seu nome e “(pelo Claude)”.</li>
          <li>Trocou de computador ou acha que alguém viu o endereço? Gere outro e cancele o antigo.</li>
        </ol>
      </details>
    </div>
  );
}
