"use client";

// Visão geral do cliente: só leitura, o que importa de relance. Cada cartão leva à parte
// da ficha onde se mexe (a ficha não abre mais com campos editáveis).

import { ArrowRight, ClipboardList, FileSignature, Mail, MessageCircle, Package, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "../ui";
import { dataBr } from "./campos";
import { fimDaFidelidade, prazoDoAvisoPrevio, proximoVencimento } from "@/lib/calculo/clientes";
import { hojeISO } from "@/lib/calculo/dia";
import type { SituacaoPagamento } from "@/lib/calculo/pagamentos";
import type { Tarefa } from "@/lib/calculo/tarefas";
import type { ClienteBase, DadosContrato } from "@/lib/calculo/tipos";
import { formatarMoeda } from "@/lib/formato";
import type { Aba } from "./FichaCliente";

function Cartao({ icone: Ic, titulo, ir, aoIr, children }: { icone: typeof Wallet; titulo: string; ir: string; aoIr: () => void; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-card border border-linha bg-superficie p-4 shadow-card">
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-bloco bg-marca-suave text-marca-forte">
          <Ic size={16} aria-hidden />
        </span>
        <h3 className="flex-1 text-sm font-bold">{titulo}</h3>
        <button type="button" onClick={aoIr} className="inline-flex items-center gap-1 text-xs font-semibold text-marca-forte hover:underline">
          {ir} <ArrowRight size={12} aria-hidden />
        </button>
      </div>
      <div className="text-sm">{children}</div>
    </section>
  );
}

const Fraco = ({ children }: { children: ReactNode }) => <p className="text-[13px] text-texto-suave">{children}</p>;

export function VisaoCliente({
  c,
  contrato,
  entregas,
  abertas,
  entrouNoMes,
  situacaoMes,
  nomeTipo,
  irPara,
  abrirTarefa,
}: {
  c: ClienteBase;
  contrato: DadosContrato;
  entregas: { tipoEntregaId: string | null; quantidade: number | null }[];
  abertas: Tarefa[];
  entrouNoMes: number;
  situacaoMes: SituacaoPagamento | null;
  nomeTipo: (id: string | null) => string;
  irPara: (aba: Aba) => void;
  abrirTarefa: (id: string) => void;
}) {
  const hoje = hojeISO();
  const venc = proximoVencimento(contrato, hoje);
  const fidelidade = fimDaFidelidade(contrato);
  const aviso = prazoDoAvisoPrevio(contrato);
  const mensal = c.valorMensalCentavos;
  const proximas = [...abertas].sort((x, y) => (x.vencimento ?? "9999").localeCompare(y.vencimento ?? "9999")).slice(0, 4);
  const semContato = !c.telefone && !c.email && !c.instagram;
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {!c.interno && (
        <Cartao icone={Wallet} titulo="Cobrança" ir="Ver pagamentos" aoIr={() => irPara("financeiro")}>
          {c.projetoAvulso ? (
            <p>
              Projeto avulso de <strong className="numero">{formatarMoeda(c.projetoAvulso.valorCentavos)}</strong>, sem mensalidade.
            </p>
          ) : mensal == null ? (
            <Fraco>Ainda sem valor mensal. Preencha em Contrato.</Fraco>
          ) : (
            <>
              <p className="numero text-xl font-bold">
                {formatarMoeda(mensal)}
                <span className="text-xs font-medium text-texto-suave"> /mês</span>
              </p>
              <p className="text-[13px]">
                Este mês entrou <strong className="numero">{formatarMoeda(entrouNoMes)}</strong>
                {entrouNoMes < mensal ? (
                  <>
                    , falta <strong className="numero text-aviso">{formatarMoeda(mensal - entrouNoMes)}</strong>
                  </>
                ) : (
                  ". Mês pago."
                )}
              </p>
              {venc && <Fraco>Próximo vencimento: {dataBr(venc)}</Fraco>}
            </>
          )}
          {situacaoMes && situacaoMes !== "sem_contrato" && (
            <div className="mt-1">
              <Badge tom={situacaoMes === "pago" ? "ok" : situacaoMes === "atrasado" ? "erro" : situacaoMes === "parcial" ? "aviso" : "neutro"}>
                {{ pago: "pago", parcial: "pago em parte", a_receber: "a receber", atrasado: "atrasado", sem_contrato: "sem valor" }[situacaoMes]}
              </Badge>
            </div>
          )}
        </Cartao>
      )}

      {!c.interno && (
        <Cartao icone={FileSignature} titulo="Contrato" ir="Abrir contrato" aoIr={() => irPara("contrato")}>
          {contrato.inicio ? <p>Começou em {dataBr(contrato.inicio)}.</p> : <Fraco>Data de início ainda não preenchida.</Fraco>}
          {fidelidade && <Fraco>Fidelidade até {dataBr(fidelidade)}.</Fraco>}
          {aviso && <Fraco>Aviso prévio de rescisão: {dataBr(aviso)}.</Fraco>}
        </Cartao>
      )}

      <Cartao icone={Package} titulo="Entregas do contrato" ir="Ver entregas" aoIr={() => irPara("contrato")}>
        {entregas.length === 0 ? (
          <Fraco>Nenhuma entrega combinada ainda.</Fraco>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {entregas.map((e, i) => (
              <li key={i}>
                <Badge tom="marca">
                  {e.quantidade}× {nomeTipo(e.tipoEntregaId)}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Cartao>

      <Cartao icone={ClipboardList} titulo={`Tarefas em aberto${abertas.length ? ` (${abertas.length})` : ""}`} ir="Ver todas" aoIr={() => irPara("tarefas")}>
        {proximas.length === 0 ? (
          <Fraco>Nada em aberto. Tudo em dia.</Fraco>
        ) : (
          <ul className="flex flex-col divide-y divide-linha">
            {proximas.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => abrirTarefa(t.id)} className="flex min-h-10 w-full items-center justify-between gap-2 py-1.5 text-left hover:text-marca-forte">
                  <span className="truncate text-[13px] font-medium">{t.titulo}</span>
                  {t.vencimento && <span className="shrink-0 text-[12px] text-texto-suave">{dataBr(t.vencimento.slice(0, 10))}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Cartao>

      <Cartao icone={MessageCircle} titulo="Como falar com o cliente" ir="Editar contato" aoIr={() => irPara("dados")}>
        {semContato && !c.contato ? (
          <Fraco>Nenhum contato preenchido.</Fraco>
        ) : (
          <div className="flex flex-col gap-1 text-[13px]">
            {c.contato && <p className="font-semibold">{c.contato}</p>}
            {c.telefone && (
              <a className="inline-flex items-center gap-1.5 text-marca-forte hover:underline" href={`https://wa.me/${c.telefone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
                <MessageCircle size={13} aria-hidden /> {c.telefone}
              </a>
            )}
            {c.email && (
              <a className="inline-flex items-center gap-1.5 text-marca-forte hover:underline" href={`mailto:${c.email}`}>
                <Mail size={13} aria-hidden /> {c.email}
              </a>
            )}
            {c.instagram && <p className="text-texto-suave">{c.instagram}</p>}
          </div>
        )}
      </Cartao>

      {c.observacoes && (
        <section className="rounded-card border border-dashed border-linha bg-marca-tinta/40 p-4 lg:col-span-2">
          <h3 className="mb-1 text-xs font-bold tracking-wide text-texto-suave uppercase">Observações</h3>
          <p className="text-sm whitespace-pre-wrap">{c.observacoes}</p>
        </section>
      )}
    </div>
  );
}
