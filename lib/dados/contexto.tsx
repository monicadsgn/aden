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

/** Configuração de conexão lida no servidor, a cada acesso (ver app/layout.tsx). */
export interface ConexaoSupabase {
  url: string | null;
  chave: string | null;
  /** nomes das variáveis que não foram encontradas no servidor */
  faltando: string[];
}

function criarRepositorio(c: ConexaoSupabase): Repositorio {
  if (c.url && c.chave) return new RepositorioSupabase(c.url, c.chave);
  return new RepositorioLocal();
}

const ContextoConexao = createContext<ConexaoSupabase>({ url: null, chave: null, faltando: [] });

/** Variáveis que faltaram — mostradas na faixa do modo demonstração. */
export function useVariaveisFaltando(): string[] {
  return useContext(ContextoConexao).faltando;
}

export function ProvedorDados({ children, conexao }: { children: ReactNode; conexao: ConexaoSupabase }) {
  const repo = useMemo(() => criarRepositorio(conexao), [conexao]);
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

  return (
    <ContextoConexao.Provider value={conexao}>
      <Contexto.Provider value={{ repo, usuario, carregando, atualizarUsuario }}>{children}</Contexto.Provider>
    </ContextoConexao.Provider>
  );
}

export function useDados(): ContextoDados {
  const c = useContext(Contexto);
  if (!c) throw new Error("useDados fora do ProvedorDados");
  return c;
}
