"use client";

// Equipe e acessos: quem entra no Aden e o que cada um vê.
// O convite é pelo e-mail: a pessoa entra em "Primeiro acesso", cria a senha e já cai
// com o acesso escolhido. O banco garante o que cada papel vê (não é só o menu).

import { Mail, Trash2, UserPlus, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge, Botao, CampoTexto, Selecao, Vazio } from "../ui";
import { PAPEIS } from "@/lib/acesso";
import { useDados } from "@/lib/dados/contexto";
import type { Convite, MembroEquipe } from "@/lib/dados/repositorio";

const rotuloPapel = (p: string) => PAPEIS.find((x) => x.valor === p)?.rotulo ?? p;

export function SecaoEquipe() {
  const { repo, usuario } = useDados();
  const [membros, setMembros] = useState<MembroEquipe[]>([]);
  const [convites, setConvites] = useState<Convite[]>([]);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [papel, setPapel] = useState<string | null>("colaborador");
  const [msg, setMsg] = useState<{ tom: "ok" | "erro"; texto: string } | null>(null);

  const carregar = useCallback(async () => {
    const r = await repo.listarEquipe();
    setMembros(r.membros);
    setConvites(r.convites);
  }, [repo]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lista vinda do banco
    void carregar().catch(() => {});
  }, [carregar]);

  const tentar = async (f: () => Promise<void>, ok?: string) => {
    setMsg(null);
    try {
      await f();
      await carregar();
      if (ok) setMsg({ tom: "ok", texto: ok });
    } catch (e) {
      setMsg({ tom: "erro", texto: e instanceof Error ? e.message : "Não deu certo." });
    }
  };

  const endereco = typeof window !== "undefined" ? `${window.location.origin}/entrar` : "/entrar";

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-2 sm:grid-cols-2">
        {PAPEIS.map((p) => (
          <div key={p.valor} className="rounded-bloco bg-superficie-2/60 px-3 py-2 text-[11px] leading-snug">
            <strong className="text-xs">{p.rotulo}:</strong> {p.explica}
          </div>
        ))}
      </div>

      <div className="rounded-bloco border border-linha p-3">
        <p className="mb-2 flex items-center gap-1.5 text-sm font-bold">
          <UserPlus size={15} /> Convidar alguém
        </p>
        <div className="grid items-end gap-3 sm:grid-cols-[1fr_1.2fr_11rem_auto]">
          <CampoTexto rotulo="Nome" valor={nome} aoMudar={setNome} />
          <CampoTexto rotulo="E-mail" valor={email} aoMudar={setEmail} placeholder="a pessoa entra com este e-mail" />
          <Selecao rotulo="Acesso" valor={papel} opcoes={PAPEIS.map((p) => ({ valor: p.valor, rotulo: p.rotulo }))} aoMudar={setPapel} />
          <Botao
            variante="primario"
            icone={Mail}
            disabled={!nome.trim() || !/.+@.+\..+/.test(email) || !papel}
            onClick={() =>
              void tentar(async () => {
                await repo.convidar(nome, email, papel!);
                setNome("");
                setEmail("");
              }, `Convite criado. Mande para a pessoa: entrar em ${endereco}, tocar em "Primeiro acesso? Criar senha" e usar o e-mail ${email.trim().toLowerCase()}.`)
            }
          >
            Convidar
          </Botao>
        </div>
        <p className="mt-2 text-[11px] text-texto-suave">O Aden não manda e-mail sozinho: avise a pessoa por WhatsApp com o endereço de entrada.</p>
      </div>

      {msg && <p className={msg.tom === "ok" ? "rounded-bloco bg-ok-suave px-3 py-2 text-xs text-ok" : "rounded-bloco bg-erro-suave px-3 py-2 text-xs text-erro"}>{msg.texto}</p>}

      {convites.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-bold text-texto-suave">Convites esperando o primeiro acesso</p>
          {convites.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-2 border-b border-linha/60 py-2 text-[13px] last:border-0">
              <span className="flex-1 font-semibold">{c.nome}</span>
              <span className="text-texto-suave">{c.email}</span>
              <Badge>{rotuloPapel(c.papel)}</Badge>
              <Botao pequeno variante="perigo" icone={Trash2} aria-label={`Cancelar convite de ${c.nome}`} onClick={() => void tentar(() => repo.cancelarConvite(c.id))} />
            </div>
          ))}
        </div>
      )}

      <div>
        <p className="mb-1 text-xs font-bold text-texto-suave">Quem tem acesso</p>
        {membros.length === 0 ? (
          <Vazio icone={Users} titulo="Ninguém ainda" />
        ) : (
          membros.map((m) => {
            const eu = m.email === usuario?.email;
            return (
              <div key={m.id} className="flex flex-wrap items-center gap-2 border-b border-linha/60 py-2 text-[13px] last:border-0">
                <span className="flex-1 font-semibold">
                  {m.nome} {eu && <span className="font-normal text-texto-suave">(você)</span>}
                </span>
                <span className="text-texto-suave">{m.email}</span>
                {eu || /conector/i.test(m.nome) ? (
                  <Badge>{rotuloPapel(m.papel)}</Badge>
                ) : (
                  <Selecao
                    className="w-36"
                    ariaLabel={`Acesso de ${m.nome}`}
                    valor={m.papel}
                    opcoes={PAPEIS.map((p) => ({ valor: p.valor, rotulo: p.rotulo }))}
                    aoMudar={(v) => v && v !== m.papel && confirm(`Mudar o acesso de ${m.nome} para ${rotuloPapel(v)}?`) && void tentar(() => repo.mudarAcesso(m.id, { papel: v }))}
                  />
                )}
                {!eu && !/conector/i.test(m.nome) && (
                  <Botao
                    pequeno
                    variante={m.ativo ? "perigo" : "secundario"}
                    onClick={() =>
                      (m.ativo ? confirm(`Tirar o acesso de ${m.nome}? O histórico dele(a) fica guardado.`) : true) &&
                      void tentar(() => repo.mudarAcesso(m.id, { ativo: !m.ativo }))
                    }
                  >
                    {m.ativo ? "Tirar acesso" : "Devolver acesso"}
                  </Botao>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
