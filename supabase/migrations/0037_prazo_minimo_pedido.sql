-- Aden · prazo mínimo de tarefa pedida ao outro sócio (regra da Moni, 01/10/2026). Espelho de lib/regras/prazoPedido.ts.
-- Tarefa pedida a outro sócio tem prazo mínimo em dias úteis a partir do pedido (número na configuração, Limites;
-- vazio = sem regra). Sem prazo, entra sozinha com o mínimo. Prazo menor só como urgência (prioridade 'urgente'):
-- sem ela, o banco barra. Vale na criação, quando a tarefa passa para outro sócio e quando quem pediu muda o prazo.
-- Quem faz a tarefa mexe no próprio prazo à vontade. Só acréscimo.

alter table configuracoes_empresa add column if not exists prazo_minimo_pedido_dias_uteis int
  check (prazo_minimo_pedido_dias_uteis is null or prazo_minimo_pedido_dias_uteis > 0);

create or replace function somar_dias_uteis(de date, n int) returns date
language plpgsql immutable set search_path = public as $$
declare d date := de; c int := 0;
begin
  while c < n loop
    d := d + 1;
    if extract(isodow from d) < 6 then c := c + 1; end if;
  end loop;
  return d;
end;
$$;

create or replace function tarefa_quem_pediu() returns trigger
language plpgsql security definer set search_path = public as $$
declare q record; novo_pedido boolean := false; dias int; minimo date;
begin
  if tg_op = 'UPDATE' and new.responsavel_id is not distinct from old.responsavel_id then
    new.pedida_por_id := old.pedida_por_id;
    new.pedida_por_nome := old.pedida_por_nome;
  else
    select * into q from quem_age(new.org_id);
    if new.responsavel_id is not null and q.pessoa_id is not null and q.pessoa_id <> new.responsavel_id then
      new.pedida_por_id := q.pessoa_id;
      new.pedida_por_nome := q.nome;
      novo_pedido := true;
    else
      new.pedida_por_id := null;
      new.pedida_por_nome := null;
    end if;
  end if;

  -- prazo mínimo (0037)
  if new.pedida_por_id is null then
    return new;
  end if;
  if not novo_pedido then
    if new.vencimento is not distinct from old.vencimento then
      return new;
    end if;
    select * into q from quem_age(new.org_id);
    if q.pessoa_id is null or q.pessoa_id = new.responsavel_id then
      return new;
    end if;
  end if;
  if not exists (select 1 from pessoas p where p.id = new.responsavel_id and p.socio) then
    return new;
  end if;
  select e.prazo_minimo_pedido_dias_uteis into dias from configuracoes_empresa e where e.org_id = new.org_id;
  if dias is null then
    return new;
  end if;
  minimo := somar_dias_uteis((now() at time zone 'America/Sao_Paulo')::date, dias);
  if new.vencimento is null then
    new.vencimento := minimo;
  elsif new.vencimento < minimo and new.prioridade is distinct from 'urgente' then
    raise exception 'Prazo menor que % dias úteis para o outro sócio só como urgência: marque a tarefa como urgente ou use a partir de %.', dias, to_char(minimo, 'DD/MM') using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- o aviso de pedido diz quando é urgente
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
    case when new.prioridade = 'urgente' then 'Tarefa urgente para você' else 'Tarefa nova para você' end,
    new.pedida_por_nome || ' pediu: ' || new.titulo || coalesce(' (até ' || to_char(new.vencimento, 'DD/MM') || ')', ' (sem prazo)'),
    new.pedida_por_nome
  );
  return new;
end;
$$;

-- a Aden começa com 2 dias úteis (decisão da Moni, 01/10/2026); muda em Configurações → Limites
update configuracoes_empresa set prazo_minimo_pedido_dias_uteis = 2 where prazo_minimo_pedido_dias_uteis is null;
