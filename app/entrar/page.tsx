"use client";

import { ArrowRight, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Marca } from "@/components/Marca";
import { Botao, CampoTexto, Forma } from "@/components/ui";
import { useDados } from "@/lib/dados/contexto";

export default function Entrar() {
  const { repo, usuario, atualizarUsuario } = useDados();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [primeiro, setPrimeiro] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (repo.modo === "local" || usuario) router.replace("/hoje");
  }, [repo.modo, usuario, router]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <Forma className="-top-40 -left-40 size-[520px] text-marca/10" />
      <Forma variante={3} className="-right-32 -bottom-40 size-[460px] text-destaque/15" />
      <form
        className="relative w-full max-w-sm rounded-card border border-linha bg-superficie p-8 shadow-forte"
        onSubmit={async (e) => {
          e.preventDefault();
          setErro(null);
          setAviso(null);
          setEnviando(true);
          try {
            if (primeiro) {
              if (senha.length < 8) throw new Error("Use uma senha com pelo menos 8 caracteres.");
              const r = await repo.criarConta(email, senha);
              if (r === "confirmar") {
                setAviso("Pronto! Enviamos um e-mail para confirmar. Clique no link e depois volte aqui para entrar.");
                setPrimeiro(false);
                return;
              }
            } else {
              await repo.entrar(email, senha);
            }
            await atualizarUsuario();
          } catch (x) {
            setErro(x instanceof Error ? x.message : "Não foi possível entrar.");
          } finally {
            setEnviando(false);
          }
        }}
      >
        <Marca />
        <h1 className="mt-6 text-xl font-bold">{primeiro ? "Primeiro acesso" : "Entrar"}</h1>
        <p className="mt-1 text-sm text-texto-suave">
          {primeiro ? "Recebeu um convite? Use o e-mail do convite e crie a sua senha." : "Acesso da equipe Aden."}
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <CampoTexto rotulo="E-mail" valor={email} aoMudar={setEmail} placeholder="voce@aden…" />
          <div>
            <label className="mb-1 block text-xs font-semibold text-texto-suave" htmlFor="senha">
              Senha
            </label>
            <input
              id="senha"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="h-10 w-full rounded-campo border border-linha bg-superficie px-3 text-sm focus:border-marca focus:ring-2 focus:ring-marca/20 focus:outline-none"
            />
          </div>
          {erro && <p className="rounded-campo bg-erro-suave px-3 py-2 text-xs font-semibold text-erro">{erro}</p>}
          {aviso && <p className="rounded-campo bg-ok-suave px-3 py-2 text-xs font-semibold text-ok">{aviso}</p>}
          <Botao type="submit" variante="primario" disabled={enviando} className="mt-2 w-full">
            <Lock size={15} /> {enviando ? "Um momento…" : primeiro ? "Criar minha senha" : "Entrar"} <ArrowRight size={15} />
          </Botao>
          <button
            type="button"
            className="text-xs font-semibold text-marca-forte hover:underline"
            onClick={() => {
              setPrimeiro(!primeiro);
              setErro(null);
              setAviso(null);
            }}
          >
            {primeiro ? "Já tenho senha: entrar" : "Primeiro acesso? Criar senha"}
          </button>
        </div>
      </form>
    </div>
  );
}
