// E-mail que avisa o cliente de que tem algo novo no painel dele. Função pura: recebe os dados, devolve assunto, texto
// e HTML. Quem envia é outro módulo. Só dois motivos para avisar (decisão da Moni, 11/10/2026): peça nova para aprovar
// e ajuste devolvido. Nada diário, nada de "sem novidade".
//
// E-mail não carrega fonte nem SVG de forma confiável, então o visual usa as cores da marca (as mesmas dos PDFs),
// "aden" escrito em texto e fonte do sistema como reserva.

import { CORES_ADEN as C } from "@/lib/documentos/base";
import { tituloParaCliente } from "@/lib/calculo/painel";

export interface DadosAvisoCliente {
  /** primeiro nome ou nome do contato; vazio = sem nome */
  nomeContato?: string;
  /** títulos como estão na tarefa (limpamos aqui antes de mostrar) */
  novas: string[];
  ajustadas: string[];
  /** link do painel do cliente */
  linkPainel: string;
}

export interface EmailPronto {
  assunto: string;
  texto: string;
  html: string;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const limpos = (titulos: string[]) => titulos.map((t) => tituloParaCliente(t)).filter(Boolean);

function assuntoDe(novas: number, ajustadas: number): string {
  if (novas && ajustadas) return "Tem peças novas e ajustes prontos pra você";
  if (ajustadas) return ajustadas === 1 ? "Fizemos o ajuste que você pediu" : "Fizemos os ajustes que você pediu";
  return novas === 1 ? "Tem uma peça nova pra você aprovar" : "Tem peças novas pra você aprovar";
}

function blocoHtml(titulo: string, itens: string[]): string {
  if (!itens.length) return "";
  const linhas = itens
    .map(
      (t) =>
        `<tr><td style="padding:10px 14px;border-top:1px solid ${C.linha};font-size:15px;line-height:1.4;color:${C.texto};">${esc(t)}</td></tr>`,
    )
    .join("");
  return `<p style="margin:24px 0 8px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${C.verdeEscuro};">${esc(titulo)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.verdeClaro};border-radius:14px;border-collapse:separate;overflow:hidden;">${linhas.replace(/^<tr><td style="padding:10px 14px;border-top:1px solid [^"]+;/, `<tr><td style="padding:10px 14px;`)}</table>`;
}

export function montarAvisoCliente(d: DadosAvisoCliente): EmailPronto {
  const novas = limpos(d.novas);
  const ajustadas = limpos(d.ajustadas);
  const assunto = assuntoDe(novas.length, ajustadas.length);
  const oi = d.nomeContato?.trim() ? `Oi, ${d.nomeContato.trim()}!` : "Oi!";
  const abertura =
    novas.length && ajustadas.length
      ? "Subimos peças novas e já fizemos os ajustes que você pediu. É só olhar e responder pelo painel."
      : ajustadas.length
        ? "Já fizemos o que você pediu. É só olhar e dizer se ficou bom."
        : "Subimos o que ficou pronto. É só olhar e aprovar, ou pedir ajuste, pelo painel.";

  const texto = [
    oi,
    "",
    abertura,
    ...(novas.length ? ["", "Para aprovar:", ...novas.map((t) => `- ${t}`)] : []),
    ...(ajustadas.length ? ["", "Ajustes feitos:", ...ajustadas.map((t) => `- ${t}`)] : []),
    "",
    `Abrir o painel: ${d.linkPainel}`,
    "",
    "Só avisamos quando tem algo pra você. Sem novidade, sem e-mail.",
    "Equipe Aden",
  ].join("\n");

  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(assunto)}</title></head>
<body style="margin:0;padding:0;background:${C.verdeClaro};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.verdeClaro};"><tr><td align="center" style="padding:28px 14px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:${C.branco};border-radius:24px;border-collapse:separate;overflow:hidden;font-family:'Poppins','Segoe UI',Helvetica,Arial,sans-serif;">
<tr><td style="background:${C.verde};padding:26px 28px;">
<span style="font-size:34px;font-weight:700;letter-spacing:-0.02em;color:${C.branco};">aden</span>
</td></tr>
<tr><td style="padding:30px 28px 8px;color:${C.texto};">
<h1 style="margin:0 0 10px;font-size:22px;line-height:1.25;color:${C.verdeProfundo};">${esc(assunto)}</h1>
<p style="margin:0;font-size:15px;line-height:1.55;color:${C.textoSuave};">${esc(oi)} ${esc(abertura)}</p>
${blocoHtml("Para aprovar", novas)}
${blocoHtml("Ajustes feitos", ajustadas)}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 8px;"><tr><td style="background:${C.verdeEscuro};border-radius:999px;">
<a href="${esc(d.linkPainel)}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:${C.branco};text-decoration:none;">Abrir o painel</a>
</td></tr></table>
</td></tr>
<tr><td style="padding:18px 28px 28px;">
<p style="margin:0;font-size:12px;line-height:1.5;color:${C.textoSuave};border-top:1px solid ${C.linha};padding-top:16px;">Só avisamos quando tem algo pra você. Sem novidade, sem e-mail.<br>Equipe Aden</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;

  return { assunto, texto, html };
}
