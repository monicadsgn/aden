"use client";

// Seção "limites" das Configurações (movida da página sem mudar a tela).

import { CampoMoeda, CampoNumero, CampoPct } from "@/components/ui";
import { Explica, Alvo } from "./auxiliares";
import type { ContextoConfig } from "./contexto";

export function SecaoLimites({ ctx }: { ctx: ContextoConfig }) {
  const { e, setE } = ctx;
  return (
    <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Alvo campo="tetoFaturamentoAnualCentavos">
                  <CampoMoeda rotulo="Teto de faturamento no ano" valor={e.tetoFaturamentoAnualCentavos ?? null} aoMudar={(v) => setE({ tetoFaturamentoAnualCentavos: v })} />
                </Alvo>
                <Explica>O limite do regime (no MEI, o teto anual). Passar dele muda o regime inteiro da empresa. Ex.: R$ 100.000 por ano.</Explica>
                <CampoPct rotulo="Avisar a partir de (% do teto)" valor={e.avisoTetoPct ?? null} aoMudar={(v) => setE({ avisoTetoPct: v })} />
                <Explica>Quando a soma do ano projetada chegar a esta porcentagem do teto, o sistema avisa antes de estourar. Ex.: com 80%, avisa ao chegar em 80% do teto.</Explica>
                <CampoPct rotulo="Folga sobrando abaixo de (% das horas)" valor={e.ociosidadePct ?? null} aoMudar={(v) => setE({ ociosidadePct: v })} />
                <Explica>Se os clientes usarem menos que isso das horas de um sócio, a tela Mês mostra que ele tem espaço sobrando. Ex.: 70% das horas.</Explica>
                <CampoMoeda rotulo="Arredondar a proposta para cima, de" valor={e.arredondamentoPropostaCentavos ?? null} aoMudar={(v) => setE({ arredondamentoPropostaCentavos: v })} />
                <Explica>O valor que vai para o cliente sobe até o próximo múltiplo deste valor, para sair um número redondo. Ex.: com R$ 50, R$ 1.432 vira R$ 1.450.</Explica>
                <CampoPct rotulo="Sugerir novo tempo quando a média diferir mais de" valor={e.diferencaSugerirPct ?? null} aoMudar={(v) => setE({ diferencaSugerirPct: v })} />
                <Explica>Quanto a média medida pode se afastar do tempo cadastrado antes de sugerir trocar. Ex.: 15%. Vazio = qualquer diferença de 1 minuto ou mais já vira sugestão de atualizar o tempo cadastrado.</Explica>
                <CampoNumero rotulo="Lead parado na etapa depois de" sufixo="dias" valor={e.diasLeadParado ?? null} aoMudar={(v) => setE({ diasLeadParado: v })} />
                <Explica>Em Leads, o card do lead fica em destaque quando passa esse tempo sem mudar de etapa. Ex.: 7 dias. Vazio = nunca destaca.</Explica>
                <CampoNumero rotulo="Prazo mínimo de tarefa pedida ao outro sócio" sufixo="dias úteis" valor={e.prazoMinimoPedidoDiasUteis ?? null} aoMudar={(v) => setE({ prazoMinimoPedidoDiasUteis: v })} />
                <Explica>Tarefa pedida ao outro sócio sem prazo entra sozinha com esses dias úteis a partir do pedido. Prazo menor só como urgência: o sistema pergunta e a tarefa ganha o selo &quot;urgente&quot;. Ex.: 2 dias úteis. Vazio = sem prazo mínimo.</Explica>
              </div>
    </>
  );
}
