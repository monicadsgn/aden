-- Aden · segunda leva (aprovação dos sócios, cronômetro, pagamentos, perfis)
-- Parte 5 de 6. Rode cada parte inteira, numa query nova, em ordem.
-- (Dividida em partes pequenas porque colar um arquivo grande cortava o texto.)

create or replace function concluir_pedido(p_pedido uuid) returns text
language plpgsql security definer set search_path = public as $$
declare p pedidos_alteracao; v_contrato uuid;
begin
  select * into p from pedidos_alteracao where id = p_pedido for update;
  if p.tipo = 'campos' then
    if not itens_ainda_valem(p.itens) then
      update pedidos_alteracao set status = 'cancelado', decidido_em = now(),
        motivo = 'Os valores mudaram desde o pedido. Faça o pedido de novo.' where id = p_pedido;
      return 'cancelado';
    end if;
    perform aplicar_itens(p.org_id, p.itens);
  elsif p.tipo = 'excecao' and coalesce(p.dados ->> 'aplicar', '') = 'escopo' and p.cliente_id is not null then
    select id into v_contrato from contratos where cliente_id = p.cliente_id and status = 'ativo' limit 1;
    if v_contrato is null then
      insert into contratos (org_id, cliente_id, status, escopo, valor_mensal_centavos)
      values (p.org_id, p.cliente_id, 'ativo', p.dados -> 'cenario', (p.dados ->> 'valor_centavos')::bigint);
    else
      update contratos set escopo = p.dados -> 'cenario',
        valor_mensal_centavos = coalesce((p.dados ->> 'valor_centavos')::bigint, valor_mensal_centavos)
      where id = v_contrato;
    end if;
  end if;
  update pedidos_alteracao set status = 'aplicado', decidido_em = now() where id = p_pedido;
  return 'aplicado';
end;
$$;

-- cria um pedido. Se quem pede é o único afetado, vale na hora.
create or replace function criar_pedido(
  p_org uuid, p_tipo text, p_descricao text, p_itens jsonb, p_afetados uuid[],
  p_impacto jsonb, p_dados jsonb, p_assinatura text, p_cliente uuid
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_autor uuid := minha_pessoa(p_org); v_nome text; v_pendentes uuid[]; v_status text := 'pendente';
begin
  if not eh_admin(p_org) then
    raise exception 'Só sócios podem pedir alteração.';
  end if;
  select nome into v_nome from membros where org_id = p_org and user_id = auth.uid() limit 1;
  insert into pedidos_alteracao (org_id, tipo, descricao, itens, dados, assinatura, cliente_id, afetados, impacto, autor_nome, autor_pessoa_id)
  values (p_org, p_tipo, p_descricao, coalesce(p_itens, '[]'), p_dados, p_assinatura, p_cliente, p_afetados, p_impacto, v_nome, v_autor)
  returning id into v_id;
  if v_autor is not null and v_autor = any(p_afetados) then
    insert into aprovacoes (org_id, pedido_id, pessoa_id, decisao, automatica) values (p_org, v_id, v_autor, 'aprovado', true);
  end if;
  v_pendentes := array(select unnest(p_afetados) except select v_autor where v_autor is not null);
  if coalesce(array_length(v_pendentes, 1), 0) = 0 then
    v_status := concluir_pedido(v_id);
  end if;
  return jsonb_build_object('pedido_id', v_id, 'status', v_status, 'aguardando', to_jsonb(v_pendentes));
end;
$$;

-- mudança em campos protegidos: o banco calcula quem é afetado
create or replace function propor_alteracao(p_org uuid, p_itens jsonb, p_impacto jsonb, p_descricao text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare i jsonb; v_afetados uuid[] := '{}';
begin
  for i in select * from jsonb_array_elements(p_itens) loop
    v_afetados := v_afetados || afetados_item(p_org, i);
  end loop;
  v_afetados := array(select distinct unnest(v_afetados));
  return criar_pedido(p_org, 'campos', p_descricao, p_itens, v_afetados, p_impacto, null, null, null);
end;
$$;

-- escopo ou proposta abaixo do piso: os afetados são os sócios abaixo do piso
create or replace function propor_excecao(
  p_org uuid, p_cliente uuid, p_afetados uuid[], p_assinatura text, p_descricao text, p_dados jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  return criar_pedido(p_org, 'excecao', p_descricao, '[]', p_afetados, null, p_dados, p_assinatura, p_cliente);
end;
$$;
