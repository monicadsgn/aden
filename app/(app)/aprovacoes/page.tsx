"use client";

// Pedidos e avisos: o que é só entre os sócios, numa tela com duas abas
// (pedidos de mudança no que protege a remuneração, e os recados do sistema).

import { Bell, ShieldCheck } from "lucide-react";
import { PaginaComAbas } from "@/components/PaginaComAbas";
import Avisos from "@/components/socios/Avisos";
import Pedidos from "@/components/socios/Pedidos";

export default function PedidosEAvisos() {
  return (
    <PaginaComAbas
      icone={ShieldCheck}
      selo="Sócios"
      titulo="Pedidos e avisos"
      largura="max-w-[1000px]"
      abas={[
        { id: "pedidos", rotulo: "Pedidos entre sócios", icone: ShieldCheck, area: "aprovacoes", conteudo: Pedidos, descricao: "Mudanças no que protege a remuneração dos sócios e exceções abaixo do piso. Só valem depois que o sócio afetado aprova. Nada aqui se apaga." },
        { id: "avisos", rotulo: "Avisos", icone: Bell, area: "avisos", conteudo: Avisos, descricao: "Recados do sistema para você: quem mudou o quê e quanto isso muda no seu bolso." },
      ]}
    />
  );
}
