"use client";

// Datas comemorativas como aba do Calendário (G5 da auditoria, 01/10/2026): é coisa do dia a dia do planejamento,
// não configuração. Mesmo conteúdo que ficava em Configurações → Datas comemorativas (salva na hora).

import { useEffect, useState } from "react";
import { SecaoDatas } from "@/components/configuracoes/SecaoDatas";
import { Card } from "@/components/ui";
import type { ClienteBase } from "@/lib/calculo/tipos";
import { useDados } from "@/lib/dados/contexto";

export default function DatasComemorativas() {
  const { repo } = useDados();
  const [clientes, setClientes] = useState<ClienteBase[] | null>(null);
  useEffect(() => {
    repo
      .carregarConfig()
      .then((c) => setClientes(c.clientes))
      .catch(() => setClientes([]));
  }, [repo]);
  if (!clientes) return null;
  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6 lg:px-8">
      <Card>
        <div className="p-5">
          <SecaoDatas clientes={clientes} />
        </div>
      </Card>
    </div>
  );
}
