// Leitor de agenda no formato iCal (.ics), o "endereço secreto" do Google Agenda.
//
// Só leitura. Entende: eventos com hora ou de dia inteiro, fuso (TZID ou UTC),
// repetição (RRULE: diária, semanal com dias, mensal pelo dia do mês, anual; INTERVAL,
// COUNT, UNTIL), datas excluídas (EXDATE), ocorrência alterada (RECURRENCE-ID) e
// evento cancelado. Tudo é convertido para o fuso de quem está vendo.

export interface EventoAgenda {
  id: string;
  titulo: string;
  /** "AAAA-MM-DD" (dia inteiro) ou "AAAA-MM-DDTHH:mm" no fuso de quem vê */
  inicio: string;
  fim: string | null;
  diaInteiro: boolean;
  local: string | null;
  agenda: string;
}

interface Propriedade {
  valor: string;
  params: Record<string, string>;
}

interface Bruto {
  props: Map<string, Propriedade[]>;
}

const dois = (n: number) => String(n).padStart(2, "0");

function desdobrar(texto: string): string[] {
  return texto.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("\n");
}

function lerLinha(l: string): { nome: string; prop: Propriedade } | null {
  const i = l.indexOf(":");
  if (i < 0) return null;
  const [nome, ...params] = l.slice(0, i).split(";");
  const p: Record<string, string> = {};
  for (const x of params) {
    const [k, v] = x.split("=");
    if (k && v != null) p[k.toUpperCase()] = v.replace(/^"|"$/g, "");
  }
  return { nome: nome.toUpperCase(), prop: { valor: l.slice(i + 1), params: p } };
}

const desescapar = (t: string) => t.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1");

function eventos(texto: string): Bruto[] {
  const out: Bruto[] = [];
  let atual: Bruto | null = null;
  let profundidade = 0; // ignora VALARM dentro do VEVENT
  for (const l of desdobrar(texto)) {
    if (l === "BEGIN:VEVENT") {
      atual = { props: new Map() };
      profundidade = 0;
      continue;
    }
    if (!atual) continue;
    if (l.startsWith("BEGIN:")) profundidade++;
    else if (l.startsWith("END:") && l !== "END:VEVENT") profundidade--;
    else if (l === "END:VEVENT") {
      out.push(atual);
      atual = null;
    } else if (profundidade === 0) {
      const r = lerLinha(l);
      if (r) atual.props.set(r.nome, [...(atual.props.get(r.nome) ?? []), r.prop]);
    }
  }
  return out;
}

// ─── Fuso horário ─────────────────────────────────────────────────────────────

/** Diferença (ms) entre o relógio do fuso e o UTC naquele instante. */
function deslocamento(ms: number, tz: string): number {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(ms / 1000) * 1000;
}

/** Hora de relógio num fuso → instante UTC. */
function relogioParaUtc(a: number, m: number, d: number, h: number, mi: number, s: number, tz: string): number {
  const palpite = Date.UTC(a, m - 1, d, h, mi, s);
  let ms = palpite - deslocamento(palpite, tz);
  ms = palpite - deslocamento(ms, tz);
  return ms;
}

function formatarNoFuso(ms: number, tz: string): string {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

const fusoValido = (tz: string | undefined) => {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

interface Momento {
  diaInteiro: boolean;
  /** relógio no fuso do evento */
  a: number;
  m: number;
  d: number;
  h: number;
  mi: number;
  s: number;
  tz: string | "UTC" | null;
}

function lerMomento(p: Propriedade | undefined, tzPadrao: string): Momento | null {
  if (!p) return null;
  const v = p.valor.trim();
  const dia = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
  if (dia || p.params.VALUE === "DATE") {
    const x = /^(\d{4})(\d{2})(\d{2})/.exec(v);
    if (!x) return null;
    return { diaInteiro: true, a: +x[1], m: +x[2], d: +x[3], h: 0, mi: 0, s: 0, tz: null };
  }
  const x = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(v);
  if (!x) return null;
  const tz = x[7] ? "UTC" : fusoValido(p.params.TZID) ? p.params.TZID : tzPadrao;
  return { diaInteiro: false, a: +x[1], m: +x[2], d: +x[3], h: +x[4], mi: +x[5], s: +x[6], tz };
}

const utcDe = (m: Momento) => (m.tz === "UTC" ? Date.UTC(m.a, m.m - 1, m.d, m.h, m.mi, m.s) : relogioParaUtc(m.a, m.m, m.d, m.h, m.mi, m.s, m.tz ?? "UTC"));
const chave = (m: Momento) => (m.diaInteiro ? `${m.a}${dois(m.m)}${dois(m.d)}` : String(utcDe(m)));

function somarAoRelogio(m: Momento, dias: number, meses = 0): Momento {
  const base = new Date(Date.UTC(m.a, m.m - 1 + meses, m.d + dias));
  return { ...m, a: base.getUTCFullYear(), m: base.getUTCMonth() + 1, d: base.getUTCDate() };
}

// ─── Repetição ────────────────────────────────────────────────────────────────

const DIAS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const LIMITE = 3000;

function ocorrencias(inicio: Momento, rrule: string, ateUtc: number, tzPadrao: string): Momento[] {
  const r = Object.fromEntries(rrule.split(";").map((x) => x.split("=") as [string, string]));
  const freq = r.FREQ;
  const intervalo = Math.max(1, Number(r.INTERVAL ?? 1) || 1);
  const count = r.COUNT ? Number(r.COUNT) : null;
  const ate = r.UNTIL ? lerMomento({ valor: r.UNTIL, params: {} }, tzPadrao) : null;
  const ateMs = Math.min(ateUtc, ate ? (ate.diaInteiro ? Date.UTC(ate.a, ate.m - 1, ate.d, 23, 59, 59) : utcDe(ate)) : Infinity);
  const porDia = r.BYDAY ? r.BYDAY.split(",").map((x) => DIAS.indexOf(x.replace(/^[+-]?\d+/, ""))).filter((x) => x >= 0) : null;
  const out: Momento[] = [];
  const passou = (m: Momento) => (m.diaInteiro ? Date.UTC(m.a, m.m - 1, m.d) : utcDe(m)) > ateMs;

  if (freq === "WEEKLY" && porDia?.length) {
    const dow0 = new Date(Date.UTC(inicio.a, inicio.m - 1, inicio.d)).getUTCDay();
    let semana = somarAoRelogio(inicio, -dow0); // domingo da semana do início
    for (let i = 0; i < LIMITE; i++) {
      for (const dow of [...porDia].sort((a, b) => a - b)) {
        const m = somarAoRelogio(semana, dow);
        if (Date.UTC(m.a, m.m - 1, m.d) < Date.UTC(inicio.a, inicio.m - 1, inicio.d)) continue;
        if (passou(m) || (count != null && out.length >= count)) return out;
        out.push(m);
      }
      semana = somarAoRelogio(semana, 7 * intervalo);
    }
    return out;
  }
  for (let i = 0; i < LIMITE; i++) {
    const m =
      freq === "DAILY" ? somarAoRelogio(inicio, i * intervalo)
      : freq === "WEEKLY" ? somarAoRelogio(inicio, i * 7 * intervalo)
      : freq === "MONTHLY" ? somarAoRelogio(inicio, 0, i * intervalo)
      : freq === "YEARLY" ? somarAoRelogio(inicio, 0, i * 12 * intervalo)
      : null;
    if (!m) return [inicio];
    // mês sem o dia (31 em abril): pula, como o Google
    if ((freq === "MONTHLY" || freq === "YEARLY") && m.d !== inicio.d) continue;
    if (passou(m) || (count != null && out.length >= count)) return out;
    out.push(m);
  }
  return out;
}

// ─── Montagem ─────────────────────────────────────────────────────────────────

/**
 * Eventos entre `de` e `ate` ("AAAA-MM-DD", inclusivos), no fuso `tz` de quem vê.
 */
export function lerAgenda(texto: string, de: string, ate: string, tz: string, nomeAgenda = "Agenda"): EventoAgenda[] {
  const tzVer = fusoValido(tz) ? tz : "UTC";
  const [da, dm, dd] = de.split("-").map(Number);
  const [aa, am, ad] = ate.split("-").map(Number);
  const deMs = relogioParaUtc(da, dm, dd, 0, 0, 0, tzVer);
  const ateMs = relogioParaUtc(aa, am, ad, 23, 59, 59, tzVer);
  const brutos = eventos(texto);
  const um = (e: Bruto, k: string) => e.props.get(k)?.[0];

  // ocorrências alteradas: UID + RECURRENCE-ID substituem a gerada
  const alteradas = new Set<string>();
  for (const e of brutos) {
    const rid = lerMomento(um(e, "RECURRENCE-ID"), tzVer);
    if (rid) alteradas.add(`${um(e, "UID")?.valor}|${chave(rid)}`);
  }

  const out: EventoAgenda[] = [];
  for (const e of brutos) {
    if (um(e, "STATUS")?.valor.toUpperCase() === "CANCELLED") continue;
    const ini = lerMomento(um(e, "DTSTART"), tzVer);
    if (!ini) continue;
    const fim = lerMomento(um(e, "DTEND"), tzVer);
    const duracao = fim ? (ini.diaInteiro ? Date.UTC(fim.a, fim.m - 1, fim.d) - Date.UTC(ini.a, ini.m - 1, ini.d) : utcDe(fim) - utcDe(ini)) : ini.diaInteiro ? 86400000 : 0;
    const uid = um(e, "UID")?.valor ?? `${ini.a}${ini.m}${ini.d}`;
    const titulo = desescapar(um(e, "SUMMARY")?.valor ?? "(sem título)");
    const local = um(e, "LOCATION") ? desescapar(um(e, "LOCATION")!.valor) : null;
    const rrule = um(e, "RRULE")?.valor;
    const ehAlteracao = !!um(e, "RECURRENCE-ID");
    const excluidas = new Set(
      (e.props.get("EXDATE") ?? []).flatMap((p) => p.valor.split(",").map((v) => lerMomento({ valor: v, params: p.params }, tzVer)).filter((x): x is Momento => !!x).map(chave)),
    );
    const lista = rrule && !ehAlteracao ? ocorrencias(ini, rrule, ateMs, tzVer) : [ini];
    for (const m of lista) {
      const k = chave(m);
      if (excluidas.has(k) || (!ehAlteracao && alteradas.has(`${uid}|${k}`))) continue;
      if (m.diaInteiro) {
        const iniMs = Date.UTC(m.a, m.m - 1, m.d);
        const fimMs = iniMs + Math.max(duracao, 86400000);
        const deDia = Date.UTC(da, dm - 1, dd);
        const ateDia = Date.UTC(aa, am - 1, ad) + 86400000;
        if (fimMs <= deDia || iniMs >= ateDia) continue;
        const ultimo = new Date(fimMs - 86400000);
        out.push({
          id: `${uid}|${k}`,
          titulo,
          inicio: `${m.a}-${dois(m.m)}-${dois(m.d)}`,
          fim: `${ultimo.getUTCFullYear()}-${dois(ultimo.getUTCMonth() + 1)}-${dois(ultimo.getUTCDate())}`,
          diaInteiro: true,
          local,
          agenda: nomeAgenda,
        });
      } else {
        const iniMs = utcDe(m);
        const fimMs = iniMs + duracao;
        if (fimMs < deMs || iniMs > ateMs) continue;
        out.push({ id: `${uid}|${k}`, titulo, inicio: formatarNoFuso(iniMs, tzVer), fim: duracao ? formatarNoFuso(fimMs, tzVer) : null, diaInteiro: false, local, agenda: nomeAgenda });
      }
    }
  }
  return out.sort((a, b) => a.inicio.localeCompare(b.inicio));
}

/** Só endereços de agenda do Google (evita que o servidor busque qualquer endereço). */
export function enderecoDeAgendaValido(url: string): boolean {
  try {
    const u = new URL(url.trim());
    return u.protocol === "https:" && u.hostname === "calendar.google.com" && u.pathname.startsWith("/calendar/ical/") && u.pathname.endsWith(".ics");
  } catch {
    return false;
  }
}

/** Eventos de um dia (inclui os de vários dias que passam por ele). */
export function eventosDoDia(eventos: EventoAgenda[], dia: string): EventoAgenda[] {
  return eventos.filter((e) => {
    const ini = e.inicio.slice(0, 10);
    const fim = (e.fim ?? e.inicio).slice(0, 10);
    return ini <= dia && dia <= fim;
  });
}
