-- ════════════════════════════════════════════════════════════════════════════
-- Aden: segunda leva, parte 2 de 3 — histórico imutável e campos protegidos.
-- Rode inteiro, numa query nova, depois da 0004.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── Histórico que não se apaga ─────────────────────────────────────────────
create or replace function impedir_mudanca() returns trigger
language plpgsql as $$
begin
  raise exception 'Este registro faz parte do histórico e não pode ser alterado nem apagado.';
end;
$$;
create trigger auditoria_imutavel before update or delete on auditoria for each row execute function impedir_mudanca();
create trigger aprovacoes_imutavel before update or delete on aprovacoes for each row execute function impedir_mudanca();

-- ─── Campos protegidos ──────────────────────────────────────────────────────
-- Mudar valor que já existia só passa pela função de aprovação (que liga 'aden.aplicando').
-- Preencher campo vazio passa direto.
create or replace function proteger_campos() returns trigger
language plpgsql as $$
declare c text; v_antes jsonb; v_depois jsonb;
begin
  if coalesce(current_setting('aden.aplicando', true), '') = 'sim' then
    return new;
  end if;
  foreach c in array tg_argv loop
    v_antes := to_jsonb(old) -> c;
    v_depois := to_jsonb(new) -> c;
    if v_antes is not null and v_antes <> 'null'::jsonb and v_antes is distinct from v_depois then
      raise exception 'O campo "%" é protegido: a mudança precisa da aprovação do sócio afetado.', c
        using errcode = 'P0001';
    end if;
  end loop;
  return new;
end;
$$;

create trigger pessoas_protegido before update on pessoas
  for each row execute function proteger_campos('piso_hora_centavos', 'percentual_padrao', 'membro_id');
create trigger servico_divisao_protegido before update on servico_divisao
  for each row execute function proteger_campos('percentual');
create trigger tipos_entrega_protegido before update on tipos_entrega
  for each row execute function proteger_campos('horas_por_unidade');

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
