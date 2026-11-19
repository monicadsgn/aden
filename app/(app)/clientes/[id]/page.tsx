"use client";

// Página de um cliente: ficha com partes separadas por assunto (visão geral, dados, contrato, tarefas…).

import { useParams, useSearchParams } from "next/navigation";
import { Users } from "lucide-react";
import Link from "next/link";
import { abaDeTexto, FichaCliente } from "@/components/clientes/FichaCliente";
import { useClientes } from "@/components/clientes/useClientes";
import { Vazio } from "@/components/ui";

export default function PaginaDoCliente() {
  const { id } = useParams<{ id: string }>();
  const aba = abaDeTexto(useSearchParams().get("aba"));
  const x = useClientes();
  if (!x.carregou) return null;
  const cliente = x.clientes.find((c) => c.id === id) ?? null;
  if (!cliente)
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <Vazio icone={Users} titulo="Não achei este cliente">
          Ele pode ter sido removido ou o endereço está errado.{" "}
          <Link href="/clientes" className="font-semibold text-marca-forte underline">
            Ver todos os clientes
          </Link>
        </Vazio>
      </div>
    );
  return (
    <>
      {x.erro && <p className="mx-auto mt-4 max-w-[1300px] rounded-card bg-erro-suave px-4 py-3 text-sm text-erro">{x.erro}</p>}
      <FichaCliente
        key={cliente.id}
        cliente={cliente}
        config={{ ...x.cfg, clientes: x.clientes }}
        a={x.a}
        pagamentos={x.pagamentos}
        situacaoMes={x.situacao.get(cliente.id) ?? null}
        leads={x.leads}
        aoSalvar={x.salvar}
        aoRecarregar={async () => {
          await x.recarregar();
          await x.a.recarregar();
        }}
        abaInicial={aba}
      />
    </>
  );
}
