// Eventos do Google Agenda de quem está logado (só leitura).
//
// O navegador manda o token da sessão; o servidor lê, com as permissões dessa pessoa, os
// endereços de agenda DELA (a tabela só deixa o dono ler) e busca no Google. O endereço
// secreto nunca vai para o navegador de ninguém.

import "server-only";
import { createClient } from "@supabase/supabase-js";
import { enderecoDeAgendaValido, lerAgenda, type EventoAgenda } from "@/lib/agenda/ics";

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const MAX_BYTES = 5_000_000;

function ler(nome: string): string | null {
  return process.env[nome]?.trim() || null;
}

async function buscar(url: string): Promise<string> {
  const r = await fetch(url, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error(`Google respondeu ${r.status}`);
  const t = await r.text();
  if (t.length > MAX_BYTES) throw new Error("agenda grande demais");
  return t;
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  const de = u.searchParams.get("de") ?? "";
  const ate = u.searchParams.get("ate") ?? "";
  const tz = u.searchParams.get("tz") ?? "UTC";
  if (!DATA.test(de) || !DATA.test(ate) || de > ate) return Response.json({ erro: "período inválido" }, { status: 400 });

  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const url = ler("NEXT_PUBLIC_SUPABASE_URL") ?? ler("SUPABASE_URL");
  const chave = ler("NEXT_PUBLIC_SUPABASE_ANON_KEY") ?? ler("SUPABASE_ANON_KEY");
  if (!token || !url || !chave) return Response.json({ eventos: [], erros: [] });

  const sb = createClient(url, chave, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await sb.from("agendas_externas").select("nome, url_ical");
  if (error) return Response.json({ erro: "não deu para ler as agendas" }, { status: 401 });

  const eventos: EventoAgenda[] = [];
  const erros: string[] = [];
  await Promise.all(
    (data ?? []).map(async (a: { nome: string; url_ical: string }) => {
      if (!enderecoDeAgendaValido(a.url_ical)) return void erros.push(a.nome);
      try {
        eventos.push(...lerAgenda(await buscar(a.url_ical), de, ate, tz, a.nome));
      } catch {
        erros.push(a.nome);
      }
    }),
  );
  eventos.sort((x, y) => x.inicio.localeCompare(y.inicio));
  return Response.json({ eventos, erros }, { headers: { "Cache-Control": "private, no-store" } });
}
