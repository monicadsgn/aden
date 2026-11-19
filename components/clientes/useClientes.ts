"use client";

// Carrega e guarda o que a lista de clientes e a página de cada cliente precisam.
// A tela muda na hora; o banco grava quando a pessoa para de digitar.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTarefas } from "@/components/tarefas/useTarefas";
import type { Lead } from "@/lib/calculo/crm";
import { clienteNoMes } from "@/lib/calculo/clientes";
import { hojeISO } from "@/lib/calculo/dia";
import { distribuirPagamentos, type Pagamento, type SituacaoPagamento } from "@/lib/calculo/pagamentos";
import type { ClienteBase } from "@/lib/calculo/tipos";
import { salvarCliente } from "@/lib/dados/acoes";
import { useDados } from "@/lib/dados/contexto";

export function useClientes() {
  const a = useTarefas();
  const { repo } = useDados();
  const [clientes, setClientes] = useState<ClienteBase[]>([]);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [carregou, setCarregou] = useState(false);
  const pendentes = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const recarregar = useCallback(async () => {
    const c = await repo.carregarConfig();
    setClientes(c.clientes);
  }, [repo]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial vinda do banco
    void recarregar()
      .catch((e) => setErro(e instanceof Error ? e.message : "Erro ao carregar."))
      .finally(() => setCarregou(true));
    repo.listarPagamentos().then(setPagamentos).catch(() => setErro("Não consegui carregar os pagamentos. Recarregue a página."));
    repo.listarLeads().then(setLeads).catch(() => setErro("Não consegui carregar os leads. Recarregue a página."));
  }, [repo, recarregar]);

  const salvar = async (c: ClienteBase) => {
    setClientes((l) => l.map((x) => (x.id === c.id ? c : x)));
    const t = pendentes.current.get(c.id);
    if (t) clearTimeout(t);
    pendentes.current.set(
      c.id,
      setTimeout(() => {
        pendentes.current.delete(c.id);
        salvarCliente(repo, c).catch((e) => setErro(e instanceof Error ? e.message : "Não deu para salvar."));
      }, 700),
    );
  };

  const hoje = hojeISO();
  const cfg = a.config;
  const situacao = useMemo(() => {
    const m = new Map<string, SituacaoPagamento>();
    for (const c of clientes) if (c.ativo && !c.interno && clienteNoMes(c, hoje.slice(0, 7))) m.set(c.id, distribuirPagamentos({ ...cfg, clientes }, c, hoje.slice(0, 7), pagamentos, hoje).situacao);
    return m;
  }, [cfg, clientes, pagamentos, hoje]);

  return { a, repo, clientes, setClientes, pagamentos, leads, erro, setErro, carregou: carregou && a.carregado, situacao, salvar, recarregar, cfg };
}
