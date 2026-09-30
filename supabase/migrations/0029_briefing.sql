-- Aden · Fase 5, passo 2 (aprovado em 30/09/2026): briefing único no perfil do cliente.
-- Só acréscimo. O cliente não preenche nada (o formulário para o cliente foi descartado): o Áleff responde na reunião
-- dele, a Moni completa na dela. As perguntas ficam numa lista em Configurações (os sócios aprovam o texto); cada
-- resposta guarda quem respondeu e o texto da pergunta naquele momento (se a pergunta mudar depois, a resposta
-- continua fazendo sentido).

create table if not exists briefing_perguntas (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  secao text not null check (length(btrim(secao)) > 0),
  pergunta text not null check (length(btrim(pergunta)) > 0),
  ajuda text,
  -- vazio = vale para todos os serviços
  servico_id uuid references servicos(id) on delete set null,
  ordem integer not null default 0,
  ativo boolean not null default true,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);

create table if not exists briefing_respostas (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizacoes(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete cascade,
  pergunta_id uuid not null references briefing_perguntas(id) on delete cascade,
  pergunta_texto text not null,
  resposta text,
  respondido_por_nome text,
  pelo_claude boolean not null default false,
  respondido_em timestamptz,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid,
  unique (cliente_id, pergunta_id)
);

alter table briefing_perguntas enable row level security;
alter table briefing_respostas enable row level security;

drop policy if exists briefing_perguntas_leitura on briefing_perguntas;
create policy briefing_perguntas_leitura on briefing_perguntas for select using (eh_membro(org_id));
drop policy if exists briefing_perguntas_escrita on briefing_perguntas;
create policy briefing_perguntas_escrita on briefing_perguntas for all using (eh_admin(org_id)) with check (eh_admin(org_id));
drop policy if exists briefing_respostas_leitura on briefing_respostas;
create policy briefing_respostas_leitura on briefing_respostas for select using (eh_membro(org_id));
drop policy if exists briefing_respostas_escrita on briefing_respostas;
create policy briefing_respostas_escrita on briefing_respostas for all using (eh_admin(org_id)) with check (eh_admin(org_id));

-- quem respondeu vem do banco; o texto da pergunta é copiado na hora da resposta
create or replace function public.briefing_resposta_autor() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare q record;
begin
  if tg_op = 'UPDATE' then
    new.org_id := old.org_id;
    new.cliente_id := old.cliente_id;
    new.pergunta_id := old.pergunta_id;
    if new.resposta is not distinct from old.resposta then
      new.pergunta_texto := old.pergunta_texto;
      new.respondido_por_nome := old.respondido_por_nome;
      new.pelo_claude := old.pelo_claude;
      new.respondido_em := old.respondido_em;
      return new;
    end if;
  end if;
  select pergunta into new.pergunta_texto from briefing_perguntas where id = new.pergunta_id;
  select * into q from quem_age(new.org_id);
  new.respondido_por_nome := q.nome;
  new.pelo_claude := coalesce(q.pelo_claude, false);
  new.respondido_em := now();
  return new;
end;
$$;

drop trigger if exists briefing_respostas_autor on briefing_respostas;
create trigger briefing_respostas_autor before insert or update on briefing_respostas for each row execute function briefing_resposta_autor();

drop trigger if exists briefing_perguntas_carimbo on briefing_perguntas;
create trigger briefing_perguntas_carimbo before update on briefing_perguntas for each row execute function carimbar();
drop trigger if exists briefing_perguntas_auditoria on briefing_perguntas;
create trigger briefing_perguntas_auditoria after insert or update or delete on briefing_perguntas for each row execute function auditar();
drop trigger if exists briefing_respostas_carimbo on briefing_respostas;
create trigger briefing_respostas_carimbo before update on briefing_respostas for each row execute function carimbar();
drop trigger if exists briefing_respostas_auditoria on briefing_respostas;
create trigger briefing_respostas_auditoria after insert or update or delete on briefing_respostas for each row execute function auditar();
