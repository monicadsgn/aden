-- Aden · segunda leva (aprovação dos sócios, cronômetro, pagamentos, perfis)
-- Parte 6 de 6. Rode cada parte inteira, numa query nova, em ordem.
-- (Dividida em partes pequenas porque colar um arquivo grande cortava o texto.)

-- o sócio afetado decide
create or replace function decidir_pedido(p_pedido uuid, p_decisao text, p_motivo text default null) returns text
language plpgsql security definer set search_path = public as $$
declare p pedidos_alteracao; v_pessoa uuid; v_faltam int;
begin
  select * into p from pedidos_alteracao where id = p_pedido for update;
  if p.id is null then raise exception 'Pedido não encontrado.'; end if;
  if p.status <> 'pendente' then raise exception 'Este pedido já foi decidido.'; end if;
  v_pessoa := minha_pessoa(p.org_id);
  if v_pessoa is null or not (v_pessoa = any(p.afetados)) then
    raise exception 'Só o sócio afetado pode decidir este pedido.';
  end if;
  if p_decisao not in ('aprovado', 'recusado') then raise exception 'Decisão inválida.'; end if;
  if exists (select 1 from aprovacoes where pedido_id = p_pedido and pessoa_id = v_pessoa) then
    raise exception 'Você já decidiu este pedido.';
  end if;
  insert into aprovacoes (org_id, pedido_id, pessoa_id, decisao) values (p.org_id, p_pedido, v_pessoa, p_decisao);
  if p_decisao = 'recusado' then
    update pedidos_alteracao set status = 'recusado', decidido_em = now(), motivo = p_motivo where id = p_pedido;
    return 'recusado';
  end if;
  select count(*) into v_faltam from unnest(p.afetados) a
    where not exists (select 1 from aprovacoes x where x.pedido_id = p_pedido and x.pessoa_id = a and x.decisao = 'aprovado');
  if v_faltam = 0 then
    return concluir_pedido(p_pedido);
  end if;
  return 'pendente';
end;
$$;

-- quem pediu pode desistir enquanto está pendente
create or replace function cancelar_pedido(p_pedido uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update pedidos_alteracao set status = 'cancelado', decidido_em = now(), motivo = 'Cancelado por quem pediu.'
  where id = p_pedido and status = 'pendente' and autor_id = auth.uid();
  if not found then raise exception 'Só quem pediu pode cancelar um pedido pendente.'; end if;
end;
$$;

revoke execute on function aplicar_itens(uuid, jsonb) from public, anon, authenticated;
revoke execute on function concluir_pedido(uuid) from public, anon, authenticated;
revoke execute on function criar_pedido(uuid, text, text, jsonb, uuid[], jsonb, jsonb, text, uuid) from public, anon, authenticated;
