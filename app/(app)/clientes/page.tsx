"use client";

// Clientes e contratos: a lista de clientes e a ficha de cada um.

import { Building2, ClipboardList, Plus, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FichaCliente, SITUACAO_PAGAMENTO } from "@/components/clientes/FichaCliente";
import { CabecalhoPagina } from "@/components/Shell";
import { useTarefas } from "@/components/tarefas/useTarefas";
import { Badge, Vazio, cx } from "@/components/ui";
import type { Lead } from "@/lib/calculo/crm";
import { clienteNoMes } from "@/lib/calculo/clientes";
import { hojeISO } from "@/lib/calculo/dia";
import { novoId } from "@/lib/calculo/novo";
import { distribuirPagamentos, type Pagamento, type SituacaoPagamento } from "@/lib/calculo/pagamentos";
import type { ClienteBase } from "@/lib/calculo/tipos";
import { salvarCliente } from "@/lib/dados/acoes";
import { useDados } from "@/lib/dados/contexto";
import { formatarMoeda } from "@/lib/formato";

export default function Clientes() {
  const a = useTarefas();
  const { repo } = useDados();
  const [clientes, setClientes] = useState<ClienteBase[]>([]);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [aberto, setAberto] = useState<string | null>(null);
  const [novo, setNovo] = useState("");
  const [verInativos, setVerInativos] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const pendentes = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const recarregar = useCallback(async () => {
    const c = await repo.carregarConfig();
    setClientes(c.clientes);
  }, [repo]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial vinda do banco
    void recarregar().catch((e) => setErro(e instanceof Error ? e.message : "Erro ao carregar."));
    repo.listarPagamentos().then(setPagamentos).catch(() => {});
    repo.listarLeads().then(setLeads).catch(() => {});
    const id = new URLSearchParams(window.location.search).get("cliente");
    if (id) setAberto(id);
  }, [repo, recarregar]);

  // a tela muda na hora; o banco grava quando a pessoa para de digitar
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

  if (!a.carregado) return null;

  const ativos = clientes.filter((c) => c.ativo);
  const inativos = clientes.filter((c) => !c.ativo);
  const cliente = clientes.find((c) => c.id === aberto) ?? null;
  const total = ativos.filter((c) => !c.interno).reduce((s, c) => s + (c.valorMensalCentavos ?? 0), 0);

  const criar = async () => {
    const nome = novo.trim();
    if (!nome) return;
    const c: ClienteBase = { id: novoId(), nome, interno: false, participaRateio: true, valorMensalCentavos: null, ativo: true, clienteDesde: hoje };
    setClientes((l) => [...l, c]);
    setNovo("");
    await salvarCliente(repo, c);
    await a.recarregar();
    setAberto(c.id);
  };

  const cartao = (c: ClienteBase) => {
    const abertas = a.tarefas.filter((t) => t.clienteId === c.id && t.status !== "concluida").length;
    const s = situacao.get(c.id);
    return (
      <button
        key={c.id}
        type="button"
        onClick={() => setAberto(c.id)}
        className={cx("flex flex-col gap-2 rounded-card border bg-superficie p-4 text-left shadow-card transition-colors hover:border-marca", c.ativo ? "border-linha" : "border-dashed border-linha opacity-70")}
      >
        <div className="flex items-start gap-2">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-bloco bg-marca-suave text-sm font-bold text-marca-forte">{c.nome.slice(0, 1).toUpperCase()}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{c.nome}</p>
            <p className="truncate text-[11px] text-texto-suave">{[c.segmento, c.contato].filter(Boolean).join(" · ") || (c.interno ? "projeto interno" : "—")}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          {c.valorMensalCentavos != null && <span className="numero font-bold">{formatarMoeda(c.valorMensalCentavos)}/mês</span>}
          {s && s !== "sem_contrato" && <Badge tom={SITUACAO_PAGAMENTO[s].tom}>{SITUACAO_PAGAMENTO[s].rotulo}</Badge>}
          {!c.escopo && !c.interno && <Badge tom="aviso">sem escopo</Badge>}
          {abertas > 0 && (
            <span className="inline-flex items-center gap-1 text-texto-suave">
              <ClipboardList size={11} /> {abertas} tarefa{abertas === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </button>
    );
  };

  return (
    <div className="pb-16">
      <CabecalhoPagina
        icone={Building2}
        selo="Administrativo"
        titulo="Clientes e contratos"
        descricao="A ficha de cada cliente: contato, contrato, escopo, tarefas, pagamentos e a conversa que veio do CRM."
      />
      <div className="mx-auto flex max-w-[1300px] flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
        {erro && <p className="rounded-card bg-erro-suave px-4 py-3 text-sm text-erro">{erro}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-w-64 flex-1 items-center gap-2 rounded-botao border border-linha bg-superficie px-4 focus-within:border-marca focus-within:ring-2 focus-within:ring-marca/20">
            <Plus size={15} className="text-texto-suave" />
            <input
              className="sem-contorno h-11 flex-1 bg-transparent text-sm outline-none placeholder:text-texto-suave"
              placeholder="Novo cliente: escreva o nome e aperte Enter"
              value={novo}
              onChange={(e) => setNovo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void criar()}
              aria-label="Novo cliente"
            />
          </div>
          <p className="text-xs text-texto-suave">
            {ativos.length} ativo{ativos.length === 1 ? "" : "s"} · <span className="numero font-semibold text-texto">{formatarMoeda(total)}</span>/mês
          </p>
        </div>

        {ativos.length === 0 ? (
          <Vazio icone={Users} titulo="Nenhum cliente ativo">
            Crie aqui, ou feche um lead no CRM: ele vira cliente com a proposta combinada.
          </Vazio>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{ativos.map(cartao)}</div>
        )}
        {inativos.length > 0 && (
          <div>
            <button type="button" className="text-xs font-semibold text-texto-suave hover:text-texto" onClick={() => setVerInativos(!verInativos)}>
              {verInativos ? "Esconder" : "Ver"} {inativos.length} inativo(s)
            </button>
            {verInativos && <div className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{inativos.map(cartao)}</div>}
          </div>
        )}
      </div>
      <FichaCliente
        cliente={cliente}
        config={{ ...cfg, clientes }}
        a={a}
        pagamentos={pagamentos}
        situacaoMes={cliente ? (situacao.get(cliente.id) ?? null) : null}
        leads={leads}
        aoSalvar={salvar}
        aoRecarregar={async () => {
          await recarregar();
          await a.recarregar();
        }}
        aoFechar={() => setAberto(null)}
      />
    </div>
  );
}
