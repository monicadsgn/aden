// Datas comemorativas para o planejamento mensal (pedido da Moni, 30/09/2026).
// Cada data vale para um ou mais clientes; cada cliente tem os próprios dias de antecedência da campanha
// e uma nota de ideia. Nenhum número vem daqui: a antecedência é o que os sócios cadastram.
//
// Para um mês (AAAA-MM):
// - datasDoMes: a data cai no mês, então o post dela entra nesse planejamento;
// - campanhasQueComecam: a data é depois do mês, mas a janela de antecedência abre (ou já está aberta) nele,
//   então entra ao menos um post de aquecimento.

import type { Id } from "./tipos";

export interface DataComemorativa {
  id: Id;
  nome: string;
  /** "AAAA-MM-DD" (a do ano certo: Black Friday muda todo ano) */
  data: string;
  ativo: boolean;
}

export interface DataDoCliente {
  id: Id;
  dataId: Id;
  clienteId: Id;
  /** dias antes da data em que a campanha começa; vazio = só o post do dia */
  diasAntecedencia: number | null;
  nota: string | null;
  /** escondida para este cliente (não vem no planejamento) */
  escondida: boolean;
}

export interface ItemDoPlanejamento {
  nome: string;
  data: string;
  clienteId: Id;
  diasAntecedencia: number | null;
  nota: string | null;
  /** só em campanhasQueComecam */
  janelaAbreEm?: string;
  situacao?: "abre neste mês" | "já aberta (começou antes)";
}

/** "AAAA-MM-DD" menos n dias (calendário, sem fuso). */
export function diasAntes(data: string, n: number): string {
  const [a, m, d] = data.split("-").map(Number);
  const t = new Date(Date.UTC(a, m - 1, d) - n * 86400000);
  return t.toISOString().slice(0, 10);
}

function limitesDoMes(mes: string) {
  const [a, m] = mes.split("-").map(Number);
  const inicio = `${mes}-01`;
  const fim = new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
  return { inicio, fim };
}

export function datasDoPlanejamento(
  mes: string,
  datas: DataComemorativa[],
  ligacoes: DataDoCliente[],
  clienteId?: Id | null,
): { datasDoMes: ItemDoPlanejamento[]; campanhasQueComecam: ItemDoPlanejamento[] } {
  if (!/^\d{4}-\d{2}$/.test(mes)) throw new Error("Mês no formato AAAA-MM.");
  const { inicio, fim } = limitesDoMes(mes);
  const porId = new Map(datas.filter((d) => d.ativo).map((d) => [d.id, d]));
  const datasDoMes: ItemDoPlanejamento[] = [];
  const campanhasQueComecam: ItemDoPlanejamento[] = [];
  for (const l of ligacoes) {
    if (l.escondida || (clienteId && l.clienteId !== clienteId)) continue;
    const d = porId.get(l.dataId);
    if (!d) continue;
    const base = { nome: d.nome, data: d.data, clienteId: l.clienteId, diasAntecedencia: l.diasAntecedencia, nota: l.nota?.trim() || null };
    if (d.data >= inicio && d.data <= fim) {
      datasDoMes.push(base);
      continue;
    }
    if (d.data <= fim || !l.diasAntecedencia) continue;
    const abre = diasAntes(d.data, l.diasAntecedencia);
    if (abre > fim) continue;
    campanhasQueComecam.push({ ...base, janelaAbreEm: abre, situacao: abre >= inicio ? "abre neste mês" : "já aberta (começou antes)" });
  }
  const ordem = (a: ItemDoPlanejamento, b: ItemDoPlanejamento) => a.data.localeCompare(b.data) || a.nome.localeCompare(b.nome);
  return { datasDoMes: datasDoMes.sort(ordem), campanhasQueComecam: campanhasQueComecam.sort(ordem) };
}
