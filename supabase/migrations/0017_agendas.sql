-- Google Agenda (26/09/2026): cada pessoa guarda o "endereço secreto no formato iCal" da
-- própria agenda. Só leitura. O endereço dá acesso à agenda inteira, então:
-- - só o dono vê e mexe (nem outro sócio);
-- - SEM trigger de auditoria, para o endereço não ir parar no Histórico (que todos leem).

create table agendas_externas (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  membro_id uuid not null references membros(id) on delete cascade,
  nome text not null,
  url_ical text not null check (url_ical like 'https://calendar.google.com/calendar/ical/%'),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);
alter table agendas_externas enable row level security;
create trigger agendas_externas_carimbo before update on agendas_externas for each row execute function carimbar();

create or replace function meu_membro(org uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select id from membros where org_id = org and user_id = auth.uid() and ativo limit 1;
$$;
revoke execute on function meu_membro(uuid) from public, anon;
grant execute on function meu_membro(uuid) to authenticated;

create policy agendas_dono on agendas_externas for all
  using (membro_id = meu_membro(org_id))
  with check (membro_id = meu_membro(org_id));
