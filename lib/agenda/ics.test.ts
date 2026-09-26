import { describe, expect, it } from "vitest";
import { enderecoDeAgendaValido, eventosDoDia, lerAgenda } from "./ics";

const ics = (corpo: string) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${corpo}\r\nEND:VCALENDAR\r\n`;
const ev = (linhas: string[]) => ["BEGIN:VEVENT", ...linhas, "END:VEVENT"].join("\r\n");
const SP = "America/Sao_Paulo";

describe("agenda iCal", () => {
  it("evento em UTC vira o horário de quem vê; texto dobrado e escapado", () => {
    const t = ics(ev(["UID:a", "DTSTART:20260926T130000Z", "DTEND:20260926T140000Z", "SUMMARY:Reunião com a Olinda\\, loja", "LOCATION:Rua A", " B"]));
    const [e] = lerAgenda(t, "2026-09-26", "2026-09-26", SP);
    expect(e).toMatchObject({ titulo: "Reunião com a Olinda, loja", inicio: "2026-09-26T10:00", fim: "2026-09-26T11:00", diaInteiro: false, local: "Rua AB" });
  });

  it("evento com TZID e dia inteiro de vários dias", () => {
    const t = ics(
      [
        ev(["UID:b", "DTSTART;TZID=America/Sao_Paulo:20260926T090000", "DTEND;TZID=America/Sao_Paulo:20260926T093000", "SUMMARY:Gravação"]),
        ev(["UID:c", "DTSTART;VALUE=DATE:20260925", "DTEND;VALUE=DATE:20260928", "SUMMARY:Viagem"]),
      ].join("\r\n"),
    );
    const es = lerAgenda(t, "2026-09-26", "2026-09-26", SP);
    expect(es.map((e) => `${e.titulo}:${e.inicio}:${e.fim}`)).toEqual(["Viagem:2026-09-25:2026-09-27", "Gravação:2026-09-26T09:00:2026-09-26T09:30"]);
    expect(eventosDoDia(es, "2026-09-27").map((e) => e.titulo)).toEqual(["Viagem"]);
  });

  it("repetição semanal com dias, exceção, ocorrência alterada e cancelado", () => {
    const t = ics(
      [
        ev([
          "UID:r",
          "DTSTART;TZID=America/Sao_Paulo:20260901T080000",
          "DTEND;TZID=America/Sao_Paulo:20260901T083000",
          "RRULE:FREQ=WEEKLY;BYDAY=TU,TH;UNTIL=20261231T000000Z",
          "EXDATE;TZID=America/Sao_Paulo:20260922T080000",
          "SUMMARY:Planejamento",
        ]),
        ev(["UID:r", "RECURRENCE-ID;TZID=America/Sao_Paulo:20260924T080000", "DTSTART;TZID=America/Sao_Paulo:20260924T150000", "DTEND;TZID=America/Sao_Paulo:20260924T153000", "SUMMARY:Planejamento (tarde)"]),
        ev(["UID:x", "DTSTART:20260923T120000Z", "STATUS:CANCELLED", "SUMMARY:Cancelado"]),
      ].join("\r\n"),
    );
    const es = lerAgenda(t, "2026-09-21", "2026-09-27", SP);
    expect(es.map((e) => `${e.titulo}@${e.inicio}`)).toEqual(["Planejamento (tarde)@2026-09-24T15:00"]);
    expect(lerAgenda(t, "2026-09-28", "2026-10-04", SP).map((e) => e.inicio)).toEqual(["2026-09-29T08:00", "2026-10-01T08:00"]);
  });

  it("repetição mensal, diária com COUNT e anual", () => {
    const t = ics(
      [
        ev(["UID:m", "DTSTART;VALUE=DATE:20260110", "RRULE:FREQ=MONTHLY", "SUMMARY:Pagar DAS"]),
        ev(["UID:d", "DTSTART:20260926T110000Z", "RRULE:FREQ=DAILY;COUNT=2", "SUMMARY:Stand-up"]),
        ev(["UID:y", "DTSTART;VALUE=DATE:20200315", "RRULE:FREQ=YEARLY", "SUMMARY:Aniversário"]),
      ].join("\r\n"),
    );
    expect(lerAgenda(t, "2026-10-01", "2026-10-31", SP).map((e) => `${e.titulo}:${e.inicio}`)).toEqual(["Pagar DAS:2026-10-10"]);
    expect(lerAgenda(t, "2026-09-26", "2026-09-30", SP).filter((e) => e.titulo === "Stand-up")).toHaveLength(2);
    expect(lerAgenda(t, "2027-03-15", "2027-03-15", SP).map((e) => e.titulo)).toEqual(["Aniversário"]);
  });

  it("só aceita endereço de agenda do Google", () => {
    expect(enderecoDeAgendaValido("https://calendar.google.com/calendar/ical/abc%40group.calendar.google.com/private-123/basic.ics")).toBe(true);
    expect(enderecoDeAgendaValido("http://calendar.google.com/calendar/ical/x/basic.ics")).toBe(false);
    expect(enderecoDeAgendaValido("https://evil.com/calendar/ical/x/basic.ics")).toBe(false);
    expect(enderecoDeAgendaValido("https://calendar.google.com/calendar/ical/x/basic.ics@evil.com")).toBe(false);
  });
});
