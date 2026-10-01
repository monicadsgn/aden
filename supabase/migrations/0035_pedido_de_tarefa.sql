-- Aden · G4 da auditoria (aprovado pela Moni em 01/10/2026): pedido de tarefa entre os sócios.
-- Substitui o bot de WhatsApp. Quando alguém (no site ou pelo Claude) cria uma tarefa para OUTRA pessoa, ou passa a
-- tarefa para outra pessoa, o banco grava quem pediu ("Mônica (pelo Claude)") e manda um aviso para quem recebeu.
-- Quem pediu vem sempre do banco (quem_age), nunca do que o app manda. Só acréscimo.

alter table tarefas add column if not exists pedida_por_id uuid references pessoas(id) on delete set null;
alter table tarefas add column if not exists pedida_por_nome text;

create or replace function tarefa_quem_pediu() returns trigger
language plpgsql security definer set search_path = public as $$
declare q record;
begin
  if tg_op = 'UPDATE' and new.responsavel_id is not distinct from old.responsavel_id then
    new.pedida_por_id := old.pedida_por_id;
    new.pedida_por_nome := old.pedida_por_nome;
    return new;
  end if;
  select * into q from quem_age(new.org_id);
  if new.responsavel_id is not null and q.pessoa_id is not null and q.pessoa_id <> new.responsavel_id then
    new.pedida_por_id := q.pessoa_id;
    new.pedida_por_nome := q.nome;
  else
    new.pedida_por_id := null;
    new.pedida_por_nome := null;
  end if;
  return new;
end;
$$;
drop trigger if exists tarefas_quem_pediu on tarefas;
create trigger tarefas_quem_pediu before insert or update on tarefas for each row execute function tarefa_quem_pediu();

-- aviso para quem recebeu o pedido (aparece em "Depende de mim" e em Pedidos e avisos → Avisos)
create or replace function tarefa_avisar_pedido() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.pedida_por_id is null or new.responsavel_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.pedida_por_id is not distinct from old.pedida_por_id and new.responsavel_id is not distinct from old.responsavel_id then
    return new;
  end if;
  if not exists (select 1 from pessoas p where p.id = new.responsavel_id and p.socio) then
    return new;
  end if;
  insert into avisos_socios (org_id, pessoa_id, titulo, texto, autor_nome)
  values (
    new.org_id,
    new.responsavel_id,
    'Tarefa nova para você',
    new.pedida_por_nome || ' pediu: ' || new.titulo || coalesce(' (até ' || to_char(new.vencimento, 'DD/MM') || ')', ' (sem prazo)'),
    new.pedida_por_nome
  );
  return new;
end;
$$;
drop trigger if exists tarefas_avisar_pedido on tarefas;
create trigger tarefas_avisar_pedido after insert or update on tarefas for each row execute function tarefa_avisar_pedido();
