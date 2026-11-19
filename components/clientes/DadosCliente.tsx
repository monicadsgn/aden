"use client";

// Dados cadastrais do cliente. Abre só para ler, com cada informação no seu lugar;
// para mexer, o botão "Editar dados" libera os campos (que salvam ao sair de cada um).

import { Check, Pencil } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Botao, Interruptor } from "../ui";
import { campo, dataBr, Rot, Texto } from "./campos";
import { formatarDocumento } from "@/lib/formato";
import type { ClienteBase } from "@/lib/calculo/tipos";

function Info({ rotulo, valor, dica }: { rotulo: string; valor?: ReactNode; dica?: string }) {
  const vazio = valor == null || valor === "";
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-bold tracking-wide text-texto-suave uppercase">{rotulo}</dt>
      <dd className={vazio ? "text-sm text-texto-suave/70" : "text-sm font-medium break-words"}>{vazio ? "não preenchido" : valor}</dd>
      {dica && <p className="text-[12px] text-texto-suave">{dica}</p>}
    </div>
  );
}

export function DadosCliente({ c, set }: { c: ClienteBase; set: (patch: Partial<ClienteBase>) => void }) {
  const [editando, setEditando] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-texto-suave">{editando ? "Mexa no que precisar: cada campo salva quando você sai dele." : "Só para ler. Para mudar alguma coisa, aperte Editar dados."}</p>
        <Botao pequeno variante={editando ? "primario" : "secundario"} icone={editando ? Check : Pencil} onClick={() => setEditando(!editando)}>
          {editando ? "Pronto" : "Editar dados"}
        </Botao>
      </div>
      {!editando ? (
        <>
          <section className="rounded-bloco border border-linha bg-superficie p-4">
            <h3 className="mb-3 text-xs font-bold tracking-wide text-marca-forte uppercase">Contato</h3>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Info rotulo="Pessoa de contato" valor={c.contato} />
              <Info rotulo="Telefone / WhatsApp" valor={c.telefone} />
              <Info rotulo="E-mail" valor={c.email} />
              <Info rotulo="Instagram" valor={c.instagram} />
              <Info rotulo="Segmento" valor={c.segmento} />
              <Info rotulo="Cliente desde" valor={c.clienteDesde ? dataBr(c.clienteDesde) : null} />
            </dl>
          </section>
          <section className="rounded-bloco border border-linha bg-superficie p-4">
            <h3 className="mb-1 text-xs font-bold tracking-wide text-marca-forte uppercase">Para o contrato</h3>
            <p className="mb-3 text-[12px] text-texto-suave">Estas informações vão no contrato do cliente.</p>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Info rotulo="Nome no contrato" valor={c.razaoSocial || c.nome} />
              <Info rotulo="CPF ou CNPJ" valor={c.documento} />
              <div className="sm:col-span-2">
                <Info rotulo="Endereço" valor={c.endereco} />
              </div>
            </dl>
          </section>
          <section className="rounded-bloco border border-linha bg-superficie p-4">
            <h3 className="mb-3 text-xs font-bold tracking-wide text-marca-forte uppercase">Como o sistema trata este cliente</h3>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Info rotulo="Situação" valor={c.ativo ? "Cliente ativo" : "Inativo"} />
              {!c.interno && <Info rotulo="Divisão dos custos fixos" valor={c.participaRateio ? "Entra na divisão" : "Fora da divisão"} />}
              {c.interno && <Info rotulo="Tipo" valor="A própria Aden (cliente interno)" dica="Sem mensalidade, fora do faturamento e da divisão. As horas aparecem no Mês como investidas na Aden." />}
            </dl>
          </section>
          <section className="rounded-bloco border border-linha bg-superficie p-4">
            <h3 className="mb-3 text-xs font-bold tracking-wide text-marca-forte uppercase">Observações</h3>
            <p className={c.observacoes ? "text-sm whitespace-pre-wrap" : "text-sm text-texto-suave/70"}>{c.observacoes || "Nenhuma observação. Use para preferências, acessos e combinados."}</p>
          </section>
        </>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
            <Rot rotulo="Nome">
              <Texto valor={c.nome} aoSalvar={(v) => v.trim() && set({ nome: v.trim() })} />
            </Rot>
            <Rot rotulo="Segmento">
              <Texto valor={c.segmento ?? ""} aoSalvar={(v) => set({ segmento: v })} placeholder="ex.: moda, saúde, loja física" />
            </Rot>
            <Rot rotulo="Pessoa de contato">
              <Texto valor={c.contato ?? ""} aoSalvar={(v) => set({ contato: v })} />
            </Rot>
            <Rot rotulo="Telefone / WhatsApp">
              <Texto valor={c.telefone ?? ""} aoSalvar={(v) => set({ telefone: v })} />
            </Rot>
            <Rot rotulo="Instagram">
              <Texto valor={c.instagram ?? ""} aoSalvar={(v) => set({ instagram: v })} placeholder="@perfil" />
            </Rot>
            <Rot rotulo="E-mail">
              <Texto valor={c.email ?? ""} aoSalvar={(v) => set({ email: v })} />
            </Rot>
            <Rot rotulo="Nome no contrato" dica="Razão social ou nome completo. Vazio = o nome do cliente.">
              <Texto valor={c.razaoSocial ?? ""} aoSalvar={(v) => set({ razaoSocial: v })} />
            </Rot>
            <Rot rotulo="CPF ou CNPJ" dica="Vai no contrato.">
              <Texto valor={c.documento ?? ""} aoSalvar={(v) => set({ documento: formatarDocumento(v) })} />
            </Rot>
            <Rot rotulo="Endereço" dica="Vai no contrato.">
              <Texto valor={c.endereco ?? ""} aoSalvar={(v) => set({ endereco: v })} />
            </Rot>
            <Rot rotulo="Cliente desde">
              <input type="date" className={campo} value={c.clienteDesde ?? ""} onChange={(e) => set({ clienteDesde: e.target.value || null })} />
            </Rot>
            <div className="flex flex-col justify-end gap-2 pb-1">
              <Interruptor ligado={c.ativo} rotulo="Cliente ativo" aoMudar={(v) => set({ ativo: v })} />
              {!c.interno && <Interruptor ligado={c.participaRateio} rotulo="Entra na divisão dos custos fixos" aoMudar={(v) => set({ participaRateio: v })} />}
              <Interruptor
                ligado={c.interno}
                rotulo="É a própria Aden (cliente interno)"
                aoMudar={(v) => set(v ? { interno: true, participaRateio: false } : { interno: false })}
              />
              {c.interno && (
                <p className="text-[12px] text-texto-suave">
                  Sem mensalidade: fica fora do faturamento, da divisão dos custos fixos, da divisão entre sócios e do teto do MEI, e não pede exceção de piso. Tarefas e cronômetro funcionam igual; as horas
                  aparecem no Mês como investidas na Aden.
                </p>
              )}
            </div>
            <label className="flex flex-col gap-1 text-xs font-semibold text-texto-suave sm:col-span-2">
              Observações
              <textarea
                key={c.id}
                className="min-h-20 rounded-campo border border-linha bg-superficie px-3 py-2 text-sm font-normal text-texto focus:border-marca focus:outline-none"
                defaultValue={c.observacoes ?? ""}
                placeholder="Preferências, acessos, combinados…"
                onBlur={(e) => e.target.value !== (c.observacoes ?? "") && set({ observacoes: e.target.value })}
              />
            </label>
        </div>
      )}
    </div>
  );
}
