// Junta o que o banco diz que está pendente com o modelo do e-mail e manda. Quem fala com o banco e com o Gmail
// entra por parâmetro, então dá para testar sem enviar nada de verdade.

import { montarAvisoCliente, type EmailPronto, type PecaDoAviso } from "./avisoCliente";

/** Um cliente com peças esperando aviso, como a função avisos_cliente_pendentes do banco devolve. */
export interface PendenteDoBanco {
  clienteId: string;
  cliente: string;
  contato: string | null;
  email: string | null;
  token: string;
  ate: string;
  prazoAprovacaoDias: number | null;
  pecas: { titulo: string; formato: string | null; dia: string | null; ajuste: boolean; pedido: string | null }[];
}

export interface Entradas {
  buscar: () => Promise<PendenteDoBanco[]>;
  marcar: (clienteId: string, ate: string) => Promise<void>;
  enviar: (para: string[], email: EmailPronto) => Promise<void>;
  urlBase: string;
  /** hoje, "AAAA-MM-DD", para calcular o "responda até" */
  hoje: string;
}

export interface Resultado {
  enviados: string[];
  falhas: { cliente: string; motivo: string }[];
}

/** O campo e-mail da ficha pode ter mais de um endereço, separados por vírgula, ponto e vírgula ou espaço. */
export function enderecosDe(campo: string | null | undefined): string[] {
  return (campo ?? "")
    .split(/[,;\s]+/)
    .map((e) => e.trim())
    .filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
}

function somarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export async function enviarAvisosDoDia(e: Entradas): Promise<Resultado> {
  const r: Resultado = { enviados: [], falhas: [] };
  for (const p of await e.buscar()) {
    const para = enderecosDe(p.email);
    if (!para.length) {
      r.falhas.push({ cliente: p.cliente, motivo: "e-mail da ficha não é um endereço válido" });
      continue;
    }
    const doTipo = (ajuste: boolean): PecaDoAviso[] =>
      p.pecas.filter((x) => x.ajuste === ajuste).map((x) => ({ titulo: x.titulo, formato: x.formato, dia: x.dia, pedido: x.pedido }));
    const email = montarAvisoCliente({
      nomeContato: p.contato ?? undefined,
      novas: doTipo(false),
      ajustadas: doTipo(true),
      linkPainel: `${e.urlBase.replace(/\/$/, "")}/c/${p.token}`,
      urlBase: e.urlBase,
      responderAte: p.prazoAprovacaoDias ? somarDias(e.hoje, p.prazoAprovacaoDias) : null,
    });
    try {
      await e.enviar(para, email);
      await e.marcar(p.clienteId, p.ate);
      r.enviados.push(p.cliente);
    } catch (erro) {
      r.falhas.push({ cliente: p.cliente, motivo: erro instanceof Error ? erro.message : "não enviou" });
    }
  }
  return r;
}
