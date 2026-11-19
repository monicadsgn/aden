"use client";

// Clientes e contratos: a lista de clientes. Cada um abre na sua própria página (/clientes/[id]).

import { AlertTriangle, ChevronRight, ClipboardList, FileSignature, Plus, Search, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { abaDeTexto, SITUACAO_PAGAMENTO } from "@/components/clientes/FichaCliente";
import { useClientes } from "@/components/clientes/useClientes";
import { CabecalhoPagina } from "@/components/Shell";
import { Badge, Vazio, cx } from "@/components/ui";
import { novoId } from "@/lib/calculo/novo";
import type { ClienteBase } from "@/lib/calculo/tipos";
import { faltaParaComecar } from "@/lib/regras/prontoParaComecar";
import { hojeISO } from "@/lib/calculo/dia";
import { salvarCliente } from "@/lib/dados/acoes";
import { formatarMoeda } from "@/lib/formato";

type Filtro = "todos" | "atencao" | "atrasados";

export default function Clientes() {
  const x = useClientes();
  const router = useRouter();
  const [novo, setNovo] = useState("");
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [verInativos, setVerInativos] = useState(false);

  // links antigos (/clientes?cliente=ID&aba=contrato) levam para a página do cliente
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const id = q.get("cliente");
    if (!id) return;
    const aba = abaDeTexto(q.get("aba"));
    router.replace(`/clientes/${id}${aba && aba !== "visao" ? `?aba=${aba}` : ""}`);
  }, [router]);

  const hoje = hojeISO();
  const pendencias = (c: ClienteBase) => (c.interno ? 0 : faltaParaComecar(c).length + (c.escopo ? 0 : 1));
  const precisaAtencao = (c: ClienteBase) => pendencias(c) > 0 || x.situacao.get(c.id) === "atrasado";

  const lista = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return x.clientes
      .filter((c) => !b || [c.nome, c.segmento, c.contato].filter(Boolean).join(" ").toLowerCase().includes(b))
      .filter((c) => filtro === "todos" || (filtro === "atrasados" ? x.situacao.get(c.id) === "atrasado" : precisaAtencao(c)))
      .sort((p, q) => Number(precisaAtencao(q)) - Number(precisaAtencao(p)) || p.nome.localeCompare(q.nome));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- precisaAtencao só lê os próprios dados
  }, [x.clientes, x.situacao, busca, filtro]);

  if (!x.carregou) return null;

  const ativos = lista.filter((c) => c.ativo);
  const inativos = lista.filter((c) => !c.ativo);
  const total = x.clientes.filter((c) => c.ativo && !c.interno).reduce((s, c) => s + (c.valorMensalCentavos ?? 0), 0);
  const nAtivos = x.clientes.filter((c) => c.ativo).length;
  const nAtencao = x.clientes.filter((c) => c.ativo && precisaAtencao(c)).length;
  const nAtrasados = x.clientes.filter((c) => c.ativo && x.situacao.get(c.id) === "atrasado").length;

  const criar = async () => {
    const nome = novo.trim();
    if (!nome) return;
    const c: ClienteBase = { id: novoId(), nome, interno: false, participaRateio: true, valorMensalCentavos: null, ativo: true, clienteDesde: hoje };
    x.setClientes((l) => [...l, c]);
    setNovo("");
    await salvarCliente(x.repo, c);
    await x.a.recarregar();
    router.push(`/clientes/${c.id}?aba=dados`);
  };

  const linha = (c: ClienteBase) => {
    const abertas = x.a.tarefas.filter((t) => t.clienteId === c.id && t.status !== "concluida").length;
    const s = x.situacao.get(c.id);
    const falta = pendencias(c);
    return (
      <li key={c.id}>
        <Link
          href={`/clientes/${c.id}`}
          className={cx(
            "group flex items-center gap-3 rounded-card border bg-superficie p-3.5 shadow-card transition-colors hover:border-marca sm:gap-4 sm:p-4",
            c.ativo ? "border-linha" : "border-dashed border-linha opacity-70",
          )}
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-bloco bg-marca-suave text-base font-bold text-marca-forte">{c.nome.slice(0, 1).toUpperCase()}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{c.nome}</p>
            <p className="truncate text-[12px] text-texto-suave">{[c.segmento, c.contato].filter(Boolean).join(" · ") || (c.interno ? "projeto interno" : "sem segmento")}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
              {s && s !== "sem_contrato" && <Badge tom={SITUACAO_PAGAMENTO[s].tom}>{SITUACAO_PAGAMENTO[s].rotulo}</Badge>}
              {falta > 0 && (
                <Badge tom="aviso" icone={AlertTriangle}>
                  {falta === 1 ? "falta 1 coisa" : `faltam ${falta} coisas`}
                </Badge>
              )}
              {abertas > 0 && (
                <span className="inline-flex items-center gap-1 text-texto-suave">
                  <ClipboardList size={11} aria-hidden /> {abertas} tarefa{abertas === 1 ? "" : "s"}
                </span>
              )}
            </div>
          </div>
          <div className="hidden shrink-0 text-right sm:block">
            {c.projetoAvulso ? (
              <p className="numero text-sm font-bold">{formatarMoeda(c.projetoAvulso.valorCentavos)}</p>
            ) : c.valorMensalCentavos != null ? (
              <p className="numero text-sm font-bold">
                {formatarMoeda(c.valorMensalCentavos)}
                <span className="text-[11px] font-medium text-texto-suave">/mês</span>
              </p>
            ) : null}
          </div>
          <ChevronRight size={18} className="shrink-0 text-texto-suave transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
      </li>
    );
  };

  const filtros: { v: Filtro; rotulo: string; n: number }[] = [
    { v: "todos", rotulo: "Todos", n: nAtivos },
    { v: "atencao", rotulo: "Pedem atenção", n: nAtencao },
    { v: "atrasados", rotulo: "Atrasados", n: nAtrasados },
  ];

  return (
    <div className="pb-16">
      <CabecalhoPagina icone={FileSignature} selo="Clientes" titulo="Clientes e contratos" descricao="Escolha um cliente para ver tudo dele: contrato, entregas, tarefas, pagamentos e a conversa de antes de fechar." />
      <div className="mx-auto flex max-w-[1100px] flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
        {x.erro && <p className="rounded-card bg-erro-suave px-4 py-3 text-sm text-erro">{x.erro}</p>}

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-card border border-linha bg-superficie p-4 shadow-card">
            <p className="text-[11px] font-bold tracking-wide text-texto-suave uppercase">Clientes ativos</p>
            <p className="numero text-2xl font-bold">{nAtivos}</p>
          </div>
          <div className="rounded-card border border-linha bg-superficie p-4 shadow-card">
            <p className="text-[11px] font-bold tracking-wide text-texto-suave uppercase">Mensalidades somadas</p>
            <p className="numero text-2xl font-bold">{formatarMoeda(total)}</p>
          </div>
          <button
            type="button"
            onClick={() => setFiltro(filtro === "atencao" ? "todos" : "atencao")}
            className={cx("rounded-card border p-4 text-left shadow-card transition-colors", nAtencao ? "border-aviso/40 bg-aviso-suave" : "border-linha bg-superficie")}
          >
            <p className="text-[11px] font-bold tracking-wide text-texto-suave uppercase">Pedem atenção</p>
            <p className="numero text-2xl font-bold">{nAtencao}</p>
            <p className="text-[12px] text-texto-suave">{nAtencao ? "Falta preencher algo ou há pagamento atrasado." : "Tudo em ordem."}</p>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-w-56 flex-1 items-center gap-2 rounded-botao border border-linha bg-superficie px-4 focus-within:border-marca focus-within:ring-2 focus-within:ring-marca/20">
            <Search size={15} className="text-texto-suave" aria-hidden />
            <input className="sem-contorno h-11 flex-1 bg-transparent text-sm outline-none placeholder:text-texto-suave" placeholder="Buscar cliente" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar cliente" />
          </div>
          <div role="group" aria-label="Filtrar clientes" className="inline-flex rounded-botao bg-superficie-2 p-1">
            {filtros.map((f) => (
              <button
                key={f.v}
                type="button"
                aria-pressed={filtro === f.v}
                onClick={() => setFiltro(f.v)}
                className={cx("min-h-9 rounded-botao px-3 text-xs font-semibold pointer-coarse:min-h-11", filtro === f.v ? "bg-superficie text-marca-forte shadow-card" : "text-texto-suave hover:text-texto")}
              >
                {f.rotulo} <span className="numero">{f.n}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-botao border border-dashed border-linha bg-marca-tinta/40 px-4 focus-within:border-marca focus-within:ring-2 focus-within:ring-marca/20">
          <Plus size={15} className="text-texto-suave" aria-hidden />
          <input
            className="sem-contorno h-11 flex-1 bg-transparent text-sm outline-none placeholder:text-texto-suave"
            placeholder="Novo cliente: escreva o nome e aperte Enter"
            value={novo}
            onChange={(e) => setNovo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void criar()}
            aria-label="Novo cliente"
          />
        </div>

        {ativos.length === 0 ? (
          <Vazio icone={Users} titulo={x.clientes.length ? "Nenhum cliente com esse filtro" : "Nenhum cliente ativo"}>
            {x.clientes.length ? "Limpe a busca ou troque o filtro." : "Crie aqui, ou feche um lead em Leads: ele vira cliente com a proposta combinada."}
          </Vazio>
        ) : (
          <ul className="flex flex-col gap-2.5">{ativos.map(linha)}</ul>
        )}
        {inativos.length > 0 && (
          <div>
            <button type="button" className="text-xs font-semibold text-texto-suave hover:text-texto" onClick={() => setVerInativos(!verInativos)}>
              {verInativos ? "Esconder" : "Ver"} {inativos.length} inativo(s)
            </button>
            {verInativos && <ul className="mt-2 flex flex-col gap-2.5">{inativos.map(linha)}</ul>}
          </div>
        )}
      </div>
    </div>
  );
}
