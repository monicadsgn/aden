-- Aden · segunda leva (aprovação dos sócios, cronômetro, pagamentos, perfis)
-- Parte 4 de 6. Rode cada parte inteira, numa query nova, em ordem.
-- (Dividida em partes pequenas porque colar um arquivo grande cortava o texto.)

-- quem é afetado por um item (mesma regra de lib/regras/aprovacao.ts)
create or replace function afetados_item(p_org uuid, p_item jsonb) returns uuid[]
language plpgsql stable security definer set search_path = public as $$
declare v_campo text := p_item ->> 'campo';
begin
  if v_campo = 'piso_hora_centavos' then
    return array[(p_item ->> 'registro_id')::uuid];
  elsif v_campo = 'percentual_padrao' then
    return array(select id from pessoas where org_id = p_org and ativo and socio);
  elsif v_campo = 'percentual' then
    return array[(p_item ->> 'pessoa_id')::uuid];
  elsif v_campo = 'horas_por_unidade' then
    return array(
      select sd.pessoa_id from tipos_entrega t
      join servico_divisao sd on sd.servico_id = t.servico_id
      where t.id = (p_item ->> 'registro_id')::uuid and coalesce(sd.percentual, 0) > 0
    );
  end if;
  raise exception 'Campo % não é protegido.', v_campo;
end;
$$;

-- valor atual de um item no banco
create or replace function valor_atual_item(p_item jsonb) returns numeric
language plpgsql stable security definer set search_path = public as $$
declare v numeric; v_campo text := p_item ->> 'campo';
begin
  if v_campo = 'piso_hora_centavos' then
    select piso_hora_centavos into v from pessoas where id = (p_item ->> 'registro_id')::uuid;
  elsif v_campo = 'percentual_padrao' then
    select percentual_padrao into v from pessoas where id = (p_item ->> 'registro_id')::uuid;
  elsif v_campo = 'percentual' then
    select percentual into v from servico_divisao
      where servico_id = (p_item ->> 'registro_id')::uuid and pessoa_id = (p_item ->> 'pessoa_id')::uuid;
  elsif v_campo = 'horas_por_unidade' then
    select horas_por_unidade into v from tipos_entrega where id = (p_item ->> 'registro_id')::uuid;
  end if;
  return v;
end;
$$;

-- aplica os itens de um pedido (liga a chave que o trigger de proteção respeita)
create or replace function aplicar_itens(p_org uuid, p_itens jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare i jsonb; v numeric;
begin
  perform set_config('aden.aplicando', 'sim', true);
  for i in select * from jsonb_array_elements(p_itens) loop
    v := (i ->> 'depois')::numeric;
    case i ->> 'campo'
      when 'piso_hora_centavos' then
        update pessoas set piso_hora_centavos = v where id = (i ->> 'registro_id')::uuid and org_id = p_org;
      when 'percentual_padrao' then
        update pessoas set percentual_padrao = v where id = (i ->> 'registro_id')::uuid and org_id = p_org;
      when 'percentual' then
        insert into servico_divisao (org_id, servico_id, pessoa_id, percentual)
        values (p_org, (i ->> 'registro_id')::uuid, (i ->> 'pessoa_id')::uuid, v)
        on conflict (servico_id, pessoa_id) do update set percentual = excluded.percentual;
      when 'horas_por_unidade' then
        update tipos_entrega set horas_por_unidade = v where id = (i ->> 'registro_id')::uuid and org_id = p_org;
    end case;
  end loop;
  perform set_config('aden.aplicando', '', true);
end;
$$;

-- confere se nada mudou desde o pedido (senão o pedido é cancelado, não sobrescreve)
create or replace function itens_ainda_valem(p_itens jsonb) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare i jsonb;
begin
  for i in select * from jsonb_array_elements(p_itens) loop
    if valor_atual_item(i) is distinct from (i ->> 'antes')::numeric then
      return false;
    end if;
  end loop;
  return true;
end;
$$;
