// E-mail que avisa o cliente de que tem algo novo no painel dele. Função pura: recebe os dados, devolve assunto, texto
// e HTML. Quem envia é outro módulo. Só dois motivos para avisar (decisão da Moni, 11/10/2026): peça nova para aprovar
// e ajuste devolvido. Nada diário, nada de "sem novidade".
//
// E-mail não carrega fonte nem SVG de forma confiável, então o visual usa as cores da marca (as mesmas dos PDFs),
// "aden" escrito em texto e fonte do sistema como reserva.

import { CORES_ADEN as C } from "@/lib/documentos/base";
import { tituloParaCliente } from "@/lib/calculo/painel";

/** Uma peça como o cliente enxerga: formato, dia e tema (nunca o título interno). */
export interface PecaDoAviso {
  /** título como está na tarefa (limpamos aqui antes de mostrar) */
  titulo: string;
  /** formato como o cliente vê (nome do tipo, ex.: Estático, Reel); vazio = só o tema */
  formato?: string | null;
  /** "AAAA-MM-DD": dia em que a peça vai ao ar; vazio = sem dia */
  dia?: string | null;
  /** só nos ajustes: o que o cliente pediu */
  pedido?: string | null;
}

export interface DadosAvisoCliente {
  /** primeiro nome ou nome do contato; vazio = sem nome */
  nomeContato?: string;
  novas: PecaDoAviso[];
  ajustadas: PecaDoAviso[];
  /** link do painel do cliente */
  linkPainel: string;
  /** endereço do site da Aden (de onde vem a imagem da logo no topo do e-mail) */
  urlBase: string;
  /** "AAAA-MM-DD": prazo para o cliente responder; vazio = sem prazo */
  responderAte?: string | null;
}

export interface EmailPronto {
  assunto: string;
  texto: string;
  html: string;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const diaMes = (iso?: string | null) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : null);

/** "Estático do dia 22/10 (Marca um amigo)". Tira do tema o que a equipe põe entre parênteses no fim do título. */
export function nomeDaPeca(p: PecaDoAviso): string {
  const tema = tituloParaCliente(p.titulo).replace(/\s*\([^)]*\)\s*$/, "").trim();
  const formato = p.formato?.trim();
  const dia = diaMes(p.dia);
  if (formato && dia) return `${formato} do dia ${dia} (${tema})`;
  if (formato) return `${formato} (${tema})`;
  return dia ? `${tema}, dia ${dia}` : tema;
}

const limpos = (pecas: PecaDoAviso[]) => pecas.map((p) => ({ nome: nomeDaPeca(p), pedido: p.pedido?.trim() || null })).filter((p) => p.nome);

function assuntoDe(novas: number, ajustadas: number): string {
  if (novas && ajustadas) return "Tem peças novas e ajustes prontos pra você";
  if (ajustadas) return ajustadas === 1 ? "Fizemos o ajuste que você pediu" : "Fizemos os ajustes que você pediu";
  return novas === 1 ? "Tem uma peça nova pra você aprovar" : "Tem peças novas pra você aprovar";
}

type Item = { nome: string; pedido: string | null };

function blocoHtml(titulo: string, itens: Item[]): string {
  if (!itens.length) return "";
  const linhas = itens
    .map((t, i) => {
      const pedido = t.pedido
        ? `<br><span style="font-size:13px;color:${C.textoSuave};">Você pediu: ${esc(t.pedido)}</span>`
        : "";
      return `<tr><td style="padding:12px 16px;${i ? `border-top:1px solid ${C.verdeMedio};` : ""}font-size:15px;line-height:1.45;color:${C.texto};">${esc(t.nome)}${pedido}</td></tr>`;
    })
    .join("");
  return `<p style="margin:26px 0 8px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${C.verdeEscuro};">${esc(titulo)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.verdeClaro};border-radius:14px;border-collapse:separate;">${linhas}</table>`;
}

export function montarAvisoCliente(d: DadosAvisoCliente): EmailPronto {
  const novas = limpos(d.novas);
  const ajustadas = limpos(d.ajustadas);
  const assunto = assuntoDe(novas.length, ajustadas.length);
  const oi = d.nomeContato?.trim() ? `Oi, ${d.nomeContato.trim()}!` : "Oi!";
  const abertura =
    novas.length && ajustadas.length
      ? "Tem peças novas pra você olhar e também os ajustes que você pediu."
      : ajustadas.length
        ? "Já fizemos o que você pediu. Falta só você olhar e dizer se ficou bom."
        : "Tem peça pronta esperando o seu ok.";
  const comoFazer = "Toque no botão, abra cada peça e escolha Aprovar ou pedir ajuste. Leva um minuto.";
  const prazo = diaMes(d.responderAte);
  const prazoTexto = prazo ? `Se puder, responda até ${prazo}.` : "";
  const logo = `${d.urlBase.replace(/\/$/, "")}/email/logo-aden-branco.png`;

  const lista = (itens: Item[]) => itens.map((t) => `- ${t.nome}${t.pedido ? ` (você pediu: ${t.pedido})` : ""}`);
  const texto = [
    oi,
    "",
    abertura,
    ...(novas.length ? ["", "Para aprovar:", ...lista(novas)] : []),
    ...(ajustadas.length ? ["", "Ajustes feitos:", ...lista(ajustadas)] : []),
    "",
    comoFazer,
    ...(prazoTexto ? [prazoTexto] : []),
    `Ver e aprovar: ${d.linkPainel}`,
    "",
    "Você só recebe este e-mail quando tem algo pra olhar.",
    "Equipe Aden",
  ].join("\n");

  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(assunto)}</title></head>
<body style="margin:0;padding:0;background:${C.verdeClaro};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.verdeClaro};"><tr><td align="center" style="padding:28px 14px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:${C.branco};border-radius:24px;border-collapse:separate;overflow:hidden;font-family:'Poppins','Segoe UI',Helvetica,Arial,sans-serif;">
<tr><td style="background:${C.verde};padding:28px;">
<img src="${esc(logo)}" width="110" alt="aden" style="display:block;border:0;height:auto;font-size:30px;font-weight:700;color:${C.branco};">
</td></tr>
<tr><td style="padding:30px 28px 8px;color:${C.texto};">
<h1 style="margin:0 0 12px;font-size:22px;line-height:1.25;color:${C.verdeProfundo};">${esc(assunto)}</h1>
<p style="margin:0;font-size:15px;line-height:1.55;color:${C.texto};">${esc(oi)} ${esc(abertura)}</p>
${blocoHtml("Para aprovar", novas)}
${blocoHtml("Ajustes feitos", ajustadas)}
<p style="margin:26px 0 0;font-size:15px;line-height:1.55;color:${C.textoSuave};">${esc(comoFazer)}${prazoTexto ? ` ${esc(prazoTexto)}` : ""}</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 8px;"><tr><td style="background:${C.verdeEscuro};border-radius:999px;">
<a href="${esc(d.linkPainel)}" style="display:inline-block;padding:15px 30px;font-size:16px;font-weight:600;color:${C.branco};text-decoration:none;">Ver e aprovar</a>
</td></tr></table>
</td></tr>
<tr><td style="padding:18px 28px 28px;">
<p style="margin:0;font-size:12px;line-height:1.5;color:${C.textoSuave};border-top:1px solid ${C.linha};padding-top:16px;">Você só recebe este e-mail quando tem algo pra olhar.<br>Equipe Aden</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;

  return { assunto, texto, html };
}
