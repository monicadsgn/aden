"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { RepositorioLocal } from "./local";
import type { Repositorio, Usuario } from "./repositorio";
import { RepositorioSupabase } from "./supabase";

interface ContextoDados {
  repo: Repositorio;
  usuario: Usuario | null;
  carregando: boolean;
  atualizarUsuario: () => Promise<void>;
}

const Contexto = createContext<ContextoDados | null>(null);

// Lidas no momento do build (a Vercel embute NEXT_PUBLIC_* no código do site).
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SUPABASE_CHAVE = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

/** Nomes das variáveis que faltaram no build — mostrados na faixa do modo demonstração. */
export const VARIAVEIS_FALTANDO = [
  !SUPABASE_URL && "NEXT_PUBLIC_SUPABASE_URL",
  !SUPABASE_CHAVE && "NEXT_PUBLIC_SUPABASE_ANON_KEY",
].filter(Boolean) as string[];

function criarRepositorio(): Repositorio {
  if (SUPABASE_URL && SUPABASE_CHAVE) return new RepositorioSupabase(SUPABASE_URL, SUPABASE_CHAVE);
  return new RepositorioLocal();
}

export function ProvedorDados({ children }: { children: ReactNode }) {
  const repo = useMemo(() => criarRepositorio(), []);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);

  const atualizarUsuario = useCallback(async () => {
    try {
      setUsuario(await repo.usuarioAtual());
    } catch {
      setUsuario(null);
    } finally {
      setCarregando(false);
    }
  }, [repo]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial da sessão
    void atualizarUsuario();
  }, [atualizarUsuario]);

  return <Contexto.Provider value={{ repo, usuario, carregando, atualizarUsuario }}>{children}</Contexto.Provider>;
}

export function useDados(): ContextoDados {
  const c = useContext(Contexto);
  if (!c) throw new Error("useDados fora do ProvedorDados");
  return c;
}
