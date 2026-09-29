"use client";

// Mês: tudo sobre como a Aden está no mês, numa tela só com abas
// (antes eram quatro telas: Visão do mês, Capacidade, Saúde dos clientes e Repasse dos sócios).
// Relatórios (PDFs) é um botão aqui ao lado das abas; a aba Horas fica escondida até ter volume.

import { CalendarRange, FileDown, Gauge, HandCoins, HeartPulse, Trophy } from "lucide-react";
import Link from "next/link";
import CadaCliente from "@/components/mes/CadaCliente";
import Horas from "@/components/mes/Horas";
import Resumo from "@/components/mes/Resumo";
import Socios from "@/components/mes/Socios";
import { PaginaComAbas } from "@/components/PaginaComAbas";
import { podeVer } from "@/lib/acesso";
import { useDados } from "@/lib/dados/contexto";
import { COM_VOLUME } from "@/lib/recursos";

export default function Mes() {
  const { usuario } = useDados();
  return (
    <PaginaComAbas
      icone={CalendarRange}
      selo="Dinheiro e mês"
      titulo="Mês"
      largura="max-w-[1100px]"
      abas={[
        { id: "resumo", rotulo: "Resumo e metas", icone: Trophy, area: "mes", conteudo: Resumo, descricao: "Onde a Aden está na trilha de crescimento, quanto espaço ainda tem para vender e quanto entra por mês." },
        { id: "horas", rotulo: "Horas", icone: Gauge, area: "capacidade", conteudo: Horas, escondida: !COM_VOLUME.abaHorasDoMes, descricao: "Quanto cada cliente pede de cada sócio por mês, contra as horas que cada um tem." },
        { id: "clientes", rotulo: "Cada cliente", icone: HeartPulse, area: "saude", conteudo: CadaCliente, descricao: "Quanto cada cliente pagou no mês e quantas horas custou de verdade, com os caminhos quando algo fica abaixo do piso." },
        { id: "socios", rotulo: "Sócios", icone: HandCoins, area: "repasse", conteudo: Socios, descricao: "Quanto cada sócio já recebeu no mês, somando todos os clientes, e quanto ainda falta cair." },
      ]}
      acoes={
        (!usuario || podeVer(usuario.papel, "pdfs")) && (
          <Link href="/pdfs" className="flex shrink-0 items-center gap-1.5 rounded-botao border border-linha bg-superficie px-3.5 py-2 text-xs font-bold text-texto hover:border-marca/50">
            <FileDown size={14} />
            Relatórios
          </Link>
        )
      }
    />
  );
}
