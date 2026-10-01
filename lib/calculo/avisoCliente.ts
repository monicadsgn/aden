// Aviso ao cliente de que tem peça esperando no painel (M13, 01/10/2026). Sem integração nova: o Aden monta a
// mensagem e o link do WhatsApp (wa.me); quem manda é o sócio, pelo número de sempre. Nada interno vai na mensagem.

/** Só os dígitos; número brasileiro sem DDI ganha o 55. null quando não dá para montar um número. */
export function numeroWhatsapp(telefone: string | null | undefined): string | null {
  const d = (telefone ?? "").replace(/\D/g, "");
  if (d.length < 10) return null;
  return d.length <= 11 ? `55${d}` : d;
}

export function mensagemPecaNoPainel(nomeContato: string | null | undefined, linkPainel: string, quantas = 1): string {
  const ola = nomeContato?.trim() ? `Oi, ${nomeContato.trim().split(/\s+/)[0]}!` : "Oi!";
  const oque = quantas > 1 ? `Tem ${quantas} posts novos esperando a sua aprovação` : "Tem post novo esperando a sua aprovação";
  return `${ola} ${oque} no seu painel da Aden: ${linkPainel}\nÉ só abrir, olhar e tocar em Aprovar ou pedir ajuste.`;
}

export function linkWhatsapp(telefone: string | null | undefined, texto: string): string {
  const n = numeroWhatsapp(telefone);
  return `https://wa.me/${n ?? ""}?text=${encodeURIComponent(texto)}`;
}
